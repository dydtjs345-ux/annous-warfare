import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (p) => JSON.parse(readFileSync(p)),
  sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const allowed = new Set([
  "main.js",
  "combat-visuals.js",
  "urban-visuals.js",
  "combat-atmosphere.js",
  "urban-detail.js",
  "motion-presentation.js",
]);
const core = {};
for (const f of readdirSync("src").filter(
  (f) => f.endsWith(".js") && !allowed.has(f),
)) {
  assert.deepEqual(
    readFileSync("src/" + f),
    readFileSync(`${process.argv[2] || "/tmp/aw-v029-base"}/src/${f}`),
    `unexpected nonvisual change: ${f}`,
  );
  core[f] = sha("src/" + f);
}
const legacy = read("reports/v029-legacy.json");
assert.equal(legacy.runs.length, 200);
assert.deepEqual(
  legacy.runs.map((r) => r.digest),
  read("reports/v025-after-A.json").runs.map((r) => r.digest),
);
for (const file of ["v029-parity", "v029-parity-initial"]) {
  const j = read(`reports/${file}.json`);
  assert.equal(j.matched, 40);
  assert.equal(j.runs.length, 40);
  assert.ok(j.runs.every((r) => r.result && r.duration < 1800));
}
assert.deepEqual(
  read("reports/v029-parity.json").runs,
  read("reports/v029-parity-initial.json").runs,
  "renderer-active replay preserves initial per-tick digests",
);
const log = readFileSync("reports/v029-tests.txt", "utf8");
const groups = [...log.matchAll(/ℹ pass (\d+)/g)].map((m) => +m[1]);
assert.equal(
  groups.reduce((a, b) => a + b, 0),
  231,
);
assert.equal(
  [...log.matchAll(/ℹ fail (\d+)/g)].reduce((a, m) => a + +m[1], 0),
  0,
);
assert.match(readFileSync("reports/v029-build.txt", "utf8"), /✓ built in/);
const mobile = read("reports/v029-mobile.json");
assert.deepEqual(mobile.errors, []);
assert.equal(mobile.panPinch, true);
const qa = read("reports/v029-qa.json");
assert.equal(qa.rows.length, 5);
assert.ok(qa.rows.every((r) => r.captured && r.errors.length === 0));
assert.equal(qa.rows.find((r) => r.mode === "full").poses[0].posture, "full");
assert.equal(qa.rows.find((r) => r.mode === "peek").poses[0].posture, "peek");
assert.ok(
  qa.rows.find((r) => r.mode === "fire").events.some((e) => e.type === "shot"),
);
assert.ok(
  qa.rows
    .find((r) => r.mode === "fire")
    .events.some((e) => e.type === "damage"),
);
assert.equal(qa.rows.find((r) => r.mode === "medic").poses[5].pose, "treating");
assert.ok(qa.rows.find((r) => r.mode === "grenade").stats.detonated > 0);
const motion = read("reports/v029-motion-frames.json");
assert.equal(motion.pauseFrozen, true);
assert.equal(motion.restart, true);
assert.deepEqual(motion.errors, []);
assert.deepEqual(
  motion.runs.map((r) => r.speed),
  [1, 2, 4],
);
assert.ok(motion.runs[0].intermediate > 5);
assert.ok(motion.runs.some((r) => r.flashFrames > 0));
assert.deepEqual(
  read("reports/v029-parity.json").runs,
  read("reports/v029-parity-before-motion.json").runs,
);
const actions = read("reports/v029-motion-actions.json");
assert.deepEqual(
  actions.runs.map((r) => r.mode),
  ["medic", "reload", "mount"],
);
assert.ok(
  actions.runs.every((r) => r.samples.length === 6 && r.errors.length === 0),
);

const result = {
  base: "4abb428",
  unchangedCoreModules: core,
  motionCheckpoint: "5e83f01",
  motionPlaybackRuns: 80,
  gameplayRecording: "reports/v029-motion-gameplay.mp4",
  tests: 231,
  failures: 0,
  matchedFinalCases: 40,
  matchedInitialCases: 40,
  recordedCompleteExecutions: 440,
  legacyHashesPreserved: 200,
  physicalSafari: "unverified",
  mobile,
  qaCaptureTimes: qa.rows.map((r) => [r.mode, r.time]),
  images: Object.fromEntries(
    readdirSync("reports")
      .filter((f) => /^v029-.*\.png$/.test(f))
      .map((f) => [f, sha("reports/" + f)]),
  ),
};
writeFileSync(
  "reports/v029-validation.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log({
  tests: 231,
  legacyHashesPreserved: 200,
  recordedCompleteExecutions: 440,
  qaScenes: 5,
});
