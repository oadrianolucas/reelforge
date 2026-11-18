# reelforge

An AI video factory you drive from [Claude Code](https://claude.com/claude-code). You describe the video you want;
Claude picks a style, writes the script, stops for your approval, generates voice, images and clips through APIs, and
assembles the final cut in [Remotion](https://www.remotion.dev) — short vertical ads, UGC, edited talking-head videos,
brand films and narrated lessons. Every step is a plain Python script or a JSON file you can read and change, and
nothing that costs money runs without your explicit go-ahead.

It started as the internal pipeline of a small Brazilian studio, so non-English narration (pt-BR in particular) is a
first-class citizen: the narration language is a per-brand setting, not an afterthought.

Styles included:

- **Motion ad** — giant kinetic type, color changing on every beat, price counters, coin bursts.
- **Retail offers** — animated store flyer: product, giant price, fast voice-over.
- **App showcase** — music-only, app screens in 3D, objects flying around a phone.
- **UGC story** — a character in realistic AI scenes, a narrator, app screens inside a phone.
- **UGC avatar** — first-person testimonial with a lip-synced AI persona.
- **UGC at scale** — scrape niche outliers, break them down with Gemini, write ~20 scripts, produce them with one AI creator.
- **Viral hook** — an impact clip that turns into a scene where your persona says the bridge line.
- **Vibe + text** — 10 s organic-looking post: a selfie clip, native-style text, a list on the beat.
- **Recorded** — your own talking-head footage: cuts on pauses and mistakes, split screens, titles, chapters.
- **Hook script** — researched spoken scripts about a repo or tech news, ready for the recorded style.
- **Elegant brand** — calm, premium brand/event video with real photos, serif titles and an app screen on a tablet.
- **Narrated lesson** — 16:9 training video with chapters, lists, plans and objections.

## How it works

```text
 you ──/ugc <brand> <topic>──▶ Claude Code
                                 │  reads CLAUDE.md, brands/<brand>/brand.md, the style's SKILL.md
                                 ▼
                            script.md ──── STOP: you approve the script
                                 │
              scripts/*.py ──────┼──▶ ElevenLabs (voice, alignment, transcription, music)
                                 ├──▶ OpenRouter (images, video clips, Gemini watching video)
                                 ├──▶ Apify (scrape TikTok/Instagram outliers, host files)
                                 │     first frames + cost estimate ── STOP: you approve the spend
                                 ▼
              videos/<brand>/<job>/ (job.md, voice/, scenes/, media/ …)
                                 │  scripts/prepare.py
                                 ▼
              remotion/public/<slug>/*.json ──▶ Remotion composition ──▶ render
                                 │
                                 ▼  scripts/check.py (−14 LUFS, true peak, contact sheet)
                           final.mp4 · final-4x5.mp4
```

- **Skills** (`.claude/skills/<style>/SKILL.md`) hold the craft of each style: structure, pacing, hooks, prompt
  patterns, model choices, costs and the pitfalls already hit.
- **Commands** (`.claude/commands/`): `/new-brand` registers a brand, `/ugc` runs a video end to end.
- **Scripts** (`scripts/`) do the API calls and the media work; each one has `--help`.
- **Remotion** (`remotion/`) has generic compositions fed by JSON: a video is data in `remotion/public/<slug>/`, picked
  with `--props '{"slug": "...", "format": "9:16"}'`.

## Requirements

- Python 3.10+ (scripts use the standard library; a few use `uv run --with …` for numpy/pillow)
- Node.js 18+ and npm (Remotion)
- ffmpeg and ffprobe on PATH
- Claude Code

API keys go in `.env` (template in `.env.example`):

| Key | Used for | Needed? |
|---|---|---|
| `ELEVENLABS_API_KEY` | narration, word alignment, transcription, music | for anything with a voice or a recording |
| `ELEVENLABS_VOICE_ID` | default voice when the brand doesn't set one | optional |
| `OPENROUTER_API_KEY` | images, AI video clips, Gemini video analysis | for AI scenes, personas, breakdowns |
| `APIFY_TOKEN` | TikTok/Instagram scraping, HTTPS hosting for lip-sync audio | only for `ugc-at-scale` research and `heygen_speech.py` |
| `GITHUB_TOKEN` | `radar.py` without the `gh` CLI | optional |

The bundled examples need no keys at all.

## Quickstart

```bash
git clone https://github.com/<you>/reelforge.git
cd reelforge
cd remotion && npm install && cd ..
cp .env.example .env            # fill in the keys you have

# free example, no API calls
python3 scripts/example.py example-coffee/motion-ad --render

# browse every composition
cd remotion && npx remotion studio
```

The examples use a fictional brand, `brands/example-coffee/`. Try `example-coffee/retail-offers` and
`example-coffee/app-showcase` too, and `--format 4:5` for the feed size.

## Make your own brand

Open Claude Code in the repo and run:

```text
/new-brand Acme Bakery https://acme.example
```

Claude researches the site, asks only what it couldn't find (audience, tone, narration language, persona, demo
account, restrictions) and writes `brands/acme-bakery/brand.md`. Then:

```text
/ugc acme-bakery weekend croissant promo
```

It picks a style, writes `script.md` with alternative hooks and a cost estimate, and waits for you. Approve, and it
continues step by step, updating `videos/acme-bakery/<date>-<topic>/job.md` as it goes, so an interrupted job can be
resumed.

## Styles

| Skill | When | Typical AI cost |
|---|---|---|
| `motion-ad` | price/offer/service ads, explosive motion | ≤ US$ 0.50 |
| `retail-offers` | store flyer with products and prices | ~US$ 0 |
| `app-showcase` | app launch, music only | ~US$ 0 |
| `ugc-story` | story with a character in AI scenes + app screens | US$ 0.30–3 |
| `ugc-avatar` | first-person testimonial with a talking AI persona | US$ 1–2 |
| `ugc-at-scale` | batch of ~20 creatives from niche outliers | ~US$ 2 research + US$ 0.30–0.60/video |
| `viral-hook` | impact clip that becomes a scene with your persona | ~US$ 0.70/video |
| `vibe-text` | 10 s organic post, selfie + text + music | ~US$ 0.30/video |
| `recorded` | edit your own talking-head footage | ~US$ 0 (transcription) |
| `hook-script` | researched script for a repo/news video | ~US$ 0 |
| `elegant-brand` | premium brand or event video | voice + music only |
| `narrated-lesson` | 16:9 training/presentation | voice + music |
| `analyze-reference` | learn a style from reference videos | transcription only |

## Costs and safety

- **Nothing paid runs without approval.** Scripts that generate video (`batch.py`, `hook_continue.py`,
  `omni_speech.py`) print the prompt and the estimate and stop unless you pass `--confirm`; the flow in `CLAUDE.md`
  makes Claude stop and show first frames and the cost before any clip is generated. The default cap is US$ 3 per video,
  configurable per brand.
- Every paid call prints its real cost and is logged in the job's `job.md`.
- Typical prices (public, at the time of writing — they change): Seedance 1.5 Pro ~US$ 0.13 per 5 s clip, Kling 3.0 Pro
  ~US$ 0.11/s, HeyGen Avatar IV ~US$ 0.05/s, Veo 3.1 Fast ~US$ 0.60 per 6 s with audio, a Seedream frame ~US$ 0.035,
  a Gemini breakdown ~US$ 0.01 per video. Voice, transcription and music use your ElevenLabs plan's credits.
- Screens are recorded only from demo accounts, personas are always AI-generated and original, and credentials live
  only in `.env`.

## Repo layout

```text
.claude/skills/      one folder per style (SKILL.md)
.claude/commands/    /new-brand, /ugc
CLAUDE.md            the rules Claude follows in this repo (flow, spending, formats, prompt template, models)
formats.md           UGC formats, hooks, pacing, script.md template
brands/              _template/ and example-coffee/; your brands go here
library/             reusable personas, music, sfx, hooks (catalog.json + README; media stays local)
examples/            free example jobs
scripts/             Python CLIs
remotion/            Remotion project (compositions, components, motion kit)
videos/              your jobs, one folder per brand (ignored by git)
references/          third-party reference videos (ignored by git)
docs/                data formats (JSON each composition reads) and the reference analysis behind the styles
```

## Contributing

Pull requests are welcome — new styles, compositions, phone screens, fixes. Keep the repo text-only: **never commit
media** (audio, video, images, fonts) **or keys**; `.gitignore` blocks media by extension. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
