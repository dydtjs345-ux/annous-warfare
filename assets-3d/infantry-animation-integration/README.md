# Recovered infantry animation integration

Separate review branch: `feat/tactical-suit-character-comparison`. The playable game, AI, map, original models/animations and all previous preview routes are preserved. Nothing is merged to GitHub main.

## Recovered stopping point

Remote branches, recent commits and PRs were checked on 2026-11-16. Main remains `b381e6017d01fa34f14e889ff639347db9e5feae`; the latest published asset-evaluation branch was `feat/open-animation-asset-evaluation` at `b350f9e469f77c2ea5f56041a7e216538c3f470e`. PRs #23/#25 concern the existing 6v6 branch; #24 is the older tactical set. None contains a newer Tactical Suit or emergency-retreat integration.

The local `feat/tactical-suit-character-comparison` branch still pointed to `b350f9e`, with uncommitted actual-character assets and the earlier page's labeling correction. The actual licensed mirror had been repaired/imported successfully; Quaternius walk/sprint had been retargeted with M16 grip and sole cleanup. The phase renders finished after the interruption, but comparison packaging, source commit and publication had not happened. There was no previous emergency-retreat state, unified external-character controller or completed free-cover import. Those are not inferred from conversation claims.

Recovered work was committed and pushed as **`8e7b05e`** before continuing. The old `/open-asset-review/` remains a motion-only comparison on the original models. The new `/tactical-suit-review/` displays the actual green Tactical Suit versus the tan USMC model, with separate appearance and motion sections. The real model's creator, UID, license, credited mirror and hash are documented, rather than calling an original USMC mesh the imported character.

## New implementation

- Retargeted **existing idle** and the **existing `SR_Sprint_Lower/Upper` tactical sprint** onto the already validated Tactical Suit skeleton. These reuse source motion, not newly generated gaits. The original two imported clips and all existing source assets remain unchanged.
- `models/TacticalSuit_Integrated.glb` copies the validated actual character's geometry, nodes, materials, textures and skin exactly, then appends two project-source animations. It contains 15 actual character meshes plus the M16 and magazine, 87 joints, and four full-scene clips.
- Added a reusable, preview-only state catalog/controller for original USMC, original Russian and actual Tactical Suit profiles. It keeps full-body external clips separate from the original disjoint lower/upper pairs. Repeating a state does not reset it. Moving fire uses additive recoil without restarting gait. Weapon-specific reload object tracks remain separate, and hands remain free during reload.
- Added contact constraints for the external rig during crossfades. They solve arms/hands to the controlled rifle without changing pelvis/spine motion, adding shake or stretching limbs. Legacy profiles retain authored poses; their probe uses state-specific grip references so a legitimate alternate handguard grip is not confused with detachment.
- Root displacement is extracted into continuous world translation in the external preview, including the separate rifle node. Switching states preserves world position. Original display-normalization scales translation consistently; external tactical sprint travels about **3.156 m/s**, matching its 0.876618 leg-length retarget ratio. Its source normal sprint remains 3.6 m/s before display normalization. No combat speed or timing changes.
- **EmergencyRetreat** explicitly selects the imported Quaternius sprint only on the external rig. Its native travel is about **7.693 m/s**. This is a forward escape candidate, not backwards retreat, target-facing retreat or an AI behavior. The large source torso counterrotation remains; it is not approved as a replacement tactical sprint.
- Recovered the latest existing torso-crawl review patches for both original factions as a separately named candidate. Original forward crawl remains selectable. No imported crawl is fabricated.

| External output clip | Source | Role | Duration |
|---|---|---|---:|
| `SU_Project_Idle_Rifle` | Existing `Lower_Idle` + `FB_LowReady_Upper` | Idle | 2.4 s |
| `SU_Quaternius_Walk_Rifle` | CC0 `Walk_Loop` | Walking | 1.333333 s |
| `SU_Project_TacticalSprint_Rifle` | Existing `SR_Sprint` pair | Normal tactical sprint | 0.666667 s |
| `SU_Quaternius_Sprint_Rifle` | CC0 `Sprint_Loop` | Separate emergency-escape candidate | 0.666667 s |

The catalog also exposes original idle/walk, crouch/prone movement, weapon raise, aim/fire, moving fire, faction-specific reload, cover entry/exit, both leans, corner aim/fire, rise/fire/lower and return behind cover. These are reused existing clips, not newly approved external animations. **BlindFire and CrouchReload have no acquired validated clip.** Selecting an unsupported action shows an unavailable message; it does not silently play aim/fire or invent an AI state. On the external rig, aim/fire/reload/cover/prone are still unsupported. The existing Russian model and AK clips are available; there is no newly created Russian skin/AK variant of the Sketchfab character.

## Free-source evaluation

Actual files and license evidence are separated from listing claims in `research.json` and `validation/free-source-inspection.json`.

| Source | Actually acquired / inspected | Finding and adaptation needed |
|---|---|---|
| Rokoko — 11 Free Gun Animations | Official page inspected; archive not acquired because registration is required | Publisher describes full-body/finger, Mixamo FBX, 30 fps and commercial project use. Exact pack contents and cover clips cannot be file-verified. Needs authorized pack download; no gate bypass. |
| Kevin Iglesias — Human Soldier Animations FREE | Official zero-price Godot/Unreal ZIP downloaded; male Blender file imported: 117-joint rig, 66 actions | Actual assault-rifle aim, shoot and reload have varying pelvis/spine/chest tracks, with shoulder tracks in fire/reload. Closest armed sources for aim/fire/reload; not a cover suite. No crawl, left/right cover lean, blind fire or crouched reload found. Requires rig/weapon retarget and contact work. The current single-entity license prohibits redistribution as an extractable standalone animation library, so no raw/retargeted Kevin motion is published here. Import/track inspection does not establish visual quality. |
| ZenXChaos — ThirdPersonShooter-AnimationSets | Pinned repository inventory/license plus three actual FBXs downloaded | Repository supplies Unlicense. `RevolverCrouchAimIdle`, directional `RevolverIdleL_LC`, and two-handed `ShotgunAimIdle` are closest inspection candidates, not verified cover actions. Blender rejects FBX version 6000 (needs ≥7100). Requires a legitimate compatible conversion path; revolver grip/aim direction must not be mislabeled as rifle cover lean. No successful motion playback/retarget claimed. |
| Quaternius Standard libraries | Previously acquired UAL1/UAL2 inventories and licenses recovered; files checked again | CC0. Walk and sprint actually used. Crouch and pistol/shotgun aiming/fire exist in the inventories, but no free Standard crawl or exact rifle cover/blind-fire sequence. Weapon-specific grip/morphology adaptation is required; unarmed or handgun poses are not automatically rifle cover motions. |

Priority coverage: existing original-rig clips already provide left/right lean, corner aim/fire, low-cover rise/aim/fire, return and crouch fire for review. Exact new third-party cover clips were not acquired. **Blind fire, crouched reload, new imported crawling and a validated external-model cover suite remain unfinished.** No paid or gated source is silently substituted.

## Korean preview

`/infantry-integration/` provides two selectable profiles, side-by-side view, fixed 30° isometric camera, side/free inspection, eight facing directions, 1×/0.5× playback, nominal 60/80/120 px and enlarged inspection scales, wrist/grip markers, continuous world movement, original-faction cover demonstration and the recovered crawl review sequence. A preset compares both sprint roles on the same actual external model. All controls are manual preview triggers. Map and AI are untouched.

`/tactical-suit-review/` contains the separate original-USMC/actual-Suit appearance comparison and walking/sprinting recordings. New same-Suit tactical/retreat sprint videos and phase sheets isolate motion on identical character geometry. Cameras, scale, lighting and native playback speed match. Different native root velocities are retained to avoid faking equal foot speed. The right-hand Quaternius frames are reused from the interrupted, already finished captures: geometry and those clips are copied unchanged into the integrated GLB. No full recapture or model recreation was needed.

## Validation

- Actual integrated GLB: Khronos **0 errors / 0 warnings**. Source normalization and geometry identity proofs retained.
- Added tactical sprint reimported and sampled at 480 Hz: maximum wrist/reference error **0.00309 mm**, lowest body vertex **−0.544 mm**, rifle ≥**0.723 m** above ground.
- Added idle reimported at 480 Hz: maximum wrist/reference error **0.00139 mm**, lowest body vertex **−0.00053 mm**, rifle ≥**0.866 m**.
- Existing imported walk/sprint retain their prior checks: maximum wrist errors **0.0012 / 0.0439 mm**, worst ground penetration **0.031 / 2.518 mm**. Contact is not claimed perfect.
- The **actual new controller**, not a separate mock, runs under CPU Three.js on 43 states per original faction and four external states across eight headings. Same-state walk, moving-fire gait continuity, reload hand release, unsupported-state rejection, continuous translation and crossfade contact constraints are checked. CPU results do not establish browser rendering or skin/weapon collision.
- Actual exported motion rendered/reviewed in side and isometric phase sequences, including the two sprint roles on the real external character, plus idle and opposing rifle-hand close-ups. Captured videos have verified H.264/yuv420p/24 fps encoding.
- Original cover entry/exit can vary wrist position approximately 4.2 cm (USMC) / 4.8 cm (Russian) from the state's initial grip reference. This is a motion/contact-review flag, not a nearest-surface collision measurement or proof of detachment. Legacy cover/crawl transition endpoints still need visual approval before gameplay use.
- Browser execution, WebGL FPS/memory and physical iPhone Safari remain **unverified**. This managed environment has no `cua_repl.js`. The [Sites skill](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/SKILL.md) explicitly says: “If `cua_repl.js` is unavailable, skip browser QA: do not start a preview server, install a browser, or improvise another browser-control path.” Build, CPU, exported-model visual and anonymous HTTPS checks are reported separately. No mobile test is inferred.

## Reproduction / stopping point

All outputs and source hashes are committed; the retargeter extends the recovered pipeline with `AW_SUIT_SOURCE=project-sprint` or `project-idle` and writes separate intermediates. It never overwrites the validated two-clip model in those modes.

```sh
AW_SUIT_SOURCE=project-sprint blender -b -t 2 --python assets-3d/tactical-suit-evaluation/tools/retarget-suit.py
AW_SUIT_SOURCE=project-idle blender -b -t 2 --python assets-3d/tactical-suit-evaluation/tools/retarget-suit.py
node assets-3d/infantry-animation-integration/tools/merge-suit.mjs
AW_SUIT_SOURCE=project-sprint blender -b -t 2 --python assets-3d/tactical-suit-evaluation/tools/validate-reimport.py
AW_SUIT_SOURCE=project-idle blender -b -t 2 --python assets-3d/tactical-suit-evaluation/tools/validate-reimport.py
node assets-3d/infantry-animation-integration/tools/validate-controller.mjs
node assets-3d/infantry-animation-integration/tools/build-preview.mjs
```

Source archives remain in `/workspace/animation-recovery-downloads`, including license-restricted Kevin files for local inspection only. Do not add those archives/blends/retargeted raw assets to the repository or public source package. Next work: acquire authorized usable cover/crawl sources, resolve format/license limits, retarget with appropriate ground/weapon constraints, review transition endpoints on each rig, then perform real browser/mobile QA. This task adds no combat AI, map or live-game deployment changes.
