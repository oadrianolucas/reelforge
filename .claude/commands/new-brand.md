---
description: Registers a brand in reelforge (visual identity, tone, persona, app) in brands/<slug>/brand.md
argument-hint: <brand name> [website or app URL]
---

Brand: $ARGUMENTS

1. If `brands/<slug>/brand.md` already exists, read it and fill in only what is missing (fields with `?`) — never
   overwrite what is already filled in. Otherwise copy `brands/_template/` to `brands/<slug>/`.
2. **Research before asking**: the website/landing page (colors, fonts, logo, promise, CTA), any docs or knowledge
   base the user points to, and the app itself if there is a demo URL. Extract real hex colors (from the site's CSS or
   the logo), not approximations.
3. Ask the user **only what you couldn't find out**, in a few grouped questions: audience and pain, tone of voice,
   narration language, who the UGC persona is, demo URL and account (credentials go in `.env`, never in `brand.md`),
   screens that sell, restrictions (health, finance, privacy laws), spend cap per video.
4. Fill in `brand.md`. Download the logo into `assets/` if it is public (media is never committed).
5. **Persona** (optional now): propose the description and, once approved, generate the face
   (`assets/persona.png`) with `scripts/image_openrouter.py` (2–3 options, the user picks) and pick the voice on
   ElevenLabs (list voices in the narration language that fit and let the user listen with
   `scripts/voice.py --samples`). Record the cost.
6. Create `brands/<slug>/ideas.md` from the template if it doesn't exist.
7. Finish with a summary of the profile and the list of what is still `?`.
