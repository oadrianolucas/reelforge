#!/usr/bin/env python3
"""Batch production of UGC with the creator speaking (Seedance 1.5 Pro with audio): one clip per take, same face.

usage:
  python3 scripts/batch.py estimate --batch videos/<brand>/<job>                  cost of every video (approved ones summed)
  python3 scripts/batch.py clips    --batch videos/<brand>/<job> --video v03 [--confirm] [--take t2]
  python3 scripts/batch.py join     --batch videos/<brand>/<job> --video v03      takes → <video>/raw.mp4

A batch is a job with several videos (skill ugc-at-scale). <batch>/batch.json:
  {"brand": "<brand>", "model": "bytedance/seedance-1-5-pro", "usd_per_s": 0.052, "max_usd_per_video": 0.8,
   "language": "Brazilian Portuguese",
   "persona": {"image": "brands/<brand>/assets/persona.png", "description": "...", "setting": "...",
               "voice": "warm young female voice, Brazilian Portuguese, natural conversational pace"},
   "videos": [{"id": "v01", "title": "...", "approved": true,
               "takes": [{"id": "t1", "line": "sentence in the narration language", "action": "0–2s ...; 2–4s ...",
                          "frame": "optional.png", "duration": 5}]}]}
Each take becomes <batch>/<video>/scenes/<take>.mp4 from the frame (default: the persona image), with the scene
prompt template + the line in quotes for the model to say with the mouth. Without --confirm it only prints prompt and
cost (never generates video without approval). Each paid call goes into <batch>/costs.json; job.md keeps the total.
After joining: scripts/recording.py transcribe <video>/raw.mp4 --job <batch>/<video> → cut → edit.json.
"""
import argparse, datetime as dt, json, math, os, subprocess, sys

sys.path.insert(0, os.path.dirname(__file__))
from recording import ff, rel, ROOT  # noqa: E402

WORDS_PER_S = 2.6  # natural UGC speech; the take gets ~1 s of breathing room


def load(batch):
    return json.load(open(os.path.join(batch, "batch.json"), encoding="utf-8"))


def duration(t):
    if t.get("duration"):
        return int(t["duration"])
    return max(4, min(12, math.ceil(len(t["line"].split()) / WORDS_PER_S + 1)))


def prompt(cfg, t):
    p = cfg["persona"]
    lang = cfg.get("language", "Brazilian Portuguese")
    return " ".join([
        "Ultra-realistic vertical 9:16 smartphone video, shot on iPhone 15 front camera, selfie UGC talking to camera.",
        p["description"].rstrip(".") + ".",
        "Setting: " + p["setting"].rstrip(".") + ".",
        "Medium close-up, 24 mm, eye level, slight handheld sway, subject centered with headroom, safe for square crop.",
        "Action: " + t.get("action", "she talks naturally to the camera with small hand gestures and genuine expressions").rstrip(".") + ".",
        f'She says in {lang}, lips perfectly synced: "{t["line"]}"',
        "Voice: " + p.get("voice", f"natural {lang} voice") + ". No background music, room tone only.",
        "Natural skin texture with pores, subtle film grain, slight motion blur, realistic reflections.",
        "No text, no logos, no subtitles, no extra fingers.",
    ])


def video_of(cfg, vid):
    v = next((v for v in cfg["videos"] if v["id"] == vid), None)
    if not v:
        sys.exit(f"video {vid} is not in batch.json")
    return v


def estimate(a):
    cfg = load(a.batch)
    total = 0
    for v in cfg["videos"]:
        s = sum(duration(t) for t in v["takes"])
        c = s * cfg["usd_per_s"]
        total += c if v.get("approved") else 0
        warn = "  ! above the cap" if c > cfg["max_usd_per_video"] else ""
        print(f"{v['id']} {'[approved]' if v.get('approved') else '[idea]'} {len(v['takes'])} takes · {s} s · ~US$ {c:.2f}{warn}  {v.get('title', '')}")
    print(f"approved: ~US$ {total:.2f} (estimate at US$ {cfg['usd_per_s']}/s; the real cost goes to costs.json)")


def clips(a):
    cfg = load(a.batch)
    v = video_of(cfg, a.video)
    takes = [t for t in v["takes"] if not a.take or t["id"] == a.take]
    folder = os.path.join(a.batch, v["id"], "scenes")
    cost = sum(duration(t) for t in takes) * cfg["usd_per_s"]
    print(f"{v['id']}: {len(takes)} takes · ~US$ {cost:.2f} (cap {cfg['max_usd_per_video']})")
    if cost > cfg["max_usd_per_video"] and not a.take:
        sys.exit("above the per-video cap: cut takes or raise max_usd_per_video in batch.json (with the user's ok)")
    for t in takes:
        frame = os.path.join(ROOT, t.get("frame") or cfg["persona"]["image"])
        out = os.path.join(folder, t["id"] + ".mp4")
        print(f"\n[{t['id']}] {duration(t)} s · frame {os.path.relpath(frame, ROOT)}\n{prompt(cfg, t)}")
        if not a.confirm:
            continue
        if os.path.exists(out):
            print("  already exists, skipped (delete it to redo)")
            continue
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "video_openrouter.py"), "--model", cfg["model"],
                            "--image", frame, "--prompt", prompt(cfg, t), "--duration", str(duration(t)), "--audio",
                            "--out", out], capture_output=True, text=True)
        print(r.stdout.strip()[-400:] or r.stderr.strip()[-400:])
        if r.returncode:
            sys.exit("stopped: " + r.stderr.strip()[-300:])
        res = json.loads(r.stdout.strip().splitlines()[-1])
        log = os.path.join(a.batch, "costs.json")
        costs = json.load(open(log)) if os.path.exists(log) else []
        costs.append({"date": dt.date.today().isoformat(), "video": v["id"], "take": t["id"], "model": cfg["model"],
                      "seconds": duration(t), "usd": res.get("cost_usd")})
        json.dump(costs, open(log, "w"), ensure_ascii=False, indent=1)
    if not a.confirm:
        print("\n(dry run: nothing was generated — run with --confirm after the user's ok)")


def join(a):
    cfg = load(a.batch)
    v = video_of(cfg, a.video)
    folder = os.path.join(a.batch, v["id"])
    files = [os.path.join(folder, "scenes", t["id"] + ".mp4") for t in v["takes"]]
    missing = [os.path.basename(f) for f in files if not os.path.exists(f)]
    if missing:
        sys.exit("missing takes: " + ", ".join(missing))
    # same resolution/fps/audio on all of them before the concat (Seedance returns the frame's aspect ratio)
    inputs, filt = [], ""
    for k, f in enumerate(files):
        inputs += ["-i", rel(f)]
        filt += (f"[{k}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[v{k}];"
                 f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo[a{k}];")
    filt += "".join(f"[v{k}][a{k}]" for k in range(len(files))) + f"concat=n={len(files)}:v=1:a=1[v][a]"
    out = os.path.join(folder, "raw.mp4")
    ff(["-y", "-v", "error", *inputs, "-filter_complex", filt, "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", rel(out)])
    print(f"→ {os.path.relpath(out, ROOT)}\nnow: python3 scripts/recording.py transcribe {os.path.relpath(out, ROOT)} "
          f"--job {os.path.relpath(folder, ROOT)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("estimate", "clips", "join"):
        s = sub.add_parser(name)
        s.add_argument("--batch", required=True)
        if name != "estimate":
            s.add_argument("--video", required=True)
        if name == "clips":
            s.add_argument("--take")
            s.add_argument("--confirm", action="store_true", help="really generate (paid)")
    a = ap.parse_args()
    a.batch = os.path.abspath(a.batch)
    {"estimate": estimate, "clips": clips, "join": join}[a.cmd](a)


if __name__ == "__main__":
    main()
