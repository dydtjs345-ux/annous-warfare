import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const base = process.argv[2] || "/tmp/aw-v034-base";
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const paths = readdirSync(`${base}/src`, { recursive: true })
  .filter((p) => p.endsWith(".js"))
  .map((p) => `src/${p}`)
  .sort();
const protectedModules = paths.filter(
  (p) => !["src/main.js", "src/combat-visuals.js"].includes(p),
);
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
const read = (p) => JSON.parse(readFileSync(p));
const evidence = read("reports/v034-live/live-evidence.json"),
  lower = read("reports/v034-live/lower-evidence.json");
const animations = new Set(),
  walkingFrames = new Set(),
  lowerFrames = new Set();
let shots = 0,
  walkingAfterFire = false;
for (const r of [...evidence.records, ...lower.records]) {
  let fired = false;
  for (const s of r.samples) {
    if (s.active.renderer !== "v033") continue;
    const l = s.live;
    assert.ok(l.visible && l.supported && !l.fallback);
    animations.add(l.animation);
    if (l.animation === "firing") {
      assert.equal(l.shotAt, s.unit.lastShotAt);
      assert.ok(l.shotId > 0);
      if (l.flash) shots++;
      fired = true;
    }
    if (l.animation === "walking") {
      walkingFrames.add(l.frame);
      if (fired) walkingAfterFire = true;
    }
    if (l.animation === "lowering") lowerFrames.add(l.frame);
  }
}
assert.deepEqual([...animations].sort(), [
  "aiming",
  "firing",
  "idle",
  "lowering",
  "raising",
  "walking",
]);
assert.equal(walkingFrames.size, 8);
assert.equal(lowerFrames.size, 4);
assert.ok(shots > 0 && walkingAfterFire);
for (const s of evidence.heldPhases) {
  assert.equal(s.live.animation, s.animation);
  assert.equal(s.active.renderer, "v033");
}
assert.deepEqual(evidence.errors, []);
assert.deepEqual(evidence.failed, []);
const parity = read("reports/v034-parity.json");
assert.equal(parity.base, "e68ba18");
assert.equal(parity.matched, 40);
const mobile = read("reports/v034-live/mobile.json");
assert.deepEqual(mobile.errors, []);
assert.deepEqual(mobile.failed, []);
const tests = readFileSync("/tmp/aw-v034-tests-final.log", "utf8");
const count = (label) =>
  [...tests.matchAll(new RegExp(`ℹ ${label} (\\d+)`, "g"))].reduce(
    (n, m) => n + +m[1],
    0,
  );
assert.equal(count("tests"), 274);
assert.equal(count("pass"), 274);
assert.equal(count("fail"), 0);
const summary = {
  base: "e68ba18",
  tests: 274,
  failures: 0,
  focusedTests: 16,
  matchedPairs: 40,
  completePairedExecutions: 80,
  protectedModules,
  assetHashes,
  realBattleAnimationStates: [...animations].sort(),
  walkingFrames: [...walkingFrames].sort((a, b) => a - b),
  loweringFrames: [...lowerFrames].sort((a, b) => a - b),
  realShotFlashSamples: shots,
  walkingAfterCombat: walkingAfterFire,
  mobile,
  build: "npm run build exited 0; pre-existing large vendor chunk warning",
  physicalSafari: "unverified",
};
writeFileSync(
  "reports/v034-live/validation.json",
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  `Validated live footage, all six states, 8 gait/4 lower cels, real shot times, ${protectedModules.length} unchanged modules, 274 tests, 40 paired replays and mobile results.`,
);
