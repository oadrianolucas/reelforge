---
name: ugc-at-scale
description: UGC factory at scale — scrapes the videos that outperform in the niche (TikTok and Instagram via Apify), Gemini breaks down hook, pacing, takes and script of each one, Claude writes a batch of ~20 scripts from the winning templates, and each one becomes a video with the SAME AI creator (third-person Seedance clips from the library) + ElevenLabs v3 narration straight from text + app screens + captions. Use for "batch of creatives", "20 scripts", "UGC at scale", "what's trending in the niche", "outliers", "ad volume", "make 20 versions of the winner".
---

# UGC at scale: research → breakdown → batch of scripts → serial production

> **Before generating any scene, music or effect, check `library/catalog.json`.** The batch persona is fixed (face +
> voice); every approved clip goes into the library.

## The format that reads as real
- **Several third-person scenes** of the persona (filmed as if by someone else, not looking at the camera, in
  different everyday places) + **a voice narrating on top** (ElevenLabs `eleven_v3` straight from text, the brand's
  voice). As real as possible; a cut every 1.5–3 s.
- In testing, the persona **talking to the camera** (HeyGen lip-sync selfie), the video model's **native speech**, and
  speech-to-speech voice swaps all read as "AI" to viewers. Use them only when the brand accepts that trade-off (see
  `ugc-avatar`, and `batch.py` below for spoken takes).
- **Scenes**: library `library/personas/<persona>/scenes/` — a frame with the persona as **reference** (Nano Banana 2,
  `image_openrouter.py --reference`, keeps the face) → Seedance 1.5 Pro **without audio**, 5 s (~US$ 0.13). Build the
  library once and reuse it across every video in the batch. Ask for long clips (8–12 s) with several actions: each
  one yields several named shots.
- **Assembly**: template `remotion/src/videos/UgcNarrated.tsx` (`UgcNarratedJob`, `UgcNarratedJob4x5`,
  `UgcNarratedJob1x1`). Each video is just a `<batch>/vNN/build.py` using `scripts/ugc_narrated.py` (shots from the
  library by narration word, phone `screen`s over a blurred shot, notification/message `overlays`, end `card`) +
  `vNN/voice/narration.mp3`. `j.publish()` copies what's needed to `remotion/out/pub-<slug>/` and prints the bundle and
  render commands (`--props '{"slug": "<slug>", "format": "9:16"}'`).
- **Visual opening hook**: clips in `library/hooks/hooks.json` (impact must land in the first ~0.8 s; check the
  license of third-party clips). **Hook that becomes a scene** is better — step by step in the `viral-hook` skill.
  Video models can INVENT words: always transcribe and cut with a jump cut.
- **On-camera spoken hook** (one line, then narration): `scripts/omni_speech.py` writes `media/speech.mp4` +
  `media/hook.json`, which `UgcNarrated` plays as the opening.
- **Clip review (mandatory before a clip enters the library)**: a strip of frames at 2 fps with the time written on
  them (`ffmpeg -vf "fps=2,scale=150:-1,drawtext=text='%{pts\:hms}':x=4:y=4:fontcolor=white,tile=10x1"`) and look for
  boxes that disappear or change, objects that deform, a person/hand that vanishes. Record only the clean part in
  `shots.json` (`start`/`end`) — the template slows the clip down so it never runs past `end`. An action that looks
  wrong in reverse (peeling a label ↔ sticking it) can be **reversed** (`ffmpeg -vf reverse`) into a new shot. Avoid
  asking for tape, stacking boxes and couriers handing over parcels: those are the actions that break most.

A **batch** is one job: `videos/<brand>/<YYYY-MM-DD>-batch-<topic>/` with `job.md`, `patterns.md`, `batch.json`
(scripts and takes), `costs.json` and one subfolder per video (`v01/`, `v02/`…).

## 1. Research: what's taking off (Apify, ~US$ 1–2 per run)
- Terms in `brands/<brand>/outliers.json`: hashtags and searches of the **audience** (what the customer watches), not
  of the brand.
- `python3 scripts/outliers.py --brand <brand> [--per-term 60] [--top 50] [--days 120]`
  → `references/outliers/<brand>/<date>/outliers.md` (ranking by outlier factor) + the top `.mp4`s.
- Show the user the top 10 (author, views, factor, caption). A term that brought only noise leaves `outliers.json`.
- Third-party material stays in `references/` (out of git). It's for **structure**: never copy another creator's
  words, face, brand or music.

## 2. Breakdown (Gemini, ~US$ 0.01 per video)
- `python3 scripts/breakdown.py references/outliers/<brand>/<date> --brand <brand>`
  → one `<video>.breakdown.json` per video (literal hook, format, timed takes, pacing, script, template, adaptation)
  + `breakdowns.md` (table).
- Read the breakdowns and write `<batch>/patterns.md`:
  - **winning templates** (5–8): one-line structure with blanks, how many outliers use it, average factor, an example;
  - most frequent **hooks** by type (question, number, counterintuitive, result first, POV);
  - typical **pacing** of the niche (length, average take, words/s, captions, music);
  - what does **not** work (low-factor videos with the same structure).
  Update `formats.md` too if a new format shows up that applies to other brands.

## 3. Batch of ~20 scripts (STOP and ask for approval)
- Distribution: ~4 templates × 5 variations. Vary the **hook** first (it changes results the most), then the angle
  (customer persona, pain), and last the order of the takes.
- Each script: 15–30 s, short spoken sentences, hook in the first 3 seconds, one CTA (`brand.md → Offer and CTA`).
- Respect `brand.md` (tone, banned words, promises). No invented customer numbers: "recovered $X" only with the demo
  account's value or without a value.
- Save them in `batch.json` and in `brands/<brand>/ideas.md` (a section for the batch, 💡). Mark where an app screen,
  overlay or b-roll comes in (that goes into `build.py`, it's not a paid clip).
- The user approves scripts (`"approved": true`) — they may approve part of the batch.

## 4. Fixed persona (once per brand)
- If `brands/<brand>/assets/persona.png` doesn't exist: generate it with `scripts/image_openrouter.py` from
  `brand.md → UGC persona` (selfie 9:16, subject centered with headroom, filming arm out of frame), 2–3 options, the
  user picks. Register it in `library/catalog.json` (`description_prompt`, `setting_prompt`) and copy it to
  `library/personas/<persona>/persona.png`.
- Different settings (car, packing table): one frame per setting **with the same person description**, check the
  face matches, and use it as the scene's first frame.

## 5. Serial production (STOP: paid video)
Per approved video:
1. Missing library shots → frames (`image_openrouter.py --reference`) → show them → with the user's ok, clips
   (`video_openrouter.py --model bytedance/seedance-1-5-pro`) → review → `shots.json`. Start with **one** video and
   show it before releasing the rest of the batch.
2. Narration: `scripts/voice.py` → `vNN/voice/narration.mp3` (+ alignment; the `i:word@time` list gives the indices).
3. `vNN/build.py` (template in the docstring of `scripts/ugc_narrated.py`) → `python3 <batch>/vNN/build.py`.
4. Stills in each delivery format (faces, text over faces), render, `scripts/check.py`.
5. Update `job.md` (status per video, real cost) and `ideas.md` (💡 → ✅ with the link).

**Spoken-takes variant** (the creator says the lines on camera, one clip per take): `scripts/batch.py`.
`batch.json` holds `persona.voice` (an English description of the voice — age, accent, energy — identical in every
take, since the model has no voice id) and per take `line`, `action` (second by second) and an optional `frame`.
`python3 scripts/batch.py estimate --batch <batch>` → cost table; `clips --batch <batch> --video v01` (dry run:
prompts + cost) → ok → `--confirm`; a bad take: delete its `.mp4`, adjust and rerun with `--take t2 --confirm`;
`join` → `v01/raw.mp4`, then the `recorded` pipeline (`recording.py transcribe` / `cut` → `edit.json` → `Recorded`).
Check every take: mouth matches the line? Language right? Voice similar between takes? Extra hand/phone?

## 6. After publishing: winners become 20 versions
- Note views, retention and clicks of each video in `job.md → Results` when the user shares them.
- A winner (top 20% of the batch): **reuse the paid shots** — new hook, other screen/caption/music, other voice cost
  ~0. Make variations as new `vNN` in the batch.
- Rerun `outliers.py` every 2–4 weeks: the history drops what was already seen.

## Reference costs (public prices at the time of writing; check the real ones in `costs.json`)
| Step | Cost |
|---|---|
| Apify (TikTok + Instagram, ~800 raw videos) | ~US$ 1.50–2 |
| Gemini Flash, 50 breakdowns | ~US$ 0.35 |
| Persona (3 Seedream options) | ~US$ 0.10 |
| Library scene (Nano Banana frame + Seedance 1.5 Pro 5 s, no audio) | ~US$ 0.20 |
| Spoken takes, Seedance 1.5 Pro with audio, 20 s per video | ~US$ 0.30–0.60 (`usd_per_s` in `batch.json`) |
| Transcription (Scribe) | cents |
