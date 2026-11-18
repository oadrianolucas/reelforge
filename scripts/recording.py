#!/usr/bin/env python3
"""Prepares a real recording (you talking to the camera) for the edit in Remotion.

usage:
  python3 scripts/recording.py transcribe <raw.MOV> --job videos/<brand>/<job> [--fps 30]
  python3 scripts/recording.py cut --job videos/<brand>/<job> [--drop 3-7,12] [--pause 0.30]
  python3 scripts/recording.py speedup --job videos/<brand>/<job> [--factor 1.15]

transcribe
  recording/source/source.mp4       H.264 SDR BT.709, constant fps, 48 kHz audio (iPhone HDR converted)
  recording/source/transcript.json  ElevenLabs Scribe, word by word
  prints every word as `index:word@seconds` — read it like an editor and mark the mistakes/repetitions
cut
  removes the --drop words (source indices, ranges allowed) and every pause longer than --pause,
  without eating the start or end of words (follows the audio energy, not only the Scribe timing):
  recording/cut.mp4                 the cut video
  recording/edl.json                segments (source → cut) and the words in cut time, with index
  CHECK: transcribes the cut again and lists words that vanished (cut ate them) or remained (a retake stayed)
speedup
  recording/fast/ with the speech `factor` times faster (atempo: same pitch); word indices stay the same

Uses a full ffmpeg from PATH (prefers ffmpeg.exe when present, e.g. on WSL; Remotion's has no fps/select), run from inside
remotion/. Reads ELEVENLABS_API_KEY from .env.
Then: `python3 scripts/prepare.py <job> <slug>` copies recording/ to remotion/public/<slug>/.
"""
import argparse, array, difflib, json, os, re, shutil, subprocess, sys, urllib.request, uuid, wave

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REMOTION = os.path.join(ROOT, "remotion")
PCM_RATE = 8000  # audio to measure energy (8 kHz mono is enough to find where the voice starts and ends)
WINDOW = 80      # samples per energy window = 10 ms


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
    # Remotion's ffmpeg is slim (no fps/select/full tonemap): use the full Windows ffmpeg if present (e.g. winget Gyan.FFmpeg)
    exe = shutil.which(binary + ".exe") or shutil.which(binary)
    cmd = [exe, *args] if exe else ["npx", "remotion", binary, *args]
    r = subprocess.run(cmd, cwd=REMOTION, capture_output=True)
    if raw:
        return r.stdout
    txt = r.stdout.decode(errors="replace") + r.stderr.decode(errors="replace")
    if r.returncode:
        sys.exit(f"ffmpeg failed:\n{txt[-2000:]}")
    return txt


def probe(video):
    txt = ff(["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,color_transfer,r_frame_rate:stream_side_data=rotation",
              "-of", "json", rel(video)], "ffprobe")
    d = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    v = next(s for s in d["streams"] if s.get("codec_type") == "video")
    rot = next((abs(int(sd.get("rotation", 0))) for sd in v.get("side_data_list", [])), 0)
    w, h = (v["height"], v["width"]) if rot in (90, 270) else (v["width"], v["height"])
    return dict(dur=float(d["format"]["duration"]), w=w, h=h, transfer=v.get("color_transfer", ""))


def transcribe_audio(path, dest, language="por"):
    boundary = "----" + uuid.uuid4().hex
    body = b""
    fields = {"model_id": "scribe_v1", "timestamps_granularity": "word", "tag_audio_events": "false"}
    if language:  # empty = Scribe detects the language
        fields["language_code"] = language
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n".encode()
    body += open(path, "rb").read() + f"\r\n--{boundary}--\r\n".encode()
    r = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body, headers={
        "xi-api-key": env("ELEVENLABS_API_KEY"), "Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "reelforge/1.0"})
    d = json.load(urllib.request.urlopen(r, timeout=600))
    json.dump(d, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return [w for w in d["words"] if w.get("type") == "word"]


def audio_for_upload(video, dest):
    ff(["-y", "-v", "error", "-i", rel(video), "-vn", "-ac", "1", "-ar", "22050", "-b:a", "64k", rel(dest)])


def transcribe(a):
    folder = os.path.join(a.job, "recording", "source")
    os.makedirs(folder, exist_ok=True)
    source = os.path.join(folder, "source.mp4")
    s = probe(a.raw)
    hdr = s["transfer"] in ("arib-std-b67", "smpte2084")
    scale = "scale=-2:1920" if s["h"] > s["w"] else "scale=1920:-2"
    if min(s["w"], s["h"]) <= 1080:
        scale = "null"
    if hdr:
        # HLG/PQ read as SDR blows out the skin: linearize, convert to BT.709 and tonemap
        color = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
    else:
        color = "format=yuv420p"
    print(f"source: {s['w']}x{s['h']}, {s['dur']:.1f} s, HDR {'yes (' + s['transfer'] + ') → converting' if hdr else 'no'}")
    ff(["-y", "-v", "error", "-i", rel(a.raw), "-vf", f"{color},{scale},fps={a.fps}:start_time=0",
        "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", rel(source)])
    print(f"→ {source}")
    mp3 = os.path.join(folder, "audio.mp3")
    audio_for_upload(source, mp3)
    words = transcribe_audio(mp3, os.path.join(folder, "transcript.json"), a.language)
    print(f"→ {os.path.join(folder, 'transcript.json')}  ({len(words)} words)\n")
    print(" ".join(f"{i}:{w['text']}@{w['start']:.2f}" for i, w in enumerate(words)))


def energy(video):
    raw = ff(["-v", "error", "-i", rel(video), "-vn", "-ac", "1", "-ar", str(PCM_RATE), "-f", "s16le", "-"], raw=True)
    x = array.array("h", raw[: len(raw) // 2 * 2])
    env_ = [(sum(v * v for v in x[i:i + WINDOW]) / WINDOW) ** 0.5 for i in range(0, len(x) - WINDOW, WINDOW)]
    floor = sorted(env_)[len(env_) // 10] if env_ else 0
    return env_, max(floor * 3.0, 120.0)


def ranges(spec):
    out = set()
    for part in filter(None, (spec or "").split(",")):
        a, _, b = part.partition("-")
        out.update(range(int(a), int(b or a) + 1))
    return out


def cut(a):
    folder = os.path.join(a.job, "recording")
    source = os.path.join(folder, "source", "source.mp4")
    d = json.load(open(os.path.join(folder, "source", "transcript.json"), encoding="utf-8"))
    words = [w for w in d["words"] if w.get("type") == "word"]
    drop = ranges(a.drop)
    env_, threshold = energy(source)
    loud = lambda t: 0 <= int(t * 100) < len(env_) and env_[int(t * 100)] > threshold

    # group kept words into segments: break at a dropped word or a long pause
    groups, current = [], []
    for i, w in enumerate(words):
        if i in drop:
            if current: groups.append(current); current = []
            continue
        if current and w["start"] - words[current[-1]]["end"] > a.pause:
            groups.append(current); current = []
        current.append(i)
    if current: groups.append(current)

    fps, segments = a.fps, []
    for g in groups:
        ini, end = words[g[0]]["start"], words[g[-1]]["end"]
        # never enter the neighbouring word (dropped or from the next segment), even with no pause between them
        ceiling = words[g[-1] + 1]["start"] - 0.02 if g[-1] + 1 < len(words) else end + 1.0
        floor = words[g[0] - 1]["end"] + 0.02 if g[0] > 0 else 0.0
        # Scribe's end often cuts the word's tail: follow the energy until it drops (max +0.25 s)
        t = end
        while t < end + 0.25 and loud(t): t += 0.01
        end = max(words[g[-1]]["end"], min(t + a.after, ceiling))
        t = ini
        while t > ini - 0.15 and loud(t - 0.01): t -= 0.01
        ini = max(0.0, min(words[g[0]]["start"], max(t - a.before, floor)))
        if segments and ini < segments[-1][1]:  # touches the previous one: split the overlap in the middle
            mid = (segments[-1][1] + ini) / 2
            segments[-1][1], ini = mid, mid
        segments.append([ini, end, g])
    # snap to the frame grid, otherwise the audio drifts from the video at every cut
    for tr in segments:
        tr[0] = round(tr[0] * fps) / fps
        tr[1] = max(tr[0] + 1 / fps, round(tr[1] * fps) / fps)

    # video: select by frame number (by time, rounding loses a frame at the edge)
    sel = "+".join(f"between(n,{round(i * fps)},{round(f * fps) - 1})" for i, f, _ in segments)
    # audio: cut here, sample by sample, with a 4 ms fade at each edge (this ffmpeg's aselect doesn't cut)
    pcm = ff(["-v", "error", "-i", rel(source), "-vn", "-ac", "2", "-ar", "48000", "-f", "s16le", "-"], raw=True)
    samples_per_frame, fade = 48000 // fps, 192
    sound = array.array("h")
    for i, f, _ in segments:
        piece = array.array("h", pcm[round(i * fps) * samples_per_frame * 4: round(f * fps) * samples_per_frame * 4])
        piece.extend([0] * ((round(f * fps) - round(i * fps)) * samples_per_frame * 2 - len(piece)))  # end of file
        for k in range(min(fade, len(piece) // 4)):
            g = k / fade
            for c in (0, 1):
                piece[2 * k + c] = int(piece[2 * k + c] * g)
                piece[len(piece) - 2 - 2 * k + c] = int(piece[len(piece) - 2 - 2 * k + c] * g)
        sound.extend(piece)
    wav = os.path.join(folder, "source", "cut.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000); w.writeframes(sound.tobytes())
    cut_mp4 = os.path.join(folder, "cut.mp4")
    ff(["-y", "-v", "error", "-i", rel(source), "-i", rel(wav), "-map", "0:v", "-map", "1:a",
        "-vf", f"select='{sel}',setpts=N/FRAME_RATE/TB",
        "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", rel(cut_mp4)])

    edl_segments, edl_words, t_ed = [], [], 0.0
    for ini, end, g in segments:
        edl_segments.append(dict(src_start=round(ini, 3), src_end=round(end, 3), start=round(t_ed, 3), end=round(t_ed + end - ini, 3)))
        for i in g:
            w = words[i]
            edl_words.append(dict(i=len(edl_words), src_i=i, text=w["text"],
                                  start=round(t_ed + max(0.0, w["start"] - ini), 3), end=round(t_ed + min(end, w["end"]) - ini, 3)))
        t_ed += end - ini
    edl = dict(fps=fps, duration=round(t_ed, 3), segments=edl_segments, words=edl_words)
    json.dump(edl, open(os.path.join(folder, "edl.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    src_dur = words[-1]["end"] if words else 0
    print(f"cut: {src_dur:.2f} s → {t_ed:.2f} s in {len(segments)} segments → {cut_mp4}")

    # CHECK: transcribe the cut and compare with the words that should remain
    mp3 = os.path.join(folder, "source", "cut.mp3")
    audio_for_upload(cut_mp4, mp3)
    heard = transcribe_audio(mp3, os.path.join(folder, "source", "transcript-cut.json"), d.get("language_code") or "por")
    clean = lambda s: re.sub(r"[^\w]", "", s.lower())
    expected, got = [clean(w["text"]) for w in edl_words], [clean(w["text"]) for w in heard]
    diffs = [op for op in difflib.SequenceMatcher(None, expected, got, autojunk=False).get_opcodes() if op[0] != "equal"]
    if not diffs:
        print("CHECK: ok, every word survived the cut")
    for tag, i1, i2, j1, j2 in diffs:
        where = f"near {edl_words[min(i1, len(edl_words) - 1)]['start']:.2f} s" if edl_words else ""
        print(f"CHECK: {tag:7} expected «{' '.join(expected[i1:i2])}» heard «{' '.join(got[j1:j2])}» {where}")
    if diffs:
        print("  word vanished → raise --after/--before or --pause · word remained → a retake stayed, remove it with --drop"
              " · a word heard differently both times is the speech, not the cut")
    print("\nwords in the cut (edl.json indices):")
    print(" ".join(f"{w['i']}:{w['text']}@{w['start']:.2f}" for w in edl_words))


def speedup(a):
    """cut.mp4 + edl.json → recording/fast/ with the speech `factor` times faster (atempo: same pitch).
    Word indices don't change, so the job's edit.json stays valid; only the times are divided by the factor."""
    folder = os.path.join(a.job, "recording")
    edl = json.load(open(os.path.join(folder, "edl.json"), encoding="utf-8"))
    out = os.path.join(folder, "fast")
    os.makedirs(out, exist_ok=True)
    f, fps = a.factor, edl["fps"]
    ff(["-y", "-v", "error", "-i", rel(os.path.join(folder, "cut.mp4")),
        "-vf", f"setpts=PTS/{f},fps={fps}", "-af", f"atempo={f}",
        "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", rel(os.path.join(out, "cut.mp4"))])
    q = lambda t: round(round(t / f * fps) / fps, 3)  # cuts on the frame grid: the alternating zoom lands on the cut
    edl["segments"] = [dict(tr, start=q(tr["start"]), end=q(tr["end"])) for tr in edl["segments"]]
    edl["words"] = [dict(w, start=round(w["start"] / f, 3), end=round(w["end"] / f, 3)) for w in edl["words"]]
    edl["duration"], edl["factor"] = q(edl["duration"]), f
    json.dump(edl, open(os.path.join(out, "edl.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"sped up {f}x: {edl['duration']:.2f} s → {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("transcribe")
    t.add_argument("raw")
    t.add_argument("--job", required=True)
    t.add_argument("--fps", type=int, default=30)
    t.add_argument("--language", default="por", help="ISO 639-3 code for Scribe (por, spa, eng)")
    c = sub.add_parser("cut")
    c.add_argument("--job", required=True)
    c.add_argument("--drop", default="", help="source indices to remove (mistakes, retakes): 3-7,12")
    c.add_argument("--pause", type=float, default=0.30, help="a pause longer than this becomes a cut (s)")
    c.add_argument("--before", type=float, default=0.04, help="margin before the segment's 1st word (s)")
    c.add_argument("--after", type=float, default=0.08, help="margin after the measured end of the last word (s)")
    c.add_argument("--fps", type=int, default=30)
    r = sub.add_parser("speedup", help="dynamic version: faster speech (recording/fast/)")
    r.add_argument("--job", required=True)
    r.add_argument("--factor", type=float, default=1.15)
    a = ap.parse_args()
    {"transcribe": transcribe, "cut": cut, "speedup": speedup}[a.cmd](a)
