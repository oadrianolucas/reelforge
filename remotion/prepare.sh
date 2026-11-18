#!/usr/bin/env bash
# Copies the material of a job to remotion/public/<slug>/ (Remotion only reads files from public/).
# usage (from the repo root or anywhere): remotion/prepare.sh videos/<brand>/<job> <slug> <brand>
# For the full copy (library mirror, recording/, media/, edit.json…) prefer: python3 scripts/prepare.py <job> <slug>
set -euo pipefail
cd "$(dirname "$0")/.."
JOB="$1"; SLUG="$2"; BRAND="$3"; D="remotion/public/$SLUG"
mkdir -p "$D"
cp "$JOB/voice/narration.mp3" "$JOB/voice/narration.alignment.json" "$D/"
cp "$JOB"/music/*.mp3 "$D/" 2>/dev/null || true
cp "$JOB"/sfx/*.mp3 "$D/" 2>/dev/null || true
cp "$JOB"/scenes/*.jpg "$JOB"/scenes/*.mp4 "$D/" 2>/dev/null || true
# white logo (dark backgrounds): logo.svg or, if the brand has one, *logo*white*.svg
LOGO=$(ls brands/"$BRAND"/assets/*logo*white*.svg brands/"$BRAND"/assets/logo.svg 2>/dev/null | head -1 || true)
[ -n "$LOGO" ] && cp "$LOGO" "$D/logo.svg"
cp brands/"$BRAND"/assets/favicon.svg "$D/" 2>/dev/null || true
ls "$D"
