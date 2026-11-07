const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("/tmp/aw-motion-frames", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const frames = [],
  runs = [],
  errors = [];
try {
  const p = await browser.newPage({
    viewport: { width: 900, height: 700 },
    isMobile: true,
    hasTouch: true,
  });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(
    "http://127.0.0.1:4209/annous-warfare/?seed=2049&layout=0&spawn=0&debug=1",
  );
  await p.waitForFunction(() => window.awSnapshot?.().units[0].renderX != null);
  const cdp = await p.context().newCDPSession(p);
  cdp.on("Page.screencastFrame", async (e) => {
    const id = frames.length;
    if (id < 700) {
      const file = `/tmp/aw-motion-frames/${String(id).padStart(5, "0")}.jpg`;
      writeFileSync(file, Buffer.from(e.data, "base64"));
      frames.push({ file, time: e.metadata.timestamp });
    }
    await cdp
      .send("Page.screencastFrameAck", { sessionId: e.sessionId })
      .catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 82,
    maxWidth: 900,
    maxHeight: 700,
    everyNthFrame: 2,
  });
  for (const speed of [1, 2, 4]) {
    await p.locator(`[data-speed="${speed}"]`).tap();
    const samples = await p.evaluate(
      (ms) =>
        new Promise((resolve) => {
          const samples = [],
            start = performance.now();
          function f(now) {
            const s = window.awSnapshot();
            samples.push({ wall: now, time: s.time, units: s.units });
            if (now - start < ms) requestAnimationFrame(f);
            else resolve(samples);
          }
          requestAnimationFrame(f);
        }),
      speed === 4 ? 6500 : 2500,
    );
    let intermediate = 0,
      turns = 0,
      flashFrames = 0;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1],
        b = samples[i];
      for (let j = 0; j < b.units.length; j++) {
        const u = b.units[j],
          v = a.units[j];
        if (
          u.active &&
          u.x === v.x &&
          u.y === v.y &&
          Math.hypot(u.renderX - v.renderX, u.renderY - v.renderY) > 1e-7
        )
          intermediate++;
        if (
          u.authoritativeObservation === v.authoritativeObservation &&
          Math.abs(u.renderObservation - v.renderObservation) > 1e-6
        )
          turns++;
        if (u.flash) {
          flashFrames++;
          assert.ok(
            Math.abs(
              Math.atan2(
                Math.sin(u.renderDirection - u.shotDirection),
                Math.cos(u.renderDirection - u.shotDirection),
              ),
            ) < 1e-8,
          );
        }
      }
    }
    if (speed === 1)
      assert.ok(
        intermediate > 5,
        "render moves between stationary authoritative ticks",
      );
    runs.push({ speed, intermediate, turns, flashFrames, samples });
  }
  await p.getByRole("button", { name: "일시정지", exact: true }).tap();
  await p.waitForTimeout(100);
  const before = await p.evaluate(() =>
    window
      .awSnapshot()
      .units.map((u) => [
        u.renderX,
        u.renderY,
        u.renderDirection,
        u.renderTop,
        u.renderStride,
      ]),
  );
  await p.waitForTimeout(300);
  assert.deepEqual(
    await p.evaluate(() =>
      window
        .awSnapshot()
        .units.map((u) => [
          u.renderX,
          u.renderY,
          u.renderDirection,
          u.renderTop,
          u.renderStride,
        ]),
    ),
    before,
  );
  await p.screenshot({ path: "reports/v029-motion-paused.png" });
  await p.getByRole("button", { name: "재시작", exact: true }).tap();
  await p.waitForTimeout(200);
  const reset = await p.evaluate(() => window.awSnapshot());
  assert.equal(reset.seed, 2050);
  assert.ok(
    reset.units.every(
      (u) => Math.hypot(u.x - u.renderX, u.y - u.renderY) < 0.3,
    ),
  );
  await cdp.send("Page.stopScreencast");
  assert.deepEqual(errors, []);
  writeFileSync(
    "reports/v029-motion-frames.json",
    JSON.stringify(
      {
        method:
          "actual production game RAF snapshots and CDP screencast; seed 2049 layout 0 spawn 0; no state injection",
        pauseFrozen: true,
        restart: true,
        errors,
        runs,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    "/tmp/aw-motion-frames/concat.txt",
    frames
      .map(
        (f, i) =>
          `file '${f.file}'\nduration ${Math.min(0.5, Math.max(0.005, (frames[i + 1]?.time ?? f.time + 0.033) - f.time))}`,
      )
      .join("\n") + "\n",
  );
  console.log(
    runs.map(({ speed, intermediate, turns, flashFrames }) => ({
      speed,
      intermediate,
      turns,
      flashFrames,
    })),
  );
} finally {
  await browser.close();
}
