# Hotfix 2 audit before implementation

Baseline: latest fetched main `7ecaa89`. No baseline application code was modified. Its source was archived under `/tmp` for identical-seed comparison; no extra Git checkout/worktree was created.

## Reproduced inactivity

With the leader observing from (13,11), a healthy rifleman at (6,6), and a confirmed enemy at (20,11), the rifleman remained at (6,6) for 20 simulated seconds. At the end it had spent 16.9 continuous seconds in Observing contact, with a fresh shared report 14.866 tiles away, no LOS, full ammo, no suppression, and no search task. Killing the leader left no retained casualty entry or temporary commander and did not change the surviving rifleman's objective during the following second.

## Confirmed causes in current code

1. `reacquireContact` only considers final firing positions within four cells of the contact. It tries the best eight **endpoint scores before accessibility is known**, rejects paths longer than 18 cells, and applies a universal three-cell exposed-run / 0.6 average exposure threshold. It does not generate safe intermediate observation approaches. The distance score can rank inaccessible good cover ahead of useful reachable approaches. The same rejected set is retried every three seconds without widening the search.
2. Route risk treats every unobstructed cell as fully exposed regardless of distance to the confirmed threat, confidence, cleared-location evidence or supporting soldiers. This can reject an otherwise defensible approach starting outside plausible weapon range. This is a planner limitation, not a reason to relax emergency survival behavior globally.
3. Searches are self-assigned by unit iteration order. The leader supplies an intention label but chooses no search/overwatch element or actual observation destinations. Unrelated `coverTarget` reservations can consume the entire two-person movement budget. No coordination layer chooses the best available investigator or replaces a failed one.
4. A moving contact more than two cells away from the original snapshot cancels an existing search outright; contact selection/expiration can also discard the task. Twelve-second expiry is independent of actual travel progress. These mechanisms can replace useful objectives before a long approach finishes.
5. `reportCasualty` runs before injury classification; dead casualty entries are removed by the next perception pass. There is no durable combat-loss event or critical-task redistribution. Existing flank code requires an active literal Leader; there is no command succession.
6. Current diagnostics conflate candidate rejection, coordination saturation and real no-safe-route situations into Observing contact. They do not record alternative counts/reasons, assignment ownership or objective progress.

Useful direct firing lanes, suppression holds, reloads and medical treatment are not inactivity defects. Existing LOS, contact snapshots, collision prevention, reaction delays and injury rules are retained.

## Measurement protocol

`scripts/measure-ai.mjs` runs the same observational instrumentation against archived main and the candidate, using seeds 1–20, dt=0.1 and a 1,800-second cap. It observes actual movement, firing, direct observation, treatment, and overwatch supporting a recently moving investigator. The report includes uncensored reacquisition latencies and censored episodes, soldier-seconds without useful observation progress, abandoned objectives, casualties, objective changes following casualties, endgame time and survival. These observations never feed the AI. Detailed definitions and comparison will be recorded after implementation; faster battle completion alone is not the success criterion.

## Additional findings during candidate validation

The paired run exposed a fractional-grid first-step trap beside an incapacitated teammate: a physically separated soldier and casualty can share one rounded tile. Both initial risk planning and collision rerouting now validate a safe first segment before choosing a grid neighbor; a regression verifies escape and continued separation. No bodies are moved or ignored.

Candidate validation also caught an overly broad medic reservation: an armed medic could wait forever beside a weapon-empty fighter, or reserve itself for its own wounds despite self-treatment not being implemented. Before delivery, reservation was narrowed to actionable care and other ammunition-capable fighters; a medic may perform safe observation as the last armed option. This was a candidate defect found by the endgame tests, not a claimed pre-existing main-branch cause.

Coarse historical search sectors can be centered on walls. The planner uses a neighboring walkable static-map anchor without consulting hidden enemy positions. Sealed terrain components with no possible observation are rejected, rather than generating purposeless pacing inside the room.
