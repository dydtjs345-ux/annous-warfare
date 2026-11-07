import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";
const out = "reports/v033-correction";
const read = path => JSON.parse(readFileSync(path));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { maxBuffer: 16e6 });
const meta = read("public/assets/usmc-se-v033/metadata.json");
const unchanged = {};
// Every runtime module and every earlier art asset stays byte-identical.
const paths = git("ls-tree", "-r", "--name-only", "a920240", "src", "public/assets")
  .toString().trim().split("\n").filter(p => !p.startsWith("public/assets/usmc-se-v033/"));
for (const path of paths) {
  const current = readFileSync(path);
  assert.deepEqual(current, git("show", `a920240:${path}`), `changed runtime/earlier art: ${path}`);
  unchanged[path] = hash(current);
}
assert.equal(meta.revisionBaseSha256, hash(git("show", "a920240:public/assets/usmc-se-v033/source-atlas.png")));
const log = readFileSync(`${out}/tests.txt`, "utf8");
const count = kind => [...log.matchAll(new RegExp(`ℹ ${kind} (\\d+)`, "g"))].reduce((s, m) => s + +m[1], 0);
assert.equal(count("pass"), 258); assert.equal(count("fail"), 0);
assert.match(readFileSync(`${out}/build.txt`, "utf8"), /✓ built in/);
const frames = read(`${out}/frames.json`);
const atlasHash = hash(readFileSync("public/assets/usmc-se-v033/source-atlas.png"));
assert.equal(frames.assetSha256, atlasHash);
assert.equal(frames.baseline, "a920240");
assert.deepEqual(frames.errors, []); assert.deepEqual(frames.failed, []);
for (const revision of ["before", "after"]) {
  const records = frames.records.filter(r => r.revision === revision);
  assert.deepEqual(records.map(r => r.frame).sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i));
  for (const r of records) {
    assert.equal(r.snapshot.playing, false);
    assert.equal(r.snapshot.pose.frame, r.frame);
    assert.equal(r.snapshot.pose.flash, r.frame === 17);
    const d = revision === "after" ? meta : JSON.parse(git("show", "a920240:public/assets/usmc-se-v033/metadata.json"));
    for (const v of r.snapshot.views) {
      assert.equal(v.frame, r.frame); assert.equal(v.scale, v.scaleY); assert.equal(v.rotation, 0);
      assert.ok(v.bounds.left >= 0 && v.bounds.right <= r.snapshot.canvas.width);
      assert.ok(v.bounds.top > 0 && v.bounds.bottom <= r.snapshot.canvas.height);
      if (v.bank === "v033") assert.ok(Math.abs(v.scale * d.nativeStandingHeight - (v.actual ? 39 : 156)) < 1e-9);
    }
  }
}
const before = read(`${out}/before-pixels.json`), after = read(`${out}/after-pixels.json`);
assert.equal(after.frames.length, 24);
for (const f of after.frames) {
  assert.deepEqual(f.bounds, meta.frames[f.frame].bounds);
  assert.ok(f.edgeAlpha < 16 && f.muzzleAlpha >= 128 && f.solid > 6000);
  for (const region of ["headHelmet", "upperBody", "lowerBody"])
    assert.notEqual(f.regions[region], before.frames[f.frame].regions[region]);
}
const mobile = read(`${out}/v033-mobile-preview.json`), layout = read(`${out}/v033-layout-check.json`);
assert.deepEqual(mobile.errors, []); assert.deepEqual(mobile.failed, []);
for (const flag of ["orientation", "touchScroll", "frameStep", "pausedStateRestored", "stackedAtLargeZoom", "battleFrozenWhileOpen", "noHorizontalOverflow"])
  assert.equal(mobile[flag], true, flag);
assert.equal(layout.cases, 16); assert.equal(layout.clippedCases, 0);
const animation = read(`${out}/v033-animation.json`);
assert.deepEqual(animation.errors, []); assert.equal(animation.pauseFreeze, true);
assert.deepEqual(animation.runs.map(r => r.speed), [1, 2, 4]);
for (const r of animation.runs) {
  assert.deepEqual(r.stages, Array.from({ length: 9 }, (_, i) => i));
  assert.equal(Math.max(...r.samples.map(s => s.shotCues)), 2);
  assert.ok(r.visibleFlashFrames > 0);
  for (const s of r.samples) for (const v of s.views) {
    assert.equal(v.frame, s.pose.frame); assert.equal(v.scale, v.scaleY); assert.equal(v.rotation, 0);
  }
}
assert.deepEqual([...new Set(animation.runs[0].samples.map(s => s.pose.frame))].sort((a, b) => a - b),
  Array.from({ length: 24 }, (_, i) => i));
const parity = read(`${out}/v033-parity.json`);
assert.equal(parity.base, "384e6e9"); assert.equal(parity.completeExecutions, 80);
assert.equal(parity.runs.length, 40);
assert.deepEqual(parity.runs, read("reports/v032-parity.json").runs);
for (const name of ["all-24-frames.png", "key-poses.png", "v033-mobile-preview.png", "sequence.mp4"])
  assert.ok(statSync(`${out}/${name}`).size > 1000);
const video = read(`${out}/video-info.json`);
assert.ok(+video.format.duration > 11.44);
const summary = {
  baseline: "a920240", tests: count("pass"), failures: count("fail"),
  correctedCels: 24, equalNominalDisplayHeight: 39, magnification: 4,
  atlasSha256: atlasHash, metadataSha256: hash(readFileSync("public/assets/usmc-se-v033/metadata.json")),
  allCelsHaveChangedHeadHelmetTorsoAndLowerBodyRegions: true,
  alphaBoundsAndMuzzleTipsChecked: true, layoutCases: 16, clippedCases: 0,
  playbackSpeeds: [1, 2, 4], matchedBattleConfigurations: 40,
  completeExecutions: 80, replayDivergences: 0, unchangedRuntimeAndEarlierArt: unchanged,
  mobileChecks: mobile, physicalSafari: "unverified",
  anatomicalPercentages: "Art direction only; region changes do not certify exact anatomical ratios.",
};
writeFileSync(`${out}/validation.json`, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ tests: summary.tests, failures: summary.failures,
  correctedCels: 24, clippedCases: 0, completeExecutions: 80, replayDivergences: 0 }));
