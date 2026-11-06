# v0.2.2 validation

Base main: `5008af3d90a6305011e38efe52fdd6a5ce4cb410`.

## Behavioral preservation

An unmodified main archive was extracted outside the checkout under `/tmp/aw-v022-main`. `scripts/check-animation-parity.mjs` runs seeds 1–10 at dt=0.05 through complete matches, hashes selected authoritative unit/assignment state every 100 steps and at outcome, and compares final duration, steps, RNG calls/state and outcome. New presentation/activity fields are deliberately excluded from the authoritative fingerprint. All ten matches finished and the before/after records match exactly. Raw records: [baseline](v022-baseline.json), [candidate](v022-after.json).

This is strong sampled regression evidence plus read-only observer architecture, not a proof for every possible seed. Animation code never calls the battle RNG, changes body health/ammo/timers or writes navigation/coordination decisions.

## Automated checks

- `npm test`: 56 simulation, 17 coordination and 17 presentation/activity tests — 90 passing tests total.
- Presentation regressions cover real-shot-only flashes, weapon cadence, actual reload timing, blocked-path locomotion, known directional cover, suppression/leg injuries, real treatment ticks/completion, incapacitation/death precedence, exclusive activity priority/sums across seeds, passive versus preparatory activity, read-only rendering, pause/restart, 1x/2x/4x grouping, completion freezes and stable gait boundaries.
- `npm run build`: passes with the existing large Phaser chunk warning.
- `npm run check:animation-parity -- . reports/v022-after.json reports/v022-baseline.json`: exact ten-match parity.

## File inventory

| File                                                           | Purpose                                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/presentation-state.js`                                    | Read-only fixed-step snapshots, bounded event stream and exclusive activity accounting |
| `src/combat-visuals.js`                                        | Reusable render-only pose/effect models and procedural soldier/weapon drawing          |
| `src/simulation.js`                                            | Observation/event hooks around unchanged combat/reload/treatment logic                 |
| `src/main.js`                                                  | Renderer integration and reused static drawables                                       |
| `src/inspection.js`                                            | Cumulative activity and contribution/preparation/passive display                       |
| `test/presentation.test.js`                                    | New visual/event/accounting regressions                                                |
| `scripts/check-animation-parity.mjs`                           | Reproducible baseline recording/comparison                                             |
| `reports/v022-baseline.json`, `reports/v022-after.json`        | Full ten-seed parity records                                                           |
| `reports/v022-browser.json`, `reports/v022-validation.md`      | Browser observations and validation notes                                              |
| `README.md`, `index.html`, `package.json`, `package-lock.json` | Version, visual key, verification instructions and test scripts                        |

## Browser/device scope

Available mobile Chromium checks exercise actual touch inspection, scrolling within the existing 144px panel, portrait/landscape controls, pinch selection behavior, all speeds, pause/resume, restart and sustained 4x combat. Live overview/zoomed combat was visually inspected. Browser observations are saved separately; their timing is host-specific, not an iPhone frame-rate guarantee.

Physical Safari remains unverified. Follow the README device checklist, especially fast shot visibility, real reload/treatment synchronization, blocked soldiers, casualty animation precedence, activity totals, and background/resume. No gameplay balance or tactical AI improvement is claimed by this release.
