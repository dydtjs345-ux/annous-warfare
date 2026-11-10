# Tactical full-body motion audit — reference footage pending

**The reference-based rework is blocked. No clips have been added or revised.**

Branch: `feat/reference-tactical-motion-rework`. Preserved baseline: `aa650ce1b74390a70a46df76439a5420191a3898` on `feat/infantry-tactical-animations`. Remote branches were refreshed and the working combat integration remains `ceffb85`; main remains `b381e60`.

This folder contains a read-only diagnosis and original-motion review material for the five priority action families: sprint-to-prone, forward crawl, crouched walk, prone-to-standing, and cover entry/exit. Both USMC/M16A4 and Russian/AK-74M models are included. Existing GLBs, Blender files, all animations, the Korean preview source, game, AI, map, and deployments are unchanged. Nothing is merged.

## External reference access

**Actual external video frames inspected: zero.** No claim of studying the movement in Arma Reforger, Squad, or Ready or Not is made. No proprietary animation assets were imported.

- YouTube search/video access fails at the environment proxy with HTTP 403. The Arma Reforger video search could not retrieve footage.
- The [official Squad August 2017 post](https://store.steampowered.com/news/posts/?appids=393380&enddate=1504890154) was accessible and links an [animation-system video](https://www.youtube.com/watch?v=XAczCP5krPo). Reading its text does not establish what the video shows.
- The [Ready or Not developer page](https://voidinteractive.net/vol-87-ready-or-not-development-briefing/) returns HTTP 403. Its [official Steam briefing](https://store.steampowered.com/news/app/1144200/view/526472884483260567) is accessible through the public event API, but its examples embed YouTube videos. Their frames were not accessible.

The exact access record is [validation/reference-access.json](validation/reference-access.json). Article text was used only to locate possible references. It was not used as evidence for motion observations.

**Required input:** video files or extracted frame sequences for the priority actions, preferably clear third-person side views with original timing. Identify the source game and whether small reference thumbnails may be included in the review. Uploaded footage can be inspected locally even when its hosting site is blocked. Public redistribution of reference frames will depend on the supplied material and permission; the game's own animations remain the only footage in this audit.

## Original animation findings

The actual preserved GLBs were evaluated in the existing browser renderer, captured across time from side and fixed 30-degree isometric cameras, and inspected as ordered frame sequences. These observations concern the original animations only. They are engineering findings, not a completed reference study or an approval of visual quality.

| Priority action | Original motion observed and measured | What reference analysis must resolve before authoring |
| --- | --- | --- |
| Sprint → prone | Most descent comes from blending standing, crouched and prone poses. The clavicles have effectively no local angular change across sampled phases. Body regions within 15 mm of the floor are exclusively boots at all 37 source samples. Forward assembly travel ends at 0.65 s, before the 1.2 s descent ends. The intermediate poses read as a rigid torso being lowered. | Braking steps and forward momentum; when knees/forearms accept load; pelvis path relative to chest; shoulder and rifle control through each contact change. |
| Forward crawl | The chest and rifle retain nearly the same silhouette while the legs cycle. Thigh angular range is about 46–47 degrees; first spine-joint range is 2.70 degrees and clavicle range is 1.61 degrees. Hands stay on the weapon throughout. Neither hand nor arm mesh region comes within 15 mm of the floor at any of 73 source samples. The closest right arm surface is 56 mm above ground for USMC and 64 mm for Russian. | Actual arm support and recovery; diagonal limb phasing; pelvic roll/yaw, thoracic counterrotation and body advance relative to planted contacts; how the weapon is carried while a support limb changes contact. |
| Crouched walk | Legs articulate strongly while the upper body remains nearly fixed. Thigh ranges are 58.60/66.74 degrees; root angular range is zero, first spine-joint range is 0.437 degrees, and clavicle range is 0.795 degrees. Root translation includes 36 mm lateral sway and 16 mm vertical travel by construction, without pelvic orientation change. | Support-foot weight shift; pelvis tilt/rotation; coordinated chest and shoulder motion; controlled weapon movement during acceleration and recovery. |
| Prone → stand | The source largely reverses the three-pose descent structure. Clavicles remain locally fixed. The intended left-hand brace reaches a minimum mesh height of 27.34 mm, with no hand/arm/knee region within 15 mm of the floor in the sampled rise. The torso visibly rises before a convincing support transfer. | A load-bearing palm/forearm and knee sequence; foot repositioning; COM movement over the planted foot before extension; chest/pelvis timing and regrip. |
| Enter / exit cover | These are in-place two-pose blends with blended foot targets, not contact-driven approach/departure. Cover exit has effectively zero local angular change at all five spine joints and both clavicles while root pitch changes about 18.85 degrees. Entry changes the first spine joint only about 0.40 degrees. | Approach braking, foot placement and body compression; movement of the pelvis relative to the chest; weapon clearance; anticipatory weight shift and push-off during departure. |

Ranges above come from deterministic browser samples at 12 Hz; ground-region measurements use evaluated source meshes at 30 Hz. Very small floating-point rotations are rounded to zero. A joint's local range alone is not a realism criterion. This rig's root carries the pelvic frame; `pelvis.L/R` helper joints inherit its motion. Those helpers have effectively constant local rotations, which must be interpreted together with root and spine motion. True center of mass and contact forces are not measured by this audit.

The original penetration test checked only whether any character vertex fell below the floor. A boot toe can satisfy that check while the intended support arm or knee remains elevated. It did not validate support transfer or natural movement. This audit records mesh heights by dominant skin-weight region so that limitation is visible. Region labels and a 15 mm proximity threshold are diagnostics, not a complete collision/contact solver.

## Layer audit

- Both models retain 110 clips and 163 bones.
- All 33 tactical lower/upper pairs have disjoint node/property bindings. Root and pelvis helpers belong to the lower mask; all five spine joints belong to the upper mask. No upper-mask pelvis bindings or lower-mask spine bindings were found.
- For the six priority compositions on both factions, clean paired playback matches the independent keyed-track interpolants within 0.000005 degrees and 0.000001 m in the tested samples. This does not indicate an accidental overwrite of their motion in normal paired playback.
- The separate transition audit passes 60 checks across both factions and exercises the real `Actor.setState(false)` path from idle, walk, active moving fire, reload and the existing sprint into each priority composition. Its results are in [validation/layer-transitions.json](validation/layer-transitions.json). Sampling after the 180 ms crossfade isolates residual-layer problems; it does not certify arbitrary-phase physical continuity.

The current evidence points to weak authored coordination and missing support contacts. Increasing playback speed, adding noise, or merely increasing a joint's numerical rotation would not establish a natural correction.

## Review artifacts

- [Original-motion player](review/index.html): both factions, side and fixed 30-degree views together, normal/half speed, action seeking. Serve this directory over HTTP for consistent browser playback.
- [USMC original recording](review/USMC-original-side-iso.mp4) and [Russian original recording](review/Russian-original-side-iso.mp4).
- Phase sheets: [USMC side](review/USMC-original-side.jpg), [USMC isometric](review/USMC-original-iso30.jpg), [Russian side](review/Russian-original-side.jpg), [Russian isometric](review/Russian-original-iso30.jpg).
- [Browser baseline measurements](validation/baseline.json), [source mesh-region contacts](validation/contacts.json).

These recordings render real skeletal animation at a uniform 12 Hz for review. They are not mobile performance measurements. Camera framing stays fixed within each action and includes real assembly travel from the existing manifest. Cover props are hidden to expose the full body; obstacle clearance must be evaluated separately after reference-driven cover revisions. Recordings sample up to the last frame before each action ends; the next action begins on the following capture frame.

The original-motion player was checked in Chromium: both H.264 recordings decode, action seeking works, and normal/half-speed playback controls work without page errors. Its HTTP host must support byte ranges for reliable video seeking. Results: [validation/player.json](validation/player.json). Safari playback has not been checked.

There is no revised-animation panel, reference-frame panel, revised GLB, new deployment or visual-quality pass. Those deliverables await actual reference inspection. The existing Korean preview still serves the preserved baseline.

## Resume and reproduce

After references arrive, record their actual inspected timecodes/frame hashes and action-specific observations for pelvis, COM, spine/chest, shoulders, coordinated limbs, contacts, weight transfer, acceleration/deceleration and weapon positioning. Use that evidence to revise only the existing priority actions in a separate asset copy, retain these originals for comparison, and check both rigs at normal and slow playback. Keep clip counts stable and preserve all approved locomotion/reload clips. No tactical AI binding is part of this task.

Prerequisites: the built preserved preview at `animation-preview-pages/dist`, Node, Playwright with Chromium, Blender 4.3.2, FFmpeg and Pillow. The preview's `tactical-source.json` must identify baseline commit `aa650ce1b74390a70a46df76439a5420191a3898`.

```sh
node assets-3d/tactical-rework/tools/audit-baseline.mjs
node assets-3d/tactical-rework/tools/audit-layer-transitions.mjs
AW_SOURCE_CACHE=/path/to/source/assets-3d blender -b --python-exit-code 1 -t 2 -P assets-3d/tactical-rework/tools/audit-contacts.py
python assets-3d/tactical-rework/tools/contact-sheets.py
```

`AW_PLAYWRIGHT_MODULE` selects an installed Playwright module; `AW_REWORK_FRAMES` changes the temporary capture location. The scripts read the existing assets and write only this audit's output and temporary frames. They do not save Blender files or alter animation data.
