import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(process.argv[2]);
const { Battle } = await import(
  pathToFileURL(resolve(root, "src/simulation.js"))
);
const { sight, cover } = await import(
  pathToFileURL(resolve(root, "src/world.js"))
);
const cases = JSON.parse(readFileSync(process.argv[3]));
const results = [];
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
  const previous = b.units.map(() => ({
    target: null,
    state: null,
    patient: null,
  }));
  const changes = [],
    protectedWaits = [],
    medicalChanges = [];
  for (let step = 0; step < 18000 && !b.result; step++) {
    b.step(0.1);
    for (const u of b.units) {
      const p = previous[u.id];
      const t = u.coverTarget ? `${u.coverTarget.x},${u.coverTarget.y}` : null;
      if (t && p.target && t !== p.target)
        changes.push({
          time: b.time,
          id: u.id,
          from: p.target,
          to: t,
          position: [u.x, u.y],
          decision: u.coverEvaluation
            ? structuredClone(u.coverEvaluation)
            : null,
          assignment: u.assignment?.type,
        });
      p.target = t;
      if (u.role !== "Medic") continue;
      if (u.state !== p.state || u.patientId !== p.patient) {
        medicalChanges.push({
          time: b.time,
          id: u.id,
          from: p.state,
          to: u.state,
          previousPatient: p.patient,
          patient: u.patientId,
          progress: u.treat,
          visible: u.visibleEnemies.map((e) => e.id),
          suppression: u.suppression,
          assignment: u.assignment?.type,
          reason: u.diagnostics.decision,
        });
        p.state = u.state;
        p.patient = u.patientId;
      }
      if (
        !u.active ||
        u.reload > 0 ||
        u.suppression >= 0.35 ||
        u.presentation.treating ||
        b.time < (u.alert?.readyAt ?? 0)
      )
        continue;
      const threats = [...u.intel.contacts.values()].filter(
        (t) => b.time - t.time < b.contactTTL,
      );
      const patient = b.units.find(
        (a) =>
          a !== u &&
          a.team === u.team &&
          !a.dead &&
          Math.min(...Object.values(a.health)) < 65 &&
          Math.hypot(a.x - u.x, a.y - u.y) < 1.4 &&
          sight(u, a) &&
          threats.length &&
          threats.every(
            (t) =>
              (!sight(u, t) || cover(u, t) >= 0.28) &&
              (!sight(a, t) || cover(a, t) >= 0.28),
          ),
      );
      if (patient && u.visibleEnemies.length)
        protectedWaits.push({
          time: b.time,
          id: u.id,
          patient: patient.id,
          state: u.state,
          assignment: u.assignment?.type,
          visible: u.visibleEnemies.map((e) => e.id),
          protection: threats.map((t) => ({
            medic: cover(u, t),
            patient: cover(patient, t),
          })),
        });
    }
  }
  results.push({
    ...c,
    duration: b.time,
    coverSwitches: changes.length,
    protectedWaitSteps: protectedWaits.length,
    coverChanges: changes,
    protectedWaitExamples: protectedWaits
      .filter(
        (_, i) => i % Math.max(1, Math.floor(protectedWaits.length / 8)) === 0,
      )
      .slice(0, 8),
    medicalChanges,
  });
}
writeFileSync(process.argv[4], JSON.stringify(results, null, 2) + "\n");
console.log(
  results.map((r) => ({
    seed: r.seed,
    switches: r.coverSwitches,
    protectedWaits: r.protectedWaitSteps,
    medicalTransitions: r.medicalChanges.length,
  })),
);
