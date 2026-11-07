const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import { writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
mkdirSync("/tmp/aw-motion-actions", { recursive: true });
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const runs = [];
try {
  for (const [mode, id, pose] of [
    ["medic", 5, "treating"],
    ["reload", 0, "reloading"],
    ["mount", 4, "deploying"],
  ]) {
    const p = await b.newPage({ viewport: { width: 700, height: 600 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(
      `http://127.0.0.1:4210/annous-warfare/test/fixtures/hybrid-visual.html?mode=${mode}&animate=1`,
    );
    await p.waitForFunction(
      ([id, pose]) => window.fixtureSnapshot?.().poses[id].pose === pose,
      [id, pose],
      { timeout: 25000 },
    );
    const samples = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await p.evaluate(() => window.fixtureSnapshot()));
      await p.screenshot({ path: `/tmp/aw-motion-actions/${mode}-${i}.png` });
      await p.waitForTimeout(80);
    }
    assert.deepEqual(errors, []);
    runs.push({ mode, id, pose, samples, errors });
    await p.close();
  }
  writeFileSync(
    "reports/v029-motion-actions.json",
    JSON.stringify(
      {
        fixture:
          "controlled real Battle; no fabricated poses; production renderer/interpolator",
        runs,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await b.close();
}
