import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (p) => JSON.parse(readFileSync(p)),
  hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex"),
  base = process.argv[2] || "/tmp/aw-v032-base";
const unchanged = {};
for (const f of readdirSync(base + "/src").filter(
  (f) => f.endsWith(".js") && f !== "main.js",
)) {
  assert.deepEqual(
    readFileSync("src/" + f),
    readFileSync(base + "/src/" + f),
    "existing module changed: " + f,
  );
  unchanged[f] = hash("src/" + f);
}
assert.equal(
  readFileSync("src/main.js", "utf8").split("  update(_, delta) {")[1],
  readFileSync(base + "/src/main.js", "utf8").split("  update(_, delta) {")[1],
  "main simulation/render update loop changed",
);
const parity = read("reports/v032-parity.json");
assert.equal(parity.base, "c6cc07e");
assert.equal(parity.runs.length, 40);
assert.equal(parity.completeExecutions, 80);
assert.deepEqual(
  parity.runs,
  read("reports/v031-parity.json").runs,
  "inherited replay hashes changed",
);
const log = readFileSync("reports/v032-tests.txt", "utf8"),
  passes = [...log.matchAll(/ℹ pass (\d+)/g)].reduce((s, m) => s + +m[1], 0),
  fails = [...log.matchAll(/ℹ fail (\d+)/g)].reduce((s, m) => s + +m[1], 0);
assert.equal(passes, 255);
assert.equal(fails, 0);
assert.match(readFileSync("reports/v032-build.txt", "utf8"), /✓ built in/);
const frames = read("reports/v032-frames.json");
assert.deepEqual(frames.errors, []);
assert.deepEqual(frames.failed, []);
assert.deepEqual(
  frames.records.slice(0, 6).map((r) => r.mode),
  ["idle", "walk", "raise", "aim", "fire", "lower"],
);
for (const r of frames.records) {
  assert.equal(r.snapshot.direction, "SE");
  assert.equal(r.snapshot.playing, false);
  assert.ok(
    r.snapshot.views.every(
      (v) => v.rotation === 0 && v.frame === r.snapshot.pose.frame,
    ),
  );
}
const animation = read("reports/v032-animation.json");
assert.deepEqual(animation.errors, []);
assert.equal(animation.pauseFreeze, true);
assert.ok(animation.frames.length > 100);
for (const run of animation.runs) {
  assert.deepEqual(run.stages, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(run.visibleFlashFrames > 0);
  assert.equal(Math.max(...run.samples.map((s) => s.shotCues)), 2);
  assert.ok(run.samples.every((s) => !s.pose.flash || s.pose.clip === "fire"));
  assert.ok(
    run.samples.every((s) =>
      s.views.every((v) => v.frame === s.pose.frame && v.rotation === 0),
    ),
  );
}
assert.deepEqual(
  [...new Set(animation.runs[0].samples.map((s) => s.pose.frame))].sort(
    (a, b) => a - b,
  ),
  Array.from({ length: 24 }, (_, i) => i),
);
const mobile = read("reports/v032-mobile-preview.json"),
  game = read("reports/v032-game-mobile.json");
assert.deepEqual(mobile.errors, []);
assert.deepEqual(mobile.failed, []);
assert.equal(mobile.touchScroll, true);
assert.equal(mobile.battleFrozenWhileOpen, true);
assert.equal(mobile.pausedStateRestored, true);
assert.equal(mobile.frameDestroyedAcrossRestarts, 3);
assert.deepEqual(game.errors, []);
assert.equal(game.panPinch, true);
assert.equal(game.nativeScroll, true);
for (const name of [
  "idle",
  "walk",
  "raise",
  "aim",
  "fire",
  "lower",
  "mobile-preview",
  "walk-cels",
  "raise-cels",
  "fire-cels",
  "lower-cels",
])
  assert.ok(statSync(`reports/v032-${name}.png`).size > 1000);
for (const ext of ["mp4", "gif"])
  assert.ok(statSync(`reports/v032-se-sequence.${ext}`).size > 10000);
const video = read("reports/v032-video-info.json");
assert.ok(+video.format.duration > 11.44);
const assetRoot = "public/assets/usmc-se-v032/",
  assetHashes = Object.fromEntries(
    readdirSync(assetRoot).map((f) => [f, hash(assetRoot + f)]),
  );
const out = {
  base: "c6cc07e",
  tests: passes,
  failures: fails,
  completeExecutions: 80,
  matchedConfigurations: 40,
  inheritedReplayHashesCompared: 40,
  combatDivergences: 0,
  unchangedModules: unchanged,
  mainUpdateLoopUnchanged: true,
  direction: "SE only",
  newFigureTransforms:
    "whole-body frame and uniform scale only; no independent weapon/limbs",
  recordedFrames: animation.frames.length,
  previewSpeedChecks: animation.runs.map((r) => ({
    speed: r.speed,
    stages: r.stages,
    visibleFlashFrames: r.visibleFlashFrames,
  })),
  mobile,
  gameControls: game,
  video,
  assetHashes,
  referenceQualityArtRequirement:
    "not satisfied; generated cel consistency and footwork need artist cleanup",
  newBattleRendererApplied: false,
  physicalSafari: "unverified",
};
writeFileSync(
  "reports/v032-validation.json",
  JSON.stringify(out, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    tests: passes,
    failures: fails,
    completeExecutions: 80,
    divergences: 0,
    recordedFrames: animation.frames.length,
    referenceQuality: "not satisfied",
  }),
);
