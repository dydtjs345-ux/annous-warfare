const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const reportDir = process.env.AW_REPORT_DIR || "reports";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  failed = [];
try {
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("requestfailed", (r) => failed.push(r.url()));
  await p.goto("http://127.0.0.1:4233/annous-warfare/?seed=2049&debug=1");
  await p.waitForFunction(() => window.awSnapshot);
  async function open() {
    const frameReady = p.waitForEvent("framenavigated", {
      predicate: (frame) => /animation-preview\.html/.test(frame.url()),
    });
    await p.locator("#animation-preview").tap();
    await p.waitForSelector("#animation-dialog[open]");
    const f = await frameReady;
    assert.ok(f);
    await f.waitForFunction(() => window.sePreviewSnapshot);
    return f;
  }
  const f = await open();
  assert.equal(await p.evaluate(() => window.awSnapshot().paused), true);
  const time = await p.evaluate(() => window.awSnapshot().time);
  await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.awSnapshot().time), time);
  await f.locator('[data-clip="aim"]').tap();
  await f.locator("#preview-pause").tap();
  const initial = await f.evaluate(() => window.sePreviewSnapshot());
  assert.equal(initial.stacked, false);
  assert.deepEqual(
    [...new Set(initial.views.map((v) => v.bank))],
    ["v032", "v033"],
  );
  assert.ok(
    initial.views.every(
      (v) =>
        v.scale === v.scaleY &&
        v.bounds.left >= 0 &&
        v.bounds.right <= initial.canvas.width,
    ),
  );
  await p.screenshot({ path: `${reportDir}/v033-mobile-preview.png` });
  const before = await f.evaluate(() => scrollY),
    cdp = await p.context().newCDPSession(p),
    frameBox = await p.locator("#animation-dialog iframe").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: frameBox.x + 190, y: frameBox.y + 270, id: 1 }],
  });
  for (let i = 1; i <= 7; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: frameBox.x + 190, y: frameBox.y + 270 - i * 24, id: 1 },
      ],
    });
    await p.waitForTimeout(25);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await p.waitForTimeout(150);
  assert.ok(
    await f.evaluate((y) => scrollY > y, before),
    "preview can scroll by touch, including across its noninteractive canvas",
  );
  await f.locator("#preview-size").selectOption("1.5");
  await f.locator("#preview-zoom").selectOption("6");
  await p.waitForTimeout(150);
  assert.ok(
    await f.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  const large = await f.evaluate(() => window.sePreviewSnapshot());
  assert.equal(large.stacked, true);
  assert.ok(
    large.views.every(
      (v) =>
        v.bounds.left >= 0 &&
        v.bounds.right <= large.canvas.width &&
        v.bounds.bottom <= large.canvas.height,
    ),
  );
  await f.locator('[data-clip="fire"]').tap();
  await f.locator("#preview-pause").tap();
  await f.locator("#preview-time").evaluate((e) => {
    e.value = 0.01;
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.waitForTimeout(100);
  assert.equal(
    (await f.evaluate(() => window.sePreviewSnapshot())).pose.frame,
    17,
  );
  await f.locator("#preview-step").tap();
  await p.waitForTimeout(100);
  assert.equal(
    (await f.evaluate(() => window.sePreviewSnapshot())).pose.frame,
    18,
  );
  for (const size of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await p.setViewportSize(size);
    await p.waitForTimeout(150);
    assert.ok(
      await f.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok(await p.locator("[data-preview-close]").isVisible());
  }
  await f.locator("#preview-size").selectOption("1.3");
  await f.locator("#preview-zoom").selectOption("4");
  await f.locator('[data-clip="demo"]').tap();
  await f.locator("#preview-speed").selectOption("4");
  const previewFrameStats = await f.evaluate(
    () =>
      new Promise((resolve) => {
        const a = [];
        let last,
          start = performance.now();
        function tick(n) {
          if (last) a.push(n - last);
          last = n;
          if (n - start < 5000) requestAnimationFrame(tick);
          else {
            a.sort((a, b) => a - b);
            resolve({
              samples: a.length,
              p50: a[Math.floor(a.length * 0.5)],
              p95: a[Math.floor(a.length * 0.95)],
              max: a.at(-1),
              shotCues: window.sePreviewSnapshot().shotCues,
            });
          }
        }
        requestAnimationFrame(tick);
      }),
  );
  assert.ok(previewFrameStats.shotCues > 0);
  await p
    .getByRole("button", { name: "동작 미리보기 닫기", exact: true })
    .tap();
  await p.waitForTimeout(100);
  assert.equal(await p.locator("#animation-dialog iframe").count(), 0);
  assert.equal(await p.evaluate(() => window.awSnapshot().paused), false);
  await p.waitForTimeout(150);
  assert.ok(await p.evaluate((t) => window.awSnapshot().time > t, time));
  await p.locator("#pause").tap();
  const held = await p.evaluate(() => window.awSnapshot().time);
  for (let i = 0; i < 3; i++) {
    const frame = await open();
    await frame.waitForFunction(() => window.sePreviewSnapshot);
    await p
      .getByRole("button", { name: "동작 미리보기 닫기", exact: true })
      .tap();
    await p.waitForTimeout(70);
    assert.equal(await p.locator("#animation-dialog iframe").count(), 0);
    assert.equal(await p.evaluate(() => window.awSnapshot().time), held);
    assert.equal(await p.evaluate(() => window.awSnapshot().paused), true);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  await p.screenshot({ path: `${reportDir}/v033-game-after-preview.png` });
  writeFileSync(
    `${reportDir}/v033-mobile-preview.json`,
    JSON.stringify(
      {
        viewport: [390, 844],
        orientation: true,
        wholeBody39px: true,
        sideBySideVersions: ["v032", "v033"],
        stackedAtLargeZoom: true,
        maxScale1_5AndZoom6: true,
        frameStep: true,
        previewSpeeds: [1, 4],
        previewFrameStats,
        touchScroll: true,
        battleFrozenWhileOpen: true,
        pausedStateRestored: true,
        frameDestroyedAcrossRestarts: 3,
        noHorizontalOverflow: true,
        errors,
        failed,
        physicalSafari: "unverified",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await b.close();
}
