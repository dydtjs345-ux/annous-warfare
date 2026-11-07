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
try {
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:4233/annous-warfare/?seed=2049&debug=1");
  await p.waitForFunction(() => window.awSnapshot);
  const frameReady = p.waitForEvent("framenavigated", {
    predicate: (frame) => /animation-preview\.html/.test(frame.url()),
  });
  await p.locator("#animation-preview").tap();
  const f = await frameReady;
  await f.waitForFunction(() => window.sePreviewSnapshot);
  await f.locator('[data-clip="lower"]').tap();
  await f.locator("#preview-pause").tap();
  await f.locator("#preview-time").evaluate((e) => {
    e.value = 0.7;
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await f.waitForFunction(() => window.sePreviewSnapshot().pose.frame === 23);
  const s = await f.evaluate(() => window.sePreviewSnapshot());
  assert.equal(s.size, 1.3);
  assert.equal(s.zoom, 4);
  assert.equal(s.stacked, false);
  assert.ok(s.views.every((v) => v.frame === 23 && v.rotation === 0));
  assert.deepEqual(errors, []);
  await p.screenshot({ path: "reports/v033-mobile-reference.png" });
  writeFileSync(
    "reports/v033-reference-pose.json",
    JSON.stringify(
      {
        method:
          "same final low-ready/lowering cel 24/24 shown in user screenshot; 390x844, default39px and4x",
        snapshot: s,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await b.close();
}
