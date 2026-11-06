# Hotfix 2: paired simulation results

Baseline main: `7ecaa89746aa58a68f0d41f414b5a3c8f8a157cb`. Candidate: this hotfix branch. The exact same observer script and seeds 1–20 were used for both versions. Raw per-seed results: [before](hotfix2-before.json) and [after](hotfix2-after.json). The AI was frozen before the final measurement pass; no seeds were selected or excluded based on their result.

| Metric                                                        |   Main | Hotfix 2 |
| ------------------------------------------------------------- | -----: | -------: |
| Finished matches                                              |  20.00 |    20.00 |
| Mean match duration                                           | 112.10 |    81.59 |
| Median match duration                                         | 113.60 |    80.10 |
| Mean endgame duration                                         |  49.87 |    36.31 |
| Idle observation / active soldier-time                        | 37.09% |   10.46% |
| Mean idle observation soldier-seconds                         | 318.52 |    60.27 |
| Median personal reacquisition                                 |   8.50 |     3.80 |
| 90th percentile personal reacquisition                        |  32.80 |    17.00 |
| Completed acquisition episodes                                | 747.00 |   733.00 |
| Censored acquisition episodes                                 | 439.00 |   352.00 |
| Mean contribution / active soldier-time                       | 23.90% |   41.19% |
| Mean soldiers ever contributing                               |  11.95 |    12.00 |
| Mean meaningful repositioning decisions                       |  65.65 |    47.25 |
| Mean abandoned committed movement objectives                  |  63.55 |    38.90 |
| Mean frame-target preemptions                                 |  84.00 |   151.05 |
| Mean navigation failures                                      |   8.65 |     3.30 |
| Mean combat-ready survivors                                   |   3.35 |     3.65 |
| Mean battle fatalities                                        |   4.45 |     4.45 |
| Mean living incapacitated at outcome                          |   4.20 |     3.90 |
| Ineffectiveness events (includes repeat falls after recovery) | 217.00 |   202.00 |
| Observable objective change within 2s of casualty             | 149.00 |   165.00 |
| Explicit bounded coordinator casualty replans                 |   0.00 |   182.00 |

## Interpretation

All 20 paired matches completed. Personal reacquisition latency and idle observation decreased, and verified contribution time increased. Mean endgame duration decreased alongside mean match duration; outcomes were not obtained by giving AI enemy locations. Mean battle fatalities stayed the same, with slightly more combat-ready survivors. This supports improved participation and reacquisition for this sample, not a guarantee for every seed or device.

Not every movement measure improved: instantaneous frame-target preemptions increased. A frame target is cleared during local priority changes, whereas a committed squad recon order can remain intact. Both counters are retained rather than hiding that tradeoff. Committed abandoned objectives and navigation failures decreased; frame-level interruptions still warrant physical playtesting. Individual seeds and winner distributions can change because timing changes which combat RNG draws are consumed.

The original 14.866-tile fixture now gets a reachable observation approach, real movement and subsequent firing. Regression tests separately preserve stationary advantageous firing lanes, so reduced inactivity is not a requirement to move constantly.

## Definitions and limitations

- Fixed simulation step 0.1 seconds; cap 1,800 seconds per match. The existing full suite also exercises 0.05-second steps. Averages are over 20 matches, not over separately selected favorable events.
- Endgame begins when either side first reaches at most two combat-capable soldiers while both sides still have survivors. Earlier endgame entry can increase this duration even when total battle duration falls, so both are reported.
- Useful activity is actual firing, current direct observation, protected observation of a fresh known lane, active treatment, or assigned overwatch supporting an investigator that actually moved recently. Merely receiving a label gives no credit. Meaningful movement is at least one tile from the previous movement anchor.
- Idle observation counts active, lightly suppressed contact-aware/assigned soldier-time without useful activity or a one-tile movement update for more than three seconds, excluding reloading. It does not classify every stationary soldier as defective. The exact same rule is applied to both versions, independent of state-label wording.
- Reacquisition measures each soldier's delayed personal acquisition of a shared/last-known contact. Events shorter than 0.5 seconds are omitted as visibility flicker. Unfinished episodes are censored when the enemy becomes ineffective or the match/cap ends; their count and raw durations are saved. Measurement may inspect global outcome state to censor episodes; those measurements never feed the AI.
- Meaningful repositioning counts frame-goal moves of at least one tile. Committed movement objectives use the new assignment map or the baseline's actual search map, then cover/personal targets. An objective superseded before one tile without reaching its destination, firing, or acquiring its recon sightline is counted as abandoned. Frame-target preemptions are separately retained as a broader churn indicator.
- Contribution percentages are time-weighted within each match and averaged across matches. Ever-contributing counts are distinct soldiers, not useful-seconds. Recoveries mean ineffectiveness events can exceed final fatalities.
- The externally observable casualty response metric means a survivor's actual objective changed within two seconds; this is not proof that a casualty caused every change. Explicit coordinator replans are new instrumentation and are zero on baseline, which has no such coordinator.
- This is a deterministic, descriptive 20-seed comparison, not a statistical significance claim. Physical iPhone Safari speed, battery use, and tactical credibility still need device validation. Safe searches are bounded and can miss a longer route; medical priority, ammunition exhaustion or inaccessible choke points can still delay or stalemate a battle.

## Reproduce

Do not create a worktree for this task. Archive baseline source outside the checkout and run the same script on both source trees:

```sh
mkdir -p /tmp/aw-main-baseline
git archive 7ecaa89746aa58a68f0d41f414b5a3c8f8a157cb -o /tmp/aw-main-baseline.tar
tar -xf /tmp/aw-main-baseline.tar -C /tmp/aw-main-baseline
npm run measure:ai -- /tmp/aw-main-baseline reports/hotfix2-before.json 20
npm run measure:ai -- . reports/hotfix2-after.json 20
```

The simulation modules need no Phaser rendering or backend to run these measurements. JSON includes each seed, durations, contribution, movement counters and completed/censored acquisition events.
