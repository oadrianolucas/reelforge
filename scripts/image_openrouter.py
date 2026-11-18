#!/usr/bin/env python3
"""Generates an image on OpenRouter (chat/completions with modalities=image) and saves it to a file.

usage: image_openrouter.py --out scenes/shot1.jpg --prompt "..." [--model bytedance-seed/seedream-5-0-lite] [--aspect 9:16]
       image_openrouter.py --out scenes/car-selfie.jpg --reference brands/<brand>/assets/persona.png --prompt "same woman..."

--reference (repeatable): photo(s) the model edits/follows — use it for the SAME persona in another angle/place (generating
from scratch changes the face). With a reference the default becomes google/gemini-nano-banana-2.1 (editing with a faithful face).

Reads OPENROUTER_API_KEY from the environment or from the project root .env. Prints the real cost (usage.cost).
"""
import argparse, base64, json, mimetypes, os, sys, urllib.error, urllib.request


def api_key():
    k = os.environ.get("OPENROUTER_API_KEY")
    if k:
        return k
    for line in open(os.path.join(os.path.dirname(__file__), "..", ".env"), encoding="utf-8"):
        if line.startswith("OPENROUTER_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("OPENROUTER_API_KEY not found")


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--prompt", required=True)
    a.add_argument("--out", required=True)
    a.add_argument("--model")
    a.add_argument("--aspect", default="9:16")
    a.add_argument("--reference", action="append", default=[], help="reference image (repeatable)")
    o = a.parse_args()
    model = o.model or ("google/gemini-nano-banana-2.1" if o.reference else "bytedance-seed/seedream-5-0-lite")

    content = o.prompt
    if o.reference:
        content = [{"type": "text", "text": o.prompt}]
        for ref in o.reference:
            data = open(ref, "rb").read()
            # mime from the content, not the extension (a persona.png may be a JPEG inside)
            mime = "image/jpeg" if data[:3] == b"\xff\xd8\xff" else "image/png" if data[:4] == b"\x89PNG" else (mimetypes.guess_type(ref)[0] or "image/jpeg")
            content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64," + base64.b64encode(data).decode()}})
    body = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        # Seedream only generates images (asking for "text" too gives 404); the Gemini image models want both
        "modalities": ["image", "text"] if "gemini" in model else ["image"],
        "image_config": {"aspect_ratio": o.aspect},
    }
    r = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + api_key(), "Content-Type": "application/json", "User-Agent": "reelforge/1.0"},
    )
    try:
        d = json.load(urllib.request.urlopen(r, timeout=180))
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read()[:600].decode(errors='replace')}")
    imgs = (d.get("choices") or [{}])[0].get("message", {}).get("images") or []
    if not imgs:
        sys.exit("no image in the response: " + json.dumps(d)[:600])
    os.makedirs(os.path.dirname(os.path.abspath(o.out)), exist_ok=True)
    open(o.out, "wb").write(base64.b64decode(imgs[0]["image_url"]["url"].split(",", 1)[1]))
    print(json.dumps({"out": o.out, "cost_usd": (d.get("usage") or {}).get("cost")}))


if __name__ == "__main__":
    main()
