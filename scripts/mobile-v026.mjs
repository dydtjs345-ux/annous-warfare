const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base =
  process.env.AW_BROWSER_URL || "http://localhost:4209/annous-warfare/";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const errors = [],
    failedRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => failedRequests.push(r.url()));
  await page.goto(base + "?seed=2049&layout=0&spawn=0&debug=1");
  await page.waitForFunction(() => typeof window.awSnapshot === "function");
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "Pause", exact: true }).tap();
  const snap = () => page.evaluate(() => window.awSnapshot());
  let s = await snap();
  const initialZoom = s.view.zoom;
  assert.equal(s.width, 54);
  assert.equal(s.height, 44);
  assert.equal(s.viewMode, "USMC");
  assert.ok(s.view.zoom > 0.6);
  assert.ok(s.time < 10);
  assert.equal(s.units.filter((u) => u.active).length, 12);
  const tapUnit = async (id) => {
    const s = await snap(),
      u = s.units.find((u) => u.id === id),
      box = await page.locator("canvas").boundingBox();
    assert.ok(
      u.screenX >= 0 &&
        u.screenX <= box.width &&
        u.screenY >= 0 &&
        u.screenY <= box.height,
      `unit ${id} visible`,
    );
    await page.touchscreen.tap(box.x + u.screenX, box.y + u.screenY);
    await page.waitForTimeout(140);
    assert.equal((await snap()).selected, id);
  };
  await tapUnit(4);
  const inspect = await page.locator("#inspect").textContent();
  for (const word of [
    "LMG",
    "Suppression",
    "Ammo",
    "Action:",
    "Objective:",
    "Search:",
    "Observed landmarks:",
    "Activity (exclusive",
  ])
    assert.ok(inspect.includes(word), word);
  assert.ok(!/undefined|NaN/.test(inspect));
  await page
    .locator("#inspect")
    .evaluate((e) => (e.scrollTop = e.scrollHeight));
  assert.ok(await page.locator("#inspect").evaluate((e) => e.scrollTop > 0));
  await page.locator("#focus").tap();
  await page.waitForTimeout(180);
  assert.equal((await snap()).viewMode, "RU");
  await tapUnit(6);
  await page.locator("#focus").tap();
  await page.waitForTimeout(180);
  s = await snap();
  assert.equal(s.viewMode, "Map");
  for (const u of s.units) await tapUnit(u.id);
  const selected = (await snap()).selected,
    pausedTime = (await snap()).time;
  const cdp = await page.context().newCDPSession(page),
    box = await page.locator("canvas").boundingBox(),
    cy = box.y + box.height / 2;
  const points = (a, b) => [
    { x: box.x + a, y: cy, id: 1 },
    { x: box.x + b, y: cy, id: 2 },
  ];
  const beforeZoom = await snap();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points(170, 220),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points(150, 240),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points(90, 300),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(140);
  s = await snap();
  assert.equal(s.viewMode, "Free");
  assert.ok(s.view.zoom > beforeZoom.view.zoom * 1.4);
  assert.equal(s.selected, selected);
  const beforePan = await page.locator("canvas").screenshot();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + 150, y: cy, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: box.x + 230, y: cy + 25, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(140);
  assert.notDeepEqual(await page.locator("canvas").screenshot(), beforePan);
  assert.equal((await snap()).time, pausedTime);
  assert.equal((await snap()).selected, selected);
  // Move to a high zoom then repeatedly pan to a map boundary.
  await page.mouse.move(box.x + 200, cy);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -100);
  for (let i = 0; i < 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + 280, y: cy, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + 50, y: cy, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  await page.waitForTimeout(140);
  s = await snap();
  assert.ok(s.view.x >= s.bounds.x - 2);
  assert.ok(s.view.x + s.view.width <= s.bounds.x + s.bounds.width + 2);
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
    const restart = await page
      .getByRole("button", { name: "Restart", exact: true })
      .boundingBox();
    assert.ok(restart.y + restart.height <= viewport.height);
    const panel = await page.locator("#inspect").boundingBox();
    assert.ok(panel.height <= 144);
  }
  await page.getByRole("button", { name: "Resume", exact: true }).tap();
  for (const speed of [1, 2, 4]) {
    await page.locator(`[data-speed="${speed}"]`).tap();
    const t = (await snap()).time;
    await page.waitForTimeout(450);
    const n = await snap();
    assert.equal(n.speed, speed);
    assert.ok(n.time > t + 0.2 * speed);
  }
  await page.getByRole("button", { name: "Restart", exact: true }).tap();
  await page.waitForTimeout(120);
  s = await snap();
  assert.equal(s.seed, 2050);
  assert.equal(s.selected, null);
  assert.equal(s.viewMode, "USMC");
  assert.equal(s.units.filter((u) => u.active).length, 12);
  const t = s.time;
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const list = [];
        const start = performance.now();
        let last;
        function tick(now) {
          if (last != null) list.push(now - last);
          last = now;
          if (now - start < 10000) requestAnimationFrame(tick);
          else {
            list.sort((a, b) => a - b);
            resolve({
              samples: list.length,
              medianMs: list[Math.floor(list.length * 0.5)],
              p95Ms: list[Math.floor(list.length * 0.95)],
              maxMs: list.at(-1),
            });
          }
        }
        requestAnimationFrame(tick);
      }),
  );
  s = await snap();
  assert.ok(s.time - t > 25, "4× simulation makes progress");
  await page.screenshot({ path: "/tmp/aw-v026-mobile.png" });
  await page.getByRole("button", { name: "Pause", exact: true }).tap();
  await page.locator("#focus").tap();
  await page.waitForTimeout(150);
  await page.locator("#focus").tap();
  await page.waitForTimeout(150);
  await page.screenshot({ path: "/tmp/aw-v026-overview.png" });
  // The previous battlefield is still playable through an explicit mode URL.
  await page.goto(base + "?map=legacy&seed=22&debug=1");
  await page.waitForFunction(() => typeof window.awSnapshot === "function");
  await page.waitForTimeout(150);
  const legacy = await snap();
  assert.equal(legacy.width, 30);
  assert.equal(legacy.height, 26);
  assert.equal(legacy.map.kind, "legacy");
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  const report = {
    expandedDimensions: [54, 44],
    legacyDimensions: [30, 26],
    initialReadableZoom: initialZoom,
    overviewZoom: beforeZoom.view.zoom,
    selectedAll12OnOverview: true,
    selectedRemoteSquad: true,
    touchPan: true,
    pinchZoom: true,
    cameraBounds: true,
    inspectorScroll: true,
    orientations: 2,
    pauseResume: true,
    restart: true,
    speeds: [1, 2, 4],
    frameStats: frames,
    simulationAdvancedAt4x: s.time - t,
    errors,
    failedRequests,
    physicalSafari: "Not tested; desktop Chromium touch emulation",
  };
  if (process.argv[2])
    writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
