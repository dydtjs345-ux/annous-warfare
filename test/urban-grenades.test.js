import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import {
  configureWorld,
  obstacles,
  key,
  blocked,
  sight,
  cover,
  path,
  blastTransmission,
  material,
} from "../src/world.js";
import {
  FRAG,
  grenadeAction,
  grenadeOpportunity,
  friendlyRisk,
  updateGrenades,
  detonate,
} from "../src/grenades.js";
import { mountSite } from "../src/mounting.js";
import { careRouteSafe } from "../src/tactics.js";
import { CombatVisuals } from "../src/combat-visuals.js";
import { refreshDiagnostics } from "../src/diagnostics.js";
import { drawGrenades, drawObstacle } from "../src/urban-visuals.js";
afterEach(() => configureWorld("legacy"));
function battle() {
  const b = new Battle(() => 0.99, { map: "urban", grenades: true });
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  for (const id of [0, 6])
    Object.assign(b.units[id], {
      active: true,
      dead: false,
      x: 13 + id / 3,
      y: 13,
      reload: 1000,
    });
  return b;
}
function frag(b, target = { x: 15, y: 13 }) {
  const g = {
    id: ++b.grenadeSerial,
    team: 0,
    throwerId: 0,
    start: { x: 13, y: 13 },
    target,
    position: { x: 13, y: 13 },
    thrownAt: b.time,
    detonateAt: b.time + FRAG.fuse,
  };
  b.grenades.push(g);
  return g;
}
test("three urban arrangements keep every walkable cell reachable", () => {
  for (let v = 0; v < 3; v++) {
    configureWorld("urban", v);
    let free = 0;
    for (let y = 1; y < 25; y++)
      for (let x = 1; x < 29; x++) if (!blocked(x, y)) free++;
    const q = [[2, 8]],
      seen = new Set(["2,8"]);
    for (let i = 0; i < q.length; i++)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const [x, y] = q[i],
          k = key(x + dx, y + dy);
        if (!blocked(x + dx, y + dy) && !seen.has(k)) {
          seen.add(k);
          q.push([x + dx, y + dy]);
        }
      }
    assert.equal(seen.size, free);
  }
});
test("horizontal and vertical low lines protect directionally but permit bullets over them", () => {
  configureWorld("urban");
  assert.equal(obstacles.get(key(5, 12)), "sandbag");
  assert.equal(obstacles.get(key(5, 14)), "concrete");
  assert.ok(cover({ x: 5, y: 11 }, { x: 5, y: 15 }) > 0.6);
  assert.equal(cover({ x: 5, y: 11 }, { x: 5, y: 1 }), 0);
  assert.ok(sight({ x: 11, y: 6 }, { x: 14, y: 6 }));
  assert.ok(cover({ x: 11, y: 6 }, { x: 14, y: 6 }) > 0.6);
});
test("vehicles and crate stacks block movement and bullet sight; materials have distinct protection", () => {
  configureWorld("urban");
  assert.ok(blocked(15, 5));
  assert.equal(sight({ x: 14, y: 5 }, { x: 16, y: 5 }), false);
  assert.equal(sight({ x: 3, y: 5 }, { x: 3, y: 7 }), false);
  assert.notEqual(
    material("sandbag").protection,
    material("concrete").protection,
  );
});
test("long barricades retain detours and multiple distinct usable firing positions", () => {
  const b = battle();
  assert.ok(path({ x: 11, y: 6 }, { x: 14, y: 6 }).length > 3);
  for (const [id, x] of [
    [0, 4],
    [1, 8],
    [2, 11],
  ]) {
    const u = b.units[id];
    Object.assign(u, { x, y: 11, active: true, dead: false });
    assert.ok(cover(u, { x: 6, y: 15 }) >= 0.6);
    assert.ok(sight(u, { x: 6, y: 15 }));
  }
  assert.ok(b.spaceFree(b.units[0], { x: 4, y: 11 }));
});
test("LMG may mount aligned low barricades but not vehicles or crates", () => {
  const b = battle(),
    u = b.units[4],
    e = b.units[6];
  Object.assign(u, { active: true, dead: false, x: 4, y: 11 });
  Object.assign(e, { x: 4, y: 15 });
  assert.ok(mountSite(u, e).position);
  Object.assign(u, { x: 14, y: 5 });
  Object.assign(e, { x: 16, y: 5 });
  assert.equal(mountSite(u, e).position, undefined);
});
test("frag fuse delays damage, then causes distance-scaled friendly fire and body injuries", () => {
  const b = battle(),
    g = frag(b);
  b.move = () => true;
  Object.assign(b.units[6], g.target);
  for (let i = 0; i < 20; i++) b.step(0.1);
  assert.equal(b.units[6].health.torso, 100);
  for (let i = 0; i < 3; i++) b.step(0.1);
  assert.ok(g.detonatedAt);
  assert.ok(b.units[6].health.torso < b.units[0].health.torso);
  assert.ok(b.units[0].health.torso < 100);
  assert.ok(b.units[0].suppression > 0);
  assert.ok(b.grenadeStats.friendlyHits > 0);
});
test("solid walls stop direct fragmentation, low barriers attenuate it with the shared ray geometry", () => {
  configureWorld("urban");
  assert.equal(blastTransmission({ x: 4, y: 6 }, { x: 7, y: 6 }), 0);
  assert.ok(blastTransmission({ x: 5, y: 11 }, { x: 5, y: 13 }) < 0.5);
  assert.equal(blastTransmission({ x: 14, y: 10 }, { x: 14, y: 11 }), 1);
});
test("friendly risk includes the swept route beyond the first waypoint", () => {
  const b = battle(),
    u = b.units[0],
    a = b.units[1];
  Object.assign(u, { x: 6, y: 10, reload: 0 });
  Object.assign(a, {
    active: true,
    dead: false,
    x: 12,
    y: 15,
    route: [
      [11, 15],
      [10, 15],
      [9, 15],
    ],
    assignment: { type: "recon" },
  });
  a.presentation.moving = true;
  assert.equal(friendlyRisk(b, u, { x: 6, y: 15 }), true);
});
test("grenades require confirmed own sight and a justified opportunity; medics do not throw", () => {
  const b = battle(),
    u = b.units[0],
    e = b.units[6];
  Object.assign(u, { x: 6, y: 10, reload: 0, visibleEnemies: [] });
  Object.assign(e, { x: 6, y: 15 });
  assert.equal(grenadeOpportunity(b, u), null);
  u.visibleEnemies = [e];
  b.squads[0].lastProgress = 0;
  b.time = 10;
  assert.ok(grenadeOpportunity(b, u));
  u.assignment = { type: "recon" };
  assert.equal(grenadeOpportunity(b, u), null);
  assert.equal(b.units[5].frags, 0);
});
test("one preparing squad member reserves the opportunity, preventing simultaneous grenade spam", () => {
  const b = battle(),
    u = b.units[0],
    a = b.units[1],
    e = b.units[6];
  Object.assign(u, { x: 6, y: 10, reload: 0, visibleEnemies: [e] });
  Object.assign(e, { x: 6, y: 15 });
  Object.assign(a, {
    active: true,
    dead: false,
    x: 9,
    y: 9,
    reload: 0,
    visibleEnemies: [e],
  });
  b.time = 10;
  b.squads[0].lastProgress = 0;
  assert.equal(grenadeAction(b, u, 0.1), true);
  assert.equal(grenadeOpportunity(b, a), null);
});
test("real release consumes one grenade after preparation and exposes a throw pose without a rifle flash", () => {
  const b = battle(),
    u = b.units[0],
    e = b.units[6];
  Object.assign(u, { x: 6, y: 10, reload: 0, visibleEnemies: [e] });
  Object.assign(e, { x: 6, y: 15 });
  b.time = 10;
  b.squads[0].lastProgress = 0;
  grenadeAction(b, u, 0.1);
  assert.equal(u.frags, 1);
  b.time += FRAG.prepare - 0.01;
  grenadeAction(b, u, 0.1);
  assert.equal(b.grenades.length, 0);
  b.time += 0.02;
  grenadeAction(b, u, 0.1);
  assert.equal(u.frags, 0);
  assert.equal(b.grenades.length, 1);
  assert.equal(b.events.filter((e) => e.type === "grenadeThrow").length, 1);
  const v = new CombatVisuals();
  v.update(b, 0.016, 4, false);
  assert.equal(v.models[0].pose, "grenadeThrow");
  assert.equal(v.models[0].flash, false);
  refreshDiagnostics(b, u);
  assert.equal(u.diagnostics.firingPermitted, false);
  assert.equal(u.diagnostics.notFiring, "Throwing grenade");
  assert.equal(
    u.diagnostics.decision,
    "Confirmed defended position; ineffective rifle fire",
  );
});
test("emergency evasion preserves the squad assignment and ends after the observed blast", () => {
  const b = battle(),
    u = b.units[0];
  Object.assign(u, {
    x: 14,
    y: 13,
    assignment: { type: "overwatch", source: "squad leader" },
  });
  const assignment = u.assignment,
    g = frag(b);
  b.time = 1;
  updateGrenades(b);
  b.time = u.grenadeThreat.readyAt + 0.01;
  assert.equal(grenadeAction(b, u, 0.1), true);
  assert.equal(u.assignment, assignment);
  refreshDiagnostics(b, u);
  assert.equal(u.diagnostics.firingPermitted, false);
  assert.equal(u.diagnostics.notFiring, "Evading grenade");
  detonate(b, g);
  assert.equal(grenadeAction(b, u, 0.1), false);
  assert.equal(u.assignment, assignment);
});
test("medic navigation and shared barricade slots retain collision spacing", () => {
  const b = battle(),
    m = b.units[5];
  Object.assign(m, { active: true, dead: false, x: 14, y: 5 });
  const route = path(m, { x: 16, y: 5 });
  assert.ok(route.length > 2);
  assert.ok(route.every(([x, y]) => !blocked(x, y)));
  for (const [i, x] of [
    [0, 4],
    [1, 8],
    [2, 11],
  ]) {
    const u = b.units[i];
    Object.assign(u, { active: true, dead: false, x, y: 10 });
    for (let n = 0; n < 30; n++) b.move(u, { x, y: 11 }, 0.1);
    assert.ok(Math.hypot(u.x - x, u.y - 11) < 0.25);
  }
  for (const a of b.units.slice(0, 3))
    for (const c of b.units.slice(0, 3))
      if (a !== c) assert.ok(Math.hypot(a.x - c.x, a.y - c.y) > 0.65);
});
test("two grounded grenades do not continually reset reaction deadlines or expose unseen shooters", () => {
  const b = battle(),
    u = b.units[0];
  Object.assign(u, { x: 14, y: 13 });
  const g = frag(b, { x: 15, y: 13 }),
    g2 = frag(b, { x: 16, y: 13 });
  b.time = 1;
  updateGrenades(b);
  const ready = u.knownGrenades.get(g.id).readyAt;
  const detections = b.grenadeStats.detections;
  b.time = 1.1;
  updateGrenades(b);
  assert.equal(u.knownGrenades.get(g.id).readyAt, ready);
  assert.equal(b.grenadeStats.detections, detections);
  assert.equal(u.knownGrenades.get(g.id).enemyId, undefined);
  assert.equal(grenadeAction(b, u, 0.1), false);
  b.time = ready + 0.1;
  assert.equal(grenadeAction(b, u, 0.1), true);
  assert.equal(u.state, "Evading grenade");
});
test("unseen grenades do not grant reaction knowledge through walls", () => {
  const b = battle(),
    u = b.units[0];
  Object.assign(u, { x: 4, y: 6 });
  frag(b, { x: 7, y: 6 });
  b.time = 1;
  updateGrenades(b);
  assert.equal(u.grenadeThreat, null);
});
test("pending ordnance resolves before victory, including a grenade thrown by a killed soldier", () => {
  const b = battle(),
    g = frag(b);
  b.units[0].active = false;
  b.units[0].dead = true;
  b.step(0.1);
  assert.equal(b.result, null);
  for (let i = 0; i < 25 && !b.result; i++) b.step(0.1);
  assert.ok(g.detonatedAt);
  assert.ok(b.result);
});
test("quiet short urban care can cross one exposed cell; recent fire and suppression still reject it", () => {
  const b = battle(),
    m = b.units[11],
    p = b.units[10];
  Object.assign(m, { active: true, dead: false, x: 21, y: 16.36 });
  Object.assign(p, { active: true, dead: false, x: 21, y: 14.15 });
  p.health["left leg"] = 56;
  b.time = 10;
  m.intel.contacts.set(0, {
    enemyId: 0,
    x: 7.01,
    y: 14.54,
    time: 10,
    firedAt: 1,
  });
  assert.equal(careRouteSafe(b, m, p), true);
  m.intel.contacts.get(0).firedAt = 10;
  assert.equal(careRouteSafe(b, m, p), false);
  m.careCheck = null;
  m.intel.contacts.get(0).firedAt = 1;
  m.suppression = 0.4;
  assert.equal(careRouteSafe(b, m, p), false);
});
test("grenade preparation has an authoritative pose and does not create fake muzzle flashes", () => {
  const b = battle(),
    u = b.units[0];
  u.grenadePrep = { x: 15, y: 13, startedAt: 0 };
  const v = new CombatVisuals();
  v.update(b, 0.016, 4, false);
  assert.equal(v.models[0].pose, "grenadePrep");
  assert.equal(v.models[0].flash, false);
  b.injury(u, "head", 200);
  assert.equal(u.grenadePrep, null);
  v.update(b, 0.016, 4, false);
  assert.equal(v.models[0].pose, "dead");
});
test("new scenarios remain deterministic under fixed seeds and render grouping", () => {
  const snapshots = [];
  for (const speed of [1, 2, 4]) {
    let r = 1004;
    const b = new Battle(
      () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296,
      { map: "urban", grenades: true, variant: 1 },
    );
    const positions = [
      [6, 10],
      [12, 9],
      [15, 10],
      [17, 10],
      [3, 11],
      [2, 10],
      [6, 15],
      [7, 15],
      [8, 15],
      [18, 15],
      [25, 13],
      [27, 15],
    ];
    for (const u of b.units) {
      [u.x, u.y] = positions[u.id];
      u.health["left leg"] = 65;
    }
    const v = new CombatVisuals();
    const sink = new Proxy({}, { get: () => () => {} }),
      iso = (x, y) => ({ x: x * 20 - y * 20, y: x * 10 + y * 10 });
    for (let i = 0; i < 400; i++) {
      b.step(0.05);
      if (i % speed === 0) {
        v.update(b, 0.016, speed, false);
        for (const u of b.units)
          v.drawUnit(sink, b, u, iso(u.x, u.y), iso, false);
        drawGrenades(sink, b, iso);
        for (const [k, type] of obstacles) {
          const [x, y] = k.split(",").map(Number);
          drawObstacle(sink, { x, y, type }, iso(x, y));
        }
      }
    }
    assert.ok(b.grenadeStats.thrown > 0, "fixture must exercise real grenades");
    snapshots.push(
      JSON.stringify([
        r,
        b.time,
        b.units.map((u) => [u.x, u.y, u.health, u.ammo, u.frags]),
        b.grenades,
        b.grenadeStats,
      ]),
    );
  }
  assert.equal(snapshots[0], snapshots[1]);
  assert.equal(snapshots[0], snapshots[2]);
});
