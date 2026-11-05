# Autonomous Warfare v0.1

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
- Weapon tuning is deliberately simple: the LMG has a larger magazine and faster fire; rifles, LMGs and medics have ranges of 12, 14 and 10 tiles respectively. No ballistic projectiles, suppression, sound, enemy fog-of-war rendering, collision avoidance between soldiers, or advanced formation tactics. AI has limited knowledge even though the spectator can see both teams.
- Random battles may last a long time or stall after ammunition is exhausted; there is no time-limit victory. Medics currently have unlimited treatment supplies. Balance and performance on physical iPhones need further playtesting.

## Validate

```sh
npm test
npm run build
npm run preview
```

Tests cover squad composition, wall sight occlusion, directional cover, navigable paths, incapacitation victory and a reproducible autonomous battle through victory. Physical iPhone Safari testing is still required: check both orientations, tap inspection, pinch/drag, pause/resume, all speeds, restart and a full battle. A successful build alone does not verify device behavior.

## Deploy

Deploy the generated `dist/` directory to any static HTTPS host. Build command: `npm ci && npm run build`; output directory: `dist`. For GitHub Pages under `/annous-warfare/`, build with `npm run build -- --base=/annous-warfare/`, then publish `dist` using Pages/Actions. No environment variables or secrets are required by the application. Publishing is a separate action from opening the review PR.

## Structure

`src/world.js` owns geometry, cover, visibility and pathfinding; `src/simulation.js` owns time-stepped battle rules independent of Phaser; `src/main.js` owns rendering, camera gestures and UI; `src/style.css` owns the mobile layout. Tests live in `test/`.
