#!/usr/bin/env python3
"""Generates narration with ElevenLabs and aligns the words right away (timing of each one).

usage:
  python3 scripts/voice.py --voice <voice_id> --text-file videos/<brand>/<job>/voice/narration-tags.txt \
      --out videos/<brand>/<job>/voice/narration.mp3
  python3 scripts/voice.py ... --samples a=<voice_id>,b=<voice_id>   (one sample per voice in the --out folder)

- The text may carry eleven_v3 emotion tags ([excited], [laughs], [whispers]...). They are stripped automatically
  for the alignment.
- Defaults: model eleven_v3, stability 0 (the most expressive setting).
- The voice id comes from --voice or the ELEVENLABS_VOICE_ID env var (set it per brand from brand.md).
- Next to the mp3 it writes `<out>.alignment.json` (forced alignment) — that is what ties captions and beats to the speech.
- `--pronunciation Brandname=Brahndname` (comma separates several): ElevenLabs gets the spelling that sounds right;
  the alignment and the captions keep the original spelling.
- To replace ONE sentence without losing the approved take, use scripts/patch_voice.py.
"""
import argparse, json, os, re, sys, urllib.request, uuid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def api_key():
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"]
    for l in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        if l.startswith("ELEVENLABS_API_KEY="):
            return l.split("=", 1)[1].strip()
    sys.exit("ELEVENLABS_API_KEY not found")


def tts(voice, text, out, model, stability):
    body = json.dumps({"text": text, "model_id": model, "voice_settings": {
        "stability": stability, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}}).encode()
    r = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128", data=body,
                               headers={"xi-api-key": api_key(), "Content-Type": "application/json", "User-Agent": "reelforge/1.0"})
    try:
        data = urllib.request.urlopen(r, timeout=300).read()
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs HTTP {e.code}: {e.read()[:300].decode(errors='replace')}")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, "wb").write(data)
    return len(data) * 8 / 128000  # approximate duration (s)


def align(mp3, text, out):
    boundary = "----" + uuid.uuid4().hex
    body = f"--{boundary}\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\n{text}\r\n".encode()
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n".encode()
    body += open(mp3, "rb").read() + f"\r\n--{boundary}--\r\n".encode()
    r = urllib.request.Request("https://api.elevenlabs.io/v1/forced-alignment", data=body, headers={
        "xi-api-key": api_key(), "Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "reelforge/1.0"})
    d = json.load(urllib.request.urlopen(r, timeout=300))
    json.dump(d, open(out, "w"), ensure_ascii=False, indent=1)
    w = [x for x in d.get("words", []) if x["text"].strip()]
    return w


def strip_tags(t):
    return re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]", "", t)).strip()


if __name__ == "__main__":
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--voice", default=os.environ.get("ELEVENLABS_VOICE_ID"), help="ElevenLabs voice_id (default: $ELEVENLABS_VOICE_ID)")
    a.add_argument("--text")
    a.add_argument("--text-file")
    a.add_argument("--out", required=True)
    a.add_argument("--model", default="eleven_v3")
    a.add_argument("--stability", type=float, default=0.0)
    a.add_argument("--samples", help="name=voice_id,name=voice_id — one sample per voice in the --out folder")
    a.add_argument("--no-alignment", action="store_true")
    a.add_argument("--pronunciation", help="spelling=sound,... — replaced only in the text sent to the voice")
    o = a.parse_args()
    text = o.text or open(o.text_file, encoding="utf-8").read().strip()
    spoken = text
    for pair in (o.pronunciation or "").split(","):
        if "=" in pair:
            spelling, sound = pair.split("=", 1)
            spoken = re.sub(rf"\b{re.escape(spelling)}\b", sound, spoken)
    if o.samples:
        for pair in o.samples.split(","):
            name, vid = pair.split("=")
            s = tts(vid, spoken, os.path.join(o.out, name + ".mp3"), o.model, o.stability)
            print(f"{name}: ~{s:.1f} s")
        sys.exit(0)
    if not o.voice:
        sys.exit("pass --voice or set ELEVENLABS_VOICE_ID")
    s = tts(o.voice, spoken, o.out, o.model, o.stability)
    print(f"voice: {o.out} (~{s:.1f} s)")
    if not o.no_alignment:
        w = align(o.out, strip_tags(text), os.path.splitext(o.out)[0] + ".alignment.json")
        print(f"alignment: {len(w)} words, speech ends at {w[-1]['end']:.2f} s")
        print(" ".join(f"{i}:{x['text']}@{x['start']:.1f}" for i, x in enumerate(w)))
