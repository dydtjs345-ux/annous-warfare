# Phase 1 — Shared infantry combat animation

Actual skeletal animation for both USMC and Russian infantry on the same 163-bone rest architecture. The package includes **21 reusable layer clips per faction**, animated GLBs, source Blender projects, moving-fire FBX takes and a standalone 3D review interface. Original character sources and live game code are unchanged.

## Open the preview

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory assets-3d/infantry-animation
```

Open **http://127.0.0.1:8765/preview/**. The viewer and Three.js dependencies are included; no npm install or external CDN is needed to view it. Use a modern WebGL browser. Opening the HTML through `file://` will not load the GLBs.

The viewer supports both factions, same-animation comparison, play/pause, speed, all eight headings and 60/80/120px standing-reference sizes. Native motion changes the projected bounds naturally; figures are not resized every frame. Dedicated states cover tactical walk, sprint, weapon raise/lower, aim idle, stationary single/automatic fire, aim-walk, moving fire, reload and transitions.

For the key acceptance check, select **Firing while moving**, then toggle **Fire off/on**. The lower-body Action keeps its phase. Use **Single shot** for individual recoil. Reloads use separate magazine meshes and return to the aiming stance.

## Assets and evidence

| File | Contents |
| --- | --- |
| [USMC Blender](source/USMC_Animation.blend) / [Russian Blender](source/Russian_Animation.blend) | Editable animation copies, all authored Actions, default layered NLA moving-fire demonstration |
| [USMC animated GLB](models/USMC_Animated.glb) / [Russian animated GLB](models/Russian_Animated.glb) | All 21 independently reusable layers/clips, embedded PBR textures, independent weapon and magazine objects |
| [USMC FBX](models/USMC_MovingFire.fbx) / [Russian FBX](models/Russian_MovingFire.fbx) | Flattened, sampled 7.2-second moving-fire take; the complete layer library is in GLB/Blender |
| [Animation contract](architecture.json) | State combinations, bone masks, clip durations, travel curves, phase boundaries and reload/turn handling |
| [Moving-fire recording](review/moving-fire-120px.mp4) | Actual skinned 3D frames, both factions, repeated recoil while walking |
| [Eight-direction review](review/eight-directions-120px.png) | Native 120px standing-reference views, actual 3D rotations |
| [60px](review/preview-60px.png) / [80px](review/preview-80px.png) / [120px](review/preview-120px.png) | Standalone preview captures |
| [Technical report](REPORT.md) / [Validation summary](validation/animation-validation.json) | Checks, evidence, production limits and next work |

## Completed motion structure

- Lower-body idle, aiming stance, tactical walk, sprint and aiming-walk.
- Idle→walk, walk→idle, walk→sprint, sprint→walk and sprint→stop, with contact travel curves.
- Left/right 45° step turns with torso/head anticipation and continuous orientation handoff.
- Low-ready breathing, close-body sprint carry, weapon raise/lower and aiming idle.
- One-shot recoil, composed into stationary and moving automatic-fire states.
- Weapon-specific tactical magazine reloads: M16A4 straight insertion and AK-74M rocking insertion.

Moving fire uses **Lower_AimWalk + Upper_Aim + additive Recoil_Shot**. It is not a muzzle-flash effect on walking. The runtime plays authored keyframe curves; the offline tools solve authored foot/hand targets into Blender Actions. No runtime procedural joint posing is used.

## Engine contract

Clips are **in place**. Apply the documented speed for loops, and `travel_samples_m` for starts/stops and speed changes, along the actor's forward axis. Contact transitions enter and exit at phase zero. Keep lower-body time unchanged on fire events. At turn completion, commit the actor heading while switching the lower layer to idle. Complete the tactical reload's magazine exchange before changing combat state; arbitrary reload interruption is not covered.

The preview implements the layer combination and heading/magazine presentation handoffs. Integration into the live battle renderer, AI, ammo logic and existing animation code is deliberately outside this package.

## Rebuild and validate

Requires Blender 4.3.2, Python 3/Pillow, Node, and (for browser checks) Playwright/Chromium. Install the pinned tool dependencies with `npm ci --prefix assets-3d/infantry-animation/tools --ignore-scripts`. Browser checks use `/usr/bin/chromium`; set `AW_CHROMIUM` to another Chromium executable when needed.

```sh
AW_FACTION=USMC blender -b --factory-startup --python-exit-code 1 -t 4 --python assets-3d/infantry-animation/tools/author_motion.py
AW_FACTION=Russian blender -b --factory-startup --python-exit-code 1 -t 4 --python assets-3d/infantry-animation/tools/author_motion.py
blender -b --factory-startup --python-exit-code 1 -t 4 --python assets-3d/infantry-animation/tools/prepare_projects.py
python3 assets-3d/infantry-animation/tools/package_motion.py
```

For each faction, run `validate_motion.py`, `deformation_gate.py`, `export_animation.py` and `export_fbx.py` against its new Blender project, setting `AW_FACTION`. Then run `node tools/validate_glb.mjs` and Blender `tools/validate_reimports.py` from this asset folder (or use their full paths from the repository root). Start the preview server, run `node tools/capture_review.cjs`, then `python3 tools/package_review.py` and `python3 tools/audit_delivery.py`.

The complete library is authored motion for the Phase 1 ranges. Terrain adaptation, additional locomotion speeds, crouch/prone/cover actions, arbitrary interruption policy, LODs and army-scale runtime performance remain later work. The underlying cloth retains some compressed-fold stretching; full extreme-pose retarget acceptance is not claimed.
