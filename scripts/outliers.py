#!/usr/bin/env python3
"""Niche outliers: scrapes TikTok and Instagram through Apify, finds the videos that blew up beyond the profile size and
downloads the best ones to break down.

usage: python3 scripts/outliers.py --brand <brand> [--per-term 60] [--top 50] [--days 120] [--no-download]

Search terms in brands/<brand>/outliers.json:
  {"tiktok": {"hashtags": [...], "searches": [...]}, "instagram": {"hashtags": [...], "searches": [...]},
   "min_views": 20000, "max_duration": 90, "language": "Brazilian Portuguese"}
Apify actors (paid per result, ~US$ 2 per 1000; the real cost is printed at the end):
  clockworks/tiktok-scraper           hashtags + searchQueries
  apify/instagram-hashtag-scraper     reels by hashtag (or keywordSearch for phrases)

Outlier factor = how far the video went beyond normal:
  TikTok    views / author followers (min. 1000) — went viral beyond its own audience
  Instagram views / median views of the batch (the hashtag actor doesn't return followers)
Score = factor × log10(views): a high factor with 3k views is worthless; 5 million on a giant profile too.
Relevance (Gemini Flash-Lite reading the captions, ~US$ 0.001): seller hashtags bring a lot of product showcase
("outfit X, buy at the link") — only videos of a person talking about the business (routine, first sale, behind the
scenes, tip, venting) make the top, which is the format the persona copies. --no-filter turns it off.
The audience comes from the "**For whom**" line of brands/<brand>/brand.md; "language" (default English) is the
language the videos must be in.

Output: references/outliers/<brand>/<YYYY-MM-DD>/  (third-party material: references/ stays out of git)
  outliers.json   every filtered video, with metrics and score
  outliers.md     ranking of the --top, with links
  <nn>-<platform>-<author>.mp4  the downloaded --top (Instagram via the direct URL, which expires; TikTok in a 2nd run of
                                the actor with postURLs + shouldDownloadVideos — yt-dlp is blocked by TikTok)
--reuse redoes filter/top/download from today's outliers.json, without paying for the scraping again.
Videos that showed up in previous runs are dropped. Then: scripts/breakdown.py on the folder.
Reads APIFY_TOKEN and OPENROUTER_API_KEY from .env.
"""
import argparse, datetime as dt, glob, json, math, os, re, statistics, sys, time, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
API = "https://api.apify.com/v2"
NOW = dt.datetime.now(dt.timezone.utc)


def env(name):
    if os.environ.get(name):
        return os.environ[name]
    for line in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
        if line.startswith(name + "="):
            v = line.split("=", 1)[1].strip()
            if v:
                return v
    sys.exit(f"{name} not found in .env (create the account at apify.com → Settings → API & Integrations)")


def req(method, url, body=None):
    h = {"Authorization": "Bearer " + env("APIFY_TOKEN"), "User-Agent": "reelforge/1.0"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h, method=method), timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} at {url.split('?')[0]}: {e.read()[:600].decode(errors='replace')}")


def run_actor(actor, payload):
    """Starts the actor, waits for it to finish and returns (items, cost in US$)."""
    run = req("POST", f"{API}/acts/{actor.replace('/', '~')}/runs", payload)["data"]
    print(f"  {actor}: run {run['id']}", flush=True)
    t0 = time.time()
    while run["status"] in ("READY", "RUNNING"):
        time.sleep(10)
        run = req("GET", f"{API}/actor-runs/{run['id']}")["data"]
        print(f"    {run['status']} ({int(time.time() - t0)} s)", flush=True)
        if time.time() - t0 > 30 * 60:
            sys.exit("took more than 30 min")
    if run["status"] != "SUCCEEDED":
        sys.exit(f"{actor} finished {run['status']}: see https://console.apify.com/actors/runs/{run['id']}")
    items = req("GET", f"{API}/datasets/{run['defaultDatasetId']}/items?clean=true&format=json")
    return items, run.get("usageTotalUsd") or 0


def parse_date(s):
    try:
        return dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None


def tiktok(cfg, n):
    if not (cfg.get("hashtags") or cfg.get("searches")):
        return [], 0
    items, cost = run_actor("clockworks/tiktok-scraper", {
        "hashtags": cfg.get("hashtags", []), "searchQueries": cfg.get("searches", []), "resultsPerPage": n,
        "shouldDownloadVideos": False, "shouldDownloadCovers": False, "shouldDownloadSubtitles": False})
    out = []
    for i in items:
        a = i.get("authorMeta") or {}
        out.append({
            "platform": "tiktok", "url": i.get("webVideoUrl"), "author": a.get("name") or a.get("nickName"),
            "followers": a.get("fans"), "views": i.get("playCount") or 0, "likes": i.get("diggCount") or 0,
            "comments": i.get("commentCount") or 0, "shares": i.get("shareCount") or 0,
            "duration": (i.get("videoMeta") or {}).get("duration"), "date": i.get("createTimeISO"),
            "caption": i.get("text") or "", "video_url": None})
    return out, cost


def instagram(cfg, n):
    out, cost = [], 0
    for keyword, terms in ((False, cfg.get("hashtags", [])), (True, cfg.get("searches", []))):
        if not terms:
            continue
        items, c = run_actor("apify/instagram-hashtag-scraper", {
            "hashtags": terms, "resultsType": "reels", "resultsLimit": n, "keywordSearch": keyword})
        cost += c
        for i in items:
            if i.get("type") not in (None, "Video") and not i.get("videoUrl"):
                continue
            out.append({
                "platform": "instagram", "url": i.get("url"), "author": i.get("ownerUsername"), "followers": None,
                "views": i.get("videoPlayCount") or i.get("videoViewCount") or 0, "likes": max(i.get("likesCount") or 0, 0),
                "comments": i.get("commentsCount") or 0, "shares": 0, "duration": i.get("videoDuration"),
                "date": i.get("timestamp"), "caption": i.get("caption") or "", "video_url": i.get("videoUrl")})
    return out, cost


def already_seen(brand, today):
    seen = set()
    for f in glob.glob(os.path.join(ROOT, "references", "outliers", brand, "*", "outliers.json")):
        if os.path.basename(os.path.dirname(f)) != today:
            seen |= {v["url"] for v in json.load(open(f))}
    return seen


def score(videos, days, min_views, max_dur):
    unique = {}
    for v in videos:
        d = parse_date(v["date"])
        if not v["url"] or v["views"] < min_views or (v["duration"] and v["duration"] > max_dur):
            continue
        if d and (NOW - d).days > days:
            continue
        unique[v["url"]] = v
    videos = list(unique.values())
    for plat in ("tiktok", "instagram"):
        batch = [v for v in videos if v["platform"] == plat]
        if not batch:
            continue
        median = statistics.median(v["views"] for v in batch) or 1
        for v in batch:
            base = max(v["followers"], 1000) if v["followers"] else median
            v["factor"] = round(v["views"] / base, 2)
            v["engagement"] = round((v["likes"] + v["comments"] + v["shares"]) / max(v["views"], 1), 4)
            v["score"] = round(v["factor"] * math.log10(max(v["views"], 10)), 2)
    return sorted(videos, key=lambda v: -v["score"])


CLASSES = {"creator": "a person (business owner or creator) talking about/showing their own business: routine, behind the scenes, "
           "packing orders, first sale, venting, achievement, advice, 'build with me'",
           "tip": "educational content for people in this niche: tip, tutorial, common mistake, strategy, tool",
           "showcase": "ad/showcase of a product for the end consumer (clothes, outfit, price, 'buy at the link', haul unboxing)",
           "off": "a language other than {language}, another topic, event, institutional"}


def classify(videos, brand, language):
    """A single call with every caption → class of each video (Gemini Flash-Lite, cents)."""
    audience = ""
    m = os.path.join(ROOT, "brands", brand, "brand.md")
    if os.path.exists(m):
        audience = next((l for l in open(m, encoding="utf-8") if "**For whom**" in l), "")
    flat = lambda t: re.sub(r"\s+", " ", t)[:300]
    items = "\n".join(f"{k}. @{v['author']} ({v['platform']}, {v['duration'] or '?'} s): {flat(v['caption'])}"
                      for k, v in enumerate(videos))
    prompt = ("Classify each video by its caption into ONE class:\n" +
              "\n".join(f"- {c}: {d.format(language=language)}" for c, d in CLASSES.items()) +
              f"\nContext: we are looking for video formats a creator persona could imitate for the audience {audience.strip()}\n"
              'Answer only JSON: {"classes": ["creator", "showcase", ...]} in the same order and with the same number of items.\n\n' + items)
    body = {"model": "google/gemini-3.5-flash-lite", "response_format": {"type": "json_object"}, "usage": {"include": True},
            "messages": [{"role": "user", "content": prompt}]}
    r = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + env("OPENROUTER_API_KEY"), "Content-Type": "application/json", "User-Agent": "reelforge/1.0"})
    d = json.load(urllib.request.urlopen(r, timeout=180))
    txt = d["choices"][0]["message"]["content"]
    classes = json.loads(txt[txt.find("{"): txt.rfind("}") + 1]).get("classes", [])
    if len(classes) != len(videos):
        print(f"  classifier returned {len(classes)} of {len(videos)}: no filter")
        return 0
    for v, c in zip(videos, classes):
        v["class"] = c
    return (d.get("usage") or {}).get("cost") or 0


def download_url(url, dest, token=False):
    h = {"User-Agent": "Mozilla/5.0"}
    if token:
        h["Authorization"] = "Bearer " + env("APIFY_TOKEN")
    try:
        data = urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=180).read()
    except Exception as e:
        print(f"    failed ({e})")
        return False
    if len(data) < 20000:  # error page, not a video
        return False
    open(dest, "wb").write(data)
    return True


def download_tiktoks(vs, folder):
    """2nd run of the actor with only the chosen videos, with the download add-on (the file goes to the key-value store)."""
    if not vs:
        return 0
    items, cost = run_actor("clockworks/tiktok-scraper", {"postURLs": [v["url"] for v in vs], "shouldDownloadVideos": True,
                                                         "shouldDownloadCovers": False, "resultsPerPage": 1})
    by_id = {}
    for i in items:
        links = [u for u in (i.get("mediaUrls") or []) if u]
        if not links and (i.get("videoMeta") or {}).get("downloadAddr"):
            links = [i["videoMeta"]["downloadAddr"]]
        by_id[str(i.get("id"))] = links
    for v in vs:
        vid = v["url"].rstrip("/").split("/")[-1]
        for u in by_id.get(vid, []):
            if download_url(u, os.path.join(folder, v["_name"]), token="api.apify.com" in u):
                v["file"] = v["_name"]
                break
        else:
            print("    no file for", v["url"], "— item fields:", json.dumps(by_id.get(vid))[:200])
    return cost


def human(n):
    return f"{n / 1e6:.1f}M" if n >= 1e6 else f"{n / 1e3:.0f}k" if n >= 1e3 else str(n)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--brand", required=True)
    ap.add_argument("--per-term", type=int, default=60, help="results per hashtag/search in each actor")
    ap.add_argument("--top", type=int, default=50)
    ap.add_argument("--days", type=int, default=120, help="only videos posted in the last N days")
    ap.add_argument("--no-download", action="store_true")
    ap.add_argument("--no-filter", action="store_true", help="don't remove product showcases/other languages from the top")
    ap.add_argument("--reuse", action="store_true", help="use today's outliers.json (don't scrape again)")
    o = ap.parse_args()

    cfg = json.load(open(os.path.join(ROOT, "brands", o.brand, "outliers.json"), encoding="utf-8"))
    today = NOW.strftime("%Y-%m-%d")
    folder = os.path.join(ROOT, "references", "outliers", o.brand, today)
    os.makedirs(folder, exist_ok=True)

    if o.reuse:
        videos, c1, c2 = json.load(open(os.path.join(folder, "outliers.json"))), 0, 0
    else:
        tt, c1 = tiktok(cfg.get("tiktok", {}), o.per_term)
        ig, c2 = instagram(cfg.get("instagram", {}), o.per_term)
        print(f"raw: {len(tt)} TikTok + {len(ig)} Instagram · Apify cost US$ {c1 + c2:.3f}")
        seen = already_seen(o.brand, today)
        videos = [v for v in score(tt + ig, o.days, cfg.get("min_views", 20000), cfg.get("max_duration", 90)) if v["url"] not in seen]
        json.dump(videos, open(os.path.join(folder, "outliers.json"), "w"), ensure_ascii=False, indent=1)

    c3 = 0
    if not o.no_filter:
        c3 = classify(videos, o.brand, cfg.get("language", "English"))
        count = {c: sum(1 for v in videos if v.get("class") == c) for c in CLASSES}
        print("classes:", count, f"(US$ {c3:.4f})")
    top = [v for v in videos if o.no_filter or v.get("class", "creator") in ("creator", "tip")][:o.top]
    lines = [f"# Outliers — {o.brand} — {today}", "",
             f"{len(videos)} videos after the filters (≥ {cfg.get('min_views', 20000)} views, ≤ {cfg.get('max_duration', 90)} s, "
             f"last {o.days} days, no repeats from previous runs). Apify cost: US$ {c1 + c2:.3f}.", "",
             "| # | Platform | Author | Views | Factor | Engag. | Dur. | Class | Caption | File |", "|---|---|---|---|---|---|---|---|---|---|"]
    for v in videos:
        v.pop("file", None)
    for k, v in enumerate(top, 1):
        v["_name"] = f"{k:02d}-{v['platform']}-{re.sub(r'[^a-z0-9]+', '-', (v['author'] or 'anon').lower())[:24]}.mp4"
        if os.path.exists(os.path.join(folder, v["_name"])):
            v["file"] = v["_name"]
    c4 = 0
    if not o.no_download:
        for k, v in enumerate(top, 1):
            if v["platform"] == "instagram" and not v.get("file") and v["video_url"]:
                print(f"  downloading {k}/{len(top)} {v['url']}", flush=True)
                if download_url(v["video_url"], os.path.join(folder, v["_name"])):
                    v["file"] = v["_name"]
        c4 = download_tiktoks([v for v in top if v["platform"] == "tiktok" and not v.get("file")], folder)
    for k, v in enumerate(top, 1):
        cap = re.sub(r"\s+", " ", v["caption"])[:70].replace("|", "/")
        lines.append(f"| {k} | {v['platform']} | [{v['author']}]({v['url']}) | {human(v['views'])} | {v['factor']}× | "
                     f"{v['engagement'] * 100:.1f}% | {round(v['duration']) if v['duration'] else '?'} s | {v.get('class', '')} | "
                     f"{cap} | {v.get('file') or '—'} |")
        v.pop("_name", None)
    lines[2] = lines[2].replace("Apify cost:", f"Cost: classification US$ {c3:.4f} + TikTok download US$ {c4:.3f} + Apify:")
    json.dump(videos, open(os.path.join(folder, "outliers.json"), "w"), ensure_ascii=False, indent=1)
    open(os.path.join(folder, "outliers.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    downloaded = sum(1 for v in top if v.get("file"))
    print(f"cost of this run: US$ {c1 + c2 + c3 + c4:.3f}")
    print(f"{len(videos)} outliers · {downloaded} downloaded → {os.path.relpath(folder, ROOT)}/outliers.md")


if __name__ == "__main__":
    main()
