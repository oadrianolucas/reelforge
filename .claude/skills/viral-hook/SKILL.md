---
name: viral-hook
description: Opens an ad/UGC video with a high-impact VISUAL HOOK clip (a fall, a slip, an explosion, a sledgehammer — a library of short pattern-interrupt clips) that turns into a scene — the brand persona appears in the SAME place and says a bridge line tying the mishap to the product's pain, then the video continues. Gemini watches each hook, picks the best one per video and writes the bridge; Nano Banana puts the persona in the scene; Veo 3.1 speaks the line; the transcript cuts any invented word. Use for "viral hook", "hook", "pattern interrupt", "open with an impact clip", "start with a fall/scare".
---

# Viral hook that becomes a scene

Works with the narrated UGC template (`UgcNarratedJob*`, skill `ugc-at-scale`): each video is a
`<batch>/vNN/media/script.json` built by `scripts/ugc_narrated.py`, and the opening comes from `vNN/media/hook.json`.
**Never use a hook with children**, and check the background of the continuation frame for them too.

## Why it is built this way
- A hook dropped at the start with the narration on top **doesn't make sense** to viewers → the hook plays **alone**
  (with its own sound) and the story continues **in the same scene**, with a character reacting to it. Fade only when
  there is no continuation.
- The bridge line is written from what **actually happens** in the clip (the model watches it), not guessed from the
  file name — clip names are often misleading.
- A pricier model is justified here: the first second decides the ad (Veo 3.1 Fast ~US$ 0.60 per video).

## 1. Hook library — `library/hooks/hooks.json`
- Clips live in `library/hooks/` (media never goes to git). **License**: check the terms of any third-party hook clip;
  many hook collections don't state them. Warn the user before using one in a paid or client ad.
- Review a new hook at **4 frames/s** with the timestamp burned in, and approve it only if: the impact really happens
  and lands ≤ 0.9 s after `start`; vertical without letterbox; no burned-in text/emoji/watermark; no celebrity or
  identifiable creator handle. Move rejects to a `_rejected/` folder and note why.
- Entry: `{"id", "file", "start", "end", "theme"}`. `python3 scripts/hooks.py analyze` → Gemini watches each new hook
  and writes `description` (action, emotion, impact time, business metaphors). Cents.

## 2. Hook + bridge line per video
- `python3 scripts/hooks.py bridges --batch videos/<brand>/<batch> v02 v03 … [--language "<narration language>"]` →
  `vNN/media/hook.json` = `{hook, bridge, why}`. Gemini reads each video's narration and picks a hook (each one at most
  3 times per batch).
- **Review the bridges**: ≤ 12 words, spoken, with humor/provocation, no risky claim (models do suggest things like
  legal threats).

## 3. Hook that becomes a scene (per video)
1. `python3 scripts/hook_continue.py --batch <batch> --video vNN --persona <persona-id>` → last frame of the hook +
   Nano Banana puts the persona in the foreground **in the same place** (`vNN/continuation/frame.png`, ~US$ 0.07).
   **Check**: the hook's setting and people still there, the persona's face, no text/logos. Delete the png and rerun
   if needed.
2. With the user's ok, the same command with `--confirm` → Veo 3.1 Fast (6 s, native speech) → transcribe → **every
   word the model invented is cut with a jump cut** (it has inserted profanity mid-sentence before) → checked again →
   `vNN/media/speech.mp4` + `speech.transcript.json` and `hook.json → continuation`.
3. The narration goes back to the copy **without** the bridge (the character already said it): regenerate
   `voice/narration-tags.txt` → `scripts/voice.py`.
4. Rebuild the video with `build.py` (the script gains `opening`: hook + continuation), `scripts/prepare.py`, render,
   `scripts/check.py`.

**Transformation variant** (`--transform`): the camera pushes in on the hook's person and they **turn into** the
persona. The frame shows the persona IN PLACE of that person (same pose/object, closer); Veo gets first + last frame
(`video_openrouter.py --last`) and makes a whip with a spin (~US$ 0.32–0.40); `--transition-cut 1.8` removes the dead
time where they stand still before speaking. Needs a hook with ONE sharp, full-body person at the end (a sledgehammer
swing works; a box tipping over doesn't — blurred, face hidden). Check the last frames of every hook before choosing.

**On-camera alternative**: `scripts/omni_speech.py` makes the persona say one line straight to camera (Gemini Omni,
native voice, ~US$ 0.10/s) and writes the same `hook.json` (hook `null` + continuation).

Without a continuation (cheaper): the hook plays alone, fades to black, and the narration starts with the bridge
(`[sarcastic] …`) over a reaction shot.

## Template (already in `remotion/src/videos/UgcNarrated.tsx`)
`script.opening = {file, start, dur, continuation?: {file, dur, captions}}` → hook (hard cut if there is a
continuation, fade otherwise) → continuation with its own audio and captions from the transcript → fade → content.
The total duration adds everything up (`calculateUgcNarratedMetadata`).

## Costs (per video, public prices at the time of writing)
| Step | US$ |
|---|---|
| Hook analysis + bridges (whole batch) | ~0.06 |
| Persona-in-scene frame (Nano Banana 2) | 0.07 |
| Speech in the scene (Veo 3.1 Fast, 6 s, with audio) | 0.60 |
| Transformation (Veo 3.1 Fast, first + last frame, 4 s) — only with `--transform` | 0.32–0.40 |
| Narration without the bridge | ElevenLabs credits |
