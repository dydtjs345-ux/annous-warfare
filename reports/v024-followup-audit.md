# v0.2.4 navigation and duration follow-up

## Versions, scope and evidence

Continued on **fix/v024-cover-medic-stability**, without resetting to main.
A = original v0.2.3.1 main `6f152cb` (includes `06347a5`), using the retained
`v024-baseline.json`; B = existing v0.2.4 commit `80b0440`, using the retained
`v024-updated.json`; C = this correction. The A/B files and prior reports are unchanged.
B was fetched explicitly and matched the working HEAD before edits. Immutable archives
were used for replays. No merge was performed.

Read the previous audit, paired comparison and adverse-case traces. Selected the
**15 largest positive duration deltas B−A**, not fifteen favorable examples. Each B
case was separately replayed before editing: all 15 digests match the historical B
data (`v024-followup-replay-verification.json`). Actual move failures, medical holds,
assignment/watchdog states and late-game decisions are saved in `v024-followup-B-traces.json`.

First validated focused cases, investigated adverse results, then ran the final
**same 300 cases**. All C cases complete, zero timeouts. The 15 final focused digests
match the full C sweep. An additional independent failure-class observer reran all
300 C cases; every per-step simulation/RNG digest and reported failure total matches.
This is independent instrumentation/replay, not an external reviewer.

## Confirmed root causes and exact corrections

1. **Real treatment conflicted with the recon movement watchdog.** B traces have six
   treatment-associated no-progress-state observations across seeds 273, 161, 264,
   133 and 39. These are sampled observations, not necessarily six distinct failures.
   `followAssignment()` measured time since physical movement even while a medic was
   actively treating the patient. It could fail/reassign a valid route after four
   seconds. C pauses that movement watchdog and extends the existing task deadline
   only during the authoritative nearby treatment lease. The target and assignment
   identity remain intact; route danger, death and ordinary order validity still apply.
2. **One failed goal could erase another.** In B seed 71, medic #5 repeatedly alternates
   casualty destinations, including eleven failed move calls toward the same static
   casualty. A second failure overwrote the sole `failedGoal`; the first target then
   looked eligible again. C remembers recent failed approaches per casualty, origin
   and patient position, and requests leader reassessment. The existing eight-second
   retry horizon remains; moving the medic one tile, moving the patient two tiles, or
   expiry permits reassessment. The contextual record supersedes the legacy last-goal
   exclusion, which otherwise masked recovery after a real context change. Reachable
   in-range treatment can still proceed without a travel retry.
3. **Tiny clear steps masqueraded as progress.** A first full candidate exposed seed
   144 as a new timeout. Actual replay shows medic #5 alternating patients 0/1 every
   .1s, y=7.40925↔7.5569375, permanently reporting Moving. Each .148-tile step exceeded
   the old .1 displacement threshold and refreshed the watchdog; no collision was
   needed to sustain the loop. C measures .5-tile net movement (the same scale as recon
   progress) and reports a failed route after the existing three-second window when
   a requested destination remains distant. It handles clear oscillation as well as
   congestion. Failure resets the attempt's progress anchor so a different recovery
   route gets a fresh window. This does not move a stationary defender or order an
   attack: the check runs only on a requested move, and arrival remains a valid hold.
4. **Stale personal cover could repeatedly preempt recon after contact loss.** The same
   rejected seed 144 shows a maneuvering LMG alternating a leader-planned observation
   approach with an old personal cover approach. There was no current direct target
   requiring that override. C releases stale personal cover when an active recon task
   has no direct visual enemy and suppression is at/below .55. Immediate threats and
   the existing suppression/self-preservation branches retain priority. No cover score,
   position lock, firing bonus, or squad goal was changed.
5. **A completed patient could retain one stale treatment interval.** The treatment
   lease now ends when all body parts meet the existing 65 threshold, even if the
   medic has not yet cleared its previous Treating state. Useful care continues as
   before; this prevents a no-longer-useful pause, not an increase in healing speed.

Changed runtime files: `src/coordination.js` (purposeful-pause accounting),
`src/medical.js` (completed-lease release), `src/tactics.js` (contextual care rejection),
`src/simulation.js` (failure recording/recovery, net-progress detection and recon priority).
No medical amount/interval, damage, ammo, range, RNG calls, collision geometry, map,
cover scoring, humanoid rendering, animation timing or Pages workflow changed.

## Rejected candidate and safeguards

A preliminary 300-case correction improved navigation but timed out seed 144 at
1,800s. It was rejected, not delivered. `v024-followup-rejected-comparison.json`
retains its full three-way summary and adverse pairs. Applying
`v024-followup-rejected-source.patch` with `git apply --unidiff-zero` to a B archive reconstructs that candidate;
its seed-144 replay exactly matches the rejected dataset digest. The actual oscillation
and long-state samples are in `v024-followup-timeout-diagnosis.json`.

After correcting net-progress detection and recon priority, seed 144 finishes in
**56.3s** (B 115.8s, A 76.5s); that targeted replay digest matches final C. Regression
tests exercise the failure and recovery semantics directly. No forced advance,
artificial result, shorter test timeout, hidden-enemy knowledge or seed-specific AI
was introduced. Early incomplete full sweeps were restarted when the contextual
recovery rule was corrected; only the final complete cohort is the C result below.

## Three-way 300-case comparison

Exact seeds 1–300, unsigned LCG 1664525/1013904223, `(seed−1)%4`: standard;
contactTTL=6 instead of 8; initial reserves halved; initial left leg=65 for all units.
75 cases each, existing 6v6/map, dt=.1s, unchanged 1,800s audit cap. Quantiles use sorted
index floor(N*p). Global counts are means per match, occupancy/activity are soldier-
seconds per match; timeouts are counts. Raw C per-match/per-soldier records are in
`v024-followup-C.json`; all 300 paired A/B/C results and role summaries are in
`v024-followup-comparison.json`.

|Metric|A: v0.2.3.1|B: previous v0.2.4|C: corrected|
|---|---:|---:|---:|
|durationMedian|69.100|69.500|64.600|
|durationP90|105.700|111.200|100.400|
|durationP95|121.600|129.500|115.400|
|durationMax|168.500|200.900|170.400|
|duration|74.048|75.751|68.366|
|stalled|0.000|0.000|0.000|
|navigationFailures|2.253|2.433|2.230|
|loops|1.673|1.297|1.223|
|abandoned|17.610|16.333|17.203|
|usefulCover|83.596|83.345|80.195|
|exposurePercent|47.401|47.002|48.994|
|passive|133.396|140.370|120.682|
|passivePercent|26.067|26.859|25.163|
|firing|88.687|88.194|85.861|
|reacquisitionMedian|2.900|2.900|2.800|
|reacquisitionP90|16.400|17.600|16.100|
|casualties|8.673|8.673|8.530|
|dead|4.277|4.253|4.233|
|incapacitated|4.397|4.420|4.297|

Medic counts are means per medic per match; casualty/death fields are percentages:

|Medic metric (per medic/match unless %)|A|B|C|
|---|---:|---:|---:|
|treatmentStarts|4.390|3.218|3.158|
|treatmentCompleted|0.580|0.857|0.770|
|treatmentInterrupted|3.793|2.328|2.345|
|treatmentTicks|5.047|5.887|5.362|
|failedApproaches|4.570|5.005|4.455|
|shots|2.507|2.432|2.608|
|combatWithoutCare|0.077|0.077|0.027|
|casualtyPercent|58.167|56.333|55.833|
|deadPercent|26.667|25.000|24.167|

**Improved versus B:** median/P90/P95, maximum duration, raw navigation failures,
cover-cycle flags, passive waiting, contact reacquisition p90, medic casualty rate,
medic firing and total casualties. P95 is also better than A. Maximum 170.4s remains
slightly above A's 168.5s. Useful-cover occupancy falls in absolute soldier-seconds
with shorter battles; protected known-lane share rises A 19.14%, B 18.82%, C 19.63%.
Neither metric should be substituted for the other.

**The prior medical gains are only partly preserved.** Completions C .77 exceed A .58
but fall below B .857; interruptions C 2.345 are slightly above B 2.328, still far below
A 3.793. Completion/start ratios are A 13.2%, B 26.6%, C 24.4%, so the drop cannot be
claimed to be solely shorter exposure. Fewer medic active seconds and changed casualty
opportunities are context, not proof of the cause. The exact “without sacrificing”
completion target is therefore **not fully met**. No healing or defensive-risk buff
was applied merely to recover a favorable counter. This is a remaining review tradeoff.

C firing time is 85.86 soldier-s versus B 88.19, while passive share falls to 25.16%
and units spend less total time in combat. There is no blanket aggression/forced-
movement rule. Shorter outcomes alone are not the evidence of correctness: direct
regressions, net-progress recovery, preserved assignments and repeatability provide
that evidence. Not every role/case or clinical counter improves.

### Navigation classification and loops

The unchanged reported-failure counter falls A 2.253 → B 2.433 → C 2.230/match.
C includes **503 congestion reports (1.677/match)** and **166 newly detected no-net-
progress recoveries (.553/match)**. The independent observer matches all 300 raw
failure totals and digests; see `v024-followup-navigation-classes.json` and
`v024-followup-navigation-verification.json`. A/B could not report the new no-net
class; raw totals are still shown, not silently redefined to conceal it.

Cover-cycle flags are repeated distinct cover destinations within ten seconds, not
all movement loops. Seed 144 demonstrates why mixed recon/cover/patient loops can
escape that metric. New watchdog recoveries are events, not a count of unique loops.
Body congestion can still occur. Recent failed care routes may defer retry up to eight
seconds when context appears unchanged even if a blocker clears sooner; this remains
a conservative limitation, not a guarantee of optimal routing.

## Fifteen original regressions: final focused results

All fifteen improve duration versus B on final code; some remain worse than A or have
more reported recovery events. Final focused/full digest identity is recorded in
`v024-followup-validation.json`. The table follows descending original B−A regression.

|Seed / scenario|A duration|B duration|C duration|B nav|C nav|B trace finding|
|---|---:|---:|---:|---:|---:|---|
|260 / leg-injuries|41.5|200.9|123.7|1|6|One medic congestion failure; later injury-restricted LMG engagement, not a navigation lock.|
|122 / short-contact|78.4|191.6|72.1|2|4|Two medic congestion failures; far casualty approach interrupted by incoming threat risk.|
|273 / standard|43.4|138.8|65.0|5|2|Repeated medical congestion and one treatment-associated no-progress state.|
|161 / standard|41.4|131.1|78.5|2|4|Two cover congestion failures and a treatment-associated recon failure.|
|71 / reduced-reserves|45.1|130.1|58.7|6|1|24 failed move calls, including rapid alternation between casualty goals; six throttled reports.|
|28 / leg-injuries|55.5|135.2|104.4|1|3|One cover congestion failure; otherwise changed combat/medical outcomes.|
|264 / leg-injuries|58.4|137.8|96.0|8|9|Nine failed move calls and two treatment-associated no-progress observations.|
|222 / short-contact|70.9|150.0|50.5|8|0|Repeated medical approaches through congestion; also recon/cover congestion.|
|49 / standard|50.4|118.9|35.7|0|0|No failed move calls; changes in care and combat, not an unreachable-route diagnosis.|
|40 / leg-injuries|76.4|144.6|99.8|0|6|No failed move calls; real treatment holds and changed contact/attrition sequence.|
|133 / standard|42.2|106.1|87.9|4|7|Medical, cover and recon congestion plus treatment-associated recon failure.|
|39 / reduced-reserves|58.5|117.0|70.3|0|2|Treatment-associated recon failure despite no reported move failure.|
|299 / reduced-reserves|76.2|131.4|65.6|1|1|Medical congestion and severe medic mobility injury; useful recovery remains possible.|
|250 / short-contact|68.8|124.0|55.4|5|2|Repeated medical congestion on moving casualty destinations.|
|240 / leg-injuries|50.2|104.9|81.2|8|6|Mixed cover/recon/medical congestion; not every failure is a cover commitment.|


B/C actual decision/failure traces are retained separately. A failed-call trace is not
the same as the throttled navigation counter: e.g. B seed 71 makes 24 false-returning
move calls but records six reported failures. Trace current decision reason is kept
separate from cached alternatives; old alternatives can outlive their original task.

## New severe regressions reviewed

The five largest C−B duration regressions were replayed on both B and C, with actual
ammo, injuries, assignments, suppression and current reasons. They remain adverse:

|Seed|B duration|C duration|B→C extra time|B→C casualty delta|Trace assessment|
|---|---:|---:|---:|---:|---|
|92|49.3|170.4|121.1|+2|No navigation failure. Late samples show real firing, treatment/revival and injury-restricted waiting.|
|46|72.9|155.8|82.9|+3|Injured last survivors; cautious search and suppression. One no-net recovery and one congestion report.|
|280|55.9|134.6|78.7|-1|Unknown-contact patrol/search with recent physical progress, plus congestion/recovery events. No omniscient last-enemy location supplied.|
|146|50.3|128.8|78.5|+1|Severe injuries restrict two survivors. The mobile LMG actually searched at 113.9s; this is not a perpetual movement lease.|
|120|56.5|124.7|68.2|+3|Late samples show actual reload/engagement; no evidence of a permanent route or mount lock.|


These traces are in `v024-followup-B-new-regression-traces.json` and
`v024-followup-C-new-regression-traces.json`. In seed 146, at 120.1s two survivors have
not moved for a long time, but their injuries still trigger existing restrictions;
the third unit actually moved at 113.9s and searched/fired earlier. The sampled
scenario is not an ammunition-exhaustion diagnosis. Removing these injury rules or
providing unseen positions to force a faster end was not justified. Remaining long
injury-restricted pauses and unknown-contact searches are explicitly unresolved.

Different medical/route decisions change later shot order, injuries and survival;
large duration changes are not a direct tally of removed watchdog seconds. Seed 92
has no reported navigation failure at all. It is a serious outcome regression, but
not evidence to invent a pathfinding explanation. Final C has no observed permanent
mounting or navigation deadlock in this cohort; this does not prove all seeds finish.

## Tests, production and mobile

**130 passing tests**, zero failures: all 123 previous tests plus seven new regressions:

- Active treatment pauses recon's movement watchdog/deadline and retains the assignment;
  ending treatment permits actual movement again.
- Two failed casualty destinations cannot overwrite each other's retry exclusion.
- Expiry, a moved origin or materially moved casualty permits reassessment even with
  the legacy last-goal record present.
- A completed patient cannot remain under a stale treatment lease.
- Alternating sub-tile goals trigger no-net recovery, and a new attempt can move.
- Ordinary healthy and severely injured gait still makes valid navigation progress.
- An active recon order wins over stale personal cover after LOS loss.

Full production build passes; the existing large Phaser chunk warning remains.
Existing separation, injury, suppression, contact, medic, squad, LMG and procedural
animation/speed tests pass. `git diff --check` passes. No added runtime dependency.

Production mobile Chromium at 390×844 / 844×390, touch/DPR2: tap LMG inspection,
144px scrolling panel, pinch preserving selection, pause/resume, restart 6v6,
no horizontal overflow and 1×/2×/4× controls pass with no browser errors. Final ten-
second 4× RAF sample: **595 frames, median 16.7ms, p95 16.8ms, max 50ms** on the host.
Results are in `v024-followup-browser.json`. This is not a physical iPhone benchmark.

Physical Safari checks remain: watch a medic fail/recover from a congested approach;
watch a patient resume its retained goal after useful care; inspect recon versus
cover after LOS loss and urgent fire; follow an injured late-game survivor; test
portrait/landscape, inspector scroll, pan/pinch, pause/restart and all speeds. Report
seed/scenario when reproducible, current reason, device/iOS and speed. Sprites and
all existing animation code are unchanged.

## Reproduce

```sh
npm test
npm run build
mkdir -p /tmp/aw-B
# Use a fresh archive directory.
git archive 80b0440 | tar -x -C /tmp/aw-B
AW_TRACE_PREFIX=/tmp/B node scripts/audit-cover-medic.mjs /tmp/aw-B /tmp/B.json 300 trace 260,122,273,161,71,28,264,222,49,40,133,39,299,250,240
AW_TRACE_PREFIX=/tmp/C node scripts/audit-cover-medic.mjs . /tmp/C.json 300 trace
node scripts/compare-navigation-followup.mjs reports/v024-baseline.json reports/v024-updated.json /tmp/C.json /tmp/three-way.json
node scripts/trace-navigation.mjs /tmp/aw-B reports/v024-followup-cases.json /tmp/B-traces.json
node scripts/trace-navigation.mjs . reports/v024-followup-cases.json /tmp/C-traces.json
node scripts/count-navigation-recoveries.mjs . reports/v024-updated.json /tmp/classes.json
```

The new comparison script performs no subprocess spawning, so it also works under
restricted execution environments. `v024-followup-rejected-source.patch` is audit
evidence for reproducing the rejected candidate, not a patch to apply to final C.
Temporary five-second traces for all 300 cases were omitted from Git; complete
per-case/per-soldier metrics, selected decision traces and replay proofs are committed.
