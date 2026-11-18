# Library — assets paid for once, reused in every video

**Before generating any image, video, music or sound effect, look here** (`catalog.json`). Anything that costs API
money (a persona clip, a persona image, a music track) goes into the library as soon as it is approved, catalogued —
and the next videos vary **script, voice, music, animation and colors** while reusing the same clips.

```
library/
  catalog.json                   ← index of everything (personas, music with mood/license, sfx with usage, hooks)
  personas/<id>/
    persona.png                  ← reference image (first frame / reference for new clips of the same person)
    scenes/clips/<clip>.mp4      ← generated videos (paid)
    shots.json                   ← each clip cut into named SHOTS: {"shots": [{"id", "clip", "start", "end", "action", "framing"}]}
  music/<id>.mp3 + <id>.beats.json
  music/commercial/              ← third-party tracks (ignored by git; rights warning for paid ads)
  sfx/<id>.mp3                   ← the templates expect whoosh, pop, chime, ding
  hooks/hooks.json + clips       ← visual opening hooks (skill viral-hook); third-party clips go in hooks/third-party/
```

## catalog.json

Starts empty: `{"personas": [], "music": [], "sfx": [], "hooks": []}`. Suggested entry shapes:

```json
{
  "personas": [{"id": "maya-baker", "folder": "personas/maya-baker", "image": "persona.png",
                "description_prompt": "woman in her late 20s, …", "setting_prompt": "small bakery at dawn, …",
                "origin": "100% AI-generated (model names)", "shots": "personas/maya-baker/shots.json", "used_in": []}],
  "music":    [{"id": "upbeat-house", "file": "music/upbeat-house.mp3", "duration_s": 62, "mood": "upbeat",
                "beats": "music/upbeat-house.beats.json", "license": "generated with ElevenLabs Music", "used_in": []}],
  "sfx":      [{"id": "whoosh", "file": "sfx/whoosh.mp3", "use": "transition / beat entrance"}],
  "hooks":    [{"id": "ladder-fall", "file": "hooks/ladder-fall.mp4", "license": "own / source + terms"}]
}
```

No script parses `catalog.json` — it is the index Claude reads before spending. The files the code reads are
`personas/<id>/shots.json`, `music/<id>.beats.json` and `hooks/hooks.json`.

## Using it in Remotion
`python3 scripts/prepare.py` mirrors the library into `remotion/public/library/`. In code:
```tsx
import { PersonaShot } from "../library/PersonaShot";
<PersonaShot shot={shot} />            // plays the right slice of the clip, muted (shots come from loadShots/findShot)
```
Music: `staticFile("library/music/upbeat-house.mp3")` + beats from `…/upbeat-house.beats.json`
(`python3 scripts/music_beats.py library/music/upbeat-house.mp3`). In `UgcNarratedJob` scripts, refer to a shot as
`"name"` (default persona) or `"persona:name"`.

## Rules
- New clip of an existing persona: generate it from `persona.png` with the catalog's `description_prompt` +
  `setting_prompt` (same person), as a **long clip with several actions** (8–12 s) — several shots for one price. Cut
  it into shots in `shots.json` (only the clean parts) and record the cost.
- A persona is always **AI-generated** and original. Never a real person's face.
- No library media goes to git (only `catalog.json`, `shots.json`, `.beats.json`, `hooks.json` and text); the files
  stay on your disk. Commercial music and third-party hook clips: warn about rights when the video is a paid ad.
