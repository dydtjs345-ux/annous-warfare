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

// Tactical v0.2 regressions use known contacts; no enemy knowledge is injected by
// the tactical planner itself.
import {
  accuracyFactor,
  incomingFire,
  decaySuppression,
  chooseCover,
  positionScore,
  planFlank,
  routeRisk,
  updateSquadTactics,
  localCover,
  followManeuver,
  careRouteSafe,
} from "../src/tactics.js";

test("incoming misses suppress nearby enemies, respect walls, decay, and reduce accuracy", () => {
  const b = new Battle(seeded(1)),
    shooter = b.units[0],
    target = b.units[6],
    near = b.units[7],
    hidden = b.units[8];
  Object.assign(shooter, { x: 3, y: 11 });
  Object.assign(target, { x: 9, y: 11 });
  Object.assign(near, { x: 8, y: 10.5 });
  Object.assign(hidden, { x: 8, y: 6 });
  incomingFire(b, shooter, target);
  assert.ok(target.suppression > 0);
  assert.ok(near.suppression > 0);
  assert.equal(hidden.suppression, 0);
  assert.ok(accuracyFactor(target) < 1);
  const first = target.suppression;
  decaySuppression(target, 0.5);
  assert.ok(target.suppression < first);
  decaySuppression(target, 100);
  assert.equal(target.suppression, 0);
  shooter.role = "LMG";
  incomingFire(b, shooter, target);
  assert.ok(target.suppression > first);
});

test("cover selection improves score, is reachable, and holds advantageous cover", () => {
  const b = new Battle(seeded(1)),
    u = b.units[0],
    threats = [{ x: 9, y: 11 }];
  u.x = 3;
  u.y = 11;
  const selected = chooseCover(b, u, threats);
  assert.ok(selected);
  assert.ok(path(u, selected).length);
  assert.ok(
    positionScore(u, selected, threats) > positionScore(u, u, threats) + 0.65,
  );
  Object.assign(u, selected);
  assert.equal(chooseCover(b, u, threats), null);
});

function flankFixture() {
  const b = new Battle(seeded(4));
  b.time = 20;
  b.squads[0].lastProgress = 0;
  // Spread the support element in the western yard, behind the low wall.
  const positions = [
    [2, 11],
    [3, 10],
    [3, 11],
    [2, 10],
    [4, 11],
    [2, 9],
  ];
  for (const [i, u] of b.units.filter((u) => u.team === 0).entries()) {
    [u.x, u.y] = positions[i];
    u.memory = { x: 9, y: 11, time: 20 };
  }
  return b;
}

test("flanks require pressure or stalled progress, safe access and covering fire", () => {
  const b = flankFixture(),
    threats = [{ x: 9, y: 11 }];
  const m = planFlank(b, 0, threats);
  assert.ok(m);
  const u = b.units[m.unitId];
  assert.equal(u.role, "Rifleman");
  const risk = routeRisk(path(u, m.target), threats);
  assert.ok(risk.average <= 0.6);
  assert.ok(risk.longest <= 3);
  b.squads[0].lastProgress = b.time;
  assert.equal(planFlank(b, 0, threats), null);
  b.units[0].suppression = 0.6;
  b.units[1].suppression = 0.6;
  assert.ok(planFlank(b, 0, threats));
  for (const u of b.units.filter((u) => u.team === 0)) u.ammo = 0;
  assert.equal(planFlank(b, 0, threats), null);
});

test("no flank without a leader, contacts, or a protected route; medics never flank", () => {
  const b = flankFixture();
  assert.equal(planFlank(b, 0, []), null);
  b.units[0].active = false;
  assert.equal(planFlank(b, 0, [{ x: 9, y: 11 }]), null);
  b.units[0].active = true;
  for (const u of b.units.filter((u) => u.team === 0)) {
    u.x = 13;
    u.y = 7;
  }
  assert.equal(planFlank(b, 0, [{ x: 16, y: 7 }]), null);
});

test("maneuver orders remain committed, expire, and use only recent squad sightings", () => {
  const b = flankFixture();
  updateSquadTactics(b, 0);
  const m = b.squads[0].maneuver;
  assert.ok(m);
  b.time += 3;
  for (const u of b.units) if (u.memory) u.memory.time = b.time;
  updateSquadTactics(b, 0);
  assert.equal(b.squads[0].maneuver, m);
  b.time += 20;
  updateSquadTactics(b, 0);
  assert.equal(b.squads[0].maneuver, null);
  assert.equal(b.squads[0].intention, "Advance");
});

test("local cover choices do not jitter and leave a support element stationary", () => {
  const b = flankFixture(),
    threats = [{ x: 9, y: 11 }],
    u = b.units[0];
  localCover(b, u, threats, 0.05);
  const selected = u.coverTarget;
  assert.ok(selected);
  for (let i = 0; i < 30; i++) {
    b.time += 0.05;
    localCover(b, u, threats, 0.05);
    if (u.coverTarget) assert.deepEqual(u.coverTarget, selected);
    else assert.ok(Math.hypot(u.x - selected.x, u.y - selected.y) < 0.2);
  }
  for (const a of b.units.filter((a) => a.team === 0))
    localCover(b, a, threats, 0.05);
  assert.ok(b.units.filter((a) => a.team === 0 && a.coverTarget).length <= 2);
});

test("30 seeded tactical battles complete with finite suppression and separated soldiers", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const b = new Battle(seeded(seed));
    for (let i = 0; i < 18000 && !b.result; i++) {
      b.step(0.1);
      for (const u of b.units) {
        assert.ok(u.suppression >= 0 && u.suppression <= 1);
        for (const v of b.units)
          if (u.active && v.active && u.id < v.id)
            assert.ok(Math.hypot(u.x - v.x, u.y - v.y) >= 0.6 - 1e-8);
      }
    }
    assert.ok(b.result, `seed ${seed}: did not finish in 30 simulated minutes`);
  }
});

test("committed maneuvers abort when suppressive support is lost", () => {
  const b = flankFixture();
  updateSquadTactics(b, 0);
  const m = b.squads[0].maneuver,
    u = b.units[m.unitId];
  for (const a of b.units.filter((a) => a.team === 0 && a !== u)) a.ammo = 0;
  assert.equal(followManeuver(b, u, m, 0.05), false);
  assert.equal(m.until, b.time);
});

test("a covering element fires while only a minority reposition", () => {
  const b = flankFixture();
  b.random = () => 0.99;
  b.units[6].x = 9;
  b.units[6].y = 11;
  const before = b.units.map((u) => ({ x: u.x, y: u.y, ammo: u.ammo }));
  b.step(0.05);
  assert.ok(b.squads[0].maneuver);
  assert.ok(
    b.units.filter((u) => u.team === 0 && u.ammo < before[u.id].ammo).length >=
      2,
  );
  assert.ok(
    b.units.filter(
      (u) => u.team === 0 && (u.x !== before[u.id].x || u.y !== before[u.id].y),
    ).length <= 3,
  );
  assert.equal(b.units[5].role, "Medic");
  assert.notEqual(b.squads[0].maneuver.unitId, 5);
});

test("medics reject exposed casualty routes under known threats", () => {
  const b = new Battle(seeded(1)),
    medic = b.units[5],
    patient = b.units[1];
  medic.x = 13;
  medic.y = 7;
  patient.x = 17;
  patient.y = 7;
  medic.memory = { x: 16, y: 7, time: b.time };
  assert.equal(careRouteSafe(b, medic, patient), false);
  medic.memory = null;
  assert.equal(careRouteSafe(b, medic, patient), true);
});

test("pressure prevents blind exposure even without a located threat", () => {
  const b = new Battle(seeded(1)),
    u = b.units[0];
  u.suppression = 1;
  const p = { x: u.x, y: u.y };
  b.step(0.05);
  assert.equal(u.state, "Pinned");
  assert.equal(u.x, p.x);
  assert.equal(u.y, p.y);
});
