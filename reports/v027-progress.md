# v0.2.7 live progress checkpoint

Branch `feat/v027-tactical-infantry-overhaul`, base main `6d61f9c` (merged v0.2.6). Do not merge automatically. M1–M6 and the first M7 checkpoint are committed/pushed; latest checkpoint `cdb206d`.

Validated milestone commits: M1 `a23fa15`, M2 `c5f5056`, M3 `9fb9b1a`, M4 `a703d27`, M5 `9dd59f6`, M6 `e1493fe`. M7 checkpoint preserves 1,000 initial audit matches, 208 initial tests, and unit-tested arm-accuracy and support-gap fixes. Two subsequent 600-case rounds are complete; latest `*-final-v2.json` datasets have 0 timeouts. All 200 first legacy hashes match the archived reference. The full suite then passed 212 tests.

Current working changes include a final confirmed geometry correction: full-height concealment now uses the actual segment before a nearby observer; strict new-model cover protection caps its sample before a close attacker. Legacy compatibility is explicit via tacticalGeometry flags and remains the old model. Rendering uses an authoritative tucked flag even during reload/treatment/mount poses. Ten posture tests and inherited medic/cover/animation regressions pass, including a close-range sight test that failed before correction. A fresh full suite (expected 216 tests) and 800 fresh matches are running:

- `reports/v027-expanded-final-v3.json` (200), log `/tmp/aw-v027-expanded-final-v3.log`, tool session 76560.
- `reports/v027-cover-final-v3.json` (200), log `/tmp/aw-v027-cover-final-v3.log`, session 81800; per-case `/tmp/aw-v027-cover-v3-SEED.json`.
- `reports/v027-movement-final-v3.json` (200), log `/tmp/aw-v027-movement-final-v3.log`, session 23319; per-case `/tmp/aw-v027-movement-v3-SEED.json`.
- `reports/v027-legacy-final.json` (200), log `/tmp/aw-v027-legacy-final.log`, session 93337.
- `npm test`, log `/tmp/aw-v027-final-v3-tests.log`, session 58958.

Do not use v2 as the final physics version. The v3 files are only written when each batch finishes. Preserve every prior dataset; report improvements and negative results. Initial main expanded source is frozen in `/tmp/aw-v027-main` and reproducible from main base. Twenty specialty problem cases have before/after exact-hash replays; five additional worst expanded regressions have main/final-v2 replays. Repeat the same selected cases with final-v3 records and expected hashes once the batches complete. `scripts/replay-v027.mjs` handles specialty fixture records; `scripts/replay-search.mjs` handles expanded audit configs and validates via manual raw hash comparison.

Remaining delivery work:

1. Wait for v3/final legacy and full suite; verify all 200 legacy hashes again. Inspect significant v3 adverse cases rather than assuming geometry correction improved every metric.
2. Regenerate `v027-expanded-comparison` from baseline and v3, retaining the previous v2 comparison under a distinct name. Compare special initial→v3 and v2→v3; rerun the selected 20+5 final cases against v3, preserving earlier traces.
3. Final production build and mobile Chromium (`scripts/mobile-v027.mjs` against preview 4209). Fix heap sampling labels to use the same pre/post 10-second 4× interval (current script already has this fix; older reports sampled across a legacy navigation and must not be claimed as leak measurements).
4. Real grenade fixture checks: `scripts/mobile-grenades-v027.mjs` against Vite dev port 4210; `test/fixtures/grenade-visual.html` is an isolated real Battle/AI/grenade rendering fixture, not normal 6v6 gameplay or deployed content. It pauses only the fixture after real flight/blast events for screenshots. All three speeds already pass. Screenshots in `/tmp/aw-v027-grenade-{flight,blast}-{1,2,4}.png`.
5. Rewrite final `reports/v027-tactical-ai-audit.md` and update README; retain milestone detail as historical notes if useful. Add verification manifest/source/dataset hashes and exact changed-file list. Record raw large-cohort executions (will be 3,000 including the final extra legacy batch), recorded milestone runs (156), problem replays and independent milestone replays separately; do not count case-input files as executed matches or claim unrecorded runs.
6. Commit final validated work, push this branch, attempt PR via `gh pr create --body-file`; API previously returned Forbidden, so provide comparison URL if still blocked. No automatic merge.

Known measured negative results before v3: expanded P50/P90, exposure share and passive time worse than v0.2.6; medic completion/response and mounted LMG shots worse. P95/max, navigation, cover cycles and personal reacquisition improve. Natural crossing waits were zero in 400 specialty cases despite nine recorded crossings; focused gate fixtures test waiting, but do not claim natural procedural coordination improvement. Many flanks appropriately abort for changing risk/casualty/support; do not force aggression to increase counts. Physical iPhone Safari remains unverified.
