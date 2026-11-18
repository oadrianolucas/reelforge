---
name: motion-ad
description: Produces an explosive motion-design ad — giant kinetic typography, background changing color on every beat, icons, price counters, coin/confetti explosions, pulse on the music beat, upbeat narration and at most one cheap AI scene. Use for offer, service or small-business product ads ("animated video", "motion ad", "dynamic ad", "with explosions", "price promo video", low-cost ads made in volume).
---

# Explosive motion ad

> **Before generating any scene, music or effect, check `library/catalog.json`** — persona clips already paid for
> (`PersonaShot`), music with mapped beats, and SFX. A newly approved clip goes into the library with `shots.json`
> (generate long clips with several actions: you get several shots for one price).

Template: the **`MotionAd`** composition (`MotionAd`, `MotionAd4x5`, `MotionAd1x1`; props `{slug, format}`), data in
`remotion/public/<slug>/ad.json`. A free working example: `python3 scripts/example.py example-coffee/motion-ad --render`
(source in `examples/example-coffee/motion-ad/`). Pacing rules: `formats.md → Pacing`.
Target AI cost: **≤ US$ 0.50 per video** (voice, music and SFX come out of ElevenLabs credits).

## 1. Script (stop for approval)
- Read `brands/<brand>/brand.md` (including **Learnings**) and `formats.md`.
- 25–32 s, ~70–85 words, second person, short sentences. Structure that works:
  **price/shock hook** → objection ("sounds impossible?") → how it works in 2–3 beats → **proof** (one AI scene or
  stacking notifications/orders) → burst of niches/benefits → "sell more" → short CTA.
- Don't sell only the price: lead with the benefit, keep the offer for the CTA.
- Write the narration with eleven_v3 tags (`[excited]`, `[curious]`, `[laughs]`) and a table
  **beat × anchor word × visual × effect × sound**. Each beat 0.5–1.5 s. Save it to `script.md` in
  `videos/<brand>/<YYYY-MM-DD>-<topic>/`, create `job.md`, and add the idea to `brands/<brand>/ideas.md`.
  **Stop and ask for approval.**

## 2. Voice and music
```bash
python3 scripts/voice.py --text-file videos/<brand>/<job>/voice/narration-tags.txt --out videos/<brand>/<job>/voice/samples \
  --samples a=<voice_id>,b=<voice_id>,c=<voice_id>          # the user listens and picks
python3 scripts/voice.py --voice <voice_id> --text-file .../narration-tags.txt --out videos/<brand>/<job>/voice/narration.mp3
python3 scripts/music_beats.py videos/<brand>/<job>/music/track.mp3   # onsets → the video pulses on the beat
```
`eleven_v3` with stability 0 gives the most energetic read. Two voices = two versions for an A/B test (same edit).
Music: a track the user provides (warn that commercial tracks can be muted in paid ads) or one from the library.

## 3. Assembly (Remotion)
- Fill `ad.json` (look at the example for the schema). **Tie beats to words** (the `i:word@time` list printed by
  `voice.py`), never to fixed seconds — the same edit then works with another voice.
- Building blocks in `remotion/src/motion/beats.tsx`: `Beat` (background + light + grid, whip in/out, `impact` =
  flash and shake), `Giant` (cascading letters, always fits the width), `Highlighter`, `IconTile` (Remix icon in a
  rounded square), `Cross`, `Rings`, `Rain`, `Counter`, `Sparkles`, `Explosion` + `Coin`/`Confetti`/`Bill`,
  `Shockwave`, `ChartArrow`, `Grain`, `Camera`, `pulseOnBeat`. Icons: `@remixicon/react` (never emoji as an icon).
- Effects per beat type: price → `Counter` + coin `Explosion` + `Shockwave` + `Sparkles` + coins/boom sound;
  objection → shaking `Giant` + `Rings` + `Shockwave`; niches/benefits → own background color + icon + mini icons
  bursting; proof/sales → stacking notifications + rising badge + confetti; CTA → logo + one line + confetti.
- Copy the job material to `remotion/public/<slug>/` with `python3 scripts/prepare.py videos/<brand>/<job> <slug>`.

## 4. AI scene (optional, one only — stop to approve the cost)
Storyboard frame with `scripts/image_openrouter.py` (~US$ 0.035) using the **scene prompt template** in `CLAUDE.md`;
clip with `scripts/video_openrouter.py --model bytedance/seedance-1-5-pro --size 720x1280 --duration 5` (~US$ 0.13, no
audio). `AiScene` shows the storyboard image while the `.mp4` doesn't exist, so the preview can be approved first.

## 5. Check before delivering
Render stills (`npx remotion still MotionAd out.png --props '{"slug":"<slug>","format":"9:16"}' --frame=N --scale=0.3`)
of **every beat in every delivery format** and look: no text cut off or touching the edge; nothing still for more than
~1 s; icon and big word stacked (not side by side); AI scene face visible in the square/4:5 crop; readable CTA.
Ask the delivery formats before the final render (default 9:16 + 4:5). Render, run `scripts/check.py`, update `job.md`
(status + real costs). **Client work**: send the watermarked preview first —
`python3 scripts/approval_preview.py videos/<brand>/<job>/final.mp4 videos/<brand>/<job>/final-4x5.mp4` → `*-PREVIEW.mp4`;
the clean final only after approval/payment. Tell the user what you did not check (e.g. the full audio).
