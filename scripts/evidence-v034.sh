#!/usr/bin/env bash
set -euo pipefail
# Run npm run build and npm run preview -- --port 4234 beforehand.
# AW_PLAYWRIGHT_MODULE may point at an installed Playwright ES module.
node scripts/capture-v034-live.mjs
node scripts/capture-v034-live.mjs --lower-only
for clip in first-contact contact-and-resume complete-lower; do
  ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 \
    -i "/tmp/aw-v034-${clip}/concat.txt" -vf fps=30 \
    -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -movflags +faststart \
    "${AW_REPORT_DIR:-reports/v034-live}/${clip}.mp4"
done
node scripts/mobile-v034.mjs
