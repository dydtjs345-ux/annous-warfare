// Real, unmodified autonomous battles. Only spectator controls are exercised.
const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const out = process.env.AW_REPORT_DIR || "reports/v034-live";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  failed = [],
  records = [],
  heldPhases = [];
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("requestfailed", (r) => failed.push(r.url()));
const url = (seed) =>
  `http://127.0.0.1:4234/annous-warfare/?seed=${seed}&debug=1`;
async function goto(seed, start) {
  await page.goto(url(seed));
  await page.waitForFunction(() => window.awSnapshot);
  await page.locator('[data-speed="4"]').click();
  await page.waitForFunction((t) => awSnapshot().time >= t, start, {
    timeout: 120000,
  });
  await page.locator("#pause").click();
  await page.locator('[data-speed="1"]').click();
  // Select #1 with the existing toggle, without writing orders or unit state.
  await page.locator("#prototype-toggle").click();
  await page.locator("#prototype-toggle").click();
  await page.waitForTimeout(250);
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 7; i++) await page.mouse.wheel(0, -40);
  await page.waitForTimeout(250);
  // Camera-only drag to center #1. Keep a useful battlefield view, not a demo.
  const s = await page.evaluate(() => awSnapshot()),
    u = s.units[1];
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x + box.width / 2 - u.screenX,
    y + box.height / 2 - u.screenY,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForTimeout(150);
}
async function record(seed, start, end, name) {
  await goto(seed, start);
  const dir = `/tmp/aw-v034-${name}`;
  mkdirSync(dir, { recursive: true });
  const frames = [],
    cdp = await page.context().newCDPSession(page);
  cdp.on("Page.screencastFrame", async (e) => {
    const file = `${dir}/${String(frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(file, Buffer.from(e.data, "base64"));
    frames.push({ file, epoch: e.metadata.timestamp });
    await cdp
      .send("Page.screencastFrameAck", { sessionId: e.sessionId })
      .catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 95,
    maxWidth: 1100,
    maxHeight: 900,
    everyNthFrame: 1,
  });
  await page.locator("#pause").click();
  const samples = await page.evaluate(
    (end) =>
      new Promise((resolve) => {
        const samples = [];
        function tick() {
          const s = awSnapshot(),
            u = s.units[1];
          samples.push({
            epoch: (performance.timeOrigin + performance.now()) / 1000,
            time: s.time,
            speed: s.speed,
            ai: u.state,
            pose: u.pose,
            active: s.prototype.active,
            live: s.prototype.live,
            unit: u,
            view: s.view,
          });
          if (s.time < end) requestAnimationFrame(tick);
          else {
            document.querySelector("#pause").click();
            resolve(samples);
          }
        }
        requestAnimationFrame(tick);
      }),
    end,
  );
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  assert.ok(samples.some((s) => s.active.renderer === "v033"));
  const chosen = {};
  for (const s of samples) {
    const key =
      s.active.renderer === "v033" ? s.live.animation : "legacy-fallback";
    if (key === "firing" && !s.live.flash) continue;
    if (!(key in chosen)) chosen[key] = s;
  }
  writeFileSync(
    `${dir}/concat.txt`,
    frames
      .map(
        (f, i) =>
          `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.epoch ?? f.epoch + 0.033) - f.epoch)}`,
      )
      .join("\n") + "\n",
  );
  records.push({
    seed,
    layout: seed % 4,
    spawn: Math.floor(seed / 4) % 3,
    name,
    frames: frames.length,
    chosen,
    samples,
    concat: `${dir}/concat.txt`,
  });
  console.log(name, frames.length, Object.keys(chosen));
}
async function phaseScreenshots(seed, start, phases) {
  await goto(seed, start);
  for (const animation of phases) {
    await page.locator("#pause").click();
    await page.evaluate(
      (animation) =>
        new Promise((resolve) => {
          function tick() {
            const s = awSnapshot();
            if (
              s.prototype.active?.renderer === "v033" &&
              s.prototype.live.animation === animation &&
              (animation !== "firing" || s.prototype.live.flash) &&
              (animation !== "raising" || s.prototype.live.frame >= 13)
            ) {
              document.querySelector("#pause").click();
              resolve();
            } else requestAnimationFrame(tick);
          }
          tick();
        }),
      animation,
    );
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => awSnapshot());
    assert.equal(s.prototype.active.renderer, "v033");
    assert.equal(s.prototype.live.animation, animation);
    await page.screenshot({ path: `${out}/live-${animation}.png` });
    heldPhases.push({
      seed,
      animation,
      time: s.time,
      unit: s.units[1],
      view: s.view,
      live: s.prototype.live,
      active: s.prototype.active,
    });
  }
}
try {
  let comparisonTime = null;
  const lowerOnly = process.argv.includes("--lower-only");
  if (lowerOnly) {
    await record(31, 30, 33.5, "complete-lower");
  } else {
    await record(7, 18, 28, "first-contact");
    await record(32, 20, 35.2, "contact-and-resume");
    await phaseScreenshots(7, 20, ["walking", "raising", "firing", "lowering"]);
    await phaseScreenshots(32, 21, ["aiming"]);
    // Fair legacy/new comparison: identical paused real match and camera.
    await goto(7, 20);
    await page.locator("#pause").click();
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          function tick() {
            const s = awSnapshot();
            if (
              s.time > 20.6 &&
              s.prototype.active.renderer === "v033" &&
              s.prototype.live.animation === "walking"
            ) {
              document.querySelector("#pause").click();
              resolve();
            } else requestAnimationFrame(tick);
          }
          tick();
        }),
    );
    const before = await page.evaluate(() => awSnapshot());
    await page.locator("#prototype-art").selectOption("v031");
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${out}/comparison-v031.png` });
    await page.locator("#prototype-art").selectOption("v033");
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${out}/comparison-v033.png` });
    assert.equal((await page.evaluate(() => awSnapshot())).time, before.time);
    assert.equal(
      (await page.evaluate(() => awSnapshot())).prototype.active.renderer,
      "v033",
    );
    comparisonTime = before.time;
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  writeFileSync(
    `${out}/${lowerOnly ? "lower-evidence" : "live-evidence"}.json`,
    JSON.stringify(
      {
        method:
          "Production game; original seeded autonomous battles; only pause/speed/selection/camera/renderer UI controls. No scripted orders, targets, shots or demo clock. Videos are uninterrupted; separate held-phase PNGs pause the same real matches at observed states, wait for composition and verify the actual displayed frame.",
        comparisonTime,
        records,
        heldPhases,
        errors,
        failed,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
