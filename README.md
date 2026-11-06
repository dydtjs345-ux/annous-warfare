# Autonomous Warfare v0.2.7

A mobile-first, single-player autonomous battle spectator built with Phaser 3, JavaScript and Vite. No backend, accounts, external assets or paid services.

The default 54×44 urban battlefield retains v0.2.6 search and separated spawns. v0.2.7 adds real low-cover postures, bounded last-known suppressive fire, conditional support/maneuver, adaptive spacing, directional security and basic dangerous-road reservations. Grenade flight and blasts are more visible. [Tactical AI audit and measured regressions](reports/v027-tactical-ai-audit.md). [v0.2.6 baseline audit](reports/v026-audit.md). Tap the camera button to cycle RU, Map and USMC views; dragging or pinching switches to Free camera. `?map=legacy` retains the original 30×26 battle, and `?map=urban` selects v0.2.5. A URL such as `?seed=2049&layout=0&spawn=0` reproduces an expanded match. These controls change only the spectator view. Expanded buildings are solid obstacles; there is no CQB or enterable-building behavior in that mode.

## Run

Use Node.js 22+ and npm:

```sh
npm install
npm run dev
```

For repeat installations use `npm ci`. Open the address Vite prints. For an iPhone on the same Wi-Fi, open `http://YOUR_COMPUTER_LAN_IP:5173` in Safari (allow the port through your computer firewall). On a hosted cloud machine, use your platform's HTTPS port-forwarding address. A phone's localhost points to the phone, not your computer.

## Play on iPhone

The battle starts automatically. Portrait and landscape are supported. Drag the battlefield to pan; pinch with two fingers to zoom. Tap a soldier to inspect role, AI state, individual ammunition, and all six body-part health values. Blue-gray uniforms mark USMC; cooler slate uniforms distinguish Russian infantry. Gold chevrons mark leaders and white crosses mark medics. Crossed markers indicate eliminated (red) or incapacitated (gold) soldiers. Pause/Resume and 1×, 2×, 4× change simulation time; Restart generates a fresh battle. Desktop supports dragging and mouse-wheel zoom.

Each side has four riflemen (one leader), one light machine gunner and one medic. In expanded mode, leaders choose observation areas from squad exploration memory and assign scouts with supporting followers; confirmed contacts hand off to the existing combat coordinator. Legacy mode retains patrol and last-contact goals. Soldiers path around obstacles, detect enemies within a limited radius and unobstructed sight, remember recent sightings, seek nearby directional cover, shoot and reload. Medics evaluate protected approaches and treat nonfatal casualties, including protected care during enemy contact. Elimination ends when a team has no combat-capable soldiers and all live grenades have resolved, even if incapacitated soldiers are still alive.

## Implemented versus prototype

- Implemented: grid pathfinding, limited AI sight with solid-wall occlusion, short-lived individual contact memory, leader coordination, directional cover (solid wall, low wall, fence), probabilistic weapon hits, six injury locations, arm accuracy penalties, leg speed penalties, incapacitation, fatal head/torso damage, and medic recovery.
- Original procedural placeholder art: the legacy battlefield has four single-story houses, grass yards, streets, perimeter barriers, door openings, simple soldiers, shadows, muzzle flashes and tracers. Roofs disappear when a living active soldier is inside. Interiors are single-floor and unfurnished. Doorways are permanently open; interactive door mechanics are unfinished.
- Injury visuals are basic: hit flash, asymmetric walking/limping and a horizontal crawling/incapacitated pose. Lighting is a dark palette with local muzzle glows, not dynamic shadow casting. Sprites are geometric placeholders, not polished character animation.
- Weapon tuning is deliberately simple: the LMG has a larger magazine and faster fire; rifles, LMGs and medics have ranges of 12, 14 and 10 tiles respectively. No ballistic bullet travel, audio playback, enemy fog-of-war rendering, or advanced formation tactics. Expanded AI can hear a coarse modeled gunfire bearing; this does not play audio or reveal a shooter position. AI has limited knowledge even though the spectator can see both teams.
- Random battles may last a long time or stall after ammunition is exhausted; there is no time-limit victory. Medics currently have unlimited treatment supplies. Balance and performance on physical iPhones need further playtesting.

## Validate

```sh
npm test
npm run build
npm run preview
```

Tests cover squad composition, wall sight occlusion, directional cover, navigable paths, incapacitation victory and a reproducible autonomous battle through victory. Physical iPhone Safari testing is still required: check both orientations, tap inspection, pinch/drag, pause/resume, all speeds, restart and a full battle. A successful build alone does not verify device behavior.

## Deploy

Deployment URL: **https://dydtjs345-ux.github.io/annous-warfare/** (available after the first successful deployment).

GitHub Pages source must be **GitHub Actions** in Settings → Pages (already configured for this repository). Every push to `main` runs `.github/workflows/deploy.yml`: install locked dependencies with `npm ci`, build with `npm run build`, upload `dist/` with the official Pages artifact action, and deploy with the official Pages deployment action. You can also start the workflow manually from Actions. No personal access token or application secrets are needed; the workflow uses `contents: read`, `pages: write`, and `id-token: write` permissions.

Merge the deployment PR into `main`, then watch **Actions → Deploy game to GitHub Pages**. If the `github-pages` environment requires approval, approve that deployment. The workflow's deployment environment links to the published site. Opening a PR does not deploy it.

`vite.config.js` sets `base: '/annous-warfare/'`, so generated JavaScript and CSS URLs include the repository subpath. No extra build flags are needed. To check the production build locally:

```sh
npm install
npm run build
npm run preview
```

Open `http://localhost:4173/annous-warfare/`. For local iPhone testing on the same Wi-Fi, replace `localhost` with your computer's LAN IP and allow port 4173 through its firewall.

### Test the deployed game in iPhone Safari

1. After the Actions run succeeds, open https://dydtjs345-ux.github.io/annous-warfare/ in Safari, including the trailing slash.
2. Confirm the battlefield renders and team counts appear; reload the page to confirm JavaScript and CSS still load from the subpath. If you see an older version, reload in a new private tab.
3. Test portrait and landscape, drag to pan, pinch to zoom, and tap a soldier to inspect it.
4. Exercise Pause/Resume, 1×/2×/4× and Restart, then let a battle run to its outcome.

Physical iPhone Safari validation and the actual hosted deployment must be checked after merging. A local build does not establish that GitHub Actions has deployed successfully. For other static hosts, publish `dist/` and change the Vite base to match the host's URL path.

## Structure

`src/world.js` owns geometry, cover, visibility and pathfinding; `src/simulation.js` owns time-stepped battle rules independent of Phaser; `src/main.js` owns rendering, camera gestures and UI; `src/style.css` owns the mobile layout. Tests live in `test/`.

## AI navigation diagnostics

Tap a soldier to see its AI state, current order, resolved movement target (grid coordinates), and navigation result. `Moving`, `Arrived`, `Waiting for spacing`, `No route`, and `Holding` distinguish movement failures from legitimate reloading, treatment and combat holds. These values use simulation time, so the same navigation rules apply at 1×, 2× and 4×.

Navigation fixes preserve the initial advance orders until the normal eight-second order refresh. Later random or last-contact orders resolve to reachable terrain. Previously, the first update discarded initial orders and could select a wall or fence; empty paths silently left soldiers at spawn. Squads now use nearby distinct formation destinations, and physical movement checks soldiers of either team (including living incapacitated casualties), with periodic local route retries around congestion. This prevents new overlap; it does not add advanced formations or guarantee passage through an occupied choke point. Shooting, treatment, reloading and holding useful cover remain legitimate reasons to stand still.

`npm test` includes 200 seeded startup/order checks, 100 seeded 40-second battle checks for terrain collisions and soldier separation, shared-destination and congestion-replan regressions, and the original combat/medic tests. Physical iPhone Safari retesting remains necessary; these deterministic simulation tests do not emulate device performance.

## v0.2 tactical decision rules

- **Cover:** soldiers compare nearby positions using directional protection against known threats, firing sight lines, weapon range, exposure and distance. Only five promising candidates undergo a route search. Moves must improve the current score by more than 0.65 after route risk; favorable cover is held indefinitely while it remains useful. Assessments occur every 2–2.75 simulated seconds, with up to six seconds of target commitment. Threat movement can invalidate that commitment. Recent lost contacts are held briefly, then searched using existing squad navigation rather than permanent defensive waiting.
- **Suppression:** each incoming hitscan shot applies pressure to its target and enemies within 0.9 tiles of the trace when walls do not occlude them, even if the damage roll misses. Rifles add 0.12 pressure and LMGs 0.20 per shot (reduced by cover); the existing LMG fire rate makes sustained suppression substantially stronger. Pressure is capped at 1, decays by 0.12 per simulated second, and reduces accuracy by up to 65% before the existing minimum hit chance. High pressure favors protection, rejects long exposed reposition routes, and holds soldiers near last contact. Suppression never grants knowledge of unseen enemy positions.
- **Coordination/flanking:** leaders reassess intentions every three seconds. A squad with at least four active soldiers may send **one healthy, lightly suppressed rifleman** sideways when two soldiers are moderately pinned, one is heavily pinned, or twelve seconds pass without successful damage against a recent contact. At least two other armed, unsuppressed-enough soldiers must have firing lines to provide support. Medics, leaders and machine gunners are not flank candidates. A flank requires a reachable protected firing position, lateral separation, a route of at most 18 cells, average exposure at most 0.6, and no exposed run longer than three cells. No acceptable route means no maneuver. Plans expire after fourteen seconds, have a twelve-second retry cooldown, and abort on injury, loss of support, stale/moved threats or unsafe congestion detours.
- **Local autonomy/stability:** covering soldiers continue their normal target selection and fire. At most two soldiers are assigned local cover moves at once, reduced to one during a flank; the initial squad advance and ordinary out-of-contact patrols remain unchanged. Existing collision checks, formation spacing, body injuries, ammunition, treatment and elimination rules remain in use. Medics favor protected positions, avoid flanking, and reject exposed casualty approaches when recent threats are known.

The new logic is in `src/tactics.js`, separate from combat and navigation. Expensive assessments are staggered and bounded, not run for every candidate every frame. No map art, camera controls or layout were changed; only the version text was updated.

**Limits:** these are conservative heuristics, not advanced military doctrine or optimal path planning. Safe flank searches inspect a small set of lateral destinations and validate terrain-shortest paths; they may miss a longer safe alternative. Covering fire targets visible enemies, not speculative unseen positions. Pressure uses a hitscan proximity model rather than physical bullets. Thirty deterministic seed matches are tested to completion; ammunition exhaustion, occupied choke points and very unfavorable geometry can still produce stalemates. There is no forced charge or timeout victory. Physical iPhone Safari performance and tactical behavior need device playtesting after deployment.

## v0.2.1 squad communication and refinement

Every squad has a shared intelligence board available immediately to all living members, including incapacitated casualties. A perception pass gathers **all visible confirmed sightings before any soldier acts**. Enemy positions are copied snapshots, never references that track enemies through walls. Confirmed sightings become last-known positions when nobody can see the enemy: confidence declines over eight simulated seconds, then the report expires. The hotfix marks a visibly empty last-known location as cleared, reduces its confidence, and retains the snapshot until expiration for bounded investigation. Reading/sharing never refreshes a report's age. Expired contacts stop directing pursuit; ordinary patrol orders refresh on the existing eight-second squad cycle.

Incoming fire creates a separate report: the receiver's position and an approximate bearing rounded to 45 degrees. It contains **no shooter ID, position or distance**. Those reports expire after three seconds. Nearby soldiers may use a projected sector for defensive cover evaluation, but it cannot become a confirmed contact, firing target or flank objective. Casualty reports alert the squad and prompt leaders to reassess after 0.45 seconds. Local reactions take 0.2–0.525 seconds; reaction alerts do not keep resetting with every bullet. New visible targets require 0.35 seconds of rifle aiming or 0.55 seconds for an LMG, plus a suppression penalty. Both weapon range and the shooter's own line of sight remain mandatory for damage and suppressive fire.

Information sharing is not a focus-fire order: soldiers keep existing visible targets, contact assignments and valid maneuvers. Uncommitted machine gunners favor visible, confirmed threats aligned with nearby incoming-fire reports. Nearby riflemen can cover casualties, watch a reported sector, or seek better cover within the existing two-soldier movement budget. Reports from distant teammates remain readable without forcing a local reaction. Medics prioritize incapacitated casualties and select a safe approach; no dragging or evacuation is implemented.

Flank attempts now have a 30-second assignment cooldown and at least 24 seconds after cancellation/completion. Approximate directions and low-confidence sightings cannot authorize a flank. Reaching cover starts a six-second position commitment; significant threat movement or heavy suppression can justify breaking it. Safe, advantageous maneuvers remain possible under the v0.2 support, exposure and health checks.

**Medic fixes:** treatment now requires an unobstructed line to a casualty within 1.4 tiles. Interrupted treatment or switching patients resets partial progress. Each uninterrupted treatment second restores eight points to body parts; living incapacitated soldiers recover when the existing head/torso/leg thresholds are met. Treatment stops once all parts reach at least 65; it does not promise full healing. Fatal casualties are excluded. The route safety cache tracks the patient and medic's origin, rather than reusing a decision for a different nearby patient.

**Mobile inspection:** tap a soldier for actual suppression percentage, ammo, AI action, tactical objective, navigation target and body-part health. Asterisks mark injuries; LA/RA mean left/right arm and LL/RL mean left/right leg. The existing panel scrolls within a compact height on small screens. Pinching and dragging no longer count as selection taps.

`npm test` adds deterministic sighting, casualty, incoming-fire, non-omniscience, report expiry, reaction/aiming delay, cooldown and treatment regressions alongside the existing 200-seed startup, 100-seed navigation/collision and 30-seed match-completion checks. The immediate-fire fixture now waits for actual aiming time. The build and mobile browser inspection are checked locally; physical iPhone Safari retesting is still required.

**Known limits:** radio sharing is idealized and instantaneous; there is no communication range, occlusion or radio failure. Reports use simple confidence/time limits and coarse bearings. Suppression is still hitscan-based, and soldiers do not fire blindly at hidden threats. Nearby covering reactions are short holds, not advanced defensive formations. Unlimited medical supplies, possible ammunition/choke-point stalemates and the v0.2 conservative route search remain unchanged. No campaign or persistent death system is added.

## v0.2.1 tactical AI hotfix

This hotfix preserves the map, visuals, combat scale, roles, cover scoring, suppression, medical rules and speed controls. It changes decision transitions and diagnostics, without starting v0.2.2 graphics or additional cover work.

### Confirmed causes and corrections

- **Radio refresh could block decisions indefinitely.** The old three-second observation hold used the last squad observation timestamp. A teammate continuously seeing an enemy kept a non-engaging soldier's memory age at zero. In a deterministic reproduction, a full-health rifleman with 30/180 ammo and zero suppression spent 19.7 of 20 simulated seconds holding without a personal firing solution. Holds now use the soldier's own opportunity/reassessment clock. After brief observation, up to two soldiers may investigate a risk-checked firing lane from the known snapshot; healthy stationary shooters in advantageous cover are preserved.
- **Contact loss could delete useful information immediately.** An empty view of the old location deleted the entire contact on the next tick. Snapshots now retain the enemy ID, last directly observed position/time, observer IDs and observed firing timestamp. Empty-location evidence reduces confidence and prevents treating the old point as occupied. Coordinates update only on new direct observation. TTL defaults to eight simulation seconds and is configurable with `new Battle(Math.random, { contactTTL: 8 })`; incoming-fire bearings remain separate and expire after three seconds.
- **Visibility depended on ray direction near corners.** Quarter-tile sampling produced 13 asymmetric results in 10,000 seeded candidate pairs. Symmetric grid traversal now checks crossed wall cells and both sides of a wall corner. Walls block sight; low walls and fences retain their existing cover behavior.
- **Target and movement rules could conflict.** A visible but out-of-range retained target could exclude a valid in-range target. Eligible targets now take precedence, while independent valid assignments remain stable. Very brief LOS interruptions preserve aiming progress; longer loss requires reacquisition. Failed/congested objectives return an explicit blocker, release cover/search assignments and temporarily reject the ineffective goal. Medic route caching now invalidates on known threat changes and checks terrain accessibility even when there are no known enemies. Regrouping enters beyond seven tiles and exits within four instead of switching goals around one distance threshold.

### Legitimate waiting and bounded search

Suppression, reloading, treatment, reaction/aiming time, protected firing lanes and covering a valid maneuver are legitimate reasons to remain stationary. A freshly updated radio report alone is no longer sufficient justification for an endless hold. Reacquisition uses only a known snapshot and the existing map/path/cover rules: bounded candidate searches, at most two moving investigators, limited route exposure and periodic reassessment. No extra enemy location is supplied when one survivor remains. Tactical destination occupancy uses reported snapshots, not hidden physical enemy positions; actual physical collision checks remain authoritative during movement. Flank cooldowns restrict flank assignments, not ordinary cautious reacquisition.

If no safe reachable position exists, the soldier may continue observing with an explicit reason. A blocked route is not resolved by walking through a wall or another soldier. Ammunition exhaustion and genuinely inaccessible/unsafe geometry can still produce a stalemate; the inspector reports those reasons. There is no arbitrary charge, hidden-enemy tracking, time-limit victory, dragging or evacuation.

### Mobile diagnostics

Tap a soldier and scroll inside the existing compact panel. It shows identity/role, suppression, ammo, actual action and state duration, objective, movement target, contact source, known enemy ID, direct or **last-known estimated** distance, last confirmation age/observer, current direct LOS, firing eligibility/reason, tactical decision reason and movement/stalemate blocker. Hidden enemy positions are never read to populate a distance. Sharing a position does not turn a radio recipient into a direct observer.

The old `(* injured)` text was an unconditional **legend**, not a separate injury calculation. It was misleading when every body part was 100. Healthy soldiers now explicitly show **No injuries**; only actually damaged parts receive an asterisk, with a legend only when injuries exist.

### Regression and device checks

`npm test` includes the existing medic, suppression, flank, collision and complete-battle suites plus radio-only prolonged holds, valid stationary firing lanes, firing/contact-loss provenance, configurable expiry, independent reacquisition, range eligibility, LOS symmetry, failed cover assignments, unreachable terrain, regroup hysteresis, five seeded wall-hidden last-enemy searches, explicit ammunition stalemates and inspection data privacy. Existing seeded checks cover 200 startups, 100 collision/navigation battles, and 30 complete tactical matches.

`npm run build` must pass. Mobile browser checks cover tap selection, scrollable diagnostics, portrait/landscape controls and pinch selection behavior. Physical iPhone Safari still needs repeated full matches at 1×/2×/4×, especially wall-corner contact loss, last-survivor search, scrolling the inspector, and background/resume timing. Conservative searches can miss a longer safe route; the inspector exposes that limitation instead of guaranteeing that every possible battle finishes.

## v0.2.1 Hotfix 2: active coordination

The original passive-loop audit is in [reports/hotfix2-audit.md](reports/hotfix2-audit.md). The paired main/hotfix measurement, definitions, tradeoffs and reproducible commands are in [reports/hotfix2-comparison.md](reports/hotfix2-comparison.md), with complete per-seed JSON. This change does not add graphics, animation, personalities or campaign mechanics.

A lightweight coordinator now assigns actual **recon, overwatch, defensive and care tasks**. It reassesses at 1.5-second intervals and within 0.45 seconds of combat loss. At most one investigator is selected per pass, with a maximum of two for squads of four or more, otherwise one. Direct firing, suppression and treatment may override a command temporarily. Existing flanking remains conditional; its command checks accept the acting commander. Strong, useful firing lanes are preserved.

Recon evaluates reachable cells with bounded, risk-weighted navigation (at most 900 expanded states per candidate, at most three candidate soldiers). It prefers observation lanes and can use useful intermediate approaches when a later observation point is terrain-accessible. Exposure uses existing cover/LOS, snapshot confidence, and a conservative 14–18 tile threat-range falloff; the planner does not read an unseen enemy's role or current position. It checks actual accessibility before ranking destinations, keeps committed orders while movement progresses, gives travel-time-aware deadlines, and records actual candidate rejection reasons. Failed positions are temporarily excluded and other soldiers/positions can be selected. Rejected candidate windows rotate after a short cooldown so three unsuitable riflemen cannot permanently exclude another available investigator. A collision-blocked grid start checks a safe first step rather than repeatedly steering into an incapacitated teammate.

After contact expiry, exact intelligence remains expired. A **coarse four-tile historical sector**, never a hidden live enemy position, may guide observation for up to 20 additional seconds, then ordinary patrol behavior resumes. A wall-centered sector uses a neighboring walkable map anchor. No safe/eligible investigator remains a legitimate hold with an explanation; no guaranteed finish or forced charge is added.

Combat loss is retained as a bounded squad event (last twelve events, including role, own position and previous assignment; no attacker position). Lost tasks are redistributed and survivors receive a real reassessment record. Command succession is temporary: active original leader, otherwise lowest-ID active rifleman, then LMG, then medic. There is no persistent rank system; a recovered original leader resumes command. Medics retain casualty priority and may recon only when other fighters have no ammunition and no care is actionable.

The existing scrolling inspector now adds assignment/commander, decision source, destination, pause/hold/rejection reasons, progress/movement/sighting/engagement ages, objective age, failed movement attempts, coordination wait and recent casualty response. These come from assignments and executed decisions, not decorative statuses. Camera controls, speed buttons and the Pages base/workflow are unchanged.

Validation commands:

```sh
npm test
npm run build
npm run measure:ai -- . reports/hotfix2-after.json 20
```

The full suite contains 56 existing simulation regressions plus 17 coordination regressions (73 total), including actual movement, sustained assignment progress, recon/overwatch, casualty redistribution, command succession, one-versus-one/four-versus-one, expired intelligence, body separation, and an armed medic as the last combat-ready option.

### Physical iPhone Safari retest

After merging and successful Pages deployment, run repeated battles in portrait and landscape at 1×, 2× and 4×. Tap and scroll the inspector to watch a radio-only, out-of-range contact produce a recon assignment and actual movement; confirm other soldiers cover rather than sharing one destination. Watch the objective survive ordinary fresh radio updates. Check blocked approaches, body-adjacent movement, a nearby casualty and leader loss (acting commander/task ownership should update), and late one-/few-survivor searches. Verify strong firing positions may remain stationary while contributing. Test pinch/pan, pause/resume, restart, and background/foreground timing. Chromium viewport checks are not physical Safari performance validation.

Known limits: bounded heuristic search can miss a distant safe route; overwatch is basic, not full fire-and-maneuver doctrine. Frame-level target interruptions increased in the measured sample even though committed abandonment fell. Infinite medical supplies, ammunition exhaustion, genuinely blocked choke points, and conservative danger estimates can still delay or stalemate a match. No casualties are dragged or evacuated.

## v0.2.2 combat animations and activity visualization

This release observes the existing simulation; it does not alter tactical decisions, navigation, weapon statistics, injuries or treatment speed. The parity script compares ten complete fixed-seed matches against main `5008af3d90a6305011e38efe52fdd6a5ce4cb410`, including five-second/final combat-state fingerprints, RNG calls/state, duration and outcome. See [v0.2.2 validation](reports/v022-validation.md).

### Visual key

- Idle/observation uses a stable upright posture; protected observation uses a lower posture, a muted green foot arc, and a short blue observation mark. A small open-ground dot means no evaluated protection against a known lane, not a guarantee about every unseen threat.
- Movement follows **actual displacement**, not a queued path or AI label. Brisk/slow gait, limping and crawling reflect measured travel and existing leg injuries. Gait hysteresis avoids flickering at short grid-end steps. There is no new sprint mechanic. Amber chevrons mark actual movement toward cover, blue chevrons mark recon/repositioning, and green chevrons mark casualty approaches.
- Aiming visibly braces the weapon along its simulation direction. Every muzzle flash, short tracer and recoil begins with a real shot event; an Engaging label alone cannot fire the animation. LMGs retain their real faster cadence and have a longer weapon/ammo pack. Riflemen, original leaders and medics keep their existing faction/role markers.
- Reloading lowers the posture and handles the magazine; the small blue progress line follows the actual reload countdown. Suppression adds a restrained amber pressure ring/ducked posture. Damage creates a brief reaction mark; existing wounds have a muted pip, with leg wounds changing the gait.
- Medics approach casualties, kneel and work while the real treatment timer advances. A small patient pulse marks an actual healing tick; a plus marks completion of the existing basic-care threshold (all parts at least 65), **not** full recovery. Healing remains eight points per treatment tick under the unchanged medical rules.
- Incapacitation/death play a short settling motion and remain prone with gold/red markers. Dead units never aim, recoil, reload or walk. Their faction tint and role markers remain legible. Living incapacitated units may receive actual treatment feedback.

Pinch to zoom in for detailed posture/hand motion; overview zoom prioritizes the original battlefield layout. The procedural art remains simple pixel-style geometry, not high-resolution character art or 3D.

### Cumulative activity in the inspector

Scroll to the bottom of a tapped soldier's existing panel. Seven categories partition active simulation time: **engaging, searching/recon, moving/repositioning, holding cover, treating, reloading, observing/waiting**. Priority is treatment → reload → real engagement/aim → recon movement → other movement → stationary known cover → observing/waiting. Each active fixed-step interval enters exactly one category, even when a soldier fires while moving. Incapacitated/dead time is excluded, counters stop at battle completion, and Restart resets them. Accounting uses the end-of-step authoritative state (normally 0.05-second resolution); displayed tenths may not sum perfectly due to rounding.

A separate non-overlapping split shows **contribution, preparation and passive waiting**. Contribution requires engagement, direct observation, actual treatment, verified overwatch of a progressing investigator or a fresh protected observation lane. Mere travel is preparation until it produces such a contribution; reloading is preparation too. A soldier does not receive contribution credit merely for moving or having an assignment label. Passive waiting is a measured lack of those activities, not a declaration that every tactical hold is defective. These per-soldier counters are not directly interchangeable with the earlier Hotfix 2 aggregate benchmark.

### Separation and performance

`src/presentation-state.js` observes real movement/reload transitions and receives shot, damage and healing events from the existing simulation. `src/combat-visuals.js` owns render-only effect clocks and reusable per-soldier pose models. No animation reads or writes combat outcomes. Events are bounded (96 entries, short simulation-time history), traces are capped, and static obstacle/drawable records and effect models are reused.

Gait and treatment/reload progress use simulation distance/counters. Transient effects scale for 1×/2×/4×, with a short render-only visibility floor so real shots are not lost between fast simulation updates. Pause freezes presentation clocks; result/death effects settle without advancing the simulation. Low frame rates may coalesce multiple real muzzle flashes into one visible flash; they never generate additional shots.

### Validate and test on iPhone

```sh
npm test
npm run build
npm run check:animation-parity -- . reports/v022-after.json reports/v022-baseline.json
```

The full suite has 73 existing AI/navigation/medic regressions and 17 presentation/activity regressions (90 total). The ten-match parity comparison is separate. No new dependencies or backend are required. GitHub Pages build/base configuration is unchanged.

After review/merge and successful Pages deployment, open https://dydtjs345-ux.github.io/annous-warfare/ in iPhone Safari:

1. Test portrait/landscape, drag/pinch, tap selection, inspector scrolling, Pause/Resume and Restart. Pause should freeze poses/effects and counters; Restart should clear old effects and activity totals.
2. Zoom into a fight at 1×, then repeat at 2×/4×. Compare actual ammo decreases to brief flashes/recoil, aiming between shots, rifle/LMG cadence and actual reload countdowns.
3. Watch cover-seeking movement, covered observation and exposed stationary units. A blocked or queued route must not play walking in place. Check injured limping/crawling and restrained suppression/hit feedback.
4. Watch a medic actually treat a casualty: kneeling and work motion should stop on interruption, health pulses should accompany healing, and the completion plus should mean basic care finished. Incapacitated/dead units should not play combat animations.
5. Scroll through activity totals. Movement without observation should be preparation rather than automatically useful contribution; all seven primary categories should partition active time. Try background/foreground and long matches for performance and stale effects.

Known limits: these are procedural placeholder poses, not a full anatomical sprite set. Range, damage, healing, suppression and AI remain the same. Some cues are subtle at overview zoom. Desktop Chromium mobile emulation and bounded-memory tests do not prove physical iPhone Safari frame rate, battery use or behavior after OS suspension; those require device testing.


## v0.2.3: cover intelligence and supported LMG fire

This version retains the existing squad coordinator, contact snapshots, navigation,
injuries, treatment and spectator controls. The pre-change source audit is in
[reports/v023-audit.md](reports/v023-audit.md). Results, limitations and the complete
changed-file inventory are in [reports/v023-validation.md](reports/v023-validation.md).

Cover assessment now occurs at first direct contact, a significant change in the
most exposed known threat bearing, and periodically thereafter. Local defense is
checked before squad maneuvers and coordination waits; reloading soldiers can also
make a defensive move without changing the reload timer. Positions are evaluated
against known threat directions and actual static LOS, not proximity to a wall.

A nearby candidate must gain at least 0.27 directional protection and exceed the
existing score hysteresis by 0.65 after route cost. A currently effective shooter
normally keeps an in-range firing lane; heavy pressure can justify breaking LOS.
The search remains bounded (radius three cells, ten candidate paths, at most eight
path steps). Occupied, reserved and recently failed goals are rejected. Protected
positions retain a five-second commitment, while an exposed position or changed
threat bearing can be reassessed. Valid shots still occur before defensive movement;
soldiers without better cover keep fighting.

Cover moves, recon assignments and a live flank share the existing two-person
movement budget. This is a limit on new routine relocations, not a fixed formation
or guarantee of two shooters. Severe exposed pressure can override it, and a final
arrival leg can release its slot within the same fixed step. Medics retain treatment
priority. Routine shared-contact cover evaluation does not replace active recon;
urgent self-preservation can. Current contact confidence and observed-empty positions
still constrain defensive use of radio intelligence.

Only **explicitly tagged low walls** can support an LMG. Fences and solid house walls
are excluded because there is no general obstacle-height model. The gunner must
already occupy a walkable position 0.55–1.35 tiles behind an aligned low wall, with
a directly observed, in-range enemy and clear LOS. No new obstacle geometry or
firing-through-walls exception is introduced. Cover movement may naturally bring a
gunner to such a position; there is no separate mount-hunting behavior.

The constants in `src/mounting.js` control 0.8-second deployment, 0.35-second
unmounting, a three-second remount cooldown, a maximum ±45° firing arc (geometry
can constrain it further), ×1.12 accuracy and ×1.15 incoming suppression pressure.
Deployment/unmounting prevents firing; repositioning waits for unmounting. Reload
and weapon cadence are unchanged. Lost/blocked lanes, incompatible directions,
exposed directly observed flank threats and severe suppression release support.
A gunner with no suitable support continues unsupported combat. Incapacitation or
death cancels support immediately without a combat or unmount animation.

The existing procedural renderer consumes authoritative mount states and real shot
events. A gold bipod and crouch distinguish supported firing; deployment/unmounting
have short progress cues, and mounted recoil is smaller. Existing cover approach
chevrons and protected-position arcs remain. The scrollable inspector adds current
known-threat protection, exposure and score; the last evaluated candidate, reason,
assessment age and movement blocker; and LMG state, own support position/direction,
bonuses and rejection reason. Candidate/reason snapshots are recorded decisions,
not explanations inferred by the UI. The seven activity categories remain exclusive;
deploy/unmount time is preparation, with real shots retaining engagement priority.

### Validate and compare

```sh
npm install
npm test
npm run build
# Archive the baseline before changing branches. Source imports have no npm needs.
mkdir -p /tmp/aw-main
# Use a fresh directory if /tmp/aw-main already contains another revision.
git archive 17e6e02 | tar -x -C /tmp/aw-main
node scripts/measure-cover.mjs /tmp/aw-main /tmp/main-cover.json 20
node scripts/measure-cover.mjs . /tmp/after-cover.json 20
```

The comparison uses the same seeds 1–20, timestep 0.1 seconds, and 1,800-second
cap on both versions. Raw results are committed. The historical v0.2.2 exact-core
animation-parity script is not a v0.2.3 balance requirement: cover and mounted fire
intentionally change outcomes. Rendering remains read-only, and playback grouping
is tested independently at 1×, 2× and 4×.

### Physical iPhone Safari checks

After review/merge and successful Pages deployment, open
https://dydtjs345-ux.github.io/annous-warfare/ in Safari and reload to obtain v0.2.3.
For pre-merge testing use `npm run dev -- --host 0.0.0.0` with your computer's LAN
address or your environment's HTTPS port forwarding, as described above. A feature
branch push does not deploy production Pages.

1. Watch several initial 6v6 encounters at 1×. Some soldiers should seek improved
   directional cover while others keep firing. Exposed soldiers without useful
   cover should continue fighting; protected firing positions should remain stable.
2. Tap an LMG (machine-gunner role marker), scroll the inspector, and compare its
   real unsupported/deploying/mounted/unmounting state with the bipod and progress
   cues. Low walls qualify only from the correct side and angle. House walls and
   fences must not create supported fire.
3. Observe an LMG changing firing direction or repositioning: support should release
   briefly before travel. No flashes should appear while deploying/unmounting or
   after combat incapacity. Reload timing and casualty treatment should remain normal.
4. Switch through 1×, 2× and 4×, pause/resume, pan, pinch and tap. Check inspector
   scrolling in portrait and landscape, matching action/cover/mount data, and exclusive
   activity totals. Tiny effects may coalesce at 4×; visibility does not control shots.
5. Follow late-game searches and a medic casualty approach, then restart to confirm
   six soldiers per team and reset activity counters. Report device/iOS version,
   speed, diagnostics and any prolonged idle or oscillating cover behavior.

Host Chromium checks do not establish physical Safari performance, battery use,
thermal behavior or touch reliability. Those remain device-verification steps.


## v0.2.3.1 stability audit and rough humanoids

Based on merged v0.2.3 (`27166d9`). Completed 200 recorded baseline cases, 200 paired
post-fix cases, ten independent worst-case replays, and 200 rendering-enabled parity
cases. See [the full audit](reports/v0231-audit.md) for inputs, raw datasets, paired
regressions, limitations and the physical Safari checklist.

Movement now preserves actual firing/aiming direction. If every living squad member
has lacked useful progress for more than 12 seconds and no fit investigator remains,
a mobile injured survivor or fit medic may receive an existing safe observation task.
Medical care, severe injury, suppression, ammo and reaction restrictions remain.
This is a bounded fallback, not a squad-wide charge. The 200-case comparison shows
modest duration/passive improvements, zero observed shot-facing inconsistencies, and
small regressions in some contribution/casualty measures; cover churn remains possible.

Soldiers now have original procedural head/helmet, vest, arm/hand, leg and boot shapes
with cool faction colors. Existing animation/mount states remain authoritative.
No map, collision, combat calculation or RNG changes occur in the visual pass; all
200 post-fix simulation digests match with rendering exercised at 1×/2×/4×.

Run `npm test` (113 tests), `npm run build`, or `npm run audit:stability -- . /tmp/audit.json 200`.
Open the existing Pages URL after review/merge and successful deployment; confirm the
v0.2.3.1 header. Physical Safari performance is unverified: test zoomed gun direction,
medical/mount animation synchronization, late injured survivors, touch/scrolling,
both orientations and all speeds. Detailed steps and reproduction commands are in
the audit report. Feature branches do not deploy production Pages automatically.


## v0.2.4 cover and medic stabilization

Based on merged v0.2.3.1 (`6f152cb`). Completed 300 recorded baseline and 300 final
paired cases, with 15 independently replayed stress cases and an additional revised
300-case trial. [Full audit and limitations](reports/v024-audit.md) includes exact
seeds/configurations, per-soldier/per-role data, before/after tables and adverse cases.

Cover journeys retain useful destinations instead of re-entering the movement budget
or switching for marginal alternatives. Unsafe destinations can still be replaced.
A receiving patient can briefly pause travel while actual nearby treatment proceeds,
retain the squad assignment, and continue valid fire; exposed danger interrupts the
hold. Medics keep active safe care stable, reassess distant approaches, and request
leader reassignment from recon. Protected treatment under confirmed contact uses
existing LOS/reach/route checks; no damage immunity or faster healing exists.

Measured gains are fewer cycle flags, fewer interrupted treatments and more completed
care. Tail duration, passive share and navigation failures worsen; contact and exposure
results are mixed. This is not a claim of uniformly improved tactics. Procedural
humanoid visuals and combat formulas remain unchanged.

`npm test` runs 123 tests; `npm run audit:cover-medic -- . /tmp/audit.json 300` repeats
the final cases. Detailed replay and comparison commands are in the report. The existing
Pages URL deploys after review/merge and successful Actions completion. Physical Safari
checks should cover medical holds/return to assignments, urgent cover moves, unsafe
rescue refusal, late-game waits, all speeds, gestures and both screen orientations.


### v0.2.4 navigation and duration follow-up

Continues the existing v0.2.4 branch; [three-way audit](reports/v024-followup-audit.md)
compares original v0.2.3.1, previous v0.2.4 and the corrected implementation on the
same 300 cases. All final cases finish; seven new regressions bring `npm test` to
130 tests. Treatment pauses no longer fail a valid recon route, failed casualty
approaches retain contextual retry history, and sub-tile oscillation triggers normal
route recovery. Stale non-urgent personal cover cannot replace an active recon order
after visual contact is lost. Completed patients resume useful activity immediately.

P95 duration improves 129.5→115.4s and raw navigation failures 2.43→2.23/match; cover
cycle and medic survival gains remain. Care completions fall .86→.77 per medic, still
above original .58: medical improvement is only partly preserved. New adverse seeds
and a rejected intermediate timeout are documented. No forced aggression, artificial
match cap, new balance rule or graphical change was added. Build and mobile Chromium
checks pass; physical Safari checks remain necessary.


## v0.2.5 urban cover and fragmentation grenades

The live battlefield now has long horizontal sandbag and concrete lines, short vertical/stepped lines, abandoned vehicles and crate stacks. All are functional terrain. Low barricades block movement, protect directionally and support LMG mounting while permitting firing over them; vehicles/crates block sight and bullets. Existing cover reservations, collision spacing, leadership and treatment remain.

Leaders/riflemen carry one frag each. A stationary soldier may prepare a throw only against its own confirmed visible cluster or an ineffective attack on defended cover, within 4.2–7 tiles, after conservative friendly-route checks. Recon and existing cover moves are preserved. One preparation per squad plus an eight-second cooldown prevents spam. The 0.7s preparation and 0.65s flight are visible; the 2.1s fuse runs from release. Damage falls with distance and obstruction, affects both teams, and uses existing body injuries. Grounded grenades must be seen before delayed emergency evasion; survival is not guaranteed. Squad assignments survive the emergency.

Inspector shows actual frag inventory/preparation/evasion; seven exclusive activity counters are preserved. Original humanoids and mounted-weapon animations remain. There are no external art dependencies, new controls or changes to rifle/LMG balance.

[Full audit, exact seeds, adverse cases and limitations](reports/v025-audit.md): 200 legacy + 200 urban baseline runs and the same 400 after corrections. One initial timeout was resolved; all updated battles finished. A final medical cache transition correction was verified with an additional 400 paired reruns. Legacy simulation hashes match in all 200 pairs. Urban grenade spam and reaction defects were fixed, but exposure, navigation failures and several late fights worsen; this is not a claim of uniform AI improvement. See the report for paired metrics and replayable source patch.

`npm test` now runs **149 tests**; `npm run build` preserves Pages deployment at https://dydtjs345-ux.github.io/annous-warfare/. Run `node scripts/audit-v025.mjs . /tmp/urban.json 200 trace '' urban` for the exact urban cohort. New modules: `grenades.js` owns authoritative ordnance/decisions and `urban-visuals.js` draws cover/projectiles/blasts; rendering never applies damage or RNG.

Physical iPhone Safari testing remains necessary: both orientations, inspector scrolling, pan/pinch, firing over low lines, routes around high obstacles, LMG mounting, actual grenade release/fuse/evasion, medic care, pause/resume/restart and 1×/2×/4×. Grenades are conditional and may not appear in every ordinary match. Prototype limits include coarse radial fragmentation, no wall lobs/bounces/destruction, conservative friendly safety, casualty congestion and existing unlimited medicine; long fights or ammunition stalemates remain possible outside the recorded cases.


### v0.2.5 focused navigation follow-up

[Paired 200-case regression investigation](reports/v025-followup-audit.md) continues the existing v0.2.5 branch. A medic's selected patient no longer blocks the endpoint of every urban congestion replan; actual collision, sight, treatment reach and healing remain unchanged. All 200 legacy hashes are preserved. Broader cover-policy experiments were rejected after adverse full-cohort results, so map geometry, cover scoring/timers and LMG mounting retain their previous behavior.

Navigation failures improve 1.685→0.750/match and both paired urban cohorts have zero timeouts. P95 worsens 103.1→119.9s, exposure share is nearly unchanged but slightly worse (45.042710→45.142391%), and medical/cycle results remain mixed. This is a confirmed routing fix, not complete tactical-stability clearance. Raw data, rejected trials, 31 paired diagnostic cases and remaining adverse seeds are retained. `npm test` now runs 154 tests; build and mobile Chromium checks pass. Physical iPhone Safari verification remains required, especially crowded medical approaches and late survivor fights.


## v0.2.6 expanded urban search and destroy

The default battlefield is **54×44 tiles**, versus 30×26 in the preserved legacy mode. Four deterministic layouts contain twelve sealed building blocks, intersections, alleys, open lanes and the existing sandbag/concrete, vehicle and crate obstacles. Three separated spawn configurations keep enemy locations unknown at the start. These are solid buildings without interiors or window/CQB behavior.

The acting commander assigns up to two search soldiers and distinct supporting follower positions. A lightweight memory records only landmarks actually visible to living squad members. Search goals prefer unseen or stale areas, retain progressing routes, and temporarily exclude failed objectives. Supporting soldiers refresh obsolete observation points and follow the replacement search leader after succession. The existing combat coordinator takes over on legitimate contact; medics, suppression, immediate survival and direct fire retain priority.

The inspector and footer show **SEARCH → CONTACT / ENGAGE → LOST_CONTACT → REACQUIRE → SEARCH_AGAIN** as appropriate. Direct observations update shared enemy snapshots; unseen positions freeze and expire. A bounded historical sector and coarse gunfire bearings can guide investigation, then systematic search resumes. Hearing reports contain the listener's position and approximate direction, never shooter coordinates, identity or exact range. Exploration memory is a sample of visible landmarks, not a guarantee that whole districts are cleared.

Camera controls are spectator-only: **USMC / RU** follow the acting commander or survivor; **Map** fits the entire field; dragging or pinching selects **Free** view. Initial squad zoom keeps soldiers readable. Tap and scroll the inspector for search phase, observed landmarks, current/last search area, actual assignments, blockers and activity counters. `?debug=1` optionally exposes a read-only spectator snapshot for browser automation; the AI never consumes it.

Useful URLs (append to the Pages URL or local development address):

- `?seed=2049&layout=0&spawn=0`: reproducible expanded match; layouts 0–3, spawns 0–2.
- `?map=legacy&seed=22`: original map, no grenades, preserved legacy simulation.
- `?map=urban&seed=1104`: the v0.2.5 map with its existing cover/grenade systems.

**Validation:** 178 tests, successful production build, 200 legacy + 200 initial expanded + 200 paired corrected expanded matches, zero audit timeouts, and all 200 legacy hashes preserved. Complete-match render parity and mobile Chromium checks also pass. Results are mixed: useful cover and mounted LMG fire increase, but expanded P95 duration rises **177.3→193.8s**, maximum **273.9→349.1s**, passive share and some medic metrics worsen. This is not a claim of universal tactical improvement. Exact configurations, paired data, extreme-case diagnoses and reproduction commands are in [the audit](reports/v026-audit.md).

Physical iPhone Safari remains unverified. Test both orientations at 1×/2×/4×; cycle USMC/RU/Map, select soldiers at distant edges, drag/pinch then return to focus, and scroll the inspector. Observe a full separated start, contact, expired contact and renewed search, including injured survivors and medic care. Check pause/resume, restart, background/foreground, frame responsiveness and battery/thermal behavior. Long legitimate searches and ammunition-exhaustion stalemates remain possible; no timer reveals enemies or awards a forced victory.


## v0.2.7 tactical infantry AI

The new tactical layer is enabled in the default expanded game. `?map=legacy` and `?map=urban` deliberately preserve their old behavior; focused simulation fixtures can enable the layer explicitly with `{ tactical: true }`. No player orders, new maps/weapons, external assets, ML or medical redesign are added.

- **Full cover / peek / sustained position:** a genuinely aligned low obstacle can hide a low soldier from an opposing ray. Full cover prevents firing; a brief peek or longer supporting exposure uses the real weapon timing and ammunition. Protection and concealment stop at a nearby observer, so a barricade behind someone cannot protect them. Flanks remain dangerous. Reload/treatment rendering stays tucked when the authoritative body is concealed. This is a coarse height model for low cover; it does not add leaning around solid wall corners.
- **Remembered-lane suppression:** reliable, uncleared, recent snapshots may justify a short ammunition-paid burst. LMGs have a larger finite budget than rifles. The shooter aims at the snapshot, never the unseen enemy's current location; actual geometry decides near misses or a possible hit. Stale intelligence, solid walls, friendly bodies, weapon handling and assigned movement stop speculative fire. Medics prioritize care.
- **Fire and movement:** existing conditional flank planning now has explicit support/maneuver duties. Movement waits briefly for actual supporting shots, allows bounded recovery from a late fire gap, and cancels if support/risk/physical capability fails. The overall deadline remains bounded. Flanking is optional, and many real attempts abort.
- **Movement/security:** loose-column, staggered, dispersed and compact-regroup follower offsets use existing reachable distinct destinations. Scouts continue searching without rigid formation waits. Travel heading and observation differ; directional, LOS-limited scans cover forward/side/rear approaches. Exploration memory uses the same observation rule.
- **Crossings:** a protected entry under a known/uncertain threat can reserve a small crossing element on its existing route. Exposed entries, grenade evasion and urgent danger bypass waiting. Reservations expire and preserve the original assignment. This is not a full street-assault planner; natural waiting was rare in the audit.
- **Grenades:** throw-origin cue, flight trail/object, short detonation flash, dust/smoke, small debris and residue use actual events. Footer `G thrown/detonated` counts real events. Simulation damage, radius, inventory, throw selection and fuse are unchanged; friendly fire remains possible.

Tap/scroll a soldier for actual posture, support/maneuver duty and destination, remembered-fire task/budget/rejection, formation/scan/travel headings, crossing decision age and existing health/ammo/AI/activity data. A maintained `sustained` posture is weapon-ready permission, not proof that a shot is being fired. Only real shot events trigger muzzle flashes.

The audit preserves all iterations and their negative results. Navigation and long-duration tails improve in the expanded cohort, while median duration, exposure/passive share, medic completion/response and mounted-LMG contribution include regressions. Passing tests and zero recorded timeouts do not establish universally better tactics. See [the full report](reports/v027-tactical-ai-audit.md) for exact figures, seeds, diagnosed cases, reproduction, known limits and physical iPhone checks. Existing conservative exclusive activity counters are preserved; intentional shelter may count as passive when no firing/observation/support is verified.

Physical iPhone Safari is **not verified**. On this branch locally or after a reviewed merge/Pages deploy: test both orientations, distant taps, scroll, pan/pinch/focus, pause/restart, background/resume and 1×/2×/4×. Watch full cover release to actual firing, a flank attack on a sheltered unit, snapshot expiry, medic approaches and late survivor search. Check grenade visibility while zoomed to squad view, including at 4×. The optional local-only `/annous-warfare/test/fixtures/grenade-visual.html` under `npm run dev -- --port 4210` isolates real grenade rendering with a protected target cluster and nonfiring opponents; it is not a natural 6v6 battle or part of the deployed build.

Final v0.2.7 validation: **216 passing tests**, successful build, **3,000 large-cohort complete runs** plus recorded milestone/replay checks, zero recorded timeouts, and 200 final legacy hashes preserved. [The verifier manifest](reports/v027-validation.json) inventories 3,343 recorded complete executions. Native mobile Chromium controls and real grenade-render fixtures pass; physical iPhone Safari remains unverified.
