# Korean mobile infantry animation preview

Public preview: **https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/**

[Full-body before / after](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/?review=body&state=MovingFire&markers=1) · [Measured report and moving comparisons](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/diagnostic-report.html)

The current motion revision is **full-body-1**, published as Sites version 6. It corrects the original rigid upper-body source clips and their state routing. [The technical report](../assets-3d/full-body-debug/README.md) documents the exact root cause, measured transforms, original/corrected Blender projects, exports, reimport tests, skin/GPU checks, real public-browser recordings and limitations. The existing playable game, main branch, original model sources, rest skeleton, weights and weapon architecture remain unchanged.

## Controls

The interface defaults to Korean; English is selectable without reloading models. All 17 combat-motion labels, 34 individual-clip labels, controls, tooltips, statuses and recovery errors are translated. Internal original clip IDs remain unchanged. Original individual clips are explicitly labelled as original; choose a combat motion to inspect the corrected full-body composition.

- Select USMC / M16A4 or Russian / AK-74M. The corrected GLBs retain 21 original clips, two earlier reload layers and 11 new full-body layers.
- **Gameplay isometric** is orthographic at 30° elevation, matching the Blender camera `(6, -6, 4.899)` relative to its target. Camera position is fixed across eight real 3D headings. No mirroring or perspective distortion is used.
- **Free inspection** supports touch orbit and pinch zoom, plus zoom buttons. **Side inspection** uses a fixed horizontal orthographic camera relative to the chosen heading.
- Display scales are 60 / 80 / 120 CSS-pixel standing references, with a 1× drawing-buffer pixel ratio. Posture and stride naturally change the visible height. `src/reference-spans.json` retains the established faction/direction calibration.
- **상체 수정 전후 비교** shows the baseline and corrected profile with the same model geometry, camera, lighting, clock and renderer. Both profiles are in one versioned GLB per faction, avoiding a second model download. Coloured bone axes can be shown/hidden; the live JSON button records actual client poses after render, active tracks, asset hash, camera and GL error.
- **양 진영 비교** retains the existing faction comparison. **6명 분대 보기 / 혼합 분대** uses one scene, shared mesh buffers and independent skeletons. Spacing is 2.4m across and 4m between rows, with road, building corners and cover for scale. Movement is in-place formation review, not navigation or combat AI.
- Play/pause, replay, 0.25×–2× playback, repeated fire, single shots and normal/slow reload buttons remain available. Moving fire reuses aiming-walk lower/upper clips and adds reference-subtracted spine/chest recoil without resetting gait.
- Ten continuous comparison videos include isometric gameplay and side inspection, both factions and both reload types. Additional recordings show the actual public Chromium renderer. Earlier reload recordings remain labelled as an earlier stage.

## Build and asset integrity

```sh
npm ci --prefix animation-preview-pages
npm run build --prefix animation-preview-pages
```

Use Node 22 or newer. `tools/build.mjs` verifies the original model hashes at `a1d280461f94456c905b677b213a6ee31245b1d0`, then packages corrected exports from `assets-3d/full-body-debug/models/`. Runtime GLB filenames contain their content hashes. The manifest is fetched without cache, and the browser checks model SHA-256 before playback. HTML JS/CSS references are cache-versioned. `dist/source.json` records both original and corrected hashes and the motion revision.

Three.js/loader and all runtime assets are bundled on the same origin using relative paths. Safari 15.4+ is the compilation target; there are no runtime CDN or import-map dependencies. The static site can also be served under a project subpath.

## Verification

```sh
npm run test:dom --prefix animation-preview-pages
npm run test:motion --prefix animation-preview-pages
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright npm test --prefix animation-preview-pages
```

The DOM test verifies both languages, clip labels, option values, errors and review links. The motion contract uses the actual Actor methods for all 51 states/clips, gait continuity, repeated recoil, burst stop and reload recovery. `npm test` runs the current full-body public-browser suite; the older `tools/mobile-test.mjs` and older validation files describe the historical 21-clip baseline.

The browser suite uses the existing `/usr/bin/chromium` and Playwright package, checks both factions against Blender samples, reads actual GPU torso pixels with lower-body motion frozen and markers hidden, records normal RAF playback, and verifies camera, headings, sizes, clips and deployed asset hashes. The follow-up smoke test exercises actual touch play/pause, orbit, pinch, one-renderer before/after labels, and six independent soldiers with the corrected moving-fire layers. See `../assets-3d/full-body-debug/diagnostics/browser-after.json` and `final-browser-smoke.json`.

These are Chromium software-rendering tests with an emulated iPhone layout. They are not physical iPhone Safari, independent WebKit, or mobile-GPU performance tests. Cloud recordings run slowly; the separate 3D comparison movies provide normal 15/30fps evaluated motion. The animation source remains authored flat-ground motion, with no terrain adaptation, arbitrary interruption system or full self-collision simulation.

## Deployment

The existing public Site identity remains in `.openai/hosting.json`. Reuse it; do not create another Site. Sites hosts only this standalone preview. GitHub Pages for the playable game remains unchanged and is not merged or replaced.

The checked-in `dist/` is the complete static bundle. `../assets-3d/full-body-debug/diagnostics/publication.json` records the version and deployment IDs; `public-https.json` verifies all 52 public files byte for byte. The source mirror commit for version 6 is `c91db18cf8ba60b58a7b147a5b436ab3f15a5641`. Model/animation logic passed the live suite in version 5; version 6 adds paired readouts, the successful report and browser recordings, and passed the final touch/squad/UI smoke check with the identical versioned GLBs.
