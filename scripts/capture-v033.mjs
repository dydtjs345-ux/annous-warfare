const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { CLIPS } from "../src/usmc-se-animation.js";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const records = [],
  errors = [],
  failed = [];
mkdirSync("/tmp/aw-v033-frames", { recursive: true });
try {
  const p = await b.newPage({ viewport: { width: 980, height: 950 } });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("requestfailed", (r) => failed.push(r.url()));
  await p.goto("http://127.0.0.1:4233/annous-warfare/animation-preview.html");
  await p.waitForFunction(() => window.sePreviewSnapshot);
  async function seek(mode, time) {
    if ((await p.evaluate(() => window.sePreviewSnapshot().mode)) !== mode)
      await p.locator(`[data-clip="${mode}"]`).click();
    await p.locator("#preview-time").evaluate((e, t) => {
      e.value = t;
      e.dispatchEvent(new Event("input", { bubbles: true }));
    }, time);
    await p.waitForTimeout(70);
    const s = await p.evaluate(() => window.sePreviewSnapshot());
    assert.equal(s.playing, false);
    assert.ok(
      s.views.every((v) => v.frame === s.pose.frame && v.rotation === 0),
    );
    return s;
  }
  for (const [mode, time] of [
    ["idle", 0.1],
    ["walk", 0.31],
    ["raise", 0.25],
    ["aim", 0.3],
    ["fire", 0.015],
    ["lower", 0.35],
  ]) {
    const snapshot = await seek(mode, time);
    await p.screenshot({ path: `reports/v033-${mode}.png` });
    records.push({ mode, time, snapshot });
  }
  for (const mode of ["idle", "walk", "raise", "aim", "fire", "lower"]) {
    let t = 0;
    for (let i = 0; i < CLIPS[mode].frames.length; i++) {
      const time = t + Math.min(0.02, CLIPS[mode].durations[i] / 2),
        s = await seek(mode, time),
        box = await p.locator("canvas").boundingBox();
      assert.equal(s.pose.frame, CLIPS[mode].frames[i]);
      await p.screenshot({
        path: `/tmp/aw-v033-frames/${mode}-${i}.png`,
        clip: {
          x:
            box.x + s.views.find((v) => v.bank === "v033" && !v.actual).x - 110,
          y: box.y + box.height - 220,
          width: 220,
          height: 220,
        },
      });
      await p.screenshot({
        path: `/tmp/aw-v033-frames/base-${mode}-${i}.png`,
        clip: {
          x:
            box.x + s.views.find((v) => v.bank === "v032" && !v.actual).x - 110,
          y: box.y + box.height - 220,
          width: 220,
          height: 220,
        },
      });
      records.push({ mode, cel: i, time, snapshot: s });
      t += CLIPS[mode].durations[i];
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  writeFileSync(
    "reports/v033-frames.json",
    JSON.stringify(
      {
        method:
          "Actual production preview; phase selection and time slider only. Both v032 and v033 whole-body cels share the exact frame/time; no combat state assigned. Captures use 39px game scale and 4x camera magnification.",
        records,
        errors,
        failed,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await b.close();
}
