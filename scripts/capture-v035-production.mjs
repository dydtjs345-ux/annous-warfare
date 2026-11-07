// Actual Phaser PNG playback and real autonomous battle; no injected unit state.
const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const root = `${process.env.AW_GAME_URL || "http://127.0.0.1:4236"}/annous-warfare/`;
const out = process.env.AW_REPORT_DIR || "reports/v035-production";
mkdirSync(out + "/frames", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  failed = [],
  captures = [];
const watch = (p) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("requestfailed", (r) => failed.push(r.url()));
};
async function hold(p, action, time = 0) {
  if (await p.locator("#lab-action").isEnabled())
    await p.locator("#lab-action").selectOption(action);
  else assert.equal(await p.locator("#lab-action").inputValue(), action);
  await p.locator("#lab-time").evaluate((e, t) => {
    e.value = String(t);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  }, time);
  await p.waitForTimeout(130);
  return p.evaluate(() => riflemanLabSnapshot());
}
async function bodyCapture(p, s, file) {
  const v = s.views.find((v) => v.selected && !v.actual),
    box = await p.locator("canvas").boundingBox();
  assert.ok(v.visible && !v.flipX && v.rotation === 0);
  await p.screenshot({
    path: file,
    clip: {
      x: box.x + v.x - 105,
      y: box.y + v.y - 172,
      width: 210,
      height: 192,
    },
  });
}
async function gallery(p, file, title, shots) {
  const g = await browser.newPage();
  await g.setViewportSize({
    width: 920,
    height: Math.ceil(shots.length / 4) * 230 + 100,
  });
  await g.setContent(
    '<body style="margin:16px;background:#101a24;color:#dce4e6;font:16px system-ui"><h3>' +
      title +
      '</h3><div style="display:grid;grid-template-columns:repeat(4,210px);gap:14px">' +
      shots
        .map(
          (x) =>
            "<div>" +
            x.label +
            '<img style="display:block" src="data:image/png;base64,' +
            readFileSync(x.file).toString("base64") +
            '"></div>',
        )
        .join("") +
      "</div>",
  );
  await g.screenshot({ path: file, fullPage: true });
  await g.close();
}
try {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1000 } });
  watch(p);
  await p.goto(root + "rifleman-lab.html?review=e-walk-keys");
  await p.waitForFunction(() => window.riflemanLabSnapshot);
  const before = [];
  for (let i = 0; i < 4; i++) {
    const s = await hold(p, "walk", i * 0.25),
      file = `${out}/frames/walk-before-${i}.png`;
    assert.equal(s.pose.status, "rejected");
    assert.equal(s.pose.supported, false);
    await bodyCapture(p, s, file);
    before.push({ file, label: `Before ${i + 1} · REJECTED` });
  }
  await p.screenshot({ path: out + "/lab-E-rejected-before.png" });
  await p.goto(root + "rifleman-lab.html");
  await p.waitForFunction(() => window.riflemanLabSnapshot);
  await p.locator("#lab-direction").selectOption("E");
  const after = [];
  for (const [action, times] of [
    ["walk", [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]],
    ["raise", [0, 0.16, 0.34, 0.52]],
    ["fire", [0, 0.06, 0.13, 0.25]],
    ["idle", [0, 0.8, 1.6, 2.4]],
    ["highReady", [0, 0.8, 1.6, 2.4]],
    ["aim", [0]],
    ["lower", [0, 0.19, 0.37, 0.55]],
  ]) {
    const shots = [];
    for (let i = 0; i < times.length; i++) {
      const s = await hold(p, action, times[i]),
        file = `${out}/frames/${action}-${i}.png`;
      assert.equal(s.pose.status, action === "walk" ? "prototype" : "verified");
      await bodyCapture(p, s, file);
      shots.push({ file, label: `${action} cel ${s.pose.frame}` });
      captures.push({ action, time: times[i], pose: s.pose, views: s.views });
      if (action === "walk")
        after.push({ file, label: `After ${i + 1} · PROTOTYPE` });
    }
    await gallery(
      p,
      `${out}/${action}-review.png`,
      `E ${action} · actual Phaser 4× captures`,
      shots,
    );
    await p.screenshot({ path: `${out}/lab-E-${action}.png` });
  }
  await gallery(
    p,
    out + "/E-walk-before-after.png",
    "E walk quality gate · old 4 keys REJECTED / new 8 cels PROTOTYPE (not approved)",
    [...before, ...after],
  );
  // Record real browser video of authored full-body clips. Walk is explicitly a prototype.
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1000 },
    recordVideo: {
      dir: "/tmp/aw-v035-art-video",
      size: { width: 1080, height: 1000 },
    },
  });
  const v = await context.newPage();
  watch(v);
  await v.goto(root + "rifleman-lab.html");
  await v.waitForFunction(() => window.riflemanLabSnapshot);
  await v.locator("#lab-direction").selectOption("E");
  const phases = [];
  for (const [action, ms] of [
    ["idle", 3300],
    ["highReady", 3300],
    ["raise", 900],
    ["aim", 900],
    ["fire", 2100],
    ["lower", 1000],
    ["walk", 2600],
  ]) {
    await v.locator("#lab-action").selectOption(action);
    await v.waitForTimeout(ms);
    phases.push({
      action,
      snapshot: await v.evaluate(() => riflemanLabSnapshot()),
    });
  }
  const video = v.video();
  await context.close();
  await video.saveAs("/tmp/aw-v035-art-video/production.webm");
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    "/tmp/aw-v035-art-video/production.webm",
    "-c:v",
    "libx264",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    out + "/E-full-body-playback.mp4",
  ]);
  console.log("Art playback and all cel captures saved");
  // Real battle: discover a narrow valid E firing window, never rotate or command a unit.
  await p.goto(root + "?seed=9&debug=1");
  await p.waitForFunction(() => window.awSnapshot);
  await p.locator("#prototype-art").selectOption("v035");
  await p.locator('[data-speed="4"]').click();
  await p.waitForFunction(
    () => awSnapshot().time >= 49,
    {},
    { timeout: 120000 },
  );
  await p.locator("#pause").click();
  await p.locator('[data-speed="1"]').click();
  await p.locator("#prototype-toggle").click();
  await p.locator("#prototype-toggle").click();
  const box = await p.locator("canvas").boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 9; i++) await p.mouse.wheel(0, -40);
  await p.waitForTimeout(200);
  let s = await p.evaluate(() => awSnapshot()),
    u = s.units[1],
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.mouse.move(
    x + box.width / 2 - u.screenX,
    y + box.height / 2 - u.screenY,
    { steps: 8 },
  );
  await p.mouse.up();
  const dir = "/tmp/aw-v035-e-live-video";
  mkdirSync(dir, { recursive: true });
  const frames = [],
    cdp = await p.context().newCDPSession(p);
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
  await p.locator("#pause").click();
  const samples = await p.evaluate(
    () =>
      new Promise((resolve) => {
        const a = [];
        function tick() {
          const s = awSnapshot();
          a.push({
            epoch: (performance.timeOrigin + performance.now()) / 1000,
            time: s.time,
            ai: s.units[1].state,
            active: s.prototype.active,
            east: s.prototype.east,
            live: s.prototype.live,
          });
          if (s.time >= 59) {
            document.querySelector("#pause").click();
            resolve(a);
          } else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }),
  );
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  assert.ok(
    samples.some(
      (s) => s.east.visible && s.east.animation === "firing" && s.east.shotId,
    ),
  );
  writeFileSync(
    dir + "/concat.txt",
    frames
      .map(
        (f, i) =>
          `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.epoch ?? f.epoch + 0.033) - f.epoch)}`,
      )
      .join("\n") + "\n",
  );
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    dir + "/concat.txt",
    "-vsync",
    "vfr",
    "-c:v",
    "libx264",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    out + "/live-E-combat.mp4",
  ]);
  // Replay to a real flash and compare renderers at exactly the same frozen battle tick.
  await p.goto(root + "?seed=9&debug=1");
  await p.waitForFunction(() => window.awSnapshot);
  await p.locator("#prototype-art").selectOption("v035");
  await p.locator('[data-speed="4"]').click();
  await p.evaluate(
    () =>
      new Promise((resolve) => {
        function tick() {
          const s = awSnapshot();
          if (s.prototype.east?.visible && s.prototype.east.flash) {
            document.querySelector("#pause").click();
            resolve();
          } else if (s.time > 150) throw Error("No real E flash found");
          else requestAnimationFrame(tick);
        }
        tick();
      }),
  );
  await p.locator("#prototype-toggle").click();
  await p.locator("#prototype-toggle").click();
  const combatBefore = await p.evaluate(() => awSnapshot());
  await p.screenshot({ path: out + "/live-E-firing-after.png" });
  await p.locator("#prototype-art").selectOption("v031");
  await p.waitForTimeout(180);
  await p.screenshot({ path: out + "/live-E-legacy-before.png" });
  assert.equal((await p.evaluate(() => awSnapshot())).time, combatBefore.time);
  await p.locator("#prototype-art").selectOption("v035");
  await p.waitForTimeout(150);
  const comparison = await p.evaluate(() => awSnapshot());
  assert.equal(comparison.prototype.active.renderer, "v035-e");
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  writeFileSync(
    out + "/live-playback.jsonl",
    samples.map((s) => JSON.stringify(s)).join("\n") + "\n",
  );
  writeFileSync(
    out + "/visual-evidence.json",
    JSON.stringify(
      {
        method:
          "Actual production Phaser. Native spectator UI only; no injected targets, poses, events or unit orders.",
        captures,
        phases,
        live: {
          seed: 9,
          variant: 1,
          spawn: 2,
          start: samples[0].time,
          end: samples.at(-1).time,
          videoFrames: frames.length,
          samples: samples.length,
          actualEShotIds: [
            ...new Set(
              samples
                .filter((s) => s.east.visible && s.east.shotId)
                .map((s) => s.east.shotId),
            ),
          ],
          states: [
            ...new Set(
              samples
                .filter((s) => s.east.visible)
                .map((s) => s.east.animation),
            ),
          ],
          comparison: comparison.prototype,
          comparisonTime: comparison.time,
        },
        errors,
        failed,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Actual E combat video, real shot IDs and same-tick legacy/new comparison saved",
    frames.length,
  );
} finally {
  await browser.close();
}
