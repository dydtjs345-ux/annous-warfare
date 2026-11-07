import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { completionMatrix } from "../src/rifleman/catalog.js";
const base = process.argv[2] || "/tmp/aw-v035-base",
  hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex"),
  read = (p) => JSON.parse(readFileSync(p));
const protectedModules = readdirSync(`${base}/src`, { recursive: true })
  .filter((p) => p.endsWith(".js"))
  .map((p) => `src/${p}`)
  .filter(
    (p) => !["src/main.js", "src/animation-preview-dialog.js"].includes(p),
  )
  .sort();
for (const p of protectedModules)
  assert.equal(hash(p), hash(`${base}/${p}`), `${p} changed`);
const assetHashes = {};
for (const p of [
  "public/assets/usmc-se-v033/source-atlas.png",
  "public/assets/usmc-se-v033/metadata.json",
]) {
  assert.equal(hash(p), hash(`${base}/${p}`));
  assetHashes[p] = hash(p);
}
const t = readFileSync("/tmp/aw-v035-tests-final.log", "utf8"),
  sum = (k) =>
    [...t.matchAll(new RegExp(`ℹ ${k} (\\d+)`, "g"))].reduce(
      (n, m) => n + +m[1],
      0,
    );
assert.equal(sum("tests"), 290);
assert.equal(sum("pass"), 290);
assert.equal(sum("fail"), 0);
const matrix = completionMatrix(),
  counts = { verified: 0, prototype: 0, missing: 0, rejected: 0 };
for (const r of matrix)
  for (const s of Object.values(r.directions)) counts[s]++;
assert.deepEqual(counts, {
  verified: 0,
  prototype: 10,
  missing: 45,
  rejected: 1,
});
const parity = read("reports/v035-parity.json");
assert.equal(parity.base, "b381e60");
assert.equal(parity.matched, 40);
assert.equal(parity.completeExecutions, 80);
assert.equal(parity.runs.length, 40);
const evidence = read("reports/v035-lab/visual-evidence.json"),
  samples = readFileSync("reports/v035-lab/playback-samples.jsonl", "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
assert.deepEqual(evidence.errors, []);
assert.deepEqual(evidence.failed, []);
for (const s of samples) {
  assert.equal(s.liveCombatAdmission, false);
  assert.equal(s.independentWeaponObjects, 0);
  for (const v of s.views.filter((v) => v.visible)) {
    assert.equal(v.rotation, 0);
    assert.equal(v.flipX, false);
    assert.equal(v.scale, v.scaleY);
    assert.ok(
      v.bounds.left >= 0 &&
        v.bounds.right <= s.canvas.width &&
        v.bounds.top >= 0 &&
        v.bounds.bottom <= s.canvas.height,
    );
  }
  if (s.reviewOnly) {
    assert.equal(s.pose.status, "rejected");
    assert.equal(s.pose.supported, false);
    assert.equal(s.pose.admitted, false);
  }
}
for (const [name, count] of [
  ["se-walk-slow", 8],
  ["e-keys-rejected-review", 4],
])
  assert.equal(
    new Set(samples.filter((s) => s.name === name).map((s) => s.pose.frame))
      .size,
    count,
  );
for (const c of evidence.captures)
  if (c.direction === "N" || (c.direction === "E" && c.action === "walk"))
    assert.ok(
      c.snapshot.views.filter((v) => v.selected).every((v) => !v.visible),
    );
const mobile = read("reports/v035-lab/mobile.json"),
  liveMobile = read("reports/v035-live-regression/mobile.json");
for (const x of [mobile, liveMobile]) {
  assert.deepEqual(x.errors, []);
  assert.deepEqual(x.failed, []);
}
const summary = {
  baseline: "b381e60",
  tests: 290,
  newTests: 16,
  failures: 0,
  matchedPairs: 40,
  completePairedExecutions: 80,
  artworkComplete: false,
  qualityCounts: counts,
  completion: matrix,
  protectedModules,
  assetHashes,
  capturedPlaybackFrames: evidence.playbacks.map((r) => ({
    name: r.name,
    frames: r.frames,
    states: r.states,
    framesSeen: r.framesSeen,
  })),
  mobile,
  liveMobile,
  build: "npm run build passed; existing vendor-size warning remains",
  physicalSafari: "unverified",
};
writeFileSync(
  "reports/v035-lab/validation.json",
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  `Verified ${protectedModules.length} unchanged modules, unchanged SE artwork, 290 tests, 40 paired matches, mobile checks and explicit incomplete/rejected artwork gates.`,
);
