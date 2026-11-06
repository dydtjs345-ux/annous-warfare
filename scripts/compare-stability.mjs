import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const [before, after, visual] = process.argv
  .slice(2, 5)
  .map((p) => JSON.parse(readFileSync(p)));
assert.equal(before.runs.length, 200);
assert.equal(after.runs.length, 200);
assert.equal(visual.runs.length, 200);
const pairs = before.runs.map((b, i) => {
  const a = after.runs[i],
    v = visual.runs[i];
  assert.equal(a.seed, b.seed);
  assert.equal(a.scenario, b.scenario);
  assert.equal(a.digest, v.digest, `render parity seed ${a.seed}`);
  return {
    seed: a.seed,
    scenario: a.scenario,
    durationBefore: b.duration,
    durationAfter: a.duration,
    delta: a.duration - b.duration,
    casualtyDelta: a.casualties - b.casualties,
    passiveDelta: a.passive - b.passive,
  };
});
const response = (j) => {
  const a = j.runs.flatMap((r) => r.treatmentResponse).sort((a, b) => a - b);
  return {
    completedSamples: a.length,
    median: a[Math.floor(a.length * 0.5)] ?? null,
    p90: a[Math.floor(a.length * 0.9)] ?? null,
  };
};
const result = {
  renderParity: 200,
  baseline: before.summary,
  updated: after.summary,
  treatmentResponse: { baseline: response(before), updated: response(after) },
  paired: {
    shorter: pairs.filter((p) => p.delta < -0.001).length,
    longer: pairs.filter((p) => p.delta > 0.001).length,
    unchanged: pairs.filter((p) => Math.abs(p.delta) <= 0.001).length,
  },
  pairs,
};
writeFileSync(process.argv[5], JSON.stringify(result, null, 2) + "\n");
console.log(result.paired);
