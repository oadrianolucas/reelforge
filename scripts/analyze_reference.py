#!/usr/bin/env python3
"""Analyzes reference videos: duration, cuts (pacing), transcript with per-word timing, and frames.

usage: python3 scripts/analyze_reference.py references/<folder>/<video>.mp4 [...]

For each video creates `<video>.analysis/` next to it with:
  frames/t_000.5.jpg ...    one frame every 0.5 s (240 px wide) — to look at
  cuts/c_012.3.jpg ...      the first frame of every new shot
  transcript.json           ElevenLabs speech-to-text (scribe_v1), words with timing
  analysis.json             duration, resolution, cuts, cuts/min, average shot length, words/s, text
and prints a summary. Uses the ffmpeg bundled with Remotion (run from inside remotion/).
Reads ELEVENLABS_API_KEY from .env. The videos are third-party material: don't commit them (references/ is in .gitignore).
"""
import json, os, subprocess, sys, urllib.request, uuid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REMOTION = os.path.join(ROOT, "remotion")


def env(name):
    if os.environ.get(name):
        return os.environ[name]
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"{name} not found")


def rel(p):
    # the ffmpeg may be a Windows binary (under WSL): a path relative to remotion/ avoids Linux mount paths
    return os.path.relpath(os.path.abspath(p), REMOTION)


def ff(args, binary="ffmpeg", raw=False):
    r = subprocess.run(["npx", "remotion", binary, *args], cwd=REMOTION, capture_output=True)
    if raw:
        return r.stdout
    return r.stdout.decode(errors="replace") + r.stderr.decode(errors="replace")


def probe(video):
    txt = ff(["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", rel(video)], "ffprobe")
    txt = txt[txt.index("{"):]
    d = json.loads(txt[: txt.rindex("}") + 1])
    v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video"), {})
    return float(d["format"]["duration"]), v.get("width"), v.get("height"), any(s.get("codec_type") == "audio" for s in d.get("streams", []))


def cuts(video, w=32, h=56, fps=8, threshold=28.0):
    """Mean difference between 32x56 gray frames at 8 fps; a peak above the threshold = cut."""
    raw = ff(["-v", "error", "-i", rel(video), "-r", str(fps), "-s", f"{w}x{h}", "-pix_fmt", "gray", "-c:v", "rawvideo", "-f", "image2pipe", "-"], raw=True)
    n = w * h
    frames = [raw[i:i + n] for i in range(0, len(raw) - n + 1, n)]
    diffs = [sum(abs(a - b) for a, b in zip(q1, q2)) / n for q1, q2 in zip(frames, frames[1:])]
    out, last = [], -1.0
    for i, d in enumerate(diffs):
        t = (i + 1) / fps
        if d > threshold and t - last > 0.3:
            out.append(round(t, 2))
            last = t
    return out


def transcribe(video, dest):
    if os.path.exists(dest):
        return json.load(open(dest))
    boundary = "----" + uuid.uuid4().hex
    body = b""
    for k, v in {"model_id": "scribe_v1", "timestamps_granularity": "word", "tag_audio_events": "true"}.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"v.mp4\"\r\nContent-Type: video/mp4\r\n\r\n".encode()
    body += open(video, "rb").read() + f"\r\n--{boundary}--\r\n".encode()
    r = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body, headers={
        "xi-api-key": env("ELEVENLABS_API_KEY"), "Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "reelforge/1.0"})
    d = json.load(urllib.request.urlopen(r, timeout=300))
    json.dump(d, open(dest, "w"), ensure_ascii=False, indent=1)
    return d


def frame(video, t, dest, width=240):
    ff(["-y", "-v", "error", "-ss", f"{t:.2f}", "-i", rel(video), "-frames:v", "1", "-vf", f"scale={width}:-1", rel(dest)])


def analyze(video):
    folder = os.path.splitext(video)[0] + ".analysis"
    os.makedirs(os.path.join(folder, "frames"), exist_ok=True)
    os.makedirs(os.path.join(folder, "cuts"), exist_ok=True)
    dur, w, h, has_audio = probe(video)
    cs = cuts(video)
    # every frame each 0.5 s in a single call (opening ffmpeg per frame costs ~2 s each)
    tmp = os.path.join(folder, "frames")
    ff(["-y", "-v", "error", "-i", rel(video), "-r", "2", "-vf", "scale=240:-1", rel(os.path.join(tmp, "q_%04d.jpg"))])
    for name in sorted(os.listdir(tmp)):
        if name.startswith("q_"):
            t = (int(name[2:6]) - 1) * 0.5
            os.replace(os.path.join(tmp, name), os.path.join(tmp, f"t_{t:05.1f}.jpg"))
    for c in [0.05] + cs:
        frame(video, min(c + 0.1, dur - 0.05), os.path.join(folder, "cuts", f"c_{c:05.1f}.jpg"))
    tr = transcribe(video, os.path.join(folder, "transcript.json")) if has_audio else {}
    words = [p for p in tr.get("words", []) if p.get("type") == "word"]
    speech = (words[-1]["end"] - words[0]["start"]) if words else 0
    shots = [b - a for a, b in zip([0] + cs, cs + [dur])]
    a = {
        "video": os.path.relpath(video, ROOT), "duration": round(dur, 2), "resolution": f"{w}x{h}",
        "cuts": cs, "cuts_per_min": round(len(cs) / dur * 60, 1),
        "avg_shot_s": round(sum(shots) / len(shots), 2), "longest_shot_s": round(max(shots), 2),
        "language": tr.get("language_code"), "words": len(words),
        "words_per_s": round(len(words) / speech, 2) if speech else 0, "text": tr.get("text", ""),
    }
    json.dump(a, open(os.path.join(folder, "analysis.json"), "w"), ensure_ascii=False, indent=1)
    return a


if __name__ == "__main__":
    if not sys.argv[1:] or sys.argv[1] in ("-h", "--help"):
        sys.exit(__doc__)
    for v in sys.argv[1:]:
        a = analyze(v)
        print(f"\n== {a['video']}  {a['duration']} s  {a['resolution']}")
        print(f"   cuts: {len(a['cuts'])} ({a['cuts_per_min']}/min) · avg shot {a['avg_shot_s']} s · longest {a['longest_shot_s']} s")
        print(f"   speech: {a['words']} words, {a['words_per_s']}/s, language {a['language']}")
        print(f"   text: {a['text'][:400]}")
