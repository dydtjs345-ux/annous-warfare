# Actual Tactical Suit character evaluation

The previous `/open-asset-review/` was a **motion-only comparison on the original USMC and Russian models**. Although the Tactical Suit mirror had been downloaded, its Blender import failed; the external character was not used in that comparison. This new, separately labeled evaluation successfully imports the actual external model. It does not relabel the USMC model.

## Inputs and identity

The character is **Military tactical suit (LowPolyGameReady)** by **DanlyVostok**, Sketchfab UID `ef698ce36b1545a78ce592dd3db4c7ed`, **CC BY 4.0**. The official download endpoint requires authentication (HTTP 401). The acquired file is the credited `cktang88/3d-fps` mirror pinned at `130ac2a5c856401ec36e7d35afcfefe40c5801f4`; its embedded metadata identifies the creator, source and license. Mirror SHA-256: `fe02bc307077d7a5a74069d085893988d93751495871c84082256e60bf9bfc9e`. Completeness against the unavailable original authenticated archive is not certified. See [full attribution](licenses/ATTRIBUTION.md).

The actual external asset supplies 15 meshes, its own textures, 21,671 vertices across primitives and its own skeleton. The normalized rig retains 87 joints after removing one zero-weight dummy. The animated GLB adds only the existing M16A4 and magazine (17 meshes total). It contains **no original USMC body geometry**. The cap, balaclava, headset, plate carrier, pouches, gloves and boots distinguish the external character from the original tan helmet/backpack USMC.

## Why import failed and what changed

The mirror mixes vertex positions approximately one million times the effective skinning units with inverse-bind scales around one millionth. Legacy FBX wrappers and unweighted helper scales also confuse Blender's reconstruction. `normalize-suit.mjs` repairs the paired position/inverse-bind units, eliminates the unweighted dummy, reconstructs the neutral bind and removes unreachable wrapper nodes. Its initial algebraic normalization reproduces all 21,671 evaluated original vertices within **0.00012 mm**, before intentional neutral-pose/attachment corrections. Eighteen unweighted helper binds are cleaned up, and the existing headphone mesh is seated below its parked position. Both review displays are uniformly normalized to 1.74 m (the unscaled original USMC measures 1.823 m). Shapes and textures are not substituted with our model.

Reusable outputs:

- `source/TacticalSuit_Normalized.glb`: repaired actual external character, without adopted mirror animation.
- `source/TacticalSuit_Imported.blend`: inspectable imported character.
- `source/M16A4_GripReference.blend`: packed existing rifle and magazine only.
- `source/TacticalSuit_Retargeted.blend`: reusable retarget and rifle actions.
- `models/TacticalSuit_Quaternius_Rifle.glb`: full external character, weapon and two imported clips.

## Imported motion and rifle correction

Source: **Quaternius UAL1 Standard RM, CC0 1.0**, SHA-256 `be684571ed655a1b892c2c07e6e2aeca053b606c442d34004adaf1d944090d01`. Actual acquired clips:

| Output clip | Actual source | Native duration | Status |
|---|---|---:|---|
| `SU_Quaternius_Walk_Rifle` | `Walk_Loop` | 1.333333 s | Imported onto actual Tactical Suit; rifle/contact cleanup |
| `SU_Quaternius_Sprint_Rifle` | `Sprint_Loop` | 0.666667 s | Imported onto actual Tactical Suit; rifle/contact cleanup; athletic style remains |
| Forward crawl | No acquired source | — | **Blocked: absent from the downloaded Standard libraries** |

No crawl was generated, substituted or mislabeled. A licensed crawl GLB/FBX/BLEND or authorized download is still needed. No other animations were authored or replaced.

The retarget maps 52 Quaternius body/finger joints to the suit. Pelvis, spine, chest and clavicle rotations come from source motion; the rifle does not apply a frozen upper-body layer. The source leg-length ratio is approximately 0.9325. Legs use source ankle trajectories with reach/sole correction for the suit's proportions. Rifle carry uses the project's existing M16 grip as a reference, then solves both arms, anatomical wrist frames and finger directions on the actual external rig. The rifle follows the shoulder center and torso yaw. Play each full GLB clip on the **entire scene**, including its separate rifle node, to preserve attachment.

The source walking pelvis varies about 6.27° and chest relative to pelvis about 11.32°. Sprint varies about 10.54° and 60.43°, respectively. Those torso rotations are preserved; sprint therefore retains a large athletic torso swing. This is an evaluation candidate, not a claim of military locomotion approval. Dense contact baking changes sample density, **not playback speed**.

## Separate visual comparisons

1. **Appearance:** neutral poses, original USMC left / actual Tactical Suit right, same side or fixed 30° isometric camera, lighting and nominal 1.74 m display height. Rifles are hidden to reveal model identity.
2. **Motion:** existing USMC walk/sprint left / actual Tactical Suit with imported Quaternius motion and M16 fixes right. Same cameras, lighting, framing and 1× playback. Each keeps native clip timing and root travel; the source sprint travels much faster than the original game's 3 m/s. Cameras track root motion. Ground speed is not artificially equalized because that would cause foot sliding or require retiming. This comparison changes both character and gait; the preserved earlier motion-only evaluation isolates gait on identical original models.

Normal 1× playback is the default; a 0.5× inspection control changes the complete comparison video, keeping both panels synchronized.

Videos and phase sheets are rendered from the **final GLB reimported into Blender**, not from an unexported source pose. H.264/yuv420p, 24 fps, four clips. Four phase samples and two opposing hand close-ups accompany them. Videos loop an excerpt at native speed; their cut is not an animation-transition demonstration.

## Validation and limits

CPU Three.js AnimationMixer playback of the actual full-scene clips also verifies wrist/rifle alignment at 480 Hz with 1× time scale and no upper-body overlay. It is not a browser test.

Machine-readable validation lives in `validation/`: normalization, imported hierarchy, actual reimported playback, grip/contact samples, GLB validation, rendered capture hashes and media encoding checks. Final metrics and visual findings are recorded in `validation/final-review.json` after review.

The existing live game, combat AI, map, Russian rig and original character/animation binaries are unchanged. This feature branch is `feat/tactical-suit-character-comparison`, based on `b350f9e469f77c2ea5f56041a7e216538c3f470e`. No merge to GitHub main is authorized or performed. The only previous-preview edit is a text clarification that it compares motions on original models, plus a link here.

Browser playback and physical iPhone Safari are unverified. The managed Sites environment has no `cua_repl.js`; the Sites skill explicitly says to skip browser QA in that case. No browser or mobile performance result is inferred from Blender. Full selected MP4s load into local Blobs for seeking on the host, which does not support byte ranges. Static images and direct GLB download remain available. Twelve-character game performance is outside this character evaluation; no new model is connected to the game or AI.


### Final measured export checks

Both final character GLBs pass Khronos validation with **zero errors and zero warnings**. Reimported final playback sampled at 480 Hz gives:

| Action | Maximum wrist/grip error | Lowest body/boot vertex | Lowest rifle vertex |
|---|---:|---:|---:|
| walk | 0.0012 mm | -0.031 mm | 0.850 m |
| sprint | 0.0438 mm | -2.517 mm | 0.622 m |

The residual sprint sole penetration is about 2.52 mm between bake samples; it is not zero. CPU Three.js playback independently keeps maximum wrist error below 0.045 mm. These checks verify transforms and ground bounds, not exhaustive hand/weapon/cloth collision. Visual assessment remains necessary.

## Reproduction

From the repository root, with Node/Three, Blender 4.3.2, Python/Pillow and FFmpeg:

1. Download the pinned mirror to `/workspace/open-asset-downloads/danly-soldier-mirror.glb`; verify its hash. Retain the already acquired CC0 source GLB. The rifle helper expects the existing source texture cache at `/workspace/infantry-source/assets-3d/usmc-rifleman/textures/`; the included grip-reference blend already packs those textures.
2. `node assets-3d/tactical-suit-evaluation/tools/normalize-suit.mjs`
3. `blender -b --python assets-3d/tactical-suit-evaluation/tools/inspect-model.py`
4. `blender -b --python assets-3d/tactical-suit-evaluation/tools/prepare-rifle.py` (or reuse the packed reference).
5. `blender -b --python assets-3d/tactical-suit-evaluation/tools/retarget-suit.py`
6. `node assets-3d/tactical-suit-evaluation/tools/stamp-assets.mjs`
7. `blender -b --python assets-3d/tactical-suit-evaluation/tools/validate-reimport.py`
8. `python assets-3d/tactical-suit-evaluation/tools/render-all.py`; render opposing hand close-ups with `SU_VIEW=hands` and `hands-right`, `SU_KIND=suit`, `SU_MODE=motion`, `SU_ACTION=walk`, `SU_TIME=.2`, `SU_FRAMES=1` using `render-review.py`.
9. `python assets-3d/tactical-suit-evaluation/tools/stitch-review.py`
10. `node assets-3d/tactical-suit-evaluation/tools/build-preview.mjs`

Existing character/game assets are read-only inputs throughout.
