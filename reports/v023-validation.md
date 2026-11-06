# v0.2.3 validation and limitations

Base: `17e6e02` (latest fetched main). Branch: `feat/v023-cover-and-lmg-mounting`.
The pre-change audit is in [v023-audit.md](v023-audit.md). No AI architecture,
map, weapon cadence, damage, medical speed or injury rules were replaced.

## Decisions implemented

- Local cover runs before maneuvers and coordination waits, and during actual
  reloading without changing its timer. First contact, a >0.6 radian change in the
  most exposed known threat direction, and severe newly exposed pressure schedule
  a prompt assessment. Routine assessments are staggered at 1.5–2.1 seconds.
- Cover requires a meaningful directional gain (0.27) plus the existing 0.65 score
  hysteresis after travel/exposure cost. Normal firing-position improvements must
  retain an in-range firing lane. Heavy pressure can justify losing LOS for shelter.
  The bounded local search tests up to ten promising BFS routes of at most eight
  steps; terrain, allied bodies, destination reservations and failed goals remain.
- Protected positions keep a five-second commitment. Exposure and changed threat
  direction can override commitment. Failed movement releases the slot and preserves
  the existing failed-goal exclusion. Committed journeys avoid marginal target switches.
- Routine cover, live flank and recon tasks share movement capacity. Emergency moves
  may bypass it and retain their emergency authorization through arrival. Final
  <0.2 tile arrival legs may finish as the next soldier starts. This is not a fixed
  formation. Current useful fire still happens before local movement, and unsupported
  soldiers keep fighting if no cover improvement exists. Role/medical priorities remain.
- Routine radio-only cover movement uses fresh, uncleared, in-range snapshots and
  preserves active recon. Approximate incoming-fire reports remain separate, defensive
  inputs; they cannot authorize mounted shots or precise enemy tracking.
- Only tagged low walls qualify for support: walkable occupied position, support
  0.55–1.35 tiles in front within 36 degrees, direct in-range LOS and real directional
  protection. Solid walls and fences never qualify. This is a conservative map-tag
  rule, not a new height/ballistic model. There is no separate mount-seeking planner.
- LMG deployment takes 0.8s; unmounting 0.35s; remount cooldown 3s; maximum firing
  half-arc 45 degrees, further limited by support geometry. Bonuses are ×1.12 accuracy
  and ×1.15 incoming suppression, centralized in `src/mounting.js`. No bonus applies
  during deployment/unmounting; those phases prevent firing. Relocation waits briefly
  for release. Blocked/changed lanes, unsafe suppression, loss of contact and directly
  observed exposed flanks release support. Death/incapacity cancels support immediately.
- Authoritative state and real shot events drive crouch, bipod, deploy/release bars,
  aiming and reduced mounted recoil. Existing approach chevrons, protected arcs and
  unsupported firing remain. Rendering never changes simulation decisions or timing.
- Inspector current protection/exposure/score is computed from known threats, while
  candidate/reason/blocker is the dated decision snapshot. No known threat is shown
  explicitly instead of reusing a stale protection score. Own support position,
  direction, bonuses and rejection state are exposed. Seven exclusive activity
  categories remain; deploy/unmount is preparation, real shots retain engagement
  priority, and no interval enters two categories.

## Deterministic comparison

Same observer script, seeds 1–20, LCG, dt=0.1s, 1,800s cap. Main was archived before
changes at `/tmp/aw-v023-main`. Raw records: [v023-main.json](v023-main.json) and
[v023-after.json](v023-after.json). Reproduce with `scripts/measure-cover.mjs`; README
contains commands. These are complete matches, not selected clips.

| Metric | Main | v0.2.3 |
|---|---:|---:|
| Mean match duration (s) | 81.59 | 79.02 |
| Stalled at 1,800s cap | 0.00 | 0.00 |
| Engaging activity (soldier-s / match) | 74.62 | 89.99 |
| Actual shots / match | 235.40 | 230.20 |
| Exposed known-threat time (soldier-s / match) | 315.47 | 209.42 |
| Exposure / known-threat time (%) | 62.83 | 46.74 |
| Useful protected firing-lane time (soldier-s / match) | 86.38 | 83.15 |
| Successful local cover journeys / match | 10.30 | 15.40 |
| Abandoned local cover journeys / match | 27.90 | 17.30 |
| Passive activity (soldier-s / match) | 187.12 | 156.39 |
| Passive / active soldier time (%) | 32.47 | 28.65 |
| Reacquisition median (s) | 2.10 | 2.90 |
| Reacquisition p90 (s) | 10.00 | 23.70 |
| Completed reacquisition samples | 1395.00 | 797.00 |
| Mounted time (soldier-s / match) | 0.00 | 10.45 |
| Mounted shots / match | 0.00 | 36.40 |
| Combat ineffective at end / match | 8.35 | 8.70 |
| Dead at end / match | 4.45 | 4.25 |

Exposure is time with LOS to at least one unprotected known contact snapshot;
useful cover is a protected in-range lane to at least one known snapshot. They are
not complements in a multi-direction engagement. Neither metric uses unseen live
enemy coordinates. Aging snapshots count until the existing contact TTL expires.
Firing is the exclusive engaging activity (actual shots or direct engagement/aim),
not a claim that a bullet is emitted throughout every interval. Relocation completion
is counted once per destination within the 0.25-tile sampling tolerance; abandoned
objectives only count while their soldier is active. Death is reported separately.

Reacquisition samples are personal loss of all direct sightings lasting at least
0.5s until that soldier sees any enemy again. Unresolved/dead-soldier episodes are
excluded, and episodes differ because combat outcomes change. Therefore the slower
median/p90 is a measured sample regression, not a controlled proof of planner speed.
It must not be advertised as improved reacquisition. Raw arrays retain short flicker
samples too; the summary applies the 0.5s filter identically to both versions.

Measured benefits: less exposure and passive time, more engagement, more successful
cover journeys, fewer abandoned cover objectives, and meaningful supported LMG fire.
Mounted shots account for about 15.8% of all shots in this sample. Useful cover time
falls slightly in absolute terms (86.38→83.15 soldier-s), though its share of known
threat time rises (17.21→18.56%). Reacquisition worsens; combat incapacitations rise;
deaths fall slightly. No claim of uniformly improved survival or tactics is made.

No run reaches the cap, but seed 20 takes 250.3s versus 70.9s on main. Investigation
at t=160.1s records #0 waiting 47.2s since progress and #10 waiting 23.9s; both report
`Injuries require a defensive role`, with no navigation failure and no current contact.
At t=220.1s the remaining two injured soldiers report the same restriction. Existing
injury-based recon exclusions and contact expiry can therefore produce long defensive
pauses before search resumes. This was not replaced with an omniscient or forced-charge
endgame rule. This is a concrete remaining limitation to monitor on the phone.

## Automated validation

`npm install`, `npm test`, `npm run build`, and `git diff --check` were run.
The suite has **109 passing tests**: 56 core, 17 coordination, 17 presentation,
and 19 new cover/mount tests. Existing seed sweeps include 200 startup seeds,
100 navigation/separation seeds and 30 complete battles. New tests cover:

1. Prompt exposed first-contact cover selection and reachable useful geometry.
2. Protected LMG holding a valid lane rather than marginal cover chasing.
3. Commitment escape and significant direction changes.
4. Routine squad movement budget and urgent defensive override.
5. Persistent cover objectives, arrival and hysteresis.
6. Unsupported soldiers firing normally; stable unsupported animation state.
7. Valid deployment timing, no premature shots or bonuses.
8. Rejection of fences, solid/side walls, absent targets and open ground.
9. Solid obstruction stopping supported fire and initiating release.
10. Unmount delay before actual movement and a clean navigation resume.
11. Flank/suppression release and removal of bonuses.
12. Real incoming-fire suppression multiplier.
13. Incapacity/death preventing mounting, movement and combat animation.
14. Actual mount poses and inspector data, including stale-score removal after contact loss.
15. Complete fixed-seed matches grouped at 1×/2×/4× with identical results within this
    version and exclusive activity sums. No main/branch parity is required.
16. Actual mounted shot, ammo/cadence, recoil event and preparation accounting.
17. Initial 6v6 simultaneous firing/cover travel with bounded routine journeys.
18. A separate observed flank preventing remount onto a still-valid frontal target.
19. Reload defense with unchanged timer and exclusive activity accounting.

Two existing assertions were corrected for the now-mobile reload fixtures: a recon
candidate must move meaningfully from spawn rather than specifically east, and an
enemy entering a soldier's own firing lane can satisfy reacquisition by an actual
shot rather than requiring a recon state label first. Their original checks for
assignment action, firing, bounded holding, health and suppression remain; tests
were not disabled. Existing medic, contact, flank, injury, LOS and collision tests pass.

Production build succeeds; Vite retains the existing large Phaser chunk warning
(~1.55 MB uncompressed / 363 KB gzip). No new runtime dependency or external image
asset was added. Pages base path and workflow are unchanged.

## Mobile browser checks and physical verification

Production preview was exercised at `/annous-warfare/` in headless Chromium, touch
emulation, DPR 2, 390×844 portrait and 844×390 landscape. Verified LMG tap inspection,
144px scrollable panel, no undefined/NaN text, pinch preserving selection, visible
controls/no horizontal overflow, pause/resume, restart to 6v6, and 1×/2×/4× controls.
The final ten-second 4× RAF sample has 600 frames, median 16.7ms and p95 16.7ms. The actual diagnostic sample and timings are in
[v023-browser.json](v023-browser.json). Actual combat was also captured and visually
reviewed at 2× with a zoomed portrait view: factions, roles, cover arcs, firing lanes
and supported cues remain readable. No simulation events were fabricated for that
capture. Chromium is not iPhone Safari and host RAF is not a device benchmark.

Physical iPhone checks are listed in README: repeated initial encounters; inspect
actual low-wall support from the correct side; verify release before repositioning;
check damage, treatment and reload synchronization; test all speeds and gestures in
both orientations; inspect late-game injury-based waits; restart and verify counters.
Safari thermal performance, battery use, safe-area behavior on actual hardware and
small bipod readability at overview zoom remain unverified. At 4× very brief effects
may coalesce; events, fire cadence and outcomes remain authoritative.

## Changed files

- `src/tactics.js`: prompt, directional, coordinated and stable cover decisions;
  measured diagnostic snapshots and mounted suppression multiplier.
- `src/mounting.js` (new): conservative eligibility, state machine, timings/bonuses.
- `src/simulation.js`: priority integration, reload defense, movement release delay,
  mounted accuracy and shot metadata, casualty cleanup.
- `src/diagnostics.js`, `src/inspection.js`: actual cover/mount data and fire gate.
- `src/presentation-state.js`, `src/combat-visuals.js`: exclusive accounting and
  authoritative mount presentation, without simulation control.
- `test/cover-mount.test.js` (new): 19 deterministic checks and playback comparisons.
- `test/simulation.test.js`, `test/coordination.test.js`: two fixture assertions above.
- `scripts/measure-cover.mjs` (new): identical read-only main/branch observer.
- `package.json`, `package-lock.json`, `index.html`: v0.2.3 and test/measurement scripts.
- `README.md`: behavior, eligibility, reproduction, limitations and iPhone steps.
- `reports/v023-audit.md`, `v023-main.json`, `v023-after.json`, `v023-browser.json`,
  `v023-validation.md`: audit, raw comparison and verification evidence.

No changes to map data, CSS layout, Pages workflow or the medical/injury algorithms.
