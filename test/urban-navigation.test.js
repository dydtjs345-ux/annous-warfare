import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import {
  configureWorld,
  path,
  sight,
  blocked,
  key,
  cover,
} from "../src/world.js";
import { localCover } from "../src/tactics.js";
import { mountSite } from "../src/mounting.js";
function fixture(kind = "urban") {
  const b = new Battle(() => 0.99, { map: kind, grenades: true });
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  return b;
}
afterEach(() => configureWorld("legacy"));
test("medic congestion replan can detour around a vehicle toward its occupied patient endpoint", () => {
  const b = fixture(),
    m = b.units[5],
    p = b.units[0],
    a = b.units[1];
  Object.assign(m, {
    active: true,
    dead: false,
    x: 14,
    y: 4,
    state: "Moving to casualty",
    patientId: 0,
  });
  Object.assign(p, { active: false, dead: false, x: 16, y: 6 });
  p.health.torso = 20;
  Object.assign(a, {
    active: true,
    dead: false,
    x: 15,
    y: 4,
    state: "Holding contact",
  });
  assert.ok(blocked(15, 5));
  let failures = 0;
  for (let i = 0; i < 100; i++) {
    b.time += 0.1;
    if (b.move(m, p, 0.1) === false) failures++;
    assert.ok(!blocked(Math.round(m.x), Math.round(m.y)));
    for (const u of [p, a])
      assert.ok(Math.hypot(m.x - u.x, m.y - u.y) >= 0.6 - 1e-8);
    if (Math.hypot(m.x - p.x, m.y - p.y) < 1.4 && sight(m, p)) break;
  }
  assert.equal(failures, 0);
  assert.ok(
    Math.hypot(m.x - p.x, m.y - p.y) < 1.4,
    "medic must reach actual unobstructed treatment range",
  );
  Object.assign(b.units[6], {
    active: true,
    dead: false,
    x: 27,
    y: 22,
    reload: 10000,
  });
  for (let i = 0; i < 23; i++) b.step(0.1);
  assert.ok(p.health.torso > 20, "detour must lead to real treatment");
});

test("a held pocket fails safely; recovery can retain useful cover without moving the LMG", () => {
  const b = fixture(),
    u = b.units[2],
    a = b.units[4],
    e = b.units[6];
  Object.assign(u, {
    active: true,
    dead: false,
    x: 11,
    y: 10,
    state: "Seeking cover",
    coverTarget: { x: 12, y: 11 },
    coverUntil: 100,
    nextAssessment: 100,
  });
  Object.assign(a, {
    active: true,
    dead: false,
    x: 11,
    y: 10.89,
    state: "Engaging",
  });
  Object.assign(e, { active: true, dead: false, x: 11, y: 15 });
  assert.ok(mountSite(a, e).position);
  a.mount = { state: "mounted", ...mountSite(a, e) };
  assert.ok(path(u, u.coverTarget).length, "pocket is terrain-connected");
  assert.equal(
    path(u, u.coverTarget, new Set([key(11, 11)])).length,
    0,
    "stationary support gunner holds the only entrance",
  );
  let failed = false;
  for (let i = 0; i < 50; i++) {
    b.time += 0.1;
    if (!b.move(u, u.coverTarget, 0.1)) {
      failed = true;
      break;
    }
  }
  assert.ok(failed);
  assert.equal(u.movementBlocker, "Soldier congestion");
  assert.ok(Math.hypot(u.x - a.x, u.y - a.y) >= 0.6 - 1e-8);
  // Match the existing localCover failure recovery without changing its policy.
  u.coverTarget = null;
  u.nextAssessment = b.time;
  localCover(b, u, [e], 0.1);
  assert.ok(
    cover(u, e) >= 0.28,
    "the blocked approach already reached protection",
  );
  assert.equal(
    u.coverTarget,
    null,
    "do not force another move from useful protection",
  );
  assert.notDeepEqual(u.coverTarget, { x: 12, y: 11 });
  assert.equal(a.mount.state, "mounted");
});
test("ordinary occupied movement goals do not receive the medical endpoint exception", () => {
  const b = fixture(),
    m = b.units[5],
    p = b.units[0],
    a = b.units[1];
  Object.assign(m, {
    active: true,
    dead: false,
    x: 14,
    y: 4,
    state: "Regrouping",
    patientId: 0,
  });
  Object.assign(p, { active: false, dead: false, x: 16, y: 6 });
  p.health.torso = 20;
  Object.assign(a, { active: true, dead: false, x: 15, y: 4 });
  let failed = false;
  for (let i = 0; i < 100; i++) {
    b.time += 0.1;
    if (!b.move(m, p, 0.1)) failed = true;
    assert.ok(Math.hypot(m.x - p.x, m.y - p.y) >= 0.6 - 1e-8);
  }
  assert.ok(failed);
  assert.equal(m.movementBlocker, "Soldier congestion");
});
test("medical timing and healing remain identical in legacy and urban modes", () => {
  const outcomes = [];
  for (const kind of ["legacy", "urban"]) {
    const b = fixture(kind),
      m = b.units[5],
      p = b.units[0],
      e = b.units[6];
    Object.assign(m, { active: true, dead: false, x: 3, y: 11 });
    Object.assign(p, { active: false, dead: false, x: 4, y: 11 });
    p.health.torso = 20;
    Object.assign(e, {
      active: true,
      dead: false,
      x: 27,
      y: 22,
      reload: 10000,
    });
    for (let i = 0; i < 23; i++) b.step(0.1);
    outcomes.push({
      health: p.health,
      treat: m.treat,
      treating: m.activity.treating,
      active: p.active,
    });
  }
  assert.deepEqual(outcomes[0], outcomes[1]);
  assert.equal(outcomes[0].health.torso, 36);
});
test("urban contact cases retain terrain and soldier separation at the browser timestep", () => {
  for (const seed of [1001, 1004, 1050, 1052, 1104, 1156, 1188, 1200]) {
    let r = seed;
    const b = new Battle(
      () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296,
      {
        map: "urban",
        variant: seed % 3,
        grenades: true,
        contactTTL: seed % 4 === 2 ? 6 : 8,
      },
    );
    for (const u of b.units) {
      if (seed % 4 === 3) u.reserve = Math.floor(u.reserve / 2);
      if (seed % 4 === 0) u.health["left leg"] = 65;
    }
    if (seed % 4 === 0) {
      const ps = [
        [6, 10],
        [12, 9],
        [15, 10],
        [17, 10],
        [3, 11],
        [2, 10],
        [6, 15],
        [7, 15],
        [8, 15],
        [18, 15],
        [25, 13],
        [27, 15],
      ];
      for (const u of b.units) [u.x, u.y] = ps[u.id];
    }
    for (let i = 0; i < 800 && !b.result; i++) {
      b.step(0.05);
      const bodies = b.units.filter((u) => !u.dead);
      for (const u of bodies) {
        assert.ok(
          !blocked(Math.round(u.x), Math.round(u.y)),
          `seed ${seed}, unit ${u.id}`,
        );
        for (const a of bodies)
          if (a.id < u.id)
            assert.ok(
              Math.hypot(u.x - a.x, u.y - a.y) >= 0.6 - 1e-7,
              `seed ${seed}, pair ${u.id}/${a.id}`,
            );
      }
    }
  }
});
