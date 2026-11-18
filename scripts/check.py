#!/usr/bin/env python3
"""Finishing and checking of a render (applies to every style): standard loudness + contact sheet + speech.

usage:
  python3 scripts/check.py <render.mp4> --out videos/<brand>/<job>/final.mp4 [--edl <job>/recording/edl.json]

1. normalizes the audio to -14 LUFS integrated with true peak ≤ -1 dBTP (two-pass loudnorm; video copied)
   — renders used to land between -14 and -17 LUFS and some went above 0 dBTP (clipping)
2. measures again and prints I / TP / LRA
3. <out without .mp4>.contact.jpg — one frame every ~duration/24 s, to see the whole video at once
4. with --edl (recorded style): transcribes the output and lists words that the music/effects covered

Uses ffmpeg from PATH (prefers ffmpeg.exe when present, e.g. on WSL), run from inside remotion/.
"""
import argparse, difflib, json, os, re, shutil, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REMOTION = os.path.join(ROOT, "remotion")
sys.path.insert(0, os.path.dirname(__file__))


def rel(p):
    return os.path.relpath(os.path.abspath(p), REMOTION)


def ff(args, binary="ffmpeg"):
    exe = shutil.which(binary + ".exe") or shutil.which(binary)
    r = subprocess.run([exe, "-hide_banner", *args], cwd=REMOTION, capture_output=True)
    txt = r.stdout.decode(errors="replace") + r.stderr.decode(errors="replace")
    if r.returncode:
        sys.exit(f"{binary} failed:\n{txt[-2000:]}")
    return txt


def measure(video, lufs, tp):
    txt = ff(["-nostats", "-i", rel(video), "-vn", "-af", f"loudnorm=I={lufs}:TP={tp}:LRA=11:print_format=json", "-f", "null", "-"])
    return json.loads(txt[txt.rindex("{"): txt.rindex("}") + 1])


def duration(video):
    txt = ff(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", rel(video)], "ffprobe")
    return float(txt.strip().splitlines()[-1])


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("render")
    ap.add_argument("--out", required=True)
    ap.add_argument("--lufs", type=float, default=-14.0)
    ap.add_argument("--tp", type=float, default=-1.5)  # target with headroom: the final encode raises the peak ~0.3 dB
    ap.add_argument("--edl", help="the job's recording/edl.json (recorded style): checks every word is still audible")
    a = ap.parse_args()

    m = measure(a.render, a.lufs, a.tp)
    print(f"before: {float(m['input_i']):6.1f} LUFS · peak {float(m['input_tp']):5.1f} dBTP")
    filt = (f"loudnorm=I={a.lufs}:TP={a.tp}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
            f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    ff(["-v", "error", "-y", "-i", rel(a.render), "-map", "0:v", "-map", "0:a", "-c:v", "copy", "-af", filt + ",aresample=48000",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", rel(a.out)])
    d = measure(a.out, a.lufs, a.tp)
    ok = abs(float(d["input_i"]) - a.lufs) <= 1.0 and float(d["input_tp"]) <= a.tp + 0.3
    if not ok and float(d["input_tp"]) > a.tp + 0.3:
        # raw recording (quiet voice, consonant peaks): linear loudnorm can't raise the full gain without clipping →
        # limiter after it, with headroom for the true (inter-sample) peak the AAC encode creates
        lim = 10 ** ((a.tp - 0.8) / 20)
        ff(["-v", "error", "-y", "-i", rel(a.render), "-map", "0:v", "-map", "0:a", "-c:v", "copy",
            "-af", f"{filt},alimiter=limit={lim:.4f}:attack=1:release=60:level=false,aresample=48000",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", rel(a.out)])
        d = measure(a.out, a.lufs, a.tp)
        ok = abs(float(d["input_i"]) - a.lufs) <= 1.0 and float(d["input_tp"]) <= a.tp + 0.3
        print("        (2nd pass with limiter)")
    print(f"after:  {float(d['input_i']):6.1f} LUFS · peak {float(d['input_tp']):5.1f} dBTP · LRA {float(d['input_lra']):.1f}  {'ok' if ok else 'CHECK'}")

    dur = duration(a.out)
    sheet = os.path.splitext(a.out)[0] + ".contact.jpg"
    ff(["-v", "error", "-y", "-i", rel(a.out), "-vf", f"fps=24/{dur:.3f},scale=270:-1,tile=8x3", "-frames:v", "1", rel(sheet)])
    print(f"sheet:  {sheet}  ({dur:.1f} s)")

    if a.edl:
        from recording import audio_for_upload, transcribe_audio
        edl = json.load(open(a.edl, encoding="utf-8"))
        mp3 = os.path.splitext(a.out)[0] + ".check.mp3"
        audio_for_upload(a.out, mp3)
        folder = os.path.dirname(a.edl)  # recording/ or recording/fast/ (sped-up version): the transcript is in recording/source/
        trans = next(c for c in (os.path.join(folder, "source", "transcript.json"), os.path.join(folder, "..", "source", "transcript.json")) if os.path.exists(c))
        language = json.load(open(trans, encoding="utf-8")).get("language_code") or "por"
        heard = transcribe_audio(mp3, os.path.splitext(a.out)[0] + ".check.json", language)
        os.remove(mp3)
        clean = lambda s: re.sub(r"[^\w]", "", s.lower())
        expected, got = [clean(w["text"]) for w in edl["words"]], [clean(w["text"]) for w in heard]
        missing = [(i1, i2) for tag, i1, i2, _, _ in difflib.SequenceMatcher(None, expected, got, autojunk=False).get_opcodes() if tag in ("delete", "replace")]
        if not missing:
            print("speech: ok, every word is audible in the final")
        for i1, i2 in missing:
            print(f"speech: not heard «{' '.join(expected[i1:i2])}» near {edl['words'][i1]['start']:.2f} s — music/effect too loud there?")
