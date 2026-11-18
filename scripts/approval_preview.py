#!/usr/bin/env python3
"""Preview for the CLIENT to approve: a watermark that prevents using the video before payment/approval.

usage:
  python3 scripts/approval_preview.py videos/<brand>/<job>/final.mp4 [final-1x1.mp4 ...] [--text "FOR APPROVAL"]

For each video writes <name>-PREVIEW.mp4 next to it:
- "FOR APPROVAL" repeated diagonally across the whole frame (translucent white with an outline — shows on light and dark)
- a thin band in the middle: "Final version comes without watermark" (--note)
- reduced resolution (720 px wide) and stronger compression: good enough to review, not to advertise
The audio stays the same (the client needs to hear the voice-over). Cropping the mark ruins the video: it covers the whole frame.

Uses ffmpeg from PATH (prefers ffmpeg.exe when present, e.g. on WSL), run from inside remotion/ (like check.py).
"""
import argparse, math, os, sys

sys.path.insert(0, os.path.dirname(__file__))
from check import REMOTION, ff, rel  # noqa: E402

# heavy font with accented glyphs; override with env PREVIEW_FONT. Escaped for the ffmpeg filter.
_FONTS = [os.environ.get("PREVIEW_FONT", ""), "C:/Windows/Fonts/ariblk.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
          "/System/Library/Fonts/Supplemental/Arial Black.ttf", "/Library/Fonts/Arial Black.ttf"]
_font = next((f for f in _FONTS if f and (os.path.exists(f) or os.path.exists("/mnt/c/" + f[3:]))), "")
FONT_ARG = "fontfile='" + _font.replace(":", "\\:") + "':" if _font else ""
WIDTH = 720


def dimensions(video):
    txt = ff(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", rel(video)], "ffprobe")
    w, h = txt.strip().splitlines()[-1].split(",")[:2]
    return int(w), int(h)


def build_filter(w, h, text, note):
    # scale to 720 px wide (even height); the diagonal grid is drawn on a larger square, rotated and cropped
    W = WIDTH
    H = round(h * W / w / 2) * 2
    D = math.ceil(math.hypot(W, H)) + 40
    fs_grid = round(W * 0.062)
    step = round(fs_grid * 3.4)
    line = ("   •   ".join([text] * 8)).replace("'", "")
    grid = [f"color=c=black@0.0:s={D}x{D},format=rgba"]
    for i, y in enumerate(range(0, D, step)):
        x = -((i % 2) * fs_grid * 4)  # alternating rows shifted: no easy-to-erase columns
        grid.append(f"drawtext={FONT_ARG}text='{line}':fontsize={fs_grid}:fontcolor=white@0.42:"
                    f"borderw=3:bordercolor=black@0.35:x={x}:y={y}")
    grid = ",".join(grid) + f",rotate=-30*PI/180:c=none:ow={D}:oh={D},crop={W}:{H}"
    # thin band in the middle, only with the notice (no title)
    fs = round(W * 0.036)
    band_h = round(fs * 2.1)
    middle = (f"drawbox=x=0:y=(ih-{band_h})/2:w=iw:h={band_h}:color=black@0.6:t=fill,"
              f"drawtext={FONT_ARG}text='{note.replace(chr(39), chr(8217))}':fontsize={fs}:fontcolor=white:"
              f"x=(w-text_w)/2:y=(h-text_h)/2")
    # the grid is drawn ONCE (PNG); rotating it every frame took ~6 min per video
    return grid, f"[0:v]scale={W}:{H}:flags=lanczos,setsar=1[base];[base][1:v]overlay=0:0:format=auto:shortest=1,{middle}[v]"


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("videos", nargs="+")
    ap.add_argument("--text", default="FOR APPROVAL")
    ap.add_argument("--note", default="Final version comes without watermark")
    a = ap.parse_args()
    for v in a.videos:
        out = os.path.splitext(v)[0] + "-PREVIEW.mp4"
        grid, main = build_filter(*dimensions(v), a.text, a.note)
        tmp = {"_preview.grid.txt": grid, "_preview.filter.txt": main}  # in a file: accents and quotes without headaches
        for name, txt in tmp.items():
            open(os.path.join(REMOTION, name), "w", encoding="utf-8").write(txt)
        try:
            ff(["-y", "-v", "error", "-f", "lavfi", "-i", "nullsrc=s=16x16", "-filter_complex_script", "_preview.grid.txt",
                "-frames:v", "1", "_preview.grid.png"])
            ff(["-y", "-v", "error", "-i", rel(v), "-loop", "1", "-i", "_preview.grid.png", "-filter_complex_script", "_preview.filter.txt",
                "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", "22", "-preset", "medium", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", rel(out)])
        finally:
            for name in [*tmp, "_preview.grid.png"]:
                if os.path.exists(os.path.join(REMOTION, name)):
                    os.remove(os.path.join(REMOTION, name))
        print(f"preview: {os.path.relpath(out)}")
