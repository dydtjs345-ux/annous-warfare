# v0.2.4 cover and medic stability audit

## Baseline, inputs and ordered validation

Latest main `6f152cb` includes v0.2.3.1 (`06347a5`). Branch:
`fix/v024-cover-medic-stability`. An immutable archive of that main supplied the
baseline. **300 baseline + 300 final paired matches completed, zero timeouts.**
An additional 300-case diagnostic trial was revised before final delivery; its
comparison is retained in `v024-trial1-comparison.json`, not presented as the final
result. A preliminary unfinished baseline sweep was restarted after an observer
counter incorrectly counted completed treatment as interruption on the following
step. Only the corrected observer's complete baseline is retained and compared.
No AI source change preceded that baseline.

Exact seeds **1–300**, unsigned 32-bit LCG `(state*1664525+1013904223)>>>0`, divided
by 2^32. Scenario `(seed-1)%4`: standard; contactTTL=6 instead of 8; initial reserves
halved (rifle 90, LMG 150); or initial left-leg health=65 for every soldier. There
are 75 of each, using existing simulation inputs, standard 6v6 roles and existing map.
Time step .1s; 18,000-step/1,800s timeout. No new random calls, weapon calculations,
healing amount/interval, collision geometry, maps or procedural sprite code changed.
Changed shot counts/RNG consumption arise from changed decisions, not cosmetic RNG.

Per-match and per-soldier data: [v024-baseline.json](v024-baseline.json),
[v024-updated.json](v024-updated.json). Every row records seed/scenario; every soldier
records identity, role, exposure, cover choices/switches/arrivals/abandonment, navigation
failures, cycle flags, activity, shots, treatment attempts/outcomes, response episodes
and final survival. Per-role summaries and all 300 paired duration/casualty/passive
and cover-cycle deltas are in [v024-comparison.json](v024-comparison.json).

The fifteen worst baseline cases were separately replayed. Every per-step simulation/
RNG digest equals its baseline record; see `v024-replay-verification.json`. Actual
medical transitions, cover switches and evaluated decisions are retained in
[v024-baseline-traces.json](v024-baseline-traces.json). At 5s intervals, additional
temporary traces recorded active/dead status, injuries, known contacts, goals,
assignments, blockers and reasons. Diagnosis summaries are in `v024-diagnoses.json`.
This is independent observational instrumentation and replay, not an external review.

## Main comparison

Times are seconds; activity/occupancy are mean soldier-seconds per match. Other
counts are means per match except timeouts and response sample count. Quantiles use
sorted index floor(N*p), with the exact same observer on both versions.

| Metric | Baseline | Final |
|---|---:|---:|
|durationMedian|69.100|69.500|
|durationP90|105.700|111.200|
|durationP95|121.600|129.500|
|durationMax|168.500|200.900|
|duration|74.048|75.751|
|stalled|0.000|0.000|
|loops|1.673|1.297|
|abandoned|17.610|16.333|
|relocations|17.463|17.027|
|navigationFailures|2.253|2.433|
|usefulCover|83.596|83.345|
|exposed|207.026|208.134|
|exposurePercent|47.401|47.002|
|passive|133.396|140.370|
|passivePercent|26.067|26.859|
|firing|88.687|88.194|
|shots|238.350|236.877|
|reacquisitionMedian|2.900|2.900|
|reacquisitionP90|16.400|17.600|
|responseMedian|8.000|8.200|
|responseP90|48.300|48.200|
|responseSamples|1037.000|1084.000|
|casualties|8.673|8.673|
|dead|4.277|4.253|
|incapacitated|4.397|4.420|
|medicTreatmentTime|13.773|14.829|
|mountedShots|35.967|34.810|

**Measured improvements:** potential cover cycles fall about 22.5%, abandoned cover
journeys fall about 7.2%, and medic treatment completions rise about 47.7% per medic.
Medical interruptions fall about 38.6%. Medic final casualty rate falls 58.17→56.33%,
and medic death rate 26.67→25.00%. Actual fire concurrent with allied treatment rises
for leaders, riflemen and LMGs. No added fire-rate, accuracy or protection bonus exists.

**Measured regressions:** duration P90/P95/max worsen, passive share rises 0.79
percentage points, navigation failures rise 2.25→2.43/match, useful-cover time falls
slightly, absolute exposed time rises despite a slightly lower exposure percentage,
and contact reacquisition p90 rises 16.4→17.6s. Medical response median rises 8.0→8.2s;
p90 changes 48.3→48.2s. Medic approaches abandoned/interrupted before treatment rise.
Total final casualties are unchanged, with slightly fewer deaths and more incapacitations.

There is **no uniform tactical improvement claim**. Engagement time changes by less
than 1% (88.69→88.19 soldier-s), actual shots 238.35→236.88; improvements are not the
result of turning the whole squad into stationary noncombatants or forcing charges.
Some extra stationary time is real, conditional reception of medical care; it remains
visible in the unchanged activity counters rather than being relabeled as contribution.
Patient firing remains possible. Long waits and poor late-game outcomes remain.

## Per-role results

Values below are means **per soldier per match**, not per squad. Leader/LMG/Medic each
have 600 soldier-matches; Rifleman has 1,800. Casualty/death values are percentages.
`coveringShots` means actual shots while any teammate was actually treating; it is a
concurrency proxy, not proof of intentional suppression or successful rescue protection.

| Role / metric | Baseline | Final |
|---|---:|---:|
|Leader / shots|7.527|7.233|
|Leader / passive|8.614|9.086|
|Leader / exposed|11.131|11.089|
|Leader / usefulCover|2.673|2.598|
|Leader / coverSwitches|0.117|0.072|
|Leader / navigationFailures|0.060|0.070|
|Leader / coveringShots|0.707|0.743|
|Leader / casualtyPercent|80.000|79.000|
|Rifleman / shots|12.002|12.089|
|Rifleman / passive|7.533|8.124|
|Rifleman / exposed|14.633|14.594|
|Rifleman / usefulCover|3.920|4.148|
|Rifleman / coverSwitches|0.286|0.118|
|Rifleman / navigationFailures|0.053|0.048|
|Rifleman / coveringShots|1.069|1.130|
|Rifleman / casualtyPercent|81.056|81.944|
|LMG / shots|73.135|72.507|
|LMG / passive|14.104|15.154|
|LMG / exposed|27.367|28.129|
|LMG / usefulCover|25.853|25.170|
|LMG / coverSwitches|0.468|0.270|
|LMG / navigationFailures|0.082|0.075|
|LMG / coveringShots|5.710|5.830|
|LMG / casualtyPercent|52.333|52.500|
|Medic / shots|2.507|2.432|
|Medic / passive|21.380|21.574|
|Medic / exposed|21.116|21.067|
|Medic / usefulCover|1.513|1.461|
|Medic / coverSwitches|0.485|0.393|
|Medic / navigationFailures|0.825|0.927|
|Medic / coveringShots|0.000|0.000|
|Medic / casualtyPercent|58.167|56.333|

Medic attempt/outcome details (same per-medic normalization):

| Medic metric | Baseline | Final |
|---|---:|---:|
|treatmentStarts|4.390|3.218|
|treatmentTicks|5.047|5.887|
|treatmentCompleted|0.580|0.857|
|treatmentInterrupted|3.793|2.328|
|failedApproaches|4.570|5.005|
|combatWithoutCare|0.077|0.077|
|deadPercent|26.667|25.000|

No improvement in medic shooting when no ally needs care was measured: that counter
is unchanged. Its existing combat path is preserved and explicitly regression tested.
LMG useful cover and exposure worsen slightly; the release does not claim all roles
benefit equally. Full per-role active/engaging time, selection, abandonment and survival
numbers remain in the comparison JSON.

## Metric limits

- A useful-cover sample is a protected known in-range lane; exposure is LOS to at
  least one unprotected known snapshot. Multiple directions can satisfy both. Neither
  uses hidden live enemy coordinates; aging snapshots count until existing TTL expiry.
- A cover cycle flags return to one of the previous three distinct destinations within
  ten seconds. It is a potential movement loop, not proof that every switch is wrong.
  Selection/switch counters distinguish new journeys from replacing a live destination.
  No omniscient label of “unnecessary” movement is assigned from match length alone.
- Treatment starts/interruptions come from actual treating intervals and patient changes;
  completed episodes require the authoritative treatment-completion event (all parts at
  least 65). Ticks mean actual +8 healing events, not completed patients. Healing timing
  remains the existing one-second counter, including its existing discrete-step rounding.
- `failedApproaches` means leaving an actual casualty-approach action without entering
  treatment; this includes interrupted/aborted attempts, not just pathfinding failures.
  Navigation failures are counted separately. Interrupted care, aborted approaches and
  unresolved injury episodes are the recorded unsuccessful-care outcomes. They do not
  establish that a safe successful rescue existed, nor a new clinical mortality model.
- Response begins with damage leaving a body part below 65 and ends at the first real
  treatment tick. Unresolved/dead episodes are censored; counts and delayed-over-10s
  flags are retained per patient. Completed-sample comparisons are not population-wide
  guarantees. Initial scenario injuries remain in final injury counts.
- Reacquisition is personal loss of all direct sightings for at least .5s until seeing
  any enemy again. Unresolved episodes are excluded. Activity is exclusive; “passive”
  includes some justified receiving-care and defensive waits. Global averages do not
  replace the decision traces or demonstrate statistical significance.

## Fifteen worst baseline cases and diagnoses

Selection is explicit: five longest; then five highest cover-cycle flags excluding
those; then five highest treatment-interruption counts excluding the previous ten.
Ties use seed. This covers the requested failure classes rather than duration alone.
Exact criteria and configurations are in `v024-worst-selection.json`.

|Seed / scenario|Duration|Actual trace finding / disposition|
|---|---:|---|
|125 standard|168.5|Injury-restricted late search; three treating→pursuit transitions on the same patient and three contact interruptions. Some waiting is legitimate injury defense.|
|293 standard|165.9|Eleven same-patient follow-up interruptions, seven cover switches, and injury-restricted waits. Treatment coordination addressed; late-game delay not declared eliminated.|
|130 short contact|165.5|Four follow-up and four contact interruptions; severe mobility restrictions still justify some holding.|
|18 short contact|159.7|Twelve same-patient follow-up interruptions; all four observed cover switches are urgent. Emergency reactions must remain possible.|
|140 leg injuries|156.1|Three follow-up and five contact interruptions; medic reservations/role timing visible. Not all medic waiting indicates safe care availability.|
|110 short contact|121.6|21 potential cycles, 25 live target switches (four urgent), seven follow-up interruptions. Covers both the commitment and treatment defects.|
|147 reduced reserves|37.1|16 cycles in a short fight, 18 target switches (nine urgent), three contact interruptions. Short duration is not proof of good movement.|
|29 standard|121.5|15 cycles, 18 switches (17 urgent), sixteen same-patient follow-up interruptions. Keep valid defensive destinations without disabling genuine emergencies.|
|78 short contact|119.6|15 cycles, 24 switches (22 urgent), six follow-up interruptions. Existing threat-bearing churn remains an important stress case.|
|37 standard|68.3|14 cycles, 18 switches (17 urgent), four follow-up interruptions. Same structural cover issue; not a reason to force permanent holding.|
|136 leg injuries|110.4|47 same-patient treating→pursuit transitions. Medic #11 repeatedly starts treating #9 and loses reach; some runs show only .1s progress per attempt. Confirmed reach/coordination defect.|
|19 reduced reserves|74.8|28 same-patient follow-up interruptions among 33 medical interruption flags; two under visible contact.|
|298 short contact|59.7|27 same-patient follow-up interruptions among 33 flags; little cover switching. Primarily the medical reach problem.|
|199 reduced reserves|110.4|22 follow-up interruptions, six contact interruptions, mostly urgent cover changes.|
|239 reduced reserves|46.8|30 follow-up interruptions among 31 flags. Brief battle hides substantial unsuccessful treatment activity.|

Follow-up transition and interruption counters use different definitions and need not
match exactly; overlap with contact-triggered transitions is possible. These are
observed transitions, not invented causal labels. **No protected nearby wait satisfying
the diagnostic's full conditions was observed in these fifteen replays.** The protected
contact-care correction is supported by an explicit deterministic geometry fixture,
not an assertion that it caused the aggregate improvement in this selected sample.

## Focused fixes and authority

- `localCover()` now evaluates a new candidate against the existing useful destination,
  not only the soldier's currently exposed transit position. A valid journey is not
  re-admitted against a newly full squad movement budget. Existing navigation and
  failed-goal rejection remain. Better alternatives, lost protection, blocked goals
  or changed firing usefulness can release it. No new unconditional time lock exists.
- A patient's travel may pause only while a living nearby medic is actually treating
  within reach and LOS in the current/previous fixed interval. Suppression or exposed
  known threats release the hold immediately. The patient's squad assignment stays
  intact and valid fire can continue. This fixes treating→pursuit timer resets without
  increasing healing speed, freezing an unsafe patient, dragging or evacuation.
- Medic selection keeps safe ongoing care stable, permits a newly incapacitated
  casualty to take priority, and permits switching to meaningfully nearer safe care
  while approaching. Under directly visible contact, care requires low suppression
  and directional protection for both medic and patient, in addition to existing
  reach/LOS/route checks. Exposed medics retain combat/survival priority.
- Medics on explicit recon request leader reassessment and retain that task until the
  coordinator releases it for actionable care. Coordinator role assignment, existing
  reconnaissance/maneuver budgets and squad goals remain authoritative. Other role
  tasks still use local execution and urgent survival; no new independent attack orders.
- No additional casualty focus-fire rule was added: existing valid direct fire and
  patient firing remain, and measured concurrent support is reported without claiming
  guaranteed covering-fire numbers or revealing an unseen attacker.

## Trial revision and remaining regressions

The first 300-case trial held a selected safe patient too persistently even during an
approach. Revised commitment keeps ongoing care stable but allows a switch when a new
safe casualty is more than one tile nearer; immediate incapacitation priority remains.
The extra regression test proves a medic can stop following a distant moving patient.
Trial P95 138.8s falls to final 129.5s; response median 8.8→8.2s; medic navigation
failures 1.075→.927 per medic. The final tail still worsens against main. The initial
trial summary/role metrics and paired deltas are retained, not hidden.

Five largest final duration regressions were replayed on both versions; see
`v024-regression-selection.json`, `v024-regressions-before.json` and
`v024-regressions-after.json`:

- **260:** 41.5→200.9s, four additional final casualties. Late replay shows two LMG
  survivors alternating actual fire, cautious search, suppression and injury-restricted
  holding. No permanent mounting deadlock or illegal shot was identified. This remains
  a serious case-specific outcome regression; no forced charge was added to erase it.
- **122:** 78.4→191.6s, same final casualty count, 18 extra cycle flags. Injured lone
  medic #5 repeatedly assesses rescue of incapacitated #2 far away. Direct replay at
  t=100/150 shows safe-route rejection under incoming bearings; at t=180 the report
  expires and care routing permits an approach. The medic is slow and under threat;
  declaring this a guaranteed-safe rescue or inventing shooter coordinates would be
  wrong. Risk/uncertainty churn remains unresolved.
- **273:** 43.4→138.8s, one extra casualty, two extra cycles. Traces include actual
  treatment/revival, cautious recon, injury restrictions and changing threats.
- **161:** 41.4→131.1s, two extra casualties, four extra cycles. Medical pursuit and
  suppressed/defensive roles persist; the revised approach commitment does not remove
  every rescue conflict.
- **71:** 45.1→130.1s, three extra casualties, one extra cycle. Before/after medical and
  cover transitions are saved; longer survival/changed combat is not evidence that
  every changed route is safe or tactically superior.

Of 300 pairs, 142 are shorter, 141 longer, 17 essentially unchanged (within .01s).
There is no universal completion-speed gain. These regressions and higher navigation
failure rate remain review risks. Speculative casualty-risk relaxation, omniscient
search and permanent cover locks were avoided. No claim that all requested failure
classes were defective or fully solved is made.

## Tests, build and mobile

Final full suite: **123 pass, zero fail** (113 inherited +10 new). Regressions cover
retaining a useful journey against budget changes; emergency flank escape; protected
contact care with unchanged timing; exposed/pressured refusal; patient travel hold
with assignment retention and danger release; continued firing during care; stable
care/critical triage; leader handoff; nearer safe care during pursuit; and ordinary
medic combat when no care is required. Existing deterministic, medical, injury,
separation/navigation, contact, LMG and procedural animation tests pass.

`npm install`, production build and `git diff --check` pass. Vite's existing large
Phaser bundle warning remains. No dependencies, graphics, CSS layout, map data,
weapon/healing formula, Pages configuration or rendering framework changed.

Production mobile Chromium: touch emulation/DPR2 at 390×844 and 844×390; LMG tap
inspection and 144px scrolling panel; no undefined/NaN text; pinch preserving selection;
pause/resume, restart to 6v6, controls/no horizontal overflow; 1×/2×/4× playback. Host
4× RAF sample: 597 frames over ten seconds, median 16.7ms, p95 16.8ms, max 33.4ms.
See `v024-browser.json`. The initial browser attempt had no preview server; after
starting production preview the full check passed. This was an environment setup
failure, not a game build error. Host results do not verify physical iPhone Safari.

Physical Safari checklist: after deployment confirm v0.2.4 header; run repeated 6v6
openings at each speed; watch cover destination retention and emergency changes;
inspect medic/patient treatment versus pursuit; ensure active patients can fire and
resume squad goals after treatment; check unsafe rescues are refused; follow late
injured survivors; test pan/pinch, tap/scroll, pause/restart in both orientations.
Report device/iOS, speed, actual decision reason and seed/case when reproducible.
Sustained thermal/frame performance, cache refresh and tiny-animation readability
remain device-verification tasks.

## Reproduce

```sh
npm install
npm test
npm run build
mkdir -p /tmp/aw-v024-baseline
# Use a fresh archive directory.
git archive 6f152cb | tar -x -C /tmp/aw-v024-baseline
AW_TRACE_PREFIX=/tmp/before-trace node scripts/audit-cover-medic.mjs /tmp/aw-v024-baseline /tmp/before.json 300 trace
AW_TRACE_PREFIX=/tmp/after-trace node scripts/audit-cover-medic.mjs . /tmp/after.json 300 trace
node scripts/compare-cover-medic.mjs /tmp/before.json /tmp/after.json /tmp/comparison.json
node scripts/trace-cover-medic.mjs /tmp/aw-v024-baseline reports/v024-worst-selection.json /tmp/worst-traces.json
node scripts/trace-cover-medic.mjs . reports/v024-regression-selection.json /tmp/regression-traces.json
```

## Changed files

`src/tactics.js`, new `src/medical.js`, `src/simulation.js`, `src/coordination.js`;
new `test/cover-medic.test.js`; three new audit/comparison/trace scripts; package/version
metadata and README; this report, raw baseline/final datasets, paired/role comparison,
selected traces/diagnoses, replay verification, trial comparison and browser evidence.
The current procedural humanoid renderer and all environmental/weapon assets are unchanged.
