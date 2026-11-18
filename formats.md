# UGC formats

Pick the format from the goal of the request. All of them: 15–40 s, hook within 3 s, a single CTA. Delivery formats are
asked before the final render (default 9:16 + 4:5 from the same material; 1:1 on request).

| Format | Structure | When to use |
|---|---|---|
| **Pain → solution** | hook with the pain (persona) → "then I found X" → 2–3 app screens solving it → result → CTA | conversion ad, the default |
| **POV** | text "POV: you're a dentist and nobody confirms appointments" → scenes of the situation → app screen → relief | top of funnel, organic |
| **I tried this app** | curious/skeptical persona → demo on screen → reaction → verdict | proof, skeptical audience |
| **Quick tutorial** | "how I do X in 30 s" → step by step on screen with zoom → result | a specific feature, retargeting |
| **Before / after** | chaos (notebook, spreadsheet, overflowing chat) → the same task in the app | comparison with today's alternative |
| **3 reasons** | "3 things that changed after…" → one reason per screen | lists, carousel-as-video |

## Hooks (first 3 s)
- A question the customer asks themselves ("Do your patients also vanish without notice?")
- A concrete number ("I lost 8 appointments in one week")
- Counterintuitive ("I stopped messaging my customers")
- Show the result first, then go back ("This happened on its own")

Lead with the benefit, not only the price: an ad that only says "free" tends to underperform; keep the offer for the CTA.

## `script.md` format

```markdown
# <topic> — <format> · ~<length> s
Alternative hook A: ...
Alternative hook B: ...

| # | Time | Line (persona/narrator) | Screen | Motion note |
|---|---|---|---|---|
| 1 | 0–3 s | "Do your patients also vanish without notice?" | persona selfie | punch-in on the question |
| 2 | 3–8 s | "I used to lose about 8 appointments a week." | AI scene: empty schedule | — |
| 3 | 8–15 s | "Then I started using <product>..." | app: Schedule → confirm | zoom on the Confirm button |
| … | | | | |
| n | end | CTA | brand end card | logo + handle |

Estimated cost: voice US$ x · images US$ x · AI video US$ x · total US$ x (cap US$ 3)
```

Screen is one of: `persona` (talking, lip-sync), `app: <screen from brand.md>`, `AI scene: <description>`,
`library: <persona:shot>`, `brand end card`. Prefer an app screen over an AI scene: cheaper and more convincing.

## Pacing (learned from reference ads)

The references that perform **never leave the screen still for more than ~1 s**:
- **one idea per beat (0.5–1.2 s)**: on every keyword something new comes in — a big word, an icon, a number, an object;
- **the background changes color with each idea** (brand palette + 1–2 contrast colors), sometimes black ↔ white;
- **kinetic typography**: the keyword giant, the rest small above/below; it comes in with a punch, motion blur or a
  mask; a drawn underline/highlight; a box behind the word;
- **icons inside rounded squares** (Remix Icon), counters going up, notification badges;
- **particles/confetti/currency signs** on the moments of gain; concentric rings pulsing on moments of tension;
- **at most one AI scene** (the one with the most impact: turn, proof, reaction); the rest is motion;
- **a sound effect on each change** (whoosh, pop, click, ding), constant upbeat music underneath.
A 3–5 s scene with no change at all = a video that feels "thrown together". If the AI scene is long, put text/zoom/a cut on top.

Ready-made pieces in `remotion/src/motion/beats.tsx`:
`Beat` (background with light and grid, continuous zoom/rotation, whip in and out, `impact` = flash + shake),
`Giant` (cascading letters, **always fits the width** via `fitText`), `Highlighter`, `IconTile` (icon in a square),
`Cross`, `Rings`, `Rain`, `Sparkles`, `Counter`, `Grain`, `Bill` (money), `ChartArrow` (rising chart + an arrow that
bursts into money — use it on "sell more"), `Camera` (zoom in/out by keyframes — e.g. close in on the chart arrow,
follow the burst and open back; compute the point from the real layout). Tie the beats to the **words** of the
alignment (indices), not to fixed seconds — the same edit then works with another voice.

**Video inside a phone** (demo): show the whole video (`objectFit: contain`) over a blurred copy, playing from the first
frame; phone + badges form a centered block that fits entirely on screen.
**Text must never be cut off**: no fixed width on a giant word; icon + big word go stacked, not side by side.
**Clean motion text**: no grain, stroke or filter on titles; check consecutive frames zoomed in on the preview.
