import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const p = await b.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await p.goto("http://127.0.0.1:4233/annous-warfare/animation-preview.html");
await p.waitForFunction(() => window.sePreviewSnapshot);
await p.locator('[data-clip="aim"]').tap();
await p.locator("#preview-pause").tap();
const records = [];
for (let i = 0; i < 16; i++) {
  await p.locator("#preview-size").selectOption(i % 2 ? "1.3" : "1.5");
  await p.locator("#preview-zoom").selectOption(i % 2 ? "4" : "6");
  await p.waitForTimeout(150);
  const s = await p.evaluate(() => window.sePreviewSnapshot());
  records.push(s);
  const bad = s.views.filter(
    (v) =>
      v.bounds.left < 0 ||
      v.bounds.right > s.canvas.width ||
      v.bounds.bottom > s.canvas.height,
  );
  assert.equal(bad.length, 0, JSON.stringify({ i, snapshot: s, bad }));
}
writeFileSync(
  "reports/v033-layout-check.json",
  JSON.stringify(
    {
      cases: records.length,
      clippedCases: 0,
      method:
        "same paused offscreen canvas; alternate 45px/6x and 39px/4x every 150ms",
      records,
    },
    null,
    2,
  ) + "\n",
);
await b.close();
