import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Battle } from "../src/simulation.js";
import {
  W,
  H,
  houses,
  obstacles,
  blocked,
  configureWorld,
  sight,
  cover,
} from "../src/world.js";
import { expandedSpawns } from "../src/expanded-world.js";
import { searchRoutes } from "../src/search-path.js";
afterEach(() => configureWorld("legacy"));
test("expanded layouts have 54×44 dimensions, one connected free component, and no building interiors", () => {
  for (let v = 0; v < 4; v++) {
    configureWorld("expanded", v);
    assert.equal(W, 54);
    assert.equal(H, 44);
    const tree = searchRoutes({ x: 2, y: 8 });
    let free = 0;
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++)
        if (!blocked(x, y)) {
          free++;
          assert.ok(Number.isFinite(tree.distance({ x, y })), `${v}:${x},${y}`);
        }
    assert.ok(free / 502 > 2.25 && free / 502 < 4);
    assert.equal(houses.length, 12);
    for (const h of houses)
      for (let x = h.x; x < h.x + h.w; x++)
        for (let y = h.y; y < h.y + h.h; y++) assert.ok(blocked(x, y));
  }
});
test("four layouts are distinct and generation is reproducible without combat RNG", () => {
  const hashes = [];
  for (let v = 0; v < 4; v++) {
    configureWorld("expanded", v);
    const a = JSON.stringify([...obstacles]);
    configureWorld("legacy");
    configureWorld("expanded", v);
    assert.equal(JSON.stringify([...obstacles]), a);
    hashes.push(createHash("sha256").update(a).digest("hex"));
  }
  assert.equal(new Set(hashes).size, 4);
});
test("all three spawn configurations are separated, navigable, and initially unknown", () => {
  for (let v = 0; v < 4; v++)
    for (let spawn = 0; spawn < 3; spawn++) {
      let draws = 0;
      const b = new Battle(
        () => {
          draws++;
          return 0.99;
        },
        { map: "expanded", variant: v, spawn, grenades: true },
      );
      assert.equal(draws, 0);
      assert.deepEqual(
        b.units.map((u) => ({ x: u.x, y: u.y })),
        expandedSpawns(spawn).flat(),
      );
      for (const u of b.units) {
        assert.ok(!blocked(Math.round(u.x), Math.round(u.y)));
        for (const e of b.units)
          if (e.team !== u.team)
            assert.ok(Math.hypot(u.x - e.x, u.y - e.y) > 25);
      }
      assert.ok(
        b.squads.every(
          (s) => s.intel.contacts.size === 0 && s.search.lastVisual === null,
        ),
      );
      b.step(0.1);
      assert.ok(b.squads.every((s) => s.intel.contacts.size === 0));
    }
});
test("legacy dimensions, geometry and spawn coordinates restore after an expanded match", () => {
  configureWorld("legacy");
  const original = JSON.stringify([...obstacles]);
  new Battle(() => 0.99, { map: "expanded" });
  const b = new Battle(() => 0.99);
  assert.equal(W, 30);
  assert.equal(H, 26);
  assert.equal(JSON.stringify([...obstacles]), original);
  assert.equal(b.units[0].x, 2);
  assert.equal(b.units[6].x, 27);
  assert.equal(b.searchEnabled, false);
});
test("expanded low cover preserves directional firing and sealed blocks stop bullets", () => {
  configureWorld("expanded");
  assert.ok(sight({ x: 8, y: 13 }, { x: 8, y: 16 }));
  assert.ok(cover({ x: 8, y: 13 }, { x: 8, y: 16 }) > 0.6);
  assert.equal(cover({ x: 8, y: 13 }, { x: 8, y: 10 }), 0);
  assert.equal(sight({ x: 4, y: 8 }, { x: 13, y: 8 }), false);
  assert.ok(searchRoutes({ x: 4, y: 8 }).route({ x: 13, y: 8 }).length > 9);
});
