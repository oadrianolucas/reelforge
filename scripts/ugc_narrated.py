"""Builds and publishes videos of the UgcNarrated template (3rd-person scenes + narration + app screens) from
"at which WORD of the narration each thing comes in".

In a job, write <job>/build.py like this:

    import sys; sys.path.insert(0, "scripts")
    from ugc_narrated import *
    j = Job("videos/<brand>/<job>", music="<library-track-id>")
    j.build("v01", "<persona-id>", [
        (0, P("tired-at-desk")),
        (4, M(number={"from": 0, "to": 7, "suffix": " in 10"}, text="abandon the cart", icon="cart")),
        (36, T("sales-stats", "close-hands-phone", event={"text": "Order #1043 paid", "atW": 55})),
        (69, P("kitchen-coffee")),
    ], overlays=[], highlights=["ten", "coupon"], card=("Your WhatsApp recovers", "the cart by itself."))
    j.publish()

and run from the repo root: python3 <job>/build.py

Each segment runs from the start of that word to the next one; the last one runs until the CTA word (`cta_word`,
default "tap" — the narration must end with e.g. "Tap Learn more"), where the end card comes in.
Indices = the ones in <vNN>/voice/narration.alignment.json (printed by voice.py). Keys ending in "W" in the screen
props are word indices → become seconds since the screen came in. Screen ids = PHONE_SCREENS in remotion/src/components/screens/index.ts (add your own app screens there).
Shots: "shot" of the default persona or
"persona:shot". Opening: <vNN>/media/hook.json (scripts/omni_speech.py writes one with the on-camera line).

Material of each video expected in <job>/<vNN>/:
  voice/narration.mp3 · voice/narration.alignment.json · media/logo.svg · media/favicon.svg · [media/hook.json, speech.*]
Publishing copies only what is needed to remotion/out/pub-<job slug>/ (the whole public/ is too heavy) and prints the
bundle and render commands (generic compositions UgcNarratedJob / UgcNarratedJob1x1 with --props).
"""
import glob, json, os, re, shutil, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PERSONAS = {os.path.basename(os.path.dirname(f)): {p["id"]: p for p in json.load(open(f))["shots"]}
            for f in glob.glob(f"{ROOT}/library/personas/*/shots.json")}
SUB_CTA = "Tap Learn more"


def P(shot, **k): return ("p", shot, k)
def T(screen, background, **props): return ("t", screen, background, props)
def M(**m): return ("m", m)
def MSG(side, text, atW, **k): return {"side": side, "text": text, "atW": atW, **k}
def EV(badge, color, icon, time, text, atW): return {"badge": badge, "color": color, "icon": icon, "time": time, "text": text, "atW": atW}


def _convert(obj, w, base):
    if isinstance(obj, list):
        return [_convert(x, w, base) for x in obj]
    if not isinstance(obj, dict):
        return obj
    out = {}
    for k, v in obj.items():
        if k.endswith("W") and isinstance(v, int):
            out[k[:-1]] = round(w[v]["start"] - base, 2)
        elif k.endswith("W") and isinstance(v, list) and v and all(isinstance(x, int) for x in v):
            out[k[:-1]] = [round(w[x]["start"] - base, 2) for x in v]
        else:
            out[k] = _convert(v, w, base)
    return out


def _shot(persona, name):
    pe, sid = name.split(":") if ":" in name else (persona, name)
    if pe not in PERSONAS or sid not in PERSONAS[pe]:
        sys.exit(f"shot '{name}' doesn't exist in the library (personas: {', '.join(sorted(PERSONAS))})")
    return pe, PERSONAS[pe][sid]


class Job:
    def __init__(self, folder, music, sub_cta=SUB_CTA, cta_word="tap", cta="Learn more"):
        self.folder = os.path.join(ROOT, folder) if not os.path.isabs(folder) else folder
        self.slug = re.sub(r"[^a-z0-9]+", "-", os.path.relpath(self.folder, os.path.join(ROOT, "videos")).lower()).strip("-")
        self.music, self.sub_cta, self.cta_word, self.cta = music, sub_cta, cta_word.lower(), cta
        self.videos, self.personas = [], set()

    def build(self, v, persona, segs, overlays=(), highlights=(), card=("", ""), store=None):
        base = os.path.join(self.folder, v)
        wa = [x for x in json.load(open(f"{base}/voice/narration.alignment.json"))["words"] if x["text"].strip()]
        try:
            cta = next(i for i, x in enumerate(wa) if x["text"].lower().startswith(self.cta_word))
        except StopIteration:
            sys.exit(f"{v}: the narration must end with the CTA starting with '{self.cta_word}' (that's where the card comes in)")
        ini = lambda i: 0.0 if i == 0 else round(wa[i]["start"] - 0.05, 2)
        marks = [s[0] for s in segs] + [cta]
        scenes, warnings, used = [], [], {persona}
        for (i, el), end_i in zip(segs, marks[1:]):
            f, t = ini(i), ini(end_i)
            if t <= f:
                sys.exit(f"{v}: segment at word {i} ends before it starts (indices out of order?)")
            if el[0] == "p":
                pe, p = _shot(persona, el[1])
                used.add(pe)
                c = {"shot": el[1], "from": f, "to": t, **el[2]}
                clean = p["end"] - max(el[2].get("start", 0), p["start"])
                if clean / (t - f) < 0.6:
                    warnings.append(f"{el[1]}: {t - f:.1f} s of scene with {clean:.1f} s of clean footage (slow motion {clean / (t - f):.2f}×) — split or swap it")
            elif el[0] == "t":
                pe, _ = _shot(persona, el[2])
                used.add(pe)
                c = {"screen": el[1], "background": el[2], "from": f, "to": t, "props": _convert(el[3], wa, f)}
            else:
                c = {"motion": el[1], "from": f, "to": t}
            scenes.append(c)
        ovs = []
        for o in overlays:
            o = dict(o)
            a, b = o.pop("fromW"), o.pop("toW")
            o.update({"from": ini(a), "to": ini(b)})
            if "items" in o:
                o["items"] = [{"name": nm, "text": tx, "at": round(wa[e]["start"], 2)} for nm, tx, e in o["items"]]
            ovs.append(o)
        r = {"persona": persona, "narration": "narration.mp3", "alignment": "narration.alignment.json", "music": self.music,
             "scenes": scenes, "overlays": ovs, "highlights": list(highlights),
             "card": {"from": ini(cta), "title": card[0], "highlight": card[1], "subtitle": self.sub_cta, "cta": self.cta},
             "duration": round(wa[-1]["end"] + 2.0, 2)}
        g = f"{base}/media/hook.json"
        if os.path.exists(g):
            cont = json.load(open(g)).get("continuation")
            if cont:
                r["opening"] = {"file": None, "start": 0, "dur": 0,
                                "continuation": {k: cont[k] for k in ("file", "dur", "captions")}}
        if store:
            r["store"] = store
        json.dump(r, open(f"{base}/media/script.json", "w"), ensure_ascii=False, indent=1)
        total = r["duration"] + (r.get("opening", {}).get("continuation", {}).get("dur", 0))
        print(f"{v}: {len(scenes)} scenes ({sum(1 for c in scenes if 'motion' in c)} motion) · {total:.1f} s total")
        for w in warnings:
            print("  !", w)
        self.videos.append(v)
        self.personas |= used

    def publish(self):
        pub = os.path.join(ROOT, "remotion/out", "pub-" + self.slug)

        def copy(o, d):
            os.makedirs(os.path.dirname(d), exist_ok=True)
            if not os.path.exists(d) or os.path.getmtime(d) < os.path.getmtime(o) or os.path.getsize(d) != os.path.getsize(o):
                shutil.copy2(o, d)

        for v in self.videos:
            base = os.path.join(self.folder, v)
            files = ["media/script.json", "media/favicon.svg", "media/logo.svg", "voice/narration.mp3", "voice/narration.alignment.json"]
            if os.path.exists(f"{base}/media/speech.mp4"):
                files += ["media/speech.mp4", "media/speech.transcript.json"]
            for f in files:
                if not os.path.exists(os.path.join(base, f)):
                    sys.exit(f"{v}: missing {f}")
                copy(os.path.join(base, f), os.path.join(pub, f"{self.slug}-{v}", os.path.basename(f)))
        for pe in self.personas:
            clips = os.path.join(ROOT, "library/personas", pe, "scenes/clips")
            copy(os.path.join(ROOT, "library/personas", pe, "shots.json"), os.path.join(pub, "library/personas", pe, "shots.json"))
            for f in os.listdir(clips):
                if f.endswith(".mp4"):
                    copy(os.path.join(clips, f), os.path.join(pub, "library/personas", pe, "scenes/clips", f))
        copy(os.path.join(ROOT, f"library/music/{self.music}.mp3"), os.path.join(pub, f"library/music/{self.music}.mp3"))
        for f in os.listdir(os.path.join(ROOT, "library/sfx")):
            copy(os.path.join(ROOT, "library/sfx", f), os.path.join(pub, "library/sfx", f))
        rj = os.path.relpath(self.folder, ROOT)
        print(f"\npublished at remotion/out/pub-{self.slug}. To render (from inside remotion/):")
        print(f"  npx remotion bundle --public-dir=out/pub-{self.slug} --out-dir=out/bundle-{self.slug}")
        for v in self.videos:
            s = f"{self.slug}-{v}"
            print(f"  npx remotion render out/bundle-{self.slug} UgcNarratedJob ../{rj}/{v}/render.mp4 --props='{{\"slug\":\"{s}\",\"format\":\"9:16\"}}'")
            print(f"  npx remotion render out/bundle-{self.slug} UgcNarratedJob1x1 ../{rj}/{v}/render-1x1.mp4 --props='{{\"slug\":\"{s}\",\"format\":\"1:1\"}}'")
