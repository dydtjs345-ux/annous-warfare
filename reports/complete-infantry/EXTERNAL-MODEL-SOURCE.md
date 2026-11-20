# Phase 2 — authored crouch integration

**Stage A is partially complete: two externally authored crouch loops are integrated on the unchanged approved Tactical Suit.** Stance entry/exit and dedicated crouched rifle aim/fire/reload are not marked complete. Stages B–D have no new validated imports. The existing game and every pre-existing asset remain unchanged.

Branch: `feat/phase2-authored-crouch`, based on approved `420a0556b8bb4e66b4e94f18e916fa5b64b79776`. Implementation and deployment SHAs are recorded separately in `DEPLOYMENT.md` after publication. The new Korean page is `/phase2-crouch/`; the previous `/infantry-integration/`, `/tactical-suit-review/`, original Korean previews and combat test remain separate.

## Recovered and preserved

The latest approved build was recovered from `feat/tactical-suit-character-comparison`; remote branches were inspected and no newer working implementation was found. That build already contained the actual DanlyVostok **Military tactical suit (LowPolyGameReady)**, its 87-joint rig, M16 reference/attachments, imported walking and separate emergency sprint, original SR tactical sprint, and a reusable manual preview controller. It had not integrated the new authored crouch pair or a professional crawl/cover set.

`models/TacticalSuit_Phase2.glb` is a separate derivative. Its 15 external body meshes, two existing rifle/magazine meshes, all nodes, skeleton, materials, textures and attachment nodes are copied exactly. The four approved animation definitions, accessors and sampler data remain byte-identical. All **1,016** pre-existing repository files match their baseline Git blob IDs; no AI, squad-command, map or game file changed. No merge to `main` is performed.

| State | Exact preserved clip | Actual source | Duration |
| --- | --- | --- | --- |
| Idle | `SU_Project_Idle_Rifle` | Existing project `Lower_Idle` + `FB_LowReady_Upper` | 2.4 s |
| Walk | `SU_Quaternius_Walk_Rifle` | Quaternius UAL1 Standard RM `Walk_Loop`, CC0 | 1.333333 s |
| Tactical sprint | `SU_Project_TacticalSprint_Rifle` | Existing project `SR_Sprint_Lower` + `SR_Sprint_Upper` | 0.666667 s |
| Emergency escape | `SU_Quaternius_Sprint_Rifle` | Quaternius UAL1 Standard RM `Sprint_Loop`, CC0 | 0.666667 s |

The emergency clip is fast **forward** escape, not backward retreat with the weapon aimed at a pursuer. Its source speed and timing are preserved. Existing faction-specific weapon clips and reloads are unchanged. The new external-body crouch work currently uses the existing M16 reference only; there is no newly validated Russian/AK variant of this external body. Original USMC and Russian/AK models remain selectable for explicitly labeled legacy inspection.

## New clips

| New clip | Foundation actually imported | Duration | Classification |
| --- | --- | --- | --- |
| `P2_Quaternius_CrouchIdle_Rifle` | UAL1 Standard RM `Crouch_Idle_Loop` | 2.933333 s | External authored motion, retargeted/contact-adjusted |
| `P2_Quaternius_CrouchWalk_Rifle` | UAL1 Standard RM `Crouch_Fwd_Loop` | 2 s | External authored motion, retargeted/contact-adjusted |
| `P2_Legacy_CrouchIdle_Rifle` | Existing `TC_CrouchIdle_Lower/Upper` | 2.4 s | Legacy comparison retarget, not a new professional import |
| `P2_Legacy_CrouchWalk_Rifle` | Existing `TC_CrouchWalk_Lower/Upper` | 1.6 s | Legacy comparison retarget, not a new professional import |

The default comparison uses **the same actual external character on both sides**, comparing legacy motion with Quaternius motion. It does not present original USMC geometry as the external character. The separate older appearance comparison remains linked.

The new motions retain retargeted authored pelvis, spine, chest, clavicle and head motion. Semantic mapping covers root/pelvis, three spine regions, neck/head, clavicles, arm/elbow/wrist chains, hips, knees, ankles, toes and finger chains; source and target skeletons are inspected separately. The existing approved rifle carry/finger references and hand constraints adapt the unarmed source to controlled low-ready carry. They do not create a dedicated crouched aiming, firing or reloading clip.

The original Quaternius crouch walk contains approximately 15 cm of low-phase forefoot drift. Source toe-height samples define support phases and constant stance anchors; continuous swing corrections join those phases. Joint-only locking still left approximately 2.4 cm of actual boot-skin drift, so the final bake constrains a real deformed boot point using leg IK and source foot/toe orientation. No gait synthesis, random body sway or speed change is used. Source pelvis, spine and clavicle tracks are not replaced by a rigid weapon layer; arm and finger tracks are deliberately adapted to the existing two-hand rifle carry.

## Playback and transitions

The separate Phase 2 controller extends the existing system. Repeating a state does not restart it. New crouch idle/walk crossfades use the exported skin weights to maintain actual sole contact and rifle grip without stretching limbs or replacing pelvis/spine motion. A walk-to-idle request waits for the source support-cycle boundary, then blends. Immediate individual selection is explicitly pose/clip inspection, not a completed stand-to-crouch transition. The approved four locomotion states continue to use the previous controller behavior.

The Korean page provides all seven requested categories, individual actual-clip selection, eight headings, fixed 30-degree isometric, side and free inspection, native 1×/0.5× playback, nominal 60/80/120 px and enlarged views, hand/rifle/boot contact markers, crouch idle→walk→stop and preserved locomotion demonstrations. Unsupported actions are disabled when neither selected profile has a corresponding clip. An unsupported comparison panel shows a clear message rather than playing a substitute. Existing original-faction tactical clips are labeled legacy/unapproved, never new sourced work.

Recorded comparisons render the **final exported GLB** at native speed with identical character, camera, scale and lighting. Walk recordings contain a full 2-second imported cycle, idle recordings a full 2.933333-second cycle within 3 seconds. A world-space metre grid reveals real translation. Source periods/speeds differ: legacy walk approximately 0.482 m/s versus imported approximately 0.699 m/s. They are not retimed to conceal differences. Recordings show the clips; the live preview additionally applies transition/contact constraints.

## Validation

- Final GLB reimport: 87 joints, eight actual clips. Khronos validation: **0 errors, 0 warnings**.
- Approved appearance/rig/weapon data, four clip definitions/samplers and entire original binary prefix match exactly. All 1,016 earlier repository files remain unchanged.
- Final skinned mesh sampled at 480 Hz: maximum grounded reference drift approximately **0.0073 mm**; minimum body Z approximately **−0.057 mm**; selected contact point within **2.7 mm** of the floor; rifle at least **38.7 cm** above the floor; wrist-to-grip residual below **0.0014 mm**. These are geometric reference-point measurements, not proof of force balance or whole-sole adhesion.
- Actual Three.js controller tested on CPU at eight headings with 60/30/20 Hz normal-speed and 30 Hz half-speed steps. Idle/walk blends, delayed stops, repeated-state continuity, limb lengths, unsupported-state rejection and rifle contact pass. Maximum contact residual below 0.001 mm; no frame travel discontinuity above the 8 cm test threshold. This does not claim measured browser FPS.
- Authored walk retains approximately **16.08°** pelvis rotation and **16.08°** chest-relative-to-pelvis variation. Legacy comparison pelvis variation is 0°, chest-relative variation approximately 1.39°. Authored idle retains 3.33° pelvis and 5.06° chest-relative variation. The chest is relatively steady while the pelvis moves beneath it; no artificial shaking is added.
- Visual inspection: actual side/isometric full-cycle frames, rifle close-ups and controller transition frames are reviewed before publication; observations and media hashes are recorded in `validation/visual-review.json` and `recordings.json`. Fourteen actual controller poses covering idle→walk and cycle-aligned stop are mapped back to the exported skin. Actual boot and rigid-weapon geometry points verify the renderer mapping (maximum rigid-weapon mismatch below 0.001 mm). This is offline controller review, not a browser screenshot.
- Safari-targeted browser bundle builds, but browser GPU playback, actual iPhone Safari, device memory, thermals and FPS are **not verified**: this environment lacks the supported browser-control route. The preview caps drawing to 30 Hz at pixel ratio 1, caches the shared model, pauses while hidden and provides H.264/images as a lighter fallback. Narrow screens start with media and load 3D only when requested; closing 3D disposes its contexts and clears the source cache. Model transfer size is 5,534,192 bytes (about 5.28 MiB); actual mobile loading/memory must be measured on-device. The unchanged model has 40,483 triangles, 30,129 exported vertices and 22 images. Those images imply about 52 MiB of RGBA8 pixels before mipmaps and other allocations; two WebGL contexts may duplicate GPU image storage. This is a static budget estimate, not a measured device-memory result.

## Actual source evaluation and licenses

| Source | Download/file inspection | Result |
| --- | --- | --- |
| [Quaternius UAL1](https://quaternius.com/packs/universalanimationlibrary.html) and [UAL2](https://quaternius.com/packs/universalanimationlibrary2.html) | Actual free Standard and Standard RM GLBs, inventories and supplied CC0 license recovered/rechecked | Two crouch loops selected from UAL1 RM. No exact crawl, prone-to-stand, rifle crouch reload or cover/blind-fire set verified in these acquired free inventories. Pistol clips are not relabeled as rifle clips. |
| [Rokoko 11 Free Gun Animations](https://www.rokoko.com/resources/rokoko-mocap-11-free-gun-animations) | Listing accessible; archive remains registration-gated | No gate bypass, no archive acquired and no exact clip/license claimed verified. |
| [Kevin Iglesias Human Soldier Animations FREE](https://kevdev.itch.io/human-soldier-animations-free) | Actual official free archive and male Blender source: 117 joints, 66 actions; standing `HumanM@AssaultRifle_Aim01`, `…Aim01_Shoot01`, `…Reload01` verified | [Publisher terms](https://www.keviniglesias.com/#license) allow single-entity project use but restrict extractable standalone libraries/assets. No Kevin source or retarget is shipped in this public animation library. No exact crawl/cover/crouched reload found in acquired pack. |
| [ZenXChaos AnimationSets](https://github.com/ZenXChaos/ThirdPersonShooter-AnimationSets/tree/f19adc2ece4cab0f89c9236223abb97d4d2badea) | Three actual pinned FBX 6000 files, repository Unlicense; ufbx 0.23.1 now parses all three | `RevolverCrouchAimIdle` (3.2 s), `RevolverIdleL_LC` (0.1 s), `ShotgunAimIdle` (2.566667 s). Legacy bind/axis/root-height conversion remains unvalidated. Parsing is not a successful retarget; no Zen motion is presented as integrated rifle/cover work. |

Quaternius source GLB SHA-256: `be684571ed655a1b892c2c07e6e2aeca053b606c442d34004adaf1d944090d01`. Character: **DanlyVostok / 1799danly**, actual Military tactical suit (LowPolyGameReady), **CC BY 4.0**, original credited mirror/normalization provenance preserved. The new file adds tracks; appearance remains unchanged. Full license text, creator/model links, modification notice and source hashes are retained in `licenses/ATTRIBUTION.md`, `research.json` and the earlier provenance folders. Existing project rifle/legacy motion are reused as authorized inputs; no independent external weapon license is invented.

## Remaining work

Stage A still needs an appropriate distributable authored foundation for standing↔crouch and crouched rifle aim/fire/reload, plus user visual approval of the two imported loops. The selected source has a deep, forward-leaning stealth crouch; it may not suit every upright military crouch style.

Stage B needs a genuine authored prone/crawl source with coordinated torso/pelvis and ground support. The current project crawl is preserved as an **unapproved** candidate. Stage C needs genuine cover entry/exit, left/right lean/peek/fire, low-cover and distinctly blind-fire clips. Stage D retains existing reloads until an actually better, legally redistributable source is validated. No missing action is synthesized or connected to invented AI states.

Use `tools/README.md` and the committed source/contact/retarget/skin/controller reports to continue without rebuilding recovered work. The Zen legacy reader probes are retained for the unresolved converter investigation.
