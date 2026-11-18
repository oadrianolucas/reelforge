#!/usr/bin/env python3
"""Generates a video clip on OpenRouter (POST /api/v1/videos), waits and downloads the .mp4.

usage: video_openrouter.py --model bytedance/seedance-2.5 --image scenes/ref.jpg \
         --prompt "..." --duration 5 --size 720x1280 --out scenes/clip.mp4

Reads OPENROUTER_API_KEY from the environment or from the project root .env. Prints the real cost (usage.cost) at the end.
"""
import argparse, base64, json, mimetypes, os, sys, time, urllib.request, urllib.error

API = "https://openrouter.ai/api/v1/videos"


def api_key():
    k = os.environ.get("OPENROUTER_API_KEY")
    if k:
        return k
    env = os.path.join(os.path.dirname(__file__), "..", ".env")
    for line in open(env, encoding="utf-8"):
        if line.startswith("OPENROUTER_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("OPENROUTER_API_KEY not found")


def req(method, url, body=None, binary=False):
    h = {"Authorization": "Bearer " + api_key(), "User-Agent": "reelforge/1.0"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            b = resp.read()
            return b if binary else json.loads(b)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} at {url}: {e.read()[:600].decode(errors='replace')}")


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--model", default="bytedance/seedance-2.5")
    a.add_argument("--prompt", required=True)
    a.add_argument("--image", help="first frame (local file)")
    a.add_argument("--last", help="last frame (local file) — the model generates the transition between --image and it (Veo, Kling, Wan…)")
    a.add_argument("--duration", type=int, default=5)
    a.add_argument("--size", default="720x1280")
    a.add_argument("--out", required=True)
    a.add_argument("--audio", action="store_true", help="let the model generate audio (default: no audio)")
    o = a.parse_args()

    body = {"model": o.model, "prompt": o.prompt, "duration": o.duration, "size": o.size, "generate_audio": o.audio}
    if o.image:
        mime = mimetypes.guess_type(o.image)[0] or "image/jpeg"
        uri = f"data:{mime};base64," + base64.b64encode(open(o.image, "rb").read()).decode()
        body["frame_images"] = [{"type": "image_url", "image_url": {"url": uri}, "frame_type": "first_frame"}]
    if o.last:
        mime = mimetypes.guess_type(o.last)[0] or "image/jpeg"
        uri = f"data:{mime};base64," + base64.b64encode(open(o.last, "rb").read()).decode()
        body.setdefault("frame_images", []).append({"type": "image_url", "image_url": {"url": uri}, "frame_type": "last_frame"})

    job = req("POST", API, body)
    print("job", job.get("id"), job.get("status"), flush=True)
    url = job.get("polling_url") or f"{API}/{job['id']}"
    t0 = time.time()
    while True:
        time.sleep(10)
        st = req("GET", url)
        s = st.get("status")
        if s == "completed":
            break
        if s == "failed":
            sys.exit("failed: " + json.dumps(st.get("error"))[:600])
        if time.time() - t0 > 20 * 60:
            sys.exit("took more than 20 min")
        print(f"  {s} ({int(time.time() - t0)} s)", flush=True)

    os.makedirs(os.path.dirname(os.path.abspath(o.out)), exist_ok=True)
    open(o.out, "wb").write(req("GET", f"{API}/{job['id']}/content?index=0", binary=True))
    cost = (st.get("usage") or {}).get("cost")
    print(json.dumps({"out": o.out, "cost_usd": cost, "seconds": int(time.time() - t0)}))


if __name__ == "__main__":
    main()
