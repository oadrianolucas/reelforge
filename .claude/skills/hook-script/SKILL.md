---
name: hook-script
description: Writes the spoken script of a vertical video about a project (GitHub repo, app, AI tool) or an AI/tech news story, in the "told case" format — a contrast hook with a number in the first sentence, an open loop, turns every 25–40 s, proof in numbers, a thesis as an antithesis, a question and a keyword CTA. Researches the facts first (README, stars, author, dates, sources) and marks the screen for every sentence so the recorded style can edit it. Use when the user sends a repo/project/news link asking for a script ("write a script for this repo", "video about this news", "script with a hook"), or asks for today's topic.
---

# Hook script (projects and news)

Copy the **structure and rhythm** of what works, never whole sentences from other creators. Once approved, the user
records it and it is edited with the `recorded` skill.

## 0. Find the topic (when the user didn't send a link — "make today's video", "what's trending")
`python3 scripts/radar.py --brand <brand>` → `brands/<brand>/radar/YYYY-MM-DD.md`: ranking (stars/day, AI/video/free
alternative topics, Hacker News) and a fact sheet per repo with the facts and a likely hook. Prefer: high score, no
warning flag, a subject a **regular person** (not a developer) understands in one sentence, something you can **show**
(interface, before/after). Technical topics (CLI, coding agent, model, framework) **also work** when the effect fits
in one everyday sentence ("a program that installs itself on your PC", "a site that writes the news without
journalists") — "complicated made simple" is a strong format. In a batch, about 1 in 3–4. Drop only what, even
translated, changes nothing for people who don't code.

**Audience = regular people** (`brand.md → Essence`). The repo is the pretext; the video is about what changes in the
viewer's life. Anchor the hook in everyday life — an app they already use or pay for (Word, Photoshop, CapCut,
WhatsApp), money, the phone, work, study — and answer "so what's in it for me?" by 10 s. Stars, GitHub and "open
source" are **proof** (block 6), not the hook: "tens of thousands of people use it" instead of "67k stars on GitHub".
Translate the technical into the effect ("runs on your computer, offline, for free"). The radar fact sheet is the
start of `research.md` — complete it with README, author and context (step 1).

## 1. Research (before writing a line)
- **GitHub repo**: `gh repo view <owner/repo>` (description, stars, creation), `gh api repos/<owner/repo>` (stars,
  forks, created_at, pushed_at), the whole README, releases, who the author is (`gh api users/<owner>`), most-commented
  issues. Run/read the usage example to explain the **mechanism** in 3 steps.
- **News**: the primary source (official announcement, paper, company blog) + 1–2 outlets. Exact date.
- Write every number with its source in `research.md` in the job. **Never invent a number, date or quote** — no
  source, it's out of the script. Stars/downloads change daily: write "more than 12 thousand" and the date checked.
- Look for the 4 things that make the case: **contrast** (small → huge, simple → powerful, nobody knows it → everyone
  uses it), **origin** (who, where, why), **turn** (the detail few people noticed), **proof** (numbers).

## 2. Write — structure
Length: **short 45–75 s (150–230 words)** for a repo/news of the day; **full 2–3 min (400–550 words)** for a case with
a story. ~3.1 words/s (adjust for the narration language).

| block | time (short · full) | what it does | formulas (vary, don't repeat in one video) |
|---|---|---|---|
| 1 hook | 0–4 s | one sentence, contrast + number/fact | "You pay N a month for <app> — and there's a free one that does the same." · "This does X and almost nobody is using it." · "One person built X that company Y charges $N a month for." · "<Company> just launched X and it changes Y." · "<Famous thing> is actually <reframe>." |
| 2 reinforcement + loop | 4–10 s | detail + promise | "And that's not even the interesting part." · "But the way they did it is genius." · "And I bet you've never heard of it." |
| 3 origin/context | 10–25 s · 10–50 s | who, when, what problem; dates and names | historical present, short sentences, "That's right," for the absurd |
| 4 mechanism | 25–45 s · 50–100 s | how it works, 3 steps with an everyday analogy | "It works like X, except…" · "First… Second… And third…" |
| 5 turn | — · every 25–40 s | re-hook | "But here's the part nobody expects." · "There's one detail few people noticed." · "But the real masterstroke came now." |
| 6 proof | 45–55 s · 100–130 s | 2–3 strong numbers, compared | "Today, …" · "X versus Y" |
| 7 thesis | 55–65 s · 130–150 s | the lesson as an antithesis | "<Who> understood what few people do: …" · "While everyone is X, they're Y." · "<Who> never sold X. They sold Y." |
| 8 question + CTA | last 8–10 s | comment + follow | "Will…?" · "Comment '<word>' and I'll send you the link." + the sign-off from `brand.md` |

Language rules: spoken and casual; numbers spelled out; concrete proper names; a first-person opinion at most twice
("Normally I'd say…"); a technical term only with a translation in the same sentence ("an agent — basically a program
that uses AI to make decisions on its own"). No "hi everyone", "today I'm going to talk about", "don't forget to like"
at the start. The CTA keyword is short and on-topic ("repo", "agent", "link"). For a repo/tool, the default CTA is
**comment the word to get the link** (the DM link drives comments and reach).

## 3. Deliver — `script.md` in the job
- Header: topic, source(s), estimated length (words ÷ words/s), CTA word.
- **3 alternative hooks** (different types) for the user to pick — the hook decides the video.
- Table per sentence: `line | screen` — the *screen* column already in the `recorded` vocabulary: `face`,
  `title: <text with *accent*>`, `screenshot: <what>` (repo, README, post, page), `diagram: A → B · C · D`, `list`,
  `photo: <what>`, `ui: <screen id>`. Media on screen by the 2nd–3rd second; at most ~8 s in a row of face only.
- A **teleprompter** version at the end (just the lines, short sentences, one per line) — what the user reads while
  recording.
- **STOP and ask for approval.** A requested change → rewrite only the affected block.

## Checklist before showing
- [ ] Does the first sentence alone stop someone? Does it have contrast **and** a concrete number/fact?
- [ ] Is there an open loop by 10 s and (in the full version) a turn every 25–40 s?
- [ ] Does every number have a source in `research.md`?
- [ ] Does the mechanism fit in 3 steps that become a `diagram`?
- [ ] Is the thesis a one-sentence antithesis? Does it end with a question + keyword CTA + sign-off?
