const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const out = process.env.AW_REPORT_DIR || "reports/v034-live";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  failed = [],
  cases = [];
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => failed.push(r.url()));
  await page.goto(
    `${process.env.AW_GAME_URL || "http://127.0.0.1:4234"}/annous-warfare/?seed=7&debug=1`,
  );
  await page.waitForFunction(() => window.awSnapshot);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        function tick() {
          const s = awSnapshot();
          if (
            s.prototype.active?.renderer === "v033" &&
            s.prototype.live?.animation === "walking"
          ) {
            document.querySelector("#pause").click();
            resolve();
          } else requestAnimationFrame(tick);
        }
        tick();
      }),
  );
  await page.waitForTimeout(160);
  let s = await page.evaluate(() => awSnapshot());
  assert.equal(s.prototype.art, "v033");
  assert.equal(s.prototype.enabled, true);
  assert.equal(s.prototype.active.renderer, "v033");
  let box = await page.locator("canvas").boundingBox(),
    u = s.units[1];
  await page.touchscreen.tap(box.x + u.screenX, box.y + u.screenY);
  await page.waitForTimeout(180);
  assert.equal((await page.evaluate(() => awSnapshot())).selected, 1);
  assert.match(
    await page.locator("#inspect-text").textContent(),
    /v0.3.3 Animated/,
  );
  cases.push("touch selection of actual SE full-body soldier");
  for (const size of [1, 1.3, 1.5]) {
    await page.locator("#prototype-scale").selectOption(String(size));
    await page.waitForTimeout(100);
    s = await page.evaluate(() => awSnapshot());
    assert.equal(s.prototype.scale, size);
    assert.equal(s.prototype.live.scale, (30 * size) / 201);
  }
  s = await page.evaluate(() => awSnapshot());
  box = await page.locator("canvas").boundingBox();
  u = s.units[1];
  await page.touchscreen.tap(
    box.x + u.screenX,
    box.y + u.screenY - (45 - 12) * s.view.zoom,
  );
  await page.waitForTimeout(120);
  assert.equal(
    (await page.evaluate(() => awSnapshot())).selected,
    1,
    "enlarged SE helmet can be tapped",
  );
  await page.locator("#prototype-scale").selectOption("1.3");
  for (const art of ["v031", "v030", "v033"]) {
    await page.locator("#prototype-art").selectOption(art);
    await page.waitForTimeout(100);
    assert.equal(
      (await page.evaluate(() => awSnapshot())).prototype.active.renderer,
      art,
    );
  }
  cases.push(
    "30/39/45px scale, enlarged head selection, legacy/new comparison",
  );
  await page.locator("#detail").tap();
  await page.waitForTimeout(150);
  assert.match(
    await page.locator("#inspect-text").textContent(),
    /시각 전환:|최근 판단 기록/,
  );
  await page.screenshot({ path: `${out}/mobile-inspector.png` });
  const panel = page.locator("#inspect"),
    cdp = await page.context().newCDPSession(page),
    pb = await panel.boundingBox();
  assert.ok(await panel.evaluate((e) => e.scrollHeight > e.clientHeight));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: pb.x + 140, y: pb.y + pb.height - 20, id: 1 }],
  });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: pb.x + 140, y: pb.y + pb.height - 20 - i * 25, id: 1 },
      ],
    });
    await page.waitForTimeout(30);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok(await panel.evaluate((e) => e.scrollTop > 0));
  await page.locator("#close-inspect").tap();
  await page.waitForTimeout(150);
  assert.ok(await panel.isHidden());
  cases.push(
    "Korean rendering diagnostics, expanded inspector native scroll and close",
  );
  box = await page.locator("canvas").boundingBox();
  const cy = box.y + box.height / 2;
  const zoom = (await page.evaluate(() => awSnapshot())).view.zoom;
  for (const [type, a, b] of [
    ["touchStart", 160, 220],
    ["touchMove", 110, 270],
    ["touchMove", 80, 300],
  ])
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: [
        { x: box.x + a, y: cy, id: 1 },
        { x: box.x + b, y: cy, id: 2 },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(150);
  assert.ok((await page.evaluate(() => awSnapshot())).view.zoom > zoom);
  const pan = (await page.evaluate(() => awSnapshot())).view.x;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + 210, y: cy, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: box.x + 145, y: cy + 20, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(150);
  assert.notEqual((await page.evaluate(() => awSnapshot())).view.x, pan);
  cases.push("touch pinch and camera pan");
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok((await page.locator("canvas").boundingBox()).height > 0);
  }
  cases.push("portrait/landscape without horizontal overflow");
  const frozen = await page.evaluate(() => awSnapshot());
  await page.waitForTimeout(200);
  assert.equal((await page.evaluate(() => awSnapshot())).time, frozen.time);
  assert.deepEqual(
    (await page.evaluate(() => awSnapshot())).prototype.live,
    frozen.prototype.live,
  );
  await page.locator("#animation-preview").tap();
  await page.waitForTimeout(500);
  assert.ok(await page.locator("#animation-dialog").isVisible());
  await page.locator("#animation-dialog [data-preview-close]").tap();
  await page.waitForTimeout(100);
  assert.equal((await page.evaluate(() => awSnapshot())).paused, true);
  await page.locator("#pause").tap();
  for (const speed of [1, 2, 4]) {
    await page.locator(`[data-speed="${speed}"]`).tap();
    const t = (await page.evaluate(() => awSnapshot())).time;
    await page.waitForTimeout(500);
    assert.ok((await page.evaluate(() => awSnapshot())).time > t);
  }
  cases.push("pause stable, preview returns pause state, 1x/2x/4x progress");
  const frameStats = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = [];
        let last,
          start = performance.now();
        function tick(t) {
          if (last) deltas.push(t - last);
          last = t;
          if (t - start < 5000) requestAnimationFrame(tick);
          else {
            deltas.sort((a, b) => a - b);
            resolve({
              samples: deltas.length,
              p50: deltas[Math.floor(deltas.length * 0.5)],
              p95: deltas[Math.floor(deltas.length * 0.95)],
              max: deltas.at(-1),
            });
          }
        }
        requestAnimationFrame(tick);
      }),
  );
  for (let i = 0; i < 5; i++) {
    await page.locator("#restart").tap();
    await page.waitForTimeout(150);
    s = await page.evaluate(() => awSnapshot());
    assert.equal(s.selected, null);
    assert.equal(s.environmentCache.count, s.environmentCache.textureCount);
    assert.ok(!s.prototype.live.shotId, "restart clears old shot recoil");
  }
  cases.push(
    "five restarts clear selection, shot anchors and static cache keys",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  await page.screenshot({ path: `${out}/mobile-game.png` });
  writeFileSync(
    `${out}/mobile.json`,
    JSON.stringify(
      {
        cases,
        frameStats,
        errors,
        failed,
        physicalSafari: "unverified",
        artBanks: ["v033", "v031", "v030"],
        scales: [1, 1.3, 1.5],
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Mobile Chromium checks passed", JSON.stringify(frameStats));
} finally {
  await browser.close();
}
