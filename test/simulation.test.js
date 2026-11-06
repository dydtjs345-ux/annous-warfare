import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { cover, sight, path, blocked } from "../src/world.js";
test("squads have required roles and independent ammunition", () => {
  const b = new Battle();
  assert.ok(b.squads.every((s) => s.intention === "Advance"));
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
  updateSquadTactics(b, 0);
  for (let i = 0; i < 16; i++) b.step(0.05);
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

import {
  perceive,
  adoptContact,
  contacts,
  squadThreats,
  reportIncoming,
  selectEnemy,
} from "../src/intelligence.js";
import { inspectSoldier } from "../src/inspection.js";

function sightingFixture() {
  const b = new Battle(seeded(9));
  b.units[0].x = 3;
  b.units[0].y = 11;
  b.units[1].x = 6;
  b.units[1].y = 6;
  b.units[6].x = 9;
  b.units[6].y = 11;
  return b;
}

test("confirmed sightings are instantly available to every living squad member, including casualties", () => {
  const b = sightingFixture(),
    observer = b.units[0],
    recipient = b.units[1];
  recipient.active = false;
  assert.equal(sight(recipient, b.units[6]), false);
  perceive(b);
  assert.equal(observer.intel, recipient.intel);
  const report = recipient.intel.contacts.get(6);
  assert.equal(report.enemyId, 6);
  assert.equal(report.x, 9);
  assert.equal(report.y, 11);
  assert.equal(report.time, 0);
  assert.ok(report.observers.includes(0));
  assert.equal(report.observers.includes(1), false);
  assert.ok(Number.isInteger(report.observedBy));
  assert.equal(b.units[5].intel.contacts.has(6), true);
  assert.equal(recipient.visibleEnemies.length, 0);
});

test("last-known snapshots decay, never follow hidden enemies, and expire", () => {
  const b = sightingFixture();
  perceive(b);
  for (const u of b.units.filter((u) => u.team === 0)) {
    u.x = 2;
    u.y = 5;
  }
  b.units[6].x = 27;
  b.units[6].y = 20;
  b.time = 2;
  perceive(b);
  const contact = contacts(b, 0).find((c) => c.enemyId === 6);
  assert.equal(contact.x, 9);
  assert.equal(contact.y, 11);
  assert.equal(contact.confirmed, false);
  assert.equal(contact.confidence, 0.75);
  b.time = 2.5;
  adoptContact(b, b.units[0]);
  assert.equal(b.units[0].memory.x, 9);
  b.time = 8;
  perceive(b);
  adoptContact(b, b.units[0]);
  assert.equal(contacts(b, 0).length, 0);
  assert.equal(b.units[0].memory, null);
  assert.equal(squadThreats(b, 0).length, 0);
});

test("a visibly empty last-known location is marked cleared without instantly discarding the snapshot", () => {
  const b = sightingFixture();
  perceive(b);
  b.units[6].x = 27;
  b.units[6].y = 20;
  b.time = 0.5;
  perceive(b);
  assert.equal(b.squads[0].intel.contacts.get(6).clearedAt, 0.5);
  assert.equal(b.squads[0].intel.contacts.get(6).time, 0);
});

test("incoming fire shares a coarse direction without an enemy identity or position", () => {
  const b = new Battle(seeded(1)),
    receiver = b.units[0],
    hidden = b.units[6];
  hidden.x = 22;
  hidden.y = 20;
  reportIncoming(b, receiver, hidden);
  const r = b.units[5].intel.incoming.get(receiver.id);
  assert.deepEqual(Object.keys(r).sort(), [
    "bearing",
    "kind",
    "origin",
    "reporterId",
    "time",
  ]);
  assert.equal(r.kind, "direction");
  assert.equal(
    r.bearing / (Math.PI / 4),
    Math.round(r.bearing / (Math.PI / 4)),
  );
  assert.deepEqual(r.origin, { x: receiver.x, y: receiver.y });
  assert.equal(b.squads[0].intel.contacts.size, 0);
  b.time = 1;
  adoptContact(b, b.units[1]);
  assert.equal(b.units[1].memory, null);
  assert.equal(
    b.units[5].alert,
    undefined,
    "distant soldiers receive intel but no forced local reaction",
  );
  assert.ok(b.units[1].alert.readyAt > b.time - 1);
});

test("shared knowledge cannot create a firing solution through walls", () => {
  const b = sightingFixture();
  perceive(b);
  b.time = 0.7;
  const u = b.units[1];
  adoptContact(b, u);
  assert.equal(u.memory.enemyId, 6);
  assert.equal(selectEnemy(b, u, u.visibleEnemies), null);
  assert.equal(sight(u, b.units[6]), false);
});

test("reactions and aiming take time; target assignments stay independent", () => {
  const b = sightingFixture(),
    u = b.units[0];
  perceive(b);
  const target = selectEnemy(b, u, u.visibleEnemies);
  assert.ok(target);
  assert.ok(u.aimAt >= 0.35);
  const ready = u.aimAt;
  b.time = 0.1;
  selectEnemy(b, u, u.visibleEnemies);
  assert.equal(u.aimAt, ready);
  const other = b.units[7];
  other.x = 10;
  other.y = 11;
  u.engagementId = other.id;
  assert.equal(selectEnemy(b, u, [target, other]), other);
  b.units[2].engagementId = target.id;
  assert.equal(selectEnemy(b, b.units[2], [target, other]), target);
  const ammo = u.ammo;
  b.step(0.05);
  assert.equal(u.ammo, ammo);
});

test("incoming fire prompts delayed local support without inventing a contact", () => {
  const b = new Battle(seeded(1)),
    u = b.units[1];
  reportIncoming(b, b.units[0], { x: 20, y: 20 });
  b.step(0.05);
  assert.notEqual(u.state, "Watching reported sector");
  for (let i = 0; i < 12; i++) b.step(0.05);
  assert.ok(
    ["Watching reported sector", "Seeking cover"].includes(u.state),
    u.state,
  );
  assert.equal(u.memory, null);
  assert.equal(b.squads[0].intel.contacts.size, 0);
});

test("casualty reports reach the squad and trigger reassessment and delayed covering", () => {
  const b = new Battle(seeded(1)),
    patient = b.units[1],
    leader = b.units[0];
  b.injury(patient, "torso", 85);
  assert.equal(b.units[5].intel.casualties.has(patient.id), true);
  assert.ok(leader.alert.readyAt > 0);
  assert.ok(b.squads[0].nextTactical <= 0.45);
  for (let i = 0; i < 12; i++) b.step(0.05);
  assert.equal(leader.state, "Covering casualty");
  assert.equal(b.squads[0].intention, "Protect casualty");
});

test("medics cannot treat through house walls", () => {
  const b = new Battle(seeded(1)),
    medic = b.units[5],
    patient = b.units[1];
  medic.x = 4.4;
  medic.y = 6;
  patient.x = 5.6;
  patient.y = 6;
  patient.reload = 10;
  b.injury(patient, "torso", 60);
  assert.equal(sight(medic, patient), false);
  for (let i = 0; i < 24; i++) b.step(0.05);
  assert.equal(patient.health.torso, 40);
  assert.notEqual(medic.state, "Treating");
});

test("treatment progress resets after interruption or changing patients", () => {
  const b = new Battle(seeded(1)),
    medic = b.units[5],
    patient = b.units[1];
  patient.health.torso = 40;
  patient.reload = 10;
  medic.x = patient.x;
  medic.y = patient.y;
  medic.treat = 0.95;
  medic.patientId = patient.id;
  medic.treatmentAt = -5;
  b.step(0.1);
  assert.equal(patient.health.torso, 40);
  assert.equal(medic.treat, 0.1);
  medic.treat = 0.95;
  medic.patientId = 0;
  medic.treatmentAt = b.time;
  b.step(0.1);
  assert.equal(patient.health.torso, 40);
  assert.equal(medic.treat, 0.1);
});

test("flank cooldown applies from assignment and persists after cancellation", () => {
  const b = flankFixture();
  updateSquadTactics(b, 0);
  const s = b.squads[0];
  assert.ok(s.maneuver);
  assert.ok(s.flankCooldown >= b.time + 30);
  s.maneuver.until = b.time;
  b.time += 3;
  for (const u of b.units) if (u.memory) u.memory.time = b.time;
  updateSquadTactics(b, 0);
  assert.equal(s.maneuver, null);
  assert.ok(s.flankCooldown >= b.time + 24);
  assert.equal(planFlank(b, 0, [{ x: 9, y: 11 }]), null);
});

test("the compact inspector displays actual state, objective, suppression and injuries", () => {
  const u = new Battle(seeded(1)).units[0];
  u.state = "Pinned";
  u.order = "Hold under incoming fire";
  u.suppression = 0.73;
  u.health["left arm"] = 42;
  const text = inspectSoldier(u);
  assert.match(text, /Action: Pinned/);
  assert.match(text, /Objective: Hold under incoming fire/);
  assert.match(text, /Suppression 73%/);
  assert.match(text, /LA 42\*/);
  assert.match(text, /Ammo 30\/180/);
});

test("approximate bearings and low-confidence sightings cannot authorize flanks", () => {
  const b = flankFixture();
  assert.equal(planFlank(b, 0, [{ x: 9, y: 11, approximate: true }]), null);
  assert.equal(planFlank(b, 0, [{ x: 9, y: 11, confidence: 0.4 }]), null);
  assert.ok(planFlank(b, 0, [{ x: 9, y: 11, confidence: 1 }]));
});

test("clearing all contacts retains the maneuver cancellation cooldown", () => {
  const b = flankFixture();
  updateSquadTactics(b, 0);
  assert.ok(b.squads[0].maneuver);
  b.time += 10;
  updateSquadTactics(b, 0);
  assert.equal(b.squads[0].maneuver, null);
  assert.ok(b.squads[0].flankCooldown >= b.time + 24);
});

import { refreshDiagnostics, firingStatus } from "../src/diagnostics.js";
import { markObservedFire } from "../src/intelligence.js";
import { obstacles, key } from "../src/world.js";
function isolatedBattle(seed = 1) {
  const b = new Battle(seeded(seed));
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  for (const id of [0, 1, 6]) {
    b.units[id].active = true;
    b.units[id].dead = false;
  }
  Object.assign(b.units[0], { x: 3, y: 11, reload: 1000 });
  Object.assign(b.units[1], { x: 6, y: 6 });
  Object.assign(b.units[6], { x: 9, y: 11, reload: 1000 });
  return b;
}

test("continuous radio refresh cannot indefinitely hold a healthy rifleman without a firing opportunity", () => {
  const b = isolatedBattle();
  b.random = () => 0.99;
  b.squads[0].flankCooldown = 1000;
  let reacquired = false,
    held = 0,
    longestHold = 0;
  for (let i = 0; i < 400; i++) {
    b.step(0.05);
    reacquired ||= b.units[1].state === "Reacquiring contact";
    held = b.units[1].state === "Holding contact" ? held + 0.05 : 0;
    longestHold = Math.max(longestHold, held);
  }
  assert.ok(reacquired);
  assert.ok(b.units[1].ammo < 30);
  assert.ok(longestHold < 3.2, `held ${longestHold}s continuously`);
  assert.equal(b.units[1].suppression, 0);
  assert.equal(b.units[1].health.torso, 100);
});

test("a protected direct firing lane remains stationary and effective without forced movement", () => {
  const b = isolatedBattle();
  b.random = () => 0.99;
  b.units[1].active = false;
  b.units[1].dead = true;
  Object.assign(b.units[0], { x: 3, y: 11, reload: 0 });
  Object.assign(b.units[6], { x: 3, y: 15 });
  for (let i = 0; i < 200; i++) b.step(0.05);
  assert.equal(b.units[0].x, 3);
  assert.equal(b.units[0].y, 11);
  assert.ok(b.units[0].ammo < 30);
  assert.match(b.units[0].diagnostics.decision, /visible firing solution/);
});

test("observed firing survives LOS loss as a frozen, attributed last-known snapshot", () => {
  const b = sightingFixture();
  perceive(b);
  markObservedFire(b, b.units[6]);
  const before = { ...b.squads[0].intel.contacts.get(6) };
  b.units[6].x = 27;
  b.units[6].y = 20;
  b.time = 0.7;
  perceive(b);
  adoptContact(b, b.units[1]);
  const last = b.squads[0].intel.contacts.get(6);
  assert.equal(last.x, before.x);
  assert.equal(last.y, before.y);
  assert.equal(last.firedAt, 0);
  assert.equal(last.observedBy, before.observedBy);
  assert.equal(last.time, 0);
  assert.equal(contacts(b, 0)[0].confirmed, false);
  assert.equal(b.units[1].memory.enemyId, 6);
});

test("contact expiry is configurable and independent of radio consumption", () => {
  const b = new Battle(seeded(1), { contactTTL: 2 });
  Object.assign(b.units[0], { x: 3, y: 11 });
  Object.assign(b.units[6], { x: 9, y: 11 });
  perceive(b);
  for (const u of b.units.filter((u) => !u.team)) {
    u.x = 2;
    u.y = 5;
  }
  Object.assign(b.units[6], { x: 27, y: 20 });
  b.time = 1;
  perceive(b);
  adoptContact(b, b.units[1]);
  assert.equal(contacts(b, 0)[0].confidence, 0.5);
  assert.equal(b.units[1].memory.time, 0);
  b.time = 2;
  perceive(b);
  adoptContact(b, b.units[1]);
  assert.equal(b.units[1].memory, null);
});

test("independent reacquisition updates coordinates, observer and timestamp only on direct observation", () => {
  const b = sightingFixture();
  perceive(b);
  Object.assign(b.units[6], { x: 8, y: 6 });
  b.time = 1;
  perceive(b);
  // The indoor rifleman independently sees the enemy; the outdoor original observer cannot.
  assert.ok(b.units[1].visibleEnemies.some((e) => e.id === 6));
  assert.ok(!b.units[0].visibleEnemies.some((e) => e.id === 6));
  const c = b.squads[0].intel.contacts.get(6);
  assert.equal(c.x, 8);
  assert.equal(c.y, 6);
  assert.equal(c.time, 1);
  assert.ok(c.observers.includes(1));
  adoptContact(b, b.units[0]);
  refreshDiagnostics(b, b.units[0]);
  adoptContact(b, b.units[1]);
  b.units[1].engagementId = 6;
  refreshDiagnostics(b, b.units[1]);
  assert.equal(b.units[0].diagnostics.source, "shared sighting");
  assert.equal(b.units[1].diagnostics.source, "direct sighting");
});

test("out-of-range sticky targets do not exclude a valid in-range enemy", () => {
  const b = new Battle(seeded(1)),
    u = b.units[0],
    far = b.units[6],
    near = b.units[7];
  u.x = 3;
  u.y = 11;
  far.x = 16;
  far.y = 11;
  near.x = 8;
  near.y = 11;
  u.engagementId = far.id;
  assert.equal(selectEnemy(b, u, [far, near]), near);
  u.aimAt = 0;
  u.cooldown = 0;
  assert.equal(firingStatus(b, u, far).reason, "Outside weapon range");
  assert.equal(firingStatus(b, u, near).permitted, true);
});

test("brief LOS flicker preserves acquisition progress, but prolonged loss requires reaiming", () => {
  const b = sightingFixture(),
    u = b.units[0],
    e = b.units[6];
  selectEnemy(b, u, [e]);
  const aim = u.aimAt;
  b.time = 0.1;
  selectEnemy(b, u, []);
  b.time = 0.2;
  selectEnemy(b, u, [e]);
  assert.equal(u.aimAt, aim);
  b.time = 1;
  selectEnemy(b, u, []);
  b.time = 1.1;
  selectEnemy(b, u, [e]);
  assert.ok(u.aimAt > 1.1);
});

test("LOS is symmetric at wall corners across 2000 seeded ray pairs", () => {
  const rng = seeded(19);
  for (let i = 0; i < 2000; i++) {
    const a = { x: 1 + Math.floor(rng() * 28), y: 1 + Math.floor(rng() * 24) },
      b = { x: 1 + Math.floor(rng() * 28), y: 1 + Math.floor(rng() * 24) };
    if (!blocked(a.x, a.y) && !blocked(b.x, b.y))
      assert.equal(sight(a, b), sight(b, a), JSON.stringify({ a, b }));
  }
  assert.equal(
    sight({ x: 6, y: 15 }, { x: 14, y: 5 }),
    sight({ x: 14, y: 5 }, { x: 6, y: 15 }),
  );
});

test("blocked cover assignments release their slot and reject the ineffective goal", () => {
  const b = new Battle(seeded(1)),
    u = b.units[0],
    body = b.units[1];
  u.x = 12;
  u.y = 10;
  body.x = 14;
  body.y = 10;
  u.coverTarget = { x: 14, y: 10 };
  u.nextAssessment = 100;
  let released = false;
  for (let i = 0; i < 200; i++) {
    b.time += 0.05;
    if (!localCover(b, u, [{ x: 17, y: 10 }], 0.05)) {
      released = true;
      break;
    }
  }
  assert.ok(released);
  assert.equal(u.coverTarget, null);
  assert.ok(u.failedGoal);
  assert.equal(u.movementBlocker, "Soldier congestion");
});

test("unreachable terrain objectives fail explicitly instead of silently returning empty paths", () => {
  const b = new Battle(seeded(1)),
    u = b.units[0];
  u.x = 2;
  u.y = 6;
  const doors = [key(7, 4), key(7, 9)];
  try {
    for (const door of doors) obstacles.set(door, "wall");
    assert.equal(b.move(u, { x: 7, y: 6 }, 0.05), false);
    assert.equal(u.movementBlocker, "No terrain route");
    assert.equal(u.navigation, "No route");
    u.failedGoal = null;
    assert.equal(careRouteSafe(b, u, { id: 99, x: 7, y: 6 }), false);
  } finally {
    for (const door of doors) obstacles.delete(door);
  }
  assert.ok(path(u, { x: 7, y: 6 }).length);
});

test("regrouping has entry/exit hysteresis instead of switching objectives at one distance", () => {
  const b = isolatedBattle();
  Object.assign(b.units[0], { x: 2, y: 8 });
  Object.assign(b.units[1], { x: 2, y: 15.2 });
  Object.assign(b.units[6], { x: 27, y: 24 });
  b.step(0.05);
  assert.equal(b.units[1].state, "Regrouping");
  Object.assign(b.units[1], { x: 2, y: 13.5 });
  b.step(0.05);
  assert.equal(b.units[1].state, "Regrouping");
  Object.assign(b.units[1], { x: 2, y: 11.8 });
  b.step(0.05);
  assert.notEqual(b.units[1].state, "Regrouping");
});

test("five seeded last-enemy searches reacquire a wall-hidden survivor without knowing its position", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const b = isolatedBattle(seed);
    b.units[1].active = false;
    b.units[1].dead = true;
    Object.assign(b.units[0], { x: 4, y: 6, reload: 0 });
    Object.assign(b.units[6], { x: 8, y: 6, reload: 10000 });
    assert.equal(sight(b.units[0], b.units[6]), false);
    assert.equal(contacts(b, 0).length, 0);
    for (let i = 0; i < 12000 && !b.result; i++) b.step(0.1);
    assert.equal(b.result, "USMC victory", `seed ${seed}`);
  }
});

test("genuine ammunition stalemates remain possible and expose their reason", () => {
  const b = isolatedBattle();
  b.units[1].active = false;
  b.units[1].dead = true;
  for (const u of b.units.filter((u) => u.active)) {
    u.reload = 0;
    u.ammo = 0;
    u.reserve = 0;
  }
  for (let i = 0; i < 200; i++) b.step(0.05);
  assert.equal(b.result, null);
  assert.equal(b.units[0].diagnostics.stalemate, "No ammunition");
  assert.match(inspectSoldier(b.units[0]), /Ammunition exhausted/);
});

test("unsafe/unreachable reacquisition is diagnosed rather than forcing a charge", () => {
  const b = isolatedBattle();
  const doors = [key(7, 4), key(7, 9)];
  try {
    for (const door of doors) obstacles.set(door, "wall");
    for (let i = 0; i < 300; i++) b.step(0.05);
    assert.equal(b.units[1].state, "Observing contact");
    assert.match(b.units[1].diagnostics.decision, /No safe reachable/);
    assert.equal(
      b.units[1].diagnostics.stalemate,
      "No safe reacquisition route",
    );
  } finally {
    for (const door of doors) obstacles.delete(door);
  }
});

test("inspection never substitutes a hidden enemy location for the known snapshot", () => {
  const b = sightingFixture();
  perceive(b);
  for (const u of b.units.filter((u) => !u.team)) {
    u.x = 2;
    u.y = 5;
  }
  Object.assign(b.units[6], { x: 27, y: 20 });
  b.time = 1;
  perceive(b);
  adoptContact(b, b.units[1]);
  refreshDiagnostics(b, b.units[1]);
  const u = b.units[1],
    expected = Math.hypot(u.x - 9, u.y - 11);
  assert.equal(u.diagnostics.targetDistance, expected);
  assert.equal(u.diagnostics.distanceEstimated, true);
  assert.equal(u.diagnostics.directLOS, false);
  const before = inspectSoldier(u);
  Object.assign(b.units[6], { x: 23, y: 21 });
  refreshDiagnostics(b, u);
  assert.equal(inspectSoldier(u), before);
  assert.match(before, /last-known position/);
  assert.match(before, /Direct LOS: no/);
  assert.match(before, /Last confirmed: 1.0s/);
  assert.match(before, /No injuries/);
  assert.ok(!before.includes("(* injured)"));
});

import { planningCellFree } from "../src/tactics.js";
test("tactical destinations use reported snapshots instead of hidden physical enemy positions", () => {
  const b = new Battle(seeded(1)),
    u = b.units[0],
    enemy = b.units[6];
  u.x = 4;
  u.y = 6;
  enemy.x = 8;
  enemy.y = 6;
  assert.equal(sight(u, enemy), false);
  assert.equal(b.spaceFree(u, { x: 8, y: 6 }), false);
  assert.equal(planningCellFree(b, u, { x: 8, y: 6 }), true);
  u.intel.contacts.set(enemy.id, {
    enemyId: enemy.id,
    x: 8,
    y: 6,
    time: b.time,
  });
  enemy.x = 9;
  assert.equal(planningCellFree(b, u, { x: 8, y: 6 }), false);
  assert.equal(planningCellFree(b, u, { x: 9, y: 6 }), true);
});

test("both sides in strong directional cover can finish without forced relocation", () => {
  for (let seed = 1; seed <= 3; seed++) {
    const b = isolatedBattle(seed);
    b.units[1].active = false;
    b.units[1].dead = true;
    Object.assign(b.units[0], { x: 3, y: 11, reload: 0 });
    Object.assign(b.units[6], { x: 3, y: 15, reload: 0 });
    assert.equal(cover(b.units[0], b.units[6]), 0.58);
    assert.equal(cover(b.units[6], b.units[0]), 0.58);
    for (let i = 0; i < 18000 && !b.result; i++) b.step(0.1);
    assert.ok(b.result, `seed ${seed}`);
  }
});
