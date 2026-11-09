# Upper-body failure: measured diagnosis and corrected motion

The baseline is preview commit `a93cbae7f0476c7aee2559e39e9cfa8a20057d70`: the original `a1d2804` character GLBs plus the earlier tactical-reload extension. No original model, rig, skin weights, original Action keys, game renderer, or AI file is changed. New animation projects and exports are isolated in this directory.

**Status:** the nine core motion checks and the live public Chromium suite pass for both factions. Final version 6 also passes touch play/pause, touch orbit/pinch, paired readouts and six-soldier mixed-squad checks. See `diagnostics/acceptance.json`, `browser-after.json`, `final-browser-smoke.json` and `publication.json`. Physical iPhone/Safari hardware performance remains untested.

## Root cause

The original normal layers have **zero overlapping tracks**. Their exported and actual Actor joint/surface positions reproduce Blender within approximately **0.002 mm**. The pipeline faithfully reproduces insufficient motion:

- Walking, sprinting, aiming walk, and moving fire have **0° local chest, clavicle, and shoulder rotation**. Lower spine segments and pelvis bones also have constant local orientations. The only regular spine02 motion is **0.6° breathing**; moving-fire recoil raises that to about **1.09°**.
- `Walk` selects `Upper_LowReady`; `Sprint` selects `Upper_Sprint`; both aiming locomotion states select `Upper_Aim`. These are essentially held upper-body poses. The walk/aim upper loop is 2.4 seconds against a 1.2-second gait, rather than an authored, phase-matched torso cycle.
- This is not evidence that an existing dynamic torso track was stripped or overwritten: the lower layer never contains those torso tracks, and the upper source keys are constant. GLB channel presence alone was an inadequate previous check.
- The previous reload already moves the whole rifle about 39° and articulates spine03/02 and the head. It is **not wholly static**. However, lower spine, chest, and shoulder01 stay locally rigid; those missing articulations explain the remaining stiff mass movement. The correction preserves that weapon/magazine trajectory while articulating the body.

`diagnostics/before-pipeline.json` and `after-pipeline.json` contain every requested bone's track counts, actual local/world changes, quaternion ranges, component-wise world rotation-vector minima/maxima, translation minima/maxima, NLA comparison, and sampled surface movement. `before-source.json.gz` and `after-source.json.gz` retain dense 60 Hz measurements. `browser-before.json` independently measured zero chest motion in the existing public Chromium preview.

## Correction

The shared rig remains exactly **163 bones**, with the same rest/hierarchy hash across both factions. Root/pelvis mass placement, hip rotation, counter-rotating lower/upper spine, chest, clavicle, shoulder, and head stabilization are authored into phase-matched Actions. Walk, sprint, and aiming walk have reusable lower/upper pairs. Moving fire reuses aiming walk and adds a separate, reference-subtracted spine/chest recoil clip. It does not restart gait.

Sprint's mean torso lean is **19.92°**, versus **2.78°** in tactical walk (baseline sprint: **8.83°**). Aiming walk lowers the root mass proxy by 35 mm and keeps controlled, non-rigid upper-body compensation. Rifle/hand targets are solved together offline; runtime uses exported clips, not procedural joint rotations. Root is a mass-position proxy, not a physical centre-of-mass simulation.

| Local rotation range | Before | After |
| --- | ---: | ---: |
| Walk chest / right clavicle | 0° / 0° | 1.31° / 2.06° |
| Sprint chest / right clavicle | 0° / 0° | 1.74° / 2.72° |
| Aim walk chest / right clavicle | 0° / 0° | 0.86° / 1.70° |
| Moving fire chest / right clavicle | 0° / 0° | 1.43° / 1.70° |
| Reload chest | 0° | 2.87° |

These chest values are **local** contributions, in addition to multiple articulated spine segments. The full table, including pelvis, all five spines, both clavicles/shoulders, neck/head and world ranges, is generated automatically in `review/diagnostic-report.html`. The numeric motion floor is an engineering regression gate, not an automatic certification of human realism.

## Assets and review

- `source/{USMC,Russian}_FullBody.blend`: losslessly compressed, packed-texture copies with all original Actions retained, 11 new Actions, and synchronized walk NLA preview.
- `models/{USMC,Russian}_FullBody.glb`: 34 clips each: 21 unchanged original clips, two earlier reload layers, and 11 corrected layers. Weapons and both magazine objects remain separate; the rifle still follows `wrist.R`.
- `review/{USMC,Russian}-{Walk,Sprint,AimWalk,MovingFire,Reload}.mp4`: ten genuine continuous 3D comparisons. Left is baseline, right corrected; top is fixed 30° orthographic gameplay at 120px standing reference; bottom is horizontal orthographic side inspection at 180px detail reference. Coloured in-front markers and axes follow actual bones. Workbench studio/FXAA lighting is identical for both profiles. Walk/sprint/aim walk use actual 15 Hz evaluations; moving fire/reload use 30 Hz. Encoding duplicates frames to 30 fps where needed; no body-motion interpolation or 2D pose transforms are used.
- `review/browser-before/`: actual old public Chromium screenshots and continuous WebM recording.
- `review/browser-after/` and `diagnostics/browser-after.json`: actual corrected public-browser screenshots, GPU torso isolation images, normal RAF recordings, and runtime validation when that check has finished.

Public entry: https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/?review=body&state=MovingFire&markers=1

The Korean **상체 수정 전후 비교** mode uses one renderer, camera and lighting setup for both profiles. It retains faction switching, all motions, eight actual 3D headings, 60/80/120px reference scales, free inspection, side view and six-soldier squad modes. Markers can be hidden. **실시간 본 진단 JSON 저장** collects actual client transforms after rendered frames, selected layer names, asset hash, camera and GL error. Individual original clips remain visibly labelled as original; select a combat motion for corrected full-body composition.

## Verification

- `source-inventory.json`: original/corrected vertex, weight and rest/hierarchy hashes match. Original Action fingerprints are retained in each `*-authored.json`.
- `export-integrity.json`: Khronos validation 0 errors / 0 warnings, 163 joints, 34 clips, independent bone-parented weapon and separate magazines.
- `reimport.json`: isolated Blender GLB reimport checks evaluated positions and world-rotation deltas against source poses, including composed moving fire.
- `after-pipeline.json`: actual preview Actor logic in Node, joint and 64 sampled surface points against Blender, and CPU deformation versus the float bone matrices used by WebGL skinning. This is explicitly distinct from browser rendering.
- `preserved-original-clips-pipeline.json`: original motion inside the versioned GLBs still matches the original source, making the before comparison faithful without a second model download.
- `runtime-contracts.json`: 51 states/clips per profile/faction, phase continuity, repeated recoil, burst stop, upper/lower phase sync, magazine restoration and reload recovery.
- `reload-contact.json`: palm/magazine contact, original full-rifle trajectory, all 163 aim boundary matrices, and fully occluded magazine visibility keys in eight directions.
- `browser-after.json`: live deployed asset hashes, actual WebGL joint transforms, markers-hidden GPU raster change with lower body frozen, real RAF playback/recording, all clip/state availability, directions, camera and native scale checks. A failed or pending browser report must not be reported as completion.
- `public-https.json`: every deployed file matches the tested build; versioned model names contain their content hash. HTML JS/CSS URLs are cache-versioned; the manifest is fetched without cache and model bytes are hash-checked before playback.

The managed Sites desktop tool was not exposed. This task explicitly required actual browser verification, so the repository's existing Playwright/Chromium path was used against the public HTTPS site. Only its missing official FFmpeg recording component was added to the workspace cache; no browser or local preview server was installed.

## Reproduction and limits

Run `author_full_body.py` in Blender 4.3.2 with `AW_FACTION`. Capture with `AW_VARIANT=before|after`, then run `diagnose.mjs`, `validate_exports.mjs`, `reimport.py`, `inventory.py`, `validate_reload.py`, and `contracts.mjs`. `render_comparison.py` takes `AW_FACTION` and `AW_VIEW=iso|side`; `package_videos.py` produces comparison recordings. The two browser scripts use the existing preview's Playwright package and `/usr/bin/chromium`; `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` selects the recording helper cache. The DOM parser is pinned in the preview development dependencies, so the diagnostics do not depend on temporary /tmp packages. No credentials are stored in these files.

This is authored flat-ground motion, not motion capture, terrain adaptation, ragdoll physics or full self-collision simulation. Original start/stop/turn/raise/lower clips remain available; those original clips have not all been reauthored. Browser tests use desktop Chromium software rendering with an emulated iPhone layout, not physical iPhone Safari, mobile GPU performance or an independent WebKit engine. Before/after recordings and measured transforms demonstrate movement; artistic quality remains a visual review. No game/AI integration or main merge is performed.
