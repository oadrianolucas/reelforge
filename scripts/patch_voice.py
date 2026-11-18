#!/usr/bin/env python3
"""Replaces ONE sentence of the narration without regenerating the approved take: generates only the new sentence and
computes the splice.

usage:
  python3 scripts/patch_voice.py --narration videos/<brand>/<job>/voice/narration.mp3 --from 68 --to 78 \
      --voice <voice_id> --text "[excited] It's fifty dollars per video..." --name price

--from / --to: word indices (the `i:word@time` list printed by voice.py). Replaces words [from, to) — `to` is the
first word that STAYS. Writes into videos/<brand>/<job>/voice/:
  phrase-<name>.mp3 (+ .alignment.json)
  narration.patched.alignment.json   final alignment (old + new words, times already shifted)
  narration.patched.json             {"segments": [{file, from, to, at}], "delta", "speech_end"} — Remotion plays the
                                     segments in sequence (the patched-narration component)
Can be chained: run again over the patched narration (--base narration.patched) to replace another sentence.
The voice id comes from --voice or the ELEVENLABS_VOICE_ID env var.
"""
import argparse, json, os, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def words(p):
    return [w for w in json.load(open(p))["words"] if w["text"].strip()]


if __name__ == "__main__":
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--narration", required=True, help="mp3 of the original narration")
    a.add_argument("--base", default=None, help="prefix of a previous patch (e.g. .../narration.patched) to chain")
    a.add_argument("--from", dest="start", type=int, required=True, help="index of the first word replaced")
    a.add_argument("--to", dest="end", type=int, required=True, help="index of the first word that stays")
    a.add_argument("--voice", default=os.environ.get("ELEVENLABS_VOICE_ID"), help="voice_id (default: $ELEVENLABS_VOICE_ID)")
    a.add_argument("--text", required=True)
    a.add_argument("--name", default="new")
    o = a.parse_args()
    if not o.voice:
        sys.exit("pass --voice or set ELEVENLABS_VOICE_ID")
    folder = os.path.dirname(o.narration)
    base_al = (o.base + ".alignment.json") if o.base else os.path.splitext(o.narration)[0] + ".alignment.json"
    segments = json.load(open(o.base + ".json"))["segments"] if o.base else None
    ws = words(base_al)
    cut_a = ws[o.start]["start"] - 0.05
    cut_b = ws[o.end]["start"] - 0.08 if o.end < len(ws) else ws[-1]["end"] + 0.2

    phrase = os.path.join(folder, f"phrase-{o.name}.mp3")
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "voice.py"), "--voice", o.voice, "--text", o.text, "--out", phrase], check=True)
    new = words(os.path.splitext(phrase)[0] + ".alignment.json")
    n0 = max(0.0, new[0]["start"] - 0.06)
    n1 = new[-1]["end"] + 0.15
    delta = (n1 - n0) - (cut_b - cut_a)

    # audio segments: [0, cut_a) of the base + phrase + [cut_b, end) of the base
    if segments is None:
        segments = [{"file": os.path.basename(o.narration), "from": 0.0, "to": None, "at": 0.0}]

    def slice_(ts, ini, end):
        """parts of the base timeline between ini and end (end None = until the end), keeping their source."""
        out = []
        for t in ts:
            dur = (t["to"] - t["from"]) if t["to"] is not None else 1e9
            t0, t1 = t["at"], t["at"] + dur
            a_, b_ = max(t0, ini), min(t1, end if end is not None else 1e9)
            if b_ > a_:
                out.append({"file": t["file"], "from": t["from"] + (a_ - t0), "to": None if (t["to"] is None and b_ >= 1e8) else t["from"] + (b_ - t0), "at": a_})
        return out

    before = slice_(segments, 0.0, cut_a)
    after = [dict(x, at=x["at"] + delta) for x in slice_(segments, cut_b, None)]
    new_segments = before + [{"file": os.path.basename(phrase), "from": n0, "to": n1, "at": cut_a}] + after
    new_words = [w for w in ws[: o.start]] + [{"text": w["text"], "start": cut_a + w["start"] - n0, "end": cut_a + w["end"] - n0} for w in new] + \
                [{"text": w["text"], "start": w["start"] + delta, "end": w["end"] + delta} for w in ws[o.end:]]
    out = os.path.join(folder, "narration.patched")
    json.dump({"words": new_words}, open(out + ".alignment.json", "w"), ensure_ascii=False, indent=1)
    json.dump({"segments": new_segments, "delta": round(delta, 3), "speech_end": round(new_words[-1]["end"], 3)}, open(out + ".json", "w"), indent=1)
    print(f"patch: words {o.start}–{o.end - 1} replaced; Δ {delta:+.2f} s; speech ends at {new_words[-1]['end']:.2f} s")
    print(" ".join(f"{i}:{w['text']}@{w['start']:.1f}" for i, w in enumerate(new_words)))
