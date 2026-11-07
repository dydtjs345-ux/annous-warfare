#!/usr/bin/env bash
set -euo pipefail
# Production server: npm run preview -- --port 4235
# AW_PLAYWRIGHT_MODULE may point to an installed Playwright ES module.
node scripts/capture-v035-lab.mjs
for clip in se-connected se-walk-slow e-keys-rejected-review; do
  ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 \
    -i "/tmp/aw-v035-${clip}/concat.txt" -vf fps=30 \
    -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -movflags +faststart \
    "${AW_REPORT_DIR:-reports/v035-lab}/${clip}.mp4"
done
node scripts/mobile-v035-lab.mjs
mkdir -p reports/v035-live-regression
AW_GAME_URL=http://127.0.0.1:4235 AW_REPORT_DIR=reports/v035-live-regression node scripts/mobile-v034.mjs
