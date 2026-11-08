# Phase 1 technical delivery — shared infantry combat animation

## Delivered foundation

The branch starts at Russian infantry commit `1ab40c26b6e02fedd161b7711ecec1e7ecef71dd`, retaining the USMC evaluation baseline `e4a1008`. Both original model directories are read only. New files live under `assets-3d/infantry-animation/`; there is no game, AI, combat, renderer or existing-animation integration change and no merge.

Both faction copies retain **exactly 163 bones**, with identical bone names, parents and rest matrices. All twelve lower-body Actions are byte-equivalent at the curve-data level between factions. The shared authoring code supplies weapon-specific grip and magazine profiles for M16A4/AK-74M upper-body work. Weapons remain separate rigid objects attached to `wrist.R`; magazines are independently addressable children of the replaceable weapon assembly.

The animation copies refine 3,003 shoulder/collar garment vertices and 2,032 boot-upper vertices per character. Shoulder weight gradients are smoothed, neck influence is reduced on shoulder cloth, and boot uppers blend toward the shin while soles retain the foot attachment. Anatomical limb lengths remain fixed. The offline authoring solve limits sagittal ankle movement and preserves heel/toe support contacts. Original vertices, UVs, textures and rigs are not overwritten.

## Clips and layers

Each GLB contains **21 reusable animation layers/clips**. The standalone viewer composes them into the requested states.

| Motion | Assets / timing |
| --- | --- |
| Low-ready idle | `Lower_Idle` + `Upper_LowReady`; 2.4s loops with breathing and small weight shift |
| Tactical walk | `Lower_Walk`; 1.2s cycle, 1.05m/s travel; low-ready upper layer |
| Sprint | `Lower_Sprint` + `Upper_Sprint`; 0.8s cycle, 3m/s loaded-infantry run, flight phase, forward lean and close rifle carry |
| Aim stance / aim idle | `Lower_AimStance` + `Upper_Aim`; 2.4s loops, stock seated at the shoulder, head/torso adjustment and breathing |
| Aim-walk | `Lower_AimWalk` + `Upper_Aim`; 1.2s cycle, 0.62m/s, shorter steps and reduced angular sway |
| Weapon raise / lower | `Weapon_Raise`, `Weapon_Lower`; 0.8s each, both hands solved to the weapon |
| Individual / repeated firing | `Recoil_Shot`; 0.2s impulse/recovery, about 9mm setback and 1.6° pitch, plus shoulder/arm response |
| Moving fire | Aim-walk lower layer continues while aim and repeated additive recoil play independently |
| Start / stop / change speed | `Start_Walk`, `Stop_Walk` (0.6s); `Walk_To_Sprint`, `Sprint_To_Walk`, `Sprint_Stop` (0.8s) |
| Left / right turn | `Turn_Left/Right` + `Upper_Turn_Left/Right`; 0.9s, two pivot steps with upper-body anticipation, 45° heading change |
| Reload | `Reload`; M16A4 3.4s straight-magwell exchange, AK-74M 3.8s rocking front-catch exchange |

Foot/hand target trajectories are authored offline and solved into real Blender Actions with translation/quaternion keys. Playback uses those exported curves. The preview does not generate procedural joint rotations or simulate animation through image transforms. The source projects open on a **7.2s NLA demonstration** with locomotion, aiming and additive recoil tracks; all other Actions remain available for editing.

For moving fire, lower and upper masks are disjoint. The recoil clip is converted relative to the first `Upper_Aim` frame and applied additively. Fire-on/fire-off leaves the lower Action and its time intact. Automatic fire schedules repeated impulses; stopping allows the current impulses to recover. The native moving-fire recording shows both factions walking, aiming and recoiling together without a muzzle-flash substitute.

Reloads animate two actual magazine objects and the support hand. Old/new magazine presentation changes at the pouch, where the exchange is concealed. At completion the preview commits an identical seated magazine presentation without interpolating magazine ownership. These are **tactical reloads with a retained chambered round**; internal bolt/trigger parts and empty-chamber handling are not articulated.

## Travel, blending and presentation

The primary clips are in place. Consumers must integrate the documented 1.05/3.0/0.62m/s loop speeds and the transition travel curves in `architecture.json`. Start/stop and speed-change clips have fixed contact anchors, recorded travel, and phase-zero entry/exit poses. Use those declared boundaries in a game graph; arbitrary-phase interruption is not an accepted production policy.

Turning animates the skeleton and individual foot placements. On completion, the actor heading is committed while the lower layer changes to idle, preserving the world pose. The preview defers Action changes until after mixer evaluation to avoid a one-frame heading reset. Compatible looping gaits preserve normalized phase when blended. Weapon raise/lower can play over continuing locomotion.

The review camera retains the reference 30° isometric elevation, heading map and coordinate convention. Eight directions rotate the actual complete 3D assembly. Both factions share fixed PBR lighting; realtime Three.js lighting is an approximation of the Blender studio, not a pixel-identical Cycles render. Figure sizes are calibrated to the idle standing reference in each heading, with no per-frame size normalization.

## Validation performed

- Source skeleton and all twelve lower-body Action hashes match between factions. Every skin vertex has at most four normalized influences.
- Sampled walk/sprint/aim-walk deformation passes broad edge-strain and ground-penetration checks. The worst sampled 99th-percentile edge stretch is approximately **1.46×**.
- Planted support-vertex velocity residual is below **0.00003m/s**, including the authored start/stop and speed-change contact intervals. Loop endpoints and transition/turn endpoints pass numerical continuity checks.
- Additive recoil changes **no lower-body matrix** at the sampled gait phases. Both palm anchors remain in contact through aiming/recoil, and magazine handoffs pass their contact checks.
- Both animated GLBs pass Khronos validation with **zero errors and zero warnings**; all 21 clip durations, masks, 163-joint skins and independent weapon/magazine hierarchy are checked.
- Both GLBs and both FBXs import into isolated fresh Blender scenes with decoded embedded materials. Joint positions, weapon positions and deformed surface bounds are compared with source playback; the maximum sampled difference is below **0.028mm**. GLBs retain all 21 layer clips. FBXs contain the flattened **7.2s moving-fire take**, not the complete layer library.
- Chromium checks exercise playback, state availability, all eight directions, 60/80/120px settings, faction comparison, transition completion, turn handoff, repeated recoil, fire-stop recovery and reload presentation. The browser report binds its evidence to the GLB hashes.

`validation/animation-validation.json` summarizes the detailed JSON reports. `review/` contains actual WebGL frames, motion phase sheets, native-size captures and the moving-fire recording. The preservation audit verifies original USMC/Russian files against their Git blobs and checks binary size limits. No live-game behavior changed, so game behavior tests were not substituted for animation validation.

## Known limits and next phase

These checks cover the authored Phase 1 ranges on flat ground. The cloth still has local pinching/opening at originally compressed folds; full extreme-pose, facial and arbitrary retarget acceptance is not claimed. Contact anchors are not a full mesh collision test for every finger or equipment surface. Animation-specific body/weapon collision refinement may still be desirable in close inspection.

There is no terrain foot IK, slope/obstacle adaptation, arbitrary locomotion-speed retiming, crouch/prone/cover set, empty reload or interruptible-magazine policy. LODs, engine material import, large-unit-count performance and live selection/occlusion are unverified. The preview's arbitrary clip-selection crossfades are inspection controls; a simulation should honor the contact/phase contract and queued reload policy.

The recommended next phase is a separate, approved engine-integration branch: consume the layer masks and travel curves, synchronize contact events, implement state interruption and terrain adaptation, add LODs, and profile real battle counts. Preserve the verified clip library as the regression baseline before adding crouch, prone and cover animations.

## Provenance

Character/weapon geometry and textures derive from the existing USMC and Russian assets, whose CC0 anatomy provenance and licenses remain in their original source folders. Motion target paths, IK baking, layer masks, transitions and preview logic were authored for this phase. No external motion-capture library is represented as original work. Three.js 0.170.0 is vendored with its MIT license.
