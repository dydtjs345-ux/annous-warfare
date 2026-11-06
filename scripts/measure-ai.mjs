// Identical observational instrumentation for both versions; it does not feed AI.
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
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const median = (a) => percentile(a, 0.5),
  percentile = (a, p) =>
    a.length
      ? [...a].sort((a, b) => a - b)[
          Math.min(a.length - 1, Math.floor(a.length * p))
        ]
      : null;
const results = [];
const seeds = Number(process.argv[4] || 20);
for (let seed = 1; seed <= seeds; seed++) {
  let s = seed;
  const b = new Battle(
    () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296,
  );
  const trackers = b.units.map((u) => ({
    anchor: { x: u.x, y: u.y },
    lastUseful: 0,
    lastMoved: -Infinity,
    contributed: false,
    pending: null,
    known: new Map(),
    wasVisible: new Set(),
  }));
  let activeTime = 0,
    idleTime = 0,
    contributionTime = 0,
    repositions = 0,
    abandoned = 0,
    committedAbandoned = 0,
    completedByObservation = 0,
    failures = 0,
    casualties = 0,
    responded = 0,
    endgameAt = null,
    shots = 0;
  const reacquired = [],
    unresolved = [],
    events = [];
  for (let i = 0; i < 18000 && !b.result; i++) {
    const before = b.units.map((u) => ({
      active: u.active,
      ammo: u.ammo,
      signature: `${u.order}:${u.target?.x},${u.target?.y}`,
    }));
    b.step(0.1);
    const moving = new Set();
    for (const u of b.units) {
      const t = trackers[u.id];
      if (distance(u, t.anchor) >= 1) {
        t.anchor = { x: u.x, y: u.y };
        t.lastMoved = b.time;
        t.lastUseful = b.time;
        moving.add(u.id);
      }
    }
    for (const u of b.units) {
      const t = trackers[u.id];
      if (before[u.id].active && !u.active) {
        casualties++;
        events.push({
          team: u.team,
          at: b.time,
          before: before.map((r) => r.signature),
          done: false,
        });
      }
      if (!u.active) continue;
      activeTime += 0.1;
      const fired = u.ammo < before[u.id].ammo;
      if (fired) shots += before[u.id].ammo - u.ammo;
      const visible = (u.visibleEnemies || []).filter(
        (e) => e.active && sight(u, e),
      );
      const observing =
        visible.length > 0 ||
        (u.memory &&
          sight(u, u.memory) &&
          cover(u, u.memory) >= 0.28 &&
          b.time - u.memory.time < 3);
      const overwatch =
        (u.state === "Covering search" || u.assignment?.type === "overwatch") &&
        b.units.some(
          (a) =>
            a.id !== u.id &&
            a.team === u.team &&
            a.active &&
            b.time - trackers[a.id].lastMoved < 2 &&
            (a.state === "Reacquiring contact" ||
              a.state === "Searching sector"),
        );
      const useful = fired || observing || u.state === "Treating" || overwatch;
      if (useful) {
        t.lastUseful = b.time;
        t.contributed = true;
        contributionTime += 0.1;
      }
      if (
        (u.memory || u.assignment) &&
        u.state !== "Reloading" &&
        !useful &&
        u.suppression < 0.55 &&
        b.time - t.lastUseful > 3
      )
        idleTime += 0.1;
      const assigned =
        u.assignment?.type === "recon"
          ? u.assignment
          : b.squads[u.team].searches?.get(u.id);
      const committed =
        assigned && (!assigned.until || assigned.until > b.time)
          ? assigned.target
          : (u.coverTarget ?? u.target);
      const committedKey = committed ? `${committed.x},${committed.y}` : null;
      if (t.task && t.task.key !== committedKey) {
        const acquired = visible.some(
          (e) => !t.task.initialVisible.includes(e.id),
        );
        const completed =
          distance(u, t.task.origin) >= 1 ||
          distance(u, t.task.target) < 0.4 ||
          (t.task.recon && acquired) ||
          fired;
        if (!completed) committedAbandoned++;
        else if (t.task.recon && acquired) completedByObservation++;
        t.task = null;
      }
      if (committed && !t.task && distance(u, committed) > 1)
        t.task = {
          key: committedKey,
          target: { ...committed },
          origin: { x: u.x, y: u.y },
          initialVisible: visible.map((e) => e.id),
          recon: !!assigned,
        };
      const target = u.target ? `${u.target.x},${u.target.y}` : null;
      if (t.pending && t.pending.key !== target) {
        if (t.pending.moved < 1 && !fired) abandoned++;
        t.pending = null;
      }
      if (target && !t.pending && distance(u, u.target) > 1)
        t.pending = {
          key: target,
          origin: { x: u.x, y: u.y },
          moved: 0,
          counted: false,
        };
      if (t.pending) {
        t.pending.moved = Math.max(
          t.pending.moved,
          distance(u, t.pending.origin),
        );
        if (t.pending.moved >= 1 && !t.pending.counted) {
          repositions++;
          t.pending.counted = true;
        }
      }
      const failed = u.failedGoal?.until;
      if (failed !== t.failed && failed != null) failures++;
      t.failed = failed;
      const c = u.memory;
      if (
        c?.enemyId != null &&
        b.units[c.enemyId]?.active &&
        !visible.some((e) => e.id === c.enemyId) &&
        !t.known.has(c.enemyId)
      )
        t.known.set(c.enemyId, b.time);
      for (const e of visible)
        if (t.known.has(e.id)) {
          const delay = b.time - t.known.get(e.id);
          if (delay >= 0.5) reacquired.push(delay);
          t.known.delete(e.id);
        }
      for (const [id, at] of t.known)
        if (!b.units[id].active) {
          unresolved.push({
            seconds: b.time - at,
            reason: "target became ineffective",
          });
          t.known.delete(id);
        }
    }
    for (const event of events)
      if (!event.done && b.time - event.at >= 2) {
        event.done = true;
        const changed = b.units.some(
          (u) =>
            u.team === event.team &&
            u.active &&
            `${u.order}:${u.target?.x},${u.target?.y}` !== event.before[u.id],
        );
        if (changed) responded++;
      }
    const counts = [0, 1].map(
      (team) => b.units.filter((u) => u.team === team && u.active).length,
    );
    if (
      endgameAt == null &&
      Math.min(...counts) <= 2 &&
      Math.min(...counts) > 0
    )
      endgameAt = b.time;
  }
  for (const t of trackers)
    for (const [, at] of t.known)
      unresolved.push({
        seconds: b.time - at,
        reason: "match ended or cap reached",
      });
  for (const e of events)
    if (
      !e.done &&
      b.units.some(
        (u) =>
          u.team === e.team &&
          u.active &&
          `${u.order}:${u.target?.x},${u.target?.y}` !== e.before[u.id],
      )
    )
      responded++;
  results.push({
    seed,
    finished: !!b.result,
    outcome: b.result,
    duration: b.time,
    endgameSeconds: endgameAt == null ? 0 : b.time - endgameAt,
    activeSoldierSeconds: activeTime,
    idleObservationSoldierSeconds: idleTime,
    contributionPercent: (100 * contributionTime) / Math.max(activeTime, 0.1),
    soldiersEverContributing: trackers.filter((t) => t.contributed).length,
    repositions,
    abandoned,
    committedAbandoned,
    completedByObservation,
    failures,
    shots,
    casualties,
    observableCasualtyResponses: responded,
    reacquisitionDelays: reacquired,
    censoredAcquisitions: unresolved,
    survivors: b.units.filter((u) => u.active).length,
    finalDead: b.units.filter((u) => u.dead).length,
    livingIncapacitated: b.units.filter((u) => !u.dead && !u.active).length,
    coordinatorCasualtyReplans: b.squads.reduce(
      (n, q) => n + (q.casualtyReplans || 0),
      0,
    ),
  });
}
const all = results.flatMap((r) => r.reacquisitionDelays),
  mean = (field) => results.reduce((n, r) => n + r[field], 0) / results.length;
const report = {
  versionRoot: root,
  seeds: results.map((r) => r.seed),
  summary: {
    finished: results.filter((r) => r.finished).length,
    matches: results.length,
    meanDuration: mean("duration"),
    medianDuration: median(results.map((r) => r.duration)),
    meanEndgame: mean("endgameSeconds"),
    idleObservationPercent:
      (100 * results.reduce((n, r) => n + r.idleObservationSoldierSeconds, 0)) /
      results.reduce((n, r) => n + r.activeSoldierSeconds, 0),
    meanIdleObservationSoldierSeconds: mean("idleObservationSoldierSeconds"),
    meanContributionPercent: mean("contributionPercent"),
    meanEverContributing: mean("soldiersEverContributing"),
    meanRepositions: mean("repositions"),
    meanFrameGoalPreemptions: mean("abandoned"),
    meanAbandoned: mean("committedAbandoned"),
    meanCompletedByObservation: mean("completedByObservation"),
    meanFailures: mean("failures"),
    meanSurvivors: mean("survivors"),
    meanFinalDead: mean("finalDead"),
    meanLivingIncapacitated: mean("livingIncapacitated"),
    meanShots: mean("shots"),
    casualties: results.reduce((n, r) => n + r.casualties, 0),
    observableCasualtyResponses: results.reduce(
      (n, r) => n + r.observableCasualtyResponses,
      0,
    ),
    completedAcquisitions: all.length,
    medianAcquisitionSeconds: median(all),
    p90AcquisitionSeconds: percentile(all, 0.9),
    censoredAcquisitions: results.reduce(
      (n, r) => n + r.censoredAcquisitions.length,
      0,
    ),
    coordinatorCasualtyReplans: results.reduce(
      (n, r) => n + r.coordinatorCasualtyReplans,
      0,
    ),
  },
  results,
};
if (process.argv[3])
  writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
