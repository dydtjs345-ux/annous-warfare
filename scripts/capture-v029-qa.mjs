const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const rows = [];
try {
  for (const mode of ["full", "peek", "fire", "medic", "grenade"]) {
    const p = await b.newPage({ viewport: { width: 700, height: 600 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(
      `http://127.0.0.1:4210/annous-warfare/test/fixtures/hybrid-visual.html?mode=${mode}`,
    );
    await p.waitForFunction(
      () => window.fixtureSnapshot?.().captured,
      {},
      { timeout: 25000 },
    );
    await p.waitForTimeout(100);
    const s = await p.evaluate(() => window.fixtureSnapshot());
    assert.deepEqual(errors, []);
    await p.screenshot({ path: `reports/v029-${mode}.png` });
    rows.push({ mode, ...s, errors });
    await p.close();
  }
  for (const faction of ["usmc", "ru"]) {
    const p = await b.newPage({ viewport: { width: 960, height: 740 } });
    await p.goto("http://127.0.0.1:4209/annous-warfare/?seed=2049&debug=1");
    await p.waitForFunction(() => window.awSnapshot);
    if (faction === "ru") await p.locator("#focus").click();
    await p.waitForTimeout(1500);
    await p.getByRole("button", { name: "일시정지", exact: true }).click();
    await p.screenshot({ path: `reports/v029-moving-${faction}.png` });
    await p.close();
  }
  writeFileSync(
    "reports/v029-qa.json",
    JSON.stringify(
      {
        fixture:
          "real Battle; controlled spawns/injuries/nonfiring opponents; paused only at real authoritative states/events; not natural-match performance evidence",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await b.close();
}
