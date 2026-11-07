import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prototypePose, SoldierPrototype } from "../src/soldier-prototype.js";
import { Battle } from "../src/simulation.js";
import { CombatVisuals } from "../src/combat-visuals.js";
const root = "public/assets/usmc-rifleman-v031/",
  meta = JSON.parse(readFileSync(root + "metadata.json")),
  atlas = JSON.parse(readFileSync(root + "rifleman.json"));
test("new anatomy has more torso and shorter relative legs than v030", () => {
  assert.equal(meta.hipAnchor[1], 62);
  assert.ok(
    (meta.footAnchor[1] - meta.hipAnchor[1]) / meta.nativeStandingHeight <
      (64 - 34) / 56,
  );
  assert.equal(meta.nativeStandingHeight, 80);
  assert.ok(meta.shoulders[1][0] - meta.shoulders[0][0] > 13);
});
test("trimmed atlas retains consistent logical frames, pivots and complete walk/run/crouch/prone families", () => {
  assert.equal(Object.keys(atlas.frames).length, 264);
  for (let d = 0; d < 8; d++)
    for (const family of ["stand", "run", "crouch", "prone"])
      for (let f = 0; f < 8; f++) {
        const v = atlas.frames[`${family}-${d}-${f}`];
        assert.deepEqual(v.sourceSize, { w: 96, h: 112 });
        assert.equal(v.trimmed, true);
        assert.ok(
          v.frame.x + v.frame.w <= atlas.meta.size.w &&
            v.frame.y + v.frame.h <= atlas.meta.size.h,
        );
        assert.ok(
          v.spriteSourceSize.x + v.spriteSourceSize.w <= 96 &&
            v.spriteSourceSize.y + v.spriteSourceSize.h <= 112,
        );
      }
  assert.ok(atlas.meta.size.w * atlas.meta.size.h * 4 < 2000000);
});
test("metadata-driven adapter preserves feet, isolates #1 and keeps actual muzzle alignment across banks", () => {
  const calls = [],
    image = () => {
      let p;
      p = new Proxy(
        {},
        {
          get:
            (_, k) =>
            (...a) => {
              calls.push([k, ...a]);
              return p;
            },
        },
      );
      return p;
    };
  const scene = {
      cache: { json: { get: (k) => (k === "usmc031-meta" ? meta : null) } },
      textures: { exists: () => true },
      add: { image },
      game: { loop: { delta: 16 } },
    },
    p = new SoldierPrototype(scene),
    b = new Battle(() => 0.9),
    v = new CombatVisuals();
  v.update(b, 0.016, 1, false);
  p.enabled = true;
  p.visualSize = 1.5;
  const u = b.units[1],
    m = v.models[1],
    before = JSON.stringify(u);
  m.flash = true;
  m.direction = 1;
  const g = new Proxy({}, { get: () => () => {} });
  p.draw(g, b, u, m, { shot: 0.04, hit: 0 }, { x: 50, y: 100 }, u, true);
  assert.equal(p.art, "v031");
  assert.equal(p.state.scale, 45 / 80);
  assert.equal(JSON.stringify(u), before);
  assert.ok(
    Math.abs(
      Math.hypot(
        p.state.muzzle.x - p.state.grip.x,
        p.state.muzzle.y - p.state.grip.y,
      ) -
        32 * p.state.scale * p.state.foreshorten,
    ) < 1e-9,
  );
  p.setArt("v030");
  p.draw(g, b, u, m, { shot: 0.04, hit: 0 }, { x: 50, y: 100 }, u, true);
  assert.equal(p.state.scale, 45 / 56);
  assert.ok(
    calls.some(
      (c) => c[0] === "setOrigin" && c[1] === 0.5 && c[2] === 96 / 112,
    ),
  );
});
test("new PNGs are RGBA, native dimensions match the rig, and direction layers stay independent", () => {
  for (const [name, size] of Object.entries({
    rifleman: [atlas.meta.size.w, atlas.meta.size.h],
    sleeve: [9, 20],
    forearm: [9, 20],
    m16a4: meta.weaponSize,
  })) {
    const png = readFileSync(root + name + ".png");
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], size);
    assert.equal(png[25], 6, "RGBA source, not opaque background art");
  }
  const u = {
    id: 1,
    team: 0,
    role: "Rifleman",
    active: true,
    facing: 0,
    movementHeading: Math.PI,
  };
  const p = prototypePose(
    u,
    { direction: 0, moving: true, renderStride: Math.PI, renderTop: -25 },
    1.3,
    meta,
  );
  assert.notEqual(
    p.body,
    p.legs,
    "weapon and travel direction select separate octants",
  );
  assert.equal(p.phase, 4);
  assert.equal(p.lowering, 0.5);
});
