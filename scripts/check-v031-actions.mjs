const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import { writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
mkdirSync("/tmp/aw-v031-actions", { recursive: true });
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const runs = [];
try {
  for (const [mode, pose] of [
    ["reload", "reloading"],
    ["full", "fullCover"],
    ["peek", "aiming"],
  ]) {
    const p = await b.newPage({ viewport: { width: 700, height: 600 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(
      `http://127.0.0.1:4211/annous-warfare/test/fixtures/prototype-visual.html?mode=${mode}&animate=1`,
    );
    await p.waitForFunction(
      ([mode, pose]) => {
        const s = window.fixtureSnapshot?.();
        return (
          s &&
          s.poses[1]?.pose === pose &&
          (mode !== "peek" || s.poses[1].posture === "peek")
        );
      },
      [mode, pose],
      { timeout: 25000 },
    );
    const samples = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await p.evaluate(() => window.fixtureSnapshot()));
      await p.screenshot({ path: `/tmp/aw-v031-actions/${mode}-${i}.png` });
      await p.waitForTimeout(90);
    }
    assert.ok(samples.some((s) => s.prototype?.visible));
    assert.deepEqual(errors, []);
    runs.push({ mode, errors, samples });
    await p.close();
  }
  writeFileSync(
    "reports/v031-action-frames.json",
    JSON.stringify(
      {
        fixture:
          "real autonomous Battle and production sprite adapter; initial positions/ammo controlled; no fabricated actions",
        runs,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await b.close();
}
