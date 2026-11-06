// Independent read-only accounting of reported failure classes on identical cases.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const { Battle } = await import(
  pathToFileURL(resolve(process.argv[2], "src/simulation.js"))
);
const cases = JSON.parse(readFileSync(process.argv[3])).runs;
const runs = [];
for (const c of cases) {
  let r = c.seed;
  const b = new Battle(
    () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296,
    { contactTTL: c.scenario === "short-contact" ? 6 : 8 },
  );
  for (const u of b.units) {
    if (c.scenario === "reduced-reserves")
      u.reserve = Math.floor(u.reserve / 2);
    if (c.scenario === "leg-injuries") u.health["left leg"] = 65;
  }
  const reasons = {};
  const note = b.noteMovementFailure.bind(b);
  b.noteMovementFailure = (u) => {
    const before = u.progress?.failedAttempts ?? 0;
    note(u);
    const count = (u.progress?.failedAttempts ?? 0) - before;
    if (count > 0) {
      const key = u.movementBlocker ?? "unspecified";
      reasons[key] = (reasons[key] ?? 0) + count;
    }
  };
  const h = createHash("sha256");
  for (let i = 0; i < 18000 && !b.result; i++) {
    b.step(0.1);
    h.update(
      JSON.stringify([
        r,
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
          u.mount,
          u.assignment?.type,
        ]),
      ]),
    );
  }
  runs.push({
    seed: c.seed,
    scenario: c.scenario,
    duration: b.time,
    result: b.result,
    reasons,
    digest: h.digest("hex"),
  });
  if (c.seed % 50 === 0) console.log(c.seed);
}
writeFileSync(process.argv[4], JSON.stringify({ runs }, null, 2) + "\n");
