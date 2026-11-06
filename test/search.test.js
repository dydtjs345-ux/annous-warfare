import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { configureWorld, sight } from "../src/world.js";
import { reportGunfire } from "../src/intelligence.js";
import { CombatVisuals } from "../src/combat-visuals.js";
import { inspectSoldier } from "../src/inspection.js";
function battle(seed = 2001, options = {}) {
  let r = seed;
  return new Battle(() => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296, {
    map: "expanded",
    variant: 0,
    spawn: 0,
    grenades: true,
    ...options,
  });
}
afterEach(() => configureWorld("legacy"));
test("unseen enemy relocation cannot change initial squad search intentions or assignments", () => {
  const results = [];
  for (const relocated of [false, true]) {
    const b = battle();
    if (relocated)
      for (const u of b.units.filter((u) => u.team === 1)) {
        u.x = 51;
        u.y = 6 + (u.id % 6) * 1.5;
      }
    for (let i = 0; i < 40; i++) b.step(0.1);
    assert.equal(b.squads[0].intel.contacts.size, 0);
    results.push(
      JSON.stringify({
        goal: b.squads[0].search.goal,
        orders: b.units
          .slice(0, 6)
          .map((u) => [u.x, u.y, u.assignment?.type, u.assignment?.target]),
      }),
    );
  }
  assert.equal(results[0], results[1]);
});
test("exploration memory records personal line of sight rather than clearing unseen districts", () => {
  const b = battle();
  for (const u of b.units.slice(1, 6)) {
    u.active = false;
    u.dead = true;
  }
  const u = b.units[0],
    hidden = b.searchNodes.find(
      (n) => Math.hypot(n.x - u.x, n.y - u.y) <= 10 && !sight(u, n),
    );
  assert.ok(hidden);
  b.step(0.1);
  assert.equal(Number.isFinite(b.squads[0].search.seen[hidden.id]), false);
  assert.ok(b.squads[0].search.seen.some(Number.isFinite));
});
test("search orders persist and two distinct scouts travel while support elements retain local roles", () => {
  const b = battle();
  b.step(0.1);
  const q = b.squads[0],
    goal = q.search.goal.id;
  const scouts = [...q.assignments.values()].filter((a) => a.type === "search");
  assert.equal(scouts.length, 2);
  assert.notDeepEqual(scouts[0].target, scouts[1].target);
  assert.ok([...q.assignments.values()].some((a) => a.type === "escort"));
  const start = b.units[0].x;
  for (let i = 0; i < 15; i++) b.step(0.1);
  assert.equal(q.search.goal.id, goal);
  assert.ok(Math.hypot(b.units[0].x - start, b.units[0].y - 8) > 0.5);
});
test("search movement increases legitimately observed landmark coverage", () => {
  const b = battle();
  b.step(0.1);
  const s = b.squads[0].search,
    n = s.seen.filter(Number.isFinite).length;
  for (let i = 0; i < 120; i++) b.step(0.1);
  assert.ok(s.seen.filter(Number.isFinite).length > n);
  assert.ok(s.completed >= 1);
});
test("direct contacts share snapshots, decay after LOS loss and return to search without hidden tracking", () => {
  const b = battle();
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  for (const id of [0, 1, 6])
    Object.assign(b.units[id], { active: true, dead: false });
  Object.assign(b.units[0], { x: 13, y: 13 });
  Object.assign(b.units[1], { x: 2, y: 8 });
  Object.assign(b.units[6], { x: 19, y: 13, reload: 10000 });
  b.move = () => true;
  b.step(0.1);
  const s = b.squads[0].search;
  assert.equal(s.phase, "CONTACT");
  assert.ok(b.units[0].visibleEnemies.length);
  assert.equal(b.units[1].visibleEnemies.length, 0);
  assert.equal(b.units[1].memory.enemyId, 6);
  const seen = { ...b.squads[0].intel.contacts.get(6) };
  Object.assign(b.units[6], { x: 51, y: 28 });
  for (let i = 0; i < 5; i++) b.step(0.1);
  assert.equal(s.phase, "LOST_CONTACT");
  assert.equal(b.squads[0].intel.contacts.get(6).x, seen.x);
  const phases = new Set();
  for (let i = 0; i < 310; i++) {
    b.step(0.1);
    phases.add(s.phase);
  }
  assert.ok(phases.has("REACQUIRE"));
  assert.ok(phases.has("SEARCH_AGAIN"));
  assert.ok(phases.has("SEARCH"));
  assert.equal(b.squads[0].intel.contacts.size, 0);
  assert.notEqual(s.goal?.x, 51);
});
test("audible fire gives an uncertain bearing, never an enemy identity or coordinate", () => {
  const b = battle(),
    u = b.units[0],
    e = b.units[6];
  Object.assign(u, { x: 13, y: 13 });
  Object.assign(e, { x: 27, y: 13 });
  b.time = 3;
  reportGunfire(b, e);
  const r = u.intel.sounds.get(u.id);
  assert.ok(r);
  assert.deepEqual(Object.keys(r).sort(), [
    "bearing",
    "kind",
    "origin",
    "reporterId",
    "time",
  ]);
  assert.equal(u.intel.contacts.size, 0);
  assert.equal(u.memory, null);
  b.step(0.1);
  assert.equal(b.squads[0].search.phase, "REACQUIRE");
});
test("medic treatment takes priority during search and resumes squad activity afterward", () => {
  const b = battle();
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  const p = b.units[0],
    m = b.units[5],
    e = b.units[6];
  Object.assign(p, { active: true, dead: false, x: 14, y: 13 });
  p.health["left arm"] = 0;
  Object.assign(m, { active: true, dead: false, x: 13, y: 13 });
  Object.assign(e, { active: true, dead: false, x: 51, y: 28, reload: 10000 });
  for (let i = 0; i < 25; i++) b.step(0.1);
  assert.ok(p.health["left arm"] >= 8);
  assert.equal(m.state, "Treating");
  assert.equal(m.patientId, p.id);
  for (let i = 0; i < 100; i++) b.step(0.1);
  assert.ok(p.health["left arm"] >= 65);
  assert.notEqual(m.state, "Treating");
});
test("dead leaders pass authority deterministically without losing search memory", () => {
  const b = battle();
  for (let i = 0; i < 20; i++) b.step(0.1);
  const memory = b.squads[0].search.seen;
  b.injury(b.units[0], "head", 200);
  for (let i = 0; i < 20; i++) b.step(0.1);
  assert.equal(b.squads[0].commanderId, 1);
  assert.equal(b.squads[0].search.seen, memory);
  // The existing bounded casualty-sector reassessment remains authoritative.
  for (let i = 0; i < 70; i++) b.step(0.1);
  assert.ok(
    [...b.squads[0].assignments.values()].some((a) => a.type === "search"),
  );
});
test("ammunition exhaustion is diagnosed without revealing or forcing enemy positions", () => {
  const b = battle();
  for (const u of b.units.slice(0, 6)) {
    u.ammo = 0;
    u.reserve = 0;
    u.frags = 0;
  }
  for (let i = 0; i < 30; i++) b.step(0.1);
  assert.match(b.squads[0].search.blocker, /Ammunition exhausted/);
  assert.equal(b.squads[0].intel.contacts.size, 0);
  assert.equal(b.result, null);
});
test("expanded simulation and presentation are deterministic at 1×, 2× and 4× grouping", () => {
  const results = [];
  for (const speed of [1, 2, 4]) {
    const b = battle(2049, { variant: 2, spawn: 1 }),
      v = new CombatVisuals();
    for (let i = 0; i < 800; i++) {
      b.step(0.05);
      if (i % speed === 0) v.update(b, 0.016, speed, false);
    }
    results.push(
      JSON.stringify({
        units: b.units.map((u) => [u.x, u.y, u.health, u.ammo, u.state]),
        goals: b.squads.map((q) => [
          q.search.phase,
          q.search.goal,
          [...q.search.seen],
        ]),
        grenades: b.grenadeStats,
      }),
    );
    assert.match(inspectSoldier(b.units[0]), /Search:/);
  }
  assert.equal(results[0], results[1]);
  assert.equal(results[0], results[2]);
});
