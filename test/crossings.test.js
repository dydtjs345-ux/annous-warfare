import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { obstacles } from "../src/world.js";
import { crossingSegment, crossingPermit } from "../src/crossings.js";
function fixture() {
  const b = new Battle(() => 0.99, { map: "expanded" });
  obstacles.set("12,26", "sandbag");
  for (const u of b.units.slice(0, 6))
    Object.assign(u, { x: 12, y: 25, lastMoveCall: 1 });
  b.time = 1;
  b.squads[0].intel.contacts.set(6, { enemyId: 6, x: 14, y: 30, time: 1 });
  return {
    b,
    route: [
      [13, 25],
      [14, 25],
      [15, 25],
      [16, 25],
      [17, 25],
      [18, 25],
    ],
  };
}
test("only a bounded across-road segment is classified, not endless travel along a street", () => {
  const { b, route } = fixture();
  assert.ok(crossingSegment(b.units[0], route));
  assert.equal(
    crossingSegment({ x: 14, y: 3 }, [
      [14, 4],
      [14, 5],
      [14, 6],
    ]),
    null,
  );
});
test("a protected waiting element observes while two cross and keeps its destination", () => {
  const { b, route } = fixture();
  assert.equal(crossingPermit(b, b.units[0], route), true);
  assert.equal(crossingPermit(b, b.units[1], route), true);
  assert.equal(crossingPermit(b, b.units[2], route), false);
  assert.equal(b.units[2].state, "Covering crossing");
  assert.ok(b.units[2].crossingWaitUntil > b.time);
});
test("completed and dead reservations release slots; no crossers can permanently lock the squad", () => {
  const { b, route } = fixture();
  crossingPermit(b, b.units[0], route);
  crossingPermit(b, b.units[1], route);
  b.units[0].x = 14;
  crossingPermit(b, b.units[0], route);
  b.units[0].x = 18;
  b.units[1].active = false;
  assert.equal(crossingPermit(b, b.units[2], route), true);
  assert.equal(b.squads[0].crossingStats.completed, 1);
  b.time = 10;
  assert.equal(crossingPermit(b, b.units[3], route), true);
});
test("grenade evasion, danger at the entry and unknown threats never force a procedural wait", () => {
  const { b, route } = fixture();
  crossingPermit(b, b.units[0], route);
  crossingPermit(b, b.units[1], route);
  b.units[2].state = "Evading grenade";
  assert.equal(crossingPermit(b, b.units[2], route), true);
  b.squads[0].intel.contacts.clear();
  b.units[3].state = "Searching district";
  assert.equal(crossingPermit(b, b.units[3], route), true);
});
test("retreat behind an entry is not falsely counted as a completed crossing", () => {
  const { b, route } = fixture(),
    u = b.units[0];
  crossingPermit(b, u, route);
  u.x = 14;
  crossingPermit(b, u, route);
  u.x = 10;
  crossingPermit(b, b.units[2], route);
  assert.equal(b.squads[0].crossingStats.completed, 0);
});
