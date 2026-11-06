## Result

Expanded-map squads now use authoritative full-cover/peek/sustained postures, bounded last-known-position suppression, conditional support-and-maneuver duties, adaptive movement spacing and directional scanning, and bounded road-crossing reservations. Grenade flight, detonation and counters use real simulation events. Legacy/urban compatibility modes preserve their existing tactical behavior; all 200 archived legacy hashes match.

The change extends focused modules rather than replacing the existing coordinator. Grenade damage, fuse, inventory and selection rules, medical rates, injuries, weapon cadence, navigation geometry and Pages deployment remain intact. Local emergency actions and actionable medical care retain priority.

## Validation

- M1–M6 have separate validated commits; M7 adds repeated diagnosis/corrections and the final audit.
- 216 tests pass, zero failures; production build passes (existing Phaser chunk-size advisory).
- 3,000 large-cohort deterministic executions, including main baseline and repeated matched correction rounds; 3,343 recorded complete executions including milestone checks, 103 problem replays and full-match 0.05s playback/repeats. Zero recorded timeouts.
- 29 distinct problematic/extreme scenarios inspected; complete traces and exact seeds/configurations committed.
- Production mobile Chromium controls, selection, inspector native scrolling, pan/pinch, orientations, pause/restart and 1×/2×/4× pass. Real grenade flight/blast fixture passes at all speeds. Physical iPhone Safari remains unverified.

## Measured tradeoffs — review before merging

Same 200 expanded configurations, main → final:

| Metric | Main v0.2.6 | v0.2.7 |
|---|---:|---:|
| Duration P50 / P95 / max, s | 84.9 / 193.8 / 349.1 | 102.2 / 174.0 / 249.4 |
| Navigation failures / match | 3.415 | 2.985 |
| Cover-cycle flags / match | 1.510 | 1.205 |
| Exposure share | 48.2323% | 52.0038% |
| Passive share | 17.6497% | 22.4760% |
| Completed care / medic | 1.3750 | 0.9675 |
| Mounted LMG shots / match | 7.715 | 5.040 |

Medical response/completion, exposure/passive time and mounted contribution regress. Correct physical concealment also worsens some specialty congestion/tails. Many flanks abort for actual risk/support loss; natural crossing waiting was not demonstrated in the sampled matches. Passing tests and shorter tail durations do not establish universally better tactics. No forced aggression, hidden-enemy reveal or artificial victory timer masks those limitations.

Full report: [reports/v027-tactical-ai-audit.md](reports/v027-tactical-ai-audit.md). Exact paths: [reports/v027-files.txt](reports/v027-files.txt). Recorded-run and source hash checks: [reports/v027-validation.json](reports/v027-validation.json).

Do not merge automatically. Physical Safari verification and explicit review of the measured regressions remain necessary.
