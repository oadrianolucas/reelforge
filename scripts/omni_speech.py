#!/usr/bin/env python3
"""Hook spoken on camera with Gemini Omni: the persona says ONE sentence with the model's native voice.

usage (from the repo root):
  python3 scripts/omni_speech.py --persona library/personas/<persona>/persona.png \
      --line "Guess how many abandoned carts I recovered this week? I couldn't believe it either." \
      --scene "home office corner with a clothing rack, stacked shipping boxes and a laptop, late afternoon" \
      --person "woman, early 30s, natural makeup, casual white t-shirt, hair in a loose bun" \
      --media videos/<brand>/<job>/v01/media [--language "Brazilian Portuguese"] [--duration 8] \
      [--model google/gemini-omni-1.1-flash] [--confirm]

Without --confirm it only prints the prompt and the cost estimate (nothing is charged).
With --confirm: generates the clip (omni-raw.mp4), transcribes it (ElevenLabs Scribe), checks the speech matches the text,
trims from the start of the 1st word to the end of the last (with margin), crops the top of the frame (Omni BURNS captions
at chest height even with "no subtitles") and writes into media/:
  speech.mp4 · speech.transcript.json · hook.json (opening for UgcNarrated: hook null + continuation)
Reference cost: US$ 0.81 per 8 s with audio on 1.1 (~US$ 0.10/s).
"""
import argparse, difflib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from recording import ff, rel, transcribe_audio  # noqa: E402

USD_PER_S = 0.10


def prompt(o):
    return (
        "Ultra-realistic vertical 9:16 smartphone selfie video, shot on iPhone 15 front camera. "
        f"The person from the reference image: {o.person}. "
        f"Setting: {o.scene}. "
        "Soft daylight from a window, warm practical lamp in the background. "
        "Close-up selfie framing at eye level, 24 mm, subject centered with headroom, safe for square crop, slight handheld sway. "
        f"She looks into the camera and speaks in {o.language} with a natural native accent, casual and expressive: "
        f"\"{o.line}\" "
        "Small natural head movements and eyebrow raises on the key words, smiles at the end. "
        "Natural skin texture with pores, subtle film grain, realistic reflections. "
        "No text, no captions, no subtitles, no logos, no background music, no extra fingers."
    )


def normal(t):
    return re.sub(r"[^\wà-ú ]", "", t.lower()).split()


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--persona", required=True, help="photo of the fixed face (persona.png from the library)")
    a.add_argument("--line", required=True, help="the exact sentence (fits ~2.5 words/s)")
    a.add_argument("--scene", required=True, help="setting in English (place + 3–4 objects + time of day)")
    a.add_argument("--person", required=True, help="person in English (age, hair, clothes) — same as the persona")
    a.add_argument("--media", required=True, help="the video's media/ folder")
    a.add_argument("--language", default="Brazilian Portuguese", help="language the persona speaks in")
    a.add_argument("--duration", type=int, default=8)
    a.add_argument("--model", default="google/gemini-omni-1.1-flash")
    a.add_argument("--confirm", action="store_true", help="really generate (charged)")
    o = a.parse_args()

    p = prompt(o)
    words = len(o.line.split())
    print(f"line: {words} words in {o.duration} s ({words / o.duration:.1f}/s; above ~2.8/s she rushes)")
    print(f"estimate: US$ {USD_PER_S * o.duration:.2f} ({o.model}, {o.duration} s with audio)")
    if not o.confirm:
        print("\nprompt:\n" + p + "\n\nnothing was generated — run again with --confirm after the cost is approved.")
        return

    os.makedirs(o.media, exist_ok=True)
    raw = os.path.join(o.media, "omni-raw.mp4")
    if not os.path.exists(raw):
        r = subprocess.run([sys.executable, os.path.join(HERE, "video_openrouter.py"), "--model", o.model, "--image", o.persona,
                            "--audio", "--duration", str(o.duration), "--size", "720x1280", "--out", raw, "--prompt", p],
                           capture_output=True, text=True)
        print(r.stdout[-600:])
        if r.returncode:
            sys.exit("Omni failed:\n" + r.stderr[-1500:])
        cost = json.loads(r.stdout.strip().splitlines()[-1]).get("cost_usd")
        print(f"real cost: US$ {cost}")
    else:
        print("omni-raw.mp4 already exists — reused (no cost)")

    wav = os.path.join(o.media, "omni-raw.wav")
    ff(["-v", "error", "-y", "-i", rel(raw), "-vn", "-ac", "1", "-ar", "16000", rel(wav)])
    ws = transcribe_audio(wav, os.path.join(o.media, "omni-raw.transcript.json"))
    os.remove(wav)
    if not ws:
        sys.exit("the transcript found no speech in the clip")
    said = " ".join(w["text"] for w in ws)
    sim = difflib.SequenceMatcher(None, normal(o.line), normal(said)).ratio()
    print(f"heard: {said}\nmatches the text: {sim:.0%}")
    if sim < 0.85:
        print("! the speech doesn't match the text (invented/swapped word) — check before using")

    ini = max(0.0, ws[0]["start"] - 0.3)
    end = ws[-1]["end"] + 0.35
    dur = round(end - ini, 2)
    speech = os.path.join(o.media, "speech.mp4")
    # top crop: 562x1000 from the top → 720x1280 (1.28 zoom) removes the burned caption at chest height (~81% of the height)
    ff(["-v", "error", "-y", "-ss", f"{ini:.2f}", "-i", rel(raw), "-t", f"{dur:.2f}",
        "-vf", "crop=562:1000:79:0,scale=720:1280:flags=lanczos,setsar=1", "-c:v", "libx264", "-crf", "16", "-preset", "slow",
        "-c:a", "aac", "-b:a", "192k", rel(speech)])
    wav = os.path.join(o.media, "speech.wav")
    ff(["-v", "error", "-y", "-i", rel(speech), "-vn", "-ac", "1", "-ar", "16000", rel(wav)])
    transcribe_audio(wav, os.path.join(o.media, "speech.transcript.json"))
    os.remove(wav)
    json.dump({"hook": None, "note": f"hook spoken on camera ({o.model}, native voice) — scripts/omni_speech.py",
               "continuation": {"file": "speech.mp4", "dur": dur, "captions": "speech.transcript.json", "line": o.line}},
              open(os.path.join(o.media, "hook.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sheet = os.path.join(o.media, "speech.contact.jpg")
    ff(["-v", "error", "-y", "-i", rel(speech), "-vf", "fps=2,scale=200:-1,tile=7x2", "-frames:v", "1", rel(sheet)])
    print(json.dumps({"speech": speech, "dur": dur, "sheet": sheet, "match": round(sim, 2)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
