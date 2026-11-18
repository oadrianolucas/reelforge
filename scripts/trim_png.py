#!/usr/bin/env python3
"""Trims the transparent borders of PNGs (cut-out product) so the content is truly centered in the video.

usage: python3 scripts/trim_png.py videos/<brand>/<job>/products/p1.png [...]   → writes <name>.trim.png next to it
       python3 scripts/trim_png.py --bg black|white photo.png     → first erases the solid background (flood fill from the
                                                                   borders, so the product itself is not touched)
       python3 scripts/trim_png.py --key-black logo.png           → logo over black: erases EVERY dark pixel (also inside
                                                                   letters, e.g. the hole of an "O"), with a soft edge and
                                                                   recovered color — only for logos without real black
Standard library only (zlib): reads non-interlaced 8-bit RGBA/RGB/palette PNGs; leaves a 2% margin.
"""
import struct, sys, zlib


def read(p):
    d = open(p, "rb").read()
    assert d[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    i, idat, plte, trns = 8, b"", None, None
    while i < len(d):
        n, = struct.unpack(">I", d[i:i + 4]); t = d[i + 4:i + 8]; c = d[i + 8:i + 8 + n]; i += 12 + n
        if t == b"IHDR": w, h, bit, color, _, _, interlace = struct.unpack(">IIBBBBB", c)
        elif t == b"PLTE": plte = c
        elif t == b"tRNS": trns = c
        elif t == b"IDAT": idat += c
    assert bit == 8 and interlace == 0, "only non-interlaced 8-bit PNG"
    channels = {6: 4, 2: 3, 3: 1, 0: 1, 4: 2}[color]
    raw = zlib.decompress(idat); stride = w * channels; rows = []; prev = bytearray(stride); pos = 0
    for _ in range(h):
        f = raw[pos]; row = bytearray(raw[pos + 1:pos + 1 + stride]); pos += 1 + stride
        for x in range(stride):
            a = row[x - channels] if x >= channels else 0; b = prev[x]; c_ = prev[x - channels] if x >= channels else 0
            if f == 1: row[x] = (row[x] + a) & 255
            elif f == 2: row[x] = (row[x] + b) & 255
            elif f == 3: row[x] = (row[x] + (a + b) // 2) & 255
            elif f == 4:
                pp = a + b - c_; pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c_)
                row[x] = (row[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c_)) & 255
        rows.append(row); prev = row
    # to RGBA
    px = []
    for row in rows:
        if color == 6: px.append(row)
        elif color == 2: px.append(bytearray(b for k in range(w) for b in (row[3*k], row[3*k+1], row[3*k+2], 255)))
        elif color == 3:
            out = bytearray()
            for k in range(w):
                ix = row[k]; out += plte[3*ix:3*ix+3] + bytes([trns[ix] if trns and ix < len(trns) else 255])
            px.append(out)
        else: raise SystemExit("unsupported color type")
    return w, h, px


def write(p, w, h, px):
    raw = b"".join(b"\x00" + bytes(l) for l in px)
    def ch(t, c): return struct.pack(">I", len(c)) + t + c + struct.pack(">I", zlib.crc32(t + c) & 0xffffffff)
    open(p, "wb").write(b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw, 9)) + ch(b"IEND", b""))


def erase_background(w, h, px, bg, tol=42):
    ref = 0 if bg == "black" else 255
    def near(x, y):
        l = px[y]; return max(abs(l[4*x] - ref), abs(l[4*x+1] - ref), abs(l[4*x+2] - ref)) <= tol
    seen = bytearray(w * h); stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if seen[y*w+x] or not near(x, y): continue
        seen[y*w+x] = 1; px[y][4*x+3] = 0
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx]: stack.append((nx, ny))


def key_black(w, h, px, low=16, high=70):
    """alpha = brightness (max RGB) between `low` and `high`; color divided by alpha (undoes the blend with black)."""
    for y in range(h):
        l = px[y]
        for x in range(w):
            i = 4 * x
            m = max(l[i], l[i+1], l[i+2])
            a = 0 if m <= low else 255 if m >= high else (m - low) * 255 // (high - low)
            a = min(a, l[i+3])
            if 0 < a < 255:
                for c in range(3): l[i+c] = min(255, l[i+c] * 255 // max(1, a))
            l[i+3] = a


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        sys.exit(__doc__)
    bg = None
    key = False
    if args[:1] == ["--bg"]: bg, args = args[1], args[2:]
    if args[:1] == ["--key-black"]: key, args = True, args[1:]
    for p in args:
        w, h, px = read(p)
        if bg: erase_background(w, h, px, bg)
        if key: key_black(w, h, px)
        ys = [y for y in range(h) if any(px[y][4*x+3] > 12 for x in range(w))]
        xs = [x for x in range(w) if any(px[y][4*x+3] > 12 for y in ys)]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        f = int(0.02 * max(x1 - x0, y1 - y0))
        x0, y0, x1, y1 = max(0, x0 - f), max(0, y0 - f), min(w - 1, x1 + f), min(h - 1, y1 + f)
        new = [px[y][4*x0:4*(x1+1)] for y in range(y0, y1 + 1)]
        out = p[:-4] + ".trim.png"
        write(out, x1 - x0 + 1, y1 - y0 + 1, new)
        print(f"{p}: {w}x{h} → {x1-x0+1}x{y1-y0+1} ({out})")
