import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Battle } from "../src/simulation.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const { Battle: Base } = await import(
  pathToFileURL(
    resolve(process.argv[2] || "/tmp/aw-v028-base", "src/simulation.js"),
  )
);
import { inspectKorean, observeDecision } from "../src/korean-inspector.js";
import { drawReadability } from "../src/readability.js";
const sink = new Proxy({}, { get: () => () => {} }),
  runs = [];
for (const map of ["legacy", "expanded"])
  for (let seed = 2001; seed <= 2020; seed++) {
    const results = [];
    for (const [index, Type] of [Base, Battle].entries()) {
      let rng = seed;
      const b = new Type(
        () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296,
        {
          map,
          variant: (seed - 2001) % 4,
          spawn: Math.floor((seed - 2001) / 16) % 3,
          grenades: map === "expanded",
        },
      );
      const hash = createHash("sha256");
      for (let tick = 0; tick < 36000 && !b.result; tick++) {
        b.step(0.05);
        if (index)
          for (const u of b.units) {
            observeDecision(u, b.time);
            if (tick % 4 === 0) {
              inspectKorean(u, b.time, true);
              drawReadability(sink, u, { x: u.x, y: u.y }, (x, y) => ({
                x,
                y,
              }));
            }
          }
        hash.update(
          JSON.stringify([
            rng,
            b.time,
            b.result,
            b.grenadeStats,
            b.units.map((u) => [
              u.x,
              u.y,
              u.health,
              u.ammo,
              u.reserve,
              u.state,
              u.facing,
              u.suppression,
              u.assignment,
              u.posture,
              u.mount,
              u.treat,
              u.patientId,
              u.route,
              u.navigation,
              u.progress,
              u.diagnostics,
              u.activity,
            ]),
            b.squads.map((q) => [
              q.goal,
              q.maneuver,
              q.search?.phase,
              q.search?.goal,
            ]),
          ]),
        );
      }
      assert.ok(b.result, `${map}/${seed} timed out`);
      results.push({
        duration: b.time,
        result: b.result,
        digest: hash.digest("hex"),
      });
    }
    assert.deepEqual(results[0], results[1], `${map}/${seed} diverged`);
    runs.push({ map, seed, ...results[1] });
    console.log(map, seed, results[1].duration);
  }
writeFileSync(
  "reports/v028-parity.json",
  JSON.stringify(
    { base: "f94d0ed", dt: 0.05, matched: 40, completeExecutions: 80, runs },
    null,
    2,
  ) + "\n",
);
