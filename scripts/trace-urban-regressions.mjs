// Read-only diagnosis: wraps movement to record actual decisions, never changes inputs.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const root = resolve(process.argv[2] || ".");
const { Battle } = await import(
  pathToFileURL(resolve(root, "src/simulation.js"))
);
const { blocked, obstacles, key, sight, cover, path } = await import(
  pathToFileURL(resolve(root, "src/world.js"))
);
const source = JSON.parse(readFileSync(process.argv[3]));
const seeds = process.argv[5]?.split(",").map(Number);
const out = [];
const point = (u) => ({ x: u.x, y: u.y });
for (const c of source.runs ?? source) {
  if (seeds && !seeds.includes(c.seed)) continue;
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
  const digest = createHash("sha256");
  const first10 = { active: 0, known: 0, exposed: 0, covered: 0 };
  for (const u of b.units) {
    if (c.scenario === "reduced-reserves")
      u.reserve = Math.floor(u.reserve / 2);
    if (c.scenario === "leg-injuries") u.health["left leg"] = 65;
    [u.x, u.y] = c.config.initialPositions[u.id];
  }
  const failures = [],
    waits = [],
    states = [],
    mounts = [],
    coverDecisions = [],
    exposureByState = {},
    exposureByRole = {};
  const lastWait = new Map(),
    lastMount = new Map(),
    lastCover = new Map();
  const move = b.move.bind(b);
  b.move = (u, goal, dt) => {
    const prior = {
      position: point(u),
      route: u.route?.slice(0, 6),
      routeGoal: u.routeGoal,
      state: u.state,
      mount: u.mount?.state,
      navAge: b.time - (u.navProgressAt ?? b.time),
    };
    const ok = move(u, goal, dt);
    if (
      !ok ||
      (u.movementBlocker && b.time - (lastWait.get(u.id) ?? -Infinity) > 1)
    ) {
      lastWait.set(u.id, b.time);
      const next = u.route?.[0];
      const neighbors = [];
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const x = Math.round(u.x) + dx,
            y = Math.round(u.y) + dy;
          if (blocked(x, y))
            neighbors.push({ x, y, type: obstacles.get(key(x, y)) ?? "edge" });
        }
      const row = {
        time: b.time,
        id: u.id,
        role: u.role,
        prior,
        position: point(u),
        goal: point(goal),
        route: u.route?.slice(0, 6),
        result: ok,
        navigation: u.navigation,
        blocker: u.movementBlocker,
        patient: u.patientId,
        assignment: u.assignment?.type,
        coverTarget: u.coverTarget,
        coverEvaluation: structuredClone(u.coverEvaluation),
        near: b.units
          .filter(
            (a) => a !== u && !a.dead && Math.hypot(a.x - u.x, a.y - u.y) < 3,
          )
          .map((a) => ({
            id: a.id,
            active: a.active,
            team: a.team,
            state: a.state,
            mount: a.mount?.state,
            ...point(a),
            target: a.target,
          })),
        terrain: neighbors,
      };
      (ok ? waits : failures).push(row);
    }
    return ok;
  };
  let terrainViolations = 0;
  for (let step = 0; step < 18000 && !b.result; step++) {
    b.step(0.1);
    digest.update(
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
    if (step % 100 === 0)
      states.push({
        time: b.time,
        units: b.units
          .filter((u) => u.active)
          .map((u) => ({
            id: u.id,
            role: u.role,
            position: point(u),
            state: u.state,
            ammo: u.ammo,
            reserve: u.reserve,
            health: { ...u.health },
            patient: u.patientId,
            treatmentAt: u.treatmentAt,
            assignment: u.assignment?.type,
            reason: u.diagnostics.decision,
            alternative: u.alternativeRejection,
          })),
      });
    for (const u of b.units) {
      if (!u.active) continue;
      if (blocked(Math.round(u.x), Math.round(u.y))) terrainViolations++;
      const mk = u.mount?.state;
      if (mk !== lastMount.get(u.id)) {
        mounts.push({
          time: b.time,
          id: u.id,
          state: mk,
          reason: u.mount?.reason,
          position: point(u),
          coverTarget: u.coverTarget,
          target: u.target,
          assignment: u.assignment?.type,
        });
        lastMount.set(u.id, mk);
      }
      const d = u.coverEvaluation;
      if (d?.evaluatedAt !== lastCover.get(u.id)) {
        if (d?.evaluatedAt != null)
          coverDecisions.push({
            time: b.time,
            id: u.id,
            position: point(u),
            state: u.state,
            assignment: u.assignment?.type,
            coverTarget: u.coverTarget,
            evaluation: structuredClone(d),
            known: [...u.intel.contacts.values()].map((t) => ({
              x: t.x,
              y: t.y,
              time: t.time,
              enemyId: t.enemyId,
            })),
            protection: u.presentation.protection,
          });
        lastCover.set(u.id, d?.evaluatedAt);
      }
      const known = [...u.intel.contacts.values()].filter(
        (c) => b.time - c.time < b.contactTTL,
      );
      if (b.time <= 10 + 1e-8) {
        first10.active += 0.1;
        if (known.length) first10.known += 0.1;
        if (known.some((c) => sight(u, c) && cover(u, c) < 0.28))
          first10.exposed += 0.1;
        if (
          known.some(
            (c) =>
              sight(u, c) &&
              cover(u, c) >= 0.28 &&
              Math.hypot(u.x - c.x, u.y - c.y) <= u.range,
          )
        )
          first10.covered += 0.1;
      }
      if (known.some((c) => sight(u, c) && cover(u, c) < 0.28)) {
        exposureByState[u.state] = (exposureByState[u.state] ?? 0) + 0.1;
        exposureByRole[u.role] = (exposureByRole[u.role] ?? 0) + 0.1;
      }
    }
  }
  out.push({
    seed: c.seed,
    scenario: c.scenario,
    config: c.config,
    duration: b.time,
    result: b.result,
    digest: digest.digest("hex"),
    first10,
    terrainViolations,
    failures,
    waits,
    mounts,
    coverDecisions: coverDecisions.filter(
      (d) =>
        d.time <= 2 ||
        d.time >= b.time - 10 ||
        [...failures, ...waits].some(
          (f) => f.id === d.id && Math.abs(f.time - d.time) < 2,
        ),
    ),
    states,
    exposureByState,
    exposureByRole,
  });
  console.log(
    c.seed,
    "fail",
    failures.length,
    "wait",
    waits.length,
    "exposure",
    exposureByState,
  );
}
writeFileSync(process.argv[4], JSON.stringify(out, null, 2) + "\n");
