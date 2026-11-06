import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { observes, updateSecurity, formationDesired } from "../src/security.js";
import { blocked, sight } from "../src/world.js";
import { updateSearchState } from "../src/search.js";
function fixture() {
  return new Battle(() => 0.99, { map: "expanded", grenades: true });
}
test("directional security scans reveal rear approaches only through actual observation and LOS", () => {
  const b = fixture(),
    u = b.units[0];
  Object.assign(u, { x: 14, y: 13, observationHeading: 0 });
  const rear = { x: 10, y: 13 };
  assert.ok(sight(u, rear));
  assert.equal(observes(u, rear), false);
  u.observationHeading = Math.PI;
  assert.equal(observes(u, rear), true);
  assert.equal(observes(u, { x: 7, y: 8 }), false);
});
test("actual movement direction is independent of observation and weapon facing", () => {
  const b = fixture(),
    u = b.units[0];
  Object.assign(u, {
    x: 14,
    y: 13,
    observationHeading: Math.PI,
    visibleEnemies: [],
    facing: Math.PI,
  });
  b.time = 1;
  b.move(u, { x: 14, y: 16 }, 0.2);
  assert.ok(u.y > 13);
  assert.ok(Math.abs(u.movementHeading - Math.PI / 2) < 0.001);
  assert.equal(u.facing, Math.PI);
});
test("loose column uses geometric clearance with hysteresis, without locking the lead objective", () => {
  const b = fixture(),
    u = b.units[4],
    lead = b.units[0];
  Object.assign(lead, { x: 11, y: 8, movementHeading: Math.PI / 2 });
  b.squads[0].search.goal = { x: 14, y: 38 };
  formationDesired(b, u, lead, 0);
  assert.equal(b.squads[0].formation.mode, "staggered");
  b.time = 3;
  const a = formationDesired(b, u, lead, 0),
    c = formationDesired(b, u, lead, 1);
  assert.equal(u.formationMode, "loose column");
  assert.notDeepEqual(a, c);
  assert.deepEqual(b.squads[0].search.goal, { x: 14, y: 38 });
});
test("exploration memory does not mark unseen rear landmarks cleared; rotating observation can reveal them", () => {
  const b = fixture(),
    u = b.units[0];
  for (const a of b.units.slice(1, 6)) a.active = false;
  Object.assign(u, { x: 14, y: 27, observationHeading: 0 });
  const n = b.searchNodes.find((n) => n.x === 10 && n.y === 26);
  assert.ok(n);
  b.time = 1;
  updateSearchState(b, 0);
  assert.equal(Number.isFinite(b.squads[0].search.seen[n.id]), false);
  u.observationHeading = Math.PI;
  b.time = 3;
  updateSearchState(b, 0);
  assert.equal(b.squads[0].search.seen[n.id], 3);
});
test("new formation targets remain distinct, reachable and nonblocking during autonomous search", () => {
  const b = fixture();
  for (let i = 0; i < 80; i++) b.step(0.1);
  assert.ok(b.units[0].x > 2);
  const targets = b.units
    .slice(0, 6)
    .map((u) => u.assignment?.target)
    .filter(Boolean);
  for (const p of targets)
    assert.equal(blocked(Math.round(p.x), Math.round(p.y)), false);
  assert.equal(
    new Set(targets.map((p) => `${p.x},${p.y}`)).size,
    targets.length,
  );
});
test("extended loose-column support does not continually reset an arrived follower objective", async () => {
  const { followAssignment } = await import("../src/coordination.js");
  const b = fixture();
  b.step(0.1);
  const u = b.units[4],
    lead = b.units[0];
  Object.assign(lead, { x: 14, y: 13 });
  Object.assign(u, { x: 14, y: 7 });
  Object.assign(u.assignment, {
    type: "escort",
    leadId: lead.id,
    supportDistance: 6.5,
    target: { x: 14, y: 9 },
  });
  const before = { x: u.x, y: u.y };
  followAssignment(b, u, 0.2);
  assert.deepEqual({ x: u.x, y: u.y }, before);
  assert.match(u.holdReason, /supporting distance/);
});
test("search does not complete an observation objective while looking away from its area", async () => {
  const { coordinateSquad } = await import("../src/coordination.js");
  const b = fixture();
  b.step(0.1);
  const q = b.squads[0],
    u = b.units[0],
    rev = q.search.revision;
  Object.assign(q.search.goal, { x: 14, y: 14, at: 0, until: 200 });
  Object.assign(u, { x: 14, y: 17, observationHeading: Math.PI / 2 });
  u.assignment.target = { x: 14, y: 17 };
  b.time = 4;
  q.nextCoordination = 0;
  coordinateSquad(b, 0);
  assert.equal(q.search.revision, rev);
  u.observationHeading = -Math.PI / 2;
  b.time = 5;
  q.nextCoordination = 0;
  coordinateSquad(b, 0);
  assert.ok(q.search.revision > rev);
});
test("cone-first observation is equivalent to the original LOS-first rule across deterministic map rays", () => {
  const b = fixture();
  let seed = 29;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 1000; i++) {
    const u = {
        x: 1 + random() * 51,
        y: 1 + random() * 41,
        observationHeading: random() * Math.PI * 4,
        posture: { mode: i % 3 ? "peek" : "full" },
      },
      p = { x: 1 + random() * 51, y: 1 + random() * 41 };
    const expected =
      sight(u, p) &&
      (Math.hypot(p.x - u.x, p.y - u.y) <= 2.5 ||
        Math.cos(Math.atan2(p.y - u.y, p.x - u.x) - u.observationHeading) >=
          Math.cos(1.4));
    assert.equal(observes(u, p), expected);
  }
});
