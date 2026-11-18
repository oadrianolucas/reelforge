#!/usr/bin/env python3
"""Render a shipped example (examples/<brand>/<template>/) with no paid assets and no media files.

usage: python3 scripts/example.py <brand>/<template> [--format 9:16[,4:5,1:1]] [--render] [--concurrency N]
  e.g. python3 scripts/example.py example-coffee/motion-ad --format 9:16,1:1 --render

Copies the example JSON into remotion/public/example-<brand>-<template>/ and prints the render command
(or runs it with --render). Output: videos/<brand>/examples/<template>[-4x5|-1x1].mp4
"""
import argparse
import json
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPOSITIONS = {"motion-ad": "MotionAd", "retail-offers": "RetailOffers", "app-showcase": "AppShowcase"}
SUFFIX = {"9:16": "", "4:5": "4x5", "1:1": "1x1"}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("example", help="<brand>/<template>, a folder under examples/")
    ap.add_argument("--format", default="9:16", help="9:16, 4:5, 1:1 or a comma-separated list (default 9:16)")
    ap.add_argument("--render", action="store_true", help="run the render instead of printing the command")
    ap.add_argument("--concurrency", type=int, help="passed to remotion render")
    a = ap.parse_args()

    brand, _, template = a.example.strip("/").partition("/")
    src = ROOT / "examples" / brand / template
    if template not in COMPOSITIONS or not src.is_dir():
        sys.exit(f"no example at examples/{brand}/{template} (templates: {', '.join(COMPOSITIONS)})")
    formats = [f.strip() for f in a.format.split(",") if f.strip()]
    bad = [f for f in formats if f not in SUFFIX]
    if bad:
        sys.exit(f"unknown format {bad[0]} (use 9:16, 4:5 or 1:1)")

    slug = f"example-{brand.removeprefix('example-')}-{template}"
    dest = ROOT / "remotion" / "public" / slug
    dest.mkdir(parents=True, exist_ok=True)
    for f in src.iterdir():
        if f.is_file():
            shutil.copy2(f, dest / f.name)
    print(f"copied examples/{brand}/{template}/ -> remotion/public/{slug}/")

    out_dir = ROOT / "videos" / brand / "examples"
    for fmt in formats:
        comp = COMPOSITIONS[template] + SUFFIX[fmt]
        name = template + (f"-{SUFFIX[fmt]}" if SUFFIX[fmt] else "") + ".mp4"
        out = out_dir / name
        cmd = ["npx", "remotion", "render", "src/index.ts", comp, f"../videos/{brand}/examples/{name}",
               "--props", json.dumps({"slug": slug, "format": fmt})]
        if a.concurrency:
            cmd += ["--concurrency", str(a.concurrency)]
        print(f"\n(cd remotion && {shlex.join(cmd)})")
        if a.render:
            out_dir.mkdir(parents=True, exist_ok=True)
            subprocess.run(cmd, cwd=ROOT / "remotion", check=True)
            print(f"-> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
