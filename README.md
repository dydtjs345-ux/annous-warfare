# Autonomous Warfare v0.2

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
