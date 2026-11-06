import test from "node:test";
import assert from "node:assert/strict";
import { CombatAtmosphere } from "../src/combat-atmosphere.js";
import { drawGroundDetail, drawBuildingDetail } from "../src/urban-detail.js";
const sink = new Proxy({}, { get: () => () => {} }),
  iso = (x, y) => ({ x: x * 20 - y * 20, y: x * 10 + y * 10 });
test("smoke, casings and impact dust require real events and do not mutate them", () => {
  const b = { events: [], units: [{ x: 1, y: 1, facing: 0 }] },
    v = new CombatAtmosphere();
  v.update(b, 0.1);
  assert.equal(v.effects.length, 0);
  b.events = [
    { id: 1, type: "shot", unitId: 0, x: 1, y: 1, angle: 0 },
    { id: 2, type: "damage", unitId: 0 },
  ];
  const before = JSON.stringify(b);
  v.update(b, 0.1);
  v.draw(sink, iso);
  assert.equal(JSON.stringify(b), before);
  assert.equal(v.effects.length, 2);
  v.update(b, 0.1);
  assert.equal(v.effects.length, 2);
});
test("effects pause, reset, expire and enforce a fixed cap", () => {
  const v = new CombatAtmosphere(),
    b = {
      units: [{ x: 1, y: 1 }],
      events: Array.from({ length: 100 }, (_, id) => ({
        id: id + 1,
        type: "shot",
        unitId: 0,
        angle: 0,
      })),
    };
  v.update(b, 0.1);
  assert.equal(v.effects.length, 64);
  const clock = v.clock;
  v.update(b, 0.1, 4, true);
  assert.equal(v.clock, clock);
  b.events = [];
  for (let i = 0; i < 10; i++) v.update(b, 0.1);
  assert.equal(v.effects.length, 0);
  v.update({ units: [], events: [] }, 0.1);
  assert.equal(v.serial, 0);
});
test("urban decoration is reproducible and cannot change supplied geometry", () => {
  const h = { x: 3, y: 4, w: 6, h: 4 },
    before = JSON.stringify(h);
  drawBuildingDetail(sink, h, iso);
  drawGroundDetail(sink, 3, 4, iso(3, 4));
  assert.equal(JSON.stringify(h), before);
});
