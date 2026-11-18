"""Narrated 16:9 lesson in the elegant brand style (team training, narrated presentation).

    python3 scripts/lesson.py voice <job>                 # narration per chapter (ElevenLabs) + word alignment
    python3 scripts/lesson.py estimate <job>              # estimated alignment (build before the voice)
    python3 scripts/lesson.py build <job>                 # timeline.json + media → remotion/out/pub-<slug>/<slug>/
    python3 scripts/lesson.py bundle <job>                # build + remotion bundle
    python3 scripts/lesson.py frames <job> 12 40 95       # stills at the given seconds → <job>/analysis/frames/
    python3 scripts/lesson.py render <job>                # bundle + render + check.py → <job>/final.mp4

The job needs script.json (chapters → scenes; each scene has a "text" with {name} markers before the word where an
element comes in, and the visual fields with "at": "name"; types in remotion/src/lesson/), photos in <job>/web/<name>.jpg
and the music in <job>/music/. Each chapter becomes one mp3 (voice/ch-NN-<id>.mp3) — Remotion plays them one after
the other with CHAPTER_PAUSE of breathing room; the timeline already carries absolute times.
script.json → "voice": {"id", "model", "stability", "pronunciation"} (id falls back to $ELEVENLABS_VOICE_ID);
"brand": "<brand>" copies brands/<brand>/assets/logo.svg.
"""
import json, os, re, shutil, subprocess, sys, unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
REM = os.path.join(ROOT, "remotion")
sys.path.insert(0, os.path.join(ROOT, "scripts"))
CHAPTER_PAUSE = 1.1   # breathing room between chapters (s)
START = 0.6           # silence before the first line
END_MARGIN = 3.2
CHAPTER_BREATH = 1.6  # extra silence after each chapter title
MARKER = re.compile(r"\{(\w+)\}")


def _job(p):
    p = os.path.abspath(p)
    if not os.path.isfile(os.path.join(p, "script.json")):
        sys.exit(f"{p}: missing script.json")
    return p, os.path.basename(p.rstrip("/"))


def _norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))


def _tokens(text):
    """[(word, [markers])] — the {x} marker sticks to the next word."""
    out, pend = [], []
    for t in text.split():
        ms = MARKER.findall(t)
        clean = MARKER.sub("", t)
        pend += ms
        if clean:
            out.append((clean, pend)); pend = []
    return out


def _chapter_text(ch):
    return " ".join(" ".join(w for w, _ in _tokens(c["text"])) for c in ch["scenes"])


def _file(job, i, ch, ext):
    return os.path.join(job, "voice", f"ch-{i:02d}-{ch['id']}.{ext}")


def voice(job):
    import voice as V
    r = json.load(open(os.path.join(job, "script.json")))
    cfg = r["voice"]
    voice_id = cfg.get("id") or os.environ.get("ELEVENLABS_VOICE_ID")
    if not voice_id:
        sys.exit("set script.json → voice.id or ELEVENLABS_VOICE_ID")
    pron = dict(p.split("=", 1) for p in cfg.get("pronunciation", "").split(",") if "=" in p)
    for i, ch in enumerate(r["chapters"]):
        mp3 = _file(job, i, ch, "mp3")
        if os.path.isfile(mp3) and os.path.isfile(mp3 + ".alignment.json"):
            print(f"ok {os.path.basename(mp3)} (already exists)"); continue
        text = _chapter_text(ch)
        spoken = text
        for a, b in pron.items():
            spoken = re.sub(rf"\b{re.escape(a)}\b", b, spoken)
        dur = V.tts(voice_id, spoken, mp3, cfg.get("model", "eleven_v3"), cfg.get("stability", 0.5))
        w = V.align(mp3, text, mp3 + ".alignment.json")
        print(f"ok {os.path.basename(mp3)} ~{dur:.1f}s, {len(w)} words ({len(text)} characters)")


def estimate(job):
    r = json.load(open(os.path.join(job, "script.json")))
    os.makedirs(os.path.join(job, "voice"), exist_ok=True)
    for i, ch in enumerate(r["chapters"]):
        ws, s = [], 0.2
        for x in _chapter_text(ch).split():
            d = 0.05 * len(x) + 0.08
            ws.append({"text": x, "start": round(s, 3), "end": round(s + d, 3)})
            s += d + (0.4 if x.endswith(".") else 0.2 if x[-1] in ",:;?" else 0.03)
        json.dump({"words": ws, "estimated": True}, open(_file(job, i, ch, "mp3") + ".alignment.json", "w"), ensure_ascii=False)
    print("estimated alignment written (no audio)")


def _duration(mp3, words):
    if os.path.isfile(mp3):
        exe = shutil.which("ffprobe.exe") or shutil.which("ffprobe") or "ffprobe"
        p = subprocess.run([exe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.basename(mp3)],
                           cwd=os.path.dirname(mp3), capture_output=True, text=True)
        if p.returncode == 0 and p.stdout.strip():
            return float(p.stdout.strip())
    return words[-1]["end"] + 0.4


def _match(tokens, al):
    """Index of the aligned word for each script token (tolerates tokenization differences)."""
    idx, j = [], 0
    for w, _ in tokens:
        n = _norm(w)
        found = None
        for k in range(j, min(j + 6, len(al))):
            if _norm(al[k]["text"]) == n or (n and _norm(al[k]["text"]).startswith(n[:4])):
                found = k; break
        if found is None:
            found = min(j, len(al) - 1)
        idx.append(found); j = found + 1
    return idx


def build(job, slug):
    r = json.load(open(os.path.join(job, "script.json")))
    pub = os.path.join(REM, "out", f"pub-{slug}", slug)
    os.makedirs(pub, exist_ok=True)
    t0, audios, words, scenes = START, [], [], []
    for i, ch in enumerate(r["chapters"]):
        mp3 = _file(job, i, ch, "mp3")
        al = [w for w in json.load(open(mp3 + ".alignment.json"))["words"] if w["text"].strip()]
        dur = _duration(mp3, al)
        # breathing room after the chapter card: the mp3 plays in two pieces, with CHAPTER_BREATH of silence between
        cut = None
        if ch["scenes"][0]["type"] == "chapter" and len(ch["scenes"]) > 1:
            n0 = len(_tokens(ch["scenes"][0]["text"]))
            cut = (al[n0 - 1]["end"] + al[n0]["start"]) / 2
        sh = lambda t: t0 + t + (CHAPTER_BREATH if cut is not None and t >= cut else 0)
        if os.path.isfile(mp3):
            shutil.copy(mp3, os.path.join(pub, os.path.basename(mp3)))
            if cut is None:
                audios.append({"file": os.path.basename(mp3), "at": round(t0, 3)})
            else:
                audios.append({"file": os.path.basename(mp3), "at": round(t0, 3), "to": round(cut, 3)})
                audios.append({"file": os.path.basename(mp3), "at": round(t0 + cut + CHAPTER_BREATH, 3), "from": round(cut, 3)})
        k = 0
        for c in ch["scenes"]:
            tk = _tokens(c["text"])
            ix = [k + x for x in _match(tk, al[k:])]
            marks = {}
            for (w, ms), x in zip(tk, ix):
                for mm in ms:
                    marks[mm] = round(sh(al[x]["start"]), 3)
            scene = {kk: v for kk, v in c.items() if kk != "text"}
            scene.update({"start": round(sh(al[ix[0]]["start"]), 3), "speechEnd": round(sh(al[ix[-1]]["end"]), 3), "marks": marks, "chapter": ch["id"]})
            scenes.append(scene)
            for x in ix:
                words.append({"text": al[x]["text"], "start": round(sh(al[x]["start"]), 3), "end": round(sh(al[x]["end"]), 3)})
            k = ix[-1] + 1
        t0 += dur + CHAPTER_PAUSE + (CHAPTER_BREATH if cut is not None else 0)
    total = words[-1]["end"] + END_MARGIN
    # each scene runs from its own start (−0.45 s) to the start of the next
    for a, b in zip(scenes, scenes[1:] + [None]):
        a["from"] = round(max(0, a["start"] - 0.45), 3)
        a["to"] = round((b["start"] - 0.45) if b else total, 3)
    scenes[0]["from"] = 0
    tl = {"duration": round(total, 3), "audios": audios, "music": dict(r["music"]) if r.get("music") else None, "words": words, "scenes": scenes,
          "title": r.get("title", "")}
    json.dump(tl, open(os.path.join(pub, "timeline.json"), "w"), ensure_ascii=False)
    web = os.path.join(job, "web")
    for f in os.listdir(web):
        shutil.copy(os.path.join(web, f), pub)
    logo = os.path.join(ROOT, "brands", r.get("brand", ""), "assets", "logo.svg")
    if r.get("brand") and os.path.isfile(logo):
        shutil.copy(logo, pub)
    else:
        print('! no logo: set "brand" in script.json (copies brands/<brand>/assets/logo.svg)')
    tr = (r.get("music") or {}).get("file")
    if tr and os.path.isfile(os.path.join(job, "music", tr)):
        shutil.copy(os.path.join(job, "music", tr), pub)
        tl["music"]["duration"] = _duration(os.path.join(job, "music", tr), [{"end": 300}])
        json.dump(tl, open(os.path.join(pub, "timeline.json"), "w"), ensure_ascii=False)
    elif tr:
        print(f"! music {tr} is not in {job}/music/")
    json.dump({"slug": slug}, open(os.path.join(REM, "out", f"pub-{slug}", "props.json"), "w"))
    print(f"timeline: {len(scenes)} scenes, {len(words)} words, {total/60:.1f} min → remotion/out/pub-{slug}/{slug}/")
    return tl


def _npx(args, check_file=None):
    for attempt in range(3):
        p = subprocess.run(["npx", "remotion", *args], cwd=REM, capture_output=True, text=True)
        ok = p.returncode == 0 and (not check_file or (os.path.isfile(check_file) and os.path.getsize(check_file) > 0))
        if ok:
            return
        print(f"  attempt {attempt + 1} failed: {(p.stderr or p.stdout).strip().splitlines()[-3:]}")
    sys.exit("remotion failed 3 times: " + " ".join(args))


def bundle(slug):
    _npx(["bundle", f"--public-dir=out/pub-{slug}", f"--out-dir=out/bundle-{slug}"], os.path.join(REM, "out", f"bundle-{slug}", "bundle.js"))


def frames(job, slug, seconds):
    build(job, slug); bundle(slug)
    folder = os.path.join(job, "analysis", "frames")
    os.makedirs(folder, exist_ok=True)
    for s in seconds:
        out = os.path.join(folder, f"{float(s):06.1f}s.png")
        if os.path.exists(out):
            os.remove(out)
        _npx(["still", f"out/bundle-{slug}", "Lesson", os.path.relpath(out, REM), f"--frame={round(float(s) * 30)}",
              f"--props=out/pub-{slug}/props.json", "--timeout=120000"], out)
    print(f"frames in {os.path.relpath(folder, ROOT)}")


def render(job, slug):
    build(job, slug); bundle(slug)
    raw = os.path.join(job, "render.mp4")
    if os.path.exists(raw):
        os.remove(raw)
    _npx(["render", f"out/bundle-{slug}", "Lesson", os.path.relpath(raw, REM), f"--props=out/pub-{slug}/props.json",
          "--timeout=120000", "--concurrency=6"], raw)
    final = os.path.join(job, "final.mp4")
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "check.py"), os.path.relpath(raw, REM), "--out", os.path.relpath(final, REM)], cwd=REM, check=True)
    print(f"final: {final}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    job, slug = _job(sys.argv[2])
    if cmd == "voice": voice(job)
    elif cmd == "estimate": estimate(job)
    elif cmd == "build": build(job, slug)
    elif cmd == "bundle": build(job, slug); bundle(slug)
    elif cmd == "frames": frames(job, slug, sys.argv[3:])
    elif cmd == "render": render(job, slug)
    else: sys.exit(__doc__)
