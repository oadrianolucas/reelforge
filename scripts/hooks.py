#!/usr/bin/env python3
"""Visual opening hooks: Gemini watches each hook and, for each video, picks the hook and writes the bridge line.

usage:
  python3 scripts/hooks.py analyze                                                  # describes each hook in library/hooks/hooks.json (cached)
  python3 scripts/hooks.py bridges --batch videos/<brand>/<batch> v02 v03 ... [--language "Brazilian Portuguese"]

analyze  → hooks.json gains "description" (what happens, emotion, moment of impact, business metaphors)
bridges  → <batch>/<vNN>/media/hook.json = {"hook": id, "bridge": "line", "why": "..."}
           Reads the current narration (<vNN>/voice/narration-tags.txt). The bridge is the 1st line of the narration,
           said AFTER the hook (the hook plays alone, with its own sound, and fades out): it ties the hook scene to the
           video's pain, ≤ 12 words, direct/humorous tone. Each hook at most 3 times in the batch.
Model: google/gemini-3.8-flash (video and text, OpenRouter). Cost: cents.
"""
import argparse, base64, json, os, sys, urllib.error, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from analyze_reference import ROOT, env  # noqa: E402
from breakdown import compress  # noqa: E402

MODEL = "google/gemini-3.8-flash"
CATALOG = os.path.join(ROOT, "library", "hooks", "hooks.json")


def gemini(content):
    body = {"model": MODEL, "response_format": {"type": "json_object"}, "usage": {"include": True},
            "messages": [{"role": "user", "content": content}]}
    r = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + env("OPENROUTER_API_KEY"), "Content-Type": "application/json", "User-Agent": "reelforge/1.0"})
    try:
        d = json.load(urllib.request.urlopen(r, timeout=300))
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read()[:400].decode(errors='replace')}")
    txt = d["choices"][0]["message"]["content"]
    return json.loads(txt[txt.find("{"): txt.rfind("}") + 1]), (d.get("usage") or {}).get("cost") or 0


def analyze(_):
    cat = json.load(open(CATALOG))
    total = 0
    for h in cat["hooks"]:
        if h.get("description"):
            continue
        video = os.path.join(ROOT, "library", "hooks", h["file"])
        uri = "data:video/mp4;base64," + base64.b64encode(open(compress(video), "rb").read()).decode()
        prompt = (f"Watch the clip (use only the part from {h['start']} s to {h['end']} s). Answer ONLY JSON in English: "
                  '{"action": "what happens, literal, 1 sentence", "emotion": "what the viewer feels", '
                  '"impact_s": exact second of the impact, "metaphors": ["3 to 5 ways to use this as a metaphor for a '
                  'business problem (lost sale, customer disappearing, late order, refund, messy customer support...)"]}')
        j, c = gemini([{"type": "text", "text": prompt}, {"type": "video_url", "video_url": {"url": uri}}])
        h["description"] = j
        total += c
        print(f"{h['id']}: {j.get('action')}")
        os.remove(os.path.splitext(video)[0] + ".gemini.mp4")
    json.dump(cat, open(CATALOG, "w"), ensure_ascii=False, indent=1)
    print(f"cost: US$ {total:.4f}")


def bridges(a):
    cat = json.load(open(CATALOG))
    hooks = [{"id": h["id"], "action": h["description"]["action"], "metaphors": h["description"]["metaphors"]} for h in cat["hooks"] if h.get("description")]
    videos = {}
    for v in a.videos:
        txt = open(os.path.join(a.batch, v, "voice", "narration-tags.txt"), encoding="utf-8").read().strip()
        videos[v] = txt
    prompt = ("You are a TikTok/Reels ad copywriter for small business owners. Each video below will OPEN with a visual "
              "hook (an impact clip of ~2 s, no narration, with its own sound) and then fade into the video, whose narration "
              "starts with a BRIDGE LINE written by you followed by the current narration. The bridge ties what happened in the "
              "hook to the video's pain: short (up to 12 words), spoken, direct, with humor or provocation, in colloquial "
              f"{a.language}. Don't repeat the 1st sentence of the current narration; set it up. Pick for each video the hook "
              "that fits best (each hook at most 3 times; vary). Answer ONLY JSON: {\"videos\": {\"vNN\": {\"hook\": \"id\", "
              "\"bridge\": \"line\", \"why\": \"1 sentence\"}}}.\n\nHOOKS:\n" + json.dumps(hooks, ensure_ascii=False) +
              "\n\nVIDEOS (current narration, with emotion tags):\n" + json.dumps(videos, ensure_ascii=False))
    j, c = gemini([{"type": "text", "text": prompt}])
    for v, d in j.get("videos", {}).items():
        if v in videos:
            json.dump(d, open(os.path.join(a.batch, v, "media", "hook.json"), "w"), ensure_ascii=False, indent=1)
            print(f"{v} [{d['hook']}] {d['bridge']}")
    print(f"cost: US$ {c:.4f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("analyze")
    p = sub.add_parser("bridges")
    p.add_argument("--batch", required=True)
    p.add_argument("--language", default="Brazilian Portuguese", help="language of the bridge line")
    p.add_argument("videos", nargs="+")
    a = ap.parse_args()
    {"analyze": analyze, "bridges": bridges}[a.cmd](a)
