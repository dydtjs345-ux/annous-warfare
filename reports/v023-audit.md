# v0.2.3 audit before implementation

Base: `17e6e02` (latest fetched main, v0.2.2 merge). Existing architecture retained.

Confirmed in source before changes:

- `Battle.step()` fires first, then calls `followManeuver()` before `localCover()`. An active maneuver can therefore bypass cover assessment. Outside direct firing range, `followAssignment()` and the recent-contact coordination wait precede any local cover call. An exposed soldier awaiting coordination has no local cover opportunity in that branch.
- `localCover()` exits during radio reaction delay. Its position commitment can reject a new destination even with no useful current protection. Assessment occurs every 2–2.75 seconds and threat change is measured by two tiles of enemy displacement, rather than a change in attack bearing.
- Existing `cover()` and `positionScore()` are already directional and use static LOS. There is no basis for replacing LOS or navigation. However, solid-wall occlusion receives 0.85 protection, so a blind destination can outrank a viable firing lane. Candidate hysteresis is score-only and can chase marginal geometric gains.
- Cover movement counts other cover targets and a maneuver, but does not count recon assignments against the same movement budget. Navigation already rejects unreachable/congested destinations and records failed goals; those mechanisms should remain intact.
- No obstacle-height model or weapon support system exists. Map tags distinguish `low wall`, `fence`, and solid `wall`. Low-wall-only eligibility is the conservative rule; a nearby solid wall alone must never authorize mounting.

These are source-level causes/opportunities, not a claim that every stationary soldier was defective. Existing protected firing lanes and valid overwatch must remain useful stationary states.
