import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { perceive, adoptContact, contacts } from "../src/intelligence.js";
import {
  coordinateSquad,
  commanderFor,
  observationPlan,
  followAssignment,
} from "../src/coordination.js";
import { blocked, sight, obstacles, key } from "../src/world.js";
import { refreshDiagnostics } from "../src/diagnostics.js";
import { inspectSoldier } from "../src/inspection.js";
const seeded = (seed) => () =>
  (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
function fixture(ids = [0, 1, 2, 4, 10]) {
  const b = new Battle(seeded(7));
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  for (const id of ids) {
    b.units[id].active = true;
    b.units[id].dead = false;
  }
  Object.assign(b.units[0], { x: 13, y: 11, reload: 10000 });
  Object.assign(b.units[1], { x: 6, y: 6 });
  Object.assign(b.units[2], { x: 3, y: 10 });
  Object.assign(b.units[4], { x: 3, y: 11 });
  Object.assign(b.units[10], { x: 20, y: 11, reload: 10000 });
  return b;
}
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / 0.05) && !b.result; i++) b.step(0.05);
}
function prepare(b) {
  b.time = 1;
  perceive(b);
  for (const u of b.units)
    if (u.active) {
      u.alert = null;
      adoptContact(b, u);
    }
  b.squads[0].nextCoordination = 0;
  coordinateSquad(b, 0);
}

test("a 14.9-tile radio contact generates an accessible observation approach and real movement", () => {
  const b = fixture([0, 1, 10]);
  b.random = () => 0.99;
  const start = { x: b.units[1].x, y: b.units[1].y };
  advance(b, 3);
  const a = b.squads[0].assignments.get(1);
  assert.equal(a.type, "recon");
  assert.ok(a.route.length);
  assert.ok(a.route.every(([x, y]) => !blocked(x, y)));
  advance(b, 5);
  assert.ok(Math.hypot(b.units[1].x - start.x, b.units[1].y - start.y) > 1);
  assert.ok(b.units[1].ammo < 30 || b.units[1].state === "Reacquiring contact");
});

test("recon orders persist while travel makes progress instead of being replaced by fresh timestamps", () => {
  const b = fixture([0, 1, 10]);
  prepare(b);
  const a = b.units[1].assignment;
  assert.equal(a.type, "recon");
  const before = { x: b.units[1].x, y: b.units[1].y };
  advance(b, 1.5);
  assert.equal(b.units[1].assignment, a);
  assert.ok(Math.hypot(b.units[1].x - before.x, b.units[1].y - before.y) > 1);
  assert.ok(a.until > b.time);
});

test("unreachable observation positions are rejected with an actual planner explanation", () => {
  const b = fixture([0, 1, 10]),
    doors = [key(7, 4), key(7, 9)];
  try {
    for (const d of doors) obstacles.set(d, "wall");
    prepare(b);
    assert.notEqual(b.units[1].assignment.type, "recon");
    assert.match(b.units[1].alternativeRejection, /No reachable observation/);
  } finally {
    for (const d of doors) obstacles.delete(d);
  }
});

test("a failed destination is excluded while alternative observation positions remain available", () => {
  const b = fixture([0, 1, 10]);
  prepare(b);
  const u = b.units[1],
    first = u.assignment;
  u.failedGoal = { ...first.target, until: b.time + 20 };
  first.failed = true;
  b.squads[0].nextCoordination = b.time;
  coordinateSquad(b, 0);
  b.time += 2.1;
  b.squads[0].nextCoordination = b.time;
  coordinateSquad(b, 0);
  assert.equal(u.assignment.type, "recon");
  assert.ok(
    Math.hypot(
      u.assignment.target.x - first.target.x,
      u.assignment.target.y - first.target.y,
    ) >= 1,
  );
});

test("recon and overwatch are distinct squad tasks and influence real AI actions", () => {
  const b = fixture();
  prepare(b);
  advance(b, 0.2);
  const tasks = [...b.squads[0].assignments.values()];
  assert.ok(tasks.some((a) => a.type === "recon"));
  assert.ok(tasks.some((a) => a.type === "overwatch"));
  const scouts = b.units.filter(
    (u) => u.team === 0 && u.active && u.assignment?.type === "recon",
  );
  assert.ok(scouts.length <= 2);
  assert.ok(scouts.some((u) => u.state === "Reacquiring contact"));
  assert.ok(
    b.units.some(
      (u) =>
        u.team === 0 &&
        u.assignment?.type === "overwatch" &&
        ["Covering search", "Reloading"].includes(u.state),
    ),
  );
});

test("a dead scout causes bounded task redistribution without an attacker position", () => {
  const b = fixture();
  prepare(b);
  const scout = b.units.find((u) => u.assignment?.type === "recon");
  assert.ok(scout);
  const oldId = scout.id;
  b.injury(scout, "torso", 100);
  advance(b, 0.7);
  assert.ok(b.squads[0].lossEvents.some((e) => e.unitId === oldId));
  assert.ok(!("attackerId" in b.squads[0].lossEvents.at(-1)));
  assert.ok(b.squads[0].casualtyReplans >= 1);
  assert.ok(!b.squads[0].assignments.has(oldId));
  assert.ok(
    b.units.some((u) => u.team === 0 && u.active && u.casualtyResponse),
  );
  advance(b, 2);
  assert.ok(
    [...b.squads[0].assignments.values()].some(
      (a) => a.type === "recon" && a.unitId !== oldId,
    ),
  );
});

test("leader loss selects a deterministic acting commander and does not disable assignments", () => {
  const b = fixture();
  prepare(b);
  b.injury(b.units[0], "head", 200);
  advance(b, 0.7);
  assert.equal(b.squads[0].commanderId, 1);
  assert.equal(commanderFor(b, 0).id, 1);
  assert.ok(
    b.units[1].intel.lossEvents.some(
      (e) => e.unitId === 0 && e.kind === "killed",
    ),
  );
  assert.ok(
    [...b.squads[0].assignments.values()].every((a) => a.commanderId === 1),
  );
  assert.ok(
    [...b.squads[0].assignments.values()].some((a) => a.type === "recon"),
  );
});

test("command fallback uses existing roles only: rifleman, LMG, then medic", () => {
  const b = fixture([1, 4, 5, 10]);
  assert.equal(commanderFor(b, 0).id, 1);
  b.units[1].active = false;
  assert.equal(commanderFor(b, 0).id, 4);
  b.units[4].active = false;
  assert.equal(commanderFor(b, 0).id, 5);
});

test("casualty response without enemy identification assigns local observation rather than a fictitious contact", () => {
  const b = fixture([0, 1, 2, 4, 10]);
  Object.assign(b.units[0], { x: 2, y: 8, reload: 0 });
  Object.assign(b.units[10], { x: 27, y: 24 });
  b.injury(b.units[2], "torso", 100);
  advance(b, 0.7);
  assert.equal(contacts(b, 0).length, 0);
  assert.ok(b.squads[0].casualtyReplans >= 1);
  assert.ok(b.units[1].casualtyResponse);
  assert.ok(
    [...b.squads[0].assignments.values()].some(
      (a) => a.type === "recon" && a.sector,
    ),
  );
});

test("expired intelligence permits coarse-sector search without hidden-coordinate tracking", () => {
  const b = fixture([0, 1, 10]);
  prepare(b);
  const remembered = { ...b.squads[0].lastSector };
  Object.assign(b.units[10], { x: 27, y: 24 });
  for (const u of b.units.filter((u) => !u.team)) {
    u.x = 2;
    u.y = u.id === 0 ? 5 : 6;
  }
  b.time += 9;
  perceive(b);
  for (const u of b.units) if (u.active) adoptContact(b, u);
  b.squads[0].nextCoordination = 0;
  coordinateSquad(b, 0);
  assert.equal(contacts(b, 0).length, 0);
  assert.equal(b.squads[0].lastSector.x, remembered.x);
  assert.equal(b.squads[0].lastSector.y, remembered.y);
  const a = [...b.squads[0].assignments.values()].find(
    (a) => a.type === "recon",
  );
  assert.ok(a);
  assert.equal(a.contactId, null);
  assert.equal(a.sector, true);
  const first = { ...a.target };
  Object.assign(b.units[10], { x: 25, y: 20 });
  coordinateSquad(b, 0);
  assert.deepEqual(a.target, first);
});

test("one-versus-one and four-versus-one lost-contact scenarios can reacquire and finish", () => {
  for (const ids of [
    [1, 10],
    [0, 1, 2, 4, 10],
  ])
    for (let seed = 1; seed <= 3; seed++) {
      const b = fixture(ids);
      b.random = seeded(seed);
      if (ids.length === 2) {
        Object.assign(b.units[1], { x: 4, y: 6 });
        Object.assign(b.units[10], { x: 8, y: 6 });
      }
      assert.ok(!sight(b.units[1], b.units[10]));
      advance(b, 180);
      assert.equal(b.result, "USMC victory", `seed ${seed}, ids ${ids}`);
    }
});

test("a strong covered firing lane is preserved instead of generating unnecessary recon", () => {
  const b = fixture([1, 10]);
  b.random = () => 0.99;
  Object.assign(b.units[1], { x: 3, y: 11 });
  Object.assign(b.units[10], { x: 3, y: 15 });
  advance(b, 8);
  assert.equal(b.units[1].x, 3);
  assert.equal(b.units[1].y, 11);
  assert.ok(b.units[1].ammo < 30);
  assert.notEqual(b.units[1].assignment?.type, "recon");
});

test("fractional-cell navigation escapes an incapacitated teammate while retaining separation", () => {
  const b = fixture([1]);
  const u = b.units[1],
    body = b.units[2];
  body.dead = false;
  body.active = false;
  body.x = 7.17;
  body.y = 13;
  u.x = 6.584802592121407;
  u.y = 12.847341648731822;
  const before = { x: u.x, y: u.y };
  for (let i = 0; i < 350; i++) {
    b.time += 0.05;
    b.move(u, { x: 13, y: 7 }, 0.05);
    assert.ok(Math.hypot(u.x - body.x, u.y - body.y) >= 0.6 - 1e-8);
  }
  assert.ok(Math.hypot(u.x - 13, u.y - 7) < 0.1);
});

test("inspection reports actual assignment owner, destination, progress and casualty response", () => {
  const b = fixture();
  prepare(b);
  advance(b, 0.2);
  const u = b.units.find((u) => u.state === "Reacquiring contact");
  assert.ok(u);
  refreshDiagnostics(b, u);
  const fresh = new Battle(seeded(1)).units[0];
  assert.match(
    inspectSoldier(fresh),
    /move never · sight never · engage never/,
  );
  let text = inspectSoldier(u);
  assert.match(text, /Assignment: recon · squad leader/);
  assert.match(text, /Progress:/);
  assert.match(text, /coordination wait no/);
  b.injury(b.units[0], "torso", 100);
  advance(b, 0.7);
  refreshDiagnostics(b, u);
  text = inspectSoldier(u);
  assert.match(text, /Casualty response: Reassessed/);
});

test("coarse search sectors centered on a wall use a static-map observation anchor", () => {
  const b = fixture([1, 10]);
  b.units[1].x = 2;
  b.units[1].y = 3;
  const area = { x: 8, y: 4 };
  assert.equal(blocked(area.x, area.y), true);
  const result = observationPlan(b, b.units[1], area, []);
  assert.ok(result.plan);
  assert.ok(result.plan.route.every(([x, y]) => !blocked(x, y)));
  assert.deepEqual(area, { x: 8, y: 4 });
});

test("an armed medic may recon when other fighters are out of ammo and no casualty care is actionable", () => {
  const b = fixture([4, 5, 10]);
  Object.assign(b.units[4], { x: 13, y: 11, ammo: 0, reserve: 0, reload: 0 });
  Object.assign(b.units[5], { x: 3, y: 11 });
  const before = { x: 3, y: 11 };
  advance(b, 5);
  assert.ok(b.units[5].assignment?.type === "recon" || b.units[5].ammo < 30);
  assert.ok(Math.hypot(b.units[5].x - before.x, b.units[5].y - before.y) > 1);
});

test("rejected rifleman candidates do not permanently starve a reachable acting observer", () => {
  const b = fixture([0, 1, 2, 3, 4, 10]);
  Object.assign(b.units[0], { x: 3, y: 11, reload: 0 });
  Object.assign(b.units[4], { x: 13, y: 11, reload: 10000 });
  for (const [id, x] of [
    [1, 6],
    [2, 7],
    [3, 8],
  ])
    Object.assign(b.units[id], { x, y: 6 });
  const doors = [key(7, 4), key(7, 9)];
  let acted = false;
  try {
    for (const d of doors) obstacles.set(d, "wall");
    for (let i = 0; i < 100; i++) {
      b.step(0.05);
      acted ||= b.units[0].state === "Reacquiring contact";
    }
    assert.ok(acted);
    assert.ok(b.units[0].x > 4);
  } finally {
    for (const d of doors) obstacles.delete(d);
  }
});
