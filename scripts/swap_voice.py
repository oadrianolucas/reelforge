#!/usr/bin/env python3
"""Swaps the voice of a spoken AI clip (Seedance with audio) for a native ElevenLabs voice, without touching the video.

usage: python3 scripts/swap_voice.py <clip.mp4> --voice <voice_id> [--out clip.voice.mp4]
       python3 scripts/swap_voice.py <clip.mp4> --samples a=<voice_id>,b=<voice_id>   (one .mp4 per voice)

Why: Seedance speaks the right words but with a foreign accent, and the voice varies from take to take.
ElevenLabs Speech-to-Speech (eleven_multilingual_sts_v2) redoes the speech with the native voice keeping the timing of
each syllable — the lips still match — and the voice becomes the same across all takes (the persona's fixed voice_id).
Cost: ElevenLabs credits per second of audio (cents). Reads ELEVENLABS_API_KEY from .env.
The voice id comes from --voice or the ELEVENLABS_VOICE_ID env var.
"""
import argparse, os, sys, urllib.error, urllib.request, uuid

sys.path.insert(0, os.path.dirname(__file__))
from recording import ff, rel, env  # noqa: E402


def sts(audio, voice, dest):
    boundary = "----" + uuid.uuid4().hex
    body = b""
    for k, v in {"model_id": "eleven_multilingual_sts_v2", "remove_background_noise": "true",
                 "voice_settings": '{"stability": 0.5, "similarity_boost": 0.85, "style": 0.2}'}.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"a.wav\"\r\nContent-Type: audio/wav\r\n\r\n".encode()
    body += open(audio, "rb").read() + f"\r\n--{boundary}--\r\n".encode()
    r = urllib.request.Request(f"https://api.elevenlabs.io/v1/speech-to-speech/{voice}?output_format=mp3_44100_128", data=body,
                               headers={"xi-api-key": env("ELEVENLABS_API_KEY"), "User-Agent": "reelforge/1.0",
                                        "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        open(dest, "wb").write(urllib.request.urlopen(r, timeout=300).read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read()[:500].decode(errors='replace')}")


def swap(clip, voice, out):
    base = os.path.splitext(out)[0]
    wav, mp3 = base + ".orig.wav", base + ".mp3"
    ff(["-y", "-v", "error", "-i", rel(clip), "-vn", "-ac", "1", "-ar", "44100", rel(wav)])
    sts(wav, voice, mp3)
    ff(["-y", "-v", "error", "-i", rel(clip), "-i", rel(mp3), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k", rel(out)])
    os.remove(wav)
    print("→", out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clip")
    ap.add_argument("--voice", default=os.environ.get("ELEVENLABS_VOICE_ID"), help="voice_id (default: $ELEVENLABS_VOICE_ID)")
    ap.add_argument("--samples", help="name=voice_id,name=voice_id")
    ap.add_argument("--out")
    a = ap.parse_args()
    base = os.path.splitext(a.clip)[0]
    if a.samples:
        for pair in a.samples.split(","):
            name, voice = pair.split("=")
            swap(a.clip, voice, f"{base}.voice-{name}.mp4")
    elif a.voice:
        swap(a.clip, a.voice, a.out or base + ".voice.mp4")
    else:
        sys.exit("pass --voice or --samples")


if __name__ == "__main__":
    main()
