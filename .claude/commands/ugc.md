---
description: Produces a video for a registered brand, from script to final.mp4
argument-hint: <brand> <topic or goal> [style] [length]
---

Request: $ARGUMENTS

Follow the video flow in `CLAUDE.md`, step by step:

1. Pick the **style** (skills table in `CLAUDE.md`) and follow that skill. Read `brands/<brand>/brand.md` (including
   **Learnings**) and `formats.md`. If the brand doesn't exist or something essential for the request is missing
   (persona, app, colors), say what is missing and suggest `/new-brand`.
2. If there is already a job for this topic in `videos/<brand>/` with an unfinished `job.md`, continue from it.
   Otherwise create `videos/<brand>/<YYYY-MM-DD>-<topic>/job.md` with the request.
3. Write `script.md` with 2 alternative hooks and the estimated cost. **Stop and ask for approval.**
4. Once approved: capture the screens (demo account only), generate the voice, generate the scene/avatar images —
   **stop and show the images and the cost of the AI videos** — generate only the approved ones, assemble.
5. Before the final render, **ask the delivery formats** (suggest `final.mp4` 9:16 1080x1920 for Reels/Stories and
   `final-4x5.mp4` 1080x1350 for the feed; `final-1x1.mp4` only on request). Run every render through
   `scripts/check.py`.
6. Deliver with: length, total cost, 3–4 key frames to review, and what can still be adjusted. Update `job.md` and
   mark the idea as produced in `brands/<brand>/ideas.md`.
