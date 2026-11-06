# v0.2.7 tactical infantry AI audit — in progress

Base main `6d61f9c` contains merged v0.2.6 (`c48c268`); verified before creating `feat/v027-tactical-infantry-overhaul`. Nothing is merged automatically.

## Existing architecture inspected

The existing simulation already has shared sight snapshots and uncertain bearings, bounded last-contact recon, expanded-map exploration, conditional one-soldier flanking, directional cover with a two-mover budget, injuries/medic route rules, grenade evasion and LMG deployment. New work extends these systems. No external dependencies or AI framework are added. Legacy and v0.2.5 modes retain old behavior by default; the new tactical layer defaults on for expanded mode and can be explicitly enabled by focused fixtures.

## M1 — cover postures

Implemented authoritative `full`, `peek`, and `sustained` postures in `src/postures.js`. `world.sight` now applies low-cover body/eye occlusion only to real full-posture units; plain terrain points and snapshots retain terrain LOS. A protected ray requires >=0.58 material protection. Full shelter prohibits firing, while flanks/grenades remain dangerous and solid obstacles remain solid in all postures. Reload/heavy suppression can extend shelter; contact expiration, movement, incapacitation and newly reported exposed flanks release it. Nonrandom role/id/pressure-dependent exposure windows avoid shared clocks and do not consume combat RNG. Medical work and grenade evasion precede the holding decision.

Perception does not mark a concealed low-cover position empty simply because no soldier is currently visible; its observed coordinates still freeze and expire. Rendering consumes the posture, lowers the body, and suppresses residual muzzle flashes in full cover. Inspector shows the actual posture and decision reason.

Validation: six new posture tests pass; existing 19 cover/mount, 17 presentation and 15 search tests pass. Main baseline suite: 178 passing tests. Twelve deterministic cover fixtures (seeds 2001–2012, exact inputs in JSON) run against frozen main and the final M1 source; all finish, no invalid solid-obstacle shots or friendly grenade hits. Failures found and corrected before the final rerun: exposed flank not releasing full shelter; previous shot flash persisting while hidden. The no-hidden-tracking test initially moved the soldier around the barricade and correctly reacquired it; the fixture was corrected to remain concealed instead of weakening LOS.

Paired M1 results (`v027-m1-before.json`, `v027-m1-after.json`): P50 41.5→77.0s, maximum 97.5→102.2s, navigation increments 0.5833→1.0000/match. Full cover 117.8583 and peek exposure 98.1833 soldier-seconds/match. More cover use is not claimed as general AI improvement: passive and exposed time also increase. This is a small feature-validation cohort, not the final 1,000-run audit. Existing exclusive activity accounting is unchanged; intentional full shelter may still count as passive under its conservative contribution rule. The audit's `stuck` counter is a stationary-without-direct-sight heuristic, not proof of a deadlock.

## Remaining milestones

M2 last-known suppression; M3 coordinated support/maneuver; M4 adaptive formation/observation; M5 road crossing; M6 grenade visuals and diagnostics; M7 integrated stabilization. Each requires its own focused tests, same-seed simulations, review and validated commit before advancing. The original 200-case expanded main audit is running independently; large-scale final, legacy hash checks, at least 20 problem-case investigations, full build and mobile checks remain pending. Physical iPhone Safari is unverified.

## Reproduction

`node scripts/audit-v027.mjs ROOT OUTPUT cover 12 2001` runs the small M1 fixtures. `expanded`, `movement`, and `legacy` cohorts use recorded options/positions; the final methodology will distinguish feature fixtures from the archived v0.2.6 cohort. Every run stores its seed/configuration, per-step digest, ten-second decisions and bounded movement-failure samples. The main expanded reference uses the existing v0.2.5 sampler unchanged. Never count timed-out scenarios as completed matches.

## M2 — bounded last-known suppression

`src/suppressive-fire.js` selects only radio snapshots aged 0.2–5s (LMG) / 0.2–2.5s (rifle), confidence >0.45, uncleared, in range and with a real firing lane. No live enemy position is read to choose the destination. LMG/rifle budgets are ten/two shots per observation timestamp, with actual magazine/cooldown/aim delay and friendly-lane clearance. Search/recon/care/maneuver priorities and full cover disallow speculative fire. Actual projectile resolution alone can intersect a live body on that fixed ray; concealed bodies can receive attenuated near-miss pressure through a low firing lane, never through a solid wall. Damage requires a valid physical hit and probability; full-cover concealment prevents direct damage along that protected lane. The inspector records the real task/shot budget and shot events drive the same muzzle/recoil system.

Four new tests plus all six posture and 19 existing cover/mount tests pass. Same twelve cover configurations compare M1 to M2: zero timeouts/invalid shots/friendly grenade hits; mean fourteen remembered-lane shots/match, navigation 1.0000→0.3333, P50 77.0→60.6s and maximum 102.2→98.9s. These small-cohort changes are not a statistical claim. All twelve independent repeat hashes match. The largest adverse case 2002 lengthens 77.9→88.0s: real peeking, suppression, reload and one cover-congestion call, not a wall-firing loop. Cases 2001/2004 also lengthen with real protected fire and pressure; their traces are retained. A unit fixture initially omitted the perception-populated visible-enemy arrays; the fixture was fixed, not the production perception contract. No speculative AI retuning was applied to the adverse seeds.

Raw M2 data: `v027-m2-after.json`; paired pre-M2 source/data: milestone M1 and `v027-m1-after.json`. M3–M7 and final integrated audits remain pending.
