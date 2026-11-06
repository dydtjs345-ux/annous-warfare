import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { careRouteSafe } from "../src/tactics.js";
function fixture() {
  const b = new Battle(() => 0.99);
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  for (const id of [0, 5, 6])
    Object.assign(b.units[id], { active: true, dead: false });
  Object.assign(b.units[0], { x: 4, y: 11 });
  Object.assign(b.units[5], { x: 3, y: 11 });
  Object.assign(b.units[6], { x: 27, y: 20, reload: 10000 });
  return b;
}
test("real treatment suspends the recon no-movement watchdog while preserving its assignment", () => {
  const b = fixture(),
    p = b.units[0],
    m = b.units[5];
  p.health["left arm"] = 0;
  b.time = 1;
  Object.assign(m, { state: "Treating", patientId: p.id, treatmentAt: 1 });
  const a = {
    unitId: 0,
    type: "recon",
    commanderId: 0,
    at: 0,
    until: 40,
    lastMovement: 0,
    anchor: { x: 4, y: 11 },
    target: { x: 12, y: 10 },
    area: { x: 20, y: 5 },
    contactId: 6,
    route: [],
  };
  b.squads[0].assignments = new Map([[0, a]]);
  p.assignment = a;
  p.intel.contacts.set(6, {
    enemyId: 6,
    x: 20,
    y: 5,
    time: 0,
    observedBy: 1,
    observers: [1],
  });
  for (let i = 0; i < 120; i++) b.step(0.05);
  assert.equal(a.failed, undefined);
  assert.equal(p.assignment, a);
  assert.ok(a.until > 45);
  assert.ok(p.health["left arm"] >= 40);
  assert.equal(p.x, 4);
  m.active = false;
  m.dead = true;
  for (let i = 0; i < 12; i++) b.step(0.05);
  assert.ok(Math.hypot(p.x - 4, p.y - 11) > 0.2);
});
test("failed casualty approaches retain separate retry exclusions instead of alternating every tick", () => {
  const b = fixture(),
    m = b.units[5];
  for (const [id, x] of [
    [0, 12],
    [1, 14],
  ]) {
    const p = b.units[id];
    Object.assign(p, { active: false, dead: false, x, y: 11 });
    p.health.torso = 20;
  }
  const attempts = [];
  const move = b.move.bind(b);
  b.move = (u, goal, dt) => {
    if (u !== m) return move(u, goal, dt);
    if (u.state !== "Moving to casualty") return true;
    attempts.push(goal.id);
    u.failedGoal = { x: goal.x, y: goal.y, until: b.time + 8 };
    return false;
  };
  for (let i = 0; i < 30; i++) b.step(0.05);
  assert.deepEqual(attempts, [0, 1]);
  assert.equal(careRouteSafe(b, m, b.units[0]), false);
  assert.equal(careRouteSafe(b, m, b.units[1]), false);
  b.time += 9;
  assert.equal(careRouteSafe(b, m, b.units[0]), true);
});
test("a materially changed origin or casualty position allows a failed approach to be reassessed", () => {
  const b = fixture(),
    m = b.units[5],
    p = b.units[0];
  Object.assign(p, { x: 12, y: 11 });
  m.failedCareRoutes = [
    {
      patientId: p.id,
      origin: { x: 3, y: 11 },
      patient: { x: 12, y: 11 },
      until: 8,
    },
  ];
  m.failedGoal = { x: p.x, y: p.y, until: 8 };
  assert.equal(careRouteSafe(b, m, p), false);
  m.x = 4.1;
  assert.equal(careRouteSafe(b, m, p), true);
  m.x = 3;
  p.x = 15;
  assert.equal(careRouteSafe(b, m, p), true);
});

test("a completed patient resumes its objective even if the medic still has the previous treatment state", () => {
  const b = fixture(),
    p = b.units[0],
    m = b.units[5];
  Object.assign(m, { state: "Treating", patientId: p.id, treatmentAt: 0 });
  b.move(p, { x: 3, y: 11 }, 0.05);
  assert.ok(p.x < 4);
  assert.notEqual(p.navigation, "Receiving treatment; retain squad objective");
});

test("sub-tile oscillation across changing goals fails as no net progress rather than walking forever", () => {
  const b = fixture(),
    u = b.units[0];
  Object.assign(u, { x: 14, y: 10 });
  let failed = false;
  for (let i = 0; i < 50; i++) {
    b.time += 0.1;
    if (b.move(u, { x: 14, y: i % 2 ? 16 : 8 }, 0.1) === false) {
      failed = true;
      break;
    }
  }
  assert.ok(failed);
  assert.equal(u.movementBlocker, "No net movement progress");
  assert.ok(b.time < 4);
  const y = u.y;
  b.time += 0.1;
  assert.equal(b.move(u, { x: 14, y: 16 }, 0.1), true);
  assert.ok(u.y > y);
});
test("ordinary navigation continues progressing with healthy and injured gait speeds", () => {
  for (const legs of [200, 30]) {
    const b = fixture(),
      u = b.units[0];
    Object.assign(u, { x: 14, y: 10 });
    u.health["left leg"] = u.health["right leg"] = legs / 2;
    for (let i = 0; i < 60; i++) {
      b.time += 0.1;
      assert.notEqual(b.move(u, { x: 14, y: 16 }, 0.1), false);
    }
    assert.ok(u.y > 13);
  }
});
test("a valid squad recon route wins over stale personal cover after visual contact is lost", () => {
  const b = fixture(),
    u = b.units[0],
    m = b.units[5],
    e = b.units[6];
  Object.assign(u, {
    x: 3,
    y: 11,
    coverTarget: { x: 4, y: 13 },
    coverUntil: 10,
  });
  Object.assign(m, { x: 8, y: 7 });
  Object.assign(e, { x: 8, y: 8 });
  const a = {
    unitId: 0,
    type: "recon",
    commanderId: 0,
    at: 0,
    until: 20,
    lastMovement: 0,
    anchor: { x: 3, y: 11 },
    target: { x: 7, y: 10 },
    area: { x: 8, y: 8 },
    contactId: 6,
    route: [],
  };
  u.assignment = a;
  b.squads[0].assignments = new Map([[0, a]]);
  b.step(0.05);
  assert.equal(u.coverTarget, null);
  assert.equal(u.assignment, a);
  assert.equal(u.state, "Reacquiring contact");
  assert.ok(u.x > 3);
});
