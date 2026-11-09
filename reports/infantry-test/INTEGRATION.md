# Infantry 6v6 visual integration

This is a separate test, based on main `b381e60`. No AI, simulation, world, map, combat constants, medical code, or fixed 0.05-second step was changed. Main and the standalone Korean preview are not deployed or overwritten by this branch.

## Source inspection

Main uses Phaser 3.90, Graphics drawing and small 2D sprite prototypes, Vite, a distance-driven presentation observer, interpolated positions and depth `(x+y)*100`. Only USMC rifleman #1 had a limited SE animation integration. The playable default map is the existing expanded urban map, with six units per team (leader, three riflemen, LMG, medic).

The source assets are NOT merged into main:

| Branch | Revision | Content |
| --- | --- | --- |
| `feat/usmc-rifleman-3d-apose` | `aba8585` | Reviewed USMC geometry and portable sources |
| `feat/russian-infantry-base` | `1ab40c2` | Shared-rig Russian infantry / AK-74M |
| `feat/shared-infantry-combat-animation` | `a1d2804` | Layered combat animation foundation |
| `feat/tactical-reload-polish` | `a93cbae` | Coordinated reload handling |
| `fix/infantry-upper-body-motion` | `5481fc8` | Full-body locomotion, aim and recoil corrections |
| `feat/infantry-sprint-rebuild` | `66d3892` | Preserves 34 earlier clips; adds 10 rebuilt sprint layers |
| `feat/infantry-preview-ko` / later descendants | `3da1cd5` | Korean standalone preview, preserved at its existing separate URL |

**No approval of the newest sprint was found.** Its README explicitly says “awaiting visual approval.” This test labels it a candidate and offers the previous FB sprint. It does not assert that the candidate is approved. Original source branches, GLB contents, animations and preview hosting are preserved. Copied GLB checksums are in the generated atlas manifest. The original .blend and FBX sources remain on their source branches.

## Rendering

An offline Three.js 0.170.0 baker evaluates the original GLBs with their synchronized lower/upper masks, lighting and additive recoil. A fixed orthographic camera at 30° bakes eight real 3D headings. The battle runs entirely in Phaser: no runtime Three.js, skeletons or additional WebGL contexts are needed. There is no game-engine rewrite.

Frames have a single shared ground anchor and uniform standing reference of 39 world pixels. Image positions come from the existing `MotionPresentation` buffer. They never move a simulation unit. Depth uses the existing unit/obstacle ordering. A 100ms anchored crossfade softens direction and action changes. Firing uses alternate additive recoil samples at the **same** locomotion phase. Distance accumulates gait phase across state changes; repeat observations cannot restart a walk. Pausing freezes the visual clock and distance phase. Reload progress is taken from the simulation and retimes each faction's complete torso/rifle/magazine performance to its actual reload timer.

The LMG role has no validated 3D weapon or reload in any inspected branch. It uses a weaponless copy of the correct new faction body with the game's existing generic LMG silhouette overlaid. LMG reload and mounted/bipod actions retain the original full renderer. This is explicitly a hybrid fallback, not a new M249/PKM model or weapon-specific LMG reload.

## AI mapping

| Actual evidence | Visual |
| --- | --- |
| Active, stationary, no higher-priority action | `Lower_Idle` + `FB_LowReady_Upper` |
| `presentation.moving` and not brisk/aiming | `FB_Walk_Lower` + `FB_Walk_Upper` |
| Actual movement plus existing `presentation.brisk` | `SR_Sprint_Lower` + `SR_Sprint_Upper` candidate; previous FB pair selectable |
| `Aiming` / `Engaging` plus direct contact | `Weapon_Raise`, then `FB_AimIdle_Upper` |
| Real `shot` / `lastShotAt` / `CombatVisuals.flash` | Aim stance plus `FB_Recoil_Shot` additive sample |
| Moving plus actual aimed state | `FB_AimWalk_Lower` + `FB_AimWalk_Upper` |
| Moving plus actual shot event | Same aim-walk phase plus additive shot sample |
| `presentation.reloading` / interpolated reload progress | Faction GLB `FB_Reload_Lower` + `FB_Reload_Upper` (M16A4 / AK-74M) |
| Observed moving → idle | `Stop_Walk` settling, without moving the unit |
| Actual stationary heading change | `Turn_Left` / `Turn_Right` + corresponding upper layer; source yaw compensated during baking |
| Full concealment, crawling, medic treatment, grenade handling, LMG mount/reload, death/incapacitation | Existing renderer; actual action and readability cues retained |

The AI has **no separate Sprint command**. Existing `brisk` has hysteresis above 1.45 / below 1.1 tiles/s; healthy movement is 1.7 tiles/s. This is an existing speed observation, not a new behavior. Locomotion is distance retimed, so in-game clips do not necessarily play at their original 3.6m/s source speed. There is no independent moving-fire command either, but real movement/shot overlap does occur (recorded in `simulation.json`). The `infantry-trigger.html` page clearly labels visual-only samples and never accesses the battle.

## Reproduce

```
npm ci
node tools/infantry/bake.mjs
AW_BAKE_LMG=1 node tools/infantry/bake.mjs
AW_BAKE_ANCHORS=1 node tools/infantry/bake.mjs
python3 tools/infantry/compress.py
npm run test:infantry
npm test
npm run build:infantry
node scripts/browser-infantry.mjs
```

The baker and automated browser test use an installed Playwright module; set `AW_PLAYWRIGHT_MODULE` if necessary. They need Chromium and loopback sockets. The image compressor needs Pillow. Lossless WebP is supported by modern iPhone Safari. Build output is `dist-infantry/`; root `index.html` is the test entry, with `infantry-test.html` and the visual-only trigger route retained. No original 3D GLBs are downloaded by gameplay. `?quality=legacy` starts directly in the original renderer and skips every infantry texture, providing an actual loading/memory fallback. Switching quality reloads the match and preserves the seed; it is not a seamless in-match switch.

## Validation and limits

`npm test` passed the entire existing repository suite. `simulation.json` compares adapter-on versus adapter-off combat hashes and RNG counts for seeds 7, 19 and 42 on the unchanged expanded map, up to 120 simulation seconds each (or normal battle completion). Real-action coverage includes sprint/brisk, walk, shot, reload, suppression, damage, treatment ticks/completion and casualties. A separate phase check verifies that a shot does not reset moving feet.

New source clips for medic treatment, prone/full concealment, grenades, casualties and LMG handling are absent. These states deliberately use the existing renderer and remain visibly distinguishable; a fully new-model-only battle is not claimed. Injuries and suppression still come from the original simulation and retain their cues; there is no newly authored injury/suppression performance. Turning is quantized to eight headings; arbitrary-angle independent upper/lower aiming and terrain IK are not implemented. Reload blending follows original object ownership rather than inventing magazine attachment physics. Dense close-up animation quality still needs human review.

Browser and asset metrics are in the adjacent JSON reports. Desktop Chromium with touch/phone layout is not physical iPhone testing. WebKit results are reported only if that engine actually runs. GPU texture estimates exclude driver overhead, browser decoding copies, environment textures and framebuffer allocations. Do not represent measured cloud-renderer FPS as iPhone FPS.

## Measured browser findings

The final built artifact passed Chromium phone-layout checks: all 12 new faction bodies at map overview, portrait/landscape, real brisk movement, walking, firing, moving fire and reloads; pause phase stability; trigger controls; and the zero-atlas-request fallback. There were no page errors or failed requests. The checks run active combat at 4× simulation speed on a desktop software renderer, so these are not phone hardware benchmarks.

Cold local browser navigation to the ready battle took 1.56s. Sampled combat rendering at 4× simulation speed ranged from 30.6 to 58.2 FPS (median 39.2); median rolling p95 frame time was 31.7ms. Local loopback loading is not a mobile-network loading benchmark.

Lossless atlas transfer is 4,291,022 bytes (4.1 MiB); decoded RGBA textures total 125,829,120 bytes (120 MiB). The complete static test bundle also contains Phaser, the existing environment/prototype assets and controls. No source GLB is included in its runtime downloads. The explicit legacy start mode skips the new images and their texture allocation.

Playwright WebKit was downloaded, but launch failed because seven system libraries are missing (`libgtk-4`, `libgraphene`, `libwoff2dec`, `libharfbuzz-icu`, `libhyphen`, `libmanette`, `libGLESv2`). Neither a scoped system package installer nor sudo is available. WebKit and physical iPhone Safari remain unverified. A physical iPhone should still be used to assess heat, memory pressure, touch comfort and sustained frame rate before any production merge.

Separate hosting origin: https://autonomous-warfare-infantry-combat-test.companionablejellyfish2.chatgpt.site/
The delivery records the deployment result and HTTPS verification; this branch never invokes the live game's Pages deployment.
