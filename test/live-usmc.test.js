import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LiveUSMCState, SE_ART } from "../src/live-usmc-state.js";
import {
  LiveUSMCRenderer,
  preloadLiveUSMC,
} from "../src/live-usmc-renderer.js";
import {
  liveRenderStatus,
  renderInspection,
  insertRenderInspection,
} from "../src/live-usmc-inspection.js";
import { Battle } from "../src/simulation.js";
import { CombatVisuals } from "../src/combat-visuals.js";
import { emitVisualEvent } from "../src/presentation-state.js";
const meta = JSON.parse(
  readFileSync("public/assets/usmc-se-v033/metadata.json"),
);
function fixture() {
  const b = { time: 0, result: null, events: [] },
    u = {
      id: 1,
      team: 0,
      role: "Rifleman",
      active: true,
      dead: false,
      state: "Searching district",
      facing: 0,
      movementHeading: 0,
      presentation: { direct: false },
      visibleEnemies: [],
      engagementId: null,
      aimAt: 0,
    },
    m = {
      direction: 0,
      renderDirection: 0,
      renderTop: -30,
      pose: "idle",
      moving: false,
      flash: false,
      stride: 0,
    };
  return { b, u, m, c: new LiveUSMCState() };
}
function target(f) {
  f.u.state = "Engaging";
  f.u.presentation.direct = true;
  f.u.engagementId = 6;
  f.u.visibleEnemies = [{ id: 6, active: true }];
}
function shot(f, id = 1) {
  f.b.events.push({
    id,
    type: "shot",
    unitId: 1,
    time: f.b.time,
    angle: f.u.facing,
  });
  f.m.flash = true;
}
const worldFromScreen = (a) =>
  Math.atan2(2 * Math.sin(a) - Math.cos(a), 2 * Math.sin(a) + Math.cos(a));
test("actual traveled distance drives whole-body walking; elapsed idle time never invents gait", () => {
  const f = fixture();
  f.m.moving = true;
  f.m.pose = "walking";
  const a = f.c.update(f.b, f.u, f.m).frame;
  f.b.time = 10;
  assert.equal(f.c.update(f.b, f.u, f.m).frame, a);
  f.m.renderStride = Math.PI;
  assert.notEqual(f.c.update(f.b, f.u, f.m).frame, a);
  f.m.moving = false;
  assert.equal(f.c.update(f.b, f.u, f.m).animation, "idle");
});
test("real target acquisition raises before the authoritative aim deadline", () => {
  const f = fixture();
  f.c.update(f.b, f.u, f.m);
  target(f);
  f.b.time = 0.1;
  f.u.aimAt = 0.5;
  let s = f.c.update(f.b, f.u, f.m);
  assert.equal(s.animation, "raising");
  assert.equal(s.frame, 12);
  f.b.time = 0.25;
  s = f.c.update(f.b, f.u, f.m);
  assert.ok(s.frame > 12 && s.frame < 16);
  f.b.time = 0.51;
  assert.equal(f.c.update(f.b, f.u, f.m).frame, 16);
});
test("only real shot events create recoil, and a real shot overrides unfinished raising", () => {
  const f = fixture();
  target(f);
  f.u.aimAt = 0.6;
  f.c.update(f.b, f.u, f.m);
  f.b.time = 0.1;
  f.m.flash = true;
  assert.equal(f.c.update(f.b, f.u, f.m).flash, false);
  shot(f);
  const s = f.c.update(f.b, f.u, f.m);
  assert.equal(s.animation, "firing");
  assert.equal(s.frame, 17);
  assert.equal(s.shotId, 1);
  f.m.flash = false;
  f.b.time = 0.25;
  assert.ok([18, 19].includes(f.c.update(f.b, f.u, f.m).frame));
  f.b.time = 0.4;
  assert.equal(f.c.update(f.b, f.u, f.m).frame, 16);
});
test("engagement loss lowers, settles to idle and resumes distance-paced walking", () => {
  const f = fixture();
  target(f);
  shot(f);
  f.c.update(f.b, f.u, f.m);
  f.b.time = 1;
  f.m.flash = false;
  f.u.state = "Observing contact";
  f.u.presentation.direct = false;
  f.u.visibleEnemies = [];
  let s = f.c.update(f.b, f.u, f.m);
  assert.equal(s.animation, "lowering");
  assert.equal(s.frame, 20);
  f.b.time = 1.36;
  assert.ok(f.c.update(f.b, f.u, f.m).frame >= 21);
  f.b.time = 1.71;
  assert.equal(f.c.update(f.b, f.u, f.m).animation, "idle");
  f.m.moving = true;
  assert.equal(f.c.update(f.b, f.u, f.m).animation, "walking");
});
test("paused observations are stable and repeated event buffers do not replay shots", () => {
  const f = fixture();
  target(f);
  shot(f);
  const s = f.c.update(f.b, f.u, f.m);
  for (let i = 0; i < 20; i++) assert.deepEqual(f.c.update(f.b, f.u, f.m), s);
  assert.equal(f.c.serial, 1);
  assert.equal(f.c.history.length, 1);
});
test("SE spatial hysteresis prevents jitter while an unsupported turn immediately falls back", () => {
  const f = fixture(),
    set = (degrees) => {
      f.m.renderDirection = worldFromScreen(
        SE_ART.center + (degrees * Math.PI) / 180,
      );
      return f.c.update(f.b, f.u, f.m);
    };
  assert.equal(set(19).supported, true);
  for (const a of [22, 25, 21, 24]) assert.equal(set(a).supported, true);
  assert.equal(set(28).fallback, "facing");
  assert.equal(set(23).supported, false);
  assert.equal(set(19).supported, true);
});
test("independent non-SE travel and a mismatched fixed-barrel aim use legacy rendering", () => {
  const f = fixture();
  f.m.moving = true;
  f.u.movementHeading = Math.PI / 2;
  assert.equal(f.c.update(f.b, f.u, f.m).fallback, "travel");
  f.m.moving = false;
  target(f);
  f.m.direction = 0.5;
  assert.equal(f.c.update(f.b, f.u, f.m).fallback, "barrel");
});
test("movement during shouldering/lowering never plays a planted-foot cel over moving feet", () => {
  const f = fixture();
  target(f);
  shot(f);
  f.c.update(f.b, f.u, f.m);
  f.m.flash = false;
  f.b.time = 1;
  f.m.moving = true;
  assert.equal(f.c.update(f.b, f.u, f.m).fallback, "movingCombat");
  f.u.state = "Searching district";
  f.u.visibleEnemies = [];
  f.u.presentation.direct = false;
  f.b.time = 1.1;
  assert.equal(f.c.update(f.b, f.u, f.m).fallback, "movingCombat");
  f.b.time = 2;
  assert.equal(f.c.update(f.b, f.u, f.m).animation, "walking");
  assert.equal(f.c.snapshot().supported, true);
});
test("reload, medical, concealment, suppression, injury postures and casualties retain legacy support", () => {
  for (const pose of [
    "reloading",
    "treating",
    "fullCover",
    "grenadePrep",
    "grenadeThrow",
    "mounted",
    "suppressed",
    "limping",
    "crawling",
  ]) {
    const f = fixture();
    f.m.pose = pose;
    assert.equal(f.c.update(f.b, f.u, f.m).supported, false, pose);
  }
  const f = fixture();
  f.m.covered = true;
  assert.equal(f.c.update(f.b, f.u, f.m).fallback, "posture");
  f.u.active = false;
  shot(f);
  assert.equal(f.c.update(f.b, f.u, f.m).flash, false);
});
test("finished/restarted battles cannot retain ghost firing or stale events", () => {
  const f = fixture();
  shot(f);
  f.c.update(f.b, f.u, f.m);
  f.b.result = "USMC victory";
  assert.equal(f.c.update(f.b, f.u, f.m).animation, "idle");
  assert.equal(f.c.snapshot().flash, false);
  const next = { time: 0, result: null, events: [] };
  f.m.flash = false;
  assert.equal(f.c.update(next, f.u, f.m).shotId, null);
  assert.equal(f.c.serial, 0);
});
test("live observations do not modify simulation input and diagnostic history is bounded", () => {
  const f = fixture(),
    before = JSON.stringify([f.b, f.u, f.m]);
  f.c.update(f.b, f.u, f.m);
  assert.equal(JSON.stringify([f.b, f.u, f.m]), before);
  for (let i = 0; i < 100; i++) {
    f.b.time += 0.1;
    f.m.renderDirection = i % 2 ? 0 : Math.PI;
    f.c.update(f.b, f.u, f.m);
  }
  assert.ok(f.c.history.length <= 32);
});
function mockScene() {
  const calls = [],
    im = {};
  for (const k of [
    "setVisible",
    "setFrame",
    "setOrigin",
    "setScale",
    "setPosition",
    "setRotation",
    "setDepth",
  ])
    im[k] = (...args) => {
      calls.push([k, ...args]);
      return im;
    };
  return {
    calls,
    scene: {
      add: { image: () => im },
      cache: { json: { get: () => meta } },
      textures: { exists: () => true },
    },
  };
}
test("one SE full-body image uses the corrected atlas, uniform 39px scale and real muzzle anchor", () => {
  const f = fixture(),
    { scene, calls } = mockScene(),
    r = new LiveUSMCRenderer(scene),
    g = new Proxy({}, { get: () => () => {} });
  shot(f);
  const before = JSON.stringify([f.b, f.u, f.m]);
  r.update(f.b, f.u, f.m, { shot: 0.04, hit: 0 }, f.u);
  assert.equal(
    r.draw(
      g,
      f.b,
      f.u,
      f.m,
      { shot: 0.04, hit: 0 },
      { x: 50, y: 100 },
      f.u,
      true,
    ),
    true,
  );
  assert.ok(
    calls.some(
      (c) =>
        c[0] === "setScale" &&
        c.length === 2 &&
        c[1] === 39 / meta.nativeStandingHeight,
    ),
  );
  assert.ok(calls.some((c) => c[0] === "setRotation" && c[1] === 0));
  assert.equal(r.snapshot().frame, 17);
  assert.ok(r.shotAnchor(1));
  assert.equal(JSON.stringify([f.b, f.u, f.m]), before);
  r.hide();
  assert.equal(r.snapshot().visible, false);
});
test("Pages-safe live preload and real-event trace origin preserve the shot endpoint", () => {
  const urls = [],
    scene = {
      load: {
        spritesheet: (key, url) => urls.push(url),
        json: (key, url) => urls.push(url),
      },
    };
  preloadLiveUSMC(scene);
  assert.ok(
    urls.every((u) => u.startsWith("/annous-warfare/assets/usmc-se-v033/")),
  );
  const b = new Battle(() => 0.9),
    u = b.units[1];
  const e = emitVisualEvent(b, "shot", u, {
    x: u.x,
    y: u.y,
    angle: 0,
    targetX: 12,
    targetY: 10,
  });
  const v = new CombatVisuals();
  v.update(b, 0.01, 1, false);
  assert.equal(v.traces[0].id, e.id);
  let line;
  v.drawTraces(
    {
      lineStyle() {},
      lineBetween(...args) {
        line = args;
      },
    },
    (x, y) => ({ x, y }),
    () => ({ muzzle: { x: 55, y: 66 } }),
  );
  assert.deepEqual(line, [55, 66, 12, -4]);
});
test("inspection reports the actual renderer/pose on fallback rather than an undrawn candidate", () => {
  const fallback = liveRenderStatus({
    mode: "v033",
    enabled: true,
    inView: true,
    live: { visible: false, animation: "raising", fallback: "facing" },
    legacy: { visible: true, pose: "walking" },
    model: { pose: "walking" },
  });
  assert.equal(fallback.renderer, "v031");
  assert.equal(fallback.animation, "walking");
  const text = insertRenderInspection("병사 #1\n건강", fallback, true);
  assert.match(text, /v0.3.1/);
  assert.match(text, /방향/);
  assert.ok(!text.includes("총기 올림"));
  const active = liveRenderStatus({
    mode: "v033",
    enabled: true,
    inView: true,
    live: { visible: true, animation: "firing", frame: 17, reason: "shot" },
    model: { pose: "firing" },
  });
  assert.match(renderInspection(active, true), /v0.3.3 Animated.*사격/);
  assert.match(renderInspection(active, true), /18\/24/);
});
test("missing SE texture and other identities safely fall back without drawing a wrong soldier", () => {
  const f = fixture(),
    { scene } = mockScene(),
    r = new LiveUSMCRenderer(scene),
    g = new Proxy({}, { get: () => () => {} });
  scene.textures.exists = () => false;
  r.update(f.b, f.u, f.m, { shot: 0, hit: 0 }, f.u);
  assert.equal(
    r.draw(g, f.b, f.u, f.m, { shot: 0, hit: 0 }, { x: 0, y: 0 }, f.u, false),
    false,
  );
  assert.equal(r.snapshot().fallback, "asset");
  const other = fixture();
  other.u.id = 0;
  assert.equal(other.c.update(other.b, other.u, other.m).fallback, "identity");
});
