// Verifies recorded runs; npm test/build/mobile checks are separately executed.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (p) => JSON.parse(readFileSync(p)),
  sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const base = read("reports/v027-expanded-baseline.json"),
  ref = read("reports/v025-after-A.json");
assert.deepEqual(
  base.runs.map((r) => r.digest),
  read("reports/v026-expanded-after.json").runs.map((r) => r.digest),
  "fresh main baseline reproduces the archived v0.2.6 cohort",
);
const mainFiles = [
  "v027-expanded-baseline",
  "v027-legacy",
  "v027-expanded-final-initial",
  "v027-cover-initial",
  "v027-movement-initial",
  "v027-expanded-final",
  "v027-cover-final",
  "v027-movement-final",
  "v027-expanded-final-v2",
  "v027-cover-final-v2",
  "v027-movement-final-v2",
  "v027-expanded-final-v3",
  "v027-cover-final-v3",
  "v027-movement-final-v3",
  "v027-legacy-final",
];
let largeRuns = 0;
for (const f of mainFiles) {
  const j = read(`reports/${f}.json`);
  assert.equal(j.runs.length, 200);
  assert.ok(j.runs.every((r) => r.result && !r.timeout && !r.stalled));
  largeRuns += j.runs.length;
}
for (const name of ["v027-legacy", "v027-legacy-final"])
  assert.deepEqual(
    read(`reports/${name}.json`).runs.map((r) => r.digest),
    ref.runs.map((r) => r.digest),
  );
for (const v of ["final-initial", "final", "final-v2", "final-v3"]) {
  const j = read(`reports/v027-expanded-${v}.json`);
  j.runs.forEach((r, i) => {
    assert.equal(r.seed, base.runs[i].seed);
    assert.equal(r.scenario, base.runs[i].scenario);
    assert.deepEqual(r.config, base.runs[i].config);
  });
}
for (const cohort of ["cover", "movement"]) {
  const initial = read(`reports/v027-${cohort}-initial.json`);
  for (const phase of ["final", "final-v2", "final-v3"])
    read(`reports/v027-${cohort}-${phase}.json`).runs.forEach((r, i) => {
      assert.equal(r.seed, initial.runs[i].seed);
      assert.equal(r.scenario, initial.runs[i].scenario);
      assert.deepEqual(r.options, initial.runs[i].options);
      assert.deepEqual(r.initial, initial.runs[i].initial);
    });
}
const pairs = [
  ["v027-problem-cases", "v027-problem-replays-initial"],
  ["v027-problem-cases", "v027-problem-replays-final"],
  ["v027-problem-cases-final", "v027-problem-replays-corrected"],
  ["v027-problem-cases-v3", "v027-problem-replays-v3"],
  ["v027-geometry-extremes-v2", "v027-geometry-traces-v2"],
  ["v027-geometry-extremes-v3", "v027-geometry-traces-v3"],
];
let replayRuns = 0;
for (const [cases, traces] of pairs) {
  const c = read(`reports/${cases}.json`),
    t = read(`reports/${traces}.json`);
  assert.equal(c.length, t.length);
  t.forEach((r, i) => {
    assert.equal(r.digest, c[i].record.digest);
    assert.ok(r.result);
    assert.equal(r.duration, c[i].record.duration);
  });
  replayRuns += t.length;
}
for (const [traces, raw] of [
  ["baseline", "baseline"],
  ["final", "final-v2"],
  ["v3", "final-v3"],
]) {
  const rows = read(`reports/v027-expanded-adverse-${traces}.json`),
    j = read(`reports/v027-expanded-${raw}.json`);
  assert.equal(rows.length, 5);
  for (const r of rows) {
    const expected = j.runs.find((e) => e.seed === r.seed);
    assert.equal(r.digest, expected.digest);
    assert.equal(r.search.digest, expected.search.digest);
    assert.ok(r.result);
  }
  replayRuns += rows.length;
}
const milestones = readdirSync("reports").filter((p) =>
  /^v027-m[1-6]-(before|after|initial)\.json$/.test(p),
);
let milestoneRuns = 0;
for (const file of milestones) {
  const j = read(`reports/${file}`);
  assert.ok(j.runs.every((r) => r.result && !r.timeout));
  milestoneRuns += j.runs.length;
}
const repeats = read("reports/v027-milestone-replays.json");
let repeatedMilestoneRuns = 0;
for (const q of repeats) {
  assert.equal(q.runs.length, 12);
  assert.equal(q.matchedSavedCohort, true);
  assert.deepEqual(
    q.runs.map((r) => [r.seed, r.duration, r.result, r.digest]),
    read(q.reference).runs.map((r) => [r.seed, r.duration, r.result, r.digest]),
  );
  repeatedMilestoneRuns += q.runs.length;
}
assert.deepEqual(
  read("reports/v027-m6-after.json").runs.map((r) => r.digest),
  read("reports/v027-m6-before.json").runs.map((r) => r.digest),
  "presentation-only M6 preserves every complete-match outcome",
);
let playbackRuns = 0;
const playbackSeeds = [2001, 2002, 2011, 2012, 2017, 2037];
const playback = read("reports/v027-playback-parity.json");
for (const file of ["v027-playback-parity", "v027-resumed-playback"]) {
  const j = read(`reports/${file}.json`);
  assert.equal(j.runs.length, 24);
  assert.deepEqual(j.runs, playback.runs, "independent full-match replay");
  for (const seed of playbackSeeds) {
    const rows = j.runs.filter((r) => r.seed === seed);
    assert.deepEqual(
      rows.map((r) => r.speed),
      ["headless", 1, 2, 4],
    );
    for (const r of rows) {
      assert.equal(r.dt, 0.05);
      assert.ok(r.result);
      assert.ok(r.duration < 1800);
      assert.equal(r.digest, rows[0].digest);
    }
  }
  playbackRuns += j.runs.length;
}
const testLog = readFileSync("reports/v027-tests.txt", "utf8");
const testCounts = [...testLog.matchAll(/ℹ tests (\d+)/g)].map((m) =>
  Number(m[1]),
);
const passCounts = [...testLog.matchAll(/ℹ pass (\d+)/g)].map((m) =>
  Number(m[1]),
);
const failCounts = [...testLog.matchAll(/ℹ fail (\d+)/g)].map((m) =>
  Number(m[1]),
);
assert.equal(testCounts.length, 18);
assert.deepEqual(passCounts, testCounts);
assert.equal(failCounts.length, 18);
assert.ok(failCounts.every((n) => n === 0));
assert.equal(
  passCounts.reduce((sum, n) => sum + n, 0),
  216,
);
assert.match(readFileSync("reports/v027-build.txt", "utf8"), /✓ built in/);
const mobile = read("reports/v027-mobile-v3.json");
assert.deepEqual(mobile.errors, []);
assert.deepEqual(mobile.failedRequests, []);
assert.equal(mobile.nativeInspectorTouchScroll, true);
assert.equal(mobile.grenadeCounterAccurate, true);
const grenades = read("reports/v027-mobile-grenades-final.json");
assert.deepEqual(
  grenades.runs.map((r) => r.speed),
  [1, 2, 4],
);
for (const r of grenades.runs) {
  assert.ok(r.flight.stats.thrown > 0);
  assert.ok(r.blast.stats.detonated > 0);
  assert.deepEqual(r.errors, []);
}
const j = {
  baseMain: "6d61f9c",
  aiStabilizationCommit: "6f2a2d6",
  finalPresentationCorrections:
    "Flash above smoke; refreshed suppression eligibility explanation. Exact final source SHA-256 hashes below.",
  milestones: {
    M1: "a23fa15",
    M2: "c5f5056",
    M3: "9fb9b1a",
    M4: "a703d27",
    M5: "9dd59f6",
    M6: "e1493fe",
    M7checkpoint: "cdb206d",
    M7: "6f2a2d6",
  },
  largeAuditRuns: largeRuns,
  milestoneRuns,
  replayRuns,
  repeatedMilestoneRuns,
  playbackRuns,
  recordedCompleteMatches:
    largeRuns +
    milestoneRuns +
    replayRuns +
    repeatedMilestoneRuns +
    playbackRuns,
  timeouts: 0,
  legacyHashesPreserved: 200,
  legacyVerificationBatches: 2,
  finalExpandedConfigurationsMatched: 200,
  finalSpecialtyConfigurationsMatched: 400,
  tests: {
    pass: 216,
    fail: 0,
    groups: testCounts,
    log: "reports/v027-tests.txt",
    sha256: sha("reports/v027-tests.txt"),
  },
  build: {
    status: "passed; existing Phaser chunk advisory",
    log: "reports/v027-build.txt",
    sha256: sha("reports/v027-build.txt"),
  },
  mobile: "reports/v027-mobile-v3.json",
  grenadeMobile: "reports/v027-mobile-grenades-final.json",
  physicalSafari: "unverified",
  datasetHashes: Object.fromEntries(
    readdirSync("reports")
      .filter((p) => /^v027-.*\.json$/.test(p) && p !== "v027-validation.json")
      .map((p) => [`reports/${p}`, sha(`reports/${p}`)]),
  ),
  sourceHashes: Object.fromEntries(
    readdirSync("src")
      .filter((p) => /\.(js|css)$/.test(p))
      .map((p) => [`src/${p}`, sha(`src/${p}`)]),
  ),
};
assert.equal(largeRuns, 3000);
assert.equal(milestoneRuns, 144);
assert.equal(replayRuns, 103);
assert.equal(repeatedMilestoneRuns, 48);
assert.equal(playbackRuns, 48);
assert.equal(j.recordedCompleteMatches, 3343);
writeFileSync(
  "reports/v027-validation.json",
  JSON.stringify(j, null, 2) + "\n",
);
console.log({
  largeRuns,
  milestoneRuns,
  replayRuns,
  repeatedMilestoneRuns,
  playbackRuns,
  recordedCompleteMatches: j.recordedCompleteMatches,
  timeouts: 0,
  legacyHashes: 200,
});
