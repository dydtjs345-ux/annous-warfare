# Isometric USMC visual evaluation

This is a static visual study using the completed rifleman, with a connected two-handed low-ready pose. The original model, boots, textures, game code and animation assets remain unchanged. Knee pads exist only as a separate study object. Nothing has been integrated into the live renderer or merged into main.

## Comparison renders

Each sheet contains **all eight directions**, current model on the left and tan knee pads on the right. The sheets are 390 pixels wide so the figures retain their labelled native pixel height when viewed at 1:1 on a phone-sized screen. Avoid browser fit-to-width scaling on a different-width display when judging exact size.

| Native figure height | All directions | What the comparison shows |
| --- | --- | --- |
| 40px | [40px sheet](sheets/all-directions-40px.png) | Human silhouette, helmet and pack read; individual pouches, hands and knee-pad construction mostly merge into a few pixels. Pads add little useful identification. |
| 60px | [60px sheet](sheets/all-directions-60px.png) | The receiver, stock/magazine and carrying posture become easier to distinguish. Pads start reading as equipment in frontal and quarter views, with a small overall effect. |
| 80px | [80px sheet](sheets/all-directions-80px.png) | Weapon handling, carrier/pouches and knee shells are clearer. This is a useful close observation scale. |
| 120px | [120px sheet](sheets/all-directions-120px.png) | Useful for equipment and pose inspection. Extra pad straps and camouflage detail are visible; this does not justify making the default soldier this large. |

[Eight-direction overview](sheets/eight-directions-overview-120px.png) · [SE pose detail comparison](sheets/low-ready-kneepad-detail-SE.png) · [Near-cover mobile view](sheets/mobile-cover-80px.png)

The [standalone review page](index.html) offers the four sizes, original/pad pairs, two captured game backdrops, a neutral backdrop and a magnified directional view. It uses actual native-resolution PNGs without enlarging the figures inside the labelled gameplay-scale panels. It is separate from the game's existing UI and animation laboratory.

Terrain zoom follows figure size by default (40px baseline: 1×, 1.5×, 2×, 3×), keeping world proportions comparable. Disable that control to inspect a larger figure against a fixed terrain scale. These are scale studies, not changes to the game's camera limits. The background images are actual paused-game captures; the figures are review composites, not live units. This does not validate live depth sorting or animation transitions.

## Findings and recommendations

**Keep the existing anatomy and boots.** At native gameplay size the character reads as an equipped adult infantryman. These comparisons provide no visible reason to change head, torso, leg or boot geometry.

**Keep the connected low-ready arrangement as the posing baseline.** The shoulders, elbows, wrists and finger bones have been posed around the unchanged rifle. The weapon moves with the complete posed assembly in every heading. It is not an independently rotated gun on a static upper body. This is one authored static pose, not a walking, aiming or firing animation set.

**Use the existing spectator zoom for 60–80px close inspection.** The difference from 40px is clearly larger than the knee-pad difference: weapon shape and equipment separation gain useful pixels. Retain an overview scale for following the battle; treat 120px as an inspection reference.

**Keep the knee pads optional.** The matte tan shell and straps look plausible at 80–120px, but make little difference at a 40px overview. Adopting them as an equipment detail is reasonable after visual approval; they are not a demonstrated fix for small-scale readability. They do not justify changing the rest of the leg or the boots.

The M16 is most recognizable in the side and quarter views. Its thin barrel and small hand details lose pixels at 40px. Rear views naturally hide much of the rifle behind the torso/pack, and front/rear views foreshorten it. Do not enlarge the rifle, detach it from the grip, or alter anatomy to force every item to be visible in every heading. No untested material/outline treatment is presented here as a proven improvement.

## Camera, pose and variant

The game projects tile axes as `(20,10)` and `(-20,10)` pixels in `src/view.js`. The matched orthographic camera uses **30° elevation and −45° azimuth**, with game Y mapped to Blender −Y. The tile-edge angle on screen is 26.565°; that is not the camera elevation. The renderer checks its projected axes numerically against the game before producing images.

Eight headings are actual rotations of the posed 3D assembly, not mirrored or rotated 2D pictures. All retain asymmetric equipment placement. The same camera, pose, lighting and foot anchor are shared by each current/pad pair.

The rifle is held about 30° below horizontal, across the front of the body. An analytic two-segment arm solve preserves arm lengths; wrist orientation and finger curl establish the grip. Both palm targets and wrist errors are recorded in [render-manifest.json](validation/render-manifest.json).

The optional pads have approximately 92×118mm matte tan shells, slightly larger fabric backing and two 18mm securing straps. Their surfaces follow the actual knee garment. No original vertices, UVs, textures or boot materials were edited. The original lower-body pose is retained.

## Checks and limits

- 64 native renders: 8 headings × 4 heights × 2 variants; 16 larger pose renders.
- Geometry is framed to the requested heights. At the 50% alpha threshold, rendered extents are 40, 59–60, 79–80 and 119–120 pixels; the one-pixel differences are antialiased boundaries. Actual values appear under every figure.
- Boot vertex displacement from the original rest pose is below 1 micrometre (floating-point tolerance). The original model and existing game/animation files are unchanged.
- The standalone page passed Chromium checks for native pixel display, clipping, size controls, context selection and portrait/landscape layout. Physical iPhone Safari testing remains unverified.
- Both backdrops use seed 2049, expanded layout 0 and spawn 0. Captures use the existing pause/camera controls. The overlay anchors were checked against the original navigation geometry and are on walkable tiles.
- Static render review cannot establish gait quality, recoil timing, live selection/occlusion correctness or game performance with these sprites. No such completion claim is made.

## Files and reproduction

`native/` contains transparent PNGs and `large/` contains the larger posed renders. `source/LowReady_Kneepad_Evaluation.blend` contains the posed original mesh and an independently hideable `Evaluation_Tan_Kneepads` object. Original A-pose exports remain in the parent asset directory.

From the repository root:

```sh
blender --background --python-exit-code 1 assets-3d/usmc-rifleman/source/USMC_Rifleman.blend -t 4 --python assets-3d/usmc-rifleman/isometric-evaluation/tools/render_evaluation.py
```

Set `AW_EVAL_STAGE=pose` first for the small pose quality gate. The browser scripts use Playwright and `/usr/bin/chromium`; set `AW_PLAYWRIGHT_MODULE` to the module's installed path when it is not resolvable as `playwright`. Run the unchanged Vite game on port 4256, then run `tools/capture_backgrounds.mjs` and `tools/capture_review.mjs` from this folder. The review URL is `/annous-warfare/assets-3d/usmc-rifleman/isometric-evaluation/`. No root Vite, game or deployment configuration changes are needed.
