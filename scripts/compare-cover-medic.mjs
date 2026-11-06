import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const [before, after] = process.argv
  .slice(2, 4)
  .map((p) => JSON.parse(readFileSync(p)));
assert.equal(before.runs.length, 300);
assert.equal(after.runs.length, 300);
const keys = [
  "shots",
  "engaging",
  "passive",
  "activeTime",
  "exposed",
  "usefulCover",
  "coverSelections",
  "coverSwitches",
  "coverAbandoned",
  "relocations",
  "navigationFailures",
  "loops",
  "treatmentTicks",
  "treatmentStarts",
  "treatmentCompleted",
  "treatmentInterrupted",
  "failedApproaches",
  "coveringShots",
  "combatWithoutCare",
  "delayedResponses",
  "unresolvedInjuries",
];
const quant = (a, p) => {
  a = [...a].sort((a, b) => a - b);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))] ?? null;
};
function roles(j) {
  return Object.fromEntries(
    ["Leader", "Rifleman", "LMG", "Medic"].map((role) => {
      const units = j.runs
        .flatMap((r) => r.soldiers)
        .filter((u) => u.role === role);
      return [
        role,
        {
          soldierMatches: units.length,
          ...Object.fromEntries(
            keys.map((k) => [
              k,
              units.reduce((s, u) => s + u[k], 0) / units.length,
            ]),
          ),
          casualtyPercent:
            (100 * units.filter((u) => u.dead || u.incapacitated).length) /
            units.length,
          deadPercent:
            (100 * units.filter((u) => u.dead).length) / units.length,
        },
      ];
    }),
  );
}
function care(j) {
  const units = j.runs.flatMap((r) => r.soldiers),
    delays = units.flatMap((u) => u.response);
  return {
    responseSamples: delays.length,
    responseMedian: quant(delays, 0.5),
    responseP90: quant(delays, 0.9),
    delayedOver10: delays.filter((t) => t > 10).length,
    roles: roles(j),
  };
}
const pairs = before.runs.map((b, i) => {
  const a = after.runs[i];
  assert.equal(a.seed, b.seed);
  assert.equal(a.scenario, b.scenario);
  return {
    seed: b.seed,
    scenario: b.scenario,
    durationBefore: b.duration,
    durationAfter: a.duration,
    durationDelta: a.duration - b.duration,
    passiveDelta: a.passive - b.passive,
    casualtyDelta: a.casualties - b.casualties,
    coverLoopDelta: a.loops - b.loops,
  };
});
const result = {
  baseline: { ...before.summary, ...care(before) },
  updated: { ...after.summary, ...care(after) },
  pairs,
  worstDurationRegressions: [...pairs]
    .sort((a, b) => b.durationDelta - a.durationDelta)
    .slice(0, 15),
};
writeFileSync(process.argv[4], JSON.stringify(result, null, 2) + "\n");
console.log({ baseline: before.summary, updated: after.summary });
