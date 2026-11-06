// Read-only verification of recorded inputs and independent replay hashes.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (p) => JSON.parse(readFileSync(p));
const before = read("reports/v026-expanded-before.json"),
  after = read("reports/v026-expanded-after.json"),
  legacy = read("reports/v026-legacy.json"),
  reference = read("reports/v025-after-A.json");
for (const cohort of [before, after, legacy]) {
  assert.equal(cohort.runs.length, 200);
  assert.ok(cohort.runs.every((r) => r.result && !r.stalled));
}
for (let i = 0; i < 200; i++) {
  const b = before.runs[i],
    a = after.runs[i];
  assert.equal(b.seed, 2001 + i);
  assert.equal(a.seed, b.seed);
  assert.equal(a.scenario, b.scenario);
  assert.deepEqual(a.config, b.config);
  assert.equal(legacy.runs[i].seed, i + 1);
  assert.equal(legacy.runs[i].digest, reference.runs[i].digest);
}
const replayCounts = {};
for (const group of ["worst", "regressed"])
  for (const [version, raw] of [
    ["before", before],
    ["after", after],
  ]) {
    const path = `reports/v026-${group}-${version}.json`,
      traces = read(path);
    assert.equal(traces.length, 15);
    for (const trace of traces) {
      const r = raw.runs.find((r) => r.seed === trace.seed);
      assert.deepEqual(trace.config, r.config);
      assert.equal(trace.replayedDuration, r.duration);
      assert.equal(trace.digest, r.digest);
      assert.equal(trace.search.digest, r.search.digest);
    }
    replayCounts[`${group}-${version}`] = traces.length;
  }
const rendered = read("reports/v026-render-parity.json");
assert.equal(rendered.runs.length, 5);
for (const r of rendered.runs) {
  const a = after.runs.find((a) => a.seed === r.seed);
  assert.equal(r.digest, a.digest);
  assert.equal(r.search.digest, a.search.digest);
}
const mobile = read("reports/v026-mobile.json");
assert.deepEqual(mobile.errors, []);
assert.deepEqual(mobile.failedRequests, []);
assert.equal(mobile.overviewCentered, true);
assert.equal(mobile.inspectorResizeSynchronized, true);
const repeatedMobile = read("reports/v026-mobile-repeat.json");
assert.deepEqual(repeatedMobile.errors, []);
assert.deepEqual(repeatedMobile.failedRequests, []);
assert.equal(repeatedMobile.overviewCentered, true);
assert.equal(repeatedMobile.inspectorResizeSynchronized, true);
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const datasets = readdirSync("reports").filter(
  (f) =>
    /^v026-.*\.json$/.test(f) &&
    !["v026-validation.json", "v026-milestone-validation.json"].includes(f),
);
const result = {
  baseMain: "86f8498",
  prerequisites: ["35cd2ee", "0a110db"],
  expandedInitialSourceCommit: "1c438e3",
  method:
    "200 legacy + 200 initial expanded + same 200 corrected expanded; independent traces compare both per-step combat and sampled search-memory hashes",
  plannedMatchesCompleted: 600,
  plannedTimeouts: 0,
  legacyCoreHashesPreserved: 200,
  identicalExpandedConfigurations: 200,
  verifiedReplayGroups: replayCounts,
  renderedCompleteMatchesWithExactParity: 5,
  tests: {
    pass: 178,
    fail: 0,
    groups: [56, 17, 17, 19, 4, 10, 7, 19, 5, 5, 15, 4],
  },
  productionBuild: "passed; existing large Phaser chunk advisory",
  mobile: "reports/v026-mobile.json",
  mobileRepeat: "reports/v026-mobile-repeat.json",
  physicalSafari: "not tested",
  datasetHashes: Object.fromEntries(
    datasets.map((p) => [`reports/${p}`, hash(`reports/${p}`)]),
  ),
  sourceHashes: Object.fromEntries(
    readdirSync("src")
      .filter((p) => /\.(js|css)$/.test(p))
      .map((p) => [`src/${p}`, hash(`src/${p}`)]),
  ),
};
writeFileSync(
  "reports/v026-validation.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log({
  matches: 600,
  legacyHashes: 200,
  replayCounts,
  renderedParity: 5,
});
