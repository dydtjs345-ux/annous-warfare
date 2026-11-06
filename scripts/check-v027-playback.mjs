// Full-match parity at the browser's fixed 0.05s step. Graphics calls use a sink;
// real mobile Chromium checks are separate and do not claim this is GPU testing.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { Battle } from "../src/simulation.js";
import { CombatVisuals } from "../src/combat-visuals.js";
import { GrenadeVisuals } from "../src/grenade-visuals.js";
const sink = new Proxy({}, { get: () => () => {} }),
  iso = (x, y) => ({ x: 1000 + (x - y) * 20, y: 55 + (x + y) * 10 }),
  runs = [];
for (const seed of [2001, 2002, 2011, 2012, 2017, 2037]) {
  let expected;
  for (const speed of [0, 1, 2, 4]) {
    let rng = seed;
    const index = seed - 2001,
      options = {
        map: "expanded",
        variant: index % 4,
        spawn: Math.floor(index / 16) % 3,
        grenades: true,
      };
    const b = new Battle(
        () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296,
        options,
      ),
      units = new CombatVisuals(),
      grenades = new GrenadeVisuals(),
      hash = createHash("sha256");
    for (let tick = 0; tick < 36000 && !b.result; tick++) {
      b.step(0.05);
      if (speed && tick % speed === 0) {
        units.update(b, 0.05, speed, false);
        grenades.update(b, 0.05, speed, false);
        for (const u of b.units)
          units.drawUnit(sink, b, u, iso(u.x, u.y), iso, false);
        units.drawTraces(sink, iso);
        grenades.draw(sink, iso);
      }
      hash.update(
        JSON.stringify([
          rng,
          b.time,
          b.result,
          b.units.map((u) => [
            u.x,
            u.y,
            u.health,
            u.ammo,
            u.reserve,
            u.state,
            u.facing,
            u.posture,
            u.assignment?.type,
            u.mount,
          ]),
          b.squads.map((q) => [
            q.search.phase,
            q.search.goal,
            [...q.search.seen],
          ]),
        ]),
      );
    }
    if (!b.result) throw new Error(`Browser-step timeout ${seed}/${speed}`);
    const digest = hash.digest("hex");
    if (!speed) expected = digest;
    else if (digest !== expected)
      throw new Error(`Playback changed combat ${seed}/${speed}`);
    runs.push({
      seed,
      options,
      speed: speed || "headless",
      dt: 0.05,
      duration: b.time,
      result: b.result,
      digest,
      grenades: { ...b.grenadeStats },
    });
    console.log(seed, speed || "headless", b.time, b.result);
  }
}
writeFileSync(
  process.argv[2] || "reports/v027-playback-parity.json",
  JSON.stringify(
    {
      method:
        "default browser-health/ammo fixtures; full-match 0.05s step; headless vs render-model grouping at 1/2/4x; not a GPU benchmark",
      runs,
    },
    null,
    2,
  ) + "\n",
);
