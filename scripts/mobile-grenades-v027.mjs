import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const results = [];
try {
  for (const speed of [1, 2, 4]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 740 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `http://127.0.0.1:4210/annous-warfare/test/fixtures/grenade-visual.html?speed=${speed}`,
    );
    await page.waitForFunction(
      () => {
        const s = window.fixtureSnapshot?.();
        if (s?.grenades.some((g) => g.flightAge >= 0.2)) {
          window.fixturePaused = true;
          return true;
        }
        return false;
      },
      {},
      { timeout: 20000 },
    );
    const flight = await page.evaluate(() => window.fixtureSnapshot());
    assert.ok(flight.grenades.length);
    await page.screenshot({ path: `/tmp/aw-v027-grenade-flight-${speed}.png` });
    await page.evaluate(() => (window.fixturePaused = false));
    await page.waitForFunction(
      () => {
        if (window.fixtureSnapshot?.().stats.detonated > 0) {
          window.fixturePaused = true;
          return true;
        }
        return false;
      },
      {},
      { timeout: 15000 },
    );
    const blast = await page.evaluate(() => window.fixtureSnapshot());
    assert.ok(blast.effects.some((e) => e.kind === "grenadeBlast"));
    await page.screenshot({ path: `/tmp/aw-v027-grenade-blast-${speed}.png` });
    assert.deepEqual(errors, []);
    results.push({ speed, flight, blast, errors });
    await page.close();
  }
  writeFileSync(
    process.argv[2] || "/tmp/v027-grenades-mobile.json",
    JSON.stringify(
      {
        fixture:
          "isolated real Battle/AI/grenade systems, protected target cluster and nonfiring opponents; not normal-match tactical measurement",
        runs: results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Grenade flight/blast browser fixtures passed at 1x, 2x, 4x");
} finally {
  await browser.close();
}
