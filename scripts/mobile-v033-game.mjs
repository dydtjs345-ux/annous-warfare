const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4233/annous-warfare/?seed=2049&debug=1");
  await page.waitForFunction(() => window.awSnapshot);
  await page.getByRole("button", { name: "일시정지", exact: true }).tap();
  async function select() {
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => window.awSnapshot());
    const u = s.units.find((u) => u.id === 4);
    const box = await page.locator("canvas").boundingBox();
    await page.touchscreen.tap(box.x + u.screenX, box.y + u.screenY);
    await page.waitForTimeout(250);
    assert.equal((await page.evaluate(() => window.awSnapshot())).selected, 4);
  }
  await select();
  assert.match(await page.locator("#inspect-text").textContent(), /경기관총수/);
  await page.getByRole("button", { name: "자세히", exact: true }).tap();
  await page.waitForTimeout(200);
  assert.match(
    await page.locator("#inspect-text").textContent(),
    /최근 판단 기록/,
  );
  const panel = page.locator("#inspect");
  assert.ok(await panel.evaluate((e) => e.scrollHeight > e.clientHeight));
  const cdp = await page.context().newCDPSession(page),
    box = await panel.boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + 150, y: box.y + box.height - 20, id: 1 }],
  });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: box.x + 150, y: box.y + box.height - 20 - i * 25, id: 1 },
      ],
    });
    await page.waitForTimeout(30);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok(await panel.evaluate((e) => e.scrollTop > 0));
  await page.screenshot({ path: "reports/v033-game-inspector.png" });
  await page.getByRole("button", { name: "병사 정보 닫기" }).tap();
  await page.waitForTimeout(200);
  assert.ok(await panel.isHidden());
  await select();
  await page.locator("#prototype-toggle").tap();
  await page.locator("#prototype-scale").selectOption("1.5");
  for (const art of ["v030", "v031"]) {
    await page.locator("#prototype-art").selectOption(art);
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(() => window.awSnapshot().prototype.art),
      art,
    );
  }
  assert.equal(await page.locator("#prototype-scale").inputValue(), "1.5");
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.awSnapshot().selected), 1);
  let prototypeSnapshot = await page.evaluate(() => window.awSnapshot());
  const target = prototypeSnapshot.units.find((u) => u.id === 1),
    prototypeCanvas = await page.locator("canvas").boundingBox();
  await page.touchscreen.tap(
    prototypeCanvas.x + target.screenX,
    prototypeCanvas.y +
      target.screenY -
      (42 - 12) * prototypeSnapshot.view.zoom,
  );
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(() => window.awSnapshot().selected),
    1,
    "enlarged prototype head remains selectable",
  );
  assert.match(await page.locator("#inspect-text").textContent(), /병사 #1/);
  await page.screenshot({ path: "reports/v033-game-mobile-prototype.png" });
  await page.locator("#prototype-scale").selectOption("1.3");
  await select();
  assert.equal(
    await page.evaluate(() => window.awSnapshot().prototype.enabled),
    true,
  );
  const canvas = await page.locator("canvas").boundingBox(),
    cy = canvas.y + canvas.height / 2;
  const beforeZoom = await page.evaluate(() => window.awSnapshot().view.zoom);
  for (const [type, a, b] of [
    ["touchStart", 160, 220],
    ["touchMove", 110, 270],
    ["touchMove", 80, 300],
  ])
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: [
        { x: canvas.x + a, y: cy, id: 1 },
        { x: canvas.x + b, y: cy, id: 2 },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(200);
  assert.ok(
    await page.evaluate((z) => window.awSnapshot().view.zoom > z, beforeZoom),
  );
  const beforePan = await page.evaluate(() => window.awSnapshot().view.x);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: canvas.x + 200, y: cy, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: canvas.x + 240, y: cy + 20, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(200);
  assert.notEqual(
    await page.evaluate(() => window.awSnapshot().view.x),
    beforePan,
  );
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(200);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.getByRole("button", { name: "계속", exact: true }).tap();
  for (const speed of [1, 2, 4]) {
    await page.locator(`[data-speed="${speed}"]`).tap();
    const t = await page.evaluate(() => window.awSnapshot().time);
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate((t) => window.awSnapshot().time > t, t));
  }
  const frameStats = await page.evaluate(
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
            });
          }
        }
        requestAnimationFrame(tick);
      }),
  );
  for (let i = 0; i < 4; i++) {
    const cache = await page.evaluate(
      () => window.awSnapshot().environmentCache,
    );
    assert.equal(cache.count, cache.textureCount, "no leaked cache keys");
    await page.getByRole("button", { name: "재시작", exact: true }).tap();
    await page.waitForTimeout(120);
  }
  await page.getByRole("button", { name: "재시작", exact: true }).tap();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.awSnapshot().selected), null);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "reports/v033-game-mobile.png" });
  writeFileSync(
    "reports/v033-game-mobile.json",
    JSON.stringify(
      {
        frameStats,
        selection: true,
        prototypeHeadSelection: true,
        isolatedUnitId: 1,
        artBanks: ["v030", "v031"],
        prototypeScales: [1, 1.3, 1.5],
        expandCollapse: true,
        nativeScroll: true,
        closeAndReselect: true,
        orientations: 2,
        speeds: [1, 2, 4],
        restart: true,
        cacheCleanupAcrossExtraRestarts: 4,
        errors,
        physicalSafari: "unverified",
        panPinch: true,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
