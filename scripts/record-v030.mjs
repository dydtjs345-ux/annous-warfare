const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("/tmp/aw-v030-video", { recursive: true });
const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  }),
  frames = [],
  runs = [],
  errors = [];
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(
    "http://127.0.0.1:4209/annous-warfare/?seed=2049&layout=0&spawn=0&debug=1",
  );
  await p.waitForFunction(() => window.awSnapshot);
  await p.locator("#prototype-toggle").click();
  await p.locator("#prototype-scale").selectOption("1.3");
  await p.waitForTimeout(150);
  const c = await p.context().newCDPSession(p);
  c.on("Page.screencastFrame", async (e) => {
    const id = frames.length;
    if (id < 1000) {
      const file = `/tmp/aw-v030-video/${String(id).padStart(5, "0")}.jpg`;
      writeFileSync(file, Buffer.from(e.data, "base64"));
      frames.push({ file, time: e.metadata.timestamp });
    }
    await c
      .send("Page.screencastFrameAck", { sessionId: e.sessionId })
      .catch(() => {});
  });
  await c.send("Page.startScreencast", {
    format: "jpeg",
    quality: 85,
    maxWidth: 1000,
    maxHeight: 760,
    everyNthFrame: 2,
  });
  for (const [speed, ms] of [
    [1, 2000],
    [2, 1000],
    [4, 1000],
    [1, 7500],
  ]) {
    if (speed === 1 && runs.length > 0)
      await p.waitForFunction(
        () => window.awSnapshot().time >= 20,
        {},
        { timeout: 30000 },
      );
    await p.locator(`[data-speed="${speed}"]`).click();
    const samples = await p.evaluate(
      (ms) =>
        new Promise((resolve) => {
          const a = [],
            start = performance.now();
          function tick(now) {
            const s = window.awSnapshot(),
              u = s.units.find((u) => u.id === 1);
            a.push({
              wall: now,
              time: s.time,
              prototype: s.prototype,
              unit: u,
            });
            if (now - start < ms) requestAnimationFrame(tick);
            else resolve(a);
          }
          requestAnimationFrame(tick);
        }),
      ms,
    );
    let firingFrames = 0;
    for (const s of samples) {
      const v = s.prototype.state;
      if (v?.visible && v.flash) {
        const a = s.unit.shotDirection,
          expected = Math.atan2(
            (Math.sin(a) + Math.cos(a)) * 0.5,
            Math.cos(a) - Math.sin(a),
          );
        assert.ok(
          Math.abs(
            Math.atan2(
              Math.sin(v.gunAngle - expected),
              Math.cos(v.gunAngle - expected),
            ),
          ) < 1e-8,
        );
        firingFrames++;
      }
    }
    runs.push({ speed, firingFrames, samples });
    console.log(
      "phase",
      speed,
      samples.at(-1).time,
      firingFrames,
      samples.at(-1).prototype.state,
    );
  }
  writeFileSync("/tmp/aw-v030-attempt.json", JSON.stringify(runs));
  assert.ok(
    runs.some((r) => r.firingFrames > 0),
    "prototype itself fires in actual combat",
  );
  await p.getByRole("button", { name: "일시정지", exact: true }).click();
  await p.screenshot({ path: "reports/v030-combat.png" });
  const a = await p.evaluate(() => window.awSnapshot().prototype);
  await p.waitForTimeout(200);
  assert.deepEqual(await p.evaluate(() => window.awSnapshot().prototype), a);
  await c.send("Page.stopScreencast");
  assert.deepEqual(errors, []);
  writeFileSync(
    "reports/v030-animation.json",
    JSON.stringify(
      {
        method:
          "actual production battlefield, no injected combat states; USMC #1 at 1.3x, seed2049 layout0 spawn0",
        errors,
        runs,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    "/tmp/aw-v030-video/concat.txt",
    frames
      .map(
        (f, i) =>
          `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.time ?? f.time + 0.033) - f.time)}`,
      )
      .join("\n") + "\n",
  );
  console.log(
    runs.map((r) => ({
      speed: r.speed,
      firingFrames: r.firingFrames,
      samples: r.samples.length,
    })),
  );
} finally {
  await b.close();
}
