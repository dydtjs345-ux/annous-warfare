// Deterministic read-only audit, shared inputs for milestone comparisons.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const [
  root = ".",
  out = "/tmp/v027.json",
  cohort = "expanded",
  count = "12",
  start = "2001",
] = process.argv.slice(2);
const { Battle } = await import(
  pathToFileURL(resolve(root, "src/simulation.js"))
);
const world = await import(pathToFileURL(resolve(root, "src/world.js")));
const runs = [],
  begin = performance.now();
for (let index = 0; index < Number(count); index++) {
  const seed = Number(start) + index;
  let rng = seed;
  const i = seed - 2001;
  const scenario = [
    "standard",
    "short-contact",
    "reduced-reserves",
    "leg-injuries",
  ][Math.floor(i / 4) % 4];
  const variant = cohort === "cover" ? i % 3 : i % 4;
  const options = {
    map:
      cohort === "legacy"
        ? "legacy"
        : cohort === "cover"
          ? "urban"
          : "expanded",
    variant,
    spawn: Math.floor(i / 16) % 3,
    grenades: cohort !== "legacy",
    tactical: cohort !== "legacy",
    contactTTL: scenario === "short-contact" ? 6 : 8,
  };
  const b = new Battle(
    () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296,
    options,
  );
  if (cohort === "cover") {
    const points = [
      [3, 11],
      [6, 10],
      [12, 9],
      [15, 10],
      [17, 10],
      [2, 10],
      [3, 15],
      [6, 15],
      [8, 15],
      [18, 15],
      [25, 13],
      [27, 15],
    ];
    b.units.forEach((u, j) => {
      [u.x, u.y] = points[j];
    });
  }
  if (cohort === "movement") {
    for (const u of b.units) {
      const p = world.reachableGoal(
        { x: 14, y: u.team ? 28 : 3 },
        {
          x: 14 + (u.id % 3) - 1,
          y: u.team ? 27 + (u.id % 6) : 3 + (u.id % 6),
        },
      );
      Object.assign(u, p);
    }
  }
  for (const u of b.units) {
    if (scenario === "reduced-reserves") u.reserve = Math.floor(u.reserve / 2);
    if (scenario === "leg-injuries") u.health["left leg"] = 65;
  }
  const initial = b.units.map((u) => [u.x, u.y]),
    hash = createHash("sha256");
  const m = {
    seed,
    scenario,
    options,
    initial,
    firstContact: null,
    full: 0,
    peek: 0,
    sustained: 0,
    shots: 0,
    suppressionShots: 0,
    suppressionPressure: 0,
    exposed: 0,
    usefulCover: 0,
    nav: 0,
    peeks: 0,
    postureChanges: 0,
    treatments: 0,
    treatmentInterruptions: 0,
    medicCasualties: 0,
    invalidFire: 0,
    passive: 0,
    active: 0,
    maxSeparation: 0,
    stuck: 0,
    casualties: 0,
    grenades: 0,
    friendlyHits: 0,
    crossings: 0,
    flanks: 0,
    samples: [],
    failures: [],
  };
  const previous = b.units.map(() => ({
    failed: 0,
    posture: 0,
    treating: false,
    suppression: 0,
  }));
  let nextSample = 0,
    turn = 0;
  const move = b.move.bind(b);
  b.move = (u, goal, dt) => {
    const r = move(u, goal, dt);
    if (r === false && m.failures.length < 30)
      m.failures.push({
        at: b.time,
        id: u.id,
        state: u.state,
        reason: u.movementBlocker,
        goal: { x: goal.x, y: goal.y },
      });
    return r;
  };
  for (; turn < 18000 && !b.result; turn++) {
    b.step(0.1);
    if (
      m.firstContact === null &&
      b.units.some((u) => u.active && u.visibleEnemies.length)
    )
      m.firstContact = b.time;
    for (const u of b.units) {
      const p = previous[u.id];
      const f = u.progress?.failedAttempts ?? 0;
      m.nav += Math.max(0, f - p.failed);
      p.failed = f;
      const transitions = u.posture?.transitions ?? 0;
      m.postureChanges += transitions - p.posture;
      p.posture = transitions;
      if (p.mode !== u.posture?.mode && u.posture?.mode === "peek") m.peeks++;
      p.mode = u.posture?.mode;
      if (
        p.treating &&
        !u.presentation.treating &&
        !b.events.some(
          (e) =>
            e.time === b.time &&
            e.type === "treatmentComplete" &&
            e.unitId === u.id,
        )
      )
        m.treatmentInterruptions++;
      p.treating = u.presentation.treating;
      m.suppressionPressure += Math.max(0, u.suppression - p.suppression);
      p.suppression = u.suppression;
      if (!u.active) continue;
      m.active += 0.1;
      if (u.posture) m[u.posture.mode] += 0.1;
      const known = [...u.intel.contacts.values()].filter(
        (c) => b.time - c.time < b.contactTTL,
      );
      if (known.some((c) => world.sight(u, c) && world.cover(u, c) < 0.28))
        m.exposed += 0.1;
      if (
        known.some(
          (c) =>
            world.sight(u, c) &&
            world.cover(u, c) >= 0.28 &&
            Math.hypot(u.x - c.x, u.y - c.y) <= u.range,
        )
      )
        m.usefulCover += 0.1;
      if (
        b.time - (u.progress?.lastMovement ?? b.time) > 20 &&
        !u.visibleEnemies.length &&
        !u.presentation.treating
      )
        m.stuck += 0.1;
    }
    for (const e of b.events)
      if (e.time === b.time) {
        if (e.type === "shot") {
          m.shots++;
          if (e.suppressive) m.suppressionShots++;
          if (
            !(world.terrainSight ?? world.sight)(
              { x: e.x, y: e.y },
              { x: e.targetX, y: e.targetY },
            )
          )
            m.invalidFire++;
        }
        if (e.type === "treatmentComplete") m.treatments++;
      }
    for (const q of b.squads) {
      const units = b.units.filter(
        (u) => u.team === b.squads.indexOf(q) && u.active,
      );
      for (const u of units)
        for (const a of units)
          m.maxSeparation = Math.max(
            m.maxSeparation,
            Math.hypot(u.x - a.x, u.y - a.y),
          );
    }
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
          u.posture?.mode,
          u.assignment?.type,
          u.mount,
        ]),
      ]),
    );
    if (b.time >= nextSample) {
      nextSample = b.time + 10;
      m.samples.push({
        at: b.time,
        units: b.units
          .filter((u) => u.active)
          .map((u) => ({
            id: u.id,
            x: u.x,
            y: u.y,
            action: u.state,
            posture: u.posture?.mode,
            assignment: u.assignment?.type,
            reason: u.decisionReason,
            ammo: u.ammo,
            suppression: u.suppression,
          })),
        phases: b.squads.map((q) => q.search?.phase),
      });
    }
  }
  m.duration = b.time;
  m.result = b.result;
  m.timeout = !b.result;
  m.digest = hash.digest("hex");
  m.passive = b.units.reduce((n, u) => n + u.activity.passive, 0);
  m.casualties = b.units.filter((u) => !u.active).length;
  m.medicCasualties = b.units.filter(
    (u) => u.role === "Medic" && !u.active,
  ).length;
  m.grenades = b.grenadeStats?.thrown ?? 0;
  m.friendlyHits = b.grenadeStats?.friendlyHits ?? 0;
  m.crossings = b.squads.reduce(
    (n, q) => n + (q.crossingStats?.completed ?? 0),
    0,
  );
  m.flanks = b.squads.reduce((n, q) => n + (q.fireMovement?.started ?? 0), 0);
  runs.push(m);
  if (index % 25 === 24) console.log("completed", cohort, index + 1);
}
const durations = runs.map((r) => r.duration).sort((a, b) => a - b),
  mean = (k) => runs.reduce((n, r) => n + r[k], 0) / runs.length;
const result = {
  source: root,
  cohort,
  dt: 0.1,
  cap: 1800,
  runtimeMs: performance.now() - begin,
  summary: {
    runs: runs.length,
    timeouts: runs.filter((r) => r.timeout).length,
    p50: durations[Math.floor(runs.length * 0.5)],
    p90: durations[Math.floor(runs.length * 0.9)],
    p95: durations[Math.floor(runs.length * 0.95)],
    max: durations.at(-1),
    ...Object.fromEntries(
      [
        "full",
        "peek",
        "shots",
        "suppressionShots",
        "suppressionPressure",
        "exposed",
        "usefulCover",
        "nav",
        "peeks",
        "postureChanges",
        "treatments",
        "treatmentInterruptions",
        "medicCasualties",
        "invalidFire",
        "passive",
        "active",
        "maxSeparation",
        "stuck",
        "casualties",
        "grenades",
        "friendlyHits",
        "crossings",
        "flanks",
      ].map((k) => [k, mean(k)]),
    ),
  },
  runs,
};
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(result.summary);
