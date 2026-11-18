---
name: analyze-reference
description: Breaks reference videos (ads, UGC, downloaded reels/TikToks) down into pacing, structure, speech and visual style, and turns that into rules for a reelforge style. Use when the user sends reference videos or links ("analyze this video", "I want it in this style", "here are more references"), before creating a new style, or before writing a script inspired by someone else's video.
---

# Analyze a reference

Reference videos are **third-party material**: they live in `references/` (ignored by git) and are used to understand a
style — never to copy a real person's face, a brand, music or literal text.

## 1. Organize
- Copy each file to `references/<group>/<short-name>.mp4` (group = style or source, e.g. `motion-explosive`,
  `ugc-ai-avatar`). Files with accents/spaces in the name: copy with a simple name.
- If several files are the same video downloaded twice (same duration and transcript), analyze one and say so.

## 2. Measure (script)
```bash
python3 scripts/analyze_reference.py references/<group>/*.mp4
```
For each video it creates `<video>.analysis/` with `analysis.json` (duration, cuts, **cuts/min**, average and longest
shot, words/s, text), `transcript.json` (word by word), `frames/` (one every 0.5 s) and `cuts/` (first frame of each
shot). The cut detector compares frames; on continuous motion design it underestimates (soft transitions don't count
as cuts) — check by looking at the frames.

## 3. Look
Open (Read) the frames in `cuts/` and 8–12 frames spread across `frames/`. Note, with the second:
- **Hook (0–3 s)**: what appears and what is said; why it stops the scroll (price, question, shock, odd scene).
- **Structure**: blocks with timing (hook → problem → turn → proof → offer → CTA).
- **Pacing**: cuts/min, how long one piece of information stays on screen, what changes on each beat.
- **Visual**: colors (approximate hex), typography (weight, case, position), icons, effects (zoom, shake, blur,
  particles, flash), captions (style, words at a time), use of real footage / AI scenes / app screens.
- **Person** (if any): framing, setting, light, wardrobe, whether they talk to the camera (lip-sync), what gives the AI away.
- **Audio**: voice (gender, energy, words/s), music (mood, when it comes in), sound effects.
- **What to copy vs. what to avoid** (e.g. a visible lip-sync glitch is a weak point to design around).

## 4. Deliver
- Write `references/<group>/ANALYSIS.md` with the structure table, the metrics and the notes.
- Tell the user what makes the video work and **which reelforge style** it maps to — an existing one
  (`motion-ad`, `ugc-story`, `ugc-avatar`, …) or a new one (create `.claude/skills/<style>/SKILL.md`, copying the
  structure of an existing style skill).
- General pacing rules that apply to every style go to `formats.md → Pacing`.
