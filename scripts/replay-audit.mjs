import { readFileSync, writeFileSync } from "node:fs";
const data = JSON.parse(readFileSync(process.argv[2]));
const worst = [...data.runs]
  .sort(
    (a, b) =>
      Number(b.stalled) - Number(a.stalled) ||
      b.duration - a.duration ||
      b.passive - a.passive,
  )
  .slice(0, 10);
const result = worst.map((r) => {
  const trace = JSON.parse(
    readFileSync(`${process.argv[2]}.seed-${r.seed}.json`),
  );
  const waits = trace.flatMap((f) =>
    f.units.filter((u) => u.progress > 15).map((u) => ({ time: f.time, ...u })),
  );
  const reasons = {};
  for (const u of waits) {
    const key = u.alternative ?? u.reason ?? u.state;
    reasons[key] = (reasons[key] ?? 0) + 1;
  }
  return {
    seed: r.seed,
    scenario: r.scenario,
    duration: r.duration,
    stalled: r.stalled,
    maxWait: r.maxWait,
    loops: r.loops,
    facingErrors: r.facingErrors,
    navigationFailures: r.navigationFailures,
    reasons,
    samples: waits
      .filter((_, i) => i % Math.max(1, Math.floor(waits.length / 12)) === 0)
      .slice(0, 12),
  };
});
writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + "\n");
console.log(result.map(({ samples, ...r }) => r));
