import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { localCover } from "../src/tactics.js";
import { choosePatient } from "../src/medical.js";
import { coordinateSquad } from "../src/coordination.js";
function care() {
  const b = new Battle(() => 0.99);
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  const m = b.units[5],
    p = b.units[0],
    e = b.units[6];
  for (const u of [m, p, e]) Object.assign(u, { active: true, dead: false });
  Object.assign(m, { x: 3, y: 11 });
  Object.assign(p, { x: 4, y: 11 });
  Object.assign(e, { x: 3, y: 15, reload: 1000 });
  p.health["left arm"] = 40;
  return { b, m, p, e };
}
test("a useful in-flight cover journey is not readmitted against a newly full movement budget", () => {
  const b = new Battle(() => 0.99),
    u = b.units[0];
  Object.assign(u, { x: 3, y: 11 });
  const t = [{ x: 9, y: 11 }];
  localCover(b, u, t, 0.05);
  const target = { ...u.coverTarget };
  assert.ok(u.coverTarget);
  for (const [id, x] of [
    [1, 15],
    [2, 17],
  ])
    Object.assign(b.units[id], { x, y: 11, coverTarget: { x, y: 13 } });
  u.coverUntil = -1;
  u.nextAssessment = 0;
  b.time = 0.1;
  localCover(b, u, t, 0.05);
  assert.deepEqual(u.coverTarget, target);
  assert.equal(u.coverEvaluation.blockedBy, null);
  assert.match(u.coverEvaluation.reason, /Retain useful/);
});
test("an unsafe committed endpoint can be replaced immediately after a flank", () => {
  const b = new Battle(() => 0.99),
    u = b.units[0];
  Object.assign(u, { x: 3, y: 11 });
  localCover(b, u, [{ x: 9, y: 11 }], 0.05);
  const target = { ...u.coverTarget };
  u.suppression = 0.8;
  b.time = 0.1;
  localCover(b, u, [{ x: 1, y: 13 }], 0.05);
  assert.notDeepEqual(u.coverTarget, target);
});
test("protected nearby care can proceed under visible contact without altering heal speed", () => {
  const { b, m, p, e } = care();
  for (let i = 0; i < 20 && !m.presentation.treating; i++) b.step(0.05);
  for (let i = 0; i < 17; i++) b.step(0.05);
  assert.equal(p.health["left arm"], 40);
  for (let i = 0; i < 5; i++) b.step(0.05);
  assert.ok(m.visibleEnemies.length);
  assert.ok(p.health["left arm"] >= 48);
  assert.ok(b.events.some((ev) => ev.type === "treatmentTick"));
});
test("exposed or heavily pressured medics retain combat/survival priority", () => {
  for (const pressure of [false, true]) {
    const { b, m, p, e } = care();
    if (pressure) m.suppression = 0.6;
    else {
      Object.assign(e, { x: 9, y: 11 });
    }
    for (let i = 0; i < 12; i++) b.step(0.05);
    assert.equal(p.health["left arm"], 40);
    assert.notEqual(m.state, "Treating");
  }
});
test("active care pauses patient travel but preserves its squad assignment and firing ability", () => {
  const { b, m, p, e } = care();
  Object.assign(m, { state: "Treating", patientId: p.id, treatmentAt: 0 });
  p.assignment = { type: "recon", target: { x: 14, y: 11 } };
  const a = p.assignment;
  const x = p.x;
  assert.equal(b.move(p, { x: 13, y: 11 }, 0.05), true);
  assert.equal(p.x, x);
  assert.equal(p.assignment, a);
  assert.match(p.navigation, /Receiving treatment/);
  // Immediate exposed danger releases the hold.
  Object.assign(e, { x: 9, y: 11 });
  p.intel.contacts.set(e.id, { enemyId: e.id, x: e.x, y: e.y, time: 0 });
  b.move(p, { x: 3, y: 11 }, 0.05);
  assert.notEqual(p.x, x);
});
test("treatment follow-up is stable for a willing moving patient and continues real covered firing", () => {
  const { b, m, p, e } = care();
  p.health["left arm"] = 20;
  for (let i = 0; i < 70; i++) b.step(0.05);
  assert.ok(p.health["left arm"] >= 36);
  assert.ok(p.ammo < 30);
  assert.ok(m.presentation.treating || p.health["left arm"] >= 65);
});
test("safe treatment keeps its patient unless a new incapacitated casualty needs priority", () => {
  const { b, m, p } = care();
  m.patientId = p.id;
  const q = b.units[1];
  Object.assign(q, { active: true, dead: false, x: 3.1, y: 11 });
  q.health["left arm"] = 40;
  assert.equal(choosePatient(b, m, null), p);
  q.active = false;
  q.health.torso = 20;
  assert.equal(choosePatient(b, m, null), q);
});
test("medics request and receive leader reassignment instead of abandoning recon", () => {
  const { b, m, p, e } = care();
  e.active = false;
  e.dead = true;
  m.assignment = {
    type: "recon",
    unitId: m.id,
    until: 20,
    target: { x: 12, y: 11 },
    route: [],
    area: { x: 12, y: 11 },
    at: 0,
  };
  b.squads[0].assignments = new Map([[m.id, m.assignment]]);
  b.squads[0].intel.contacts.set(6, { enemyId: 6, x: 20, y: 11, time: 0 });
  assert.equal(choosePatient(b, m, null), null);
  assert.equal(m.assignment.type, "recon");
  coordinateSquad(b, 0);
  assert.equal(m.assignment.type, "care");
  assert.equal(choosePatient(b, m, null), p);
});

test("an approaching medic can abandon a distant moving patient for meaningfully nearer safe care", () => {
  const { b, m, p, e } = care();
  e.active = false;
  e.dead = true;
  Object.assign(p, { x: 12, y: 11 });
  m.patientId = p.id;
  const q = b.units[1];
  Object.assign(q, { active: true, dead: false, x: 4, y: 11 });
  q.health["left arm"] = 40;
  assert.equal(choosePatient(b, m, null), q);
});

test("a medic with no casualty care needed retains normal autonomous combat", () => {
  const { b, m, p } = care();
  for (const part in p.health) p.health[part] = 100;
  for (let i = 0; i < 40; i++) b.step(0.05);
  assert.ok(m.ammo < 30);
  assert.notEqual(m.state, "Treating");
  assert.ok(m.activity.engaging > 0);
});
