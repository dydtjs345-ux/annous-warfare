import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (p) => JSON.parse(readFileSync(p)),
  sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const allowed = new Set([
  "main.js",
  "urban-detail.js",
  "urban-visuals.js",
  "cover-art.js",
  "street-art.js",
  "battle-wear.js",
  "environment-cache.js",
]);
const immutable = {};
for (const f of readdirSync("src").filter(
  (f) => f.endsWith(".js") && !allowed.has(f),
)) {
  assert.deepEqual(
    readFileSync("src/" + f),
    readFileSync(`${process.argv[2] || "/tmp/aw-v0291-base"}/src/${f}`),
    `nonenvironment source changed: ${f}`,
  );
  immutable[f] = sha("src/" + f);
}
const paired = read("reports/v0291-parity.json"),
  legacy = read("reports/v0291-legacy.json");
assert.equal(paired.runs.length, 40);
assert.equal(paired.base, "2b30b30");
assert.ok(paired.runs.every((r) => r.result && r.duration < 1800));
assert.equal(legacy.runs.length, 200);
assert.deepEqual(
  legacy.runs.map((r) => r.digest),
  read("reports/v025-after-A.json").runs.map((r) => r.digest),
);
const log = readFileSync("reports/v0291-tests.txt", "utf8"),
  pass = [...log.matchAll(/ℹ pass (\d+)/g)].reduce((s, m) => s + +m[1], 0);
assert.equal(pass, 237);
assert.equal(
  [...log.matchAll(/ℹ fail (\d+)/g)].reduce((s, m) => s + +m[1], 0),
  0,
);
assert.match(readFileSync("reports/v0291-build.txt", "utf8"), /✓ built in/);
const qa = read("reports/v0291-visual-qa.json");
assert.deepEqual(qa.errors, []);
const selected = qa.records.find((r) => r.name === "mobile-selected");
assert.ok(selected.snapshot.selected != null);
assert.equal(selected.snapshot.environmentCache.obscured, true);
for (const r of qa.records)
  assert.equal(
    r.snapshot.environmentCache.count,
    r.snapshot.environmentCache.textureCount,
  );
const mobile = read("reports/v0291-mobile.json");
assert.deepEqual(mobile.errors, []);
assert.equal(mobile.panPinch, true);
assert.equal(mobile.cacheCleanupAcrossExtraRestarts, 4);
const out = {
  base: "2b30b30",
  unchangedModules: immutable,
  tests: 237,
  failures: 0,
  completeExecutions: 280,
  pairedConfigurations: 40,
  pairedExecutions: 80,
  legacyHashes: 200,
  gameplayDivergence: 0,
  mobile,
  qaRecords: qa.records.map((r) => r.name),
  physicalSafari: "unverified",
  images: Object.fromEntries(
    readdirSync("reports")
      .filter((f) => /^v0291-.*\.png$/.test(f))
      .map((f) => [f, sha("reports/" + f)]),
  ),
};
writeFileSync(
  "reports/v0291-validation.json",
  JSON.stringify(out, null, 2) + "\n",
);
console.log({
  tests: 237,
  completeExecutions: 280,
  legacyHashes: 200,
  gameplayDivergence: 0,
  qaRecords: qa.records.length,
});
