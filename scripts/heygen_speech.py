#!/usr/bin/env python3
"""Persona SPEAKING: photo + a slice of the ElevenLabs narration → lip-synced clip (HeyGen Avatar IV on OpenRouter).

usage: python3 scripts/heygen_speech.py --photo library/personas/<persona>/persona.png \
         --audio videos/<brand>/<job>/voice/narration.mp3 --from 0 --to 3.5 --out videos/<brand>/<job>/scenes/speech-1.mp4 [--prompt "..."]

Cuts [from, to] out of the narration (s; cut in the middle of a silence — see the alignment from voice.py), uploads the
slice to the private Apify store (signed link — the API only accepts audio over HTTPS) and sends photo + audio. The clip
comes out with the slice's duration and audio; in the edit use the whole narration and the muted clip, at the same time.
Cost: US$ 0.05/s (printed at the end). Generates a paid video: only with the user's ok.
"""
import argparse, base64, json, os, sys, time

sys.path.insert(0, os.path.dirname(__file__))
from recording import ff, rel  # noqa: E402
from host_apify import host  # noqa: E402
from video_openrouter import API, req  # noqa: E402

PROMPT = ("A real woman recording a casual selfie video of herself on her phone, talking naturally to the camera, "
          "small natural head movements and expressions, relaxed and genuine, hands mostly out of frame.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--photo", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--from", dest="start", type=float, default=0)
    ap.add_argument("--to", dest="end", type=float)
    ap.add_argument("--out", required=True)
    ap.add_argument("--prompt", default=PROMPT)
    a = ap.parse_args()

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    piece = os.path.splitext(a.out)[0] + ".audio.mp3"
    cut = ["-ss", f"{a.start:.3f}"] + (["-to", f"{a.end:.3f}"] if a.end else [])
    ff(["-y", "-v", "error", "-i", rel(a.audio), *cut, "-af", "afade=t=in:d=0.02", "-ar", "44100", "-b:a", "192k", rel(piece)])
    url = host(piece, os.path.basename(a.out).replace(".mp4", "") + "-" + str(int(time.time())) + ".mp3")

    data = open(a.photo, "rb").read()
    mime = "image/jpeg" if data[:3] == b"\xff\xd8\xff" else "image/png"  # HeyGen checks the mime against the content
    body = {"model": "heygen/avatar-iv", "prompt": a.prompt, "aspect_ratio": "9:16", "resolution": "720p",
            "input_references": [{"type": "image_url", "image_url": {"url": f"data:{mime};base64," + base64.b64encode(data).decode()}},
                                 {"type": "audio_url", "audio_url": {"url": url}}]}
    job = req("POST", API, body)
    print("job", job.get("id"), flush=True)
    job_url, t0 = job.get("polling_url") or f"{API}/{job['id']}", time.time()
    while True:
        time.sleep(10)
        st = req("GET", job_url)
        if st.get("status") == "completed":
            break
        if st.get("status") == "failed":
            sys.exit("failed: " + json.dumps(st.get("error"))[:600])
        if time.time() - t0 > 25 * 60:
            sys.exit("took more than 25 min")
    open(a.out, "wb").write(req("GET", f"{API}/{job['id']}/content?index=0", binary=True))
    print(json.dumps({"out": a.out, "cost_usd": (st.get("usage") or {}).get("cost"), "seconds": int(time.time() - t0)}))


if __name__ == "__main__":
    main()
