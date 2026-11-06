import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
const root = resolve(process.argv[2] || ".");
const { Battle } = await import(
  pathToFileURL(resolve(root, "src/simulation.js"))
);
const fields = [
  "id",
  "team",
  "role",
  "x",
  "y",
  "facing",
  "health",
  "ammo",
  "reserve",
  "reload",
  "cooldown",
  "active",
  "dead",
  "state",
  "order",
  "target",
  "route",
  "routeGoal",
  "memory",
  "suppression",
  "patientId",
  "treat",
  "assignment",
  "navProgressAt",
  "progress",
  "failedGoal",
  "reconRetryAt",
  "casualtyResponse",
  "engagementId",
  "aimAt",
  "lastConfirmedAt",
];
const results = [];
for (let seed = 1; seed <= 10; seed++) {
  let rng = seed,
    calls = 0;
  const b = new Battle(() => {
    calls++;
    return (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296;
  });
  const hash = createHash("sha256");
  let steps = 0;
  for (; steps < 36000 && !b.result; steps++) {
    b.step(0.05);
    if (steps % 100 === 0 || b.result)
      hash.update(
        JSON.stringify({
          time: b.time,
          result: b.result,
          units: b.units.map((u) =>
            Object.fromEntries(fields.map((k) => [k, u[k]])),
          ),
          goals: b.squads.map((s) => s.goal),
        }),
      );
  }
  results.push({
    seed,
    finished: !!b.result,
    result: b.result,
    time: b.time,
    steps,
    rng,
    calls,
    fingerprint: hash.digest("hex"),
  });
}
if (process.argv[4]) {
  const baseline = JSON.parse(readFileSync(process.argv[4], "utf8"));
  if (JSON.stringify(results) !== JSON.stringify(baseline))
    throw new Error("Authoritative simulation diverged from main");
}
if (process.argv[3])
  writeFileSync(process.argv[3], JSON.stringify(results, null, 2) + "\n");
console.log(
  JSON.stringify({
    matches: results.length,
    allFinished: results.every((r) => r.finished),
    parity: process.argv[4] ? "exact" : "baseline recorded",
  }),
);
