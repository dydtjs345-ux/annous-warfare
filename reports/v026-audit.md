# v0.2.6 expanded urban search-and-destroy audit

Branch: `feat/v026-urban-search-destroy`. Main base: `86f8498` (merged PR #12). Before implementation, both v0.2.5 feature commit `35cd2ee` and navigation correction `0a110db` were verified as ancestors of fetched main. The working milestone was preserved and pushed as `1c438e3`; this report completes that checkpoint rather than restarting it. No merge or deployment was performed.

## Delivered behavior and architecture

The default expanded world is **54×44** versus **30×26**: 1.80× width, 1.69× height, 3.05× rectangular area. Four deterministic layouts have **1,615 or 1,647 connected walkable cells**, versus 502 legacy cells. Twelve sealed building blocks, connected outer roads, three vertical streets, two cross streets, intersections, narrow gaps/alleys, open danger lanes and existing cover materials provide multiple routes. Long horizontal sandbag/concrete lines remain functional, with vertical/stepped sections, abandoned vehicle obstacles and crates. This reuses v0.2.5 material, LOS, bullet, grenade, collision and mounting rules. Buildings are solid full-height footprints; there are no enterable interiors, windows or CQB in expanded mode. Layout generation consumes no combat RNG.

Three reproducible spawns put the same six-versus-six roster on opposite map edges, at least 25 tiles apart. There are no initial enemy contacts or search goals derived from enemy positions. `?map=legacy` restores the original no-grenade battlefield; `?map=urban` retains v0.2.5. Battle defaults remain legacy in the simulation API for compatibility; the browser explicitly selects expanded mode.

`src/search.js` adds a lightweight layer under the existing acting commander, not a replacement combat AI:

- Memory samples free landmarks every four tiles. Once per simulated second, living squad members mark only landmarks actually within their own sight radius (capped at ten tiles) and unobstructed LOS. This is **visible-landmark coverage**, not tile-by-tile clearance or proof that a district is empty.
- A terrain-only BFS tree scores reachable unexplored/stale areas by potential new observations, age, travel and recent visits. At most two available fighters search; other soldiers receive separate supporting follower positions. The leader/rifleman/LMG/medic priority and deterministic command succession remain explicit. Medics lead only when no available fighter can do so and care is not actionable.
- Search goals retain useful progress. Failed goals are excluded for 30s; replacement requires at least 3s commitment and goal expiry scales with terrain travel. No-net-progress tracking and navigation failures request replanning. These limits never award victory or reveal opponents.
- Direct enemy perception, immediate survival, reload, suppression, actual care and existing tactical maneuvers keep priority. Real contacts hand control to the existing combat coordinator. The search assignment is suspended, not repeatedly forced over combat orders.
- Phases are **SEARCH, CONTACT, ENGAGE, LOST_CONTACT, REACQUIRE, SEARCH_AGAIN**. A 0.4s visibility grace prevents brief LOS flicker from immediately changing contact phase; lost contact gets 1.2s before reacquisition. Existing snapshots expire after configurable contact TTL (8s normally, 6s in the short-contact cohort); the existing coarse historical sector is bounded to TTL+20s. Systematic search resumes after evidence expires.
- Actual gunshots generate an uncertain audible clue for opposing living listeners within 20 tiles, at most every 2s per listener. Reports contain the listener's own position, timestamp and a bearing rounded to 45°, **no shooter identity, coordinates or exact distance**. They expire after 8s. A fixed eight-tile directional probe can bias exploration, not authorize shooting. This is simplified modeled hearing, not audio playback or a sound-propagation engine.

The inspector adds actual phase, sampled coverage, current/last search destination with suspension status, reason and progress age. Existing contact provenance, assignments, firing reasons, injuries, mounting, grenade and exclusive activity diagnostics remain. No hidden live enemy position is passed into the search planner or soldier inspector. Spectators can still see both sides, as before.

## Confirmed corrections after the initial expanded audit

1. **Arrived escorts could retain obsolete support points.** Planning only tested whether the lead had moved more than three tiles from a planning anchor. An escort already at an old point could be outside useful supporting distance but keep observing there. In baseline 2125 at 20.1s, RU rifleman #8 is at approximately (33.3,30), targeting (33,30), while its lead #6 is at (26.3,30): seven tiles away. Similar precontact follower congestion repeats in 2029/2077/2173. The correction also refreshes an *arrived* escort outside 4.5 tiles of its current lead, preserving an in-progress route and the squad search goal/revision. Ordinary supporting holds within four tiles remain valid.
2. **Nearby command/search-lead changes could leave the old leader ID in escort orders.** Position displacement alone cannot detect succession at a nearby position. Refresh now also checks actual search-lead identity. The new isolated succession test reproduces this with an expired historical sector; the existing bounded casualty-sector response otherwise masks it in many matches. No enemy information is added.
3. **Overview centering:** Phaser clamps an oversized viewport to a bounds edge. The pure framing tests did not catch this engine behavior. Screenshot review found the whole-map view anchored at the top of a tall phone viewport. Bounds now pad only axes larger than the map and remain clamped at ordinary zoom. A real-browser assertion verifies the overview center.
4. **Inspector resize/input race:** two Chromium runs missed the remote-squad tap. Captured data showed a 704-world-unit viewport paired with a 542px canvas at zoom 0.8667; Phaser's 500ms parent-size polling had not caught the inspector's growth. A `ResizeObserver` updates the scale parent size immediately and disconnects on scene shutdown. The browser regression asserts camera and displayed canvas dimensions agree before selection. This is presentation-only; final simulation data predates these camera corrections and render-parity verification confirms rendering does not change outcomes.

The two AI tests fail on the initial source and pass after the focused correction. No weapon tuning, RNG generator, collision radius, healing rate, old cover commitment, mounting or grenade rule was changed to shorten battles. Search-order changes alter encounter geometry and subsequent combat draws naturally; cross-version outcomes are not expected to be identical.

## Exact audit inputs and verification

**600 planned complete runs:** 200 legacy + 200 initial expanded + the identical 200 corrected expanded scenarios. **Zero timeouts** in all three cohorts. Sixty additional independent trace replays and five complete render-enabled replays verify the recorded hashes; some replay seed sets overlap. Counts describe executions, not 665 unique scenarios.

- Legacy: seeds **1–200**, original geometry/spawns, grenades off, scenarios cycling standard / short-contact / reduced-reserves / leg-injuries. Every per-step core hash matches `v025-after-A.json` (also the archived v0.2.5 follow-up reference): **200/200**. Fresh raw data: `v026-legacy.json`.
- Expanded index `i=0..199`: seed `2001+i`, layout `i % 4`, scenario `[standard, short-contact, reduced-reserves, leg-injuries][floor(i/4)%4]`, spawn `floor(i/16)%3`. Grenades on. Standard TTL=8, short-contact TTL=6; reduced reserves halves each reserve; leg-injuries sets every left leg to 65. No artificial enemy clusters or grenade opportunities were inserted.
- Spawn 0: US x=2,y=8+1.5j; RU x=51,y=28+1.5j. Spawn 1: US x=8+1.5j,y=2; RU x=35+1.5j,y=41. Spawn 2: US x=2,y=28+1.5j; RU x=51,y=6+1.5j (`j=0..5`). Exact per-run configurations and initial positions are saved in both raw JSONs and asserted identical.
- Initial expanded means **the feature implementation at `1c438e3`, before stress-case corrections**. Old main has no expanded mode, so it cannot supply an imaginary expanded baseline. Frozen initial AI source was checked byte-for-byte before corrections. Small-map results are kept separate below.
- Simulation dt=0.1s, diagnostic timeout=1800s. There is no in-game timer victory. Browser simulation retains its 0.05s step. Hashes cover every step's RNG state, time, result, positions, health, ammo/reserves, action, facing, mount and assignment type. A separate one-second hash covers search phases/goals/memory/visits/assignments. All 15 extreme and 15 adverse cases match their respective raw core **and search-memory** hashes before and after.

Metrics retain the existing read-only v0.2.5 sampler definitions: seconds below are soldier-seconds except duration/first-contact/reacquisition or explicitly labeled squad-seconds. Firing is the authoritative exclusive engaging activity; passive is the exclusive passive counter. Exposure requires a known unprotected LOS lane; useful cover requires a protected known in-range lane. Navigation failures are recorded progress-counter increments (not every failed `move()` call). Cover-cycle flags are a heuristic, not proof that every change is defective. Reacquisition medians exclude unresolved episodes; squad-board totals include brief LOS flicker and must not be read as thousands of strategic searches. Full precision, per-role/per-soldier records and all paired deltas are retained. Percentiles use the existing sorted index `floor(n*p)` capped at the final element, without interpolation.

## Paired expanded results

Mean per match unless labeled. The correction is **not a universal tactical-stability improvement**. Useful cover and mounted fire improve, but duration tails, passive share, cover churn and some medic measures worsen. The largest duration regression is investigated below, not hidden by an average.

| Metric | Initial expanded | Corrected expanded |
|---|---:|---:|
| Duration P50, s | 89.8000 | 84.9000 |
| Duration P90, s | 138.5000 | 141.1000 |
| Duration P95, s | 177.3000 | 193.8000 |
| Duration maximum, s | 273.9000 | 349.1000 |
| Navigation failure increments | 3.4150 | 3.4150 |
| Cover-cycle flags | 1.4350 | 1.5100 |
| Exclusive engagement time | 100.1875 | 99.7110 |
| Shots | 225.2000 | 225.7650 |
| Exposure time | 236.8810 | 234.9775 |
| Known-threat time | 490.3315 | 487.1785 |
| Exposure / known-threat time, % | 48.3104 | 48.2323 |
| Useful cover time | 29.0490 | 31.4720 |
| Completed cover relocations | 19.1500 | 19.4800 |
| Abandoned cover destinations | 14.0450 | 15.2150 |
| Passive / active time, % | 17.2390 | 17.6497 |
| LMG deploys | 1.4800 | 1.7600 |
| LMG unmounts | 1.3600 | 1.5950 |
| Mounted time | 2.2775 | 2.6010 |
| Mounted shots | 6.8550 | 7.7150 |
| Medic treatment time | 20.6110 | 21.9995 |
| Personal reacquisition P50, s | 3.4000 | 3.4000 |
| Personal reacquisition P90, s | 11.9000 | 11.8000 |
| Combat-ineffective soldiers at end | 8.4950 | 8.4350 |
| Dead at end | 4.4850 | 4.7050 |
| Living incapacitated at end | 4.0100 | 3.7300 |
| Injured at end | 6.8100 | 6.6250 |
| Timeouts / 200 | 0.0000 | 0.0000 |

| Search metric | Initial | Corrected |
|---|---:|---:|
| First contact P50, s | 18.8000 | 18.8000 |
| First contact P90, s | 27.4000 | 27.6000 |
| No-contact matches | 0.0000 | 0.0000 |
| Mean visible-landmark coverage, % | 42.9727 | 42.2251 |
| SEARCH/SEARCH_AGAIN squad-seconds / match | 47.6510 | 46.8895 |
| Contact-loss board episodes, total | 8541.0000 | 8724.0000 |
| Reacquired board episodes, total | 6618.0000 | 6824.0000 |
| Repeated search goals, total | 0.0000 | 1.0000 |
| Failed/expired search objectives, total | 28.0000 | 26.0000 |
| Goal changes without new observations/progress, total | 1.0000 | 0.0000 |
| Recently visited unsupported repeats, total | 0.0000 | 0.0000 |

For squad-board loss episodes lasting at least 0.5s that later reacquire, P50/P90 is **4.0/15.3s → 4.0/15.4s** (5,811→5,910 samples). This does not establish a general reacquisition improvement. One repeated old goal after extensive exploration is allowed when information ages; there are no recent unsupported repeats in either cohort. Failed-objective counts include goals expiring while combat is suspended, so they are not synonymous with unreachable terrain.

| Per medic-match | Initial | Corrected |
|---|---:|---:|
| Shots | 2.4175 | 2.1525 |
| Completed basic treatments | 1.2275 | 1.3750 |
| Interrupted treatment segments | 2.0000 | 2.1375 |
| Navigation failure increments | 0.3275 | 0.4575 |
| Casualty rate, % | 58.5000 | 59.5000 |
| Shots when no teammate needs care | 0.1525 | 0.0975 |

Injury-to-first-treatment response P50/P90: **7.3/41.4s → 7.5/43.3s** (1011→1092 observed responses; unresolved injuries excluded). More completed care does not cancel out the worse interruption, casualty, delay and navigation metrics. LMG shots while a teammate is actually being treated increase **7.5925→8.2400 per LMG-match**; riflemen **1.7500→2.0308**. Existing medic and squad authority rules remain unchanged.

Grenades: **16→9 throws/detonations**, **15→6 effective uses**, **0→0 friendly hits** across 200 matches. Detection records **55→25**, reaction attempts **35→16**; independently sampled successful danger reductions **27→11**. Sparse opportunities on the larger map mean this cohort is not a comprehensive grenade balance study; the inherited focused tests still cover fuse, obstruction, friendly fire and reactions. Invalid shot, firing-direction and aim-error counters remain **zero** in both cohorts.

## Fifteen longest initial cases: actual traces

All cases were replayed completely and hash-verified, not inferred solely from final duration. Layout/spawn and scenario are in `v026-worst-cases.json`; full ten-second decision samples, actual navigation-failure records, mount/care/grenade/casualty events and goal changes are in `v026-worst-before.json` / `v026-worst-after.json`. Navigation columns are metric increments; raw move-failure call counts can differ because the existing counter throttles repeated failures.

| Seed | Scenario; layout/spawn | Initial → corrected duration, s | Nav before → after | Trace diagnosis |
|---|---|---:|---:|---|
| 2125 | leg-injuries; 0/1 | 273.9 → 195.7 | 11 → 8 | 139.4s first contact after broad injured-squad exploration; obsolete escort point and crossing followers confirmed. Late medic/LMG combat and care also contribute. |
| 2077 | leg-injuries; 0/1 | 228.2 → 228.1 | 12 → 5 | Same precontact geometry/follower congestion as 2125. Late real reload, treatment and cover movement; duration is essentially unchanged despite fewer nav increments. |
| 2189 | leg-injuries; 0/2 | 216.4 → 216.4 | 6 → 6 | Three escort failure calls plus care no-net-progress failures. Repeated mount transitions complete deployment/unmounting; no permanent mount deadlock. Injured survivor reacquisition remains slow. |
| 2126 | leg-injuries; 1/1 | 215.2 → 58.6 | 4 → 2 | Escort/recon/care/defend congestion and repeated incapacitation/recovery events. Late medic approach vs armed rifleman; not an unexplained idle lock. |
| 2196 | standard; 3/0 | 210.1 → 144.1 | 7 → 5 | Five care-route no-net-progress failures and two escort failures; one goal-change-without-progress flag. Endgame contains real cover moves and defensive medic waits. |
| 2029 | leg-injuries; 0/1 | 205.8 → 193.8 | 11 → 4 | 139.4s first contact and the same obsolete follower targets; later suppression and genuine LMG treatment/engagement. |
| 2114 | standard; 1/1 | 190.2 → 83.0 | 1 → 2 | Only one escort failure; eventual one-versus-one contact loss, renewed search, then both soldiers firing. No large navigation defect explains the tail. |
| 2110 | leg-injuries; 1/0 | 186.7 → 186.7 | 14 → 14 | Eight escort calls and three care no-net-progress calls, plus recon/overwatch congestion. Outcome is unchanged; correction does not resolve all physical congestion. |
| 2173 | leg-injuries; 0/1 | 181.9 → 295.0 | 11 → 8 | Same 139.4s initial search/follower pattern. Corrected first contact improves to 127.2s, but repeated late treatment/recovery and renewed combat worsen total duration to 295s. |
| 2159 | leg-injuries; 2/0 | 177.3 → 125.4 | 3 → 5 | Two escort and one recon failure calls; intermittent last-survivor reassessment/observation, then resolution. No evidence of an infinite hold. |
| 2163 | standard; 2/1 | 173.2 → 67.9 | 0 → 1 | Zero baseline navigation failures. Treatment, suppression and actual survivor engagement explain the tail; a longer battle is not itself a route defect. |
| 2022 | short-contact; 1/1 | 168.5 → 98.8 | 1 → 2 | One escort failure. Short-lived intelligence expires and a survivor returns to systematic search around 150s, then reacquires legitimately. |
| 2156 | reduced-reserves; 3/0 | 159.0 → 148.1 | 2 → 5 | Two escort failures; reduced-reserve surviving LMGs use last-known-sector investigation. No omniscient shortcut or forced charge added. |
| 2174 | leg-injuries; 1/1 | 158.8 → 124.9 | 5 → 2 | Escort/recon/overwatch congestion; suppressed medic and active casualty approach/treatment. Legitimate danger pauses must remain. |
| 2084 | standard; 3/2 | 156.9 → 81.9 | 2 → 4 | Two escort failures; surviving LMGs alternate actual aiming and contact reacquisition. No invalid fire or mount timer deadlock observed. |

The four layout-0/spawn-1 leg-injury cases legitimately explore roughly 89–91% of sampled landmarks before the original encounter. No initial enemy coordinates or forced meeting point is used to shorten that search. Follower errors are real within that route, but do not explain the entire 139.4s delay.

## Adverse paired cases reviewed separately

The fifteen largest duration increases were also replayed on both versions; hashes match the raw runs. Files: `v026-regressed-cases.json`, `v026-regressed-before.json`, `v026-regressed-after.json`. This explicitly checks new adverse outcomes rather than reviewing only improving original extremes.

| Seed | Initial, s | Corrected, s | Delta, s |
|---|---:|---:|---:|
| 2009 | 113.7 | 349.1 | +235.4 |
| 2133 | 98.4 | 240.3 | +141.9 |
| 2059 | 106.9 | 221.6 | +114.7 |
| 2173 | 181.9 | 295.0 | +113.1 |
| 2103 | 92.5 | 195.6 | +103.1 |
| 2099 | 109.1 | 206.1 | +97.0 |
| 2016 | 74.2 | 163.6 | +89.4 |
| 2044 | 67.0 | 146.2 | +79.2 |
| 2134 | 60.6 | 134.9 | +74.3 |
| 2111 | 86.2 | 159.1 | +72.9 |
| 2107 | 78.1 | 150.5 | +72.4 |
| 2200 | 79.1 | 151.1 | +72.0 |
| 2101 | 57.8 | 115.2 | +57.4 |
| 2155 | 74.0 | 131.4 | +57.4 |
| 2131 | 55.3 | 111.5 | +56.2 |

- **2009 (+235.4s)**: only two actual movement-failure calls. By 320–340s two injured LMGs are aiming, reloading, repositioning and reacquiring; US medic #5 has torso 28.09 and an explicit injury-based defensive/overwatch assignment. It is not stuck in an LMG deployment timer. Search goals/observations progressed earlier. The long survivor firefight is a genuine adverse outcome, not evidence of an unreachable-route retry loop. Existing conservative medic/recon risk rules can still reduce support usefulness here; no speculative medical rewrite was added.
- **2133 (+141.9s)**: after contacts expire, an injured lone rifleman and the opposing survivors systematically search different reachable areas. Trace positions move substantially from 220→240s and new sighting occurs around the finish. This is a slow search convergence limitation, not stationary omniscient pursuit. Goals remain based on each squad's observations.
- **2059 (+114.7s)**: zero movement failures. Two badly wounded survivors search at 200–220s and independently choose the same stale area from their own memories near the end. Forcing their meeting earlier would require a new policy or hidden knowledge; neither was added.
- **2173 (+113.1s)**: contact actually occurs earlier, while repeated real medic treatment/recovery and renewed engagements dominate the tail. At 280s both medics are treating actual nearby patients; at 290s combat and cover movement continue. Removing care or forcing a charge would sacrifice preserved systems.
- Other reviewed adverse cases show changing injured survivor sets, real care/cover/reload, bounded recon retry waits, and local body congestion. In 2016 mounting transitions to unsupported while the enemy medic treats/revives a casualty; 2103 includes real mounted fire and patient treatment; 2099 includes blocked care and continuing rifle engagement; 2044/2111/2131/2134/2155/2200 combine protected care, suppression and recon holds. These remain tactical quality limitations rather than a confirmed new permanent decision deadlock. No blanket aggression or cooldown reduction was applied to optimize duration alone.

## Preserved small-map performance (separate cohort)

The 200 fresh legacy matches exactly preserve hashes and therefore outcomes: P50/P90/P95/max **64.6/98.9/113.6/170.4s**, navigation **2.215/match**, timeouts **0**. The archived latest-main v0.2.5 urban reference has P50/P90/P95/max **59.6/97.5/119.9/166.3s**, navigation **0.75/match**; this urban reference is not falsely counted as a new v0.2.6 cohort. Expanded density and encounter locations differ, so its lower cover/mounted opportunity rate cannot be presented as an improvement over that small urban layout. Legacy's 200 hashes are the compatibility gate, not a target for artificially shorter expanded battles.

## Tests, build and browser verification

**178 tests pass, 0 fail**: all 154 inherited tactical/medical/cover/mount/grenade/navigation/animation tests, plus 5 expanded-world, 15 search and 4 view tests. New coverage includes full free-cell connectivity across layouts, reproducible generation without RNG consumption, all twelve layout/spawn combinations with unknown enemy positions, sealed-building bullet/LOS geometry and low cover, dynamic projection/inverse, camera edge framing and soldier selection.

Search tests cover unseen-enemy relocation parity, actual own LOS memory, persistent distinct search/support orders, growing exploration coverage, shared direct snapshots → LOS loss → expiry → return to search, coarse sounds without target identity/coordinates, actual medic treatment during search and return to activity, deterministic succession with memory retained, explicit ammunition stalemate diagnostics, render grouping at 1×/2×/4×, obsolete support destinations, changed lead identity, failed-route exclusion/recovery, independent reacquisition snapshot updates and unknown-start one-versus-one discovery. New UI assertions check real browser overview centering and viewport/canvas synchronization after inspector growth.

`npm install` and production builds succeed. Vite retains the existing large Phaser chunk advisory (~1.58MB JS, ~374KB gzip); no new framework/dependency was added. Pages base `/annous-warfare/` and workflow are preserved. Five complete expanded matches with render models enabled (covering 1×/2×/4×) match their final core and search-memory hashes exactly. Camera-only changes do not control simulation timing or outcomes.

Mobile Chromium checks use 390×844 and 844×390 touch viewports against the built Pages subpath. They exercise all twelve selections in overview, remote-squad selection, scrollable actual diagnostics, pan/pinch, camera limits/overview centering, USMC/RU focus, orientation, pause/resume, restart and 1×/2×/4×. Two final complete browser runs pass after the resize correction (`v026-mobile.json`, `v026-mobile-repeat.json`). The first records 554 frame intervals, median/P95/max **16.7/33.3/150.0ms**, with **40.15s** simulated over the ten-second 4× sample; the repeat has P95 **16.8ms**. The full test suite also ran on this host during these measurements. This is **desktop Chromium emulation, not a physical iPhone benchmark**. [Squad-focus screenshot](v026-mobile-focus.png) and [centered overview](v026-mobile-overview.png) show the unchanged procedural soldiers in the expanded layout. Static ground is cached per match, sealed blocks aggregate hundreds of wall cells, and offscreen units/structures/grenade effects are culled. Small bounded tracer lists remain inexpensive existing presentation work.

## Reproduce

Run from the repository root with Node 22+ (validation host: Node 24). Initial expanded source is a committed milestone; no lost temporary workspace is required:

```sh
npm install
npm test
npm run build
mkdir -p /tmp/aw-v026-initial-replay
git archive 1c438e3 src package.json | tar -x -C /tmp/aw-v026-initial-replay
node scripts/audit-v025.mjs /tmp/aw-v026-initial-replay /tmp/v026-before.json 200 '' '' expanded
node scripts/audit-v025.mjs . /tmp/v026-after.json 200 '' '' expanded
node scripts/audit-v025.mjs . /tmp/v026-legacy.json 200 '' '' legacy
node scripts/compare-v025.mjs reports/v026-expanded-before.json reports/v026-expanded-after.json /tmp/v026-comparison.json
node scripts/replay-search.mjs . reports/v026-worst-cases.json /tmp/v026-worst.json
AW_RENDER=1 node scripts/audit-v025.mjs . /tmp/v026-render.json 200 '' '2009,2059,2125,2173,2196' expanded
node scripts/verify-v026.mjs
npm run preview -- --port 4209
# Separately, with Playwright and Chromium available:
AW_PLAYWRIGHT_MODULE=file:///PATH/TO/playwright/index.mjs node scripts/mobile-v026.mjs /tmp/v026-mobile.json
```

`verify-v026.mjs` verifies saved inputs/hashes/replays/mobile assertions and writes a source/dataset SHA-256 manifest. Test/build status in that manifest records the separately executed commands; reading files does not rerun tests. For detailed five-second traces use the sampler's `trace` argument and `AW_TRACE_PREFIX` pointing outside the repository. The optional `?debug=1` browser snapshot returns copied spectator data only.

## Remaining limits and physical Safari checklist

- Large-map search is a lightweight visible-landmark heuristic with two scouts and loose supporting followers, not formations, exhaustive room clearance or guaranteed convergence time. Injured opposing patrols can pass on different streets. One repeat after stale information and conservative old combat/medic holds remain possible. No timeout was observed in these recorded cases, but ammunition exhaustion or blocked live-body chokepoints can produce genuine no-resolution situations in other cases; diagnostics expose them without forced victory.
- Navigation failure increments did **not** improve overall. P90/P95/max duration, passive share, cover-cycle/abandonment counts, medic navigation/interruptions/casualty rate worsen in the paired correction. Coverage ends slightly lower in the corrected cohort and cannot be interpreted independently of duration. The fixes are retained for demonstrated order correctness, not advertised as a general performance win. Further tactical optimization needs its own measured audit.
- Existing bounded combat recon/risk planners can miss distant safe routes. Sound is a coarse hearing model. The world geometry remains a process-global active map; construction/step activates the battle's mode, and offline multi-battle stepping must continue using that activation contract. Maps are four fixed reproducible variations, not unlimited procedural city generation.
- No CQB, room/window checks, player commands, new weapons, mobile vehicles, campaigns, recruitment, permanent progression or visual-art overhaul was introduced. Existing treatment has unlimited supplies. No new fog-of-war rendering or audio playback.
- **Physical iPhone Safari is unverified.** On the eventual deployed branch, load a recorded seed, verify separated starts and phase/assignment transitions, and let several complete battles run in both orientations at all speeds. Tap a soldier, immediately switch camera focus and tap the remote squad to check inspector resize; scroll diagnostics, pinch/drag, select near map edges, return from Free to focus/Map, pause/resume, restart and background/foreground. Watch contact loss/renewed search, injured endgames, actual care/mount/grenade animations and thermal/frame responsiveness. Map overview deliberately makes units small; squad focus is the readable play view.

## Changed files and delivery

Runtime: `src/expanded-world.js`, `src/search.js`, `src/search-path.js`, `src/view.js` (new); `src/world.js`, `src/simulation.js`, `src/coordination.js`, `src/intelligence.js`, `src/tactics.js`, `src/presentation-state.js`, `src/diagnostics.js`, `src/inspection.js`, `src/main.js`, `src/urban-visuals.js`, `src/style.css`. Version/entry/docs: `package.json`, `package-lock.json`, `index.html`, `README.md`. Tests: `test/expanded-world.test.js`, `test/search.test.js`, `test/view.test.js`. Audit tools: extended `scripts/audit-v025.mjs`, new `scripts/search-observer.mjs`, `scripts/replay-search.mjs`, `scripts/mobile-v026.mjs`, `scripts/verify-v026.mjs`. The [complete changed-file list](v026-files.txt) includes the report/data files; `v026-validation.json` hashes the data/source. `reports/v026-milestone-validation.json` intentionally remains the historical initial checkpoint.

The working milestone is `1c438e3`; final delivery is committed on the same requested branch. Comparison: https://github.com/dydtjs345-ux/annous-warfare/compare/main...feat/v026-urban-search-destroy?expand=1 . No automatic merge.
