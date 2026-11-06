import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import {
  coordinateFireMovement,
  maneuverSupported,
} from "../src/fire-movement.js";
import { followManeuver, planFlank } from "../src/tactics.js";
import { updatePosture } from "../src/postures.js";
function fixture() {
  const b = new Battle(() => 0.99, { tactical: true });
  b.time = 20;
  const positions = [
    [2, 11],
    [3, 10],
    [3, 11],
    [2, 10],
    [4, 11],
    [2, 9],
  ];
  for (let i = 0; i < 6; i++) {
    Object.assign(b.units[i], { x: positions[i][0], y: positions[i][1] });
  }
  b.squads[0].commanderId = 0;
  b.squads[0].lastProgress = 0;
  b.squads[0].intel.contacts.set(6, {
    enemyId: 6,
    x: 9,
    y: 11,
    time: 20,
    clearedAt: null,
  });
  return b;
}
test("a conditional flank receives real support roles while medics retain care autonomy", () => {
  const b = fixture(),
    q = b.squads[0];
  q.maneuver = planFlank(b, 0, [{ enemyId: 6, x: 9, y: 11, time: 20 }]);
  assert.ok(q.maneuver);
  coordinateFireMovement(b, 0);
  const m = q.maneuver;
  assert.equal(b.units[m.unitId].tacticalRole, "maneuver");
  assert.ok(m.supportIds.includes(4));
  assert.equal(b.units[5].tacticalRole, "care / local security");
  assert.equal(maneuverSupported(b, b.units[m.unitId], m), false);
  b.units[4].firedAt = b.time;
  b.time += 0.6;
  coordinateFireMovement(b, 0);
  assert.equal(maneuverSupported(b, b.units[m.unitId], m), true);
  const u = b.units[m.unitId],
    start = { x: u.x, y: u.y };
  assert.equal(followManeuver(b, u, m, 0.2), true);
  assert.ok(Math.hypot(u.x - start.x, u.y - start.y) > 0);
});
test("missing support cancels within a bounded interval instead of trapping both elements", () => {
  const b = fixture(),
    q = b.squads[0];
  q.maneuver = planFlank(b, 0, [{ x: 9, y: 11, time: 20 }]);
  coordinateFireMovement(b, 0);
  const m = q.maneuver,
    u = b.units[m.unitId];
  b.time += 3.1;
  assert.equal(maneuverSupported(b, u, m), false);
  assert.equal(m.until, b.time);
  coordinateFireMovement(b, 0);
  assert.equal(u.tacticalRole, null);
  assert.equal(q.fireMovement.aborted, 1);
});
test("a maneuver assignment releases cyclic full cover but never removes grenade or injury priorities", () => {
  const b = fixture(),
    u = b.units[2];
  u.posture = { mode: "full", until: 30, transitions: 0 };
  u.tacticalRole = "maneuver";
  updatePosture(b, u);
  assert.notEqual(u.posture.mode, "full");
  const m = {
    unitId: u.id,
    target: { x: 2, y: 14 },
    until: 30,
    threat: { x: 9, y: 11 },
  };
  u.suppression = 0.8;
  assert.equal(followManeuver(b, u, m, 0.1), false);
});
test("two-survivor planning is optional, geometry-constrained, and command succession remains authoritative", () => {
  const b = fixture();
  for (const u of b.units.slice(0, 6)) u.active = [0, 2].includes(u.id);
  const m = planFlank(b, 0, [{ x: 9, y: 11, time: 20 }]);
  assert.ok(m, "safe two-survivor flank retains one supporting soldier");
  assert.equal(m.unitId, 2);
  assert.ok(m.target);
  b.squads[0].lastProgress = b.time;
  assert.equal(planFlank(b, 0, [{ x: 9, y: 11, time: 20 }]), null);
  b.units[0].active = false;
  b.squads[0].commanderId = 2;
  assert.equal(planFlank(b, 0, [{ x: 9, y: 11, time: 20 }]), null);
});
