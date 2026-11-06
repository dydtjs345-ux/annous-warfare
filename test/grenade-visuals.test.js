import test from "node:test";
import assert from "node:assert/strict";
import { GrenadeVisuals } from "../src/grenade-visuals.js";
import { Battle } from "../src/simulation.js";
const sink = new Proxy({}, { get: () => () => {} }),
  iso = (x, y) => ({ x: x * 20, y: y * 10 });
test("grenade effects require real events, are consumed once, and linger independently of projectile removal", () => {
  const b = { events: [], time: 0 },
    v = new GrenadeVisuals();
  v.update(b, 0.1);
  assert.equal(v.effects.length, 0);
  b.events.push({ id: 1, type: "grenadeBlast", x: 5, y: 8 });
  v.update(b, 0.1);
  const fills = [];
  const frame = new Proxy(
    {},
    {
      get:
        (_, name) =>
        (...args) => {
          if (name === "fillStyle") fills.push(args[0]);
        },
    },
  );
  v.draw(frame, iso);
  assert.equal(
    fills.at(-1),
    0xffc67a,
    "instantaneous flash stays above its dust/residue layer",
  );
  v.update(b, 0.1);
  assert.equal(v.effects.length, 1);
  b.events = [];
  v.update(b, 0.3);
  assert.equal(v.effects.length, 1);
  v.draw(sink, iso);
  for (let i = 0; i < 30; i++) v.update(b, 0.1);
  assert.equal(v.effects.length, 0);
});
test("effects pause, reset on restart, remain bounded and never mutate the simulation events", () => {
  const b = {
      events: Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        type: "grenadeBlast",
        x: 3,
        y: 3,
      })),
      time: 0,
    },
    v = new GrenadeVisuals(),
    before = JSON.stringify(b);
  v.update(b, 0.1);
  assert.equal(v.effects.length, 32);
  const clock = v.clock;
  v.update(b, 0.1, 4, true);
  assert.equal(v.clock, clock);
  v.draw(sink, iso);
  assert.equal(JSON.stringify(b), before);
  v.update({ events: [] }, 0.1);
  assert.equal(v.effects.length, 0);
});
test("grenade presentation and all speed groupings preserve complete-match authoritative outcomes", () => {
  const hashes = [];
  for (const speed of [1, 2, 4]) {
    let r = 2001;
    const b = new Battle(
      () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296,
      { map: "urban", variant: 0, grenades: true, tactical: true },
    );
    const v = new GrenadeVisuals();
    let steps = 0;
    for (; steps < 18000 && !b.result; steps++) {
      b.step(0.1);
      v.update(b, 0.1 / speed, speed);
      v.draw(sink, iso);
    }
    assert.ok(b.result);
    hashes.push(
      JSON.stringify([
        r,
        b.result,
        b.time,
        b.units.map((u) => [u.x, u.y, u.health, u.ammo, u.reserve]),
        b.grenadeStats,
      ]),
    );
  }
  assert.equal(hashes[0], hashes[1]);
  assert.equal(hashes[0], hashes[2]);
});
