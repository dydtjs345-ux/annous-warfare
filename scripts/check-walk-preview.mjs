const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import { writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const out = process.env.AW_REPORT_DIR || "reports/v035-walk-preview";
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const records = [],
  errors = [];
try {
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(
    `${process.env.AW_GAME_URL || "http://127.0.0.1:4236"}/annous-warfare/rifleman-lab.html?compare=e-walk`,
  );
  await p.waitForFunction(() => window.riflemanLabSnapshot);
  await p.locator("#lab-pause").tap();
  let s = await p.evaluate(() => riflemanLabSnapshot());
  assert.equal(s.comparing, true);
  assert.equal(s.stacked, false);
  assert.equal(s.views.filter((v) => v.visible).length, 4);
  assert.equal(s.reference.status, "rejected");
  assert.equal(s.pose.status, "prototype");
  assert.equal(s.displayHeight, 39);
  for (const v of s.views) {
    assert.ok(v.bounds.left >= 0 && v.bounds.right <= s.canvas.width);
    assert.ok(v.bounds.top >= 0 && v.bounds.bottom <= s.canvas.height);
  }
  await p.locator("#lab-restart").tap();
  const frames = [];
  for (let i = 0; i < 8; i++) {
    s = await p.evaluate(() => riflemanLabSnapshot());
    frames.push([s.pose.frame, s.reference.frame]);
    await p.locator("#lab-step").tap();
    await p.waitForTimeout(50);
  }
  assert.deepEqual(frames, [
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
    [6, 3],
    [7, 3],
  ]);
  await p.locator("#lab-slow").tap();
  await p.waitForTimeout(300);
  s = await p.evaluate(() => riflemanLabSnapshot());
  assert.equal(s.speed, 0.25);
  assert.equal(s.playing, true);
  await p.locator("#lab-pause").tap();
  const frozen = s.time;
  await p.waitForTimeout(150);
  s = await p.evaluate(() => riflemanLabSnapshot());
  assert.equal(s.playing, false);
  await p.screenshot({
    path: out + "/mobile-phaser-comparison.png",
    fullPage: true,
  });
  records.push({ type: "phaser", snapshot: s, frames });
  for (const size of [
    { width: 320, height: 740 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await p.setViewportSize(size);
    await p.waitForTimeout(200);
    s = await p.evaluate(() => riflemanLabSnapshot());
    assert.equal(
      s.canvas.width,
      await p.locator("#lab-stage").evaluate((e) => e.clientWidth),
    );
    for (const v of s.views) {
      assert.ok(v.bounds.left >= 0 && v.bounds.right <= s.canvas.width);
      assert.ok(v.bounds.top >= 0 && v.bounds.bottom <= s.canvas.height);
    }
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await p.locator("#lab-compare").tap();
  s = await p.evaluate(() => riflemanLabSnapshot());
  assert.equal(s.comparing, false);
  assert.equal(s.direction, "SE");
  assert.equal(await p.locator("#lab-direction").inputValue(), "SE");
  await p.locator("#lab-compare").tap();
  const response = await p.goto(
    process.env.AW_SVG_URL || "http://127.0.0.1:4237/previews/v035-e-walk.svg",
  );
  assert.equal(response.status(), 200);
  assert.ok(response.headers()["content-type"].includes("image/svg+xml"));
  await p.waitForFunction(() => window.walkPreviewSnapshot);
  await p.locator("#pause").tap();
  await p.locator("#restart").tap();
  const sf = [];
  for (let i = 0; i < 8; i++) {
    s = await p.evaluate(() => walkPreviewSnapshot());
    sf.push([s.pose.frame, s.reference.frame]);
    await p.locator("#step").tap();
  }
  assert.deepEqual(sf, frames);
  await p.locator("#slow").tap();
  await p.waitForTimeout(250);
  s = await p.evaluate(() => walkPreviewSnapshot());
  assert.equal(s.speed, 0.25);
  assert.equal(s.playing, true);
  await p.locator("#pause").tap();
  s = await p.evaluate(() => walkPreviewSnapshot());
  const st = s.time;
  await p.waitForTimeout(150);
  assert.equal((await p.evaluate(() => walkPreviewSnapshot())).time, st);
  records.push({
    type: "svg",
    url: p.url(),
    httpStatus: response.status(),
    contentType: response.headers()["content-type"],
    snapshot: s,
    browser: await p.evaluate(() => ({
      innerWidth,
      screenWidth: screen.width,
      scale: visualViewport.scale,
      rootWidth: document.documentElement.getBoundingClientRect().width,
      rootHeight: document.documentElement.getBoundingClientRect().height,
      scrollWidth: document.documentElement.scrollWidth,
    })),
  });
  await p.screenshot({ path: out + "/mobile-public-svg.png" });
  assert.deepEqual(errors, []);
  writeFileSync(
    out + "/browser-check.json",
    JSON.stringify({ records, errors, physicalSafari: "unverified" }, null, 2),
  );
  console.log(
    "Phaser and SVG controls, exact frames and mobile layout passed",
    records[1].browser,
  );
} finally {
  await b.close();
}
