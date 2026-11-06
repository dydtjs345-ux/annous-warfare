import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { coordinateSquad, updateProgress } from "../src/coordination.js";
import { obstacles, key } from "../src/world.js";
function fixture() {
  const b = new Battle(() => 0.99);
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  const u = b.units[0],
    e = b.units[6];
  Object.assign(u, { active: true, dead: false, x: 6, y: 6 });
  Object.assign(e, { active: true, dead: false, x: 20, y: 11, reload: 1000 });
  u.health.torso = 30;
  b.time = 20;
  updateProgress(b, u);
  u.progress.lastUseful = 0;
  u.intel.contacts.set(6, {
    enemyId: 6,
    x: 20,
    y: 11,
    time: 20,
    observers: [1],
    observedBy: 1,
  });
  return { b, u, e };
}
test("a mobile injured survivor can receive a safe observation task after squad-wide lack of progress", () => {
  const { b, u } = fixture();
  coordinateSquad(b, 0);
  assert.equal(u.assignment?.type, "recon");
  assert.match(u.assignment.reason, /Cautious survivor/);
  const start = { x: u.x, y: u.y };
  for (let i = 0; i < 20; i++) b.step(0.05);
  assert.ok(Math.hypot(u.x - start.x, u.y - start.y) > 0.5);
});
test("injury fallback preserves waiting for recent progress, severe mobility injuries and suppression", () => {
  for (const restriction of ["recent", "legs", "pressure"]) {
    const { b, u } = fixture();
    if (restriction === "recent") u.progress.lastUseful = 19;
    if (restriction === "legs")
      u.health["left leg"] = u.health["right leg"] = 25;
    if (restriction === "pressure") u.suppression = 0.6;
    coordinateSquad(b, 0);
    assert.notEqual(u.assignment?.type, "recon");
  }
});
test("a fit medic is not permanently reserved for an armed but unreachable injured investigator", () => {
  const { b, u } = fixture();
  const m = b.units[5];
  Object.assign(m, {
    active: true,
    dead: false,
    x: 3,
    y: 11,
    progress: { lastUseful: 0 },
  });
  const doors = [key(7, 4), key(7, 9)];
  try {
    for (const k of doors) obstacles.set(k, "wall");
    coordinateSquad(b, 0);
    assert.equal(m.assignment?.type, "recon");
  } finally {
    for (const k of doors) obstacles.delete(k);
  }
});
test("movement keeps actual shot and visible engagement aim rather than turning the gun backward", () => {
  const b = new Battle(() => 0.99),
    u = b.units[0],
    e = b.units[6];
  Object.assign(u, {
    x: 14,
    y: 10,
    engagementId: 6,
    visibleEnemies: [e],
    facing: Math.PI / 2,
    firedAt: 0,
  });
  Object.assign(e, { x: 14, y: 16 });
  b.move(u, { x: 13, y: 10 }, 0.05);
  assert.equal(u.facing, Math.PI / 2);
  b.time = 0.1;
  u.firedAt = 0;
  b.move(u, { x: 13, y: 10 }, 0.05);
  assert.ok(Math.abs(u.facing - Math.atan2(e.y - u.y, e.x - u.x)) < 1e-9);
});
