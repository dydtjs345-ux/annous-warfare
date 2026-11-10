# Tactical infantry animation review

Feature branch: `feat/infantry-tactical-animations`.

Working integration base: `ceffb85` on `feat/infantry-6v6-integration`. Animation source: `66d3892` on the unmerged `feat/infantry-sprint-rebuild` branch. The current game source, AI, map, combat timing, and working infantry atlases remain unchanged.

Korean preview entry: https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/?review=tactical

## Assets and clip list

Both `models/USMC_Tactical.glb` and `models/Russian_Tactical.glb` retain the original geometry, skin weights, rest nodes, textures, weapons, 163-joint skeleton, and 44 prior animation definitions. Each adds 66 masked clips, composing 33 tactical actions. All new clips are visual review candidates awaiting approval.

Each action below has a `TC_<Name>_Lower` and `TC_<Name>_Upper` clip. The lower and upper masks are disjoint and phase synchronized. The complete catalog, durations, travel samples, entry contracts and transition graph are in [manifest.json](manifest.json).

| Group | Actions |
| --- | --- |
| Emergency prone | `StandProne`, `WalkProne`, `SprintProne` |
| Prone movement and fire | `ProneIdle`, `CrawlForward`, `CrawlBackward`, `ProneAim`, `ProneFire` |
| Prone transitions | `ProneToCrawl`, `CrawlToProneAim`, `ProneCrouch`, `ProneStand` |
| Crouch | `CrouchIdle`, `CrouchWalk`, `CrouchAim`, `CrouchFire`, `StandCrouch`, `CrouchStand` |
| Cover entry/exit | `CoverEnter`, `CoverIdle`, `CoverExit` |
| Corner actions | `CoverLeanLeft`, `CoverLeanRight`, `CoverAimLeft`, `CoverAimRight`, `CoverFireLeft`, `CoverFireRight`, `CoverReturnLeft`, `CoverReturnRight` |
| Above low cover | `CoverRise`, `CoverAboveAim`, `CoverAboveFire`, `CoverLower` |

`source/{USMC,Russian}_Tactical.blend` contains packed textures, preserved earlier Actions, all new keyed Actions, and a two-layer crawl NLA example. The GLBs are independent, reusable delivery files. The USMC retains its M16A4; the Russian model retains its AK-74M. Original reload clips and object/magazine tracks remain intact.

## Motion and handling

These are offline IK-authored keyframes on the shared rig. Crawl includes alternating leg recovery, stable planted-foot intervals, pelvic sway, spine counter-motion, moving elbows, and controlled rifle carry. Forward crawl is 0.23 m/s; backward crawl is -0.17 m/s; crouched walk is 0.55 m/s. The sprint-to-prone clip has a decelerating 0.78 m actor-travel profile, with a separate keyed descent.

The get-up actions deliberately release the left hand briefly to brace the early rise, keep the right hand on the rifle, and return the left hand to its grip. Held-hand references blend smoothly between the preserved carry and aim grips. Knees, ankles, hips, chest, shoulders and head are keyed together. The preview uses 0.18-second layer blends for the continuous demonstration; repeated frames retain the current actions rather than restarting them.

Cover clips use an actor-relative anchor. The reference face is 1.3 m forward, the low-cover top is 1.3 m high, and corner edges are at x = ±0.12 m. The preview provides wall, concrete-block and vehicle reference shapes. Scene placement and movement routing belong to the eventual game controller. The manifest prepares cover-exit → idle → existing sprint-start → sprint transitions. These are animation contracts, with no new AI bindings.

The same rig, node names and lower/upper mask conventions remain compatible with the existing Three.js-to-Phaser bake approach. Future prone sprite bakes should allow a wider capture frame for the extended body and rifle. This delivery adds reusable GLBs and preview playback; the working game atlases retain their accepted content.

The newer `SR_` sprint remains a pre-existing review candidate. Its earlier approval status and the ordinary FB sprint mapping are preserved.

## Preview

Use **전술 동작 시험** to select an action. Existing controls provide both factions, eight headings, a fixed 30° orthographic view, side/front/free cameras, 60/80/120 px standing references, normal speed, half speed and quarter speed.

The continuous demonstration runs sprint → emergency prone → crawl entry → crawl → prone aim → fire → get up → walk → enter cover → lean → fire → return. It moves the soldier assembly over a fixed ground plane. The route uses a fixed facing and a taller viewport to keep the travel visible. Individual action review retains all eight headings.

The old squad and comparison modes remain available. Their in-place formation layout is preserved. Recorded demonstrations and contact sheets are included under **전술 동작 연속 검토 영상**. Direct MP4 playback provides a lightweight review option when 3D playback is expensive. These movies evaluate the actual skeletal animation at a uniform 12 Hz; they are separate from hardware performance measurements.

## Validation

- Khronos glTF validation: zero errors and zero warnings for both delivered models.
- Preservation: original meshes, skins, rest nodes and binary prefix are identical; all 44 old clip definitions are identical.
- Blender GLB reimport: one 163-bone armature per faction; all delivered animation data imports successfully.
- Source contact checks sample every 0.1 seconds across every new action. Character and rifle ground tests pass. Reference-cover weapon intersections are absent in the samples.
- Held-wrist error: below 0.003 mm against the appropriate carry/aim grip frames. The intentional left-hand brace is separately identified.
- Corner/top aiming clearance: at least 4.9 cm against the canonical reference props in sampled aim/fire poses.
- Crawl and crouch walk planted-foot forward drift: below 0.001 mm in sampled flat-ground source intervals. Elbow/wrist ranges confirm articulated crawl movement.
- Browser playback: every tactical composition matches sampled Blender joint positions within 0.005 mm. Eight headings, 60/80/120 px scales, gameplay/side/free views, loop boundaries and continuous world travel pass Chromium checks.
- Both faction models were visually inspected at multiple phases, with continuous skeletal movies and contact sheets captured from the actual renderer.

Detailed results are in `validation/export-integrity.json`, `*-source-check.json`, `contact-and-integration.json`, `browser.json`, and `mobile-and-regression.json`.

## Performance and limits

A short desktop Chromium software-renderer run in a 390 px phone layout measured approximately 51 FPS for one soldier. Local loopback navigation reached the ready scene in about 1.4 seconds. These figures describe this cloud environment, rather than iPhone hardware or mobile network loading. Each complete GLB is approximately 15 MB; selecting one faction limits loading to that model. The recorded fallback movies are about 0.5 MB each.

Playwright WebKit launch is blocked by missing GTK, Graphene, WOFF, HarfBuzz ICU, Hyphen, Manette and GLES libraries. Physical iPhone Safari performance, thermal behavior and memory pressure remain unverified. An exhaustive resize sequence hit a Playwright screenshot-stability timeout; a separate fresh phone-layout capture and interaction test records its result in `mobile-and-regression.json`.

The clips are authored for level ground and specified entry phases. Arbitrary-phase interruption, slope/terrain IK, automatic obstacle-height fitting, cloth/equipment physics, and exhaustive self-collision certification require further work. Cover props are alignment references; actual game obstacle placement and AI transitions are intentionally left to a later integration task. Visual approval remains the user's decision.

## Reproduce

Use Node 22+, Blender 4.3.2, Chromium, FFmpeg and Pillow on Linux. Fetch the unmerged source branch before preparing the cache.

```sh
git fetch origin feat/infantry-sprint-rebuild
npm ci
npm ci --prefix assets-3d/tactical-combat/tools
node assets-3d/tactical-combat/tools/prepare_sources.mjs
blender -b --python-exit-code 1 -t 2 -P assets-3d/tactical-combat/tools/author_tactical.py
AW_FACTION=Russian blender -b --python-exit-code 1 -t 2 -P assets-3d/tactical-combat/tools/author_tactical.py
blender -b --python-exit-code 1 -P assets-3d/tactical-combat/tools/package_sources.py
AW_FACTION=Russian blender -b --python-exit-code 1 -P assets-3d/tactical-combat/tools/package_sources.py
blender -b --python-exit-code 1 -P assets-3d/tactical-combat/tools/validate_source.py
AW_FACTION=Russian blender -b --python-exit-code 1 -P assets-3d/tactical-combat/tools/validate_source.py
node assets-3d/tactical-combat/tools/validate_assets.mjs
node assets-3d/tactical-combat/tools/summarize.mjs
node animation-preview-pages/tools/build-tactical.mjs
node assets-3d/tactical-combat/tools/browser-validate.mjs
node assets-3d/tactical-combat/tools/browser-smoke.mjs
node assets-3d/tactical-combat/tools/record_review.mjs
python3 assets-3d/tactical-combat/tools/contact_sheets.py
```

`AW_SOURCE_CACHE` overrides the authoring cache's assets-3d directory; `AW_PREVIEW_BASE` overrides the preserved preview bundle directory; `AW_PLAYWRIGHT_MODULE` and `AW_GLTF_VALIDATOR` can select installed tool modules. The public source branch contains the complete delivered GLBs and packed Blender sources, so regeneration is optional for review.
