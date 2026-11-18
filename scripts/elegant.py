""""Elegant brand" style (skill elegant-brand): publishes a job's material and renders the formats.

    python3 scripts/elegant.py words <job>                       # index:word@s of the narration (for script.json)
    python3 scripts/elegant.py estimate <job>                    # ESTIMATED alignment from voice/text.txt (build before the voice)
    python3 scripts/elegant.py publish <job>                     # copies what's needed to remotion/out/pub-<slug>/<slug>/
    python3 scripts/elegant.py frames <job> 9:16 2.5 17 30 ...   # stills at the given seconds → <job>/analysis/frames-<fmt>/
    python3 scripts/elegant.py render <job> 9:16,4:5             # bundle + render + check.py → final.mp4 / final-4x5.mp4 / final-1x1.mp4

The job needs: script.json (schema in remotion/src/elegant/), voice/narration.mp3 +
voice/narration.alignment.json (scripts/voice.py), media/ (photos, clips, logo.svg). The music (script.json → music.file)
is looked up in <job>/music/ and in library/music/. The slug is the job folder name.
Generic compositions: ElegantJob (9:16), ElegantJob4x5 (1080x1350), ElegantJob1x1 — props {"slug": ...}.
Remotion through Windows node (WSL) sometimes fails for no reason ("Could not determine Node.js install directory"):
each step is tried up to 3 times.
"""
import json, os, shutil, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
REM = os.path.join(ROOT, "remotion")
IDS = {"9:16": ("ElegantJob", "final.mp4"), "4:5": ("ElegantJob4x5", "final-4x5.mp4"), "1:1": ("ElegantJob1x1", "final-1x1.mp4")}


def _job(p):
    p = os.path.abspath(p)
    if not os.path.isfile(os.path.join(p, "script.json")) and not os.path.isfile(os.path.join(p, "voice", "text.txt")):
        sys.exit(f"{p}: missing script.json (or voice/text.txt to estimate)")
    return p, os.path.basename(p.rstrip("/"))


def _words(job):
    a = os.path.join(job, "voice", "narration.alignment.json")
    if not os.path.isfile(a):
        a = os.path.join(job, "voice", "alignment.estimated.json")
    return [w for w in json.load(open(a))["words"] if w["text"].strip()]


def words(job):
    w = _words(job)
    print(" ".join(f"{i}:{x['text']}@{x['start']:.1f}" for i, x in enumerate(w)))
    print(f"\n{len(w)} words · speech ends at {w[-1]['end']:.2f} s · video ≈ {w[-1]['end'] + 2.6:.1f} s")


def estimate(job):
    t = open(os.path.join(job, "voice", "text.txt")).read().split()
    ws, s = [], 0.3
    for x in t:
        d = 0.055 * len(x) + 0.09
        ws.append({"text": x, "start": round(s, 3), "end": round(s + d, 3)})
        s += d + (0.45 if x.endswith(".") else 0.3 if x.endswith(":") else 0.2 if x.endswith(",") else 0.03)
    json.dump({"words": ws, "estimated": True}, open(os.path.join(job, "voice", "alignment.estimated.json"), "w"), ensure_ascii=False)
    print(f"estimated: {len(ws)} words, ~{s:.1f} s (the real voice usually comes out ~20% faster)")


def publish(job, slug):
    r = json.load(open(os.path.join(job, "script.json")))
    dests = [os.path.join(REM, "out", f"pub-{slug}", slug)]
    for d in dests:
        os.makedirs(d, exist_ok=True)
        shutil.copy(os.path.join(job, "script.json"), d)
        media = os.path.join(job, "media")
        for f in os.listdir(media) if os.path.isdir(media) else []:
            shutil.copy(os.path.join(media, f), d)
        voice = os.path.join(job, "voice")
        if os.path.isfile(os.path.join(voice, "narration.mp3")):
            shutil.copy(os.path.join(voice, "narration.mp3"), os.path.join(d, r.get("narration", "narration.mp3")))
            shutil.copy(os.path.join(voice, "narration.alignment.json"), os.path.join(d, r.get("alignment", "alignment.json")))
        else:
            print("! no voice/narration.mp3 — using the estimated alignment and NO voice audio")
            shutil.copy(os.path.join(voice, "alignment.estimated.json"), os.path.join(d, r.get("alignment", "alignment.json")))
        tr = (r.get("music") or {}).get("file")
        if tr:
            found = [p for p in (os.path.join(job, "music", tr), os.path.join(ROOT, "library", "music", tr)) if os.path.isfile(p)]
            if not found:
                sys.exit(f"music {tr} not found in {job}/music/ nor in library/music/")
            shutil.copy(found[0], os.path.join(d, tr))
        logo = (r.get("theme") or {}).get("logo", "logo.svg")
        if not os.path.isfile(os.path.join(d, logo)):
            print(f"! {logo} is not in {job}/media/ (copy it from brands/<brand>/assets/)")
    json.dump({"slug": slug}, open(os.path.join(REM, "out", f"pub-{slug}", "props.json"), "w"))
    print(f"published at remotion/out/pub-{slug}/{slug}/")


def _npx(args, check_file=None):
    for attempt in range(3):
        p = subprocess.run(["npx", "remotion", *args], cwd=REM, capture_output=True, text=True)
        ok = p.returncode == 0
        if check_file:
            ok = ok and os.path.isfile(check_file) and os.path.getsize(check_file) > 0
        if ok:
            return
        print(f"  attempt {attempt + 1} failed: {(p.stderr or p.stdout).strip().splitlines()[-1:]}")
    sys.exit("remotion failed 3 times: " + " ".join(args))


def bundle(slug):
    _npx(["bundle", f"--public-dir=out/pub-{slug}", f"--out-dir=out/bundle-{slug}"], check_file=os.path.join(REM, "out", f"bundle-{slug}", "bundle.js"))


def frames(job, slug, fmt, seconds):
    publish(job, slug)
    bundle(slug)
    cid = IDS[fmt][0]
    folder = os.path.join(job, "analysis", f"frames-{fmt.replace(':', 'x')}")
    os.makedirs(folder, exist_ok=True)
    for s in seconds:
        out = os.path.join(folder, f"{float(s):05.1f}s.png")
        if os.path.exists(out):
            os.remove(out)
        _npx(["still", f"out/bundle-{slug}", cid, os.path.relpath(out, REM), f"--frame={round(float(s) * 30)}",
              f"--props=out/pub-{slug}/props.json", "--timeout=120000"], check_file=out)
    print(f"frames in {os.path.relpath(folder, ROOT)}")


def render(job, slug, formats):
    publish(job, slug)
    bundle(slug)
    for fmt in formats:
        cid, final = IDS[fmt]
        raw = os.path.join(job, f"render-{fmt.replace(':', 'x')}.mp4")
        if os.path.exists(raw):
            os.remove(raw)
        print(f"render {fmt} ({cid})…")
        _npx(["render", f"out/bundle-{slug}", cid, os.path.relpath(raw, REM), f"--props=out/pub-{slug}/props.json",
              "--timeout=120000", "--concurrency=6"], check_file=raw)
        subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "check.py"), os.path.relpath(raw, REM),
                        "--out", os.path.relpath(os.path.join(job, final), REM)], cwd=REM, check=True)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, (job, slug) = sys.argv[1], _job(sys.argv[2])
    if cmd == "words":
        words(job)
    elif cmd == "estimate":
        estimate(job)
    elif cmd == "publish":
        publish(job, slug)
    elif cmd == "frames":
        frames(job, slug, sys.argv[3], sys.argv[4:])
    elif cmd == "render":
        render(job, slug, (sys.argv[3] if len(sys.argv) > 3 else "9:16,4:5").split(","))
    else:
        sys.exit(__doc__)
