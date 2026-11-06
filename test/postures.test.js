import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { sight, terrainSight, cover } from "../src/world.js";
import { updatePosture, releasePosture, holdPosture } from "../src/postures.js";
import { perceive } from "../src/intelligence.js";
import { firingStatus } from "../src/diagnostics.js";
import { CombatVisuals, visualState } from "../src/combat-visuals.js";
function fixture() {
  const b = new Battle(() => 0.99, { tactical: true });
  for (const u of b.units) Object.assign(u, { dead: true, active: false });
  const u = b.units[0],
    e = b.units[6];
  Object.assign(u, { active: true, dead: false, x: 3, y: 11 });
  Object.assign(e, { active: true, dead: false, x: 3, y: 15 });
  b.time = 1;
  perceive(b);
  return { b, u, e };
}
test("full cover hides only along an actual protective low obstacle and cannot fire", () => {
  const { b, u, e } = fixture();
  assert.equal(cover(u, e), 0.58);
  assert.equal(terrainSight(u, e), true);
  updatePosture(b, u);
  assert.equal(u.posture.mode, "full");
  assert.equal(sight(e, u), false);
  assert.equal(sight(u, e), false);
  assert.equal(firingStatus(b, u, e).permitted, false);
  assert.equal(sight({ x: 2, y: 11 }, u), true);
});
test("peek and sustained exposures use real clear lanes, expire, and remain vulnerable", () => {
  const { b, u, e } = fixture();
  updatePosture(b, u);
  b.time = u.posture.until + 0.01;
  updatePosture(b, u);
  assert.equal(u.posture.mode, "peek");
  assert.equal(sight(u, e), true);
  assert.ok(cover(u, e) < 1);
  const until = u.posture.until;
  for (let i = 0; i < 3; i++) {
    b.time += 0.05;
    updatePosture(b, u);
    assert.equal(u.posture.until, until);
  }
  b.time = until + 0.01;
  updatePosture(b, u);
  assert.equal(u.posture.mode, "full");
  u.role = "LMG";
  b.time = u.posture.until + 0.01;
  updatePosture(b, u);
  assert.equal(u.posture.mode, "sustained");
  assert.ok(u.posture.until - b.time > 2);
});
test("reload and suppression shelter ends; expired contact does not create a permanent hold", () => {
  const { b, u, e } = fixture();
  u.reload = 2;
  updatePosture(b, u);
  assert.equal(holdPosture(b, u), true);
  b.time = 20;
  u.reload = 0;
  updatePosture(b, u);
  assert.equal(u.posture.mode, "sustained");
  assert.equal(holdPosture(b, u), false);
  assert.equal(sight(u, e), true);
});
test("concealed observed enemies remain plausible rather than being declared empty or tracked", () => {
  const { b, u, e } = fixture();
  updatePosture(b, u);
  b.time = 1.1;
  perceive(b);
  assert.equal(e.visibleEnemies.length, 0);
  const c = e.intel.contacts.get(u.id);
  assert.equal(c.time, 1);
  assert.equal(c.clearedAt, null);
  u.x = 3.2;
  b.time = 1.2;
  perceive(b);
  assert.equal(e.intel.contacts.get(u.id).x, 3);
});
test("solid cover blocks a peek; movement and incapacitation cannot retain hiding or firing", () => {
  const { b, u, e } = fixture();
  updatePosture(b, u);
  releasePosture(u);
  assert.equal(u.posture.mode, "sustained");
  Object.assign(e, { x: 8, y: 8 });
  assert.equal(sight(u, e), false);
  u.active = false;
  updatePosture(b, u);
  assert.equal(holdPosture(b, u), false);
  const v = new CombatVisuals();
  v.update(b, 0.05, 1, false);
  assert.equal(visualState(b, u, v.effects[u.id]).combat, false);
});

test("a newly known flank breaks full shelter; a full posture cannot display a lingering muzzle flash", () => {
  const { b, u, e } = fixture();
  updatePosture(b, u);
  const v = new CombatVisuals();
  v.update(b, 0.05, 1, false);
  u.presentation.lastShotAt = b.time;
  v.effects[u.id].shot = 1;
  assert.equal(visualState(b, u, v.effects[u.id]).flash, false);
  u.intel.contacts.set(7, {
    enemyId: 7,
    x: 2,
    y: 11,
    time: b.time,
    clearedAt: null,
  });
  updatePosture(b, u);
  assert.notEqual(u.posture.mode, "full");
});
