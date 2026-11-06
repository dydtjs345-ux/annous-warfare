import test from "node:test";
import assert from "node:assert/strict";
import {
  projection,
  fitZoom,
  framedView,
  pickSoldier,
  inView,
} from "../src/view.js";
import { expandedSpawns } from "../src/expanded-world.js";
test("dynamic isometric projection round-trips legacy and expanded corner coordinates", () => {
  for (const [w, h] of [
    [30, 26],
    [54, 44],
  ]) {
    const p = projection(w, h);
    for (const [x, y] of [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
      [w * 0.73, h * 0.21],
    ]) {
      const a = p.project(x, y),
        b = p.inverse(a.x, a.y);
      assert.ok(Math.abs(x - b.x) < 1e-8 && Math.abs(y - b.y) < 1e-8);
    }
  }
});
test("map overview fits every corner in portrait and landscape, while squad focus stays readable", () => {
  const p = projection(54, 44);
  for (const [width, height] of [
    [390, 540],
    [844, 190],
  ]) {
    const zoom = fitZoom(p.bounds, width, height),
      v = framedView(p.bounds, width, height, zoom, { x: 1000, y: 500 });
    for (const [x, y] of [
      [0, 0],
      [53, 0],
      [0, 43],
      [53, 43],
    ])
      assert.ok(inView(p.project(x, y), v, 0));
    assert.ok(Math.min(1, width / 450) > zoom * 2);
  }
});
test("camera centers are clamped at each map edge", () => {
  const p = projection(54, 44),
    b = p.bounds;
  for (const c of [
    { x: -1e5, y: -1e5 },
    { x: 1e5, y: 1e5 },
  ]) {
    const v = framedView(b, 390, 540, 0.9, c);
    assert.ok(v.x >= b.x - 1e-8 && v.y >= b.y - 1e-8);
    assert.ok(
      v.x + v.width <= b.x + b.width + 1e-8 &&
        v.y + v.height <= b.y + b.height + 1e-8,
    );
  }
});
test("soldiers can be picked at every expanded spawn and zoom after a pan", () => {
  const p = projection(54, 44);
  for (let mode = 0; mode < 3; mode++) {
    const units = expandedSpawns(mode)
      .flat()
      .map((u, id) => ({ ...u, id }));
    for (const zoom of [0.18, 0.85, 2.5])
      for (const u of units) {
        const pos = p.project(u.x, u.y);
        assert.equal(
          pickSoldier(units, { x: pos.x, y: pos.y - 12 }, zoom, p.project)?.id,
          u.id,
        );
      }
  }
});
