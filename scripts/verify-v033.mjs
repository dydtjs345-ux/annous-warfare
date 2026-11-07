import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (p) => JSON.parse(readFileSync(p)),
  sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex"),
  base = process.argv[2] || "/tmp/aw-v033-base";
// Keep the first-pass evidence historical after the resumed correction.
if (read("public/assets/usmc-se-v033/metadata.json").revisionBaseCommit) {
  await import("./verify-v033-correction.mjs");
  process.exit(0);
}
const unchanged = {};
for (const f of readdirSync(base + "/src").filter(
  (f) => f.endsWith(".js") && f !== "usmc-se-preview.js",
)) {
  assert.deepEqual(
    readFileSync("src/" + f),
    readFileSync(base + "/src/" + f),
    "existing non-preview module changed: " + f,
  );
  unchanged[f] = sha("src/" + f);
}
const oldRoot = "public/assets/usmc-se-v032/";
for (const f of readdirSync(oldRoot))
  assert.deepEqual(
    readFileSync(oldRoot + f),
    readFileSync(base + "/" + oldRoot + f),
    "v032 comparison asset changed: " + f,
  );
const log = readFileSync("reports/v033-tests.txt", "utf8"),
  passes = [...log.matchAll(/ℹ pass (\d+)/g)].reduce((s, m) => s + +m[1], 0),
  fails = [...log.matchAll(/ℹ fail (\d+)/g)].reduce((s, m) => s + +m[1], 0);
assert.equal(passes, 258);
assert.equal(fails, 0);
assert.match(readFileSync("reports/v033-build.txt", "utf8"), /✓ built in/);
const parity = read("reports/v033-parity.json");
assert.equal(parity.base, "384e6e9");
assert.equal(parity.runs.length, 40);
assert.equal(parity.completeExecutions, 80);
assert.deepEqual(parity.runs, read("reports/v032-parity.json").runs);
const frames = read("reports/v033-frames.json");
assert.deepEqual(frames.errors, []);
assert.deepEqual(frames.failed, []);
assert.deepEqual(
  frames.records.slice(0, 6).map((r) => r.mode),
  ["idle", "walk", "raise", "aim", "fire", "lower"],
);
for (const r of frames.records) {
  const s = r.snapshot;
  assert.equal(s.views.length, 4);
  assert.equal(s.stacked, false);
  for (const v of s.views) {
    assert.equal(v.frame, s.pose.frame);
    assert.equal(v.rotation, 0);
    assert.equal(v.scale, v.scaleY);
    const height = v.scale * (v.bank === "v032" ? 200 : 205);
    assert.ok(Math.abs(height - (v.actual ? 39 : 156)) < 1e-9);
    assert.ok(
      v.bounds.left >= 0 &&
        v.bounds.right <= s.canvas.width &&
        v.bounds.bottom <= s.canvas.height,
    );
  }
  for (const actual of [true, false]) {
    const pair = s.views.filter((v) => v.actual === actual);
    assert.equal(pair[0].groundY, pair[1].groundY);
  }
}
const animation = read("reports/v033-animation.json");
assert.deepEqual(animation.errors, []);
assert.equal(animation.pauseFreeze, true);
for (const r of animation.runs) {
  assert.deepEqual(r.stages, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(r.visibleFlashFrames > 0);
  assert.equal(Math.max(...r.samples.map((s) => s.shotCues)), 2);
  assert.ok(
    r.samples.every(
      (s) =>
        s.views.length === 4 &&
        s.views.every(
          (v) =>
            v.frame === s.pose.frame &&
            v.rotation === 0 &&
            v.scale === v.scaleY,
        ),
    ),
  );
}
assert.deepEqual(
  [...new Set(animation.runs[0].samples.map((s) => s.pose.frame))].sort(
    (a, b) => a - b,
  ),
  Array.from({ length: 24 }, (_, i) => i),
);
const mobile = read("reports/v033-mobile-preview.json"),
  game = read("reports/v033-game-mobile.json");
assert.deepEqual(mobile.errors, []);
assert.deepEqual(mobile.failed, []);
assert.deepEqual(mobile.sideBySideVersions, ["v032", "v033"]);
assert.equal(mobile.stackedAtLargeZoom, true);
assert.equal(mobile.touchScroll, true);
assert.equal(mobile.pausedStateRestored, true);
assert.deepEqual(game.errors, []);
assert.equal(game.panPinch, true);
const before = read("reports/v033-layout-before.json"),
  layout = read("reports/v033-layout-check.json"),
  beforeClipped = before.filter((s) =>
    s.views.some(
      (v) =>
        v.bounds.left < 0 ||
        v.bounds.right > s.canvas.width ||
        v.bounds.bottom > s.canvas.height,
    ),
  ).length;
assert.ok(beforeClipped > 0);
assert.equal(layout.cases, 16);
assert.equal(layout.clippedCases, 0);
for (const name of [
  "proportion-comparison",
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
  assert.ok(statSync(`reports/v033-${name}.png`).size > 1000);
for (const ext of ["mp4", "gif"])
  assert.ok(statSync(`reports/v033-proportions.${ext}`).size > 10000);
const reference = read("reports/v033-reference-pose.json");
assert.equal(reference.snapshot.pose.frame, 23);
assert.equal(reference.snapshot.size, 1.3);
assert.equal(reference.snapshot.zoom, 4);
assert.deepEqual(reference.errors, []);
for (const f of ["mobile-reference", "reference-pose-comparison"])
  assert.ok(statSync(`reports/v033-${f}.png`).size > 1000);
const video = read("reports/v033-video-info.json");
assert.ok(+video.format.duration > 11.44);
const root = "public/assets/usmc-se-v033/";
const out = {
  base: "384e6e9",
  tests: passes,
  failures: fails,
  completeExecutions: 80,
  matchedConfigurations: 40,
  replayDivergences: 0,
  originalV032AssetsUnchanged: true,
  oldClockUnchanged: true,
  unchangedModules: unchanged,
  recordedFrames: animation.frames.length,
  previewSpeedChecks: animation.runs.map((r) => ({
    speed: r.speed,
    stages: r.stages,
    visibleFlashFrames: r.visibleFlashFrames,
  })),
  layoutRegression: {
    beforeCases: before.length,
    beforeClippedCases: beforeClipped,
    afterCases: layout.cases,
    afterClippedCases: 0,
  },
  mobile,
  gameControls: game,
  video,
  assetHashes: Object.fromEntries(
    readdirSync(root).map((f) => [f, sha(root + f)]),
  ),
  percentageTargets:
    "art direction guides; no exact per-cel anatomical measurement claim",
  newDirections: "none; SE only",
  physicalSafari: "unverified",
};
writeFileSync(
  "reports/v033-validation.json",
  JSON.stringify(out, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    tests: passes,
    failures: fails,
    completeExecutions: 80,
    replayDivergences: 0,
    layoutCases: layout.cases,
    layoutClipped: 0,
    recordedFrames: animation.frames.length,
  }),
);
