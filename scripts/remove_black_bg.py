# usage: uv run --with numpy --with pillow --with scipy python -I scripts/remove_black_bg.py <art.jpg> <out.png> [--holes] [--scale 2] [--clean x,y,w,h ...]
# --clean: rectangle (px of the original art) where only near-white stays — removes gray leftovers (e.g. a mascot's
#   shirt touching the lettering) without cutting the letters. Repeatable.
# Logo/mascot over a black background → transparent PNG.
# - background = dark region CONNECTED TO THE BORDER; --holes also erases closed near-black insides (O, B, R, D) — use it
#   on lettering, not on a mascot (pupils).
# - smooth edge: upscales (--scale) and, near the background, removes black as "color to alpha" discounting the local
#   background level (the art's black has a ~20–35 luminance gradient, which used to become a semi-transparent box).
import sys

if len(sys.argv) < 3 or sys.argv[1] in ("-h", "--help"):
    sys.exit(open(__file__, encoding="utf-8").read().split("import sys")[0])

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from scipy import ndimage  # noqa: E402
src, dst = sys.argv[1], sys.argv[2]
holes = "--holes" in sys.argv
scale = float(sys.argv[sys.argv.index("--scale") + 1]) if "--scale" in sys.argv else 2.0
img = Image.open(src).convert("RGB")
img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
im = np.asarray(img).astype(np.float32)
lum = im.max(axis=2)

dark = lum < 72
lab, _ = ndimage.label(dark)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
if holes:
    lab2, _ = ndimage.label(lum < 40)
    size = np.bincount(lab2.ravel())
    bg |= (lab2 > 0) & (size[lab2] > 150 * scale * scale) & ~bg

# local background level (filled over the drawing with a blurred weighted average)
weight = ndimage.gaussian_filter(bg.astype(np.float32), 30 * scale)
level = ndimage.gaussian_filter(np.where(bg, lum, 0), 30 * scale) / np.maximum(weight, 1e-3)
level = np.clip(np.nan_to_num(level, nan=20), 0, 50)

# transition zone: background + 3 px around it; outside it the drawing is 100% opaque
zone = ndimage.binary_dilation(bg, iterations=int(3 * scale))
a_c2a = np.clip((lum - level - 4) / (95 - level), 0, 1)
a = np.where(zone, a_c2a, 1.0)
a = np.where(bg & (lum < level + 6), 0, a)
for i, arg in enumerate(sys.argv):
    if arg == "--clean":
        x, y, w, h = [round(int(v) * scale) for v in sys.argv[i + 1].split(",")]
        reg = a[y:y + h, x:x + w]
        white = np.clip((lum[y:y + h, x:x + w] - 185) / 40, 0, 1)
        a[y:y + h, x:x + w] = np.minimum(reg, white)

# remove the black from the color (undo the blend with the background) only where semi-transparent
k = np.maximum(a, 0.04)[..., None]
color = np.clip((im - (1 - k) * level[..., None] * 0.0) / k, 0, 255)
rgb = np.where((a < 1)[..., None], color, im)
out = np.dstack([rgb, a * 255]).astype(np.uint8)
Image.fromarray(out, "RGBA").save(dst)
print(dst, f"{out.shape[1]}x{out.shape[0]}", "transparent:", round((a < 0.5).mean() * 100, 1), "%")
