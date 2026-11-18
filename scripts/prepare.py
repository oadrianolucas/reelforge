#!/usr/bin/env python3
"""Copies material into remotion/public/ (Remotion only reads files from there).

usage:
  python3 scripts/prepare.py                                   # mirrors library/ → remotion/public/library/
  python3 scripts/prepare.py videos/<brand>/<job> <slug>       # + copies voice/, music/, sfx/, scenes/, products/,
                                                               #   recording/, media/ and edit.json → public/<slug>/

Only copies what changed (size or date).
"""
import os, shutil, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC = os.path.join(ROOT, "remotion", "public")


def mirror(src_dir, dst_dir, extensions=None):
    n = 0
    for folder, _, files in os.walk(src_dir):
        for a in files:
            if extensions and not a.lower().endswith(extensions):
                continue
            src = os.path.join(folder, a)
            dst = os.path.join(dst_dir, os.path.relpath(src, src_dir))
            if os.path.exists(dst) and os.path.getsize(dst) == os.path.getsize(src) and os.path.getmtime(dst) >= os.path.getmtime(src):
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            n += 1
    return n


if __name__ == "__main__":
    if sys.argv[1:2] in (["-h"], ["--help"]):
        sys.exit(__doc__)
    media = (".mp3", ".mp4", ".jpg", ".png", ".svg", ".json", ".webp", ".wav")
    n = mirror(os.path.join(ROOT, "library"), os.path.join(PUBLIC, "library"), media)
    print(f"library → public/library: {n} file(s) updated")
    if len(sys.argv) >= 3:
        job, slug = sys.argv[1], sys.argv[2]
        total = 0
        for sub in ("voice", "music", "sfx", "scenes", "products", "recording", "media"):
            p = os.path.join(ROOT, job, sub)
            if os.path.isdir(p):
                for a in os.listdir(p):
                    src = os.path.join(p, a)
                    if os.path.isfile(src) and a.lower().endswith(media):
                        dst = os.path.join(PUBLIC, slug, a)
                        # same size is not enough (json edited with the same number of characters)
                        if not (os.path.exists(dst) and os.path.getsize(dst) == os.path.getsize(src) and os.path.getmtime(dst) >= os.path.getmtime(src)):
                            os.makedirs(os.path.dirname(dst), exist_ok=True)
                            shutil.copy2(src, dst)
                            total += 1
        # recorded style: edit.json lives at the job root
        for name in ("edit.json",):
            src = os.path.join(ROOT, job, name)
            if os.path.isfile(src):
                dst = os.path.join(PUBLIC, slug, name)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)
                total += 1
        print(f"{job} → public/{slug}: {total} file(s) updated")
