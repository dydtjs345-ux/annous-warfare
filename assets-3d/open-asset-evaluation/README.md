# Open animation asset evaluation

This is an evaluation branch, not an animation replacement or a game release. Two external motions were obtained, retargeted and inspected on both existing infantry models. **Forward crawl remains blocked by source availability.** No crawl was synthesized to fill the gap.

Branch: `feat/open-animation-asset-evaluation`, based on `cfded5ca6e77bd508dbf175287a988776092362a`. All 842 previously tracked files are byte-identical, including both original rigs, existing sprint/walk/fire/aim/reload clips, prior crawl revisions, the Phaser game, AI and map. Nothing is merged into main.

## Actual files inspected

| Source | Download and license evidence | Result |
| --- | --- | --- |
| Quaternius Universal Animation Library 1 Standard | Actual ZIP, both GLBs and FBXs listed; embedded `License.txt` explicitly **CC0 1.0**. Official pack page also says CC0. Downloaded the pinned public mirror in `cktang88/3d-fps`; hashes recorded. | 43 clips in each GLB variant. Selected `Walk_Loop` and `Sprint_Loop` from the root-motion GLB. No forward crawl in this Standard release. |
| Quaternius Universal Animation Library 2 Standard | Actual ZIP downloaded; main GLBs inspected, included FBXs and female mannequin source inventoried; embedded **CC0 1.0** license retained. | 43 clips per main GLB. `Walk_Carry_Loop`, `Slide_*`, `LayToIdle`, `Hit_Knockback` are potentially useful. No forward crawl. No new clips retargeted from this pack. |
| Earlier UAL1 Standard on OpenGameArt | Downloaded the actual creator-uploaded ZIP, inspected its GLB and license. **CC0 1.0**. | 46 actual GLB clips, including `Punch_Enter` and root-motion roll/sword variants. Still no crawl. |
| Adobe Mixamo | Official FAQ and Adobe-hosted distribution guidance reviewed. Public animation API returned **HTTP 401**, `Oauth token is not valid`. No Adobe account/token supplied. | No animation files acquired or visually evaluated. Candidate searches for rifle walk/sprint/crawl remain unverified. Royalty-free project use is allowed; raw animation/character redistribution is restricted. **Do not put Mixamo FBXs/retargeted raw clips in this public asset collection.** |
| `cktang88/3d-fps` | Inspected pinned README, animation research, `Character.js`, BVH retargeter and FPS effector retargeter. Actual Standard ZIPs and credited character GLBs downloaded. | Useful integration reference. Code has no root LICENSE at the inspected commit: studied, not copied. Asset-specific licenses apply. Its `prone_crawl` is not a clip in either downloaded Quaternius pack or BAMEN's zero-animation Sketchfab listing; provenance is insufficient for adoption. |
| Sketchfab military models | Public model API verified exact license URL, author, description and downloadable flag. Actual credited mirror GLBs inspected for two models; direct official download endpoint requires authentication. | See model-specific table below. No external model replaced an existing soldier. |

Pinned reference repository: https://github.com/cktang88/3d-fps/tree/130ac2a5c856401ec36e7d35afcfefe40c5801f4

Do not infer license terms from the Quaternius name alone. This evaluation pins the specific archives whose included license says CC0, cross-checked against the pack-specific official pages. It does not assume every current Quaternius pack has the same terms. Pro/Source editions are paid downloads; none was purchased or extracted from a preview viewer.

## Action suitability from actual clip inventories

| Needed action | Actually acquired candidate | Assessment |
| --- | --- | --- |
| Walking | UAL1 `Walk_Loop`, `Walk_Formal_Loop`; UAL2 `Walk_Carry_Loop` | `Walk_Loop` is the best simple sample. Full-body unarmed gait, not a rifle walk. Retargeted below. Formal/carry styles were inventoried, not adopted. |
| Sprinting | UAL1 `Sprint_Loop` | Full-body, pronounced chest/pelvis counterrotation. Retargeted; stylized athletic sprint and very fast native root travel. Requires tactical carry/contact/speed adaptation before gameplay use. |
| Crouched movement | UAL1 `Crouch_Fwd_Loop`, `Crouch_Idle_Loop` | Real clips exist. Available for a future evaluation, not retargeted in this three-action scope. |
| Forward crawling | None in the acquired UAL1/2 Standard or older free Standard | **Unavailable.** Paid UAL1 Pro advertises crawl variants, but those exact files and their quality were not inspected. Mixamo download is login-blocked. No swim cycle or unproven `prone_crawl` relabeled as military crawl. |
| Aiming | UAL1 `Pistol_Aim_Neutral`, `Pistol_Aim_Up`, `Pistol_Aim_Down`, `Pistol_Idle_Loop` | Pistol-specific, unsuitable as direct two-handed M16A4/AK-74M rifle motion. |
| Firing | UAL1 `Pistol_Shoot` | Pistol-specific; cannot directly replace rifle firing. Existing firing preserved. |
| Dying | UAL1 `Death01` | Available full-body candidate; not retargeted or visually qualified in this limited sample. |

The source catalogs market more actions than the free Standard archives contain. Inventory results, not marketing descriptions, determine availability here.

## Retarget sample

New animation-only files:

- `models/USMC_QuaterniusSamples.animation.glb`
- `models/Russian_QuaterniusSamples.animation.glb`

Each contains only `OA_Quaternius_Walk` and `OA_Quaternius_Sprint`. They use the existing exact target node names, hierarchy, rest transforms, 163 joints and existing weapon parents. They can be played on a copy of either original full model. These full-body samples must play alone at weight 1; the existing held aim/upper-body layer would suppress the imported spine/arm motion. No game state is connected to them.

`source/UAL1_Standard_RM.glb` is the unmodified downloaded CC0 source file, SHA-256 `be684571ed655a1b892c2c07e6e2aeca053b606c442d34004adaf1d944090d01`. Its other clips are retained as source material, not new retargeted deliverables.

The new offline retargeter samples original LINEAR/slerp tracks at their native 30 Hz. It transfers pelvis/spine/clavicle/head/hand/foot rotation deltas and the source limb directions/twist through a documented semantic map, then writes target keyframes. Bone lengths and target bind transforms stay fixed. Source root/pelvis translation is scaled by bind pelvis-height ratio, approximately 1.0297. The 52 mapped source pose joints drive 60 target joints (shared source toe roll drives each toe base); source motion-root transforms are included through the evaluated pelvis. Authored finger curls and toe articulation are transferred. Extra target torso/limb helpers and metacarpals inherit motion at their existing rest offsets. No gait is reconstructed with sine waves, a pose generator, a procedural crawl, IK, contact locking, a held torso, noise, or time warping.

| Motion | Native duration | Retargeted root travel | Native speed after body scale |
| --- | --- | --- | --- |
| `Walk_Loop` | 1.333333 s | 1.338617 m | 1.003962 m/s |
| `Sprint_Loop` | 0.666667 s | 5.663379 m | 8.495068 m/s |

These velocities are source measurements, not changes to combat movement. The sprint does not match the current game's tactical movement speed without future stride/contact work.

## What genuinely works and what fails

Both rigs accept the imported animation data. All target segment lengths stay fixed; independent pelvis, thoracic and clavicle motion survives export and Blender reimport. The maximum reimport bone-position discrepancy is under **0.007 mm**. This proves data transfer, not realism or gameplay readiness.

| Check | Original walk / latest sprint | Imported walk | Imported sprint |
| --- | --- | --- | --- |
| Pelvis rotation range | Existing motions preserved | 6.27° | 10.54° |
| Chest relative to pelvis, maximum pairwise orientation difference | Walk 9.19° / sprint 15.65° | 11.32° | 60.43° |
| Lowest deformed soldier vertex above ground | Walk +1.9 mm / sprint +3.0 mm | **−53.0 mm** | **−102.7 mm** |
| USMC left wrist distance from its original rifle-grip reference | Approximately 0 | **up to 593 mm** | **up to 628 mm** |
| Russian left wrist distance from rifle-grip reference | Approximately 0 | **up to 588 mm** | **up to 611 mm** |
| Weapon/ground clearance | Existing handling preserved | USMC ≥581 mm; Russian ≥587 mm | USMC ≥647 mm; Russian ≥653 mm |

The last two wrist measurements compare to a fixed weapon-local wrist reference from the original walk. They are alignment diagnostics, not palm-contact or finger-wrap measurements. The right wrist remains attached to the weapon mount within 0.001 mm, but that does not make the left-hand grip correct. The sprint renders also show rifle/vest overlap as the right arm swings across the body. A one-handed swinging rifle is not approved tactical weapon handling. Joint-angle ranges measure motion, not center of mass or realistic support forces. The shared-speed video setup is not a measurement of the original gait's native foot sliding.

Source inspection found that UAL1 `spine_01` itself has a constant local orientation in these two clips. Motion is present in pelvis, `spine_02`, `spine_03` and clavicles; it is not being lost to a playback layer. The source chest/pelvis ranges match the retargeted ranges. The sprint's large 60.43° counterrotation is authored in the source, not added by the retargeter. It is an exaggerated unarmed style, not automatically more convincing for an equipped infantryman.

On the source mannequin, lowest mesh Z is approximately −26.4 mm for walk and −0.6 mm for sprint. Target proportions/boot geometry add contact error, particularly on sprint. The raw imports need foot/ankle/rest-pose calibration and contact-aware cleanup; raising the entire character would hide penetration while introducing floating. No contact pass has been applied in this evaluation. No claim of zero foot sliding is made.

**Verdict:** walk is a useful source-motion/retarget candidate, with moderate torso participation, but needs rifle handling and ground-contact adjustment. Sprint transfers real full-body motion but needs substantial tactical carry, contact and velocity work; its athletic exaggeration may remain unsuitable. Neither is a drop-in replacement. No acquired motion can currently be recommended for military forward crawl. Preserve existing game clips while selecting a better armed source.

## Side-by-side visual review

Eight videos cover both factions × walk/sprint × side/fixed 30° isometric camera. Each is rendered from actual reimported GLB animation, not generated illustration. Original is left; import is right. Cameras, orthographic projection, character geometry, lighting, ground, frame timestamps and **1× playback** match. The unused `SpareMagazine` reload helper is hidden consistently in both panels; primary weapons and magazines remain visible. This is preview visibility only, with no asset or body-motion edits. No slow/fast retiming is used. The original native cycle remains 1.2 s for walking and 0.666667 s for the current `SR_Sprint` pair; imported native cycles are preserved independently. Both sides use the imported sample's measured ground speed for the comparison; this is an explicitly isolated visual test, not the game's movement speed. Imported root motion and cumulative loop travel remain intact.

Walk recordings show one complete imported cycle (1.333333 s); sprint recordings show one complete imported cycle (0.666667 s), both at 24 fps. Their automatic video repeat is an excerpt cut. It is not an animation blend or an assessment of the original walk's loop seam. Optional live WebGL playback uses native clip loops continuously; it is marked unverified in this environment. The default presentation is the inspected pre-rendered MP4 comparison, with no model loading required. HTTP testing found that the host ignores byte ranges and returns HTTP 200 with the entire clip. The preview fetches the selected small MP4 into a local Blob for seeking, and offers a static four-phase image comparison. Browser execution of that fallback remains unverified.

The original baseline comes from the preserved tactical model. Walk uses `FB_Walk_Lower/Upper`; sprint uses **`SR_Sprint_Lower/Upper`**, the pair referenced by the existing infantry test atlas. The older `FB_Sprint` is not substituted for the latest sprint.

## Sketchfab model evaluation

Full credit and model-specific API evidence are retained in `licenses/Sketchfab-*.json`; CC-BY legal text is included. The public API's exact license URL was `http://creativecommons.org/licenses/by/4.0/` for these three models. Direct `/download` returned “Authentication credentials were not provided.” No protected viewer cache was scraped.

| Asset / creator | Actual file inspection | Decision |
| --- | --- | --- |
| [FREE [Military Soldier] RIGGED](https://sketchfab.com/3d-models/free-military-soldier-rigged-e9c56308a67d4a3db62e914fafa4d198), **BAMEN / bamenwo05**, CC-BY 4.0 | Credited `soldier.glb` mirror downloaded: 3,094,592 bytes, 78 joints, one mesh, 50 added animations. Official Sketchfab listing has **0 animations**. Mesh/rig inspected; static geometry rendered. | Promising inexpensive modern military mesh/rig reference. Existing faction rigs remain preferable for this sample. The mirror's extra clips are not attributed to the model author without evidence; `prone_crawl` is not adopted. |
| [Military tactical suit (LowPolyGameReady)](https://sketchfab.com/3d-models/military-tactical-suit-lowpolygameready-ef698ce36b1545a78ce592dd3db4c7ed), **DanlyVostok / 1799danly**, CC-BY 4.0 | Credited `soldier_tac.glb` mirror downloaded: 4,532,132 bytes, 15 meshes, 88 joints, zero animations. The mirror's skin/bind scales fail in Blender inspection; raw geometry parsed; inspection render still fails after disabling armature deformation. | License verified for the listed mesh. This is a failure of the evaluated mirror/import path, not a verdict on the creator's original download. **Not validated as a drop-in animated rig**; obtain original download and resolve bind/scale before use. |
| [AMERICAN SOLDIER RIGGED](https://sketchfab.com/3d-models/american-soldier-rigged-5b1967e7f83547be8a1c3ae656ab1ad4), **RedVeil studio / matheofrelin3**, CC-BY 4.0 | Official API: downloadable, 9,710 faces, 5,115 vertices, one animation. No authorized binary acquired. | License/listing verified; rig and animation quality **not file-verified**. Do not claim tested. |
| “German Bundeswehr soldier - rigged”, **42manako** | Listing says model ripped from *Call to Arms*, despite CC Attribution badge. | Rejected for rights provenance; not downloaded or used. |
| “Ukrainian Azov fighter - rigged”, **42manako** | Listing says base uniform ripped from *Call of Duty*. | Rejected for rights provenance; not downloaded or used. |

A listing license is not proof that an uploader owns ripped commercial game content. NC, ND, editorial and unclear-source models were not used.

The inspected Sketchfab mirror files remain outside the repository download cache. Published inspection renders credit their creators, source links, CC-BY 4.0, and the inspection modifications (normalization and pose reset; the Danly image records a failed inspection, not a visually validated rig). No new soldier model has been shipped to the game or preview comparison.

## Validation and limits

- Both animation-only GLBs: Khronos validator **0 errors / 0 warnings**.
- CPU-only Three.js `AnimationMixer` playback of the actual exported clips matches the retarget transform samples on both rigs, with one full-body action at weight 1 and no upper-body overlay. This is not browser/GPU QA.
- Both original 163-joint targets survive retarget and GLB reimport. Recorded mapped bone transforms match the reimported playback within 0.007 mm.
- Deformed-mesh ground clearance, weapon clearance, wrist alignment, source and target rotation tracks sampled from actual files. Failures above are deliberately retained, not described as passed.
- Full rendered frame sequences and contact sheets were inspected, including planted/swing phases and opposite torso rotation phases.
- Every previously tracked repository file remains byte-identical. Existing live game and all prior preview routes are preserved.
- Browser QA is unverified: the required managed `cua_repl.js` browser interface is unavailable. The [Sites SKILL.md](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/SKILL.md) states: “If `cua_repl.js` is unavailable, skip browser QA: do not start a preview server, install a browser, or improvise another browser-control path.” No substitute browser route is used. Physical iPhone/Safari, live WebGL performance, loading time and FPS are **not measured**. The default MP4 comparison is a lightweight alternative to loading two animated 15 MB soldiers. All eight clips total 3,477,207 bytes; the initial USMC side-walk clip is 340,397 bytes. This is a payload measurement, not a loading-time or RAM benchmark.
- No AI mapping, map, timing or live-game deployment changed. No new tactical motions were authored, and no external gait was recreated procedurally.

To complete the missing crawl sample, obtain the authorized UAL1 Pro/source crawl file with its included license, or an authorized licensed crawl export suitable for team-only evaluation. A Mixamo export cannot be treated as CC0 or committed here as a redistributable raw asset.

See `validation/` for archive hashes, exact clip inventories, retarget map/transform samples, reimport/ground/weapon results, model metadata and preservation checks. `DEPLOYMENT.md` records the verified preview publication and final commits.
