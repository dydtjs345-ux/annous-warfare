import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
    { contactTTL: c.scenario === "short-contact" ? 6 : 8 },
  );
  for (const u of b.units) {
    if (c.scenario === "reduced-reserves")
      u.reserve = Math.floor(u.reserve / 2);
    if (c.scenario === "leg-injuries") u.health["left leg"] = 65;
  }
  const failures = [],
    medicalHolds = [],
    staleAssignments = [],
    waits = [];
  const move = b.move.bind(b);
  b.move = (u, goal, dt) => {
    const result = move(u, goal, dt);
    if (result === false)
      failures.push({
        time: b.time,
        id: u.id,
        role: u.role,
        position: [u.x, u.y],
        state: u.state,
        goal: { x: goal.x, y: goal.y },
        reason: u.movementBlocker,
        patient: u.patientId,
        assignment: u.assignment?.type,
        near: b.units
          .filter(
            (a) =>
              a !== u && !a.dead && Math.hypot(a.x - goal.x, a.y - goal.y) < 2,
          )
          .map((a) => ({
            id: a.id,
            team: a.team,
            active: a.active,
            x: a.x,
            y: a.y,
          })),
        health: { ...u.health },
      });
    return result;
  };
  for (let step = 0; step < 18000 && !b.result; step++) {
    b.step(0.1);
    for (const u of b.units) {
      if (u.navigation.startsWith("Receiving"))
        medicalHolds.push({
          time: b.time,
          id: u.id,
          failed: u.assignment?.failed,
          until: u.assignment?.until,
          lastMovement: u.assignment?.lastMovement,
        });
      if (
        u.alternativeRejection === "Assigned approach made no movement progress"
      )
        staleAssignments.push({
          time: b.time,
          id: u.id,
          state: u.state,
          medic: b.units.some(
            (m) =>
              m.role === "Medic" &&
              m.patientId === u.id &&
              m.state === "Treating" &&
              m.active,
          ),
        });
    }
    if (step % 100 === 0)
      waits.push({
        time: b.time,
        units: b.units
          .filter((u) => u.active)
          .map((u) => ({
            id: u.id,
            state: u.state,
            position: [u.x, u.y],
            why: u.diagnostics.decision,
            alternatives: u.alternativeRejection,
            ammo: u.ammo,
            reserve: u.reserve,
            assignment: u.assignment ? structuredClone(u.assignment) : null,
            goal: u.target,
            patient: u.patientId,
            health: { ...u.health },
            suppression: u.suppression,
            progress: u.diagnostics.progressAge,
          })),
      });
  }
  out.push({
    ...c,
    duration: b.time,
    result: b.result,
    failures,
    medicalHoldSteps: medicalHolds.length,
    medicalNoProgressFailures: staleAssignments.filter((s) => s.medic).length,
    staleAssignments: staleAssignments.filter(
      (s, i) => i === 0 || s.time - staleAssignments[i - 1].time > 0.2,
    ),
    waits,
  });
}
writeFileSync(process.argv[4], JSON.stringify(out, null, 2) + "\n");
console.log(
  out.map((r) => ({
    seed: r.seed,
    failures: r.failures.length,
    hold: r.medicalHoldSteps,
    falseFailures: r.medicalNoProgressFailures,
  })),
);
