---
name: recorded
description: Edits REAL footage of someone talking to the camera (phone recording) in a minimal, elegant style — cuts on pauses and mistakes without eating words, split screen with a screenshot/diagram/app UI coming in on the word that mentions it, serif titles, chapters, white keynote-like canvas, discreet captions (editorial or mono), blur transitions, normalized loudness. Short verticals (AI news, projects, product tips) and long 16:9 (YouTube). Use when the user sends a recording ("I recorded", "edit this video", ".MOV", "talking head", "video of me talking").
---

# Recorded — you talking to the camera

Composition: **`Recorded`** (`Recorded` 9:16, `Recorded4x5`, `Recorded1x1`, `Recorded16x9`; props `{slug, format}`),
data in `remotion/public/<slug>/`: `cut.mp4` + `edl.json` (from `scripts/recording.py`) + `edit.json` (yours) + media.
AI cost: only the transcription (ElevenLabs Scribe, cents). No AI video unless b-roll is requested.

## Flow
0. **Script** (if it hasn't been recorded yet): skill `hook-script` — researches the project/news and delivers
   `script.md` with the screen for every sentence + a teleprompter version.
1. **Job**: `videos/<brand>/<YYYY-MM-DD>-<topic>/`. Raw phone footage in `raw/` (media is never committed). `job.md`
   as in the other styles.
2. **Transcribe** (converts HDR→SDR, 30 fps, video starting at 0 together with the audio):
   `python3 scripts/recording.py transcribe videos/<brand>/<job>/raw/IMG_1234.MOV --job videos/<brand>/<job> [--language eng]`
   Read the `index:word@s` list like an editor: repeated sentence, "wait, again", stutter → note the indices.
3. **Cut**: `python3 scripts/recording.py cut --job … --drop 12-19,40 [--pause 0.30]`
   Read the `CHECK`. A *vanished* word = the cut ate it (raise `--after`/`--before`); a *remaining* one = a retake
   stayed (`--drop` it). The last list is the **cut indices** — `edit.json` is written with them.
   Pacing: short `--pause 0.25–0.30`; long `0.40–0.50` (breathes more; ~8 cuts/min like the reference long-form).
   Optional: `python3 scripts/recording.py speedup --job … --factor 1.15` for a faster version (same indices).
4. **Media** in `<job>/media/`: screenshots (site, repo, app — **demo account only**, see `brand.md`), photos,
   b-roll, cut-out PNGs for the canvas (`scripts/trim_png.py`). App UI recreated in code: `{"ui": "<screen id>"}` from
   `remotion/src/components/screens/` (ships with `sales-stats`; add your own).
5. **`edit.json`** at the job root (schema in `remotion/src/recorded/types.ts`). Show the plan to the user (what comes
   in on each sentence) before rendering a brand video.
6. **Prepare**: `python3 scripts/prepare.py videos/<brand>/<job> <slug>` → `remotion/public/<slug>/`.
7. **Stills before the render**: `npx remotion still Recorded out.png --props '{"slug":"<slug>","format":"9:16"}' --frame=N`
   on every block, in each delivery format (face cut off? text over the face? captions covering the media?).
8. **Render + finishing** (always through check.py — normalizes loudness and checks the speech):
   `npx remotion render Recorded <job>/render.mp4 --props '{"slug":"<slug>","format":"9:16"}'` →
   `python3 scripts/check.py <job>/render.mp4 --out <job>/final.mp4 --edl <job>/recording/edl.json`
   Look at `final.contact.jpg`. Repeat for `Recorded4x5` (→ `final-4x5.mp4`), `Recorded1x1` or `Recorded16x9` (long).

## edit.json — what to use when (every time reference is a WORD INDEX of edl.json)
| block / key | when | rule |
|---|---|---|
| `title` (serif) | hook and thesis sentences ("AI won't *replace* you") | ≤ 5 words, one word in `*accent*`; hide the captions on those words (`captions.hide`) |
| `title` (sans) | short warning/order ("ALWAYS *REVIEW*") | uppercase, 2 words |
| `split` + `screenshot` | mentioned a site, repo, app, article | comes in on the word that mentions it; 3–10 s; slow `zoom` to what matters (`focus`) |
| `split` + `diagram` | "it does X: A, B and C" | each item on its own word; `done` = word where everything gets a check |
| `split` + `list` | steps, pros/cons | ≤ 4 items |
| `split` + `ui` | the product working | phone rising in the panel; props of the screen, times in s since the block came in |
| `endCard` (`branded: true`) | brand video | dark brand CTA (`logo.svg` in `media/`), `*accent*` in the text |
| `full` + `canvas` (paper background) | long: introducing people/ideas | PNGs without background coming in one by one; short bold title |
| `full` + `steps` (paper) | long: 1–2–3 with a dashed line | `center` = PNG of the person/object |
| `chapter` | long: section break | 2–2.5 s, over darkened b-roll |
| `punches` | keyword with weight | at most one every ~8 s; zoom 0.05–0.08 |
| `captions.style` | `mono` (tech/AI, short), `editorial` (small black box), `minimal`, `impact`, `none` (long) | `highlights` = one word per sentence at most |

Style rules: **one** accent color; transitions only blur + fade; the camera only moves forward inside a segment
(alternating zoom 1.00/1.08 hides the jump cut); every element must be an idea from the speech — if there is nothing to
show, stay on the face. Short: media on screen by the 2nd–3rd second; 15–60 s. Long: canvas/document to explain,
chapters every 2–3 min, captions off.

## Recording tips (pass them on when the user asks)
- Phone horizontal for long, vertical for short; 4K or 1080p, **30 fps**; HDR can stay on (the script converts).
- Leave room above the head and on the sides (square/4:5 and split screen crop). Face in the top third.
- Window light from the side or front; background with depth and little clutter. Lavalier mic > phone mic.
- Made a mistake? Pause 1 s and repeat the whole sentence — `--drop` fixes it; no need to re-record.

## Batches (several videos)
`npx remotion still/render` copies the whole `public/` on every call, which gets slow as it grows. For a batch: copy
only the jobs' material to `remotion/out/pub-<batch>/<slug>/` (+ the library files they use), run
`npx remotion bundle --public-dir=out/pub-<batch> --out-dir=out/bundle-<batch>` once and then
`npx remotion render out/bundle-<batch> Recorded … --props …` (`--timeout=120000`: Google Fonts sometimes load slowly).
Titles: `position: "top"` (over the wall) — in the center they land on the eyes.

## Known gaps
- Text **behind** the person (AI matting) doesn't exist yet — it needs a mask (RVM/MediaPipe on a GPU).
