const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
const out = process.env.AW_REPORT_DIR || "reports/v035-production/mobile";
const root = `${process.env.AW_GAME_URL || "http://127.0.0.1:4236"}/annous-warfare/`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  failed = [],
  checks = [];
try {
  const p = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("requestfailed", (r) => failed.push(r.url()));
  await p.goto(root + "?seed=7&debug=1");
  await p.waitForFunction(() => window.awSnapshot);
  await p.locator("#pause").tap();
  await p.locator("#prototype-toggle").tap();
  await p.locator("#prototype-toggle").tap();
  const before = await p.evaluate(() => awSnapshot());
  assert.equal(before.selected, 1);
  await p.locator("#rifleman-lab").tap();
  await p.waitForTimeout(400);
  const f = p.frameLocator("#rifleman-lab-dialog iframe");
  await f.locator("#lab-direction").selectOption("E");
  await f.locator("#lab-action").selectOption("highReady");
  await f.locator("#lab-pause").tap();
  await p.waitForTimeout(200);
  const labFrame = p
    .frames()
    .find((f) => f.url().includes("rifleman-lab.html"));
  const snap = await labFrame.evaluate(() => riflemanLabSnapshot());
  assert.equal(snap.pose.count, 4);
  assert.equal(snap.pose.status, "verified");
  assert.equal(snap.liveApprovedClip, true);
  assert.equal(snap.pose.bank, "eQuiet");
  assert.equal(snap.liveCombatAdmission, false);
  assert.ok(snap.stacked);
  assert.equal(snap.reference.action, "lowReady");
  assert.equal((await p.evaluate(() => awSnapshot())).time, before.time);
  await p.screenshot({ path: `${out}/mobile-in-game-lab.png` });
  const cdp = await p.context().newCDPSession(p),
    ib = await p.locator("#rifleman-lab-dialog iframe").boundingBox();
  const x = ib.x + 190,
    y = ib.y + Math.min(550, ib.height - 30);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  for (let i = 1; i <= 7; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - i * 30, id: 1 }],
    });
    await p.waitForTimeout(30);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await p.waitForTimeout(150);
  assert.ok(
    await labFrame.evaluate(() => scrollY > 0),
    "native scrolling over canvas works inside modal",
  );
  checks.push(
    "in-game lab, pause isolation, reviewed E high-ready clip, native iframe touch scroll",
  );
  await p.locator("#rifleman-lab-dialog [data-preview-close]").tap();
  await p.waitForTimeout(200);
  assert.equal((await p.evaluate(() => awSnapshot())).paused, true);
  assert.equal((await p.evaluate(() => awSnapshot())).selected, 1);
  assert.equal(await p.locator("#rifleman-lab-dialog iframe").count(), 0);
  await p.locator("#animation-preview").tap();
  await p.waitForTimeout(300);
  assert.equal(await p.locator("#animation-dialog iframe").count(), 1);
  await p.locator("#animation-dialog [data-preview-close]").tap();
  await p.waitForTimeout(100);
  checks.push(
    "existing SE preview preserved; closing restores prior paused battle and selection",
  );
  await p.locator("#pause").tap();
  await p.waitForTimeout(100);
  await p.locator("#rifleman-lab").tap();
  await p.waitForTimeout(250);
  await p.locator("#rifleman-lab-dialog [data-preview-close]").tap();
  await p.waitForTimeout(150);
  assert.equal((await p.evaluate(() => awSnapshot())).paused, false);
  for (const speed of [1, 2, 4]) {
    await p.locator(`[data-speed="${speed}"]`).tap();
    const t = (await p.evaluate(() => awSnapshot())).time;
    await p.waitForTimeout(300);
    assert.ok((await p.evaluate(() => awSnapshot())).time > t);
  }
  checks.push("running battle resumes; unchanged 1x/2x/4x live controls");
  for (let i = 0; i < 3; i++) {
    await p.locator("#rifleman-lab").tap();
    await p.waitForTimeout(160);
    await p.locator("#rifleman-lab-dialog [data-preview-close]").tap();
    assert.equal(await p.locator("#rifleman-lab-dialog iframe").count(), 0);
  }
  checks.push("three extra open/close cycles remove lab iframes");
  await p.goto(root + "rifleman-lab.html");
  await p.waitForFunction(() => window.riflemanLabSnapshot);
  await p.locator("#lab-direction").selectOption("E");
  await p.locator("#lab-action").selectOption("highReady");
  await p.locator("#lab-pause").tap();
  await p.screenshot({ path: `${out}/mobile-E-highReady.png`, fullPage: true });
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await p.setViewportSize(viewport);
    await p.waitForTimeout(200);
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const s = await p.evaluate(() => riflemanLabSnapshot());
    for (const v of s.views.filter((v) => v.visible))
      assert.ok(
        v.bounds.left >= 0 &&
          v.bounds.right <= s.canvas.width &&
          v.bounds.top >= 0 &&
          v.bounds.bottom <= s.canvas.height,
      );
  }
  await p.locator("#lab-direction").selectOption("E");
  for (const action of [
    "idle",
    "lowReady",
    "highReady",
    "raise",
    "aim",
    "lower",
    "fire",
    "walk",
  ]) {
    await p.locator("#lab-action").selectOption(action);
    await p.waitForTimeout(80);
    const s = await p.evaluate(() => riflemanLabSnapshot());
    assert.equal(s.pose.status, action === "walk" ? "prototype" : "verified");
    assert.equal(s.liveApprovedClip, action !== "walk");
    assert.ok(
      s.views
        .filter((v) => v.selected)
        .every((v) => v.visible && !v.flipX && v.rotation === 0),
    );
    await p.locator("#lab-step").tap();
  }
  checks.push(
    "all eight E actions, accurate COMPLETE/PROTOTYPE distinction, stepping and no rotated or mirrored substitutes",
  );
  await p.locator("#lab-direction").selectOption("N");
  await p.locator("#lab-action").selectOption("walk");
  await p.waitForTimeout(150);
  assert.ok(
    (await p.evaluate(() => riflemanLabSnapshot())).views
      .filter((v) => v.selected)
      .every((v) => !v.visible),
  );
  await p.locator("#lab-direction").selectOption("SE");
  await p.locator("#lab-action").selectOption("walk");
  await p.locator("#lab-pause").tap();
  for (let i = 0; i < 8; i++) {
    await p.locator("#lab-step").tap();
  }
  await p.locator("#lab-restart").tap();
  for (const size of [30, 39, 45]) {
    await p.locator("#lab-size").selectOption(String(size));
    assert.equal(
      (await p.evaluate(() => riflemanLabSnapshot())).displayHeight,
      size,
    );
  }
  await p.locator("#lab-size").selectOption("39");
  await p.locator("#lab-rig summary").tap();
  await p.locator("#rig-gait").selectOption("walk");
  await p.locator("#rig-aim").selectOption("NE");
  await p.waitForTimeout(150);
  assert.match(await p.locator("#rig-result").textContent(), /表現|표현 불가/);
  checks.push(
    "mobile directions, missing-art display, stepping, scales, pairing refusal and both orientations",
  );
  await p.evaluate(() => scrollTo(0, 0));
  await p.locator("#lab-speed").selectOption("4");
  await p.locator("#lab-pause").tap();
  const frameStats = await p.evaluate(
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
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  writeFileSync(
    `${out}/mobile.json`,
    JSON.stringify(
      { checks, frameStats, errors, failed, physicalSafari: "unverified" },
      null,
      2,
    ) + "\n",
  );
  console.log("Mobile lab checks passed", frameStats);
} finally {
  await browser.close();
}
