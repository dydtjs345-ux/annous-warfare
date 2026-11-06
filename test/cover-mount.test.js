import { perceive } from "../src/intelligence.js";
import test from "node:test";
import assert from "node:assert/strict";
import { Battle } from "../src/simulation.js";
import { cover, sight, path, obstacles, key } from "../src/world.js";
import { localCover, chooseCover, incomingFire } from "../src/tactics.js";
import {
  MOUNT,
  mountSite,
  updateMount,
  releaseMount,
  mountBonus,
} from "../src/mounting.js";
import { firingStatus, refreshDiagnostics } from "../src/diagnostics.js";
import { inspectSoldier } from "../src/inspection.js";
import { CombatVisuals } from "../src/combat-visuals.js";
const seeded = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
function fixture(lmg = false) {
  const b = new Battle(() => 0.99);
  for (const u of b.units) {
    u.active = false;
    u.dead = true;
  }
  const u = b.units[lmg ? 4 : 0],
    e = b.units[6];
  Object.assign(u, { active: true, dead: false, x: 3, y: 11 });
  Object.assign(e, { active: true, dead: false, x: 3, y: 15, reload: 10000 });
  return { b, u, e };
}
function tickMount(b, u, e, dt) {
  b.time += dt;
  updateMount(b, u, e);
}

test("first contact evaluates meaningful reachable cover without waiting for heavy suppression", () => {
  const { b, u, e } = fixture();
  Object.assign(e, { x: 9, y: 11 });
  const start = { x: u.x, y: u.y };
  assert.equal(cover(u, e), 0);
  assert.ok(localCover(b, u, [e], 0.05));
  assert.ok(u.coverTarget);
  assert.ok(path(start, u.coverTarget).length);
  assert.ok(cover(u.coverTarget, e) >= 0.28);
  assert.ok(sight(u.coverTarget, e));
  assert.equal(u.coverEvaluation.blockedBy, null);
});

test("protected gunner holds a real firing lane rather than chasing marginal cover", () => {
  const { b, u, e } = fixture(true);
  assert.equal(cover(u, e), 0.58);
  assert.equal(chooseCover(b, u, [e]), null);
  assert.equal(localCover(b, u, [e], 0.05), false);
  assert.match(u.coverEvaluation.reason, /adequate/);
});

test("cover commitments do not suppress urgent self preservation or significant direction changes", () => {
  const { b, u, e } = fixture();
  Object.assign(e, { x: 9, y: 11 });
  u.positionUntil = 100;
  assert.ok(localCover(b, u, [e], 0.05));
  const first = u.coverDirection;
  u.coverTarget = null;
  u.nextAssessment = 100;
  Object.assign(e, { x: 3, y: 15 });
  localCover(b, u, [e], 0.05);
  assert.notEqual(u.coverDirection, first);
  assert.equal(u.coverEvaluation.evaluatedAt, b.time);
});

test("two nonurgent cover relocations preserve squad fire support; urgent pressure overrides budget", () => {
  const b = new Battle(seeded(1));
  b.time = 5;
  const team = b.units.filter((u) => u.team === 0);
  for (let i = 0; i < 6; i++) Object.assign(team[i], { x: 2 + i * 0.7, y: 11 });
  const threats = [{ x: 9, y: 11 }];
  for (const u of team) localCover(b, u, threats, 0.05);
  assert.ok(team.filter((u) => u.coverTarget).length <= 2);
  assert.ok(team.some((u) => u.coverTarget));
  assert.ok(
    team.some(
      (u) => u.coverEvaluation.blockedBy === "squad fire-and-movement budget",
    ),
  );
  const u = team.find((u) => u.coverEvaluation.blockedBy);
  u.suppression = 0.8;
  b.time += 2;
  localCover(b, u, threats, 0.05);
  assert.notEqual(
    u.coverEvaluation.blockedBy,
    "squad fire-and-movement budget",
  );
});

test("cover objectives persist, finish, and retain hysteresis under unchanged threats", () => {
  const { b, u, e } = fixture();
  Object.assign(e, { x: 9, y: 11 });
  localCover(b, u, [e], 0.05);
  const target = { ...u.coverTarget };
  for (let i = 0; i < 100 && u.coverTarget; i++) {
    b.time += 0.05;
    localCover(b, u, [e], 0.05);
    if (u.coverTarget) assert.deepEqual(u.coverTarget, target);
  }
  assert.equal(u.coverTarget, null);
  assert.ok(u.coverRelocations >= 1);
  assert.equal(localCover(b, u, [e], 0.05), false);
});

test("unsupported soldiers still fire and protected soldiers do not abandon valid engagement", () => {
  for (const lmg of [false, true]) {
    const { b, u, e } = fixture(lmg);
    Object.assign(u, { x: 12, y: 5 });
    Object.assign(e, { x: 16, y: 5 });
    for (let i = 0; i < 80; i++) b.step(0.05);
    assert.ok(u.ammo < u.mag);
    assert.equal(u.mount?.state ?? "unsupported", "unsupported");
    const visual = new CombatVisuals();
    visual.update(b, 0.016, 4, false);
    assert.equal(visual.models[u.id].mountProgress, 0);
    if (lmg)
      assert.ok(
        b.events.some((ev) => ev.type === "shot" && ev.unitId === u.id),
      );
  }
});

test("aligned low wall deploys with real timer and no bonus or shots during deployment", () => {
  const { b, u, e } = fixture(true);
  assert.ok(mountSite(u, e).position);
  updateMount(b, u, e);
  assert.equal(u.mount.state, "deploying");
  assert.equal(mountBonus(u, "accuracy"), 1);
  assert.equal(firingStatus(b, u, e).permitted, false);
  tickMount(b, u, e, MOUNT.deploy - 0.01);
  assert.equal(u.mount.state, "deploying");
  tickMount(b, u, e, 0.01);
  assert.equal(u.mount.state, "mounted");
  assert.equal(mountBonus(u, "accuracy"), MOUNT.accuracy);
  assert.equal(mountBonus(u, "suppression"), MOUNT.suppression);
  assert.ok(
    b.events.some((ev) => ev.type === "mountState" && ev.state === "mounted"),
  );
});

test("fences, solid walls, side obstacles, and absent direct targets cannot authorize mounting", () => {
  const { b, u, e } = fixture(true);
  for (const [ux, uy, ex, ey] of [
    [3, 1, 3, 4],
    [4, 6, 8, 6],
    [3, 11, 9, 11],
    [14, 10, 14, 16],
  ]) {
    Object.assign(u, { x: ux, y: uy });
    Object.assign(e, { x: ex, y: ey });
    assert.equal(mountSite(u, e).position, undefined);
  }
  Object.assign(u, { x: 3, y: 11 });
  assert.equal(mountSite(u, null).position, undefined);
});

test("a new solid obstruction prevents mounted fire and starts unmounting", () => {
  const { b, u, e } = fixture(true);
  updateMount(b, u, e);
  tickMount(b, u, e, 0.8);
  const k = key(3, 13),
    old = obstacles.get(k);
  obstacles.set(k, "wall");
  try {
    updateMount(b, u, e);
    assert.equal(u.mount.state, "unmounting");
    assert.equal(sight(u, e), false);
    assert.equal(firingStatus(b, u, e).permitted, false);
  } finally {
    old ? obstacles.set(k, old) : obstacles.delete(k);
  }
});

test("unmounting delays actual movement and does not poison pathfinding", () => {
  const { b, u, e } = fixture(true);
  updateMount(b, u, e);
  tickMount(b, u, e, 0.8);
  const x = u.x,
    y = u.y;
  assert.equal(b.move(u, { x: 2, y: 11 }, 0.05), true);
  assert.equal(u.x, x);
  assert.equal(u.y, y);
  assert.equal(u.mount.state, "unmounting");
  tickMount(b, u, e, MOUNT.unmount - 0.01);
  assert.equal(u.mount.state, "unmounting");
  tickMount(b, u, e, 0.01);
  assert.equal(u.mount.state, "unsupported");
  b.move(u, { x: 2, y: 11 }, 0.05);
  assert.ok(u.x < x);
  assert.equal(u.failedGoal, undefined);
  updateMount(b, u, e);
  assert.equal(u.mount.state, "unsupported");
});

test("flanked or heavily suppressed gunner relinquishes support and can reposition", () => {
  for (const flank of [true, false]) {
    const { b, u, e } = fixture(true);
    updateMount(b, u, e);
    tickMount(b, u, e, 0.8);
    if (flank) Object.assign(e, { x: 9, y: 11 });
    else u.suppression = 0.9;
    updateMount(b, u, e);
    assert.equal(u.mount.state, "unmounting");
    assert.equal(mountBonus(u, "suppression"), 1);
  }
});

test("mounted LMG generates modestly stronger real incoming-fire pressure", () => {
  const { b, u, e } = fixture(true);
  incomingFire(b, u, e);
  const normal = e.suppression;
  e.suppression = 0;
  updateMount(b, u, e);
  tickMount(b, u, e, 0.8);
  incomingFire(b, u, e);
  assert.ok(Math.abs(e.suppression - normal * MOUNT.suppression) < 1e-9);
});

test("incapacitation and death cancel mounting without combat/unmount animations or firing", () => {
  for (const damage of [80, 200]) {
    const { b, u, e } = fixture(true);
    updateMount(b, u, e);
    tickMount(b, u, e, 0.8);
    b.injury(u, "head", damage);
    assert.equal(u.active, false);
    assert.equal(u.mount.state, "unsupported");
    assert.equal(firingStatus(b, u, e).permitted, false);
    assert.equal(b.move(u, { x: 2, y: 11 }, 0.05), false);
    const v = new CombatVisuals();
    v.update(b, 0.016, 4, false);
    assert.ok(["dead", "incapacitated"].includes(v.models[u.id].pose));
    assert.equal(v.models[u.id].flash, false);
  }
});

test("mount poses and inspector consume actual states; supported flashes require actual shot events", () => {
  const { b, u, e } = fixture(true);
  perceive(b);
  localCover(b, u, [e], 0.05);
  updateMount(b, u, e);
  const v = new CombatVisuals();
  v.update(b, 0.016, 1, false);
  assert.equal(v.models[u.id].pose, "deploying");
  assert.equal(v.models[u.id].flash, false);
  refreshDiagnostics(b, u);
  let text = inspectSoldier(u);
  assert.match(text, /LMG: deploying/);
  assert.match(text, /accuracy ×1 /);
  assert.match(text, /protection 58%/);
  tickMount(b, u, e, 0.8);
  v.update(b, 0.016, 2, false);
  assert.equal(v.models[u.id].pose, "mounted");
  refreshDiagnostics(b, u);
  text = inspectSoldier(u);
  assert.match(text, /accuracy ×1.12/);
  releaseMount(b, u);
  v.update(b, 0.016, 4, false);
  assert.equal(v.models[u.id].pose, "unmounting");
  assert.equal(v.models[u.id].flash, false);
  assert.match(inspectSoldier(u), /LMG: unmounting/);
  u.intel.contacts.clear();
  u.memory = null;
  u.visibleEnemies = [];
  refreshDiagnostics(b, u);
  assert.match(inspectSoldier(u), /Cover: no current known threat/);
  assert.doesNotMatch(inspectSoldier(u), /Cover: protection/);
});

test("fixed seeds retain initiative, medic/leader systems, mounting and exclusive activity at all playback groupings", () => {
  for (const seed of [1, 3, 8]) {
    const snapshots = [];
    for (const group of [1, 2, 4]) {
      const b = new Battle(seeded(seed));
      const v = new CombatVisuals();
      let shots = 0,
        mounted = 0;
      for (let frames = 0; frames < 2000 && !b.result; frames++) {
        for (let i = 0; i < group && !b.result; i++) {
          b.step(0.05);
          shots += b.units.filter((u) => u.firedAt === b.time).length;
          mounted += b.units.filter((u) => u.mount?.state === "mounted").length;
        }
        v.update(b, 0.05, group, false);
      }
      // Compare equal simulation horizon rather than unequal wall-clock budgets.
      while (b.time < 400 - 1e-7 && !b.result) {
        b.step(0.05);
        shots += b.units.filter((u) => u.firedAt === b.time).length;
        mounted += b.units.filter((u) => u.mount?.state === "mounted").length;
      }
      assert.ok(b.result, `seed ${seed} did not finish`);
      assert.ok(shots > 20);
      for (const u of b.units) {
        const a = u.activity;
        assert.ok(
          Math.abs(
            a.total -
              [
                "engaging",
                "searching",
                "moving",
                "cover",
                "treating",
                "reloading",
                "waiting",
              ].reduce((n, k) => n + a[k], 0),
          ) < 1e-6,
        );
      }
      assert.ok(b.squads.some((s) => s.commanderId != null));
      snapshots.push([
        b.result,
        b.time,
        shots,
        mounted,
        b.units.map((u) => u.health),
      ]);
    }
    assert.deepEqual(snapshots[0], snapshots[1]);
    assert.deepEqual(snapshots[0], snapshots[2]);
  }
});

test("supported shots spend real ammunition, animate mounted recoil, and deployment is preparation", () => {
  const { b, u, e } = fixture(true);
  const v = new CombatVisuals();
  b.step(0.05);
  assert.equal(u.mount.state, "deploying");
  assert.equal(u.activity.preparation, 0.05);
  assert.equal(u.activity.engaging, 0);
  let real = null;
  for (let i = 0; i < 60 && !real; i++) {
    b.step(0.05);
    real = b.events.find(
      (ev) => ev.type === "shot" && ev.unitId === u.id && ev.supported,
    );
  }
  assert.ok(real);
  assert.ok(u.ammo < u.mag);
  assert.equal(u.mount.state, "mounted");
  v.update(b, 0.016, 4, false);
  assert.equal(v.models[u.id].pose, "mountedFiring");
  assert.equal(v.models[u.id].flash, true);
  assert.equal(real.time, u.firedAt);
  assert.equal(u.cooldown, 0.2);
});

test("initial six-versus-six engagement keeps fire active alongside actual cover movement", () => {
  const b = new Battle(seeded(5));
  let mixed = false,
    fired = false,
    moves = 0;
  for (let i = 0; i < 800 && !b.result; i++) {
    b.step(0.05);
    for (const team of [0, 1]) {
      const alive = b.units.filter((u) => u.active && u.team === team);
      const relocating = alive.filter(
        (u) => u.coverTarget && u.presentation.moving,
      );
      const shooting = alive.some((u) => u.firedAt === b.time);
      if (relocating.length) moves++;
      if (shooting) fired = true;
      if (relocating.length && shooting) mixed = true;
      // Emergency self-preservation can deliberately exceed the normal budget.
      // A final sub-0.2 tile arrival leg releases its slot in this fixed step.
      const routine = relocating.filter(
        (u) =>
          !u.coverEmergency &&
          Math.hypot(u.x - u.coverTarget.x, u.y - u.coverTarget.y) > 0.2,
      );
      assert.ok(routine.length <= 2);
    }
  }
  assert.ok(fired);
  assert.ok(moves > 0);
  assert.ok(mixed);
});

test("a directly observed unprotected flank prevents remounting on a still-visible frontal target", () => {
  const { b, u, e } = fixture(true);
  updateMount(b, u, e);
  tickMount(b, u, e, 0.8);
  const flank = b.units[7];
  Object.assign(flank, { active: true, dead: false, x: 9, y: 11 });
  u.visibleEnemies = [e, flank];
  updateMount(b, u, e);
  assert.equal(u.mount.state, "unmounting");
  assert.match(u.mount.reason, /flank/);
  tickMount(b, u, e, MOUNT.unmount);
  tickMount(b, u, e, MOUNT.cooldown + 0.1);
  assert.equal(u.mount.state, "unsupported");
  assert.match(u.mount.reason, /flank/);
});

test("reloading does not bypass first-contact cover assessment or change reload timing", () => {
  const { b, u, e } = fixture();
  Object.assign(e, { x: 9, y: 11 });
  u.reload = 2.6;
  b.step(0.05);
  assert.ok(u.coverTarget);
  assert.equal(u.state, "Reloading");
  assert.ok(Math.abs(u.reload - 2.55) < 1e-9);
  assert.ok(u.presentation.moving);
  assert.equal(u.activity.reloading, 0.05);
  assert.equal(u.activity.total, 0.05);
});
