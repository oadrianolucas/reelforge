#!/usr/bin/env python3
"""Topic radar: finds the repositories that are blowing up and builds the day's topic list with the facts already checked.

usage: python3 scripts/radar.py --brand <brand> [--days 30] [--min-stars 500] [--top 10]

Sources (free — uses the logged-in `gh`; without it, the API directly with GITHUB_TOKEN):
  1. GitHub Search API: repos created in the last --days with more than --min-stars (up to 300)
  2. Hacker News (Algolia API): posts with a GitHub link and 100+ points in the last 7 days
  3. own history (brands/<brand>/radar/history.json): stars per repo at each run → how much it grew
For the ~40 best: forks, watchers, contributors, owner commits, release downloads, license.

Score = speed (stars/day since creation) × topic bonus (AI, agent, video, "alternative to…") ×
HN bonus; repos that look like bought stars (very few forks/watchers for their size) get ! and drop.
Repos that already became a video (link in videos/<brand>/*/job.md) and adult/piracy content are left out.

Cron/agent use: --dir <dir> --summary prints a compact summary on stdout for an agent to turn into a message.
Output: brands/<brand>/radar/YYYY-MM-DD.md — ranking + a fact sheet per repo (facts with source and date, ready for
research.md) + a hook suggestion. Then: pick one and run the hook-script skill.
"""
import argparse, datetime as dt, glob, json, math, os, re, shutil, subprocess, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
NOW = dt.datetime.now(dt.timezone.utc)

TOPIC = {  # word in the description/topics → bonus (audience: regular people, not devs — see brand.md → For whom)
    r"\b(ai|llm|gpt|claude|openai|gemini|deepseek|qwen|kimi|agent|agents|agentic|copilot)\b": 1.5,
    r"\b(video|editor|capcut|premiere|image|photo|voice|tts|speech|whisper)\b": 1.4,
    # things regular people already use or pay for: the video becomes "the free one instead of what you use"
    r"\b(word|excel|office|powerpoint|photoshop|lightroom|illustrator|canva|pdf|whatsapp|instagram|youtube|tiktok|"
    r"spotify|netflix|finance|money|budget|bank|phone|iphone|android|music|game|health|translat\w*|study|resume)\b": 1.5,
    r"\b(alternative|replacement|clone|reimplementation|free|open[- ]source|self[- ]hosted|local|offline)\b": 1.3,
    r"\b(automation|workflow|no[- ]code)\b": 1.15,
    # dev-only: drops a little — what explodes still makes it, to become a "translated" topic (~1 in 3–4)
    r"\b(cli|terminal|sdk|framework|library|compiler|kubernetes|docker|database|orm|lsp|api|mcp|rag|devops|backend)\b": 0.85,
}


# off-topic for a personal brand: adult content, piracy, cheating
BLOCK = re.compile(r"nsfw|porn|hentai|onlyfans|\bnude|\bsex|crack(ed)?\b|keygen|warez|piracy|cheat|aimbot|bypass", re.I)
BOTS = {"claude", "copilot", "dependabot", "github-actions", "renovate", "devin-ai-integration", "codex"}


def gh(path, include=False, **params):
    # without `gh` (e.g. on a server): the API directly with GITHUB_TOKEN (fine-grained, read-only on public repos)
    if not shutil.which("gh"):
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        url = f"https://api.github.com/{path.lstrip('/')}" + (("&" if "?" in path else "?") + urllib.parse.urlencode(params) if params else "")
        req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "reelforge-radar",
                                                   **({"Authorization": f"Bearer {token}"} if token else {})})
        with urllib.request.urlopen(req, timeout=60) as r:
            body = json.loads(r.read() or b"null")
            return (f"link: {r.headers.get('Link', '')}", body) if include else body
    args = ["gh", "api", "-X", "GET", path] + [x for k, v in params.items() for x in ("-f", f"{k}={v}")]
    if include:
        args.insert(2, "--include")
    r = subprocess.run(args, capture_output=True, text=True, timeout=90)
    if r.returncode:
        raise RuntimeError(r.stderr.strip()[:200])
    if not include:
        return json.loads(r.stdout)
    head, _, body = r.stdout.partition("\n\n") if "\r\n\r\n" not in r.stdout else r.stdout.partition("\r\n\r\n")
    return head, json.loads(body or "null")


def paged_total(path):
    """Total items of a paginated list asking 1 per page (the number of the last page = total)."""
    head, body = gh(path, include=True, per_page=1, anon=1)
    m = re.search(r'[?&]page=(\d+)>; rel="last"', head)
    return int(m.group(1)) if m else len(body or [])


def search_github(days, minimum):
    since = (NOW - dt.timedelta(days=days)).strftime("%Y-%m-%d")
    out = {}
    for page in (1, 2, 3):
        d = gh("search/repositories", q=f"created:>{since} stars:>{minimum}", sort="stars", order="desc", per_page=100, page=page)
        for it in d["items"]:
            out[it["full_name"].lower()] = it
        if len(d["items"]) < 100:
            break
    return out


def search_hn():
    since = int((NOW - dt.timedelta(days=7)).timestamp())
    q = urllib.parse.urlencode({"query": "github.com", "tags": "story", "hitsPerPage": 200,
                                "numericFilters": f"points>100,created_at_i>{since}"})
    d = json.load(urllib.request.urlopen(f"https://hn.algolia.com/api/v1/search?{q}", timeout=30))
    out = {}
    for h in d["hits"]:
        m = re.search(r"github\.com/([\w.-]+)/([\w.-]+)", (h.get("url") or "") + " " + (h.get("story_text") or ""))
        if m and m.group(1).lower() not in ("orgs", "topics", "sponsors", "features"):
            name = f"{m.group(1)}/{m.group(2).removesuffix('.git')}".lower()
            if name not in out or h["points"] > out[name]["points"]:
                out[name] = dict(points=h["points"], comments=h.get("num_comments", 0), title=h["title"],
                                 link=f"https://news.ycombinator.com/item?id={h['objectID']}")
    return out


def already_done(brand):
    done = set()
    for p in glob.glob(os.path.join(ROOT, "videos", brand, "*", "job.md")):
        done.update(m.lower() for m in re.findall(r"github\.com/([\w.-]+/[\w.-]+)", open(p, encoding="utf-8").read()))
    return done


def detail(name, base):
    r = base or gh(f"repos/{name}")
    d = dict(name=r["full_name"], url=r["html_url"], desc=(r.get("description") or "").strip(), stars=r["stargazers_count"],
             forks=r["forks_count"], created=r["created_at"][:10], language=r.get("language") or "—",
             license=(r.get("license") or {}).get("spdx_id") or "—", topics=r.get("topics") or [], site=r.get("homepage") or "",
             owner=r["owner"]["login"])
    full = gh(f"repos/{name}")  # search doesn't return real watchers (subscribers_count)
    d["watchers"] = full.get("subscribers_count", 0)
    try:
        d["contributors"] = paged_total(f"repos/{name}/contributors")
        d["commits"] = paged_total(f"repos/{name}/commits")
        top = [c for c in gh(f"repos/{name}/contributors", per_page=6) if "[bot]" not in c["login"] and c["login"].lower() not in BOTS]
        d["owner_commits"] = top[0]["contributions"] if top else 0
        d["top_author"] = top[0]["login"] if top else d["owner"]
    except Exception:
        d.update(contributors=0, commits=0, owner_commits=0, top_author=d["owner"])
    try:
        rel = gh(f"repos/{name}/releases", per_page=100)
        d["downloads"] = sum(a["download_count"] for x in rel for a in x["assets"])
        d["releases"] = len(rel)
        d["version"] = rel[0]["tag_name"] if rel else ""
    except Exception:
        d.update(downloads=0, releases=0, version="")
    return d


def evaluate(d, hn, history):
    days = max(1.0, (NOW - dt.datetime.fromisoformat(d["created"] + "T00:00:00+00:00")).total_seconds() / 86400)
    d["days"] = round(days)
    d["per_day"] = round(d["stars"] / days)
    text = (d["desc"] + " " + " ".join(d["topics"])).lower()
    bonus = 1.0
    for pattern, b in TOPIC.items():
        if re.search(pattern, text):
            bonus *= b
    d["hn"] = hn.get(d["name"].lower())
    if d["hn"]:
        bonus *= 1 + min(1.0, d["hn"]["points"] / 500)
    # growth since the last run (also catches an old repo climbing again)
    prev = history.get(d["name"].lower())
    d["grew"] = None
    if prev:
        dd = max(0.5, (NOW - dt.datetime.fromisoformat(prev["when"])).total_seconds() / 86400)
        d["grew"] = dict(stars=d["stars"] - prev["stars"], days=round(dd, 1))
    # bought stars: a big repo with very few forks/watchers/commits is not real engagement
    alerts = []
    if d["stars"] > 3000 and d["forks"] / d["stars"] < 0.015:
        alerts.append(f"few forks ({d['forks']} for {d['stars']} stars)")
    if d["stars"] > 3000 and d["watchers"] / d["stars"] < 0.002:
        alerts.append(f"few watchers ({d['watchers']})")
    if d["stars"] > 5000 and d["commits"] and d["commits"] < 15:
        alerts.append(f"only {d['commits']} commits")
    if not d["desc"]:
        alerts.append("no description")
    d["alerts"] = alerts
    d["score"] = round(math.log10(1 + d["per_day"]) * bonus * (0.35 if alerts else 1.0), 2)
    return d


def hook(d):
    desc = d["desc"].lower()
    target = re.search(r"(?:alternative to|replacement for|clone of|reimplementation of)\s+([\w .+-]{2,30}?)(?:[,.;:(]|$| in | for | written)", desc) \
        or re.search(r"\b([A-Z][\w+]+) (?:alternative|replacement|clone)", d["desc"])
    solo = d["commits"] and d["owner_commits"] / max(1, d["commits"]) >= 0.75
    parts = []
    if d["days"] > 90 and d["hn"]:  # old repo back in the news: the hook is the news, not the speed
        return f"**news**: \"{d['hn']['title']}\" (HN, {d['hn']['points']} points) — already known repo, {d['stars']:,} stars"
    if target:
        parts.append(f"contrast with **{target.group(1).strip()}** (the free/open one against the paid one)")
    if solo:
        parts.append(f"**one person almost alone** ({d['top_author']}: {d['owner_commits']} of {d['commits']} commits)")
    if d["per_day"] >= 200:
        parts.append(f"**speed**: {d['stars']:,} stars in {d['days']} days")
    if d["downloads"] >= 10000:
        parts.append(f"**downloads**: {d['downloads']:,} downloaded")
    return " · ".join(parts) or "what it does + 1 strong number"


def sheet(d, k):
    n = lambda x: f"{x:,}"
    lines = [f"### {k}. [{d['name']}]({d['url']}) — score {d['score']}" + (" ! " + "; ".join(d["alerts"]) if d["alerts"] else ""),
             f"> {d['desc'] or '(no description)'}", "",
             "| fact | value |", "|---|---|",
             f"| stars | {n(d['stars'])} ({n(d['per_day'])}/day since creation) |",
             f"| created | {d['created']} ({d['days']} days) |",
             f"| forks · watchers | {n(d['forks'])} · {n(d['watchers'])} |",
             f"| contributors · commits | {d['contributors']} · {n(d['commits'])} (top: {d['top_author']} with {n(d['owner_commits'])}) |"]
    if d["releases"]:
        lines.append(f"| releases · downloads | {d['releases']} (latest {d['version']}) · {n(d['downloads'])} |")
    if d["grew"]:
        lines.append(f"| since the last run | +{n(d['grew']['stars'])} stars in {d['grew']['days']} days |")
    if d["hn"]:
        lines.append(f"| Hacker News | {d['hn']['points']} points, {d['hn']['comments']} comments — [{d['hn']['title']}]({d['hn']['link']}) |")
    lines += [f"| language · license | {d['language']} · {d['license']} |",
              f"| topics | {', '.join(d['topics'][:8]) or '—'} |"]
    if d["site"]:
        lines.append(f"| site | {d['site']} |")
    lines += ["", f"**Likely hook**: {hook(d)}", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--brand", required=True)
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--min-stars", type=int, default=500)
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--dir", help="where to write the topic list and the history (default: brands/<brand>/radar/)")
    ap.add_argument("--summary", action="store_true", help="print only a compact summary (for an agent/cron to read)")
    a = ap.parse_args()

    folder = a.dir or os.path.join(ROOT, "brands", a.brand, "radar")
    os.makedirs(folder, exist_ok=True)
    hist_file = os.path.join(folder, "history.json")
    history = json.load(open(hist_file)) if os.path.exists(hist_file) else {}

    found = search_github(a.days, a.min_stars)
    try:
        hn = search_hn()
    except Exception as e:
        print(f"Hacker News unavailable ({e}); going on with GitHub only", file=sys.stderr)
        hn = {}
    done = already_done(a.brand)
    log = (lambda *x: print(*x, file=sys.stderr)) if a.summary else print
    log(f"GitHub: {len(found)} repos · Hacker News: {len(hn)} with a GitHub link · already done: {len(done)}")

    # cheap pre-selection (no extra calls): stars/day × topic; + everything that blew up on HN
    def preview(it):
        days = max(1.0, (NOW - dt.datetime.fromisoformat(it["created_at"].replace("Z", "+00:00"))).total_seconds() / 86400)
        txt = ((it.get("description") or "") + " " + " ".join(it.get("topics") or [])).lower()
        return it["stargazers_count"] / days * math.prod(b for p, b in TOPIC.items() if re.search(p, txt))
    names = [k for k, _ in sorted(found.items(), key=lambda kv: -preview(kv[1]))[:35]]
    names += [k for k in sorted(hn, key=lambda k: -hn[k]["points"])[:10] if k not in names]
    names = [k for k in names if k not in done]
    text_of = lambda k: (k + " " + ((found.get(k) or {}).get("description") or "") + " " + (hn.get(k) or {}).get("title", ""))
    names = [k for k in names if not BLOCK.search(text_of(k))]

    def one(name):
        try:
            return evaluate(detail(name, found.get(name)), hn, history)
        except Exception as e:
            print(f"  skipped {name}: {e}", file=sys.stderr)
            return None
    with ThreadPoolExecutor(8) as ex:
        repos = [d for d in ex.map(one, names) if d]
    repos.sort(key=lambda d: -d["score"])

    for d in repos:  # history for the next run to measure growth
        history[d["name"].lower()] = dict(stars=d["stars"], when=NOW.isoformat())
    for it in found.values():
        history.setdefault(it["full_name"].lower(), dict(stars=it["stargazers_count"], when=NOW.isoformat()))
    json.dump(history, open(hist_file, "w"), indent=0)

    n = lambda x: f"{x:,}"
    top = repos[: a.top]
    md = [f"# Repo radar — {NOW:%Y-%m-%d}", "",
          f"Sources: GitHub Search (created in the last {a.days} days, > {a.min_stars} stars) + Hacker News (7 days, 100+ points). "
          f"Queried at {NOW:%Y-%m-%d %H:%M} UTC — numbers change every day. ! = signs of inflated stars: check before picking.", "",
          "| # | repo | stars | days | /day | forks | downloads | HN | score |", "|---|---|---|---|---|---|---|---|---|"]
    for k, d in enumerate(top, 1):
        md.append(f"| {k} | [{d['name']}]({d['url']}){' !' if d['alerts'] else ''} | {n(d['stars'])} | {d['days']} | {n(d['per_day'])} | "
                  f"{n(d['forks'])} | {n(d['downloads']) if d['downloads'] else '—'} | {d['hn']['points'] if d['hn'] else '—'} | {d['score']} |")
    md += ["", "## Fact sheets", ""] + [sheet(d, k) for k, d in enumerate(top, 1)]
    out = os.path.join(folder, f"{NOW:%Y-%m-%d}.md")
    open(out, "w", encoding="utf-8").write("\n".join(md))
    log(f"→ {out}")
    if a.summary:  # short, stable text for the agent to turn into the day's message
        print(f"RADAR {NOW:%Y-%m-%d} (queried {NOW:%H:%M} UTC; numbers change every day)")
        for k, d in enumerate(top, 1):
            line = [f"{k}. {d['name']} — {d['url']}", f"   {d['desc'][:220] or '(no description)'}",
                    f"   {n(d['stars'])} stars in {d['days']} days ({n(d['per_day'])}/day) · {n(d['forks'])} forks"
                    + (f" · {n(d['downloads'])} downloads" if d["downloads"] else "")
                    + (f" · HN {d['hn']['points']} pts: {d['hn']['title']}" if d["hn"] else "")
                    + (f" · +{n(d['grew']['stars'])} since the last run" if d["grew"] else ""),
                    f"   likely hook: {re.sub(r'[*]', '', hook(d))}" + (f" · ! {'; '.join(d['alerts'])}" if d["alerts"] else "")]
            print("\n".join(line))
    else:
        for k, d in enumerate(top, 1):
            print(f"{k:2}. {d['score']:5} {d['name']:42} {n(d['stars']):>8} ★ {n(d['per_day']):>6}/day{'  !' if d['alerts'] else ''}")
