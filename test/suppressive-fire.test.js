import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import {
  suppressiveFire,
  suppressionCandidate,
} from "../src/suppressive-fire.js";
import { terrainSight } from "../src/world.js";
function fixture() {
  const b = new Battle(() => 0.99, { tactical: true });
  for (const u of b.units)
    Object.assign(u, { active: false, dead: true, visibleEnemies: [] });
  const u = b.units[4],
    e = b.units[6];
  Object.assign(u, { active: true, dead: false, x: 3, y: 11 });
  Object.assign(e, {
    active: true,
    dead: false,
    x: 3,
    y: 15,
    posture: { mode: "full" },
  });
  b.time = 1;
  u.intel.contacts.set(6, {
    enemyId: 6,
    x: 3,
    y: 15,
    time: 0.5,
    clearedAt: null,
  });
  return { b, u, e };
}
test("last-known suppression spends real ammo without a direct enemy and has a finite budget", () => {
  const { b, u } = fixture();
  const start = u.ammo;
  for (let i = 0; i < 55; i++) {
    b.time += 0.1;
    u.cooldown -= 0.1;
    suppressiveFire(b, u);
  }
  assert.ok(start - u.ammo > 0);
  assert.ok(start - u.ammo <= 10);
  assert.equal(u.suppressionTask.active, false);
  const shots = b.events.filter((e) => e.type === "shot");
  assert.equal(shots.length, start - u.ammo);
  assert.ok(
    shots.every(
      (e) =>
        e.suppressive &&
        terrainSight({ x: e.x, y: e.y }, { x: e.targetX, y: e.targetY }),
    ),
  );
});
test("aiming does not read an unseen enemy location; protected hidden bodies take pressure but no guaranteed damage", () => {
  const a = fixture(),
    b = fixture();
  b.e.x = 25;
  b.e.y = 24;
  for (const f of [a, b]) {
    suppressiveFire(f.b, f.u);
    f.b.time = 1.7;
    suppressiveFire(f.b, f.u);
  }
  assert.deepEqual(a.b.events, b.b.events);
  assert.equal(a.u.ammo, b.u.ammo);
  assert.equal(a.e.health.torso, 100);
  assert.ok(a.e.suppression > 0);
  assert.equal(b.e.suppression, 0);
});
test("stale, cleared, solid-obstructed and friend-occupied remembered lanes are rejected", () => {
  const { b, u } = fixture(),
    c = u.intel.contacts.get(6);
  c.time = -10;
  assert.equal(suppressionCandidate(b, u), null);
  c.time = 0.5;
  c.clearedAt = 0.9;
  assert.equal(suppressionCandidate(b, u), null);
  c.clearedAt = null;
  c.x = 8;
  c.y = 8;
  assert.equal(suppressionCandidate(b, u), null);
  c.x = 3;
  c.y = 15;
  Object.assign(b.units[1], { active: true, dead: false, x: 3, y: 11.8 });
  assert.equal(suppressionCandidate(b, u), null);
});
test("search, recon, medic care, full cover and weapon handling take priority over speculative fire", () => {
  const { b, u } = fixture();
  for (const type of ["search", "escort", "recon", "care"]) {
    u.assignment = { type };
    assert.equal(suppressiveFire(b, u), false);
  }
  u.assignment = null;
  u.posture = { mode: "full" };
  assert.equal(suppressiveFire(b, u), false);
  u.posture = null;
  u.reload = 1;
  assert.equal(suppressiveFire(b, u), false);
  u.reload = 0;
  u.role = "Medic";
  assert.equal(suppressiveFire(b, u), false);
});
test("a casualty cannot retain an active suppression-task diagnostic", () => {
  const { b, u } = fixture();
  suppressiveFire(b, u);
  assert.equal(u.suppressionTask.active, true);
  b.injury(u, "head", 200);
  b.step(0.1);
  assert.equal(u.suppressionTask.active, false);
});
test("stopped suppressive fire records an actual friendly-lane rejection rather than the old positive reason", () => {
  const { b, u } = fixture();
  suppressiveFire(b, u);
  Object.assign(b.units[1], { active: true, dead: false, x: 3, y: 11.8 });
  assert.equal(suppressiveFire(b, u), false);
  assert.match(u.suppressionTask.reason, /Friendly body/);
});
test("arm injuries reduce remembered-lane hit probability while ammunition and near-miss pressure remain real", () => {
  const results = [];
  for (const injured of [false, true]) {
    const { b, u, e } = fixture();
    e.posture = null;
    b.random = () => 0.04;
    if (injured) {
      u.health["left arm"] = 0;
      u.health["right arm"] = 0;
    }
    suppressiveFire(b, u);
    b.time = 1.7;
    suppressiveFire(b, u);
    results.push(e.health.head);
    assert.equal(u.ammo, 59);
    assert.ok(e.suppression > 0);
  }
  assert.equal(results[0], 35);
  assert.equal(results[1], 100);
});
