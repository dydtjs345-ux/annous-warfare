# Crawl torso mechanics — original / previous / full-body comparison

Feature branch: `feat/crawl-torso-weight-transfer`, based on `e94ec93`. Only the existing forward-crawl pair is replaced in separate asset copies for both USMC/M16A4 and Russian/AK-74M. All prior assets remain intact.

## Diagnosis before editing

The previous **exported** pelvis/root, lumbar, thoracic, chest, clavicle and shoulder tracks were inspected in actual browser playback. They are present and applied correctly: source/browser positions agree within 0.0014 mm, independently sampled quaternion/position tracks agree with the mixer, both layers have full weight, and their bindings do not overlap.

The previous source keeps the rib cage fairly steady through counterrotation, while the limb strokes and shoulder height changes dominate. It lacks a distinct loaded waist curve and shoulder pull/reach sequence. [DIAGNOSIS.md](DIAGNOSIS.md) contains the hierarchy, skin-weight findings and before measurements.

The shared skeleton supports the motion: `root` carries the pelvis; five deforming spine joints connect it to the rib cage and chest; clavicles and shoulder helpers are descendants. Rigid vest/backpack geometry limits soft-tissue detail, but the spine chain can turn and bend the trunk. No skeleton or skin-weight change is needed.

## New authored mechanics

The animation is authored from contact phases: acquire support, load, pull, unload, and hand off to the opposite side. Periodic Hermite interpolation connects these authored poses smoothly. No random body sway, playback-time remapping, or runtime torso offsets are used.

- During the loaded left-forearm interval, the pelvic and rib-cage markers shift left; the opposite leg supplies the paired support/push. The right interval mirrors this.
- Pelvic heading follows the knee recovery phase. The lumbar joints form a small lateral S-curve so the rib cage can move over support while keeping an independent heading.
- Pelvis and rib cage bank and turn with distinct phase relationships. The chest remains low while the waist articulates; the torso is not lifted onto a large vertical arm arc.
- Clavicle and shoulder-helper reach/retraction are keyed to acquisition and pulling. The arm solve preserves the planted elbow while the girdle and trunk advance.
- Planted feet and elbows remain fixed relative to the ground during their support intervals. Leg poses are solved around the moving hips with unchanged limb lengths.
- The right hand continuously controls the original rifle. The left hand remains available for ground support. Rifle-ground clearance is checked throughout the cycle.

The cycle stays **2.4 seconds**, actor translation stays **0.23 m/s**, and the comparison defaults to **1×** playback. All three actors share one clock and exactly equal camera/projection matrices and assembly travel. Optional slow inspection scales all three together.

## Three-way review

Each comparison shows **original crawl**, **previous revised crawl**, and **new full-body crawl**, in that order. Both factions have side and rear three-quarter views. The rear view uses a fixed 30-degree elevation. Cameras track equal ground translation without following an individual torso's local offsets.

The Korean preview uses one WebGL renderer and shared model geometry/textures. Optional markers show the real pelvic, spine and contact positions; they do not affect animation. On narrow screens the full comparison can scroll horizontally. Normal-speed MP4 recordings provide an alternate review path.

The original preview and previous `/crawl-review/` comparison are preserved. The new page is packaged for a separate `/crawl-torso-review/` path; public deployment details will be recorded after verification.

## Assets and validation

- `models/{USMC,Russian}_CrawlRework.glb`: complete 110-clip models, replacing only `TC_CrawlForward_Lower` and `TC_CrawlForward_Upper`.
- `models/{USMC,Russian}_CrawlForward.animation.glb`: small reusable animation-only patches targeting the same skeleton/node names.
- `source/{USMC,Russian}_CrawlRework.blend`: editable packed sources; all other Actions preserved.
- `review/{USMC,Russian}-{side,rear}.mp4`: actual three-way skeletal recordings at 24 Hz, not device-performance measurements.

Both complete models and both patches pass Khronos validation with zero errors and zero warnings. Geometry, rest nodes, skins, materials, textures, all 108 other animation definitions and the original binary prefixes remain exact. Both complete GLBs reimport as one 163-bone rig.

At 60 Hz, the deformed meshes stay above ground, active forearm surfaces remain within 15 mm of it, planted elbow/foot drift stays below 0.11 mm, limb lengths remain fixed within floating-point tolerance, the dominant wrist retains its rifle grip, and loop endpoint matrices match. Minimum sampled rifle clearance is approximately 10.1 cm. Source/browser checks also cover the actual new torso joints.

The pose diagnostics confirm the intended support-side trunk projection. Rib-cage rotation relative to the pelvic frame varies independently through the cycle: its total relative orientation range changes from about 11.2° in the previous revision to about 32.2° in this version. Those numbers establish that the regions are not locked together; they are not an automatic realism score. Visual review uses the actual rendered side/rear frame sequences and recordings.

Evidence is in `validation/*-before-source.json`, `before-playback.json`, `*-mechanics.json`, `*-source.json`, `assets.json`, and `browser.json`.

## Preserved scope and limits

Original crawl and previous revised crawl are retained unchanged. Sprint, aim, fire, reload and all other clips are unchanged. No game, map, combat AI, live deployment or tactical AI state binding is changed. Entry/aim transition clips retain their prior endpoints and need their own review before enabling the new crawl in gameplay.

This remains a level-ground authored animation candidate. Support weights and trunk markers describe the intended motion; they are not a rigid-body force or true center-of-mass simulation. Terrain adaptation, full equipment/self-collision certification and physical iPhone Safari playback are not certified by these checks.

## Reproduce

Use Blender 4.3.2, the preserved infantry authoring cache, Three.js 0.170, Chromium/Playwright, FFmpeg and Pillow.

```sh
blender -b --python-exit-code 1 -t 2 -P assets-3d/crawl-torso/tools/audit-source-before.py
node assets-3d/crawl-torso/tools/audit-before.mjs
AW_SOURCE_CACHE=/path/to/assets-3d blender -b --python-exit-code 1 -t 2 -P assets-3d/crawl-torso/tools/author_torso.py
AW_FACTION=Russian AW_SOURCE_CACHE=/path/to/assets-3d blender -b --python-exit-code 1 -t 2 -P assets-3d/crawl-torso/tools/author_torso.py
AW_SOURCE_CACHE=/path/to/assets-3d blender -b --python-exit-code 1 -t 2 -P assets-3d/crawl-torso/tools/validate-source.py
AW_FACTION=Russian AW_SOURCE_CACHE=/path/to/assets-3d blender -b --python-exit-code 1 -t 2 -P assets-3d/crawl-torso/tools/validate-source.py
python assets-3d/crawl-torso/tools/measure-mechanics.py
node assets-3d/crawl-torso/tools/validate-assets.mjs
node assets-3d/crawl-torso/tools/build-preview.mjs
node assets-3d/crawl-torso/tools/review.mjs
```

`AW_PLAYWRIGHT_MODULE` and `AW_GLTF_VALIDATOR` select installed tools. `AW_TORSO_DIST` selects the dedicated preview output (default `/workspace/crawl-torso-dist`). The comparison reuses the unchanged original model URLs and previous animation-patch URLs.
