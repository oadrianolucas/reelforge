---
name: app-showcase
description: Produces a music-only app/site showcase (no narration) — logo out of a gradient, app screens in 3D perspective with zoom and shine, pulsing main button, phone in the center with objects flying around it, cuts every ~1.4 s on the beat. Use for app, SaaS, e-commerce or game launches ("app video", "show the screens", "launch video", "no voice-over", "music only").
---

# App showcase (music-only motion)

Template: the **`AppShowcase`** composition (`AppShowcase`, `AppShowcase4x5`, `AppShowcase1x1`; props `{slug, format}`),
data in `remotion/public/<slug>/showcase.json`. Free example: `python3 scripts/example.py example-coffee/app-showcase --render`
(source in `examples/example-coffee/app-showcase/`).
No narration and no AI scene: AI cost is zero. What sells is rhythm + good-looking screens + flying objects.
Reference: `docs/reference-analysis.md → App showcase`.

## 1. Input
- Real screenshots of the main screens (3–6) or access to a **demo** account; logo; brand color; the main action (the
  button that matters: "Buy", "Open", "Start"); one CTA line.
- Screens can also be recreated in code with the brand tokens and fake data (crisper than screenshots).

## 2. Music first
Pick the track (from the user or the library) and run `python3 scripts/music_beats.py <track.mp3>`; the whole video is
cut on the beats (`onsets`): each shot lasts 2–3 beats (~1–2 s).

## 3. Assembly
- Opening: logo emerging from a brand-color gradient with a shine sweeping across (2 beats).
- Screens in **3D perspective** (CSS `perspective` + `rotateX/rotateY`) with slow zoom and reflection; one shot per
  screen, highlighting the key element with a brand-color glow/outline.
- Main button **pulsing** on the beat (`pulseOnBeat`) and being "tapped" (cursor/tap + `Shockwave`).
- Climax: phone (`components/Phone`) in the center with niche objects **flying around it** (`Explosion` with Remix
  icons, cut-out products, bills/coins) + `Grain`.
- Closing: logo + one-line CTA. Minimal text (2–4-word titles only, `Giant` fits the width).
- Ask the delivery formats (default 9:16 + 4:5; 1:1 on request). Check stills of every shot in each format, then
  render and run `scripts/check.py`.
