#!/usr/bin/env python3
"""Render a shipped example (examples/<brand>/<template>/) with no paid assets and no media files.

usage: python3 scripts/example.py <brand>/<template> [--format 9:16[,4:5,1:1]] [--render] [--concurrency N]
  e.g. python3 scripts/example.py example-coffee/motion-ad --format 9:16,1:1 --render
       python3 scripts/example.py example-coffee/system-explainer --render   (16:9 only)

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
COMPOSITIONS = {"motion-ad": "MotionAd", "retail-offers": "RetailOffers", "app-showcase": "AppShowcase",
                "system-explainer": "SystemExplainer"}
SUFFIX = {"9:16": "", "4:5": "4x5", "1:1": "1x1"}
LANDSCAPE = {"system-explainer"}  # single 16:9 composition (1920x1080), no format variants


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("example", help="<brand>/<template>, a folder under examples/")
    ap.add_argument("--format", help="9:16, 4:5, 1:1 or a comma-separated list (default 9:16; 16:9 for system-explainer)")
    ap.add_argument("--render", action="store_true", help="run the render instead of printing the command")
    ap.add_argument("--concurrency", type=int, help="passed to remotion render")
    a = ap.parse_args()

    brand, _, template = a.example.strip("/").partition("/")
    src = ROOT / "examples" / brand / template
    if template not in COMPOSITIONS or not src.is_dir():
        sys.exit(f"no example at examples/{brand}/{template} (templates: {', '.join(COMPOSITIONS)})")
    landscape = template in LANDSCAPE
    formats = [f.strip() for f in (a.format or ("16:9" if landscape else "9:16")).split(",") if f.strip()]
    if landscape and formats != ["16:9"]:
        sys.exit(f"{template} is 16:9 only")
    bad = [f for f in formats if f not in SUFFIX and not landscape]
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
        suffix = "" if landscape else SUFFIX[fmt]
        comp = COMPOSITIONS[template] + suffix
        name = template + (f"-{suffix}" if suffix else "") + ".mp4"
        out = out_dir / name
        props = {"slug": slug} if landscape else {"slug": slug, "format": fmt}
        cmd = ["npx", "remotion", "render", "src/index.ts", comp, f"../videos/{brand}/examples/{name}",
               "--props", json.dumps(props)]
        if a.concurrency:
            cmd += ["--concurrency", str(a.concurrency)]
        print(f"\n(cd remotion && {shlex.join(cmd)})")
        if a.render:
            out_dir.mkdir(parents=True, exist_ok=True)
            subprocess.run(cmd, cwd=ROOT / "remotion", check=True)
            print(f"-> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
