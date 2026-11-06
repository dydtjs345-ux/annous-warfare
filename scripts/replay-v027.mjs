import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const [root, cases, out] = process.argv.slice(2),
  { Battle } = await import(pathToFileURL(resolve(root, "src/simulation.js"))),
  results = [];
for (const { cohort, record: c } of JSON.parse(readFileSync(cases))) {
  let rng = c.seed;
  const b = new Battle(
    () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296,
    c.options,
  );
  for (const [i, u] of b.units.entries()) {
    [u.x, u.y] = c.initial[i];
    if (c.scenario === "reduced-reserves")
      u.reserve = Math.floor(u.reserve / 2);
    if (c.scenario === "leg-injuries") u.health["left leg"] = 65;
  }
  const hash = createHash("sha256"),
    plans = new Map(),
    samples = [],
    failures = [];
  let next = 0;
  const move = b.move.bind(b);
  b.move = (u, p, dt) => {
    const r = move(u, p, dt);
    if (r === false && failures.length < 80)
      failures.push({
        at: b.time,
        id: u.id,
        state: u.state,
        blocker: u.movementBlocker,
        target: { x: p.x, y: p.y },
      });
    return r;
  };
  for (let i = 0; i < 18000 && !b.result; i++) {
    b.step(0.1);
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
          u.posture?.mode,
          u.assignment?.type,
          u.mount,
        ]),
      ]),
    );
    for (const q of b.squads) {
      const m = q.maneuver;
      if (m) {
        if (!plans.has(m))
          plans.set(m, {
            at: b.time,
            id: m.unitId,
            target: { ...m.target },
            closest: Infinity,
            stopReason: null,
          });
        const p = plans.get(m),
          u = b.units[m.unitId];
        if (m.until > b.time)
          p.closest = Math.min(
            p.closest,
            Math.hypot(u.x - m.target.x, u.y - m.target.y),
          );
        p.stopReason = m.stopReason ?? null;
        p.until = m.until;
        p.lastState = u.state;
        p.lastSuppression = u.suppression;
        p.lastHealth = { ...u.health };
      }
    }
    if (b.time >= next) {
      next = b.time + 5;
      samples.push({
        at: b.time,
        units: b.units
          .filter((u) => u.active)
          .map((u) => ({
            id: u.id,
            x: u.x,
            y: u.y,
            state: u.state,
            assignment: u.assignment?.type,
            target: u.assignment?.target,
            reason: u.decisionReason,
            ammo: u.ammo,
            health: { ...u.health },
            posture: u.posture?.mode,
            suppression: u.suppression,
            task: u.suppressionTask ? { ...u.suppressionTask } : null,
            crossing: u.crossingReason,
          })),
        phases: b.squads.map((q) => q.search?.phase),
      });
    }
  }
  const digest = hash.digest("hex");
  if (digest !== c.digest)
    throw new Error(`Replay mismatch ${cohort}:${c.seed}`);
  results.push({
    cohort,
    seed: c.seed,
    digest,
    duration: b.time,
    result: b.result,
    plans: [...plans.values()],
    failures,
    samples,
  });
  console.log(cohort, c.seed, b.time, b.result);
}
writeFileSync(out, JSON.stringify(results, null, 2) + "\n");
