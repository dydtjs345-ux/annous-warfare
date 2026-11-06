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
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    process.env.AW_BROWSER_URL || "http://localhost:4205/annous-warfare/",
  );
  await page.waitForSelector("canvas");
  await page.getByRole("button", { name: "Pause", exact: true }).tap();
  const box = await page.locator("canvas").boundingBox();
  const zoom = Math.min(box.width / 1050, box.height / 680);
  await page.touchscreen.tap(
    box.x + box.width / 2 + (460 - 760) * zoom,
    box.y + box.height / 2 + (203 - 325) * zoom,
  );
  await page.waitForTimeout(150);
  const text = await page.locator("#inspect").textContent();
  assert.match(text, /Suppression \d+%/);
  assert.match(text, /Action:/);
  assert.match(text, /Objective:/);
  assert.match(text, /Head \d+/);
  assert.match(text, /Contact:/);
  assert.match(text, /Last confirmed:/);
  assert.match(text, /Direct LOS:/);
  assert.match(text, /Fire:/);
  assert.match(text, /Decision:/);
  assert.match(text, /Assignment:/);
  assert.match(text, /Progress:/);
  assert.match(text, /Alternatives:/);
  assert.match(text, /Activity \(exclusive active time/);
  assert.match(text, /Contribution .*preparation .*passive waiting/);
  assert.match(text, /Blocker:/);
  assert.match(text, /No injuries/);
  assert.ok(!text.includes("undefined"));
  await page
    .locator("#inspect")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  const panel = await page.locator("#inspect").boundingBox();
  assert.ok(panel.height <= 144);
  const lmg = text;
  assert.match(lmg, /LMG: unsupported/);
  assert.match(lmg, /Support bonuses:/);
  assert.match(lmg, /Frag: 0/);
  assert.ok(!lmg.includes("NaN"));
  assert.ok(!lmg.includes("undefined"));
  await page
    .locator("#inspect")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.screenshot({ path: "/tmp/aw-v025-inspector.png" });
  const session = await page.context().newCDPSession(page);
  const beforeZoom = await page.locator("canvas").screenshot();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 130, y: 220, id: 1 },
      { x: 230, y: 220, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 100, y: 220, id: 1 },
      { x: 260, y: 220, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 90, y: 220, id: 1 },
      { x: 270, y: 220, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#inspect").textContent(), lmg);
  assert.notDeepEqual(await page.locator("canvas").screenshot(), beforeZoom);
  const beforePan = await page.locator("canvas").screenshot();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 160, y: 250, id: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 210, y: 280, id: 1 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.equal(await page.locator("#inspect").textContent(), lmg);
  await page.waitForTimeout(100);
  assert.notDeepEqual(await page.locator("canvas").screenshot(), beforePan);
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    const button = await page
      .getByRole("button", { name: "Restart", exact: true })
      .boundingBox();
    assert.ok(button.y + button.height <= size.height);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.getByRole("button", { name: "Resume", exact: true }).tap();
  for (const speed of ["1×", "2×", "4×"]) {
    await page.getByRole("button", { name: speed, exact: true }).tap();
    await page.waitForTimeout(500);
    assert.match(
      await page
        .getByRole("button", { name: speed, exact: true })
        .getAttribute("class"),
      /active/,
    );
  }
  await page.getByRole("button", { name: "Restart", exact: true }).tap();
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#counts").textContent(), "USMC 6 · RU 6");
  await page.setViewportSize({ width: 390, height: 844 });
  // Reload at the final viewport to recenter after deliberately testing camera gestures.
  await page.reload();
  await page.waitForSelector("canvas");
  await page.getByRole("button", { name: "4×", exact: true }).tap();
  const frameStats = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [];
        const start = performance.now();
        let last;
        function tick(t) {
          if (last != null) frames.push(t - last);
          last = t;
          if (t - start < 10000) requestAnimationFrame(tick);
          else {
            frames.sort((a, b) => a - b);
            resolve({
              samples: frames.length,
              medianMs: frames[Math.floor(frames.length * 0.5)],
              p95Ms: frames[Math.floor(frames.length * 0.95)],
              maxMs: frames.at(-1),
            });
          }
        }
        requestAnimationFrame(tick);
      }),
  );
  await page.screenshot({ path: "/tmp/aw-v025-overview.png" });
  await page.getByRole("button", { name: "Pause", exact: true }).tap();
  await page.mouse.move(190, 320);
  for (let i = 0; i < 7; i++) await page.mouse.wheel(0, -100);
  await page.waitForTimeout(100);
  await page.screenshot({ path: "/tmp/aw-v025-close.png" });
  console.log(
    JSON.stringify({
      runningAt4x: true,
      frameStats,
      counts: await page.locator("#counts").textContent(),
    }),
  );
  assert.deepEqual(errors, []);
  if (process.argv[2])
    writeFileSync(
      process.argv[2],
      JSON.stringify(
        {
          viewport: [390, 844],
          landscape: [844, 390],
          panelHeight: panel.height,
          touchInspection: true,
          scrollInspection: true,
          pinchChangesCanvas: true,
          panChangesCanvas: true,
          gesturesPreserveSelection: true,
          pauseResume: true,
          restart: true,
          speeds: [1, 2, 4],
          frameStats,
          errors,
          physicalSafari:
            "Not available; desktop Chromium touch emulation only",
        },
        null,
        2,
      ) + "\n",
    );
  console.log(
    JSON.stringify({
      inspection: text,
      lmgInspection: lmg,
      panelHeight: panel.height,
      pinchPreservesSelection: true,
      orientations: 2,
      errors,
    }),
  );
} finally {
  await browser.close();
}
