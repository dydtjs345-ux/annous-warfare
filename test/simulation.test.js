import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { cover, sight, path, blocked } from "../src/world.js";
test("squads have required roles and independent ammunition", () => {
  const b = new Battle();
  for (const team of [0, 1]) {
    const squad = b.units.filter((u) => u.team === team);
    assert.equal(squad.length, 6);
    assert.equal(
      squad.filter((u) => ["Leader", "Rifleman"].includes(u.role)).length,
      4,
    );
    assert.equal(squad.filter((u) => u.role === "Medic").length, 1);
    assert.equal(squad.filter((u) => u.role === "LMG").length, 1);
  }
});
test("walls occlude sight, cover is directional, paths avoid obstacles", () => {
  assert.equal(sight({ x: 4, y: 6 }, { x: 8, y: 6 }), false);
  assert.ok(
    cover({ x: 4, y: 6 }, { x: 8, y: 6 }) >
      cover({ x: 4, y: 6 }, { x: 1, y: 6 }),
  );
  const p = path({ x: 2, y: 8 }, { x: 13, y: 8 });
  assert.ok(p.length);
  assert.ok(p.every(([x, y]) => !blocked(x, y)));
});
test("incapacitation ends elimination", () => {
  const b = new Battle();
  for (const u of b.units.filter((u) => u.team === 1)) b.injury(u, "torso", 85);
  b.step(0.05);
  assert.equal(b.result, "USMC victory");
});
test("seeded autonomous battle fires, moves and finishes", () => {
  let seed = 42;
  const b = new Battle(() => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  for (let i = 0; i < 24000 && !b.result; i++) b.step(0.1);
  assert.ok(
    b.units.some(
      (u) => u.ammo < u.mag || u.reserve < (u.role === "LMG" ? 300 : 180),
    ),
  );
  assert.ok(b.units.some((u) => Object.values(u.health).some((h) => h < 100)));
  assert.ok(b.result, "battle should resolve within 40 simulated minutes");
});

test("empty magazines reload from finite reserves", () => {
  const b = new Battle();
  const u = b.units[0];
  u.ammo = 0;
  b.step(0.05);
  assert.ok(u.reload > 0);
  for (let i = 0; i < 60; i++) b.step(0.05);
  assert.ok(u.ammo > 0);
  assert.equal(u.reserve, 150);
});
test("medic treats and restores a nearby incapacitated casualty", () => {
  const b = new Battle();
  const medic = b.units[5],
    patient = b.units[1];
  patient.x = medic.x;
  patient.y = medic.y;
  b.injury(patient, "torso", 85);
  for (let i = 0; i < 100; i++) b.step(0.05);
  assert.ok(patient.health.torso >= 30);
  assert.ok(patient.active);
});

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

test("200 seeds: every soldier leaves spawn and all squad orders remain navigable", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const b = new Battle(seeded(seed));
    const spawn = b.units.map((u) => ({ x: u.x, y: u.y }));
    for (let i = 0; i < 40; i++) b.step(0.05);
    for (const u of b.units)
      assert.ok(
        Math.hypot(u.x - spawn[u.id].x, u.y - spawn[u.id].y) > 0.2,
        `seed ${seed}, unit ${u.id}, ${u.navigation}`,
      );
    // Force a later order refresh: exercises random orders rather than only startup.
    for (const squad of b.squads) squad.timer = 0;
    b.step(0.05);
    for (let team = 0; team < 2; team++) {
      const goal = b.squads[team].goal,
        leader = b.units.find((u) => u.team === team && u.active);
      assert.ok(!blocked(goal.x, goal.y), `seed ${seed}: blocked order`);
      assert.ok(
        path(leader, goal).length ||
          Math.hypot(leader.x - goal.x, leader.y - goal.y) < 1,
        `seed ${seed}: unreachable order`,
      );
    }
  }
});

test("100 seeds: no active soldiers overlap or enter obstacles during battle", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const b = new Battle(seeded(seed));
    for (let i = 0; i < 800 && !b.result; i++) {
      b.step(0.05);
      for (const u of b.units.filter((u) => u.active)) {
        assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y));
        assert.ok(
          !blocked(Math.round(u.x), Math.round(u.y)),
          `seed ${seed}: terrain collision`,
        );
        for (const v of b.units.filter((v) => v.active && v.id > u.id))
          assert.ok(
            Math.hypot(u.x - v.x, u.y - v.y) >= 0.6 - 1e-8,
            `seed ${seed}, step ${i}: ${u.id}/${v.id} overlap`,
          );
      }
    }
  }
});

test("opposing soldiers cannot stack at a shared destination", () => {
  const b = new Battle(seeded(1)),
    a = b.units[0],
    c = b.units[6];
  a.x = 12;
  a.y = 13;
  c.x = 16;
  c.y = 13;
  for (let i = 0; i < 200; i++) {
    b.time += 0.05;
    b.move(a, { x: 14, y: 13 }, 0.05);
    b.move(c, { x: 14, y: 13 }, 0.05);
  }
  assert.ok(Math.hypot(a.x - c.x, a.y - c.y) >= 0.6);
  assert.equal(c.navigation, "Waiting for spacing");
});

test("formation assigns distinct navigable destinations around a common order", () => {
  const b = new Battle(seeded(1));
  const goals = b.units.map((u) => b.formationGoal(u, { x: 14, y: 13 }));
  for (const team of [0, 1])
    assert.equal(
      new Set(goals.slice(team * 6, team * 6 + 6).map((p) => `${p.x},${p.y}`))
        .size,
      6,
    );
  assert.ok(goals.every((p) => !blocked(p.x, p.y)));
});

test("blocked random orders and fractional contact positions resolve to reachable cells", async () => {
  const { reachableGoal } = await import("../src/world.js");
  for (const goal of [
    { x: 5, y: 6 },
    { x: 4, y: 12 },
    { x: 7.4, y: 4.2 },
  ]) {
    const start = { x: 2, y: 8 },
      resolved = reachableGoal(start, goal);
    assert.ok(!blocked(resolved.x, resolved.y));
    assert.ok(path(start, resolved).length);
  }
});

test("collision replan makes progress around a stationary soldier", () => {
  const b = new Battle(seeded(1)),
    u = b.units[0],
    obstacle = b.units[1];
  u.x = 12;
  u.y = 10;
  obstacle.x = 14;
  obstacle.y = 10;
  for (let i = 0; i < 240; i++) {
    b.time += 0.05;
    b.move(u, { x: 16, y: 10 }, 0.05);
  }
  assert.ok(Math.hypot(u.x - 16, u.y - 10) < 0.1);
});

test("holding at an assigned position and reloading are legitimate waits", () => {
  const b = new Battle(seeded(1)),
    u = b.units[0];
  b.move(u, { x: u.x, y: u.y }, 0.05);
  assert.equal(u.navigation, "Arrived");
  u.reload = 1;
  const before = { x: u.x, y: u.y };
  b.step(0.05);
  assert.equal(u.state, "Reloading");
  assert.equal(u.order, "Reload");
  assert.equal(u.x, before.x);
  assert.equal(u.y, before.y);
});

test("movement completes the final fractional step within a rounded goal cell", () => {
  const b = new Battle(seeded(1)),
    u = b.units[0];
  u.x = 12.6;
  u.y = 10;
  for (let i = 0; i < 10; i++) {
    b.time += 0.05;
    b.move(u, { x: 13, y: 10 }, 0.05);
  }
  assert.equal(u.x, 13);
  assert.equal(u.navigation, "Arrived");
});
