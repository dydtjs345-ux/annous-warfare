import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

import { createHash } from "node:crypto";
import { ko, NO_REASON } from "../src/korean-inspector.js";
const read = (p) => JSON.parse(readFileSync(p));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const hashes = {};
for (const f of readdirSync("src").filter(
  (f) =>
    f.endsWith(".js") &&
    !["main.js", "readability.js", "korean-inspector.js"].includes(f),
)) {
  const old = readFileSync(
    `${process.argv[2] || "/tmp/aw-v028-base"}/src/${f}`,
  );
  const current = readFileSync(`src/${f}`);
  assert.deepEqual(
    current,
    old,
    `${f} simulation or existing presentation changed`,
  );
  hashes[f] = sha(current);
}
const legacy = read("reports/v028-legacy.json");
assert.equal(legacy.runs.length, 200);
assert.deepEqual(
  legacy.runs.map((r) => r.digest),
  read("reports/v025-after-A.json").runs.map((r) => r.digest),
);
const parity = read("reports/v028-parity.json");
assert.equal(parity.matched, 40);
assert.ok(parity.runs.every((r) => r.result));
const mobile = read("reports/v028-mobile.json");
assert.deepEqual(mobile.errors, []);
assert.equal(mobile.panPinch, true);
const log = readFileSync("reports/v028-tests.txt", "utf8"),
  groups = [...log.matchAll(/ℹ pass (\d+)/g)].map((m) => +m[1]);
assert.equal(
  groups.reduce((a, b) => a + b, 0),
  220,
);
assert.equal(
  [...log.matchAll(/ℹ fail (\d+)/g)].reduce((a, m) => a + +m[1], 0),
  0,
);
assert.match(readFileSync("reports/v028-build.txt", "utf8"), /✓ built in/);
const literals = new Set();
for (const f of readdirSync("src").filter(
  (f) =>
    f.endsWith(".js") &&
    !["korean-inspector.js", "main.js", "inspection.js"].includes(f),
)) {
  for (const m of readFileSync("src/" + f, "utf8").matchAll(
    /(?:reason|state|order|navigation|decisionReason|holdReason|blockedBy)\s*(?:=|:)\s*"([^"\n]+)"/g,
  ))
    literals.add(m[1]);
}
const missing = [...literals].filter((v) => ko(v) === NO_REASON);
assert.deepEqual(missing, []);
const validation = {
  base: "f94d0ed",
  unchangedModuleHashes: hashes,
  legacyHashes: 200,
  pairedCases: 40,
  finalPairedExecutions: 80,
  initialPairedExecutions: 80,
  recordedCompleteExecutions: 360,
  fullTests: 220,
  failures: 0,
  staticLiteralTranslationCoverage: { total: literals.size, missing },
  physicalSafari: "unverified",
  history: {
    capacityPerSoldier: 18,
    samplingHz: 10,
    limitation: "intermediate transitions between samples may be missed",
  },
  mobile,
};
writeFileSync(
  "reports/v028-validation.json",
  JSON.stringify(validation, null, 2) + "\n",
);
console.log(validation);
