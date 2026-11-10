# Reference-based forward-crawl revision

Branch: `feat/reference-tactical-motion-rework`, based on the preserved tactical set at `aa650ce` and its read-only audit at `86be56d`.

Verified public comparisons: [side view](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/crawl-review/?view=side) · [fixed 30-degree isometric view](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/crawl-review/?view=iso). Both faction models, normal/half/quarter playback, and inspected reference frames are available. Animation asset/source commit: `9d195c92eca2fad30c5aa68c8c26e6dfccdee99d`.

Only `TC_CrawlForward_Lower` and `TC_CrawlForward_Upper` are revised, in separate asset copies for USMC/M16A4 and Russian/AK-74M. Each complete model still has 110 clips. All 108 other animation definitions, original geometry, rest nodes, skeletons, skins, textures, weapons and original binary data remain unchanged. No game, AI, map or existing preview source is modified. The original tactical assets remain at `assets-3d/tactical-combat`.

## Actual reference inspection

Both user-attached MOV files were decoded and inspected as chronological frame sequences before authoring. The 6-second file shows real military training; the 14.25-second file compares Arma 3 and Reforger. The real footage was the primary reference for low posture, forearm support, outward knee recovery and the relationship between pelvic roll and shoulder/chest movement. The game footage was a secondary silhouette reference. No proprietary animation data was extracted.

[REFERENCE-STUDY.md](REFERENCE-STUDY.md) records observed intervals and their authoring implications. [validation/reference-frames.json](validation/reference-frames.json) records source SHA-256 hashes, selected native frame indexes, exact presentation timestamps and frame hashes. The reference page includes six small real-training crops and four Reforger crops. Full original MOV files are not redistributed.

The compressed footage has camera movement, cuts, vegetation and partial occlusion. It supports qualitative contact/coordination analysis; it does not supply exact joint angles, forces, center of mass or motion-capture timing. Initial 6 Hz inspection timestamps were resampling times; the selected native frames have exact PTS in the record.

## Motion changes

- Alternating forearm support replaces the previous permanently aimed upper body. During each support interval, the elbow stays fixed relative to the world while the body advances over it.
- Pelvic roll/yaw, a support-dependent vertical path, distributed spine counterrotation and a slight chest timing offset coordinate the trunk with the limb cycle.
- The shoulder girdle protracts/retracts with reach and pull. Clavicle translation is bounded to approximately 5.1 cm; upper/lower arm and leg lengths remain fixed.
- The left hand intentionally leaves the rifle for ground support throughout the crawl. Its palm faces down. The right hand continuously controls the faction-specific rifle; it is not held in the old high aiming pose.
- Low outward knee recovery alternates with the opposite forearm support. Padded knees and boot contacts are checked against the actual deformed mesh, replacing the old conservative knee clearance.
- Neck extension keeps the head above the ground. The rifle stays above the ground and moves with the dominant arm's support/recovery instead of freezing the chest.

The cycle stays **2.4 seconds**, with **0.23 m/s** actor travel: 0.552 m per cycle. These are retained project values, not speed measurements inferred from the compressed reference. Both comparison actors use the same time and distance. The camera follows actual assembly translation over a fixed ground plane; no animation-layer pose correction is applied at runtime.

## Assets and comparison

| Asset | Purpose |
| --- | --- |
| `models/{USMC,Russian}_CrawlRework.glb` | Complete reusable model; only the two existing forward-crawl clips replaced. |
| `models/{USMC,Russian}_CrawlForward.animation.glb` | Approximately 145 KB animation-only patch with the same two clip names and shared node names. Load its clips against the preserved model to avoid downloading duplicate geometry. |
| `source/{USMC,Russian}_CrawlRework.blend` | Packed editable source, with the other Actions preserved and only forward crawl reauthored. |
| `preview/` | Korean original/revised comparison using one WebGL renderer and shared geometry/textures. Side and fixed 30-degree isometric cameras; normal, half and quarter speed; frame step and cycle scrubbing. |
| `review/{USMC,Russian}-{side,iso}.mp4` | Actual skeletal comparisons, recorded at 24 Hz. Original on the left, revised on the right. These are review recordings, not device FPS measurements. |

Recordings: [USMC side](review/USMC-side.mp4), [USMC isometric](review/USMC-iso.mp4), [Russian side](review/Russian-side.mp4), [Russian isometric](review/Russian-iso.mp4). Corresponding `*-comparison.jpg` files show eight phases across one cycle.

The comparison is published under a separate `/crawl-review/` path on the existing Korean preview Site. The root preview and all its existing assets are preserved. The live game and separate combat test are not deployment targets. Publication/verification details are recorded separately after successful deployment.

Sites version 13 deployed successfully. Anonymous HTTPS checks verified all 108 runtime files against the tested artifact, including the side/isometric query URLs. All 87 prior public preview runtime files and both protected game entry points retained their original hashes. See [validation/deployment.json](validation/deployment.json). The empty hidden `.nojekyll` marker is excluded from public-route checks.

The video fallback uses the selected playback rate and can be viewed fullscreen on phones. Selecting a faction loads only that faction's existing model plus its small animation patch; both actors share the loaded geometry and textures. Old comparison resources are disposed on faction changes.

## Validation

- Both complete GLBs and both animation-only GLBs pass Khronos validation with zero errors and zero warnings.
- Full models preserve all 108 other clip definitions and the entire original binary prefix. Mesh/skin/rest-node/material/texture arrays are identical.
- Blender export/reimport yields one 163-bone rig per faction.
- Deformed character meshes, rifle clearance, joint segment lengths, grip and support contacts are sampled at 60 Hz across the complete cycle, including between the 30 Hz authored keys.
- Lowest sampled character surface: approximately 1.05 mm above the floor. Active forearm support surfaces remain within 15 mm of ground. The padded knee and palm surfaces also approach ground during the cycle.
- Maximum planted elbow/foot drift: below 0.07 mm. Maximum limb-segment length error: below 0.003 mm. Maximum held right-wrist error: below 0.0002 mm. Loop start/end matrices match.
- Browser playback of the animation-only patch is checked against the authored joint positions for both factions. Side/isometric recordings are visually inspected across the cycle; validation is not based on GLB generation alone.
- Maximum sampled source/browser joint difference is below 0.0031 mm. Frame step, scrubbing, 30-degree camera, normal/half-speed fallback video, reference images and a 390 px phone layout pass Chromium checks with no page/WebGL errors. These checks do not verify physical iPhone Safari.

See `validation/assets.json`, `*-source.json`, `*-authored.json`, and `browser.json` for exact values and scope. The tight numerical errors establish consistent evaluation and contact constraints, not automatic visual realism or force balance.

## Limits and preserved scope

This is a visual-review candidate on level ground. It uses an original authored support sequence informed by visible references, not captured human joint trajectories or a rigid-body force simulation. Terrain adaptation, equipment collision/cloth simulation and a full self-collision certification remain outside this revision. No physical iPhone/Safari result is claimed.

Existing crawl-entry, crawl-to-aim and other transition clips are deliberately unchanged. Their endpoints still describe the previous crawl pose; they need a separate transition review before this revised crawl is enabled in gameplay. This comparison plays the revised loop in isolation and does not silently connect it to AI states.

## Reproduce

Use the same Blender 4.3.2 and Three.js 0.170 pipeline as the existing infantry work. The preserved source cache is required only to regenerate the editable source; delivered GLBs can be used directly.

```sh
AW_SOURCE_CACHE=/path/to/assets-3d blender -b --python-exit-code 1 -t 2 -P assets-3d/crawl-rework/tools/author_crawl.py
AW_FACTION=Russian AW_SOURCE_CACHE=/path/to/assets-3d blender -b --python-exit-code 1 -t 2 -P assets-3d/crawl-rework/tools/author_crawl.py
AW_SOURCE_CACHE=/path/to/assets-3d blender -b --python-exit-code 1 -t 2 -P assets-3d/crawl-rework/tools/validate-source.py
AW_FACTION=Russian AW_SOURCE_CACHE=/path/to/assets-3d blender -b --python-exit-code 1 -t 2 -P assets-3d/crawl-rework/tools/validate-source.py
node assets-3d/crawl-rework/tools/validate-assets.mjs
node assets-3d/crawl-rework/tools/build-preview.mjs
node assets-3d/crawl-rework/tools/review.mjs
python assets-3d/crawl-rework/tools/contact-sheets.py
node assets-3d/crawl-rework/tools/build-preview.mjs
node assets-3d/crawl-rework/tools/smoke-preview.mjs
```

`AW_PLAYWRIGHT_MODULE` and `AW_GLTF_VALIDATOR` select installed validation tools. `AW_CRAWL_DIST` selects the dedicated preview output directory (default `/workspace/crawl-review-dist`). The local review server resolves original `/models/…` URLs from `animation-preview-pages/dist`, allowing the hosted page to reuse the root preview's unchanged models.
