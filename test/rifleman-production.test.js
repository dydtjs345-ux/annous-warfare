import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOG, clipAvailability } from "../src/rifleman/catalog.js";
import { FoundationClock, clipSeconds } from "../src/rifleman/clock.js";
import { LiveEastState } from "../src/rifleman/live-east-state.js";
import {
  LiveEastRenderer,
  preloadEastRifleman,
} from "../src/rifleman/live-east-renderer.js";
import {
  liveRenderStatus,
  renderInspection,
} from "../src/live-usmc-inspection.js";
const metadata = Object.fromEntries(
  ["eQuiet", "eHandling"].map((k) => [
    k + "-meta",
    JSON.parse(readFileSync("public/" + CATALOG.banks[k].metadata)),
  ]),
);
function fixture() {
  const angle = -Math.PI / 4;
  return {
    b: { time: 0, result: null, events: [] },
    u: {
      id: 1,
      team: 0,
      role: "Rifleman",
      active: true,
      dead: false,
      state: "Searching district",
      facing: angle,
      movementHeading: angle,
      presentation: { direct: false },
      visibleEnemies: [],
      engagementId: null,
      aimAt: 0,
    },
    m: {
      direction: angle,
      renderDirection: angle,
      renderTop: -30,
      pose: "idle",
      moving: false,
      flash: false,
      stride: 0,
    },
    c: new LiveEastState(),
  };
}
function acquire(f) {
  f.u.state = "Aiming";
  f.u.presentation.direct = true;
  f.u.engagementId = 6;
  f.u.visibleEnemies = [{ id: 6, active: true }];
}
const update = (f) => f.c.update(f.b, f.u, f.m);
test("seven newly reviewed E clips reference exactly sixteen unique approved whole-body cels", () => {
  const unique = new Set();
  for (const action of [
    "idle",
    "lowReady",
    "highReady",
    "raise",
    "aim",
    "lower",
    "fire",
  ]) {
    const a = clipAvailability("E", action);
    assert.equal(a.status, "verified");
    assert.equal(a.clip.liveApproved, true);
    for (const f of a.clip.frames) unique.add(`${a.bank}:${f}`);
  }
  assert.equal(unique.size, 16);
  assert.equal(CATALOG.directions.E.status, "prototype");
  assert.equal(clipAvailability("E", "walk").status, "prototype");
  assert.equal(metadata["eHandling-meta"].combatApproved, true);
});
test("planted E cels use individual measured boot roots, not resizing or weapon layers", () => {
  const frames = metadata["eHandling-meta"].frames;
  assert.equal(frames[0].footAnchor[1], frames[7].footAnchor[1]);
  assert.equal(frames[0].footAnchor[0] - frames[2].footAnchor[0], 32);
  const tips = [3, 4, 6, 7].map(
    (i) => frames[i].muzzle[0] - frames[i].footAnchor[0],
  );
  assert.ok(Math.max(...tips) - Math.min(...tips) < 2);
  for (const m of Object.values(metadata)) {
    assert.equal(m.weaponIntegrated, true);
    assert.equal(m.nativeStandingHeight, 459);
  }
});
test("every E action can be stepped and missing directions remain blank rather than mirrored", () => {
  const c = new FoundationClock();
  c.setDirection("E");
  for (const action of Object.keys(CATALOG.directions.E.clips)) {
    c.select(action);
    const frames = new Set();
    const a = clipAvailability("E", action);
    for (let i = 0; i < a.clip.frames.length; i++) {
      frames.add(c.pose().frame);
      c.step();
    }
    assert.equal(frames.size, new Set(a.clip.frames).size);
  }
  c.setDirection("S");
  assert.equal(c.pose().supported, false);
});
test("E lab demonstration includes recoil but does not change the preserved SE sequence duration", () => {
  const c = new FoundationClock();
  assert.equal(c.total(), 8.74);
  c.setDirection("E");
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    seen.add(c.pose().action);
    c.advance(0.1);
  }
  assert.ok(seen.has("fire") && seen.has("raise") && seen.has("walk"));
  const pose = c.pose();
  c.pose("SE");
  assert.deepEqual(c.pose(), pose);
});
test("actual E target acquisition raises the whole figure and engagement loss lowers it", () => {
  const f = fixture();
  assert.equal(update(f).bank, "eQuiet");
  acquire(f);
  f.b.time = 0.1;
  f.u.aimAt = 0.4;
  assert.equal(update(f).animation, "raising");
  f.b.time = 0.3;
  assert.ok(update(f).frame > 0);
  f.b.time = 0.5;
  assert.equal(update(f).animation, "aiming");
  assert.equal(update(f).frame, 4);
  f.u.state = "Observing contact";
  f.u.presentation.direct = false;
  assert.equal(update(f).animation, "lowering");
  f.b.time = 1.3;
  assert.equal(update(f).animation, "idle");
});
test("E recoil requires a real shot event, consumes no invented shots and never loops an old event", () => {
  const f = fixture();
  f.m.flash = true;
  assert.notEqual(update(f).animation, "firing");
  acquire(f);
  f.b.events = [
    { id: 1, type: "shot", unitId: 1, time: 0, angle: -Math.PI / 4 },
  ];
  assert.equal(update(f).frame, 5);
  assert.equal(update(f).flash, true);
  f.m.flash = false;
  f.b.time = 0.06;
  assert.equal(update(f).frame, 6);
  f.b.time = 0.14;
  assert.equal(update(f).frame, 7);
  f.b.time = 0.3;
  assert.equal(update(f).frame, 4);
  assert.equal(update(f).shotId, null);
  f.m.flash = true;
  f.b.time = 0.73;
  assert.equal(
    update(f).frame,
    4,
    "late flash cannot wrap the laboratory recoil loop",
  );
});
test("unapproved E walking and moving combat never draw planted standing cels over moving feet", () => {
  const f = fixture();
  f.m.moving = true;
  f.m.pose = "walking";
  assert.equal(update(f).supported, false);
  assert.equal(update(f).fallback, "eastArtwork");
  acquire(f);
  assert.equal(update(f).fallback, "movingCombat");
});
test("E directional hysteresis is narrow and cannot fake unsupported views or aim sectors", () => {
  const f = fixture();
  assert.equal(update(f).supported, true);
  // Inverse isometric projection from screen angle to world direction.
  const direction = (deg) =>
    Math.atan2(
      2 * Math.sin((deg * Math.PI) / 180) - Math.cos((deg * Math.PI) / 180),
      2 * Math.sin((deg * Math.PI) / 180) + Math.cos((deg * Math.PI) / 180),
    );
  f.m.renderDirection = direction(8);
  assert.equal(update(f).supported, true);
  f.m.renderDirection = direction(12);
  assert.equal(update(f).supported, false);
  f.m.renderDirection = direction(8);
  assert.equal(update(f).supported, false);
  f.m.renderDirection = direction(5);
  assert.equal(update(f).supported, true);
  acquire(f);
  f.m.direction = direction(25);
  assert.equal(update(f).fallback, "barrel");
});
test("medical, reload, suppression, cover, casualty and other-identity states retain stable fallback", () => {
  for (const pose of [
    "treating",
    "reloading",
    "suppressed",
    "fullCover",
    "grenadeThrow",
    "mounted",
    "dead",
    "incapacitated",
  ]) {
    const f = fixture();
    f.m.pose = pose;
    assert.equal(update(f).supported, false, pose);
  }
  const f = fixture();
  f.u.dead = true;
  f.u.active = false;
  f.b.events = [{ id: 1, type: "shot", unitId: 1, time: 0 }];
  assert.equal(update(f).supported, false);
  assert.equal(update(f).flash, false);
  f.u.dead = false;
  f.u.active = true;
  f.u.id = 2;
  assert.equal(update(f).fallback, "identity");
});
function sceneFixture() {
  const calls = [],
    image = { texture: { key: "eQuiet" } };
  for (const k of [
    "setFrame",
    "setTexture",
    "setOrigin",
    "setScale",
    "setPosition",
    "setRotation",
    "setDepth",
    "setVisible",
  ])
    image[k] = (...a) => {
      calls.push([k, ...a]);
      if (k === "setTexture") image.texture.key = a[0];
      return image;
    };
  return {
    calls,
    image,
    scene: {
      add: { image: () => image },
      cache: { json: { get: (k) => metadata[k] } },
      textures: { exists: () => true },
    },
  };
}
test("E live renderer is one uniform full-body image with measured muzzle and 39px standing scale", () => {
  const f = fixture(),
    { scene, calls } = sceneFixture(),
    r = new LiveEastRenderer(scene);
  f.m.flash = true;
  f.b.events = [
    { id: 1, type: "shot", unitId: 1, time: 0, angle: -Math.PI / 4 },
  ];
  const before = JSON.stringify(f.b);
  r.update(f.b, f.u, f.m, { hit: 0 }, f.u);
  const g = new Proxy({}, { get: () => () => {} });
  assert.equal(
    r.draw(g, f.b, f.u, f.m, { hit: 0 }, { x: 50, y: 100 }, f.u, true),
    true,
  );
  assert.ok(calls.some((c) => c[0] === "setTexture" && c[1] === "eHandling"));
  assert.ok(
    calls.some(
      (c) => c[0] === "setScale" && c.length === 2 && c[1] === 39 / 459,
    ),
  );
  assert.ok(calls.some((c) => c[0] === "setRotation" && c[1] === 0));
  assert.ok(r.shotAnchor(1));
  assert.equal(JSON.stringify(f.b), before);
  assert.equal(r.hitTest({ x: 50, y: 90 }, { x: 50, y: 100 }), true);
  assert.equal(r.snapshot().frame, 5);
});
test("E preload is Pages-subpath safe and excludes prototype walking from live textures", () => {
  const urls = [];
  preloadEastRifleman({
    load: { spritesheet: (k, u) => urls.push(u), json: (k, u) => urls.push(u) },
  });
  assert.equal(urls.length, 4);
  assert.ok(urls.every((u) => u.startsWith("/annous-warfare/assets/")));
  assert.ok(urls.every((u) => !u.includes("walk")));
});
test("E live inspection reports actual renderer, atlas frame and walking rejection instead of a fictitious pose", () => {
  const status = liveRenderStatus({
    mode: "v035",
    enabled: true,
    inView: true,
    east: { visible: true, animation: "firing", frame: 5, reason: "shot" },
  });
  assert.equal(status.renderer, "v035-e");
  assert.match(renderInspection(status, true), /6\/8/);
  const fallback = liveRenderStatus({
    mode: "v035",
    enabled: true,
    inView: true,
    east: { visible: false, fallback: "eastArtwork" },
    legacy: { visible: true, pose: "walking" },
  });
  assert.equal(fallback.renderer, "v031");
  assert.match(fallback.reason, /접지/);
});
test("pause, restart and repeated read-only E observations cannot mutate authoritative input", () => {
  const f = fixture(),
    before = JSON.stringify([f.b, f.u, f.m]);
  const a = update(f);
  for (let i = 0; i < 40; i++) assert.deepEqual(update(f), a);
  assert.equal(JSON.stringify([f.b, f.u, f.m]), before);
  f.b = { time: 0, result: null, events: [] };
  assert.equal(update(f).shotId, null);
});
