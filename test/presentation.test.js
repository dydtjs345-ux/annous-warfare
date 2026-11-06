import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { CombatVisuals } from "../src/combat-visuals.js";
import {
  ACTIVITY_KEYS,
  activityKind,
  beginPresentationStep,
  finishPresentationStep,
} from "../src/presentation-state.js";
import { inspectSoldier } from "../src/inspection.js";
const seeded = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
function duel() {
  const b = new Battle(() => 0.99);
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  for (const id of [0, 6]) {
    b.units[id].active = true;
    b.units[id].dead = false;
  }
  Object.assign(b.units[0], { x: 3, y: 11 });
  Object.assign(b.units[6], { x: 3, y: 15, reload: 10000 });
  return b;
}
function view(b) {
  const v = new CombatVisuals();
  v.update(b, 0, 1, false);
  return v;
}

test("engagement labels alone never create firing flashes or recoil", () => {
  const b = duel(),
    u = b.units[0];
  u.state = "Engaging";
  const v = view(b);
  assert.equal(v.models[0].flash, false);
  assert.notEqual(v.models[0].pose, "firing");
  assert.equal(b.events.length, 0);
});

test("real ammunition expenditure emits one shot and drives a short firing effect", () => {
  const b = duel(),
    u = b.units[0],
    v = view(b);
  for (let i = 0; i < 30 && !b.events.some((e) => e.type === "shot"); i++)
    b.step(0.05);
  const shots = b.events.filter((e) => e.type === "shot" && e.unitId === 0);
  assert.equal(shots.length, 1);
  assert.equal(u.ammo, 29);
  v.update(b, 0.016, 1, false);
  assert.equal(v.models[0].flash, true);
  assert.equal(v.effects[0].angle, shots[0].angle);
  v.update(b, 0.1, 1, false);
  assert.equal(v.models[0].flash, false);
  assert.notEqual(v.models[0].pose, "firing");
});

test("rifle and LMG firing cadences remain simulation-driven", () => {
  const times = [];
  for (const role of ["Rifleman", "LMG"]) {
    const b = duel(),
      u = b.units[0];
    u.role = role;
    const seen = new Set(),
      t = [];
    for (let i = 0; i < 80; i++) {
      b.step(0.05);
      for (const e of b.events)
        if (e.type === "shot" && e.unitId === 0 && !seen.has(e.id)) {
          seen.add(e.id);
          t.push(e.time);
        }
    }
    assert.ok(t.length > 2);
    times.push(t[1] - t[0]);
  }
  assert.ok(Math.abs(times[0] - 0.65) < 0.051);
  assert.ok(Math.abs(times[1] - 0.2) < 0.051);
  assert.ok(times[1] < times[0]);
});

test("reload animation and progress correspond to the actual reload interval", () => {
  const b = duel(),
    u = b.units[0];
  u.ammo = 0;
  b.step(0.05);
  const v = view(b);
  assert.equal(v.models[0].pose, "reloading");
  assert.equal(u.reload, 2.6);
  assert.equal(v.models[0].reloadProgress, 0);
  assert.equal(v.models[0].flash, false);
  for (let i = 0; i < 13; i++) b.step(0.05);
  v.update(b, 0.016, 1, false);
  assert.ok(Math.abs(v.models[0].reloadProgress - 0.25) < 1e-6);
  for (let i = 0; i < 45; i++) b.step(0.05);
  v.update(b, 0.016, 1, false);
  assert.notEqual(v.models[0].pose, "reloading");
  assert.ok(u.ammo > 0);
  assert.equal(u.reserve, 150);
});

test("queued or blocked routes do not produce fake walking", () => {
  const b = duel(),
    u = b.units[0];
  beginPresentationStep(b);
  u.state = "Seeking cover";
  u.route = [[9, 11]];
  b.time += 0.05;
  finishPresentationStep(b, 0.05);
  const v = view(b);
  assert.equal(v.models[0].moving, false);
  assert.notEqual(v.models[0].pose, "seekingCover");
  beginPresentationStep(b);
  u.x += 0.08;
  b.time += 0.05;
  finishPresentationStep(b, 0.05);
  v.update(b, 0.016, 1, false);
  assert.equal(v.models[0].moving, true);
  assert.equal(v.models[0].pose, "seekingCover");
});

test("cover postures require real directional protection against a known lane", () => {
  const b = duel(),
    u = b.units[0];
  Object.assign(b.units[6], { x: 9, y: 11 });
  b.step(0.05);
  const v = view(b);
  assert.equal(v.models[0].covered, false);
  Object.assign(b.units[6], { x: 3, y: 15 });
  b.step(0.05);
  v.update(b, 0.016, 1, false);
  assert.equal(v.models[0].covered, true);
  assert.ok(u.presentation.protection >= 0.28);
});

test("suppression and leg injuries produce distinct restrained visual modifiers", () => {
  const b = duel(),
    u = b.units[0];
  u.suppression = 0.9;
  const v = view(b);
  assert.equal(v.models[0].suppressed, true);
  assert.equal(v.models[0].pose, "suppressed");
  u.health["left leg"] = 40;
  u.health["right leg"] = 40;
  beginPresentationStep(b);
  u.x += 0.03;
  b.time += 0.05;
  finishPresentationStep(b, 0.05);
  v.update(b, 0.016, 1, false);
  assert.equal(v.models[0].pose, "limping");
  assert.equal(v.models[0].injured, true);
});

test("medic kneeling and completion feedback match actual treatment and healing", () => {
  const b = new Battle(() => 0.99);
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  for (const id of [1, 5, 6]) {
    b.units[id].active = true;
    b.units[id].dead = false;
  }
  const m = b.units[5],
    p = b.units[1];
  Object.assign(p, { x: 2, y: 9, reload: 10000 });
  Object.assign(m, { x: 2, y: 9.8 });
  Object.assign(b.units[6], { x: 27, y: 24, reload: 10000 });
  b.injury(p, "torso", 36);
  const v = view(b);
  let treating = false,
    complete = false;
  for (let i = 0; i < 80; i++) {
    b.step(0.05);
    v.update(b, 0.016, 1, false);
    if (m.state === "Treating") {
      treating = true;
      assert.equal(v.models[5].pose, "treating");
      assert.equal(m.treatmentAt, b.time);
    }
    if (b.events.some((e) => e.type === "treatmentComplete")) {
      complete = true;
      break;
    }
  }
  assert.ok(treating && complete);
  assert.equal(p.health.torso, 72);
  assert.ok(v.effects[1].heal > 0);
  assert.ok(v.effects[1].complete > 0);
  const tick = b.events.find((e) => e.type === "treatmentTick");
  assert.equal(tick.restored, 8);
  assert.equal(tick.patientId, 1);
  m.reload = 0.2;
  b.step(0.05);
  v.update(b, 0.016, 1, false);
  assert.notEqual(v.models[5].pose, "treating");
});

test("incapacitation and death override pending firing or movement animations", () => {
  const b = duel();
  for (let i = 0; i < 20 && !b.events.some((e) => e.type === "shot"); i++)
    b.step(0.05);
  const v = view(b);
  assert.equal(v.models[0].flash, true);
  b.injury(b.units[0], "torso", 85);
  v.update(b, 0.016, 1, false);
  assert.equal(v.models[0].pose, "incapacitated");
  assert.equal(v.models[0].combat, false);
  assert.equal(v.models[0].flash, false);
  b.injury(b.units[0], "head", 100);
  v.update(b, 0.016, 1, false);
  assert.equal(v.models[0].pose, "dead");
  assert.equal(v.models[0].flash, false);
  assert.equal(v.models[0].combat, false);
});

test("activity priorities are mutually exclusive even when movement and combat overlap", () => {
  const u = new Battle().units[0],
    p = u.presentation;
  Object.assign(p, {
    treating: true,
    reloading: true,
    shotThisStep: true,
    moving: true,
  });
  assert.equal(activityKind(u), "treating");
  p.treating = false;
  assert.equal(activityKind(u), "reloading");
  p.reloading = false;
  assert.equal(activityKind(u), "engaging");
  p.shotThisStep = false;
  u.state = "Reacquiring contact";
  assert.equal(activityKind(u), "searching");
  u.state = "Seeking cover";
  assert.equal(activityKind(u), "moving");
});

test("activity counters partition active time without double counting across five seeds", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const b = new Battle(seeded(seed));
    for (let i = 0; i < 600 && !b.result; i++) b.step(0.05);
    for (const u of b.units) {
      const a = u.activity;
      assert.ok(
        Math.abs(ACTIVITY_KEYS.reduce((n, k) => n + a[k], 0) - a.total) < 1e-7,
      );
      assert.ok(
        Math.abs(a.contribution + a.preparation + a.passive - a.total) < 1e-7,
      );
      assert.ok(a.total <= b.time + 1e-7);
    }
  }
});

test("observing/waiting is not automatically useful contribution", () => {
  const b = duel(),
    u = b.units[0];
  beginPresentationStep(b);
  u.state = "Observing contact";
  b.time += 0.05;
  finishPresentationStep(b, 0.05);
  assert.equal(u.activity.waiting, 0.05);
  assert.equal(u.activity.passive, 0.05);
  assert.equal(u.activity.contribution, 0);
  beginPresentationStep(b);
  u.x += 0.08;
  u.state = "Reacquiring contact";
  b.time += 0.05;
  finishPresentationStep(b, 0.05);
  assert.equal(u.activity.preparation, 0.05);
  assert.equal(u.activity.contribution, 0);
  assert.equal(u.activity.searching, 0.05);
});

test("rendering is read-only, pauses freeze effects and restart resets their identity", () => {
  const b = duel();
  for (let i = 0; i < 20 && !b.events.some((e) => e.type === "shot"); i++)
    b.step(0.05);
  const v = view(b),
    u = b.units[0];
  const before = JSON.stringify({
    x: u.x,
    y: u.y,
    h: u.health,
    a: u.ammo,
    r: u.reload,
    activity: u.activity,
  });
  const life = v.effects[0].shot;
  for (let i = 0; i < 10; i++) v.update(b, 0.1, 4, true);
  assert.equal(v.effects[0].shot, life);
  assert.equal(
    JSON.stringify({
      x: u.x,
      y: u.y,
      h: u.health,
      a: u.ammo,
      r: u.reload,
      activity: u.activity,
    }),
    before,
  );
  v.update(new Battle(seeded(1)), 0.016, 1, false);
  assert.equal(v.effects[0].shot, 0);
  assert.equal(v.lastEvent, 0);
});

test("1x/2x/4x render grouping leaves simulation, activity and elapsed effects consistent", () => {
  const results = [];
  for (const speed of [1, 2, 4]) {
    const b = new Battle(seeded(24)),
      v = view(b);
    for (let frame = 0; frame < 100 / speed; frame++) {
      for (let i = 0; i < speed; i++) b.step(0.05);
      v.update(b, 0.05, speed, false);
    }
    results.push(
      b.units.map((u) => ({
        x: u.x,
        y: u.y,
        ammo: u.ammo,
        health: u.health,
        activity: u.activity,
      })),
    );
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], results[2]);
});

test("match completion stops activity totals and does not leave ghost walking", () => {
  const b = duel();
  b.injury(b.units[6], "torso", 100);
  b.step(0.05);
  const totals = b.units.map((u) => u.activity.total);
  for (let i = 0; i < 20; i++) b.step(0.05);
  assert.deepEqual(
    b.units.map((u) => u.activity.total),
    totals,
  );
  const v = view(b);
  assert.equal(v.models[0].moving, false);
});

test("inspector exposes cumulative activity and preparation/passive distinctions", () => {
  const b = new Battle(seeded(1));
  b.step(0.05);
  const text = inspectSoldier(b.units[0]);
  assert.match(text, /Activity \(exclusive active time/);
  assert.match(
    text,
    /engage .*recon .*move .*cover .*treat .*reload .*observe\/wait/,
  );
  assert.match(text, /Contribution .*preparation .*passive waiting/);
});

test("gait transitions do not flicker at short grid-end steps and stop on actual rest", () => {
  const b = duel(),
    u = b.units[0],
    v = view(b);
  u.state = "Patrolling";
  for (const speed of [1.7, 0.15, 1.7]) {
    beginPresentationStep(b);
    u.x += speed * 0.05;
    b.time += 0.05;
    finishPresentationStep(b, 0.05);
    v.update(b, 0.016, 1, false);
    assert.equal(v.models[0].pose, "running");
  }
  beginPresentationStep(b);
  b.time += 0.05;
  finishPresentationStep(b, 0.05);
  v.update(b, 0.016, 1, false);
  assert.equal(v.models[0].moving, false);
  assert.notEqual(v.models[0].pose, "running");
});
