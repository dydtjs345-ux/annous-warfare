import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const root = resolve(process.argv[2]);
const { Battle } = await import(
  pathToFileURL(resolve(root, "src/simulation.js"))
);
const cases = JSON.parse(readFileSync(process.argv[3]));
const out = [];
for (const c of cases) {
  let r = c.seed;
  const b = new Battle(
    () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296,
    {
      contactTTL: c.scenario === "short-contact" ? 6 : 8,
      map: c.config.map.kind,
      variant: c.config.map.variant,
      grenades: c.config.grenades,
    },
  );
  for (const u of b.units) {
    if (c.scenario === "reduced-reserves")
      u.reserve = Math.floor(u.reserve / 2);
    if (c.scenario === "leg-injuries") u.health["left leg"] = 65;
    [u.x, u.y] = c.config.initialPositions[u.id];
  }
  const h = createHash("sha256"),
    samples = [],
    events = [];
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
    for (const e of b.events)
      if (
        e.time === b.time &&
        ["grenadeThrow", "grenadeBlast"].includes(e.type)
      )
        events.push(e);
    if (i % 100 === 0)
      samples.push({
        time: b.time,
        units: b.units
          .filter((u) => u.active)
          .map((u) => ({
            id: u.id,
            state: u.state,
            decision: u.diagnostics.decision,
            alternatives: u.alternativeRejection,
            pos: [u.x, u.y],
            ammo: u.ammo,
            reserve: u.reserve,
            health: { ...u.health },
            suppression: u.suppression,
            assignment: u.assignment?.type,
            patient: u.patientId,
            care: u.careCheck,
            grenade: u.grenadeThreat,
          })),
      });
  }
  out.push({
    ...c,
    replayedDuration: b.time,
    result: b.result,
    digest: h.digest("hex"),
    grenades: b.grenadeStats,
    events,
    samples,
  });
}
writeFileSync(process.argv[4], JSON.stringify(out, null, 2) + "\n");
console.log(out.map((r) => [r.seed, r.replayedDuration, r.result]));
