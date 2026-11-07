import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (p) => JSON.parse(readFileSync(p)),
  sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const baseline = process.argv[2] || "/tmp/aw-v031-base",
  unchanged = {};
for (const f of readdirSync("src").filter(
  (f) => f.endsWith(".js") && !["main.js", "soldier-prototype.js"].includes(f),
)) {
  assert.deepEqual(
    readFileSync("src/" + f),
    readFileSync(baseline + "/src/" + f),
    "unexpected core/shared-renderer change: " + f,
  );
  unchanged[f] = sha("src/" + f);
}
const parity = read("reports/v031-parity.json");
assert.equal(parity.base, "e032103");
assert.equal(parity.matched, 40);
assert.equal(parity.completeExecutions, 80);
assert.equal(parity.runs.length, 40);
assert.deepEqual(
  parity.runs,
  read("reports/v030-parity.json").runs,
  "inherited 40 replay hashes must remain unchanged",
);
assert.ok(parity.runs.every((r) => r.result && r.duration < 1800));
const log = readFileSync("reports/v031-tests.txt", "utf8"),
  passes = [...log.matchAll(/ℹ pass (\d+)/g)].reduce((s, m) => s + +m[1], 0),
  fails = [...log.matchAll(/ℹ fail (\d+)/g)].reduce((s, m) => s + +m[1], 0);
assert.equal(passes, 247);
assert.equal(fails, 0);
assert.match(readFileSync("reports/v031-build.txt", "utf8"), /✓ built in/);
const comparison = read("reports/v031-comparison.json");
assert.deepEqual(comparison.errors, []);
assert.deepEqual(comparison.failed, []);
assert.equal(comparison.records.length, 6);
for (const r of comparison.records) {
  assert.equal(r.snapshot.time, comparison.records[0].snapshot.time);
  assert.equal(r.snapshot.selected, 1);
  assert.equal(r.snapshot.prototype.state.art, r.art);
  assert.equal(r.snapshot.prototype.state.visible, true);
}
const animation = read("reports/v031-animation.json"),
  flashes = animation.runs
    .flatMap((r) => r.samples)
    .filter((r) => r.prototype.state?.visible && r.prototype.state.flash);
assert.deepEqual(animation.errors, []);
assert.ok(flashes.length > 0);
assert.ok(animation.recordedFrames.length > 100);
for (const s of flashes) {
  const a = s.unit.shotDirection,
    e = Math.atan2(
      (Math.sin(a) + Math.cos(a)) * 0.5,
      Math.cos(a) - Math.sin(a),
    ),
    actual = s.prototype.state.gunAngle;
  assert.ok(
    Math.abs(Math.atan2(Math.sin(actual - e), Math.cos(actual - e))) < 1e-8,
  );
  assert.equal(s.prototype.state.art, "v031");
}
const mobile = read("reports/v031-mobile.json");
assert.deepEqual(mobile.errors, []);
assert.equal(mobile.prototypeHeadSelection, true);
assert.equal(mobile.panPinch, true);
assert.deepEqual(mobile.artBanks, ["v030", "v031"]);
const actions = read("reports/v031-action-frames.json");
assert.deepEqual(
  actions.runs.map((r) => r.mode),
  ["reload", "full", "peek"],
);
assert.ok(
  actions.runs.every(
    (r) =>
      r.errors.length === 0 &&
      r.samples.some((s) => s.prototype?.visible && s.prototype.art === "v031"),
  ),
);
assert.ok(statSync("reports/v031-prototype-gameplay.mp4").size > 10000);
for (const name of [
  "comparison-detail",
  "firing-frames",
  "reload-frames",
  "full-frames",
  "peek-frames",
]) {
  assert.ok(statSync(`reports/v031-${name}.png`).size > 1000);
}
const out = {
  base: "e032103",
  tests: passes,
  failures: fails,
  matchedConfigurations: 40,
  completeExecutions: 80,
  combatDivergences: 0,
  inheritedReplayHashesCompared: 40,
  legacyArchive200Rerun: false,
  unchangedModules: unchanged,
  eligibleUnit: 1,
  prototypeDefaultEnabled: false,
  displaySizes: [1, 1.3, 1.5],
  artBanks: ["v030", "v031"],
  observedFiringFrames: flashes.length,
  recordedFrames: animation.recordedFrames.length,
  mobile,
  physicalSafari: "unverified",
  assetHashes: Object.fromEntries(
    readdirSync("public/assets/usmc-rifleman-v031").map((f) => [
      f,
      sha("public/assets/usmc-rifleman-v031/" + f),
    ]),
  ),
};
writeFileSync(
  "reports/v031-validation.json",
  JSON.stringify(out, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    tests: passes,
    failures: fails,
    completeExecutions: 80,
    combatDivergences: 0,
    observedFiringFrames: flashes.length,
  }),
);
