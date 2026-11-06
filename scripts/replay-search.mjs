import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { searchObserver } from "./search-observer.mjs";
const root = resolve(process.argv[2]),
  { Battle } = await import(pathToFileURL(resolve(root, "src/simulation.js")));
const cases = JSON.parse(readFileSync(process.argv[3])),
  out = [];
for (const c of cases) {
  let r = c.seed;
  const b = new Battle(
    () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296,
    {
      map: c.config.map.kind,
      variant: c.config.map.variant,
      spawn: c.config.spawn,
      grenades: c.config.grenades,
      contactTTL: c.scenario === "short-contact" ? 6 : 8,
    },
  );
  for (const u of b.units) {
    if (c.scenario === "reduced-reserves")
      u.reserve = Math.floor(u.reserve / 2);
    if (c.scenario === "leg-injuries") u.health["left leg"] = 65;
    [u.x, u.y] = c.config.initialPositions[u.id];
  }
  const core = createHash("sha256"),
    observer = searchObserver(b),
    samples = [],
    events = [],
    failures = [],
    goals = [];
  let failureCalls = 0;
  const lastRevision = [0, 0],
    move = b.move.bind(b);
  b.move = (u, goal, dt) => {
    const result = move(u, goal, dt);
    if (!result) {
      failureCalls++;
      if (failures.length < 120)
        failures.push({
          time: b.time,
          id: u.id,
          role: u.role,
          state: u.state,
          position: { x: u.x, y: u.y },
          goal: { x: goal.x, y: goal.y },
          blocker: u.movementBlocker,
          assignment: u.assignment?.type,
          route: u.route.slice(0, 6),
          patient: u.patientId,
        });
    }
    return result;
  };
  for (let i = 0; i < 18000 && !b.result; i++) {
    b.step(0.1);
    observer.step(0.1);
    core.update(
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
    for (let team = 0; team < 2; team++) {
      const q = b.squads[team],
        s = q.search;
      if (lastRevision[team] !== s.revision) {
        lastRevision[team] = s.revision;
        goals.push({
          time: b.time,
          team,
          phase: s.phase,
          goal: s.goal,
          reason: s.reason,
          coverage: s.seen.filter(Number.isFinite).length,
          commander: q.commanderId,
          assignments: [...q.assignments.values()].map((a) => [
            a.unitId,
            a.type,
            a.target,
          ]),
        });
      }
    }
    for (const e of b.events)
      if (
        e.time === b.time &&
        [
          "grenadeThrow",
          "grenadeBlast",
          "incapacitated",
          "death",
          "treatmentComplete",
          "mountState",
        ].includes(e.type)
      )
        events.push(e);
    if (i % 100 === 0)
      samples.push({
        time: b.time,
        squads: b.squads.map((q) => ({
          phase: q.search.phase,
          goal: q.search.goal,
          coverage: q.search.seen.filter(Number.isFinite).length,
          reason: q.search.blocker ?? q.search.reason,
          contacts: [...q.intel.contacts.values()],
          sounds: [...q.intel.sounds.values()],
        })),
        units: b.units
          .filter((u) => u.active)
          .map((u) => ({
            id: u.id,
            role: u.role,
            x: u.x,
            y: u.y,
            state: u.state,
            ammo: u.ammo,
            reserve: u.reserve,
            frags: u.frags,
            health: { ...u.health },
            suppression: u.suppression,
            assignment: u.assignment
              ? {
                  type: u.assignment.type,
                  target: u.assignment.target,
                  reason: u.assignment.reason,
                  failed: u.assignment.failed,
                }
              : null,
            decision: u.diagnostics.decision,
            blocker: u.movementBlocker,
            patient: u.patientId,
            mount: u.mount?.state,
            visible: u.visibleEnemies.map((e) => e.id),
          })),
      });
  }
  out.push({
    ...c,
    replayedDuration: b.time,
    result: b.result,
    digest: core.digest("hex"),
    search: observer.finish(),
    failureCalls,
    failures,
    goals,
    events,
    samples,
  });
  console.log(c.seed, b.time, b.result);
}
writeFileSync(process.argv[4], JSON.stringify(out, null, 2) + "\n");
