# Sprint rebuilt as a separate review candidate

Based on `5481fc8407e0f137628bae5529283ead5af74c82`. The ordinary `Sprint` state is deliberately unchanged. Select `SprintNew` or the Korean **질주 OLD / NEW 비교** presentation. No approval or main merge is implied by publication.

Public review: https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/?review=sprint

Moving comparisons and measurements: https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/sprint-report.html

## Diagnosed failure

The previous FB sprint already had dynamic upper-body keys and a sprint-specific parameter set. It was not simply playback at an incorrect speed. However, its lower body reused the walking contact/ankle-path generator and ankle limiter. Measured hip flexion never went behind vertical (about +0.76° to +82.60°), knee flexion stayed above 35°, and a low pelvis drove a crouched recovery. The intended 32% stance became approximately 45% of the evaluated cycle, with only about 10% actual flight. The same material sole point slipped substantially when the prescribed 3m/s travel was applied. Inspecting only channel presence or sampled key poses missed these problems. The old public browser reproduced source joints within 0.002mm for both factions, so export loss and browser suppression were not the cause.

A further diagnostic caught sole-minimum vertex switches: directly replacing a contact pivot makes the ankle jump between nearby sole vertices. The new author integrates rolling displacement continuously, then checks sub-key poses at 240Hz. Reports distinguish all near-ground samples, intended steady contact, and frame-key measurements; contact vertex changes are not mislabeled as the velocity of a single material point.

## New clips and motion contract

- `SR_Sprint_Lower` + `SR_Sprint_Upper`: independently selectable authored running cycle, 2/3 second, 180 steps/minute, 3.6m/s, 2.4m same-foot stride, nominal contact duty 0.36. Fresh foot paths include forefoot/midfoot strike, compression, propulsion, short flight, early heel recovery and late shin extension. The ankle is solved relative to the shin (about -18° dorsiflexion to20° plantarflexion), including during folded-heel recovery; a world-fixed foot orientation is not retained in swing. Distributed pelvis/spine/shoulder compensation, impact absorption, stabilized head and close two-hand rifle carry are solved together offline.
- `SR_IdleToSprint_{Lower,Upper}`: 1.2s, 0 → 3.6m/s, 2.16m travel.
- `SR_WalkToSprint_{Lower,Upper}`: 1.2s, 1.05 → 3.6m/s, 2.79m.
- `SR_SprintToWalk_{Lower,Upper}`: 1.2s, 3.6 → 1.05m/s, 2.79m.
- `SR_SprintToStop_{Lower,Upper}`: 1.2s, 3.6 → 0m/s, 2.16m.

Transitions have explicit alternating world-space contacts, not blended foot paths. Quintic velocity envelopes are integrated in `travel_samples_m` at 60Hz. Joint transforms remain in place; the preview's opt-in actual-travel mode applies this distance to the soldier assembly over a **fixed** ground plane. A 1.2s start, two run cycles, and 1.2s stop travel **9.12m**, then hold idle. The camera stays orthographic at 30°. Blender forward is -Y; GLB forward is +Z. The existing in-place preview moves the ground in the opposite direction, whereas this route must move the soldier forward. A dedicated actual world-space planted-foot check guards that distinction. This is an isolated test harness, not game movement or AI code.

Upper/lower keys are authored from one coordinated full-body pose and split into disjoint masks with synchronized phases. New running keys and exports are sampled at 120Hz; transitions retain 60Hz authored keys and are exported at 120Hz. New clips use the existing 163-bone rest hierarchy. Grip frames, wrist.R weapon parenting, geometry, skin weights, equipment, reloads and prior animations are preserved. Original GLB geometry, nodes, skins, binary data, and all **34 previous clip definitions** are retained exactly; only new animation accessors/10 clips are appended. Blender Action fingerprints verify prior source keys are unchanged.

## Review controls and deliverables

The Korean/English preview adds OLD/NEW, walk/NEW and 9.12m travel modes, plus fixed front inspection alongside existing gameplay/free/side cameras, eight real headings, 60/80/120px scales and speed controls. New sprint is also available in normal faction, two-faction and squad modes. Existing default sprint and every original UI option remain available.

- `source/{USMC,Russian}_SprintReview.blend`: compressed source copies with original Actions and new keyed/NLA motion.
- `models/{USMC,Russian}_SprintReview.glb`: original 34 + new 10 clips.
- `review/*-sprint-{normal,slow}.mp4`: genuine continuous 3D OLD/NEW comparisons; three orthographic views in each movie, gameplay at 120px standing reference and side/front at 180px detail. 0.5× movies repeat evaluated frames; no generated motion or 2D body transformation.
- `review/*-travel.mp4`: true world-space 9.12m route over fixed meter markers.
- `review/browser-before/`, `review/browser-after/`: screenshots and actual public Chromium recordings when those checks have completed.
- `diagnostics/before-source.json`, `after-source.json`: 240Hz evaluated boot trajectories, angles, contact/flight and material-point diagnostics.
- `source-samples.json`: all163 evaluated joint poses through the five new clip compositions.
- `source-and-reimport.json`: NLA, source integrity, transition boundaries and isolated GLB reimport.
- `bone-transform-ranges.json`: root/pelvis/spines/clavicles/shoulders/neck/head local/world rotation ranges and translation bounds.
- `export-integrity.json`: Khronos validation and preservation of the entire previous GLB binary and old clip definitions.
- `runtime-contracts.json`: actual Actor/mixer checks, preserved default sprint, every clip, phase masks, transitions, travel and reload/moving-fire regressions.
- `browser-after.json`: actual deployed-browser results. Its `passed` must be true before describing browser validation as successful.

Tools in `tools/` reproduce authoring, dense inspection, reimport, runtime tests, real renders, packaging and public-browser verification. Use Blender4.3.2, Python3.12, the preview's pinned Node dependencies, system Chromium and FFmpeg. `AW_FACTION=USMC|Russian` selects authoring; `AW_VARIANT=before|after` selects dense inspection. Existing Playwright recorder cache is selected with `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright`.

## Limits

This is a review candidate, not an automatic certification of professional realism. Visual approval remains the user's decision. Tests use actual WebGL in desktop Chromium with an emulated iPhone layout and software rendering; they do not establish physical iPhone Safari/WebKit or mobile GPU performance. Browser recordings preserve slower cloud-renderer timing and must not be represented as measured phone FPS. The Blender comparison videos evaluate actual3D frames at30Hz.

Motion is authored for level ground and specified transition entry/exit phases. Arbitrary-phase interruption, terrain/obstacle adaptation, self-collision, independent cloth/equipment physics and live game integration remain outside this change. Support-wrist drift during the four transitions is at most about9.1mm (under1 native pixel at120px); the sprint loop itself keeps the reference grip within micrometres. Close-up transition contact could be refined further. Original animations, game AI and main are untouched.

The final source/GLB core suite ran on Sites version9. Version10 corrected the front inspection camera to GLB +Z, then passed actual front normal/slow RAF recordings and a forward-axis dot-product check for both factions. `browser-after.json` includes that final smoke result and explicitly labels earlier selector recordings as rear views. The published 3D comparison movies have true front views throughout.

A low-frame-rate transition-overrun regression is also checked: when a frame crosses the end of a start/acceleration clip, both new gait layers receive the same residual phase immediately. Their synchronization is not deferred until the next rendered frame.
