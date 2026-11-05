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
