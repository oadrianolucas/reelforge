# reelforge — AI video factory

You produce short videos (realistic UGC, motion ads, edited talking-head recordings, elegant brand videos, narrated
lessons) for the brands registered in `brands/`. No video editor: everything comes out of APIs (ElevenLabs,
OpenRouter, Apify) + Remotion + ffmpeg, and the result is `videos/<brand>/<job>/final.mp4` (+ `final-4x5.mp4`, …).

Reply in the user's language. Narration language comes from `brand.md → Tone of voice → Narration language`.

## Structure

```
reelforge/
  CLAUDE.md                 ← this file (the rules of the flow)
  formats.md                ← UGC formats that work (hooks, structures, pacing, script.md template)
  .env                      ← keys (not versioned) — template in .env.example
  brands/
    _template/brand.md      ← brand profile template (copied by /new-brand)
    <brand>/
      brand.md              ← full identity: product, audience, tone, visuals, persona, app, rules, learnings
      ideas.md              ← the brand's script bank (💡 idea / ✅ produced, with a link to the job)
      outliers.json         ← niche search terms for scripts/outliers.py (optional)
      assets/               ← logo, fonts, persona.png (fixed face) — not in git
  library/                  ← assets paid for once and reused (see library/README.md)
  videos/                   ← ONE FOLDER PER BRAND
    <brand>/<YYYY-MM-DD>-<topic>/   ← one job
      job.md                ← request, decisions, costs and status of each step
      script.md             ← approved script (line + what is on screen, per scene)
      screens/ voice/ scenes/ media/ music/   ← generated material
      final.mp4
  references/               ← third-party reference videos (not in git)
  examples/                 ← free example jobs (no API keys needed)
  scripts/                  ← Python CLIs (all take --help)
  remotion/                 ← the Remotion project (generic compositions fed by JSON)
```

## Library (reuse before you spend)

`library/` keeps what was already paid for and approved: AI personas with clips cut into named shots, music with
mapped beats, sound effects, visual hooks — index in `library/catalog.json`, rules in `library/README.md`.
`python3 scripts/prepare.py` mirrors the library into `remotion/public/library/`.

## Styles (skills) — pick one before writing the script

| Skill | When | Typical AI cost |
|---|---|---|
| `motion-ad` | explosive motion ad: price, offer, service (composition `MotionAd`) | ≤ US$ 0.50 (0–1 AI scene) |
| `retail-offers` | animated store flyer: product + giant price + voice-over (composition `RetailOffers`) | ~US$ 0 |
| `app-showcase` | music-only app showcase, screens in 3D, flying objects (composition `AppShowcase`) | ~US$ 0 |
| `ugc-story` | short story with a character in AI scenes + app screens (`UgcNarratedJob`) | US$ 0.30–3 |
| `ugc-avatar` | first-person testimonial with an AI avatar talking + app screens | US$ 1–2 (lip-sync) |
| `ugc-at-scale` | **batch**: scrape niche outliers (Apify) → Gemini breakdown → ~20 scripts → same AI creator in third-person scenes + narration + app screens (`UgcNarratedJob`) | ~US$ 2 research + US$ 0.30–0.60/video |
| `viral-hook` | opens the ad with a high-impact **visual hook** that becomes a scene: the persona appears in the same place and says the bridge line (Gemini picks and writes, Veo 3.1 speaks) | ~US$ 0.70/video |
| `vibe-text` | **10 s organic post**: AI person enjoying the music in a selfie + native-style text + a list on the beat, no logo (`VibeText`) | ~US$ 0.30/video |
| `recorded` | **real footage** of you talking: cuts, split screen, diagrams, titles — short verticals and long 16:9 (`Recorded`) | ~US$ 0 (transcription only) |
| `hook-script` | spoken script about a repo/project/AI news in the "told case" format (hook, turns, CTA) → then `recorded` | ~US$ 0 |
| `elegant-brand` | **elegant brand/tech** video (not an ad): real photos/footage + calm narration + serif, numbers, a quote, the app on a tablet, sign-off (`ElegantJob`) | voice + music only |
| `narrated-lesson` | **narrated 16:9 training/presentation**: chapters, lists on the spoken word, plans, objections (`Lesson`) | voice + music (+ photos ~US$ 0.04) |
| `analyze-reference` | the user sent reference videos → metrics, structure, style → which style it becomes | transcription only |

If no style fits, analyze the reference and create a new skill in `.claude/skills/<style>/SKILL.md`.
How the styles were derived: `docs/reference-analysis.md`.

## Commands

| Command | What it does |
|---|---|
| `/new-brand <name> [url]` | Research + short interview → `brands/<slug>/brand.md` (visual identity, tone, persona, app) |
| `/ugc <brand> <topic>` | Runs the flow of one video (pick the style in step 1) |

## Scripts (`python3 scripts/<name>.py --help` for every flag)

| Script | Does |
|---|---|
| `voice.py` | ElevenLabs narration (v3, emotion tags) + forced word alignment; `--samples` to compare voices; `--pronunciation` |
| `patch_voice.py` | replaces one sentence of the narration without regenerating the approved take (+ `PatchedNarration`) |
| `swap_voice.py` | ElevenLabs speech-to-speech on a spoken AI clip (keeps the lip timing) |
| `music_beats.py` | music onsets → `<track>.beats.json` (pulse and impacts on time) |
| `image_openrouter.py` | image (storyboard frame, persona, scene with `--reference` for the same face) |
| `video_openrouter.py` | AI video clip (Seedance, Kling, Veo…), `--last` for first + last frame, prints the real cost |
| `heygen_speech.py` | persona lip-sync from a photo + a narration slice (HeyGen Avatar IV) |
| `omni_speech.py` | on-camera spoken hook (Gemini Omni, native voice): estimate without `--confirm`; with it generates, checks the speech by transcript, trims and crops the burned caption → `media/speech.mp4` + `media/hook.json` |
| `host_apify.py` | uploads a file to a private Apify store and prints a signed HTTPS link (for APIs that only take URLs) |
| `trim_png.py` | trims transparent PNG borders (centers products by their real content); `--bg`, `--key-black` |
| `remove_black_bg.py` | logo/mascot on black → transparent PNG |
| `prepare.py` | mirrors the library and copies a job's material into `remotion/public/<slug>/` |
| `analyze_reference.py` | metrics, transcript and frames of reference videos |
| `recording.py` | real footage: HDR→SDR, transcript, cut pauses/mistakes without eating words (+ check), speed-up → `recording/edl.json` |
| `radar.py` | daily topic list: exploding GitHub repos (GitHub Search + Hacker News + history), score, fact sheets → `brands/<brand>/radar/` |
| `outliers.py` | videos that outperform in the niche (TikTok + Instagram via Apify, terms in `brands/<brand>/outliers.json`), downloads the top → `references/outliers/` |
| `breakdown.py` | Gemini (OpenRouter, video input) breaks each video down: hook, format, takes, pacing, script, template → `.breakdown.json` |
| `batch.py` | UGC batch with spoken takes: estimate cost, one clip per take (Seedance 1.5 Pro with audio, only with `--confirm`), join into `raw.mp4` |
| `hooks.py` | Gemini watches the clips in `library/hooks` (`analyze`) and picks hook + writes the bridge line per video (`bridges`) |
| `hook_continue.py` | hook becomes a scene: last frame → persona in the same scene (Nano Banana) → speech (Veo 3.1 Fast, `--confirm`) → cuts invented words |
| `ugc_narrated.py` | module for the `UgcNarratedJob` template: `Job(folder).build(v, persona, segments by word…)` → `media/script.json`; `publish()` → `remotion/out/pub-<slug>/` + render commands |
| `elegant.py` | elegant brand style: `words`, `estimate`, `publish`, `frames`, `render <job> 9:16,4:5` (with retries) |
| `lesson.py` | narrated 16:9 lesson: `voice` (one mp3 per chapter), `estimate`, `build`, `bundle`, `frames`, `render` |
| `approval_preview.py` | preview for a **client** to approve: "FOR APPROVAL" across the frame + a band, 720 px → `<final>-PREVIEW.mp4` |
| `check.py` | finishing of **every** render: −14 LUFS / peak ≤ −1 dBTP, contact sheet, speech still audible |
| `example.py` | renders the free examples: `python3 scripts/example.py example-coffee/motion-ad [--format 4:5] [--render]` |

## Remotion compositions

Every composition is generic: a video is data in `remotion/public/<slug>/` (or `remotion/out/pub-<slug>/`), chosen with
`--props '{"slug": "...", "format": "..."}'`; size and duration come from `calculateMetadata`. With no data they render a
placeholder, so `npx remotion studio` always opens.

| Ids | Data | Style |
|---|---|---|
| `UgcNarratedJob`, `UgcNarratedJob4x5`, `UgcNarratedJob1x1` | `script.json` + narration (from `ugc_narrated.py`) | `ugc-story`, `ugc-at-scale`, `viral-hook` |
| `Recorded`, `Recorded4x5`, `Recorded1x1`, `Recorded16x9` | `cut.mp4`, `edl.json`, `edit.json` | `recorded` |
| `ElegantJob`, `ElegantJob4x5`, `ElegantJob1x1` | `script.json` (from `elegant.py publish`) | `elegant-brand` |
| `Lesson` (1920x1080) | `timeline.json` (from `lesson.py build`) | `narrated-lesson` |
| `VibeText`, `VibeText4x5`, `VibeText1x1` | `vibe.json` | `vibe-text` |
| `MotionAd`, `MotionAd4x5`, `MotionAd1x1` | `ad.json` | `motion-ad` |
| `RetailOffers`, `RetailOffers4x5`, `RetailOffers1x1` | `offers.json` | `retail-offers` |
| `AppShowcase`, `AppShowcase4x5`, `AppShowcase1x1` | `showcase.json` | `app-showcase` |

## The flow of a video (`/ugc`)

1. **Briefing** — read `brands/<brand>/brand.md` in full and `formats.md`. Create the job folder and `job.md`.
2. **Script** — write `script.md` (format in `formats.md`). **STOP and ask for approval.**
3. **App capture** — record/screenshot the screens named in the script (Playwright, phone viewport), demo account only.
4. **Voice** — ElevenLabs with the persona's voice (`brand.md → UGC persona → Voice`), with word timestamps.
5. **Avatar and AI scenes** — first the image/first frame of each scene (cheap), **STOP and show the estimated cost of
   the video**, and only generate the approved clips.
6. **Assembly** — Remotion + ffmpeg: cuts on silences and breaths, motion/zoom on screens following the speech,
   captions in the brand style, music with ducking, end card with the visual identity.
7. **Review** — show the result (a few frames + length + cost). Changes redo only the affected step. Corrections that
   apply to the whole brand go to `brand.md → Learnings`.

Update `job.md` at the end of every step (status, files, money spent). If the conversation drops, the next `/ugc` in
the same folder continues from where it stopped.

## Rules that always apply

- **Spending**: never generate AI video without explicit approval. Default cap per video: US$ 3 (`brand.md` can change
  it). Scripts that spend money only do so with `--confirm`; without it they print the prompt and the estimate. Log
  every paid call in `job.md` with its cost.
- **Real data**: only record the app in the **demo** environment/account given in `brand.md`. If a real customer's
  name, phone number or data shows up on screen, stop and warn.
- **Credentials**: only in `.env` (never copy values into `brand.md`, `job.md` or commits).
- **Git is text only**: commits carry code, `.md` and `.json` (scripts, `catalog.json`, `shots.json`, beats). Media
  (mp3, mp4, png, jpg, pdf, fonts…) **never** goes to git — `.gitignore` blocks it by extension. Don't `git add -f` media.
- **Identity**: colors, fonts, captions and CTA come from `brand.md → Visual identity`. Don't invent a palette. If
  something is missing, ask or use the neutral default.
- **Fixed persona**: the face (`assets/persona.png`) and the voice of the persona are always the same within a brand —
  that's what makes it feel like a real creator, not a generic avatar. Personas are AI-generated and original; never a
  real person's face.
- **Promises**: respect `brand.md → Rules and restrictions` (e.g. health never promises results). No invented
  customer numbers or testimonials.
- **No children** in hooks or scenes; check phone screens and backgrounds too.
- **Formats: ask before the final render.** Suggest `final.mp4` (9:16, 1080x1920, Reels/Stories/Shorts) and
  `final-4x5.mp4` (4:5, 1080x1350, feed); `final-1x1.mp4` (1:1) only on request. 15–40 s, burned-in captions, hook in
  the first 3 seconds.
  - Compositions take `format: "9:16" | "4:5" | "1:1"` and lay out per format (captions, notification, phone scale,
    `focus` of the scene crop).
  - Generate AI scenes in 9:16 with the subject **centered with room above and below** ("subject centered, safe for
    square crop" in the prompt) — 4:5 and 1:1 are crops of them, no regeneration.
  - Before rendering, check key frames in every format (faces cut off, text covered).
  - After rendering, run `scripts/check.py` (platform loudness; without it renders land anywhere between −14 and
    −17 LUFS and some clip above 0 dBTP).
- **Client work**: send the watermarked preview (`scripts/approval_preview.py`) first; the clean final only after
  approval.
- **Interface icons**: Remix Icon (`@remixicon/react`, `import { RiCheckLine } from "@remixicon/react"`) — no emoji or
  characters (✓ ↗ ▾ ➤) as icons. Emoji only **inside the text** of messages/notifications, where a real person would
  type them.

## AI scene prompt (mandatory template — a poor prompt = a video that looks thrown together)

In English, in this order, one sentence per item:
1. **Format and style**: "Ultra-realistic vertical 9:16 smartphone video, shot on iPhone 15 front/back camera".
2. **Person**: age, ethnicity, hair (color, cut, how it sits), makeup, clothing (piece, color, fabric), accessories.
3. **Setting**: a concrete place + 3–4 background objects + time of day.
4. **Light**: source and color ("warm practical shop lights, cool blue dusk through the window, soft key light from the phone").
5. **Camera**: framing (close/medium), lens (24 mm/35 mm), height, movement ("slight handheld sway, slow push-in").
6. **Action second by second**: "0–1s …; 1–3s …; 3–5s …" — small, plausible gestures and expressions.
7. **Texture**: "natural skin texture with pores, subtle film grain, slight motion blur, realistic reflections".
8. **Restrictions**: "no text, no logos, no subtitles, no extra fingers, mouth closed / not speaking" (if the voice is narration).
With a person and physical direction (pull/push, up/down), generate the frame first and check it (see Tools).

## Tools

- `ffmpeg`/`ffprobe` on PATH. Playwright via `npx playwright` (install Chromium the first time).
- Silences: `silencedetect`; ElevenLabs voices come out clean, so cuts matter mostly for long breaths between sentences.
- APIs (keys in `.env`): **ElevenLabs** (voice, Scribe transcription, music) and **OpenRouter** (image, video, and
  Gemini watching video). **Apify** (`APIFY_TOKEN`) to scrape TikTok/Instagram and host files. `yt-dlp` optional.
- **ElevenLabs**: `eleven_v3` with emotion tags (`[excited]`, `[curious]`, `[laughs]`, `[whispers]`) straight from
  text is the most natural narration; stability 0 for ads, ~0.5 for calm brand/lesson narration. Numbers spelled out
  in the voice text, digits on screen. Foreign names: try spellings with `--pronunciation`.
- **Video models on OpenRouter** (list them with `/api/v1/models?output_modalities=video`; public prices at the time of
  writing — check the current docs for the request format and price before the first call, don't guess endpoints):
  - **`kwaivgi/kling-v3.0-pro`** — default for image-to-video with **realistic people** (~US$ 0.112/s without audio).
    Seedance 2.x **refuses** a first frame with a photorealistic face (`InputImageSensitiveContentDetected.PrivacyInformation`,
    no charge) — use it for scenes without people or for text-to-video.
  - `bytedance/seedance-2.5` (~US$ 0.23/s) — scenes without people / **text-to-video with a realistic person** works;
    a 12 s multi-shot with 4 shots and the same character comes out well; queue ~3–6 min. Physical direction (pull vs.
    push, who is in front) can come out inverted in text-to-video: generate a Seedream frame first that shows the action
    unambiguously (e.g. in profile), check it, and pass it as `--image` — a small/profile character passes the face
    filter. **Check the order in space** in the frame (who is higher/closer to the camera) and the direction of motion,
    not just the action — Seedream gets it wrong often. One frame per shot (separate clips) holds better than a
    multi-shot from one frame. `bytedance/seedance-2.0-fast` for cheap drafts.
  - **`bytedance/seedance-1-5-pro`** — the **cheapest** (~US$ 0.13 per 5 s at 720p, ~1 min queue) and it **accepts a
    first frame with a photorealistic face**. Returns the video in the input image's aspect ratio — send the frame
    already in 9:16. **With audio** (`--audio`, ~US$ 0.052/s) it gets the words right, but non-English speech can come
    out with a foreign accent and the voice varies between takes.
  - **`heygen/avatar-iv`** — persona **talking** with lip-sync from a photo + ElevenLabs audio (~US$ 0.05/s;
    `scripts/heygen_speech.py`). Body: `input_references` = [`image_url` (data URL with the real mime type — check
    whether your persona file is really PNG or JPEG), `audio_url` (**HTTPS only**: `scripts/host_apify.py <mp3>`
    returns a signed link)]. The native speech of video models is the weaker path for talking UGC.
  - **`google/gemini-omni-1.1-flash`** — image-to-video **with native speech** from `persona.png` (accepts a realistic
    face), accurate transcript and a faithful face, but **~US$ 0.10/s with audio** (~US$ 0.81 per 8 s) and it **burns
    captions** into the image even with "no subtitles" (crop the frame; `omni_speech.py` does it). Billed per token (the
    price per clip only shows in `usage.cost`).
  - `google/veo-3.1-fast` (~US$ 0.60 per 6 s with audio; first + last frame supported), `minimax/hailuo-3`.
  - Images: `bytedance-seed/seedream-5-0-lite` (~US$ 0.035) for frames; `google/gemini-nano-banana-2.1` (~US$ 0.07)
    with `--reference` to keep the same face in a new place.
  - Video understanding: `google/gemini-3.8-flash` (~US$ 0.01 per 30 s video) in `breakdown.py` and `hooks.py`.
- **Review every AI clip before using it**: a strip of frames at 2 fps with timestamps; look for objects that deform or
  change, hands/people that vanish. Keep only the clean part.
- **Remotion**: `remotion/` — `scripts/prepare.py <job> <slug>` copies the material into `public/<slug>/`; AI scenes
  without an `.mp4` fall back to their reference image, so everything can be reviewed before spending.
