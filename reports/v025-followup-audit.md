# v0.2.5 focused navigation / exposure follow-up

Base: **`35cd2ee461aa08c3d6e479add3ce9e95791f9d91`**, continuing `feat/v025-urban-cover-and-grenades`. No main reset, version bump, map changes or automatic merge.

## Result and limits

Retained one confirmed routing correction: a medic's patient is now an allowed **BFS endpoint** during an urban congestion replan. Physical collision, terrain, sight, treatment reach, cover selection/commitment, risk thresholds, leader assignments, LMG mounting, weapons, grenades and graphics retain their previous rules.

Replayed **200 current-branch urban baselines** before corrections and **the exact same 200 urban cases** with the retained correction. The rerun baseline matches every shipped `v025-after-B.json` core hash. All 400 paired battles finish. Separately reran all 200 legacy cases with the final source; **200/200 core hashes match the existing `v025-after-A.json` hashes**. The legacy compatibility mode deliberately retains its archived decisions; the routing fix is gated to the existing urban mode.

Navigation failures improve **337→150 total (1.685→0.750 per match; 55.49% fewer)**. Medic failures account for **212→35** of these increments. Maximum duration improves **206.2→166.3s**, with zero timeouts in both versions. **This is not a complete tactical-stability improvement:** P95 worsens **103.1→119.9s**, pooled exposure share worsens **45.042710%→45.142391%**, cover-cycle flags increase, and treatment completions fall. These remaining regressions are explicit below. No forced advance, faster weapon, extra ammunition or artificial match ending was introduced to hide them.

## What caused the reported regressions

The original v0.2.5 comparison (initial feature implementation vs shipped 35cd2ee) records navigation failures **257→337**. The fifty clustered leg-injury scenarios account for **17→82**, or 65 of the net 80 additional increments. Longer-lived soldiers after the grenade-spam correction now reach choke points and care approaches that often ended earlier in the initial feature code. The other 150 scenarios account for **240→255**.

The main navigation increases are seeds **1200 (+8), 1104 (+7), 1052 (+5), 1188 (+5), 1156 (+4), 1121 (+4), 1172 (+4), 1098 (+3), 1004 (+3), 1064 (+3)**. They include both actual occupied choke points and the medic endpoint defect. Original raw exposed-time increases are led by **1072 (+216.7 soldier-s), 1172 (+150.2), 1136 (+149.1), 1012 (+127.1), 1036 (+126.1), 1156 (+125.8)**. Those values are exposure time, not proof of worse exposure probability: several fights became much longer.

There is a composition effect in the original 40.05%→45.04% pooled exposure increase. Clustered scenarios' exposure fraction actually goes **61.82%→60.17%**; ordinary scenarios excluding the old timeout 1155 go **42.46%→41.98%**. The clustered cases' known-threat time roughly doubles, and removing the timeout changes the ordinary cases' weight. Both subgroup fractions improve while the pooled fraction increases. This does **not** establish improvement for every individual soldier or case. The retained patch keeps the original metric definitions and reports both absolute exposure and the pooled ratio; no denominator or scenario was changed.

## Confirmed defect, correction and preserved behavior

### Patient endpoint blocks every congestion detour

The existing medic initially follows a terrain path to the casualty. On soldier congestion, `Battle.move` builds an occupied-cell set of living known units. The casualty is included in that set, and its occupied cell is also the BFS goal. Consequently every alternative route is rejected even when there is a clear detour and treatment could begin before the medic reaches that cell. Repeated patient switching/retries then inflate failures, especially in seeds **1050, 1064, 1077, 1098, 1104, 1121, 1188, 1200**.

The correction removes only that goal key from the occupied set when the moving unit is a medic, its actual action is `Moving to casualty`, the goal ID is its selected patient, and that patient is a living teammate. All other occupied cells remain. Every actual step still runs the existing swept `spaceFree` checks, including the patient, all other living bodies and terrain. Treatment still requires **distance <1.4 tiles and clear LOS**; the medic never needs to occupy the patient's collision circle. No team immunity, wall traversal, injury/healing-rate or navigation counter changes.

The deterministic vehicle counterexample has medic `(14,4)`, casualty `(16,6)`, blocking teammate `(15,4)`, vehicle cells `(15,5)/(15,6)`. A route around the vehicle exists, but the old occupied goal rejects it. The new regression test fails on the frozen 35cd2ee source and passes on the retained patch; the medic reaches real treatment range with terrain/unit separation intact and heals through the real treatment system.

### Cover pocket: real occupancy, not disconnected terrain

The short stepped barricade makes `(12,11)` a single-entry pocket: `(12,10)`, `(13,11)`, `(12,12)` are obstacles and entry is via `(11,11)`. In clustered cases, another soldier holds roughly `(11,10.89)` to fire over the horizontal line. The destination itself is free, so terrain-only scoring can select it, but the entrance is physically occupied. Rifleman #2 repeatedly encounters this in **1004, 1036, 1064, 1072, 1104, 1172, 1188, 1200**. This is a cover-accessibility limitation and a valid collision, not evidence that the obstacle cells are disconnected.

An integration test confirms bounded failure and ordinary recovery while the supporting LMG retains its mounted position. The approaching soldier has already reached useful directional protection; holding that position can be correct. The patch therefore does not force another cover move or move the supporting gunner.

Broader body-aware cover filters and earlier reassessment were investigated, but **not retained**: some prevented ordinary travel through teammates who were still moving; others reduced failure counts but produced a new reduced-reserve **1059 ammunition-exhaustion stalemate**. A single-seed isolation reproduces that stall with endpoint+cover filtering, while the delivered endpoint-only correction finishes at **106.5s** (baseline 93.3s). Cover scoring/timers/commitments remain unchanged instead of shipping an unsafe generalization.

### Geometry and LMG checks

All three existing layouts remain connected (502 free cells each; inherited connectivity tests pass). Low sandbag/concrete lines retain directional protection, movement blocking and firing over low cover; vehicles/crates remain full sight/bullet blockers, and only suitable low materials mount an LMG. No geometry, protection/material, collision-radius or pathfinding terrain data is altered.

The 31 independently instrumented before/after cases show **zero blocked-cell incursions**, and every instrumented core digest matches the corresponding raw audit case. Eight additional 0.05s tests cover terrain and soldier separation under the browser timestep. Mount transitions in traces complete or unmount for real movement/contact changes; no permanent mounting deadlock is confirmed. Stationary support gunners can obstruct a choke point as physical soldiers; the retained fix routes a medic around them where possible rather than overriding their assignment.

## Exact paired results

Before means the final v0.2.5 branch at 35cd2ee, not the earlier experimental grenade baseline. Mean values are per match unless labeled. Display is rounded; full precision, all inputs, per-soldier metrics and every paired adverse delta are in `v025-followup-before-B.json`, `v025-followup-after-B.json` and `v025-followup-comparison.json`. No metric implementation was changed.

| Metric | Before (`35cd2ee`) | Retained correction |
|---|---:|---:|
| Duration P50, s | 59.700000 | 59.600000 |
| Duration P90, s | 91.400000 | 97.500000 |
| Duration P95, s | 103.100000 | 119.900000 |
| Duration maximum, s | 206.200000 | 166.300000 |
| Navigation failure increments / match | 1.685000 | 0.750000 |
| Exposure, soldier-s / match | 165.234000 | 165.078500 |
| Exposure / known-threat time, % | 45.042710 | 45.142391 |
| Known-threat time, soldier-s / match | 366.838500 | 365.684000 |
| Useful cover, soldier-s / match | 136.326000 | 137.935000 |
| Completed cover relocations / match | 13.115000 | 13.260000 |
| Abandoned cover destinations / match | 13.115000 | 12.890000 |
| Cover cycle flags / match | 0.790000 | 0.950000 |
| Passive waiting, % active time | 20.780483 | 20.690983 |
| Mounted LMG shots / match | 46.705000 | 47.380000 |
| LMG deploys / match | 4.295000 | 4.470000 |
| LMG unmounts / match | 3.945000 | 4.075000 |
| Medic treatment, soldier-s / match | 7.920500 | 7.167000 |
| All combat-ineffective soldiers / match | 8.720000 | 8.740000 |
| Living incapacitated / match | 4.560000 | 4.525000 |
| Personal reacquisition median, s | 3.100000 | 3.000000 |
| Personal reacquisition P90, s | 14.500000 | 14.500000 |
| Timeouts / 200 | 0.000000 | 0.000000 |

| Per medic-match | Before | After |
|---|---:|---:|
| Navigation failures | 0.5300 | 0.0875 |
| Completed treatments | 0.4600 | 0.3800 |
| Interrupted treatments | 1.1400 | 1.1800 |
| Casualty rate, % | 58.0000 | 58.0000 |
| Rifle shots | 4.9975 | 5.9975 |
| Passive waiting, s | 20.6638 | 19.9778 |

| Grenade metric, totals over 200 | Before | After |
|---|---:|---:|
| Throws | 120 | 121 |
| Detonations | 120 | 121 |
| Effective detonations (>10 scaled damage to an enemy) | 118 | 115 |
| Friendly-fire victims | 0 | 0 |
| Independent selected grenade alerts | 348 | 347 |
| Independent reaction attempts | 220 | 218 |
| Independent successful distance-risk reductions | 90 | 86 |

Medic casualty rate remains **232/400 medic-matches (58%)**. Completed treatments fall **184→152**, interrupted treatments rise **456→472**, and medic rifle shots rise **1999→2399**. Corrected routes do not guarantee better aggregate medical outcomes; this is a remaining negative result, not a new healing or aggression rule. The healing-timing parity test confirms the same health changes in legacy and urban modes when already in treatment range.

The grenade selection, inventory, fuse, damage, friendly-fire and reaction code is unchanged. Outcomes differ because medical movement and surviving fighters differ. Independent reaction successes use the original distance-risk observer; they are not guaranteed survival or a physical fragmentation-avoidance rate. No invalid-shot, firing-facing or aiming-angle error was recorded in either paired cohort.

## Adverse final cases and remaining limitations

The final correction's largest duration regressions are **1169 (38.9→142.0s), 1191 (87.6→166.3s), 1035 (64.0→129.2s), 1009 (38.9→95.0s), 1199 (68.6→119.9s), 1034 (103.1→145.5s)**. Their actual traces were reviewed:

- **1169:** at 120–140s an injured rifleman #1 alternates defensive eligibility and sector search while LMG #10 continues recon. Five movement failure calls remain. This is a slow survivor/search tail, not an inaccessible vehicle cell or mounting deadlock.
- **1191:** the last two medics are engaging/reloading at 140–160s. This is an extended real firefight; healing/rifle balance was not changed to shorten it.
- **1035:** treatment and medical approaches at 100/120s coexist with injury-limited defensive survivors and real engagement at 110s. Existing care reservation can still prolong a fight.
- **1034:** repeated suppression, interleaved recon by both LMGs at 130s, then pinned states at 140s. No failed movement call in the recorded patch run.
- **1009:** real LMG reload/deploy/reacquisition and pinned/medical survivors at 70–90s; no failed movement call.
- **1199:** one LMG has no loaded ammunition, other survivors engage/reload/reacquire and a medic approaches a patient. No failed movement call; finite ammunition and care timing remain relevant.

These observations do not claim an exhaustive explanation for every extra second. Suppression/injury restrictions, survivor search, finite ammunition, care reservation, occupied cover pockets and terrain-shortest risk checks remain limitations. **P90/P95, exposure share, medical completions/interruptions and cycle flags are not fully stabilized.** The route bug is fixed; this should remain under tactical review rather than be presented as a complete pre-merge stability clearance. Search-and-destroy behavior, new combat rules, new maps and weapons are outside this patch.

## Rejected experiments

These were measured, excluded from the delivered code, and kept separate from final before/after results. Smaller navigation counts or shorter average fights alone were not acceptance criteria. Aggregate summaries and worst adverse seeds are in `v025-followup-trials.json`.

| Excluded candidate (200 cases each) | Navigation / match | Exposure % | P95, s | Max, s | Timeouts |
|---|---:|---:|---:|---:|---:|
| Broad proactive cover-route filtering | 0.285 | 47.863 | 110.6 | 154.2 | 0 |
| Early collision-triggered cover reassessment | 0.645 | 43.593 | 124.6 | 1800.0 | 1 |
| Immediate reassessment after an empty congestion route | 0.305 | 43.227 | 119.3 | 1800.0 | 1 |
| Movement footprints + patient endpoint, without cover-policy changes | 0.790 | 45.305 | 119.9 | 166.3 | 0 |

A separate 17-case pilot retaining the original assessment schedule but filtering cover paths also reproduced the 1059 stall. The endpoint-only code in this patch preserves both the original cover policy and physical occupancy construction; it does not include the experimental footprint helper, collision radius changes, new reassessment triggers or new tactical locks.

## Reviewed cases

`v025-followup-cases.json` records 31 selected initial regression, adverse-final and control cases. Read-only movement/cover/mount traces and ten-second state samples are in `v025-followup-traces-before.json` and `v025-followup-traces-after.json`. Cover-decision records are retained at startup, around actual waits/failures and near the end; the files are not full frame dumps. All 62 replay digests match the full audits. Offline traces can see spectator positions for diagnosis; none feed into AI knowledge.

| Seed | Purpose | Navigation before → after | Exposure s before → after | Duration s before → after |
|---|---|---:|---:|---:|
| 1004 | initial navigation/exposure regression | 3 → 3 | 155.9 → 155.9 | 33.1 → 33.1 |
| 1009 | adverse final case or rejected-trial control | 1 → 0 | 151.4 → 203.5 | 38.9 → 95.0 |
| 1012 | initial navigation/exposure regression | 0 → 0 | 205.9 → 205.9 | 60.4 → 60.4 |
| 1034 | adverse final case or rejected-trial control | 1 → 0 | 195.5 → 258.2 | 103.1 → 145.5 |
| 1035 | adverse final case or rejected-trial control | 3 → 1 | 143.5 → 173.3 | 64.0 → 129.2 |
| 1036 | initial navigation/exposure regression | 1 → 1 | 197.3 → 197.3 | 62.0 → 62.0 |
| 1042 | adverse final case or rejected-trial control | 1 → 0 | 194.2 → 228.0 | 93.6 → 128.0 |
| 1050 | initial navigation/exposure regression | 4 → 0 | 152.0 → 145.2 | 206.2 → 58.4 |
| 1052 | initial navigation/exposure regression | 5 → 2 | 151.6 → 161.5 | 65.7 → 65.4 |
| 1059 | adverse final case or rejected-trial control | 1 → 2 | 143.1 → 143.9 | 93.3 → 106.5 |
| 1064 | initial navigation/exposure regression | 3 → 2 | 171.3 → 196.6 | 85.0 → 75.5 |
| 1067 | adverse final case or rejected-trial control | 5 → 0 | 137.3 → 152.0 | 61.8 → 103.4 |
| 1072 | initial navigation/exposure regression | 1 → 1 | 306.0 → 306.0 | 120.4 → 120.4 |
| 1077 | initial navigation/exposure regression | 4 → 0 | 139.7 → 165.4 | 64.9 → 64.6 |
| 1098 | initial navigation/exposure regression | 4 → 0 | 153.0 → 151.5 | 110.6 → 82.6 |
| 1104 | initial navigation/exposure regression | 7 → 1 | 176.9 → 164.2 | 92.6 → 71.0 |
| 1121 | initial navigation/exposure regression | 4 → 1 | 222.2 → 227.1 | 66.7 → 88.6 |
| 1129 | adverse final case or rejected-trial control | 3 → 3 | 234.0 → 209.8 | 66.8 → 100.1 |
| 1136 | initial navigation/exposure regression | 2 → 1 | 211.5 → 164.5 | 87.8 → 81.7 |
| 1155 | adverse final case or rejected-trial control | 1 → 4 | 173.5 → 165.6 | 88.9 → 89.6 |
| 1156 | initial navigation/exposure regression | 5 → 3 | 194.4 → 176.4 | 64.6 → 86.5 |
| 1162 | adverse final case or rejected-trial control | 3 → 0 | 117.5 → 184.6 | 29.6 → 61.7 |
| 1165 | adverse final case or rejected-trial control | 1 → 0 | 223.9 → 287.2 | 79.2 → 106.4 |
| 1169 | adverse final case or rejected-trial control | 2 → 5 | 165.0 → 140.4 | 38.9 → 142.0 |
| 1170 | adverse final case or rejected-trial control | 2 → 0 | 181.5 → 213.8 | 86.4 → 124.8 |
| 1172 | initial navigation/exposure regression | 4 → 3 | 217.1 → 263.7 | 83.7 → 103.5 |
| 1185 | adverse final case or rejected-trial control | 2 → 0 | 190.3 → 253.7 | 61.5 → 74.0 |
| 1188 | initial navigation/exposure regression | 5 → 1 | 153.6 → 155.2 | 49.5 → 49.5 |
| 1191 | adverse final case or rejected-trial control | 2 → 1 | 134.1 → 145.1 | 87.6 → 166.3 |
| 1199 | adverse final case or rejected-trial control | 4 → 0 | 184.1 → 231.6 | 68.6 → 119.9 |
| 1200 | initial navigation/exposure regression | 8 → 5 | 163.6 → 165.1 | 55.7 → 57.0 |


In the selected 31 cases the first-ten-second exposure is **56.6484→56.6710 soldier-s per case**, and useful cover **37.6581→37.5871**. This is a biased diagnostic subset, not a replacement for the 200-case comparison. It provides no evidence of a broad initial-exposure improvement, and the report does not claim one.

## Validation and reproduction

The fixed cohort is **1001–1200**, same recorded layouts, positions and four scenario configurations (standard, short contact, reduced reserves, left-leg injuries) as the original audit. Fifty existing clustered opportunities remain; no new scenario or changed seed. LCG, 0.1s timestep and diagnostic 1800s cap are unchanged; there is no in-game time-limit victory.

```sh
# Freeze the actual pre-patch branch independently
mkdir -p /tmp/aw-v025-followup-baseline
git archive 35cd2ee461aa08c3d6e479add3ce9e95791f9d91 src scripts package.json | tar -x -C /tmp/aw-v025-followup-baseline
node scripts/audit-v025.mjs /tmp/aw-v025-followup-baseline /tmp/before.json 200 '' '' urban
node scripts/audit-v025.mjs . /tmp/after.json 200 '' '' urban
node scripts/compare-v025.mjs /tmp/before.json /tmp/after.json /tmp/paired.json
node scripts/audit-v025.mjs . /tmp/legacy.json 200 '' '' legacy
node scripts/trace-urban-regressions.mjs . reports/v025-followup-cases.json /tmp/traces.json
npm test
npm run build
```

**154 passing tests (149 existing + five new)**: medical detour and actual treatment, useful cover/LMG preservation at a physical pocket, strict scoping of the medical endpoint exception, unchanged healing timing, and eight seeded terrain/separation cases at 0.05s. The bug test fails on the archived pre-patch code. Production build passes at `/annous-warfare/`; existing Phaser chunk-size advisory remains. Pages configuration and all graphics/UI files are unchanged.

`v025-followup-legacy.json` records the 200 final verified hashes against the existing legacy reference; `v025-followup-validation.json` records source/data hashes and check results. The original v0.2.5 reports remain historical records of 35cd2ee and are not rewritten.

Available mobile Chromium checks are recorded in `v025-followup-mobile.json`: actual touch pan/pinch canvas changes, tap/scroll inspection, both orientations, pause/resume/restart, 1×/2×/4× and ten seconds of centered 4× playback. Host frame timings are not physical iPhone Safari measurements.

Physical iPhone Safari still needs: watch a medic detour around vehicles/long cover and a holding LMG; confirm it stops within actual treatment reach without stacking; verify visible injuries/healing and resumption of squad activity; inspect suppressed/injured survivor holds; run full matches at all speeds and exercise both orientations, panel scrolling, pan/pinch, pause and restart. Remaining long survivor tails should be logged with seed/action/assignment rather than assumed to be navigation failures.

## Changed files

- Runtime: only `src/simulation.js`, the scoped patient endpoint exception plus explanation.
- Validation/tools: `test/urban-navigation.test.js`, `scripts/trace-urban-regressions.mjs`, `package.json` test command.
- Documentation: README follow-up link and this report.
- Evidence: `v025-followup-before-B.json`, `v025-followup-after-B.json`, `v025-followup-comparison.json`, `v025-followup-cases.json`, `v025-followup-traces-before.json`, `v025-followup-traces-after.json`, `v025-followup-trials.json`, `v025-followup-legacy.json`, `v025-followup-mobile.json`, `v025-followup-validation.json`.
