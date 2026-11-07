import test from "node:test";
import assert from "node:assert/strict";
import { wallQuad, wallPoint, buildingPalette } from "../src/urban-detail.js";
import { coverVisuals, drawCoverArt } from "../src/cover-art.js";
import { streetProps } from "../src/street-art.js";
import {
  EnvironmentCache,
  buildingBounds,
  pointInPolygon,
  buildingOccludes,
} from "../src/environment-cache.js";
import { Battle } from "../src/simulation.js";
import { houses, obstacles } from "../src/world.js";
import { projection } from "../src/view.js";
test("window quads stay on either correctly sloping wall plane below roof and inside corners", () => {
  for (const [a, b] of [
    [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ],
    [
      { x: 100, y: 0 },
      { x: 0, y: 50 },
    ],
  ]) {
    const q = wallQuad(a, b, 0.24, 0.76, 10, 26);
    assert.equal(Math.sign(q[1].y - q[0].y), 1);
    assert.equal(Math.sign(q[1].x - q[0].x), Math.sign(b.x - a.x));
    assert.deepEqual(q[0], wallPoint(a, b, 0.24, 26));
    assert.deepEqual(q[3], wallPoint(a, b, 0.24, 10));
  }
});
test("visual grouping covers each physical cell once without mutating collision map", () => {
  new Battle(() => 0.9, { map: "expanded", variant: 0 });
  const before = [...obstacles];
  const ds = coverVisuals(obstacles),
    cells = ds.flatMap((d) => d.cells.map((c) => c.join(",")));
  assert.equal(new Set(cells).size, obstacles.size);
  assert.equal(cells.length, obstacles.size);
  assert.deepEqual([...obstacles], before);
  assert.ok(ds.some((d) => d.type === "vehicle" && d.cells.length === 2));
});
test("street fittings are deterministic and anchored to existing solid foundation cells", () => {
  new Battle(() => 0.9, { map: "expanded" });
  const a = streetProps(houses);
  assert.deepEqual(a, streetProps(houses));
  assert.equal(a.length, 24);
  for (const d of a)
    assert.equal(
      obstacles.get(`${Math.round(d.x)},${Math.round(d.y)}`),
      "wall",
    );
});
test("cover painters do not write geometry and remain inside fixed local bounds", () => {
  for (const type of ["sandbag", "concrete", "crates", "vehicle"]) {
    const d = {
        x: 0,
        y: 0,
        type,
        cells: [
          [0, 0],
          [1, 0],
        ],
      },
      before = JSON.stringify(d),
      points = [];
    const g = new Proxy(
      {},
      {
        get:
          (_, k) =>
          (...args) => {
            if (k === "fillPoints") points.push(...args[0]);
          },
      },
    );
    assert.equal(drawCoverArt(g, d, { x: 0, y: 0 }, 18), true);
    assert.equal(JSON.stringify(d), before);
    assert.ok(
      points.every((p) => Math.abs(p.x) <= 40 && p.y >= -40 && p.y <= 25),
    );
  }
});
test("selected occlusion requires actual projected overlap and foreground depth", () => {
  const h = { x: 5, y: 5, w: 6, h: 6 },
    iso = projection(54, 44).project;
  assert.equal(buildingOccludes(h, { x: 20, y: 20 }, iso), false);
  assert.equal(buildingOccludes(h, { x: 4.5, y: 6 }, iso), true);
  assert.equal(buildingOccludes(h, { x: 1, y: 1 }, iso), false);
  assert.equal(
    pointInPolygon({ x: 2, y: 2 }, [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ]),
    true,
  );
  const b = buildingBounds(h, iso);
  assert.ok(b.width > 200 && b.height > 100);
});
test("cache owns static textures once, culls without repainting, and frees them", () => {
  let generated = 0,
    removed = 0;
  const g = new Proxy(
      {},
      {
        get: (_, k) => () => {
          if (k === "generateTexture") generated++;
        },
      },
    ),
    sprite = () => ({
      setOrigin() {
        return this;
      },
      setDepth() {
        return this;
      },
      setVisible() {
        return this;
      },
      setAlpha() {
        return this;
      },
      destroy() {},
    }),
    scene = {
      make: { graphics: () => g },
      add: { image: sprite },
      textures: { remove: () => removed++ },
    };
  const c = new EnvironmentCache(
    scene,
    [{ x: 1, y: 1, type: "concrete" }],
    (x, y) => ({ x: x * 20, y: y * 10 }),
    () => {},
  );
  for (let i = 0; i < 100; i++)
    c.update(
      { x: 0, y: 0, width: 100, height: 100 },
      null,
      () => ({ x: 0, y: 0 }),
      () => true,
    );
  assert.equal(generated, 1);
  c.destroy();
  assert.equal(removed, 1);
  assert.equal(c.records.length, 0);
});
