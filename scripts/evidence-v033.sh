#!/usr/bin/env bash
# Run from repository root after capture-v033.mjs and record-v033.mjs.
set -euo pipefail
ffmpeg -hide_banner -loglevel error -i /tmp/aw-v033-frames/base-idle-0.png -i /tmp/aw-v033-frames/idle-0.png -filter_complex hstack=inputs=2 -y reports/v033-proportion-comparison.png
for clip in walk raise fire lower; do
  layout=4x1
  if [ "$clip" = walk ]; then layout=4x2; fi
  ffmpeg -hide_banner -loglevel error -framerate 1 -i "/tmp/aw-v033-frames/${clip}-%d.png" -frames:v 1 -vf "tile=${layout}" -y "reports/v033-${clip}-cels.png"
done
ffmpeg -hide_banner -loglevel error -f concat -safe 0 -i /tmp/aw-v033-video/concat.txt -vsync vfr -c:v libx264 -crf 22 -pix_fmt yuv420p -y reports/v033-proportions.mp4
ffmpeg -hide_banner -loglevel error -i reports/v033-proportions.mp4 -vf 'fps=12,scale=784:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none' -loop 0 -y reports/v033-proportions.gif
ffprobe -v quiet -show_entries format=duration:stream=codec_name,width,height -of json reports/v033-proportions.mp4 > reports/v033-video-info.json
