# Autonomous Warfare v0.2.1

A mobile-first, single-player autonomous battle spectator built with Phaser 3, JavaScript and Vite. No backend, accounts, external assets or paid services.

## Run

Use Node.js 22+ and npm:

```sh
npm install
npm run dev
```

For repeat installations use `npm ci`. Open the address Vite prints. For an iPhone on the same Wi-Fi, open `http://YOUR_COMPUTER_LAN_IP:5173` in Safari (allow the port through your computer firewall). On a hosted cloud machine, use your platform's HTTPS port-forwarding address. A phone's localhost points to the phone, not your computer.

## Play on iPhone

The battle starts automatically. Portrait and landscape are supported. Drag the battlefield to pan; pinch with two fingers to zoom. Tap a soldier to inspect role, AI state, individual ammunition, and all six body-part health values. Mint soldiers are USMC; salmon soldiers are Russian infantry. Gold chevrons mark leaders and white crosses mark medics. Crossed markers indicate eliminated (red) or incapacitated (gold) soldiers. Pause/Resume and 1×, 2×, 4× change simulation time; Restart generates a fresh battle. Desktop supports dragging and mouse-wheel zoom.

Each side has four riflemen (one leader), one light machine gunner and one medic. Leaders choose patrol or last-contact goals; separated soldiers regroup. Soldiers path around obstacles, detect enemies within a limited radius and unobstructed sight, remember recent sightings, seek nearby directional cover, shoot and reload. Medics approach and heal nonfatal casualties when no enemy is visible to them. Elimination ends when a team has no combat-capable soldiers, even if incapacitated soldiers are still alive.

## Implemented versus prototype

- Implemented: grid pathfinding, limited AI sight with solid-wall occlusion, short-lived individual contact memory, leader coordination, directional cover (solid wall, low wall, fence), probabilistic weapon hits, six injury locations, arm accuracy penalties, leg speed penalties, incapacitation, fatal head/torso damage, and medic recovery.
- Original procedural placeholder art: four single-story houses, grass yards, streets, perimeter barriers, door openings, simple soldiers, shadows, muzzle flashes and tracers. Roofs disappear when a living active soldier is inside. Interiors are single-floor and unfurnished. Doorways are permanently open; interactive door mechanics are unfinished.
- Injury visuals are basic: hit flash, asymmetric walking/limping and a horizontal crawling/incapacitated pose. Lighting is a dark palette with local muzzle glows, not dynamic shadow casting. Sprites are geometric placeholders, not polished character animation.
- Weapon tuning is deliberately simple: the LMG has a larger magazine and faster fire; rifles, LMGs and medics have ranges of 12, 14 and 10 tiles respectively. No ballistic projectiles or sound, enemy fog-of-war rendering, advanced formation tactics. AI has limited knowledge even though the spectator can see both teams.
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
