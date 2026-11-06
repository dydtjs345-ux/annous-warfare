// Same read-only sampler against archived main and this checkout. No AI inputs.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
const root = resolve(process.argv[2] || ".");
const { Battle } = await import(
  pathToFileURL(resolve(root, "src/simulation.js"))
);
const { sight, cover } = await import(
  pathToFileURL(resolve(root, "src/world.js"))
);
import { createHash } from "node:crypto";
const renderEnabled = process.argv[7] === "render";
const { CombatVisuals } = renderEnabled
  ? await import(pathToFileURL(resolve(root, "src/combat-visuals.js")))
  : {};
const sink = new Proxy({}, { get: () => () => {} });
const iso = (x, y) => ({ x: 700 + (x - y) * 20, y: 55 + (x + y) * 10 });
const runs = [];
for (let seed = 1; seed <= Number(process.argv[4] || 300); seed++) {
  if (process.argv[6] && !process.argv[6].split(",").map(Number).includes(seed))
    continue;
  let r = seed;
  const scenario = [
    "standard",
    "short-contact",
    "reduced-reserves",
    "leg-injuries",
  ][(seed - 1) % 4];
  const b = new Battle(
    () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296,
    { contactTTL: scenario === "short-contact" ? 6 : 8 },
  );
  for (const u of b.units) {
    if (scenario === "reduced-reserves") u.reserve = Math.floor(u.reserve / 2);
    if (scenario === "leg-injuries") u.health["left leg"] = 65;
  }
  const visuals = renderEnabled ? new CombatVisuals() : null;
  const hash = createHash("sha256");
  const trace = [];
  const soldiers = b.units.map((u) => ({
    id: u.id,
    role: u.role,
    team: u.team,
    activeTime: 0,
    shots: 0,
    engaging: 0,
    passive: 0,
    exposed: 0,
    usefulCover: 0,
    coverSelections: 0,
    coverSwitches: 0,
    coverAbandoned: 0,
    relocations: 0,
    navigationFailures: 0,
    loops: 0,
    treatmentTicks: 0,
    treatmentCompleted: 0,
    treatmentInterrupted: 0,
    treatmentStarts: 0,
    failedApproaches: 0,
    response: [],
    delayedResponses: 0,
    unresolvedInjuries: 0,
    coveringShots: 0,
    combatWithoutCare: 0,
  }));
  const detail = b.units.map((u) => ({
    goal: null,
    wasTreating: false,
    patient: null,
    approach: null,
    health: Object.values(u.health).reduce((s, h) => s + h, 0),
    injuryAt: null,
    failed: 0,
    activity: { engaging: 0, passive: 0 },
    lastChoice: null,
  }));
  const m = {
    seed,
    scenario,
    navigationFailures: 0,
    deploys: 0,
    unmounts: 0,
    medicShots: 0,
    treatments: 0,
    treatmentResponse: [],
    invalidShots: 0,
    facingErrors: 0,
    aimErrors: 0,
    maxWait: 0,
    loops: 0,
    active: 0,
    firing: 0,
    shots: 0,
    exposed: 0,
    knownThreatTime: 0,
    usefulCover: 0,
    relocations: 0,
    abandoned: 0,
    passive: 0,
    mountedTime: 0,
    mountedShots: 0,
    casualties: 0,
    reacquisitions: [],
  };
  const tracks = b.units.map(() => ({
    goal: null,
    visible: false,
    lost: null,
    failures: 0,
    casualtyAt: null,
    lastHealth: 600,
    waiting: 0,
    lastCover: null,
    coverHistory: [],
  }));
  for (let step = 0; step < 18000 && !b.result; step++) {
    b.step(0.1);
    for (const u of b.units) {
      const d = detail[u.id],
        p = soldiers[u.id],
        treating = u.presentation.treating;
      const h = Object.values(u.health).reduce((s, h) => s + h, 0);
      if (h < d.health && Math.min(...Object.values(u.health)) < 65)
        d.injuryAt ??= b.time;
      d.health = h;
      if (treating && !d.wasTreating) p.treatmentStarts++;
      if (
        d.wasTreating &&
        !d.completed &&
        (!treating || u.patientId !== d.patient) &&
        !b.events.some(
          (e) =>
            e.time === b.time &&
            e.type === "treatmentComplete" &&
            e.unitId === u.id,
        )
      )
        p.treatmentInterrupted++;
      d.completed = b.events.some(
        (e) =>
          e.time === b.time &&
          e.type === "treatmentComplete" &&
          e.unitId === u.id,
      );
      d.wasTreating = treating;
      d.patient = u.patientId;
      if (
        d.approach != null &&
        u.state !== "Moving to casualty" &&
        u.state !== "Treating"
      )
        p.failedApproaches++;
      d.approach =
        u.state === "Moving to casualty" ? (u.patientId ?? "selected") : null;
      const failures = u.progress?.failedAttempts ?? 0;
      p.navigationFailures += Math.max(0, failures - d.failed);
      d.failed = failures;
      for (const k of ["engaging", "passive"]) {
        p[k] += u.activity[k] - d.activity[k];
        d.activity[k] = u.activity[k];
      }
      if (u.active) {
        p.activeTime += 0.1;
        const known = [...u.intel.contacts.values()].filter(
          (c) => b.time - c.time < b.contactTTL,
        );
        if (known.some((c) => sight(u, c) && cover(u, c) < 0.28))
          p.exposed += 0.1;
        if (
          known.some(
            (c) =>
              sight(u, c) &&
              cover(u, c) >= 0.28 &&
              Math.hypot(u.x - c.x, u.y - c.y) <= u.range,
          )
        )
          p.usefulCover += 0.1;
      }
      const goal = u.coverTarget
        ? `${u.coverTarget.x},${u.coverTarget.y}`
        : null;
      if (
        d.goal &&
        Math.hypot(u.x - d.goal.x, u.y - d.goal.y) < 0.25 &&
        !d.goal.done
      ) {
        p.relocations++;
        d.goal.done = true;
      }
      if (goal !== d.lastChoice) {
        if (goal) {
          p.coverSelections++;
          if (d.lastChoice) p.coverSwitches++;
        }
        if (d.goal && !d.goal.done && u.active) p.coverAbandoned++;
        d.goal = u.coverTarget ? { ...u.coverTarget } : null;
        d.lastChoice = goal;
      }
    }
    for (const e of b.events)
      if (e.time === b.time) {
        const p = soldiers[e.unitId];
        if (e.type === "shot") {
          p.shots++;
          if (
            b.units.some(
              (a) =>
                a.team === p.team && a.id !== p.id && a.presentation.treating,
            )
          )
            p.coveringShots++;
          if (
            p.role === "Medic" &&
            !b.units.some(
              (a) =>
                a.team === p.team &&
                !a.dead &&
                a.id !== p.id &&
                Math.min(...Object.values(a.health)) < 65,
            )
          )
            p.combatWithoutCare++;
        }
        if (e.type === "treatmentTick") {
          p.treatmentTicks++;
          const d = detail[e.patientId];
          if (d.injuryAt != null) {
            const delay = b.time - d.injuryAt;
            soldiers[e.patientId].response.push(delay);
            if (delay > 10) soldiers[e.patientId].delayedResponses++;
            d.injuryAt = null;
          }
        }
        if (e.type === "treatmentComplete") p.treatmentCompleted++;
      }
    if (visuals) {
      visuals.update(
        b,
        0.1 / (1 << ((seed - 1) % 3)),
        1 << ((seed - 1) % 3),
        false,
      );
      if (step % 10 === 0) {
        for (const u of b.units)
          visuals.drawUnit(sink, b, u, iso(u.x, u.y), iso, false);
        visuals.drawTraces(sink, iso);
      }
    }
    hash.update(
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
    if (step % 50 === 0)
      trace.push({
        time: b.time,
        units: b.units.map((u) => ({
          id: u.id,
          active: u.active,
          dead: u.dead,
          role: u.role,
          known: u.memory ? { ...u.memory } : null,
          x: u.x,
          y: u.y,
          state: u.state,
          reason: u.diagnostics.decision,
          alternative: u.alternativeRejection,
          health: { ...u.health },
          ammo: u.ammo,
          mount: u.mount?.state,
          progress: u.diagnostics.progressAge,
          goal: u.target,
          blocker: u.diagnostics.blocker,
          assignment: u.assignment
            ? {
                type: u.assignment.type,
                reason: u.assignment.reason,
                target: u.assignment.target,
              }
            : null,
          coverTarget: u.coverTarget ? { ...u.coverTarget } : null,
          coverEvaluation: u.coverEvaluation
            ? structuredClone(u.coverEvaluation)
            : null,
          patientId: u.patientId,
          treatmentProgress: u.treat,
          suppression: u.suppression,
          visible: u.visibleEnemies.map((e) => e.id),
        })),
      });
    for (const e of b.events)
      if (e.time === b.time) {
        if (e.type === "mountState") {
          if (e.state === "deploying") m.deploys++;
          if (e.state === "unmounting") m.unmounts++;
        }
        if (e.type === "treatmentTick") {
          m.treatments++;
          const t = tracks[e.patientId];
          if (t.casualtyAt != null) {
            m.treatmentResponse.push(b.time - t.casualtyAt);
            t.casualtyAt = null;
          }
        }
        if (e.type === "shot") {
          const u = b.units[e.unitId];
          if (u.role === "Medic") m.medicShots++;
          if (
            !sight({ x: e.x, y: e.y }, { x: e.targetX, y: e.targetY }) ||
            Math.hypot(e.targetX - e.x, e.targetY - e.y) > u.range + 1e-6
          )
            m.invalidShots++;
          if (
            Math.abs(
              Math.atan2(
                Math.sin(
                  e.angle - Math.atan2(e.targetY - e.y, e.targetX - e.x),
                ),
                Math.cos(
                  e.angle - Math.atan2(e.targetY - e.y, e.targetX - e.x),
                ),
              ),
            ) > 1e-6
          )
            m.aimErrors++;
        }
      }
    for (const e of b.events)
      if (e.type === "shot" && e.time === b.time) {
        m.shots++;
        if (e.supported) m.mountedShots++;
      }
    for (const u of b.units) {
      const t = tracks[u.id];
      const health = Object.values(u.health).reduce((a, b) => a + b, 0);
      if (health < t.lastHealth && Math.min(...Object.values(u.health)) < 65)
        t.casualtyAt ??= b.time;
      t.lastHealth = health;
      const failures = u.progress?.failedAttempts ?? 0;
      m.navigationFailures += Math.max(0, failures - t.failures);
      t.failures = failures;
      if (!u.active) continue;
      if (u.firedAt === b.time) {
        const e = b.events.find(
          (e) => e.type === "shot" && e.unitId === u.id && e.time === b.time,
        );
        if (
          e &&
          Math.abs(
            Math.atan2(
              Math.sin(u.facing - e.angle),
              Math.cos(u.facing - e.angle),
            ),
          ) > 0.2
        )
          m.facingErrors++;
      }
      t.waiting =
        u.presentation.moving ||
        u.presentation.direct ||
        u.presentation.treating
          ? 0
          : t.waiting + 0.1;
      m.maxWait = Math.max(m.maxWait, t.waiting);
      const ck = u.coverTarget ? `${u.coverTarget.x},${u.coverTarget.y}` : null;
      if (ck && ck !== t.lastCover) {
        t.coverHistory.push({ key: ck, at: b.time });
        if (
          t.coverHistory
            .slice(-4, -1)
            .some((h) => h.key === ck && b.time - h.at < 10)
        ) {
          m.loops++;
          soldiers[u.id].loops++;
        }
        t.lastCover = ck;
      }
      m.active += 0.1;
      const known = [...u.intel.contacts.values()].filter(
        (c) => b.time - c.time < b.contactTTL,
      );
      const seen = u.visibleEnemies.some((e) => e.active && sight(u, e));
      if (t.visible && !seen) t.lost = b.time;
      if (seen && t.lost != null) {
        m.reacquisitions.push(b.time - t.lost);
        t.lost = null;
      }
      t.visible = seen;
      if (u.mount?.state === "mounted") m.mountedTime += 0.1;
      if (known.length) {
        m.knownThreatTime += 0.1;
        if (known.some((c) => sight(u, c) && cover(u, c) < 0.28))
          m.exposed += 0.1;
        if (
          known.some(
            (c) =>
              sight(u, c) &&
              cover(u, c) >= 0.28 &&
              Math.hypot(u.x - c.x, u.y - c.y) <= u.range,
          )
        )
          m.usefulCover += 0.1;
      }
      if (
        t.goal &&
        !t.completed &&
        Math.hypot(u.x - t.goal.x, u.y - t.goal.y) < 0.25
      ) {
        m.relocations++;
        t.completed = true;
      }
      if (u.coverTarget) {
        if (
          !t.goal ||
          Math.hypot(t.goal.x - u.coverTarget.x, t.goal.y - u.coverTarget.y) >
            0.5
        ) {
          if (t.goal && !t.completed) m.abandoned++;
          t.goal = { ...u.coverTarget };
          t.completed = false;
        }
      } else if (t.goal) {
        if (!t.completed) m.abandoned++;
        t.goal = null;
        t.completed = false;
      }
    }
  }
  m.firing = b.units.reduce((s, u) => s + u.activity.engaging, 0);
  m.passive = b.units.reduce((s, u) => s + u.activity.passive, 0);
  m.duration = b.time;
  m.result = b.result;
  m.stalled = !b.result;
  m.casualties = b.units.filter((u) => !u.active).length;
  m.dead = b.units.filter((u) => u.dead).length;
  m.injured = b.units.filter(
    (u) => !u.dead && Object.values(u.health).some((h) => h < 100),
  ).length;
  m.incapacitated = b.units.filter((u) => !u.active && !u.dead).length;
  m.medicTreatmentTime = b.units
    .filter((u) => u.role === "Medic")
    .reduce((s, u) => s + u.activity.treating, 0);
  m.soldiers = soldiers.map((p, i) => ({
    ...p,
    dead: b.units[i].dead,
    incapacitated: !b.units[i].active && !b.units[i].dead,
    unresolvedInjuries: detail[i].injuryAt == null ? 0 : 1,
  }));
  m.digest = hash.digest("hex");
  runs.push(m);
  if (process.argv[5] === "trace")
    writeFileSync(
      `${process.env.AW_TRACE_PREFIX || process.argv[3]}.seed-${seed}.json`,
      JSON.stringify(trace),
    );
  if (seed % 25 === 0) console.log("completed", seed);
}
const mean = (k) => runs.reduce((s, r) => s + r[k], 0) / runs.length;
const reacq = runs
  .flatMap((r) => r.reacquisitions)
  .filter((t) => t >= 0.5)
  .sort((a, b) => a - b);
const total = (k) => runs.reduce((s, r) => s + r[k], 0);
const percentile = (a, p) =>
  [...a].sort((a, b) => a - b)[
    Math.min(a.length - 1, Math.floor(a.length * p))
  ];
const result = {
  method:
    "seeds 1..N; dt 0.1s; 1800s cap; soldier-seconds; firing=exclusive engaging activity (actual shots or direct Engaging/Aiming); passive=authoritative exclusive passive counter; exposure=any unprotected known firing lane; useful cover=protected known in-range lane; reacquisition=personal sight loss of at least 0.5s to any personal sight return (survivor episodes only; unresolved episodes excluded)",
  summary: {
    seeds: runs.length,
    durationMedian: percentile(
      runs.map((r) => r.duration),
      0.5,
    ),
    durationP90: percentile(
      runs.map((r) => r.duration),
      0.9,
    ),
    durationP95: percentile(
      runs.map((r) => r.duration),
      0.95,
    ),
    durationMax: Math.max(...runs.map((r) => r.duration)),
    ...Object.fromEntries(
      [
        "navigationFailures",
        "deploys",
        "unmounts",
        "medicShots",
        "treatments",
        "invalidShots",
        "facingErrors",
        "aimErrors",
        "maxWait",
        "loops",
        "injured",
        "incapacitated",
        "medicTreatmentTime",
      ].map((k) => [k, mean(k)]),
    ),
    duration: mean("duration"),
    stalled: runs.filter((r) => r.stalled).length,
    firing: mean("firing"),
    shots: mean("shots"),
    exposed: mean("exposed"),
    knownThreatTime: mean("knownThreatTime"),
    exposurePercent: (100 * total("exposed")) / total("knownThreatTime"),
    usefulCover: mean("usefulCover"),
    relocations: mean("relocations"),
    abandoned: mean("abandoned"),
    passive: mean("passive"),
    passivePercent: (100 * total("passive")) / total("active"),
    mountedTime: mean("mountedTime"),
    mountedShots: mean("mountedShots"),
    casualties: mean("casualties"),
    dead: mean("dead"),
    reacquisitionMedian: reacq[Math.floor(reacq.length * 0.5)],
    reacquisitionP90: reacq[Math.floor(reacq.length * 0.9)],
    reacquisitionSamples: reacq.length,
  },
  runs,
};
writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + "\n");
console.log(result.summary);
