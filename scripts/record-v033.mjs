const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("/tmp/aw-v033-video", { recursive: true });
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const frames = [],
  errors = [],
  runs = [];
try {
  const p = await b.newPage({ viewport: { width: 980, height: 950 } });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:4233/annous-warfare/animation-preview.html");
  await p.waitForFunction(() => window.sePreviewSnapshot);
  await p.locator("#preview-pause").click();
  await p.locator("#preview-restart").click();
  const c = await p.context().newCDPSession(p);
  c.on("Page.screencastFrame", async (e) => {
    const file = `/tmp/aw-v033-video/${String(frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(file, Buffer.from(e.data, "base64"));
    frames.push({ file, time: e.metadata.timestamp });
    await c
      .send("Page.screencastFrameAck", { sessionId: e.sessionId })
      .catch(() => {});
  });
  await c.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: 980,
    maxHeight: 950,
    everyNthFrame: 1,
  });
  for (const speed of [1, 2, 4]) {
    if (speed > 1) {
      await p.locator("#preview-pause").click();
      await p.locator("#preview-restart").click();
    }
    await p.locator("#preview-speed").selectOption(String(speed));
    await p.locator("#preview-pause").click();
    const samples = await p.evaluate(
      (ms) =>
        new Promise((resolve) => {
          const a = [],
            start = performance.now();
          function tick(n) {
            a.push({ wall: n, ...window.sePreviewSnapshot() });
            if (n - start < ms) requestAnimationFrame(tick);
            else resolve(a);
          }
          requestAnimationFrame(tick);
        }),
      speed === 1 ? 12000 : 12000 / speed,
    );
    const stages = [...new Set(samples.map((s) => s.pose.stage))].sort(
      (a, b) => a - b,
    );
    assert.deepEqual(stages, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(Math.max(...samples.map((s) => s.shotCues)), 2);
    assert.ok(samples.some((s) => s.pose.flash));
    for (const s of samples)
      assert.ok(
        s.views.every((v) => v.rotation === 0 && v.frame === s.pose.frame),
        "whole body stays on one cel without a rotating weapon",
      );
    runs.push({
      speed,
      stages,
      visibleFlashFrames: samples.filter((s) => s.pose.flash).length,
      samples,
    });
    if (speed === 1) {
      await c.send("Page.stopScreencast");
      writeFileSync(
        "/tmp/aw-v033-video/concat.txt",
        frames
          .map(
            (f, i) =>
              `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.time ?? f.time + 0.033) - f.time)}`,
          )
          .join("\n") + "\n",
      );
    }
  }
  await p.locator("#preview-pause").click();
  const frozen = await p.evaluate(() => window.sePreviewSnapshot());
  await p.waitForTimeout(200);
  assert.deepEqual(await p.evaluate(() => window.sePreviewSnapshot()), frozen);
  assert.deepEqual(errors, []);
  writeFileSync(
    "reports/v033-animation.json",
    JSON.stringify(
      {
        method:
          "Actual production preview, continuous entire sequence at 1x recorded by CDP; separate 2x/4x full-cycle checks. No Battle or injected combat states.",
        timeOrigin: await p.evaluate(() => performance.timeOrigin),
        frames,
        runs,
        errors,
        pauseFreeze: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      runs.map((r) => ({
        speed: r.speed,
        stages: r.stages,
        flashes: r.visibleFlashFrames,
      })),
    ),
  );
} finally {
  await b.close();
}
