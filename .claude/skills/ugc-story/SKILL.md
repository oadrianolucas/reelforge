---
name: ugc-story
description: Produces a short realistic story video — a character in realistic AI scenes (family at the park, shop owner pushing a cart uphill), an upbeat third-person narrator, app screens recreated inside a phone (chat, dashboard, notification), and one strong visual metaphor. Use for brand/product videos with a story ("a guy who…", "show the app working in real life", "metaphor", "realistic creative video").
---

# Realistic story UGC (AI scenes + app screens)

> **Before generating any scene, music or effect, check `library/catalog.json`** — persona clips already paid for
> (`PersonaShot`), music with mapped beats and SFX. A newly approved clip goes into the library with `shots.json`
> (generate long clips with several actions: several shots for one price).

Template: `UgcNarratedJob` (`UgcNarratedJob4x5`, `UgcNarratedJob1x1`) built with `scripts/ugc_narrated.py` — persona
shots by narration word, phone screens (`remotion/src/components/screens/`), notification/message overlays, end card.

## 1. Script (stop for approval)
- 17–20 s, upbeat third-person narrator ("This is Sam…"), one character, **one clear visual metaphor** (the product
  solves something the scene shows in an exaggerated way). Visual hook in 0–3 s with short on-screen text.
- AI scenes: at most 2 clips (or 1 multi-shot); the rest is app screens and the end card. For each scene write the
  **physical direction** (who is where, which way they move) — that's where AI gets it wrong most.

## 2. AI scenes (stop and show the cost)
- First generate **one frame per shot** (Seedream via `scripts/image_openrouter.py`) that shows the action without
  ambiguity and **check the order in space** (who is higher/closer to the camera, direction of movement, pulling vs.
  pushing) — Seedream often gets this wrong. Only then the video, with the frame as `--image` (separate clips hold
  better than one multi-shot from a single frame). A small/profile character passes the face filters.
- Models: Seedance 2.5 (best, ~US$ 0.23/s) for flagship pieces; Seedance 1.5 Pro (~US$ 0.026/s) for volume;
  Kling 3.0 Pro if Seedance refuses a realistic face as first frame.
- Prompt with the template in `CLAUDE.md`; the same character in every scene (same clothes/hair described word for
  word).

## 3. App screens
Recreated in code with the brand's real tokens (colors, fonts, product copy) and Remix icons; fake data. iPhone-style
notification (`components/Notification`) for results; chat/dashboard inside `components/Phone`. Add your screens to
`PHONE_SCREENS` in `remotion/src/components/screens/index.ts` (ships with `sales-stats`).

## 4. Assembly and check
Narration with `scripts/voice.py`; a sentence wrong after approval → generate only that sentence and splice it
(`scripts/patch_voice.py` + `PatchedNarration`). Minimal captions. Ask the delivery formats (default 9:16 + 4:5) and
set `focus` per shot for the crops. Check stills of every shot in each format (direction, face, text) before the final
render; `scripts/check.py` on every render.
