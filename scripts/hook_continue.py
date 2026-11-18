#!/usr/bin/env python3
"""Hook that becomes a scene: the persona appears IN THE SAME PLACE as the visual hook and says the bridge line (skill viral-hook).

usage:
  python3 scripts/hook_continue.py --batch videos/<brand>/<batch> --video v20 --persona <persona-id> \
      [--line "Almost checked out... then saw the shipping fee and took that fall."] [--language "Brazilian Portuguese"] [--confirm]

Reads <batch>/<video>/media/hook.json (written by scripts/hooks.py: hook + bridge; --line replaces the bridge).
1. last frame of the hook (at the `end` in hooks.json) → <video>/continuation/hook-last.png
2. Nano Banana 2 with the frame + library/personas/<persona>/persona.png → frame.png (same scene, persona in the
   foreground reacting to what happened in the hook)                                       ~US$ 0.07
   Without --confirm it STOPS here: check the frame (same scene? the persona's face? text/brands?).
3. --confirm: Veo 3.1 Fast image-to-video 6 s with the persona SAYING the bridge (native audio)       ~US$ 0.60
4. transcribes (ElevenLabs Scribe) and compares with the requested line: a word the model INVENTED (it has sworn before)
   is cut with a jump cut; writes <video>/media/speech.mp4 + speech.transcript.json and adds `continuation` to hook.json.
--transform: instead of the persona appearing NEXT TO it, the camera pushes in on the hook's person and they TURN INTO
   the persona (frame.png = persona in their place, closer; Veo 3.1 Fast with first + last frame, 4 s, ~US$ 0.40). The
   transition goes before the speech in the same speech.mp4. Needs a hook with a sharp, full-body person at the end.
Then: build the video (the narration must be the copy WITHOUT the bridge — the character already said it) and render.
"""
import argparse, difflib, json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(__file__))
from recording import ROOT, audio_for_upload, ff, rel, transcribe_audio  # noqa: E402

CATALOG = os.path.join(ROOT, "library", "hooks", "hooks.json")
norm = lambda t: re.sub(r"[^\w]", "", t.lower())


def run(cmd):
    r = subprocess.run([sys.executable, *cmd], capture_output=True, text=True, cwd=ROOT)
    line = (r.stdout.strip().splitlines() or [""])[-1]
    if r.returncode or "cost_usd" not in line:
        sys.exit(f"failed: {(r.stderr or r.stdout)[-400:]}")
    return json.loads(line)


def clean_segments(words, line):
    """Aligns what was said with what was asked. Returns (segments to keep in s, cut words, kept words):
    an extra word between two very close segments (< 0.25 s — a stutter) stays, because cutting would give a visible
    jump; an invented word with its own room (e.g. a swear word) goes out with a jump cut."""
    said = [norm(w["text"]) for w in words]
    asked = [norm(t) for t in line.split() if norm(t)]
    sm = difflib.SequenceMatcher(a=said, b=asked, autojunk=False)
    keep, extras_between = [], []
    pending = []
    for op, a1, a2, _, _ in sm.get_opcodes():
        if op == "equal":
            keep.append((words[a1]["start"], words[a2 - 1]["end"]))
            extras_between.append(pending)
            pending = []
        elif op in ("replace", "delete"):
            pending += [words[i]["text"] for i in range(a1, a2)]
    cut, kept = list(pending), []  # whatever is left after the last equal segment is cut
    joined = []
    for (a, b), extra in zip(keep, extras_between):
        a, b = max(0, a - 0.12), b + 0.18  # margin so the start/end of words isn't eaten
        if joined and a - joined[-1][1] < 0.1:  # with the margin the segments touch: cutting would skip a frame
            joined[-1] = (joined[-1][0], b)
            kept += extra
        else:
            cut += extra
            joined.append((a, b))
    return joined, cut, kept


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--batch", required=True)
    ap.add_argument("--video", required=True)
    ap.add_argument("--persona", required=True)
    ap.add_argument("--line")
    ap.add_argument("--language", default="Brazilian Portuguese", help="language the persona speaks in")
    ap.add_argument("--confirm", action="store_true", help="generate the speaking video (paid, ~US$ 0.60)")
    ap.add_argument("--transform", action="store_true", help="zoom on the hook's person, who turns into the persona (+~US$ 0.40)")
    ap.add_argument("--transition-cut", type=float, default=1.8,
                    help="seconds of the transition to keep: Veo reaches the persona in ~1.5 s and then she stands still (dead time)")
    a = ap.parse_args()

    folder = os.path.join(a.batch, a.video)
    hj = os.path.join(folder, "media", "hook.json")
    g = json.load(open(hj))
    line = a.line or g["bridge"]
    hook = next(h for h in json.load(open(CATALOG))["hooks"] if h["id"] == g["hook"])
    cont = os.path.join(folder, "continuation")
    os.makedirs(cont, exist_ok=True)
    last, frame = os.path.join(cont, "hook-last.png"), os.path.join(cont, "frame.png")

    if not os.path.exists(last):
        ff(["-y", "-v", "error", "-ss", f"{hook['end'] - 0.05:.2f}", "-i", rel(os.path.join(ROOT, "library", "hooks", hook["file"])),
            "-frames:v", "1", "-vf", "scale=720:1280:force_original_aspect_ratio=increase:flags=lanczos,crop=720:1280", rel(last)])
    if not os.path.exists(frame):
        action = (hook.get("description") or {}).get("action", hook["theme"])
        if a.transform:
            ask = ("Create a frame from the SAME handheld phone video a moment later, after the camera has pushed in closer: keep the "
                   "SAME place, background, objects, debris and lighting from image 1. The person from image 1 is gone: in exactly "
                   "their spot, in the same pose and holding the same object, now stands the person from image 2 (keep their identity "
                   "exactly: face, hair, clothes, accessories), medium shot from the waist up, looking into the camera with an ironic "
                   "half-smile, about to speak.")
        else:
            ask = ("Create the NEXT moment of the SAME handheld phone video: keep the SAME place, background, objects, lighting and "
                   "any people from image 1 exactly where they are. Add the person from image 2 (keep their identity exactly: face, "
                   "hair, clothes, accessories) in the foreground, medium shot from the waist up, half-turned to the camera, reacting "
                   "to what just happened behind them with an ironic half-smile, about to speak to the camera.")
        r = run(["scripts/image_openrouter.py", "--model", "google/gemini-3.1-flash-image", "--reference", last,
                 "--reference", os.path.join(ROOT, "library", "personas", a.persona, "persona.png"), "--out", frame, "--prompt",
                 f"Image 1 is the last frame of a real phone video ({action}). Image 2 shows a person. {ask} Realistic vertical 9:16 smartphone video frame, natural "
                 "light, subtle phone-camera noise, slightly muted colors. No text, no logos, no brand names, no watermark, no extra fingers."])
        print(f"frame: {os.path.relpath(frame, ROOT)} (US$ {r['cost_usd']})")
    if not a.confirm:
        print(f"Check the frame and run again with --confirm (Veo 3.1 Fast, ~US$ 0.60). Line: \"{line}\"")
        return

    trans = os.path.join(cont, "transition.mp4")
    if a.transform and not os.path.exists(trans):
        r = run(["scripts/video_openrouter.py", "--model", "google/veo-3.1-fast", "--image", last, "--last", frame,
                 "--duration", "4", "--size", "720x1280", "--out", trans, "--prompt",
                 "Realistic vertical 9:16 handheld smartphone video. The camera quickly pushes in toward the person, and as it moves "
                 "in, the person seamlessly morphs into the person of the last frame, in one continuous shot, same place, same light, "
                 "same object in hand. Smooth, natural, no cuts, no flash, no text, no logos, no extra fingers."])
        print(f"transition: US$ {r['cost_usd']}")
    raw = os.path.join(cont, "speech-veo.mp4")
    if not os.path.exists(raw):
        r = run(["scripts/video_openrouter.py", "--model", "google/veo-3.1-fast", "--image", frame, "--duration", "6",
                 "--size", "720x1280", "--audio", "--out", raw, "--prompt",
                 "Realistic vertical 9:16 handheld smartphone video continuing the same moment and place. Everything in the "
                 "background stays as in the first frame. The person in the foreground looks into the camera and says, in natural "
                 f"{a.language} with a native accent, casual and amused, ONLY these words and nothing else: "
                 f"\"{line}\" Small natural head movements and gestures, slight handheld sway, ambient sound of the place, no music. "
                 "Natural skin texture, subtle phone-camera noise. No text, no subtitles, no logos, no extra fingers."])
        print(f"veo: US$ {r['cost_usd']}")
    mp3 = os.path.join(cont, "speech-veo.mp3")
    audio_for_upload(raw, mp3)
    words = transcribe_audio(mp3, os.path.join(cont, "speech-veo.transcript.json"))
    keep, cut, kept = clean_segments(words, line)
    print("said:", " ".join(w["text"] for w in words))
    if cut:
        print("! invented (cut with a jump cut):", " ".join(cut))
    if kept:
        print("short stutter (kept — cutting would give a visible jump):", " ".join(kept))

    final = os.path.join(folder, "media", "speech.mp4")
    filt, labels = "", ""
    for k, (x, y) in enumerate(keep):
        filt += (f"[0:v]trim={x:.3f}:{y:.3f},setpts=PTS-STARTPTS[v{k}];"
                 f"[0:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={max(0, y - x - 0.04):.3f}:d=0.04[a{k}];")
        labels += f"[v{k}][a{k}]"
    n = len(keep)
    inputs = ["-i", rel(raw)]
    if a.transform:  # transition before the speech; its sound goes away (the speech has the ambience)
        inputs += ["-i", rel(trans)]
        filt += (f"[1:v]trim=0:{a.transition_cut},setpts=PTS-STARTPTS,fps=30[vt];"
                 f"aevalsrc=0:c=stereo:s=48000,atrim=0:{a.transition_cut}[at];")
        labels = "[vt][at]" + labels
        n += 1
    filt += f"{labels}concat=n={n}:v=1:a=1[v][a]"
    ff(["-y", "-v", "error", *inputs, "-filter_complex", filt, "-map", "[v]", "-map", "[a]", "-r", "30",
        "-c:v", "libx264", "-crf", "17", "-c:a", "aac", "-b:a", "192k", rel(final)])
    # check again what stayed
    mp3f = os.path.join(cont, "speech.mp3")
    audio_for_upload(final, mp3f)
    said = transcribe_audio(mp3f, os.path.join(folder, "media", "speech.transcript.json"))
    print("kept:", " ".join(w["text"] for w in said))
    dur = float(ff(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", rel(final)], "ffprobe").strip().splitlines()[-1])
    g["continuation"] = {"file": "speech.mp4", "dur": round(dur, 3), "captions": "speech.transcript.json", "line": line}
    json.dump(g, open(hj, "w"), ensure_ascii=False, indent=1)
    print(f"→ {os.path.relpath(final, ROOT)} ({dur:.1f} s); hook.json updated. Narration = copy WITHOUT the bridge.")


if __name__ == "__main__":
    main()
