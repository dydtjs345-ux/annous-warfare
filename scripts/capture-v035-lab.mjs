const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const out = process.env.AW_REPORT_DIR || "reports/v035-lab";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  failed = [],
  captures = [],
  playbacks = [];
const root = "http://127.0.0.1:4235/annous-warfare/";
try {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => failed.push(r.url()));
  await page.goto(root + "rifleman-lab.html");
  await page.waitForFunction(() => window.riflemanLabSnapshot);
  async function hold(direction, action, time = 0) {
    await page.locator("#lab-direction").selectOption(direction);
    await page.locator("#lab-action").selectOption(action);
    await page.locator("#lab-time").evaluate((e, t) => {
      e.value = String(t);
      e.dispatchEvent(new Event("input", { bubbles: true }));
    }, time);
    await page.waitForTimeout(150);
    const s = await page.evaluate(() => riflemanLabSnapshot());
    assert.equal(s.playing, false);
    for (const v of s.views.filter((v) => v.visible)) {
      assert.equal(v.rotation, 0);
      assert.equal(v.flipX, false);
      assert.equal(v.scale, v.scaleY);
      assert.ok(
        v.bounds.left >= 0 &&
          v.bounds.right <= s.canvas.width &&
          v.bounds.top >= 0 &&
          v.bounds.bottom <= s.canvas.height,
      );
    }
    return s;
  }
  for (const [direction, action, time] of [
    ["SE", "idle", 0.4],
    ["SE", "walk", 0.4],
    ["SE", "raise", 0.32],
    ["SE", "aim", 0],
    ["SE", "lower", 0.35],
    ["E", "idle", 0],
    ["E", "lowReady", 0],
    ["E", "highReady", 0],
    ["E", "aim", 0],
    ["E", "walk", 0],
    ["N", "aim", 0],
  ]) {
    const s = await hold(direction, action, time);
    await page.screenshot({
      path: `${out}/${direction}-${action}.png`,
      fullPage: true,
    });
    captures.push({ direction, action, snapshot: s });
    if (direction === "N" || (direction === "E" && action === "walk"))
      assert.ok(s.views.filter((v) => v.selected).every((v) => !v.visible));
  }
  await hold("SE", "walk");
  const frames = [];
  for (let i = 0; i < 8; i++) {
    frames.push((await page.evaluate(() => riflemanLabSnapshot())).pose.frame);
    await page.locator("#lab-step").click();
    await page.waitForTimeout(50);
  }
  assert.deepEqual(frames, [4, 5, 6, 7, 8, 9, 10, 11]);
  for (const [name, action, speed, wall] of [
    ["se-connected", "sequence", 1, 9000],
    ["se-walk-slow", "walk", 0.25, 4400],
    ["e-keys-rejected-review", "review", 0.25, 4400],
  ]) {
    if (action === "review") {
      await page.goto(root + "rifleman-lab.html?review=e-walk-keys");
      await page.waitForFunction(() => window.riflemanLabSnapshot);
      await page.locator("#lab-time").evaluate((e) => {
        e.value = "0";
        e.dispatchEvent(new Event("input", { bubbles: true }));
      });
    } else await hold("SE", action);
    await page.locator("#lab-speed").selectOption(String(speed));
    const dir = `/tmp/aw-v035-${name}`;
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
      maxWidth: 1080,
      maxHeight: 1000,
      everyNthFrame: 1,
    });
    await page.locator("#lab-pause").click();
    const samples = await page.evaluate(
      (wall) =>
        new Promise((resolve) => {
          const a = [],
            start = performance.now();
          function tick(n) {
            const { completion, probe, ...snapshot } = riflemanLabSnapshot();
            a.push({
              epoch: (performance.timeOrigin + n) / 1000,
              ...snapshot,
            });
            if (n - start < wall) requestAnimationFrame(tick);
            else resolve(a);
          }
          requestAnimationFrame(tick);
        }),
      wall,
    );
    await page.locator("#lab-pause").click();
    await cdp.send("Page.stopScreencast");
    await cdp.detach();
    writeFileSync(
      `${dir}/concat.txt`,
      frames
        .map(
          (f, i) =>
            `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.epoch ?? f.epoch + 0.033) - f.epoch)}`,
        )
        .join("\n") + "\n",
    );
    if (action === "sequence")
      assert.deepEqual([...new Set(samples.map((s) => s.pose.action))].sort(), [
        "aim",
        "idle",
        "lowReady",
        "lower",
        "raise",
        "walk",
      ]);
    else
      assert.equal(
        new Set(samples.map((s) => s.pose.frame)).size,
        action === "review" ? 4 : 8,
      );
    if (action === "review")
      assert.ok(
        samples.every(
          (s) =>
            s.reviewOnly &&
            !s.pose.supported &&
            s.pose.status === "rejected" &&
            !s.liveCombatAdmission,
        ),
      );
    playbacks.push({
      name,
      action,
      speed,
      frames: frames.length,
      concat: `${dir}/concat.txt`,
      samples,
    });
    if (action === "review")
      for (const t of [0, 0.25, 0.5, 0.75]) {
        await page.locator("#lab-time").evaluate((e, t) => {
          e.value = String(t);
          e.dispatchEvent(new Event("input", { bubbles: true }));
        }, t);
        await page.waitForTimeout(130);
        const s = await page.evaluate(() => riflemanLabSnapshot());
        await page.screenshot({
          path: `${out}/E-rejected-key-${s.pose.index + 1}.png`,
        });
        captures.push({ direction: "E", action: "rejectedWalk", snapshot: s });
      }
  }
  await page.goto(root + "rifleman-lab.html");
  await page.waitForFunction(() => window.riflemanLabSnapshot);
  for (const speed of [0.1, 0.5, 1, 2, 4]) {
    await hold("SE", "walk");
    await page.locator("#lab-speed").selectOption(String(speed));
    await page.locator("#lab-pause").click();
    await page.waitForTimeout(500);
    await page.locator("#lab-pause").click();
    const s = await page.evaluate(() => riflemanLabSnapshot());
    assert.ok(s.time > 0 && s.pose.supported);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  writeFileSync(
    `${out}/playback-samples.jsonl`,
    playbacks
      .flatMap((r) =>
        r.samples.map((s) => JSON.stringify({ name: r.name, ...s })),
      )
      .join("\n") + "\n",
  );
  writeFileSync(
    `${out}/visual-evidence.json`,
    JSON.stringify(
      {
        method:
          "Actual production Phaser laboratory, real authored PNGs and native UI controls. No synthesized poses or in-between limbs. SE videos are reference-prototype playback, not new E motion or live battle footage.",
        captures,
        playbacks: playbacks.map(({ samples, ...r }) => ({
          ...r,
          samplesFile: "playback-samples.jsonl",
          sampleCount: samples.length,
          states: [...new Set(samples.map((s) => s.pose.action))],
          framesSeen: [...new Set(samples.map((s) => s.pose.frame))].sort(
            (a, b) => a - b,
          ),
        })),
        errors,
        failed,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Laboratory screenshots, exact stepping and recorded 1x/slow playback passed.",
  );
} finally {
  await browser.close();
}
