import { CombatAtmosphere } from "../src/combat-atmosphere.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  eligiblePrototype,
  prototypePose,
  screenAngle,
  directionFrame,
  SoldierPrototype,
  preloadPrototype,
} from "../src/soldier-prototype.js";
import { Battle } from "../src/simulation.js";
import { CombatVisuals } from "../src/combat-visuals.js";
function scene() {
  const image = () =>
    new Proxy(
      {},
      {
        get: (o, k) =>
          k === "visible"
            ? o[k]
            : (...args) => {
                if (k === "setVisible") o.visible = args[0];
                return imageProxy(o);
              },
      },
    );
  function imageProxy(o) {
    return new Proxy(o, {
      get: (o, k) =>
        k === "visible"
          ? o[k]
          : (...args) => {
              if (k === "setVisible") o.visible = args[0];
              return imageProxy(o);
            },
    });
  }
  return {
    add: { image },
    textures: { exists: () => true },
    game: { loop: { delta: 16.7 } },
  };
}
const sink = new Proxy({}, { get: () => () => {} }),
  iso = (x, y) => ({ x: 20 * (x - y), y: 10 * (x + y) });
test("only nonleader USMC rifleman #1 is eligible at three bounded display sizes", () => {
  const b = new Battle(() => 0.9);
  assert.deepEqual(
    b.units.filter(eligiblePrototype).map((u) => u.id),
    [1],
  );
  for (const size of [1, 1.3, 1.5]) {
    const p = prototypePose(
      b.units[1],
      { direction: 0, stride: 0, renderTop: -30 },
      size,
    );
    assert.equal(p.scale, (size * 30) / 56);
  }
  assert.equal(
    prototypePose(b.units[1], { direction: 0, stride: 0 }, 99).scale,
    30 / 56,
  );
});
test("asset metadata, transparent PNGs and eight-direction frame names agree", () => {
  const root = "public/assets/usmc-rifleman/",
    m = JSON.parse(readFileSync(root + "metadata.json")),
    a = JSON.parse(readFileSync(root + "rifleman.json"));
  assert.equal(m.nativeStandingHeight / m.nativeHeadHeight, 7);
  assert.equal(Object.keys(a.frames).length, 144);
  for (let d = 0; d < 8; d++) {
    assert.ok(a.frames[`torso-${d}`]);
    for (let f = 0; f < 8; f++) assert.ok(a.frames[`stand-${d}-${f}`]);
  }
  const png = readFileSync(root + "rifleman.png");
  assert.equal(png[25], 6, "RGBA atlas");
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 1296);
});
test("asset URLs respect GitHub Pages base and do not depend on a backend", () => {
  const urls = [];
  preloadPrototype({
    load: {
      atlas: (...a) => urls.push(...a.slice(1)),
      image: (_, url) => urls.push(url),
      json: (_, url) => urls.push(url),
    },
  });
  assert.ok(
    urls.every((u) => u.startsWith("/annous-warfare/assets/usmc-rifleman/")),
  );
});
test("weapon direction stays continuous while sprite direction and gait index remain bounded", () => {
  for (let a = -8; a < 8; a += 0.02) {
    const frame = directionFrame(screenAngle(a));
    assert.ok(frame >= 0 && frame < 8);
  }
  assert.ok(Math.abs(screenAngle(0) - Math.atan2(0.5, 1)) < 1e-9);
  const u = new Battle(() => 0.9).units[1];
  assert.ok(
    Math.abs(
      prototypePose(u, { direction: Math.PI / 4, stride: 0 }, 1).foreshorten -
        0.5,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      prototypePose(u, { direction: -Math.PI / 4, stride: 0 }, 1).foreshorten -
        1,
    ) < 1e-9,
  );
});
test("active asset rendering never mutates battle and real flashes use exact projected shot axis", () => {
  const b = new Battle(() => 0.9),
    u = b.units[1],
    visuals = new CombatVisuals();
  visuals.update(b, 0.016, 1, false);
  const p = new SoldierPrototype(scene());
  p.enabled = true;
  const model = visuals.models[1];
  model.flash = true;
  model.direction = 1.2;
  const before = JSON.stringify({ ...u, visibleEnemies: [] });
  assert.equal(
    p.draw(sink, b, u, model, { shot: 0.05, hit: 0 }, iso(u.x, u.y), u, true),
    true,
  );
  assert.equal(p.state.gunAngle, screenAngle(1.2));
  assert.ok(
    Math.abs(
      Math.hypot(
        p.state.muzzle.x - p.state.grip.x,
        p.state.muzzle.y - p.state.grip.y,
      ) -
        24 * p.state.scale * p.state.foreshorten,
    ) < 1e-9,
    "muzzle point follows both axes of the foreshortened rifle",
  );
  b.events = [{ id: 1, type: "shot", unitId: 1, x: u.x, y: u.y, angle: 1.2 }];
  const smoke = new CombatAtmosphere();
  smoke.update(b, 0.016);
  smoke.draw(sink, iso, null, () => p.state);
  assert.deepEqual(smoke.effects[0].assetAnchor.muzzle, p.state.muzzle);
  const observed = p.snapshot();
  p.hide();
  assert.equal(
    observed.visible,
    true,
    "recorded frame snapshot does not mutate when the next frame hides old parts",
  );
  assert.equal(p.state.visible, false);
  const anchored = smoke.effects[0].assetAnchor.muzzle.x;
  p.state.muzzle.x += 1;
  assert.equal(
    smoke.effects[0].assetAnchor.muzzle.x,
    anchored,
    "shot smoke remains at latched muzzle rather than following the soldier",
  );
  assert.equal(JSON.stringify({ ...u, visibleEnemies: [] }), before);
  assert.ok(
    Math.hypot(
      p.state.muzzle.x - p.state.grip.x,
      p.state.muzzle.y - p.state.grip.y,
    ) > 0,
  );
});
test("disabled, dead, incapacitated and unsupported action states retain stock rendering", () => {
  const b = new Battle(() => 0.9),
    u = b.units[1],
    v = new CombatVisuals();
  v.update(b, 0.016, 1, false);
  const p = new SoldierPrototype(scene()),
    m = v.models[1];
  assert.equal(p.draw(sink, b, u, m, {}, iso(u.x, u.y), u, false), false);
  p.enabled = true;
  for (const pose of ["grenadePrep", "grenadeThrow"]) {
    m.pose = pose;
    assert.equal(p.draw(sink, b, u, m, {}, iso(u.x, u.y), u, false), false);
  }
  u.active = false;
  assert.equal(p.draw(sink, b, u, m, {}, iso(u.x, u.y), u, false), false);
});
