# v0.2.6 implementation milestone — audit in progress

Branch: `feat/v026-urban-search-destroy`. Base: `86f8498`, the main merge containing v0.2.5 cover/grenades (`35cd2ee`) and navigation follow-up (`0a110db`). Both prerequisite commits were verified as ancestors of fetched main before work began.

Implemented and tested:

- 54×44 expanded mode, four reproducible layouts and three separated spawn configurations; 12 sealed building blocks, connected streets/alleys and existing functional cover materials. No CQB, new weapon or command UI.
- Own-squad visible-landmark memory, commander-directed scouts/support, unchanged contact combat coordinator, bounded last-known investigation, separate coarse gunfire bearings and return to systematic search.
- Dynamic projection, bounded pan/zoom, readable initial squad focus, Map/USMC/RU spectator views, cached static ground and offscreen culling. Original legacy and v0.2.5 modes remain selectable by URL.
- 173 passing tests, successful npm install/build and available mobile Chromium checks (including selecting all 12 soldiers, both orientations, pan/pinch, camera bounds, inspector scrolling and 4× playback). Physical iPhone Safari is not tested.

Completed initial expanded cohort: **200 matches, seeds 2001–2200, zero timeouts**. Exact scenario/layout/spawn configurations are in `v026-expanded-before.json`. This is the frozen initial feature implementation, before stress-case corrections, rather than an imaginary expanded-map run of old main. Initial first-contact median/P90: 18.8/27.4s; duration P50/P90/P95/max: 89.8/138.5/177.3/273.9s; navigation increments 3.415/match; mean visible-landmark coverage 42.97%. Longer expanded battles are not directly scored against small-map durations.

The fifteen longest cases have been independently replayed into `v026-worst-before.json`; all core and search-memory hashes match the raw cohort. Review and diagnosis are still pending. The initial AI source files in the working checkout were compared with the frozen source snapshot and match exactly. UI-only polish since that snapshot does not change these simulations.

Remaining before final delivery:

1. Inspect the fifteen extreme cases and identify actual defects, preserving valid tactical holds.
2. Apply only confirmed corrections with regression tests.
3. Rerun the same 200 expanded configurations and verify 200 legacy hashes with fresh matches.
4. Run final tests/build/mobile checks, publish paired metrics, adverse cases, limits and physical Safari instructions.
5. Commit/push the final milestone and create a PR if permitted, otherwise provide its comparison URL. Never merge automatically.

The requested minimum 600-run audit is not yet complete. This checkpoint preserves a working implementation and does not claim final tactical stability or physical-device validation.
