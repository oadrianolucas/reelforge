# Kettlewick Coffee

> **Fictional example brand** shipped with reelforge so you can try every style without setting up your own.
> Nothing here is a real company. Generate `assets/persona.png` and a logo before rendering (see `assets/README.md`).

## Essence
- **What it is**: a neighborhood specialty coffee shop with an app to order ahead and skip the line.
- **For whom**: commuters and remote workers within walking distance, 22–45.
- **Main pain**: "I want good coffee but I don't have 15 minutes to wait in line before work."
- **Promise / transformation**: order in 3 taps, walk in, grab your cup — 0 minutes in line.
- **Proof**: average pickup ready in 4 minutes; 10th drink free on the loyalty card (fictional numbers).
- **Offer and CTA**: first order 20% off with code FIRSTCUP · "Download Kettlewick" · @kettlewick.coffee
- **Competitors / what they use today**: big chain drive-thrus, office coffee machine.

## Audience and angles
| Customer persona | Pain | UGC angle that works |
|---|---|---|
| Commuter, 28, office downtown | Line eats the morning | "I used to skip coffee to make my train" |
| Remote worker, 34 | Leaves home just for coffee, waits anyway | "My 10-minute break is now 10 minutes" |
| Student, 22 | Price | Loyalty card math: 10th cup free |

## Tone of voice
- **Narration language**: en-US
- **Sounds like**: warm, quick, a bit witty, "you", short sentences.
- **Never sounds like**: corporate ("leverage", "solutions"), barista snobbery.
- **Niche words that build credibility**: single origin, flat white, oat milk, fresh roast.
- **Banned words**: "best coffee in the world", any health claim about caffeine.

## Visual identity
- **Colors** (hex): primary `#C2410C` · secondary `#1C1917` · background `#FAF5EF` · text `#1C1917` · accent `#F59E0B`
- **Fonts**: headings `Fraunces` · body `Inter` (Google Fonts)
- **Logo**: `assets/logo.png` (light version) · `assets/logo-dark.png`
- **Captions**: 2–3 words at a time, white with soft shadow, keyword in the accent color, lower third.
- **Motion**: steam-soft zooms, cups and beans popping on the beat, warm color backgrounds switching on impacts.
- **End card** (2–3 s): logo + "Skip the line." + @kettlewick.coffee over the primary color.
- **AI scene look**: warm morning light, wooden counter, espresso machine, plants, terracotta and cream palette.

## UGC persona (who appears in the video)
- **Who**: Maya, 29, product designer who walks to work.
- **Appearance**: "29-year-old woman, light brown skin, curly shoulder-length dark hair, small gold hoops, no heavy makeup, oversized cream knit sweater, canvas tote bag"
- **Setting**: city sidewalk at 8 am and the coffee shop counter; selfie style, phone in hand.
- **Fixed face**: `assets/persona.png`
- **Voice**: ElevenLabs `voice_id` set `ELEVENLABS_VOICE_ID` in `.env` (pick one with `python3 scripts/voice.py --samples`) · model `eleven_v3` · upbeat, natural speed

## App (for screen recordings)
- **Demo URL**: none — the app screens are recreated in code (Remotion phone mockup).
- **Login**: n/a
- **Demo data**: all fictional.
- **Screens that sell**:

| Screen | Path (clicks) | What it shows / why it sells |
|---|---|---|
| Menu | Home → Coffee | Big photos, 1-tap reorder of "your usual" |
| Order ready | Push notification | "Your flat white is ready ☕" — the payoff moment |
| Loyalty card | Profile → Card | 9/10 stamps — the free cup is one away |

## Rules and restrictions
- No health claims about caffeine; no children in scenes.
- **Spend cap per video**: US$ 3

## Learnings
<!-- dated corrections that apply to every video of this brand -->
