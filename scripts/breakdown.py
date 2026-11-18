#!/usr/bin/env python3
"""Breaks videos down with Gemini (OpenRouter, video input): hook, format, takes, pacing, script and why it works.

usage: python3 scripts/breakdown.py references/outliers/<brand>/<YYYY-MM-DD> [--brand <brand>] [--model google/gemini-3.8-flash]
       python3 scripts/breakdown.py video1.mp4 video2.mp4 ...

Each video becomes <video>.breakdown.json next to it (already exists → skipped). The video is sent compressed (360 px,
mono audio) to fit the request and cost little (~US$ 0.01 per 30 s video on Flash). With --brand, Gemini also suggests
how to adapt the structure to the brand (reads the Essence and Audience sections of brands/<brand>/brand.md).
At the end writes breakdowns.md in the folder: one row per video (hook, format, takes, pacing) + total cost —
the input for Claude to write patterns.md and the batch of scripts (skill ugc-at-scale).
"""
import argparse, base64, glob, json, os, re, sys, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(__file__))
from analyze_reference import ff, rel, env, ROOT  # noqa: E402

PROMPT = """You are a UGC/ad creative strategist for TikTok and Reels. Watch the whole video (image AND audio)
and return ONLY a JSON, in English (quote speech and on-screen text literally, in the original language), with these fields:
{
 "hook": {"speech": "sentence spoken in the first 3 seconds (literal)", "on_screen_text": "text written on screen at the start",
          "visual": "what is seen in the 1st second", "type": "question|number|counterintuitive|result-first|POV|controversy|demonstration|other",
          "why_it_hooks": "1 sentence"},
 "format": "Pain → solution|POV|I tried this app|Quick tutorial|Before / after|3 reasons|Storytime|Reaction|other",
 "who_speaks": "creator on camera|voice-over|no speech|on-screen text",
 "takes": [{"start": 0.0, "end": 2.1, "framing": "selfie close|medium|app screen|product b-roll|...",
            "action": "what happens", "speech": "literal", "on_screen_text": "literal or empty"}],
 "pacing": {"duration_s": 0, "takes": 0, "avg_take_s": 0, "words_per_s": 0, "music": "yes/no + mood", "captions": "caption style"},
 "script": "full speech, literal, in the original language",
 "cta": "what it asks for at the end and how",
 "why_it_works": ["3 to 5 concrete reasons (structure, emotion, proof, curiosity)"],
 "weaknesses": ["what could be improved"],
 "template": "the structure in 1 reusable line, with blanks: e.g. '[pain with a number] → [discovery] → [proof on screen] → [CTA]'"%s
}
Times in seconds. Be literal in the speech; don't invent what isn't in the video."""

ADAPT = """,
 "adaptation": "how to use this template for the brand below, in 2–3 sentences, with an example hook\""""


def compress(video):
    tmp = os.path.splitext(video)[0] + ".gemini.mp4"
    if not os.path.exists(tmp):
        ff(["-y", "-v", "error", "-i", rel(video), "-vf", "scale=-2:360", "-r", "15", "-c:v", "libx264", "-crf", "32",
            "-preset", "veryfast", "-c:a", "aac", "-ac", "1", "-b:a", "48k", rel(tmp)])
    if not os.path.exists(tmp):
        sys.exit(f"ffmpeg did not produce {tmp}")
    return tmp


def brand_summary(brand):
    txt = open(os.path.join(ROOT, "brands", brand, "brand.md"), encoding="utf-8").read()
    parts = re.split(r"\n## ", txt)
    return "\n## ".join(p for p in parts if p.startswith(("Essence", "Audience"))) or txt[:3000]


def breakdown(video, model, brand_txt):
    dest = os.path.splitext(video)[0] + ".breakdown.json"
    if os.path.exists(dest):
        return json.load(open(dest)), 0
    small = compress(video)
    uri = "data:video/mp4;base64," + base64.b64encode(open(small, "rb").read()).decode()
    prompt = PROMPT % (ADAPT if brand_txt else "")
    if brand_txt:
        prompt += "\n\nBrand:\n" + brand_txt
    body = {"model": model, "response_format": {"type": "json_object"}, "usage": {"include": True},
            "messages": [{"role": "user", "content": [{"type": "text", "text": prompt},
                                                      {"type": "video_url", "video_url": {"url": uri}}]}]}
    r = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + env("OPENROUTER_API_KEY"), "Content-Type": "application/json", "User-Agent": "reelforge/1.0"})
    try:
        d = json.load(urllib.request.urlopen(r, timeout=300))
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read()[:400].decode(errors='replace')}")
        return None, 0
    txt = d["choices"][0]["message"]["content"]
    txt = txt[txt.find("{"): txt.rfind("}") + 1]
    try:
        j = json.loads(txt)
    except json.JSONDecodeError:
        print("  response is not JSON:", txt[:300])
        return None, 0
    j["_model"], j["_cost_usd"] = model, (d.get("usage") or {}).get("cost") or 0
    json.dump(j, open(dest, "w"), ensure_ascii=False, indent=1)
    os.remove(small)
    return j, j["_cost_usd"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("targets", nargs="+", help="outliers folder(s) or .mp4 videos")
    ap.add_argument("--brand")
    ap.add_argument("--model", default="google/gemini-3.8-flash")
    o = ap.parse_args()

    videos = []
    for a in o.targets:
        videos += sorted(f for f in glob.glob(os.path.join(a, "*.mp4")) if not f.endswith(".gemini.mp4")) if os.path.isdir(a) else [a]
    brand_txt = brand_summary(o.brand) if o.brand else ""
    meta = {}
    for a in o.targets:  # metrics from outliers.py, if the folder came from it
        f = os.path.join(a, "outliers.json")
        if os.path.isdir(a) and os.path.exists(f):
            meta.update({v["file"]: v for v in json.load(open(f)) if v.get("file")})

    total, lines = 0, []
    for k, v in enumerate(videos, 1):
        print(f"[{k}/{len(videos)}] {os.path.relpath(v, ROOT)}", flush=True)
        j, c = breakdown(v, o.model, brand_txt)
        total += c
        if not j:
            continue
        h, p, m = j.get("hook", {}), j.get("pacing", {}), meta.get(os.path.basename(v), {})
        views = f"{m['views']:,}" if m else "—"
        lines.append(f"| {os.path.basename(v)} | {views} | {m.get('factor', '—')} | {h.get('type', '')} | "
                     f"{(h.get('speech') or h.get('on_screen_text') or '').replace('|', '/')[:90]} | {j.get('format', '')} | "
                     f"{j.get('who_speaks', '')} | {p.get('takes', '')} / {p.get('avg_take_s', '')} s | {(j.get('template') or '').replace('|', '/')} |")
    folders = {os.path.dirname(os.path.abspath(v)) for v in videos}
    if len(folders) == 1 and lines:
        head = ["# Breakdowns", "", f"Model {o.model} · {len(lines)} videos · cost US$ {total:.3f}", "",
                "| Video | Views | Factor | Hook | Hook speech/text | Format | Who speaks | Takes / avg | Template |",
                "|---|---|---|---|---|---|---|---|---|"]
        open(os.path.join(folders.pop(), "breakdowns.md"), "w", encoding="utf-8").write("\n".join(head + lines) + "\n")
    print(f"Gemini cost: US$ {total:.3f}")


if __name__ == "__main__":
    main()
