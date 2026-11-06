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
const runs = [];
for (let seed = 1; seed <= Number(process.argv[4] || 20); seed++) {
  let r = seed;
  const b = new Battle(
    () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296,
  );
  const m = {
    seed,
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
  }));
  for (let step = 0; step < 18000 && !b.result; step++) {
    b.step(0.1);
    for (const e of b.events)
      if (e.type === "shot" && e.time === b.time) {
        m.shots++;
        if (e.supported) m.mountedShots++;
      }
    for (const u of b.units) {
      const t = tracks[u.id];
      if (!u.active) continue;
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
  runs.push(m);
}
const mean = (k) => runs.reduce((s, r) => s + r[k], 0) / runs.length;
const reacq = runs
  .flatMap((r) => r.reacquisitions)
  .filter((t) => t >= 0.5)
  .sort((a, b) => a - b);
const total = (k) => runs.reduce((s, r) => s + r[k], 0);
const result = {
  method:
    "seeds 1..N; dt 0.1s; 1800s cap; soldier-seconds; firing=exclusive engaging activity (actual shots or direct Engaging/Aiming); passive=authoritative exclusive passive counter; exposure=any unprotected known firing lane; useful cover=protected known in-range lane; reacquisition=personal sight loss of at least 0.5s to any personal sight return (survivor episodes only; unresolved episodes excluded)",
  summary: {
    seeds: runs.length,
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
