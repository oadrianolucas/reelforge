---
name: narrated-lesson
description: Produces a narrated 16:9 TRAINING video or full presentation (sales team, onboarding, "explain the whole product") in the elegant brand style — chapter cards, lists that appear on the spoken word, big numbers, a chat mock-up, pricing plans, objections and how to answer them, "what not to promise", and a sign-off. Use for "video to train the team", "narrated presentation", "lesson", "course module", "sales onboarding", "explain the product end to end".
---

# Narrated lesson (16:9)

Code: `scripts/lesson.py` + `remotion/src/lesson/Lesson.tsx` (composition **`Lesson`**, 1920x1080, props `{"slug"}`).
AI cost: voice + music (ElevenLabs credits), plus optional photos (~US$ 0.04 each).

## Flow
1. **Content comes from the real product**, not from an old slide deck: check plans, prices and what is behind a
   feature flag or still unreleased. Anything not shipped goes only into the `caveats` scene.
2. **`script.json`** in the job folder: `title`, `brand`, `voice` (`id`, `model`, `stability` ~0.5, `pronunciation`),
   `music` (`file`), `chapters: [{id, scenes: [...]}]`. Each scene has a `text` (what is said) with `{marker}`s right
   before the word where an element comes in, and the visual fields with `"at": "marker"`.
   - Keep a chapter under ~1,300 characters.
   - Numbers spelled out in the spoken text ("four hundred and eighty dollars"); the visual shows "$480".
   - Scene types and fields (full props in `remotion/src/lesson/Lesson.tsx`):

     | type | fields |
     |---|---|
     | `opening` | `photo`, `label`, `title`, `subtitle`? |
     | `index` | `label`, `title`?, `items: [["Title", "<marker>"], …]` |
     | `chapter` | `photo`, `number`, `title` |
     | `numbers` | `label`, `title`, `items: [{n, label, at}]` |
     | `list` | `photo`, `side: left/right`, `label`, `title`, `items: [{title, desc, at, icon}]` |
     | `quote` | `label`, `lines: [{text, at}]`, `photo`? |
     | `chat` | `label`, `title`, `contact: {name, status}`?, `messages: [{from: user/assistant/ok/team, text, at}]` |
     | `grid` | `label`, `title`, `items: [{title, desc, at, icon}]`, `highlight: {text, at}`? |
     | `steps` | `label`, `title`, `items: [{title, desc, at}]` |
     | `plans` | `label`, `title`?, `items: [{name, price, desc, at, featured?}]`, `badge`?, `period`? |
     | `recommend` | `label`, `title`, `question: {text, at}`, `items: [{profile, plan, at}]` |
     | `objection` | `n`, `question`, `answers: [{text, at}]`, `label`?, `answerLabel`? |
     | `caveats` | `label`, `title`, `soon: {label?, items, at}`, `careful: {label?, items: [{title, desc, at}], at}` |
     | `signoff` | `title`, `site`?, `cta`?, `photo`? |

     Icons are Remix Icon component names (`RiChat3Line`, `RiLineChartLine`, … — see `ICONS` in `Lesson.tsx`).
3. **Photos**: `<job>/web/<name>.jpg`, 1920 px wide — your own, or generated with `scripts/image_openrouter.py`
   using one fixed editorial suffix for all of them (low light, the brand's accent tones, no text) so they match.
4. **Voice**: `python3 scripts/lesson.py voice <job>` (one mp3 per chapter + alignment). Check it by transcript before
   approving and rewrite any sentence the voice gets wrong (gendered greetings, acronyms, foreign names → use
   `voice.pronunciation`). `python3 scripts/lesson.py estimate <job>` builds with estimated timing before the voice exists.
5. **Music**: long, calm instrumental (~96 BPM). ElevenLabs Music (`POST /v1/music`, up to 300000 ms) works; the
   composition loops it with a crossfade.
6. `python3 scripts/lesson.py frames <job> <seconds…>` (one per scene) → review the stills;
   `python3 scripts/lesson.py render <job>` → `final.mp4` (through `check.py`: −14 LUFS, contact sheet).

## Style rules
Same as `elegant-brand`: dark ink background with a soft glow in the brand color, serif titles with an *italic accent*,
small spaced uppercase labels, transitions only crossfade + blur. Captions discreet at the bottom, hidden when the title
already says the sentence (quote, chapter, sign-off). Chapter cards get ~1.6 s of breathing room (the chapter mp3 is
played in two pieces).
