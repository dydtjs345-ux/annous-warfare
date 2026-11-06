import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const [A, B, C, out] = process.argv.slice(2);
const raw = [A, B, C].map((p) => JSON.parse(readFileSync(p)));
assert.ok(raw.every((j) => j.runs.length === 300));
function summarize(j) {
  const units = j.runs.flatMap((r) => r.soldiers);
  const keys = Object.keys(units[0]).filter(
    (k) => !["id", "team"].includes(k) && typeof units[0][k] === "number",
  );
  const roles = Object.fromEntries(
    ["Leader", "Rifleman", "LMG", "Medic"].map((role) => {
      const u = units.filter((u) => u.role === role);
      return [
        role,
        {
          soldierMatches: u.length,
          ...Object.fromEntries(
            keys.map((k) => [k, u.reduce((s, u) => s + u[k], 0) / u.length]),
          ),
          casualtyPercent:
            (100 * u.filter((u) => u.dead || u.incapacitated).length) /
            u.length,
          deadPercent: (100 * u.filter((u) => u.dead).length) / u.length,
        },
      ];
    }),
  );
  const response = units.flatMap((u) => u.response).sort((a, b) => a - b);
  return {
    ...j.summary,
    roles,
    responseSamples: response.length,
    responseMedian: response[Math.floor(response.length * 0.5)] ?? null,
    responseP90: response[Math.floor(response.length * 0.9)] ?? null,
  };
}
const versions = Object.fromEntries(
  raw.map((j, i) => [["A", "B", "C"][i], summarize(j)]),
);
const pairs = raw[0].runs.map((a, i) => {
  const b = raw[1].runs[i],
    c = raw[2].runs[i];
  assert.equal(a.seed, c.seed);
  assert.equal(b.scenario, c.scenario);
  return {
    seed: c.seed,
    scenario: c.scenario,
    durationA: a.duration,
    durationB: b.duration,
    durationC: c.duration,
    deltaBC: c.duration - b.duration,
    deltaAC: c.duration - a.duration,
    navA: a.navigationFailures,
    navB: b.navigationFailures,
    navC: c.navigationFailures,
    casualtiesA: a.casualties,
    casualtiesB: b.casualties,
    casualtiesC: c.casualties,
    loopsA: a.loops,
    loopsB: b.loops,
    loopsC: c.loops,
  };
});
const result = {
  versions,
  pairs,
  worstBC: [...pairs].sort((a, b) => b.deltaBC - a.deltaBC).slice(0, 15),
  worstAC: [...pairs].sort((a, b) => b.deltaAC - a.deltaAC).slice(0, 15),
};
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(result.versions.C);
