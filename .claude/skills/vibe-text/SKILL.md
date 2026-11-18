---
name: vibe-text
description: Produces a very short (10 s) "vibe + text" video — an AI person in a selfie enjoying a song with eyes closed, a single take, with the whole testimonial in native TikTok-style text pinned at the top and a list that grows on the beat. Looks like an organic post, no logo or CTA. Use for "organic post", "vibe", "aura farming", "text on screen with music", "minimal", cheap batches of creatives with different characters.
---

# Vibe + text (10 s, no narration)

Composition: **`VibeText`** (`VibeText`, `VibeText4x5`, `VibeText1x1`; props `{slug, format}`), data in
`remotion/public/<slug>/vibe.json`:
`{"clip", "music", "block": [lines], "list": [lines], "listTimes": [s], "duration"?: 10, "adjust"?: {"9:16"|"4:5"|"1:1": {"top"?, "fontSize"?, "focus"?}}}`
— clip and music are files in the same folder.

## Script
- **Block** (4–6 lines of up to ~40 characters, first person, lowercase, the way that person would type, one emoji
  where someone would actually write one): concrete pain → "then I turned on <product>" → how it turned out. The first
  line is the hook.
- **List** (3–4 lines "label: state"): the proof. No result number the brand can't prove.
- No logo, bumper or CTA on screen. In a batch, each video = one feature and one different person.

## Production (~US$ 0.30 per video)
1. Per video: person, setting, block, list, music. Keep them in the job's `script.md` (or a small JSON for a batch).
2. Frame: `scripts/image_openrouter.py --model bytedance-seed/seedream-5-0-lite --aspect 9:16` — selfie, face in the
   middle-low part of the frame, ceiling/wall free in the top third (the text goes there). Check the contact sheet.
3. Clip: `scripts/video_openrouter.py --model bytedance/seedance-1-5-pro --image <frame> --duration 10 --size 720x1280`
   (no audio; eyes closed, enjoying the music, not speaking).
4. Re-encode the clip at constant 30 fps (`ffmpeg -i clip.mp4 -r 30 -an -c:v libx264 -crf 18 clip30.mp4` — some
   model outputs stall the compositor) and compute `listTimes` on the beat grid of the track
   (`scripts/music_beats.py`), then write `vibe.json` into `remotion/public/<slug>/` with the clip and the music.
5. Render each delivery format (`VibeText`, `VibeText4x5`, `VibeText1x1`) and run `scripts/check.py`.
6. For posting, give every video its own folder with a readable name ("Vibe NN - person (feature)").

## Review
Contact sheet of the batch at second 6 and 8.5, in each format: the text may touch the forehead, **never the eyes**.
A person who rises in the frame → `adjust` (`top`/`fontSize`, or `focus` for the crops). No children.
**End before the person relaxes**: Seedance tends to "switch off" the dance around 7–9 s (hands stop, eyes open, face
turns, looks at the camera). Look at the clip every 0.5 s from 5 to 10 s and set `duration` ~0.2 s before that — the
video must end while still vibing (≥ 1.5 s after the last list line).
Music: use **your own** tracks (library, start ~2 s before the drop); commercial music only for tests — it gets muted
or claimed when posted as an ad.
