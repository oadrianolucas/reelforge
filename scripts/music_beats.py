#!/usr/bin/env python3
"""Detects the beats (onsets) of a music track so the video pulses and the impacts land on time.

usage: python3 scripts/music_beats.py videos/<brand>/<job>/music/track.mp3 [--start 0] [--duration 40]

Writes `<music>.beats.json` with {"onsets": [s, ...], "interval": s, "energy_per_s": [...]}.
In Remotion: the beat-pulse helper in src/motion returns 1 right after each beat and decays — use it on scale/glow.
"""
import argparse, json, math, os, struct, subprocess, wave

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REMOTION = os.path.join(ROOT, "remotion")

if __name__ == "__main__":
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("music")
    a.add_argument("--start", type=float, default=0)
    a.add_argument("--duration", type=float, default=40)
    o = a.parse_args()
    wav = os.path.splitext(o.music)[0] + ".tmp.wav"
    rel = lambda p: os.path.relpath(os.path.abspath(p), REMOTION)
    subprocess.run(["npx", "remotion", "ffmpeg", "-y", "-v", "error", "-ss", str(o.start), "-t", str(o.duration), "-i", rel(o.music),
                    "-ac", "1", "-ar", "8000", "-f", "wav", rel(wav)], cwd=REMOTION, check=True)
    w = wave.open(wav)
    n = w.getnframes()
    data = struct.unpack("<%dh" % n, w.readframes(n))
    w.close()
    os.remove(wav)
    hop = 200  # 25 ms at 8 kHz
    env = [math.sqrt(sum(x * x for x in data[i:i + hop]) / hop) for i in range(0, n - hop, hop)]
    mx = max(env) or 1
    on = []
    for i in range(8, len(env)):
        local = sum(env[i - 8:i]) / 8
        if env[i] > local * 1.6 and env[i] > 0.35 * mx and (not on or i * 0.025 - on[-1] > 0.25):
            on.append(round(i * 0.025, 2))
    d = sorted(b - x for x, b in zip(on, on[1:]) if 0.3 < b - x < 1.5)
    res = {"onsets": on, "interval": d[len(d) // 2] if d else None,
           "energy_per_s": [int(100 * max(env[int(s / 0.025):int((s + 1) / 0.025)] or [0]) / mx) for s in range(int(o.duration))]}
    out = os.path.splitext(o.music)[0] + ".beats.json"
    json.dump(res, open(out, "w"), indent=1)
    print(f"{len(on)} beats, interval ~{res['interval']} s → {out}")
