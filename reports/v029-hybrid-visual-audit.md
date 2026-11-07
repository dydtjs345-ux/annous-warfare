# Autonomous Warfare v0.2.9 — hybrid pixel-art visual audit

**Current branch includes the smooth-motion extension: 231 passing tests, 440 recorded complete executions, gameplay recording and consecutive-frame checks. Original milestone results below remain preserved; see the motion-extension section for the final status.**

Base: merged v0.2.8 main **4abb428** (PR #15). Branch: `feat/v029-hybrid-pixel-art`. This is a presentation change, not AI balancing. No automatic merge or production deployment.

## Implemented visual changes

**Soldiers:** Original procedural pixel clusters now distinguish helmet crown/rim/eye line/chin strap, layered tactical vest, magazine pouches, shoulder straps, directional backpack, fabric patches, knee panels and boot highlights. USMC uses cool blue-gray cloth; Russian infantry uses muted gray-olive equipment. Standing height increases slightly while selection positions, physical bodies and tactical geometry remain unchanged. The existing animation model still controls standing/observing, walk/run/limp/crawl, full cover, peek/fire, reload, mount, treatment, grenade preparation/release, wounds, incapacity and death. Arms and weapon use authoritative projected aim; equipment chooses the opposite projected side. These are layered procedural sprites, not an imported atlas or copied game assets.

**Urban environment:** Asphalt now has deterministic pixel grain, small cracks and stains. Existing street edges acquire flat pavement slabs and joints. Sealed building faces have masonry courses and dark window recesses, roof membrane seams, parapet/contact edges and a small rooftop vent. Windows are decorative sealed facade details, not firing openings. Sandbags retain their staggered rows; concrete gains wear/contact edges; vehicles gain wheel/cabin/hood/rust detail; crates gain plank lines. There are no new terrain objects. Every decorative feature is on an existing surface/solid footprint or flat ground: none is presented as independently usable cover.

**Effects/atmosphere:** Existing actual-shot muzzle triangles gain restrained layered warm bloom. `combat-atmosphere.js` consumes real shot and damage events for weapon smoke, tiny ejected casing pixels and brief damage dust/spark accents. It uses a maximum of 64 effects, event serial deduplication, a 0.65s lifetime and viewport culling. The existing real-event grenade flash/dust/smoke/debris/residue system remains intact and bounded at 32 effects. Cool architectural shadows and light-facing edges provide contrast without global fog, a lighting engine or screen shake. Damage accents can follow grenade injuries too; they are not evidence of a fabricated bullet strike.

No simulation RNG is consumed. Texture/material variation derives only from coordinates; effect variation uses deterministic age and event direction. Pausing freezes effect clocks; higher simulation speeds preserve readable short effects. A lingering plume belongs to a previous real shot, not a new action by a dead soldier.

## Asset/render architecture and mobile performance

There are no external image dependencies or new libraries. `CombatVisuals` remains the authoritative-state adapter. `urban-detail.js` draws only presentation geometry. Main retains the existing isometric projection, depth sort, picking and Korean inspector.

Ground detail is built once per match and baked into a single RenderTexture at exact world bounds, then its graphics commands are cleared. Restart destroys the prior cache before replacing it. The expanded cache is 2000×1060 pixels (about 8.5MB uncompressed RGBA, excluding renderer overhead); no per-frame texture generation occurs. Building/obstacle details remain lightweight immediate graphics and are culled with existing drawables. Smoke/casing effects use capped records rather than a particle physics system.

Mobile Chromium checks exercise selection, Korean inspector expand/scroll/close/reselect, portrait/landscape, pan/pinch, pause/resume, restart and 1×/2×/4×. Korean control labels were kept on one line without reducing 44px touch targets. `v029-mobile.json` contains the final five-second 4× requestAnimationFrame sample; `v029-mobile-busy.json` retains a sample recorded while three simulation jobs were running. These differ in load and caching and are **not** a controlled causal performance benchmark. Desktop Chromium/SwiftShader does not certify iPhone Safari, battery, thermals or long-term memory behavior.

## Actual visual QA and corrections

Before/after captures use the same main-game seed 2049 and viewport; wall-clock capture timing can differ slightly, so these are art comparisons, not pixel-identical simulation comparisons.

- [Before: merged v0.2.8](v029-before.png)
- [After: upgraded urban battlefield](v029-after.png)
- [USMC moving in the city](v029-moving-usmc.png) / [Russian squad moving](v029-moving-ru.png)
- [Full cover](v029-full.png) / [Actual peek](v029-peek.png)
- [Real shot and damage event](v029-fire.png)
- [Medic performing real treatment](v029-medic.png)
- [Real grenade detonation](v029-grenade.png)
- [Korean inspector on mobile](v029-inspector.png)

Combat close-ups are explicitly labeled isolated **real Battle fixtures**: controlled initial positions, injury setup and nonfiring opponents make the actual states reproducible. The fixture pauses only after the renderer receives the specified real pose/event. It never sets a pose or adds a fake shot/blast. These fixtures are not natural-match tactical statistics and are not included in the deployed Vite entry. `v029-qa.json` records capture times and authoritative states/events.

Review found unused disabled fixture actors obscuring cover comparisons, so the fixture now excludes those actors. Backpack side selection was aligned with the projected weapon axis rather than world X. Ground-cache alignment and restart were inspected after baking; viewport projection remains unchanged. Korean pause text wrapping was corrected. Foreground obstacles still use the pre-existing depth scheme; no new behind-wall silhouette or tactical visibility is inferred from rendering.

## Deterministic regression and tests

The baseline sources are archived from main at `4abb428`. `check-v029-parity.mjs` executes the old and new Battles with identical RNG, 0.05s step and options: maps legacy/expanded, seeds **2001–2020** on each, layout=(seed−2001)%4, spawn=floor((seed−2001)/16)%3, grenades only for expanded. It compares every-step RNG, result/time, positions, route/navigation/progress/diagnostics, ammo/reserve, wounds, suppression, assignments, postures, mounting, treatment, activity, grenade results and squad objectives.

An initial 40-pair comparison tests inspection/readability integration. The final same 40 pairs additionally call the new soldier renderer, smoke/casing effects and grenade renderer at 4× grouping through a graphics sink. Initial and final datasets are retained separately; each is 80 complete executions. A separate 200 legacy matches use the existing 0.1s audit and must retain all 200 archived `v025-after-A.json` replay hashes. Total recorded complete executions: **360**, excluding unit-test battles, partial browser fixtures and probes. No artificial match result or aggression change is used.

The complete suite includes the existing 220 tests plus three new event-gating/nonmutation, cap/pause/reset/expiry and static-geometry tests. Raw logs and verification are stored as `v029-tests.txt`, `v029-build.txt`, `v029-validation.json`. Production build keeps the existing Phaser large-chunk advisory. Pages base/workflow remain unchanged.

## Milestone checkpoints

- M1 `1d8629c`: layered infantry pixel detail; inherited presentation tests.
- M2 `958313f`: urban surface/facade/roof/material detail; inherited urban/grenade tests.
- M3 `3021e4c`: bounded real-event atmosphere; three targeted tests.
- M4 `17c246e`: restrained local bloom and architectural shadows.
- M5 `1ca83af`: static ground cache, mobile control checks and portrait text cleanup.
- M6 `4787c8a`: final screenshot review, projected-equipment correction, paired replay validation and delivery report in subsequent commit.

## Reproduce

```sh
npm install
npm test
npm run build
mkdir -p /tmp/aw-v029-base
git archive 4abb428 src package.json | tar -x -C /tmp/aw-v029-base
node scripts/check-v029-parity.mjs /tmp/aw-v029-base
node scripts/audit-v025.mjs . reports/v029-legacy.json 200 '' '' legacy
node scripts/verify-v029.mjs /tmp/aw-v029-base
npm run preview -- --port 4209
# Separate terminal, Playwright + /usr/bin/chromium available:
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/mobile-v029.mjs
npm run dev -- --port 4210
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/capture-v029-qa.mjs
```

## Limitations / next visual work

This is a noticeable procedural detail pass, not a finished hand-painted sprite atlas. Soldiers still share coarse torso/head geometry, with projected weapons/arms and equipment sides rather than eight fully authored directional frames. At full-map overview, small equipment detail intentionally disappears; squad view is needed. Repeated map-cell material patterns remain visible. Rooftop vents and window recesses are visual details on inaccessible solid buildings, not new traversal/cover features.

The simulation has no authoritative missed-bullet terrain-impact event, so no arbitrary wall hits are invented; dust/sparks are limited to known damage. No global shadow solver, volumetric smoke, destructible materials or 3D was added. Existing medical, exposure, congestion and tactical limitations remain unchanged. Korean dynamic-reason fallback and 10Hz decision-history sampling remain as in v0.2.8.

Recommended next art work: original authored eight-direction infantry atlases, carefully varied roof/material tile families, and renderer profiling on physical devices before adding more effects. Do not introduce fake terrain impacts without a trustworthy event source.

**Physical iPhone Safari is unverified.** Test normal squad zoom and full-map zoom, both factions, full-cover/peek/fire alignment, LMG deploy/fire, medic treatment, grenade throw/blast, both orientations and inspector scrolling. Pan/pinch/select at distant map edges, switch 1×/2×/4×, pause/restart repeatedly and background/resume. Check texture recreation, legibility, heat, battery and frame stability over several full matches. Feature branches do not publish production Pages automatically.

## Final measured results

**223 tests pass, zero failures.** Production build passes. All 40 final paired cases preserve every compared per-tick hash, outcome and duration; all 200 legacy archived hashes match. Recorded complete executions total 360 including the initial paired round. No recorded match timed out.

| Final paired cohort (20 pairs each) | Shared baseline/final P50 / P90 / P95 / max, seconds |
|---|---|
| legacy | 70.85 / 162.10 / 196.85 / 196.85 |
| expanded | 92.60 / 159.95 / 186.40 / 186.40 |

These are equivalence checks, not tactical-quality improvements. Percentiles use the repository convention `floor(n*p)` capped at the final sample.

Final cached-ground mobile sample: **299 frames over five seconds at 4×**, median/P95/max **16.7/16.7/33.3ms**. All recorded mobile checks pass with zero page errors. This is a short desktop-emulation sample, not a physical-device guarantee.

## Original visual-checkpoint delivery

Tested implementation commit `4787c8a10a492443342c4ca40fd79936a8279bb5` is pushed. PR creation returned `Post "https://api.github.com/graphql": Forbidden`; no PR was created by that command and no merge occurred. The [prepared PR description](v029-pr-description.md) is included. Review comparison: https://github.com/dydtjs345-ux/annous-warfare/compare/main...feat/v029-hybrid-pixel-art?expand=1

## Additional priority — smooth motion extension (2026-11-07)

Completed on the same v0.2.9 branch without replacing any earlier milestone. Checkpoint **5e83f01** adds `motion-presentation.js`, frame/video evidence and eight focused tests.

### Buffering and authoritative boundaries

The original renderer read new tick coordinates directly, including in camera focus, so both the sprite and follow camera advanced in discrete steps. A render-only buffer now stores the state immediately before each existing 0.05s simulation step. After stepping, the residual accumulator fraction interpolates that previous state toward the current authoritative position. It never extrapolates. Maximum deliberate visual latency is one tick: 50ms at 1×, 25ms at 2×, 12.5ms at 4×. No AI/perception/projectile tick or decision is delayed.

Per-unit records and snapshot objects are reused. Render views inherit read-only soldier properties and own only visual position/direction fields. No AI consumes those views. Depth sorting, picking, observation/movement cues and follow-camera framing now use the same visual position; selection maps back to the original authoritative soldier. Camera dragging/pinch remain world-space spectator operations. Pause freezes the exact visual pose; restart discards all old unit records. Incapacity/death flush positional lag and stop visual turning; discontinuities larger than 0.6 tile reset rather than glide across the map.

Observation, upper-body/weapon and travel headings use independent shortest-angle, bounded-rate easing. Existing scan targets and intervals provide the pauses; no extra scan targets, new perception rays or invented awareness are added. Actual fire overrides the visual weapon direction immediately with the recorded shot angle. Full concealment tucks immediately; rising and other noncritical stance changes settle briefly. These deliberate exceptions preserve truthful flashes and cover state rather than guaranteeing that every transition is softened.

Stride is interpolated from actual traveled distance. Body height, hand height and leg offset settle continuously; reload, treatment-cycle, grenade preparation and mount phases interpolate real counters only while the relevant action is active. Existing procedural walking/running/limping, reload hand motion, treatment arms, bipod, recoil and casualty fall animations remain. There is no foot IK, motion prediction or new animation-driven combat timing.

### Actual gameplay and consecutive-frame review

- [Actual production gameplay recording](v029-motion-gameplay.mp4): seed 2049, layout 0, spawn 0; captured with CDP screencast across 1×/2×/4×, pause and restart. Frames retain capture-time durations. Recording overhead affects host frame rate; this is not a performance benchmark.
- [Full-frame contact sheet](v029-motion-contact-sheet.png) and [enlarged consecutive movement frames](v029-motion-detail-frames.png): extracted from that recording, not fabricated poses.
- [Treatment frames](v029-motion-medic-frames.png), [reload frames](v029-motion-reload-frames.png), [LMG deployment frames](v029-motion-mount-frames.png): six consecutive screenshots per controlled **real Battle** fixture, with the production renderer/interpolator. Actual times and phase values are in `v029-motion-actions.json`. Full concealment during deployment correctly remains immediately tucked.
- [Frozen paused frame](v029-motion-paused.png).

`v029-motion-frames.json` records production requestAnimationFrame observations. At 1× it contains 90 sampled frames and **454 per-soldier frame intervals** with unchanged authoritative coordinates but moving render coordinates. This verifies interpolation between ticks rather than merely replaying tick positions. There are 306/872/1610 observed heading-settling intervals at 1×/2×/4×. These count soldier-frame observations, not unique orders. The 4× sample includes **54 soldier-frames** with real-shot flashes, all matching the recorded shot angle; this is not 54 unique shots. Maximum sampled position lag is 0.0591/0.0850/0.0812 tile respectively. There is no long catch-up slide.

Reviewed the enlarged frame sheets for foot cadence, body placement, hand/bipod phases and camera-relative movement. A previous noninterpolated aim calculation subtracted the draw position; using that unchanged with interpolated positions would skew the gun. The gun direction now projects a direction vector independently of the buffered position. The original abrupt follow-camera tracking was also corrected to use the rendered focus position.

### Final regression status after motion extension

**231 tests pass, zero failures**, including eight new cases: bounded position/no writes, angle wrap, scan settling/hold, pause/speed freeze, firing/full-cover exceptions, incapacitation/discontinuity, restart, and actual reload/treatment phases. Full production build passes. Mobile gesture/selection/inspector/orientation/speed/pause/restart checks pass with buffered picking and camera focus.

Reran the same 40 baseline/current paired full matches with the motion layer active. All per-tick digests, outcome, duration, navigation, ammunition, wounds, medical/suppression/assignment state and grenade results remain identical, including against the preserved pre-motion dataset. This adds **80 complete executions**: the v0.2.9 recorded total is now **440**, with the previously preserved 200 legacy hashes unchanged. The original 360-execution results above describe the initial visual-overhaul checkpoint.

Physical iPhone Safari remains unverified. Pixel snapping of very small limbs, low display frame rates, immediate shelter/fire exceptions and discrete pose-family changes can still be noticeable. The inspector deliberately reports authoritative angles/state, which can lead the short visual turn. Review the recording at normal speed and check real iPhone movement/scan settling, rapid speed switches, pause while turning, background/resume, treatment/mount phases and long-session frame stability before release.
