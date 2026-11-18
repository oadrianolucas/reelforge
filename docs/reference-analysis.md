# Reference analysis

How the styles in this repo were derived. Metrics come from `scripts/analyze_reference.py` (each video gets a
`<video>.analysis/` folder). The reference videos are third-party material — they stay out of git and are not named
here; this document keeps only the transferable findings.

| Group | Length | Cuts/min | Average shot | Speech | Became the style |
|---|---|---|---|---|---|
| AI-avatar UGC ads (app for parents), 4 videos | 31–41 s | 6–13 | 4–8 s | 3.2–3.9 words/s | `ugc-avatar` |
| AI-avatar UGC, tutorial variation ("X in 20 seconds") | 35 s | 16 | 3.5 s | 3.1 words/s | `ugc-avatar` |
| Music-only app showcase | 19 s | **41** | 1.35 s | — | `app-showcase` |
| Explosive motion ads, 2 videos | 44–47 s | **36–37** | 1.6 s | 3.0–3.6 words/s | `motion-ad` |
| Supermarket TV offers (16:9) | 194 s | 7 (but a new product every ~4 s) | — | 3.2 words/s | `retail-offers` |
| Selfie in a car with music | 12 s | 0 | — | — | persona style reference only → `vibe-text` |

## AI-avatar UGC
The weak spot is the mouth: lip-sync glitches are what viewers notice first.
- **Person**: a woman in her thirties talking to the camera (lip-sync), selfie or locked-off camera; a home setting
  that fits the product; she **holds the product** and handles it while talking — the gesture hides the mouth.
- **Hook**: a first-person wish or a concrete scene with a time ("If I had found this app sooner…", "Two a.m., …",
  "X in 20 seconds").
- **Structure**: personal pain (5–8 s) → "until I found X" → 2–3 features with the **app screen** → benefit → CTA.
- **App screen**: full-screen (real screenshot) OR a **floating card** in a corner while she talks; an iPhone mock-up
  with a serif title on top and the keyword in color.
- **AI b-roll** on the metaphors (late night → woman in bed with the phone, a clock) with a **UI chip** on top.
- **Captions**: 2–3 words, lowercase, white, weight 700, lower third; the keyword in a **pill** in the brand color.
  Numbered steps as chips.
- Pacing: a new shot every 3.5–8 s, but something always comes in on top (chip, card, caption).
- The same script with two different cut orders was used as an A/B pair — a cheap variation.

## Music-only app showcase
Logo out of a gradient → app UI in 3D perspective with zoom and shine → main button pulsing → phone in the center with
niche items **flying around it**; 41 cuts/min, no narration, strong beat.

## Explosive motion ads
One idea per beat (1.6 s), background changing color, giant word, icons in squares, counters, notifications,
particles; a single AI scene with a person at the turn of the story. The full rule set is in `formats.md → Pacing`.

## Supermarket TV offers
- 16:9, light background with rays, **logo** in the top corner, **QR code** on the side.
- Each offer: cut-out **product photo** + **name and size** + **giant yellow price with an outline** (smaller cents,
  "each") with a "special price" badge.
- Fast, upbeat voice-over reading product + price; a new product every ~3–5 s; a logo bumper with food at the end.
