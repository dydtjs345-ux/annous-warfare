import { Battle } from "../src/simulation.js";
import { CombatVisuals } from "../src/combat-visuals.js";
import { MotionPresentation } from "../src/motion-presentation.js";
import { LiveUSMCState } from "../src/live-usmc-state.js";
import { writeFileSync } from "node:fs";
const runs = [];
for (
  let seed = Number(process.argv[2] ?? 1);
  seed <= Number(process.argv[3] ?? 30);
  seed++
) {
  let rng = seed;
  const b = new Battle(
    () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296,
    {
      map: "expanded",
      variant: seed % 4,
      spawn: Math.floor(seed / 4) % 3,
      grenades: true,
    },
  );
  const visuals = new CombatVisuals(),
    motion = new MotionPresentation(),
    live = new LiveUSMCState(),
    counts = {},
    shots = new Set(),
    history = [];
  let previous = "",
    wasSupported = false,
    returns = 0;
  for (let tick = 0; tick < 6000 && !b.result; tick++) {
    motion.beforeStep(b);
    b.step(0.05);
    visuals.update(b, 0.05, 1, false);
    motion.update(b, visuals.models, 1, 0.05, 1, false);
    const u = b.units[1],
      m = visuals.models[1],
      s = live.update(b, u, m, motion.position(u));
    if (s.supported) {
      counts[s.animation] = (counts[s.animation] ?? 0) + 0.05;
      if (s.flash) shots.add(s.shotId);
      if (!wasSupported) returns++;
    }
    const tag = `${s.supported ? s.animation : "legacy:" + s.fallback}:${u.state}`;
    if (tag !== previous) {
      history.push({
        time: b.time,
        tag,
        frame: s.frame,
        look: s.lookAngle,
        travel: s.moveAngle,
        target: s.targetId,
        shot: s.shotId,
        x: u.x,
        y: u.y,
      });
      previous = tag;
    }
    wasSupported = s.supported;
  }
  const score =
    Object.keys(counts).length * 3 +
    (counts.firing ? 15 : 0) +
    (counts.raising ? 8 : 0) +
    (counts.lowering ? 8 : 0) +
    Math.min(returns, 5);
  const run = {
    seed,
    layout: seed % 4,
    spawn: Math.floor(seed / 4) % 3,
    result: b.result,
    duration: b.time,
    counts,
    shots: [...shots],
    returns,
    score,
    history,
  };
  runs.push(run);
  console.log(
    JSON.stringify({
      seed,
      score,
      counts,
      shots: shots.size,
      returns,
      result: b.result,
    }),
  );
}
writeFileSync(
  process.argv[4] ?? "reports/v034-discovery.json",
  JSON.stringify(
    {
      method:
        "Unmodified default expanded 6v6 AI; dt.05; no injected orders/targets/poses. Discovery trace, not a browser visibility assertion.",
      runs: runs.sort((a, b) => b.score - a.score),
    },
    null,
    2,
  ) + "\n",
);
