# Autonomous Warfare v0.2.7 — tactical infantry AI audit

Final AI stabilization commit: **`6f2a2d6`**, branch **`feat/v027-tactical-infantry-overhaul`**. Base: fetched main **`6d61f9c`**, verified to contain merged v0.2.6 (`c48c268`, PR #13). Delivery additionally corrects flash layering and refreshes an actual suppression-task explanation; neither changes combat outcomes. The validation manifest hashes the exact final source. No automatic merge or deployment.

Implemented M1–M7 with separate validated commits, paired milestone scenarios, repeated integrated correction and final browser checks. **216 tests pass; production build passes. 3,000 large-cohort executions finish with zero timeouts**, including the 1,000 planned cases and subsequent paired correction rounds. Final legacy compatibility preserves **200/200 archived hashes**. More useful low-cover behavior is implemented, but this is **not a universal tactical-quality improvement**: exposure/passive time, medical completion/response and some specialty navigation/tails regress. Those results remain visible below. Physical iPhone Safari is **unverified**.

## Features, architecture and real decision rules

The original 6v6 roster, four expanded 54×44 layouts, map materials, collision/navigation solver, contact radio, injuries, healing rate, ammunition, LMG bonuses and spectator controls remain. No new map, weapon, ML, campaign, personality, player order or external dependency was added. New tactical behavior defaults on for expanded mode; legacy/v0.2.5 compatibility modes default off. Focused fixtures can explicitly use `{tactical:true}`. This preserves old outcomes while enabling controlled experiments.

| Module | Responsibility and authoritative behavior |
|---|---|
| `src/postures.js` + `src/world.js` | Full shelter, peek and sustained positions. Full bodies/eyes are below an actual aligned low obstacle, so they cannot fire or be directly seen through that protected ray. Side/rear attacks remain possible. Peek raises the firing position; sustained support stays exposed longer. Solid walls always block. The model is coarse vertical low-cover exposure, not 3D ballistics or corner leaning. |
| `src/suppressive-fire.js` | Aim selection uses only confirmed snapshots. Aged 0.2–5s LMG / 0.2–2.5s rifle contacts, confidence >0.45, uncleared, in range and with a valid lane can receive bounded remembered fire. Limits: ten/two shots per observation timestamp, actual ammo/cooldown/aim delay and friendly-lane clearance. No indefinite empty-wall fire. Physical projectile/near-miss resolution may intersect real bodies, but never updates the target with an unseen location. |
| `src/fire-movement.js` + existing `tactics.js` | Existing conditional flank selection gains explicit support and maneuver duties. Support favors a capable LMG, without fixed composition; medics retain care/security. Smaller surviving squads may evaluate one supporter, not a mandatory flank. Real recent shots provide pressure; a lapse gets a bounded three-second recovery interval, with the original overall maneuver deadline retained. Changed risk, wounds, casualties, failed navigation and unavailable support cancel safely. |
| `src/security.js` + existing `search.js` | Adaptive loose-column/staggered/dispersed/compact follower offsets use existing distinct reachable destinations and clearance. Scouts keep moving without rigid formation locks. Travel heading is actual displacement; observation/weapon heading can differ. Distant perception uses an approximately 160° scan cone and LOS; close 2.5-tile awareness still requires LOS. Role-offset forward/side/rear scans and recent confirmed engagement focus never read hidden enemy coordinates. Exploration memory and goal completion use the same observation rule. |
| `src/crossings.js` | Inspects up to twelve cells of an existing route, not a new path-search system. Short exposed road segments with a protected waiting entry and known/uncertain threat may reserve two crossers, or one in a small squad. Other actors may observe. Exposed entries, grenade evasion and immediate danger bypass waiting. Unentered/stopped/dead reservations clear; local gates expire after eight seconds. Existing risk-weighted navigation chooses the route. |
| `src/grenade-visuals.js`, `urban-visuals.js`, `combat-visuals.js` | Real-event throw cue, visible flight trail/object, warm instantaneous flash, restrained dust/smoke/debris and lingering residue. Maximum 32 persistent effects; offscreen culling; no particle physics/RNG. Presentation clocks keep flashes visible at 4× and freeze on pause. Body silhouettes stay low whenever the simulation says tucked, including reload/treatment/mount poses. |

Full-cover rest windows vary by role/id/pressure (normally roughly 0.65–1.7s); peeks roughly 0.7–1.3s, sustained support roughly 2.4–3.4s. Reload or heavy suppression can prolong real shelter. New threats, movement, expired information or incapacity release/reassess it. Rifle/LMG cadence is unchanged, so longer exposure naturally spends more ammunition. Id/role offsets are deterministic, not shared squad clocks or new random draws. A `sustained` posture can mean weapon-ready; it does not manufacture actual firing.

Suppression only damages on a valid physical ray intersection and hit probability, including existing arm injuries, pressure and support factors. Hidden low-cover bodies receive attenuated pressure from remembered fire, not guaranteed damage. Fire does not pass through solid obstacles. Medics do not perform speculative suppression; active movement/recon/search/care and emergency actions take priority. Grenade damage, radius, inventory, fuse, throw-selection and friendly-fire calculations are unchanged; origin metadata was added for rendering only.

The action hierarchy remains contextual: actual grenade evasion and survival/weapon handling; actionable care; protected rest or immediate direct combat; assigned support/maneuver/recon; systematic search; optional repositioning. Local danger may override orders. The new code extends the existing coordinator instead of introducing a competing global AI. Search still uses actual observations, expiring exact snapshots, bounded historical sectors and uncertain bearings. No timer reveals enemies or awards victory.

Inspection shows actual posture/reason, tactical role and maneuver destination, suppression snapshot/budget/rejection, formation/scan/travel headings, last crossing decision age and existing action/order/ammo/wounds/contact/fire/progress diagnostics. The exclusive activity counters remain conservative and unchanged: verified shelter without firing/observation may count as passive. That does not make every stationary actor defective, and it also does not justify every passive interval.

## Milestones and iterative validation

| Milestone | Commit | Validation before advancing |
|---|---|---|
| M1 postures | `a23fa15` | Six focused posture checks, inherited cover/mount/animation/search checks and twelve paired complete cover cases. Fixed exposed-flank release and lingering flashes. |
| M2 remembered fire | `c5f5056` | Four original focused tests; same twelve inputs compared with M1 and independently replayed. Actual ammo, finite budgets, no hidden-coordinate targeting, solid/friendly rejection. |
| M3 fire/movement | `9fb9b1a` | Four original coordination tests, actual supported movement and bounded cancellation; twelve complete movement cases plus independent replay. No natural flank activated in that small cohort; not falsely claimed as broad evidence. |
| M4 spacing/security | `a703d27` | Seven security tests, inherited search/coordination checks, twelve paired expanded cases and repeat. Fixed column support-distance retargeting and unobserved goal completion. Retained meaningful movement assertions while allowing a correct lateral first step. |
| M5 crossings | `9dd59f6` | Five gate/geometry/emergency tests, navigation/security regressions, twelve paired cases and replay. Fixed retreat being counted as crossing completion. Natural gates remained sparse. |
| M6 visuals | `e1493fe` | Three presentation tests, inherited animation/grenade tests and build. Twelve complete matches with grenade rendering at 1×/2×/4× preserve physics hashes, including 33 real throws and one friendly hit on both sides. |
| M7 initial checkpoint | `cdb206d` | Preserved first 1,000 runs and 208 tests, then added failing-before/passing-after injury and late-support-gap regressions. |
| M7 final implementation | `6f2a2d6` | Segment-correct concealment/protection, synchronized tucked rendering, 216 tests, final 800-run round and independent problem replays. |

Each milestone has saved inputs/results; details and intermediate observations are in [the historical milestone log](v027-milestone-notes.md). Small twelve-seed changes are feature checks, not statistical claims. M2 reuses M1's saved pre-change cohort rather than counting it as a new execution. The final inventory contains **144** recorded milestone executions, correcting the provisional 156 estimate in the old progress note. Forty-eight independent milestone repeats are verified separately.

## Confirmed defects corrected

1. **Full cover was presentation-only before this release.** Protected rays now have a real height/visibility/firing consequence; lateral threats still hit. Ordinary movement and expired intelligence cannot leave the actor permanently hidden.
2. **State/priority integration:** an intended long column exceeded the former support band, causing unnecessary escort retargeting. Search could complete an observation goal while looking away. Maneuver duties could be swallowed by a cyclic full-cover posture. Explicit role handling, support distance and actual-observation completion fix these cases.
3. **Late support-clock defect:** after a maneuver had progressed, a brief loss of fire was tested against the maneuver's original start time, so it could cancel immediately. A regression fails against frozen M6 and passes using time since the current support gap. A real shot clears the gap; original deadlines/risk checks remain, so no perpetual waiting or forced unsupported charge is introduced.
4. **Remembered-fire arm accuracy:** the new hit resolver omitted the existing arm-health factor. A controlled valid-ray test demonstrates injured arms incorrectly hitting at healthy probability before the fix; after the fix, ammo/pressure remain real while the injury changes hit eligibility. All affected configurations were rerun.
5. **Near-observer cover geometry:** the old protection sampler may look 1.5 tiles along a bearing, beyond a nearby observer. Reusing it for concealment could hide someone from an ally on the same side of a barricade. A deterministic sight counterexample fails before the fix. Concealment now traces only the actual segment; new-model protection stops before a close attacker. Nearby protected treatment remains functional. Frozen legacy mode deliberately retains its archived approximation. This physical correction is retained despite adverse specialty results; restoring invalid concealment to improve metrics would be wrong.
6. **Presentation/diagnostics:** ordinary high crouch/reload/treatment/mounted rendering could disagree with low concealment or show a residual flash. Authoritative tucked state now controls body/weapon height and prohibits flashes. The flash now draws above its dust/residue rather than being dimmed by it; the render-order regression fails before and passes after the correction. Stopped/reactivated suppression tasks record actual rejection/current eligibility, and maneuver aborts record their actual decision-site reason. Crossing completion requires passing the exit, not retreating.
7. **Equivalent perception optimization:** reject an unseen cone before terrain traversal. A thousand deterministic rays verify equality to the original LOS-first predicate. No random draws or decision outcomes are changed by this optimization.

## Exact runs, seeds, versions and methodology

Large audit executions: **3,000 complete matches, zero timeouts**. This includes the planned 1,000, two 600-case corrections, and a final 800-case geometry/legacy round. Including 144 recorded milestone cases, 48 verified milestone repeats, 103 problem replays and 48 full browser-timestep playback/repeat executions, **3,343 complete executions are recorded**. These are executions, including paired versions and independent repeats, not 3,343 unique scenario configurations. Unit-test battles, isolated browser fixtures, partial grenade probes and unretained exploratory reruns are excluded from that count.

- **Legacy:** seeds 1–200, no grenades, original configuration. Two fresh batches preserve all 200 original `v025-after-A.json` core hashes. Final duration P50/P90/P95/max is 64.6/98.9/113.6/170.4s. No change in old outcomes is claimed.
- **Expanded baseline:** 200 fresh main matches, seeds 2001–2200; every baseline core hash also matches archived v0.2.6. For `i=0..199`: seed=2001+i, layout=i%4, scenario `[standard,short-contact,reduced-reserves,leg-injuries][floor(i/4)%4]`, spawn=floor(i/16)%3. Short TTL=6s, otherwise 8s; reserves halved or left legs set to 65 in the respective fixtures. No hidden enemy starting coordinates are supplied to AI.
- **Special cover:** same seed/scenario schedule, existing urban variant=i%3, grenades/tactical layer enabled. Recorded positions: US `(3,11),(6,10),(12,9),(15,10),(17,10),(2,10)`; RU `(3,15),(6,15),(8,15),(18,15),(25,13),(27,15)`. This deliberately creates cover/grenade opportunities. It is not an expanded-map baseline.
- **Special movement:** same seed/scenario/layout schedule on expanded geometry. Existing `reachableGoal` resolves US `(13+j%3,3+j)` and RU `(13+j%3,27+j)`, j=0..5, from connected street anchors. The initial targets are recorded exactly. This is a movement/encounter fixture, not a new production map.
- Every before/after sequence asserts seed, scenario, options and actual initial positions identical. dt=0.1s, diagnostic cap=1800s; no game timer or forced result. Browser step remains 0.05s. Six additional default-health/ammo fixtures (seeds 2001, 2002, 2011, 2012, 2017, 2037) run to completion headlessly and with rendering grouped at 1×/2×/4×, then independently repeat: 48 executions. Their every-step combat/RNG/search digests match; this is read-only presentation validation with a graphics sink, not a GPU benchmark or a claim of equality between different integration timesteps.

Dataset aliases matter: `*-initial.json` / `expanded-final-initial.json` mean integrated M6; `*-final.json` without a version is the intermediate arm-only correction; `*-final-v2.json` includes late-gap correction; **`*-final-v3.json` is the final physical model**. All are retained. Main sampler outputs share the same metric/hash method. Specialty integrated sampling is version 2 and includes facing; `audit-v027-milestones.mjs` preserves the earlier milestone method for reproduction.

Seconds below are per-match means of soldier-seconds unless labeled. Exposure requires known snapshot LOS and protection <0.28; useful cover requires a protected known in-range lane. Full shelter may remove LOS, but unseen threats are not added to knowledge. Navigation counts actual recorded failure increments. Common cover-cycle flags use the inherited ten-second metric; specialty `coverCycles` uses a separate twenty-second revisit heuristic and is **not** numerically interchangeable. Posture transitions include legitimate timed exposure/release, not only defects. Specialty `stuck` is stationary-without-direct-sight for >20s, including legitimate rest/overwatch; trace diagnosis is required.

Percentiles use existing sorted index floor(n*p), capped at the last element. Treatment-response and personal-reacquisition quantiles exclude unresolved episodes. New peeking creates more short LOS losses, so shorter reacquisition medians do not prove better long-range search. Total incoming pressure includes all weapons; remembered-fire effectiveness is not separately causally attributed in the cohorts. Focused tests verify its actual attenuated effect. No metrics were redefined to hide adverse results.

## Main expanded comparison — 200 identical configurations

Full precision, per-role/per-soldier records and all paired deltas: [comparison JSON](v027-expanded-comparison.json).

| Metric | Main v0.2.6 | Final v0.2.7 |
|---|---:|---:|
| Duration P50, s | 84.9000 | 102.2000 |
| Duration P90, s | 141.1000 | 152.3000 |
| Duration P95, s | 193.8000 | 174.0000 |
| Maximum duration, s | 349.1000 | 249.4000 |
| Navigation increments / match | 3.4150 | 2.9850 |
| Cover-cycle flags / match | 1.5100 | 1.2050 |
| Exclusive engagement time | 99.7110 | 96.7845 |
| Shots / match | 225.7650 | 218.7100 |
| Exposure time | 234.9775 | 288.6045 |
| Known-threat time | 487.1785 | 554.9680 |
| Exposure share, % | 48.2323 | 52.0038 |
| Useful cover time | 31.4720 | 37.2900 |
| Completed cover relocations | 19.4800 | 16.8550 |
| Abandoned cover destinations | 15.2150 | 13.3250 |
| Passive share, % active time | 17.6497 | 22.4760 |
| Mounted LMG shots / match | 7.7150 | 5.0400 |
| Mounted time | 2.6010 | 2.4510 |
| Combat-ineffective soldiers at end | 8.4350 | 8.6100 |
| Dead at end | 4.7050 | 4.7050 |
| Living incapacitated at end | 3.7300 | 3.9050 |
| Personal reacquisition P50, s | 3.4000 | 2.5000 |
| Personal reacquisition P90, s | 11.8000 | 10.3000 |
| Timeouts / 200 | 0.0000 | 0.0000 |

| Search / medical metric | Main | Final |
|---|---:|---:|
| First contact P50, s | 18.8000 | 18.6000 |
| First contact P90, s | 27.6000 | 27.9000 |
| Observed-landmark coverage, % | 42.2251 | 40.2719 |
| Search squad-seconds / match | 46.8895 | 42.5670 |
| Repeated search goals, total | 1.0000 | 0.0000 |
| Failed/expired search objectives, total | 26.0000 | 32.0000 |
| Recent unsupported repeats, total | 0.0000 | 0.0000 |
| Shots / medic | 2.1525 | 2.2925 |
| Completed treatment / medic | 1.3750 | 0.9675 |
| Treatment interruptions / medic | 2.1375 | 1.9125 |
| Medic casualty rate, % | 59.5000 | 58.7500 |
| Navigation increments / medic | 0.4575 | 0.5275 |
| Medic shots when no care needed | 0.0975 | 0.1525 |
| Observed treatment-response P50, s | 7.5000 | 13.6000 |
| Observed treatment-response P90, s | 43.3000 | 57.8000 |

**Negative results are material:** median/P90 duration, absolute and proportional exposure, passive share and casualties rise; mounted-LMG shots fall. Medic completion and response worsen despite slightly better casualty/interruption measures. Correct treatment code does not establish preserved medical effectiveness in the changed tactical environment. These need review before treating the release as a general quality improvement. No unsafe rescue or forced advance was added to make these numbers look better.

Main grenade throws/detonations increase from 9/9 to 40/40 in the final 200-case expanded comparison, with effective uses increasing 6→36 and no observed friendly hits. Exact totals are also retained in the comparison JSON. Increased use follows changed encounters/cover, not a changed grenade inventory/fuse/selection rule. Specialty friendly hits remain possible below. A friendly-hit counter counts friendly bodies damaged by blasts, not necessarily unique friendly-fire grenades.

## Specialty iterations — same 400 inputs, no timeouts

M6 is initial integrated behavior; v2 includes arm/support fixes; v3 adds correct concealment/protection geometry. Treatment values are completions per match (two medics), not per medic.

| Cohort/version | P50 / P90 / P95 / max, s | Nav / match | Treatments / match | Medic casualties / match | Friendly grenade hits, total |
|---|---|---:|---:|---:|---:|
| cover M6 | 69.0 / 152.2 / 186.5 / 287.0 | 1.1850 | 0.9000 | 1.3050 | 1 |
| cover v2 | 69.0 / 152.2 / 176.1 / 287.0 | 1.1800 | 0.8900 | 1.3050 | 1 |
| cover final v3 | 80.8 / 149.0 / 175.6 / 305.3 | 1.5350 | 0.8050 | 1.3700 | 3 |
| movement M6 | 89.9 / 133.3 / 157.9 / 284.7 | 0.9050 | 1.5300 | 1.1350 | 0 |
| movement v2 | 90.3 / 135.8 / 157.9 / 284.7 | 0.9000 | 1.5300 | 1.1350 | 0 |
| movement final v3 | 89.3 / 131.5 / 157.9 / 256.3 | 0.8550 | 1.4000 | 1.1250 | 0 |

| Final specialty metric, per match unless stated | Cover | Movement |
|---|---:|---:|
| Full-cover time | 117.8020 | 23.2755 |
| Peek time | 83.7640 | 11.9880 |
| Peek openings | 107.0550 | 16.9000 |
| Estimated peek exposure | 47.2669 | 4.7109 |
| Incoming pressure (all weapons) | 22.8523 | 21.0050 |
| Remembered-lane shots | 27.6050 | 15.2250 |
| Useful cover time | 236.7610 | 35.8130 |
| Exposed time | 250.9425 | 274.6640 |
| 20-second cover revisit flags | 11.2250 | 5.6800 |
| Stationary/no-sight heuristic time | 50.9960 | 46.3665 |
| Maximum live squad separation, mean tiles | 25.1077 | 15.9943 |
| Flank starts | 0.7500 | 0.0050 |
| Flank release-near-objective completions | 0.0500 | 0.0000 |
| Aborted flanks | 0.6800 | 0.0050 |
| Crossing completions | 0.0300 | 0.0550 |
| Crossing-wait calls | 0.0000 | 0.0000 |
| Mounted shots | 15.2600 | 3.8600 |
| Treatment interruptions | 3.0800 | 2.6700 |
| Grenade throws | 2.6650 | 0.0950 |
| Invalid solid-obstacle shots | 0.0000 | 0.0000 |
| Aim-angle errors | 0.0000 | 0.0000 |

Final specialty data records ten cover-cohort flank completions from 150 starts; many cancel for real risk/support/casualties. A completion is a plan released with the actor alive near its objective, not proof of a kill or causal advantage. There are seventeen recorded crossing completions across these 400 cases, **zero natural crossing-wait calls**. The existing limited mover budget often makes queuing unnecessary. Focused gate tests prove waiting/release behavior; the audit does not demonstrate a new natural squad-crossing advantage. Crossings/formation are deliberately lightweight.

Geometry correction worsens cover-cohort navigation, maximum duration, casualty and some care measures. This is retained for the demonstrated physical invariant, not advertised as a metric win. No body collision was bypassed, no map obstruction removed and no healing/weapon tuning was altered to hide the tradeoff.

## Problem scenarios, actual traces and adverse pairs

Twenty specialty candidates were selected across long duration, navigation, posture frequency, failed maneuvers, stationary waiting, crossings and grenade risks. They were fully replayed initially and after corrections, validating each per-step digest. Five largest pre-geometry v2-versus-main duration regressions were replayed on main and both later versions. Four additional final geometry extremes were replayed before/after. **29 distinct candidate scenarios** were examined; controls help distinguish legitimate holds from defects. Inputs and full five-second decision/failure/plan traces are committed, not reconstructed from a single aggregate.

| Specialty case | Initial → final duration, s | Final move-failure calls | Recorded initial problem / diagnosis |
|---|---:|---:|---|
| cover 2036 | 287.0 → 79.9 | 0 | Wounded rifleman/LMG duel; pressure and injury-based defense, not a route deadlock. Three initial failure calls cannot explain the entire long tail. |
| movement 2076 | 284.7 → 148.3 | 1 | No navigation failures. One flank loses support, another loses physical capability; this case helped identify the support-gap clock defect. |
| movement 2124 | 256.3 → 256.3 | 0 | No movement failures; surviving search/combat continues. Long duration alone is not proof of a stuck formation. |
| cover 2158 | 107.2 → 136.9 | 3 | Repeated soldier congestion, one aborted flank after a navigation failure and another after changing route exposure. |
| cover 2042 | 128.6 → 53.3 | 1 | Maneuver soldier becomes combat ineffective; cancellation is legitimate. |
| cover 2163 | 55.3 → 30.7 | 0 | Newly evaluated exposure invalidates the flank before useful progress; do not force the move. |
| cover 2165 | 200.0 → 72.9 | 1 | Reached maneuver positions coexist with a longer survivor battle. Corrected support recovery does not imply shorter combat. |
| cover 2142 | 198.9 → 54.5 | 2 | Changed exposure, incapacity and unavailable support cancel different plans; actual reasons are recorded separately. |
| cover 2072 | 158.0 → 60.7 | 0 | Suppression/physical capability changes during the maneuver; conservative cancellation is intentional. |
| cover 2122 | 241.8 → 64.4 | 1 | A maneuver reaches its objective; remaining battle duration is not a failure of that assignment. |
| cover 2099 | 135.7 → 112.6 | 2 | Several changing-risk attempts plus a wounded mover; no perpetual mount timer found. |
| cover 2127 | 56.2 → 51.8 | 1 | Multiple route-exposure rejections. Repeated attempts are cooldown-bounded rather than a mandated flank. |
| cover 2172 | 54.2 → 43.5 | 1 | Grenade/cover control case; inspect real events and preserved friendly-risk rules rather than inferring a decision fault. |
| cover 2090 | 41.2 → 98.9 | 1 | Shorter control with real combat/cover transitions; high activity or a transition alone is not a defect. |
| cover 2161 | 76.1 → 67.2 | 0 | Control with no navigation failure; preserved to avoid labeling every defensive hold a deadlock. |
| cover 2009 | 81.4 → 66.0 | 0 | One physical congestion call; real suppression/reload and protected engagements continue. |
| cover 2114 | 236.7 → 129.3 | 1 | Long survivor engagement, three initial movement-failure calls; treatment/defense and reacquisition continue. |
| cover 2046 | 226.8 → 178.9 | 2 | Several interrupted maneuver evaluations. Late support-gap behavior is reproduced and fixed; other capability/risk limits remain. |
| movement 2057 | 225.5 → 84.4 | 1 | A survivor search/engagement tail with one movement failure, not a static unreachable-objective loop. |
| cover 2096 | 221.9 → 65.7 | 0 | A late support interruption cancels an attempt; recovery is now measured from that actual gap. |

Main adverse cases **2078, 2123, 2187, 2114, 2085** have separate main/v2/v3 replays. Observed final states include actual full-cover cycles and unmounting (2078), wounded/medic defensive assignments (2123), independently moving search survivors (2187), remembered fire/recon (2114), and real reload/coordination (2085). These are substantial adverse outcomes for individual seeds even though aggregate maximum/P95 improve. Their exact paired deltas remain in the comparison JSON; none is hidden by the average. In expanded 2123, sampled medic #11 actually treats at 110.1s and 160.1–180.1s, completes care at 173.3s and 181.8s, and becomes incapacitated at 190.0s. Medic #5 repeatedly covers recon or waits with the recorded reason “Medic reserved for survival and actionable casualty care”; it attempts a casualty approach at 180.1s. This shows functioning treatment alongside conservative coordination waits, not a permanently frozen healing timer. Those observations do not justify all of the extra medical delay or establish one causal explanation for the cohort-wide care regression.

Final geometry extremes **2021, 2160, 2026, 2077** were also replayed on v2 and v3. Cover 2021 lengthens 68.6→305.3s with only three final failure calls; 2160 lengthens 62.5→287.6s with one. Those are survivor-combat tails, not a mass pathfinding failure. 2026 lengthens 69.7→280.8s and has eleven raw congestion calls. In 2077, duration is nearly unchanged (130.9→133.2s) but failure calls rise 4→19, mostly leader #0 alternating recon/cover attempts against physical congestion. It eventually fights from (12,13); other actors also engage. The route solver does recover, but repeated occupied choke-point approaches remain a genuine quality limitation. Terrain-only candidate planning does not fully predict stationary supporting bodies. A broad body-aware navigation rewrite or forced removal of blockers was not speculative-shipped; earlier repository audits already documented unsafe tradeoffs for such filters. This release does **not** claim that congestion is solved.

## Tests, build, rendering and performance

Final suite, freshly rerun after resumption: **216 passing, zero failing**, eighteen test groups, including all 178 existing tests plus 38 new posture/suppression/coordination/security/crossing/render checks. The existing escort regression now asserts actual movement toward the distinct destination, allowing a legitimate lateral first step. The [resumed full-suite log](v027-tests.txt) and [build log](v027-build.txt) are retained. Full production build succeeds; `npm install --ignore-scripts --offline` succeeds. Vite retains the existing ~1.6MB Phaser chunk advisory. Pages base `/annous-warfare/` and official deployment workflow are unchanged; only a reviewed main merge would deploy.

Mobile Chromium verifies portrait/landscape, all twelve selections in overview, distant squad focus, native touch scrolling of actual inspector content, pan/pinch, bounds/centering, pause/restart, actual grenade counter and 1×/2×/4×. A final same-battle ten-second 4× heap/frame sample is recorded; earlier reports that navigated to legacy before sampling heap are retained but are **not leak measurements**. The isolated grenade fixture uses real AI/grenade simulation with a protected cluster and nonfiring opponents, then pauses only the fixture after real flight/blast events for screenshots. It passes at all three speeds and is not counted as a natural 6v6 audit match or deployed game content.

Final normal-app sample: **533 frames**, median/P95/max **16.7/33.3/233.3ms**, **39.40s** simulated. Unforced JS heap over that same sample: **34,238,054→20,738,901 bytes**. The retained [pre-resume sample](v027-mobile-pre-resume.json) was 587 frames, 16.7/16.8/49.9ms and 14,876,289→56,766,063 bytes; the variation demonstrates host/GC sensitivity rather than a reliable device benchmark. This short sample includes live simulation/render buffers and uncontrolled GC; it does not establish a memory plateau or leak freedom. Heavy concurrent audit runs produced worse host frame times, retained in the earlier mobile report. Physical Safari/GPU/thermal behavior is not inferred from desktop emulation.

The sampler records wall runtime and heap endpoints; those batches retain all trace records and run concurrently, so their heap growth is not a game-leak measurement and their wall runtime is not a clean single-core benchmark. Game caches/effects are bounded (32 grenade effects, 48 traces, 96 events, fixed-size exploration memory, bounded radio/loss history). New planning uses deterministic intervals, existing bounded path candidates and one terrain tree per search destination. No all-unit-pair pathfinding runs every render frame.

[Squad-view screenshot](v027-mobile-focus.png) · [Real mid-flight fixture](v027-grenade-flight.png) · [Real detonation fixture](v027-grenade-blast.png). Fixture screenshots are deliberately paused at real events, not fabricated effects.

## Reproduce and inspect

```sh
npm install
npm test
npm run build
mkdir -p /tmp/aw-v027-main-replay
git archive 6d61f9c src package.json | tar -x -C /tmp/aw-v027-main-replay
node scripts/audit-v025.mjs /tmp/aw-v027-main-replay /tmp/main-expanded.json 200 '' '' expanded
node scripts/audit-v025.mjs . /tmp/final-expanded.json 200 '' '' expanded
node scripts/audit-v025.mjs . /tmp/final-legacy.json 200 '' '' legacy
node scripts/audit-v027.mjs . /tmp/cover.json cover 200 2001
node scripts/audit-v027.mjs . /tmp/movement.json movement 200 2001
node scripts/replay-v027.mjs . reports/v027-problem-cases-v3.json /tmp/problem-replays.json
node scripts/check-v027-playback.mjs /tmp/playback-parity.json
node scripts/verify-v027.mjs
npm run preview -- --port 4209
# With Playwright/Chromium available, separately:
AW_PLAYWRIGHT_MODULE=file:///PATH/TO/playwright/index.mjs node scripts/mobile-v027.mjs /tmp/mobile.json
npm run dev -- --port 4210
AW_PLAYWRIGHT_MODULE=file:///PATH/TO/playwright/index.mjs node scripts/mobile-grenades-v027.mjs /tmp/grenade-mobile.json
```

Use `audit-v027-milestones.mjs` with archived milestone sources to reproduce the early method. Initial integrated source is `e1493fe`. The intermediate arm-only physics can be reconstructed from `cdb206d` with its fire-movement module restored from `e1493fe`; v2 includes the late-gap correction; final AI stabilization is `6f2a2d6`; delivery additionally includes the tested presentation/diagnostic corrections described above. The verifier checks saved inputs, replay/core/search hashes, recorded counts, browser assertions and source/dataset SHA-256 hashes. It does not rerun tests/build merely by reading reports. The final manifest is [v027-validation.json](v027-validation.json); [exact changed paths](v027-files.txt) supplement the module table above.

## Remaining limitations and physical iPhone checks

- Medical completion/response, exposure/passive share and mounted-LMG contribution remain worse on main's matched expanded cohort. Cover-specialty congestion/casualties and some duration tails worsen after correct physical geometry. These need explicit review; the branch is a measured release candidate, not evidence that every tactical choice is better.
- Many flanks legitimately abort; this is not detailed fire-team doctrine or guaranteed angle advantage. Natural crossing waiting was not demonstrated in the sampled cases. Formations are loose follower offsets, not rigid formations, room entry or window checks. Corner leaning is not modeled.
- Existing conservative care/recon can miss distant safe routes or retry occupied choke points. Unlimited treatment supplies, finite ammunition and unseen enemy movement can still produce a genuine no-resolution situation outside the recorded cohorts. No time-limit win, exact-location reveal or forced charge masks it.
- Peeking and scans add LOS flicker; distinguish short exposure cycles from strategic lost-contact search. There is no terrain destruction, new weapon, personality, career or campaign. Test fixtures are not normal gameplay statistics.
- **Physical iPhone Safari remains unverified.** Check both orientations at all speeds; select distant actors, scroll long diagnostics with touch, pan/pinch/focus, pause/restart and background/resume. Observe a full 6v6 search/contact/lost-contact/endgame cycle, actual peek/fire/reload and side attacks on full cover. Watch medic approaches across/around barricades and injury display, LMG deployment/unmounting, grenade throws/blasts and thermal/battery/frame responsiveness. Reload the URL to repeat a seed; restart increments it. Before merge, test the branch locally/cloud-forwarded; Pages does not publish feature branches automatically.

All implementation and validation work is committed on the requested feature branch. Tested delivery commit **`0d4e4b47dc54b9d9e1fbb0f5153a1f2137112087`** was pushed and verified against GitHub; subsequent delivery documentation records this result without changing source or outcomes. Remote main remained **`6d61f9c99df115735574ba655eb000aa9999cc32`**.

`gh pr create` was attempted and returned `Post "https://api.github.com/graphql": Forbidden`. No PR was created by that command and no merge occurred. The [prepared PR description](v027-pr-description.md) is committed for manual review creation. Comparison: https://github.com/dydtjs345-ux/annous-warfare/compare/main...feat/v027-tactical-infantry-overhaul?expand=1 .
