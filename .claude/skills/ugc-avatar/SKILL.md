---
name: ugc-avatar
description: Produces UGC with an AI avatar talking to the camera — an ultra-realistic AI-generated person telling a first-person story with lip-sync, cuts to the app screen, AI b-roll on the metaphors, short captions with the keyword in a colored pill. Use for app/product ads in testimonial format ("AI UGC", "talking avatar", "looks like an influencer", "testimonial", "I tried this app").
---

# UGC with an AI avatar (first-person testimonial)

> **Before generating any scene, music or effect, check `library/catalog.json`** — persona clips already paid for
> (`PersonaShot`), music with mapped beats and SFX. A newly approved clip goes into the library with `shots.json`.

Reference analysis: `docs/reference-analysis.md → AI-avatar UGC`.
The weak spot of this style is the **lip-sync**: hide the mouth with gestures, the product in hand, cuts to the app
screen and b-roll; never leave the face talking for more than ~5 s in a row. Viewers are quick to call on-camera AI
speakers "fake"; if the brand's audience is sensitive to that, prefer `ugc-at-scale` (third-person scenes + narration).

## Person rules (non-negotiable)
- An **original AI-generated** persona, fixed per brand (`brands/<brand>/assets/persona.png`). Never a real person's
  face (not even "looks like"), nor anyone from downloaded reference videos.
- In an ad, the person can't claim to be a real customer with real results that don't exist — use a plausible story
  without invented revenue/health numbers, and follow `brand.md → Rules and restrictions`.

## 1. Script (stop for approval)
- 30–40 s, 3–3.8 words/s, first person. Hooks that work: a wish ("If I had found this app sooner…"), a concrete scene
  with a time ("Two a.m. and I was still answering orders…"), a time promise ("X in 20 seconds").
- Structure: **personal pain** (5–8 s) → "until I found <product>" → **2–3 features with the app screen** → emotional
  benefit → CTA. Mark every sentence: `talking` | `screen` (which) | `b-roll` (metaphor) | `chip` (UI text).
- Cheap A/B variations: same script with another hook or another cut order.

## 2. Persona and voice
- Persona image: `scripts/image_openrouter.py` with the scene prompt template from `CLAUDE.md` (age, hair, clothes,
  a home setting that fits the product, warm light + one accent of the brand color, **holding the product**). Approve.
- Voice: `scripts/voice.py --samples a=<id>,b=<id>` with voices of the same age/accent; the user picks; then the final
  take (voice.py already aligns the words).

## 3. Shots of the person talking
Options (costs in `CLAUDE.md → Tools`; stop and show the cost first):
- **`heygen/avatar-iv`** via `scripts/heygen_speech.py --photo … --audio voice/narration.mp3 --from A --to B --out …`
  (photo + slice of the ElevenLabs narration → lip-sync), ~US$ 0.05/s — the best mouth, and the voice is yours.
  Generate only the `talking` slices; cut them in the middle of a silence.
- **Seedance 1.5 Pro with audio** (`video_openrouter.py --audio`, ~US$ 0.052/s): cheaper, speaks the words, but the
  voice isn't your ElevenLabs voice and non-English speech can come out with a foreign accent. `scripts/swap_voice.py`
  (speech-to-speech) can replace it with your voice while keeping the lip timing — test before relying on it.
- **Gemini Omni** (`scripts/omni_speech.py`, ~US$ 0.10/s): one on-camera line with native voice, faithful face; it
  burns captions into the image (the script crops them).
- **Seedance 1.5 Pro without audio** + narration on top: only for moments where she **doesn't talk** (reacts, shows
  the product, looks at the phone) — never a moving mouth without the matching sound.
Prompt: the persona prompt + second-by-second action with gestures (adjusts the product, lifts it, points).

## 4. App screens and b-roll
- Screens: real screenshots of the client's app (ask for them; demo data only) or recreated in code with fake data;
  shown full-screen in a mock-up (`components/Phone`) with a **title on top and a colored keyword**, or as a
  **floating card** in a corner while she talks.
- AI b-roll (Seedance 1.5 Pro, 4–5 s) only on visual metaphors; on top, a **UI chip** with the data ("Day 3 · Order
  shipped") and, if there's a time, a clock.

## 5. Assembly
There is no dedicated avatar template yet. Two routes that work with what ships:
- **`UgcNarratedJob`** (`scripts/ugc_narrated.py`): register the talking clips as persona shots in the library
  (`shots.json`) and place each one on the narration words it covers; phone screens and overlays come in on their
  words; the full ElevenLabs narration plays underneath (shots are muted, so the lip-synced clip matches).
- **`Recorded`**: join the clips + b-roll into one `raw.mp4` and edit it like a recording (`recording.py transcribe`
  → `cut` → `edit.json` with `split` + `ui`/`screenshot` blocks).
Captions: 2–3 words, lowercase, white, weight 700, lower third; keyword in a **pill in the brand color**
(`Captions` with `maxWords={3}` and `variant="pill"`). Numbered steps as chips ("② where you live") popping in.
A cut every 3.5–8 s, but always something coming in on top (chip, card, new caption). Low, calm music.
Ask the delivery formats (default 9:16 + 4:5; `focus` on the face for the crops). Check stills of every cut in each
format before rendering; `scripts/check.py` on every render.
