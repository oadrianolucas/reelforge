---
name: elegant-brand
description: Produces an ELEGANT brand/technology video (not a sales ad) — REAL photos and footage (event, team, venue) + calm narration + serif typography with an italic accent, dark background with a soft glow in the brand color, big numbers, a quote, the app screen recreated in code on a tablet, and a final sign-off. Use for "event/conference/trade-show video", "what we learned", "show feature X with elegance", "institutional video", "brand film", "tech and elegance", "I don't want it to look like an ad", event recap with a product feature.
---

# Elegant brand video

Template: `remotion/src/elegant/` (compositions `ElegantJob` 9:16, `ElegantJob4x5`, `ElegantJob1x1`; props `{slug}`) ·
script: `scripts/elegant.py`. AI cost: voice + music only (ElevenLabs credits). No AI video.

## What it is (and isn't)
- **Brand/technology** tone, not sales: short sentences, calm narration (`--stability 0.5`), discreet CTA at the end
  ("site · Book a demo"). No "free", urgency or price.
- **Show the feature, don't justify yourself**: narration and titles say what the feature does and the gain for the
  customer. No safeguards spoken out loud ("no AI involved", "only with signed consent") — only what the app screen
  itself shows.
- Fixed visual language (that's what makes it look premium): ink background + 2 soft radial glows in the brand color;
  **serif** titles with `*a span*` in italics in the accent color; small spaced uppercase labels with hairlines;
  discreet sans captions at the bottom (hidden when the title already says the sentence); transitions **only crossfade
  + blur**; the camera only moves forward (slow zoom). **Not allowed here**: the motion-ad kit (beats, grid, confetti,
  shake, whip), impact SFX.

## Flow
1. **Briefing**: the user's material (photos/videos — unzip into `<job>/raw/`, drop duplicates by md5), the
   event/product site, the feature in the code (confirm it is in production; if not, warn "publish only after the
   deploy"). Look for **real sentences** in the material (talk slides, panels, program) — they beat invented insights.
2. **Script** (`script.md` + `voice/text.txt`) — a structure that works (~45 s, ~110 words):
   hook with the place/fact (strong photo) → the event in numbers → the line from the stage (quote) → the insight (team
   photo) → "That's why <brand> has…" + the feature step by step on the tablet → benefit (2 lines) → sign-off.
   **STOP and ask for approval.** Ask the **delivery formats** now too (default: 9:16 for Reels/Stories and 4:5
   1080x1350 for the feed; 1:1 only on request).
3. **Pronunciation**: foreign names (event, brand) → generate 3–4 short samples with different spellings
   (`voice.py --no-alignment`) and let the user pick before the narration. In the captions, `captions.display` swaps
   the phonetic spelling back to the real one (and spelled-out years back to digits).
4. **Media** in `<job>/media/`: photos 1440 px wide, clips 1080x1920 30 fps without audio
   (`ffmpeg -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" -an`), the brand
   `logo.svg` (turned white by a filter). Third-party content (another account's reel) stays out.
5. **Voice**: `python3 scripts/voice.py --voice <id> --text-file <job>/voice/text.txt --out <job>/voice/narration.mp3 --stability 0.5 --pronunciation Brand=Brahnd`.
   No voice yet? `python3 scripts/elegant.py estimate <job>` and build with estimated timing.
6. **Music**: elegant but with some movement (~100–110 BPM, piano + arpeggios + a light beat, at volume ~0.15). A pure
   ambient pad tends to feel too sleepy for an event recap. New track: ElevenLabs Music (`POST /v1/music`,
   `music_length_ms` = video duration), or one from `library/music/`.
7. **`script.json`** (`python3 scripts/elegant.py words <job>` prints the indices) — every `from`/`at` is a WORD index:
   | type | use | fields |
   |---|---|---|
   | `photo` | hook, insight | `media`, `focus`, `zoom [from,to]`, `darken`, `label`, `titles[{text, at, size}]`, `sub{text, at}`, `position: bottom/center` |
   | `sequence` | event in numbers | `items[{media, at, focus}]` (photos/clips crossfading), `numbers[{n, label, at, italic}]` |
   | `quote` | real line from the stage | `background` (clip, blurred), `label`, `lines[{text, at}]` |
   | `app` | the feature | `screen` (registry in `remotion/src/elegant/screens/index.ts`), `marks{…}`, `groups[[{text, at}]]` (titles above the tablet; a new group crossfades in) |
   | `signoff` | end | `title`, `at`, `siteAt`, `site`, `cta` |
   `label`: a string (hidden in 1:1) or `{text, formats: ["9:16"]}` (when it would touch a sign in the photo). `size`:
   title factor, a number or `{"9:16":…, "4:5":…, "1:1":…}`. `theme`: `background`, `primary`, `dark`, `accent`, `text`,
   `logo` (colors from `brand.md`). `captions`: `hide [[a,b]]`, `join [[a,b]]`, `display {idx: text}`.
8. **App screen**: recreated in code, fake data, **nothing sensitive in the image** (for intimate subjects, an
   abstract mesh instead of a photo). Tablet upright in 9:16 and landscape in 4:5/1:1 (`portrait` prop), fonts ≥ 18 px
   on the 1000 px tablet. New screen: `remotion/src/elegant/screens/<Name>.tsx` (copy `StatsDashboard.tsx`) + register
   it in `index.ts`.
9. **Stills**: `python3 scripts/elegant.py frames <job> 9:16 2.5 9 17 …` (and 4:5) — check titles touching signs in
   the photo, labels over text, empty scenes, captions repeating the title.
10. **Render**: `python3 scripts/elegant.py render <job> 9:16,4:5` → `final.mp4` and `final-4x5.mp4` (through
    `check.py`: −14 LUFS, peak ≤ −1 dBTP, contact sheet). Show the contact sheet and update `job.md`.

## Pitfalls seen before
- A `<Sequence>` inside a flex container without `layout="none"` jumps to the top-left corner.
- A nested `Sequence` counts time from its parent, not from the video.
- `npx remotion` can fail intermittently (especially Windows node through WSL) — `elegant.py` retries each step up to
  3 times.
