# v0.3.5 interactive E walk review

The in-game **8방향 연구실 → E 보행 비교** pane displays the actual new eight-frame PROTOTYPE and old four-frame REJECTED gait together at 39px and 4×. A feature build can open `rifleman-lab.html?compare=e-walk` directly. Playback, pause, 0.25× slow motion, speed selection, scrubbing and frame stepping are visual only; neither gait becomes approved for combat.

`v035-e-walk.svg` is a standalone interactive mirror for public static review. It embeds the exact original PNG bytes once per atlas and uses the **same WalkComparisonClock and layout** as the laboratory. It contains no video, external scripts, simulation, RNG or player orders. Open it **directly as a browser document**; embedding it with an HTML `<img>` tag disables SVG scripting in browsers and produces a static image.

Rebuild with `npm run build:walk-preview`. The output is outside `public/` and does not alter the existing production Pages deployment. A pinned Git commit can be reviewed through a static SVG-capable host without merging the feature branch. The verified public URL, response checks, mobile results and deployment limitations are recorded in `reports/v035-walk-preview.md` after publication.

Complete art approval is still pending: the eight-frame gait retains lead-leg/contact and start/stop defects. The public preview is a way to inspect that work, not a completed E walk claim.
