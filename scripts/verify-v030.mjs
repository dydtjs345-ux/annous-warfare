import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (p) => JSON.parse(readFileSync(p)),
  sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const allowed = new Set([
    "main.js",
    "soldier-prototype.js",
    "combat-atmosphere.js",
  ]),
  unchanged = {};
for (const f of readdirSync("src").filter(
  (f) => f.endsWith(".js") && !allowed.has(f),
)) {
  assert.deepEqual(
    readFileSync("src/" + f),
    readFileSync(`${process.argv[2] || "/tmp/aw-v030-base"}/src/${f}`),
    `unexpected nonprototype change: ${f}`,
  );
  unchanged[f] = sha("src/" + f);
}
const initial = read("reports/v030-parity-initial.json"),
  final = read("reports/v030-parity.json");
assert.equal(final.base, "dec95ef");
assert.equal(final.runs.length, 40);
assert.deepEqual(final.runs, initial.runs);
assert.ok(final.runs.every((r) => r.result && r.duration < 1800));
const legacy = read("reports/v030-legacy.json");
assert.equal(legacy.runs.length, 200);
assert.deepEqual(
  legacy.runs.map((r) => r.digest),
  read("reports/v025-after-A.json").runs.map((r) => r.digest),
);
const log = readFileSync("reports/v030-tests.txt", "utf8");
assert.equal(
  [...log.matchAll(/ℹ pass (\d+)/g)].reduce((s, m) => s + +m[1], 0),
  243,
);
assert.equal(
  [...log.matchAll(/ℹ fail (\d+)/g)].reduce((s, m) => s + +m[1], 0),
  0,
);
assert.match(readFileSync("reports/v030-build.txt", "utf8"), /✓ built in/);
const comparison = read("reports/v030-comparison.json");
assert.deepEqual(comparison.errors, []);
assert.deepEqual(comparison.failed, []);
assert.deepEqual(
  comparison.records.map((r) => r.size),
  ["1", "1.3", "1.5"],
);
assert.ok(
  comparison.records.every(
    (r) =>
      r.snapshot.time === comparison.records[0].snapshot.time &&
      r.snapshot.selected === 1,
  ),
);
const animation = read("reports/v030-animation.json");
assert.deepEqual(animation.errors, []);
const flashes = animation.runs.reduce((s, r) => s + r.firingFrames, 0);
assert.ok(flashes > 0);
const mobile = read("reports/v030-mobile.json");
assert.deepEqual(mobile.errors, []);
assert.equal(mobile.prototypeHeadSelection, true);
assert.equal(mobile.panPinch, true);
const actions = read("reports/v030-action-frames.json");
assert.deepEqual(
  actions.runs.map((r) => r.mode),
  ["reload", "full", "peek"],
);
assert.ok(
  actions.runs.every(
    (r) => r.errors.length === 0 && r.samples.some((s) => s.prototype?.visible),
  ),
);
const atlas = read("public/assets/usmc-rifleman/rifleman.json");
assert.equal(Object.keys(atlas.frames).length, 144);
assert.ok(statSync("reports/v030-prototype-gameplay.mp4").size > 10000);
const out = {
  base: "dec95ef",
  unchangedModules: unchanged,
  tests: 243,
  failures: 0,
  recordedCompleteExecutions: 360,
  pairedConfigurations: 40,
  pairedRounds: 2,
  legacyHashes: 200,
  gameplayDivergence: 0,
  eligibleSoldier: 1,
  defaultPrototypeEnabled: false,
  assetHashes: Object.fromEntries(
    readdirSync("public/assets/usmc-rifleman").map((f) => [
      f,
      sha("public/assets/usmc-rifleman/" + f),
    ]),
  ),
  comparisonTimes: comparison.records.map((r) => [r.size, r.snapshot.time]),
  observedFiringSoldierFrames: flashes,
  mobile,
  physicalSafari: "unverified",
  artQuality:
    "working asset-based evaluation prototype; not production/historical certification",
};
writeFileSync(
  "reports/v030-validation.json",
  JSON.stringify(out, null, 2) + "\n",
);
console.log({
  tests: 243,
  recordedCompleteExecutions: 360,
  legacyHashes: 200,
  observedFiringSoldierFrames: flashes,
});
