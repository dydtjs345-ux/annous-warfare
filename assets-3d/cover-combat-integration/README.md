# 엄폐·피킹·사격 — cover animation integration

Separate test only, on `feat/cover-peek-fire-integration`, recovered from `cc66fecc4abd6d34868c53aeaeb6d8ad482c0168`. No combat AI, squad commands, playable map, live-game entry point, or original asset is changed. No merge to main.

## Recovered status

The latest actual Military Tactical Suit had eight approved locomotion/crouch clips and **no cover-combat clips**. Crouched walking was not counted as peeking. Original USMC/Russian rigs contained legacy `TC_CoverLeanLeft/Right`, `TC_CoverAimLeft/Right`, `TC_CoverFireLeft/Right`, `TC_CoverAboveAim/Fire`, `TC_CoverReturnLeft/Right`, `TC_CoverLower` and `TC_CoverExit` pairs, on the older rigs. Blind fire was absent. Those originals remain unchanged.

## What can be previewed

Both **M16A4 and AK-74M**, with standing and crouched cover variants, use the actual latest Tactical Suit and its 87-joint rig. AK uses the same suit: this is not a new Russian-uniform model.

| Requested action | Implemented state families | Status |
|---|---|---|
| Left corner peek, aim and fire | `LeftEnter`, `LeftAim`, `LeftFire` | Implemented derived motion |
| Right corner peek, aim and fire | `RightEnter`, `RightAim`, `RightFire` | Implemented derived motion |
| Rise above low cover, aim and fire | `LowEnter`, `LowAim`, `LowFire` | Implemented derived motion |
| Blind fire above cover | `BlindOverEnter`, `BlindOverFire` | Implemented; head stays below sights |
| Blind fire around either corner | `BlindLeftEnter/Fire`, `BlindRightEnter/Fire` | Implemented; distinct arm, rifle and head posture |
| Return behind cover | Corresponding `Left/Right/Low/BlindOver/BlindLeft/BlindRightReturn` | Implemented |
| Protected cover | `ProtectedCorner`, `ProtectedLow` | Implemented holding loops |
| Exit cover | `Exit`, `ExitRight`, `ExitLow` | Implemented derived turn/walk/stop with boot contact constraints |

Clip names are `CV_{M16A4|AK74M}_{Stand|Crouch}_{state}`. The catalog records exact clip, duration, source classification and status. There are **46 core clips per rifle (92 total)** and **six implemented exit variants per rifle (12 total)**. Aim/fire/holding loops last 2.4 seconds; derived enter/return transitions last 2 seconds. Approved locomotion playback is unchanged.

The Korean preview category is **엄폐·피킹·사격**. It offers opaque building-corner, waist-high-wall and low-barrier geometry; both rifles and stances; eight orientations; fixed 30° isometric, opposite, side, rear and free cameras; 1×/0.5× speed; 60/80/120px and enlarged inspection; hand/grip/skin-foot markers; muzzle clearance ray; individual clips; and continuous peek → aim → fire → return. Switching an exposed action routes through its return clip. The dedicated clip inspector explicitly starts from that clip's first pose.

## Exact motion sources and modifications

**New cover motion is derived project motion, not untouched external cover mocap.** The authorized fallback uses the preserved project `Lower_AimStance` and `FB_AimIdle_Upper`, with actual `FB_Recoil_Shot` curves on firing clips. The full source is `assets-3d/tactical-combat/source/USMC_Tactical.blend` or `Russian_Tactical.blend`; sampled grip frames, bone tracks, recoil values and action catalogs are in `validation/project-rifle-source.json`.

Retargeting maps root/pelvis, lumbar/thoracic/chest, neck/head, clavicles, arms, wrists, hips, knees and ankles to the approved 87-joint rig. Explicit modifications distribute lean/rotation through pelvis, lumbar spine, thorax and chest; advance/retract clavicles; align aimed head/sights; and change blind-fire posture. Deterministic arm, finger and leg constraints maintain weapon control and actual boot-skin contact. Full-body tracks are evaluated together; an upper-body layer does not override the pelvis or spine. There is no random shake. Fire uses original recoil data rather than just renaming an aim clip.

Export repair restores constant rifle rotations that Blender omitted, calibrates incoming inverse-bind bases against the unchanged target skin, and constrains rifle transitions. Exit variants additionally derive from project `Turn_Left/Right` + `Upper_Turn_Left/Right`, and approved **Quaternius UAL1 CC0 `Walk_Loop`**. Their initially sliding turn-to-walk and braking contacts were corrected using explicit forefoot support locks and smooth release; pelvis/spine and the 92 core clips remain unchanged.

## External assets and licenses

- Actual character: **Military tactical suit (LowPolyGameReady)**, **DanlyVostok / 1799danly**, **CC BY 4.0**. [Original listing](https://sketchfab.com/3d-models/military-tactical-suit-lowpolygameready-ef698ce36b1545a78ce592dd3db4c7ed), [creator](https://sketchfab.com/1799danly), [license](https://creativecommons.org/licenses/by/4.0/). Existing credited download/mirror/normalization provenance is preserved in the tactical-suit evaluation folder. The same real body meshes and equipment are retained.
- **Quaternius UAL1/UAL2 Standard, CC0 1.0**: actual acquired GLB inventories inspected, recorded with hashes in `validation/acquired-source-catalogs.json`. No dedicated validated rifle cover/peek/blind-fire set was found. Existing UAL1 walk/sprint/crouch motions are preserved; walk is also used in the derived exit variants.
- **Kevin Iglesias Human Soldier Animations FREE**: actual previously acquired archive inspected; standing assault-rifle Aim01/Shoot01/Reload01 are available. Project/single-entity use and extractable-library redistribution restrictions apply. **Not shipped in this preview.** [Publisher license](https://keviniglesias.com/#license), [pack](https://kevdev.itch.io/human-soldier-animations-free).
- **Rokoko 11 Free Gun Animations**: registration-gated official download; no archive acquired here, no bypass, no use. [Listing](https://www.rokoko.com/resources/rokoko-mocap-11-free-gun-animations).
- **ZenXChaos ThirdPersonShooter-AnimationSets**, pinned `f19adc2ece4cab0f89c9236223abb97d4d2badea`, supplied **Unlicense**: actual three FBX files parsed; canonical axis/root/bind conversion remains unvalidated. **Not shipped or claimed as integrated.** [Repository](https://github.com/ZenXChaos/ThirdPersonShooter-AnimationSets).
- M16A4/AK-74M: preserved existing project geometry and faction-specific grip references; no new independent third-party weapon rights are asserted. Three.js: MIT. Full character, Quaternius and runtime notices are under `licenses/`.

## Preservation and reusable assets

`TacticalSuit_Cover.glb` copies every original body/weapon node, mesh, material, skin, accessor, buffer view, the original eight clips and the entire original binary prefix unchanged; it appends the existing AK geometry. The approved source GLB SHA-256 remains `2549b894883ad6f8886060c742638a6c137fd52acb86f87ccbb1c02a0567da1c`.

`M16A4_Cover.animation.glb` and `AK74M_Cover.animation.glb` are standalone mesh-free animation patches on identical node names/hierarchy. The reusable controller loads the selected patch, blends full-body clips over 0.18 seconds and preserves loop phase. Repeating the same state does not restart it. Foot/arm contact constraints run after blending and restore the authored transforms before each mixer update, avoiding accumulated IK and frozen constant tracks.

Cover uses a local anchor coordinate frame, not a specific wall mesh. Tested wall heights are 1.14m and 0.90m; arbitrary geometry/heights require anchor/contact adaptation and renewed clearance checks. No nonexistent tactical AI state is connected.

## Validation and limits

- Actual final GLBs were exported, merged with the unchanged skin, reimported and sampled at **120Hz** across all 92 core clips. Both rifles passed wrist, actual deformed boot/body ground, obstacle-vertex and aimed/firing muzzle-ray checks.
- Additional **240Hz M16 left-side and AK low-cover playback** includes between-key frames; maximum wrist error was **0.534mm**, no sampled obstacle vertices or firing rays intersected cover. Core ground minimum at exported samples was approximately +1mm.
- The actual preview `CoverAnimator`/Three.js mixer was exercised on CPU: **104 clips and 24 continuous core sequences**, both weapons/stances. Maximum wrist error was below 0.001mm; maximum pinned boot-marker error below 0.003mm. Maximum wrist travel per 60Hz frame in those sequences was 47.1mm. These are numerical contact checks, not a judgment that motion is perfect.
- Final exported model/motion frames and normal-speed side/isometric sequences are rendered offline with opaque geometry. Rear inspection frames cover both rifles, both stances and blind fire. The actual images are visually inspected; they are **Blender renders of the final exported playback, not browser screenshots**. Review recordings sample 12 poses/second at real-time speed; the interactive viewer targets 30fps.
- Exit variants pass final 120Hz reimport checks for both rifles, and additional 240Hz AK exit checks. Explicit authored-motion contact constraints reduced peak grounded forefoot drift from about 0.89m/s to 0.023m/s at 120Hz (0.012m/s in the 60Hz controller). Standing M16 and crouched AK exit sequences were rendered and visually inspected. Their ground tolerance includes approximately 1.6mm sole compression.
- Collision checks use actual deformed vertices plus muzzle rays; they are not an exhaustive continuous triangle/cloth/self-collision proof. Return/enter blends and contacts need human review in the target device/browser. Blind fire is a visual candidate, not AI behavior.
- **No browser GPU, physical iPhone Safari, mobile frame-rate, memory, or touch-interaction test was possible here.** A Safari15.4 syntax bundle is not device validation. One body renders at a time, device pixel ratio is capped at 1, rendering targets 30fps and pauses when hidden, AK motion loads on demand, and small screens offer video/images before optional 3D. Download bytes are recorded in `validation/build.json`; they are not a Safari loading-time measurement.
- No automatic quality approval is implied. All ten requested action types can be previewed; arbitrary-height cover adaptation and real browser/Safari visual QA remain unfinished.

Reproduce from the repository root using the tools in `tools/`: inspect source, bake core/exit, prepare AK, merge assets, combine validation, create metadata, validate export, test controller, render final, build preview. Raw intermediate blends/duplicate baked GLBs are ignored. Exact command/environment notes are in the scripts; Blender must use `--python-exit-code 1`.
