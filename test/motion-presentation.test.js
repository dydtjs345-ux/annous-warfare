import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { CombatVisuals } from "../src/combat-visuals.js";
import { MotionPresentation, angleDelta } from "../src/motion-presentation.js";
function fixture() {
  const b = new Battle(() => 0.99),
    v = new CombatVisuals(),
    motion = new MotionPresentation();
  v.update(b, 0, 1, false);
  motion.ensure(b);
  return { b, v, motion, u: b.units[0] };
}
const update = (f, a = 0.5, dt = 1 / 60, speed = 1, paused = false) =>
  f.motion.update(f.b, f.v.models, a, dt, speed, paused);
test("linear tick positions interpolate without extrapolation or soldier writes", () => {
  const f = fixture();
  f.motion.beforeStep(f.b);
  f.u.x += 0.08;
  const before = JSON.stringify(f.u);
  for (const alpha of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    update(f, alpha);
    assert.ok(
      Math.abs(f.motion.position(f.u).x - (f.u.x - 0.08 + 0.08 * alpha)) < 1e-9,
    );
  }
  assert.equal(JSON.stringify(f.u), before);
});
test("shortest-angle motion crosses the wrap boundary rather than rotating backward", () => {
  const f = fixture();
  f.motion.records[0].direction = (179 * Math.PI) / 180;
  f.v.models[0].direction = (-179 * Math.PI) / 180;
  update(f);
  assert.ok(
    angleDelta((179 * Math.PI) / 180, f.v.models[0].renderDirection) > 0,
  );
  assert.ok(
    Math.abs(
      angleDelta(f.v.models[0].renderDirection, (-179 * Math.PI) / 180),
    ) <
      (2 * Math.PI) / 180,
  );
});
test("stationary scan turns settle and hold without invented scan targets", () => {
  const f = fixture();
  f.u.observationHeading = Math.PI / 2;
  let previous = 0;
  for (let i = 0; i < 90; i++) {
    update(f);
    const a = f.motion.position(f.u).observationHeading;
    assert.ok(a >= previous - 1e-8);
    previous = a;
  }
  assert.ok(Math.abs(previous - Math.PI / 2) < 1e-7);
});
test("pause freezes world-space pose across alpha and speed changes", () => {
  const f = fixture();
  f.motion.beforeStep(f.b);
  f.u.x += 0.08;
  update(f, 0.2);
  const before = JSON.stringify(f.motion.position(f.u));
  update(f, 0.9, 0.1, 4, true);
  assert.equal(JSON.stringify(f.motion.position(f.u)), before);
});
test("real firing forces exact shot direction and full concealment tucks immediately", () => {
  const f = fixture();
  f.v.models[0].flash = true;
  f.v.models[0].direction = 2;
  update(f);
  assert.equal(f.v.models[0].renderDirection, 2);
  f.v.models[0].flash = false;
  f.v.models[0].tucked = true;
  update(f);
  assert.equal(f.v.models[0].renderTop, -9);
  assert.equal(f.v.models[0].renderHandHeight, -4);
});
test("incapacitation and teleport boundaries do not slide", () => {
  const f = fixture();
  f.motion.beforeStep(f.b);
  f.u.x += 2;
  update(f, 0.1);
  assert.equal(f.motion.position(f.u).x, f.u.x);
  f.motion.beforeStep(f.b);
  f.u.x += 0.08;
  f.u.active = false;
  update(f, 0.1);
  assert.equal(f.motion.position(f.u).x, f.u.x);
  assert.equal(f.v.models[0].renderTop, undefined);
});
test("restart discards prior-unit interpolation buffers", () => {
  const f = fixture();
  f.motion.records[0].x = 999;
  const b = new Battle(() => 0.5);
  f.motion.ensure(b);
  assert.equal(f.motion.position(b.units[0]).x, b.units[0].x);
  assert.equal(
    Object.getPrototypeOf(f.motion.position(b.units[0])),
    b.units[0],
  );
});
test("reload and cyclic treatment phases interpolate from real progress only", () => {
  const f = fixture();
  f.u.presentation.reloading = true;
  f.u.presentation.reloadProgress = 0.2;
  f.u.presentation.treating = true;
  f.u.treat = 0.95;
  f.motion.beforeStep(f.b);
  f.v.models[0].reloadProgress = 0.4;
  f.v.models[0].treatmentProgress = 0.05;
  update(f, 0.5);
  assert.ok(Math.abs(f.v.models[0].renderReloadProgress - 0.3) < 1e-9);
  assert.equal(f.v.models[0].renderTreatmentProgress, 1);
});
