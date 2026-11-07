// Capture the production preview before/after the a920240 proportion pass.
// Baseline files are read from Git without switching or modifying the checkout.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CLIPS } from "../src/usmc-se-animation.js";
const { chromium } = await import(process.env.AW_PLAYWRIGHT_MODULE || "playwright");
const out = "reports/v033-correction";
const base = "a920240";
const root = "public/assets/usmc-se-v033/";
const before = Object.fromEntries(["source-atlas.png", "metadata.json"].map(name =>
  [name, execFileSync("git", ["show", `${base}:${root}${name}`], { maxBuffer: 8e6 })]));
const after = JSON.parse(readFileSync(root + "metadata.json"));
const old = JSON.parse(before["metadata.json"]);
const hash = data => createHash("sha256").update(data).digest("hex");
assert.equal(hash(before["source-atlas.png"]), after.revisionBaseSha256);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.AW_CHROMIUM || "/usr/bin/chromium",
  headless: true, args: ["--no-sandbox"],
});
const errors = [], failed = [], records = [], captures = {}, pixelChecks = {};
const poses = Object.entries(CLIPS).flatMap(([mode, clip]) => {
  let elapsed = 0;
  return clip.frames.map((frame, index) => {
    const time = elapsed + Math.min(0.02, clip.durations[index] / 2);
    elapsed += clip.durations[index];
    return { mode, frame, index, time };
  });
}).filter((p, i, all) => all.findIndex(q => q.frame === p.frame) === i);
assert.equal(poses.length, 24);
const url = "http://127.0.0.1:4233/annous-warfare/animation-preview.html";
try {
  for (const revision of ["before", "after"]) {
    const page = await browser.newPage({ viewport: { width: 980, height: 950 } });
    page.on("pageerror", e => errors.push(e.message));
    page.on("requestfailed", r => failed.push(r.url()));
    if (revision === "before") {
      await page.route("**/assets/usmc-se-v033/*", route => {
        const name = new URL(route.request().url()).pathname.split("/").at(-1);
        assert.ok(before[name], `unexpected baseline request: ${name}`);
        return route.fulfill({ body: before[name],
          contentType: name.endsWith(".png") ? "image/png" : "application/json" });
      });
    }
    await page.goto(url);
    await page.waitForFunction(() => window.sePreviewSnapshot);
    // Validate actual decoded PNG pixels, rather than trusting metadata bounds.
    const pixels = await page.evaluate(async ({ meta }) => {
      const img = new Image();
      img.src = "assets/usmc-se-v033/source-atlas.png";
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return { width: c.width, height: c.height, frames: meta.frames.map(f => {
        const data = ctx.getImageData(f.cell[0] * 256, f.cell[1] * 256, 256, 256).data;
        let left = 256, top = 256, right = -1, bottom = -1, solid = 0, edgeAlpha = 0;
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
          const a = data[(y * 256 + x) * 4 + 3];
          if (x === 0 || x === 255 || y === 0 || y === 255) edgeAlpha = Math.max(edgeAlpha, a);
          if (a < 128) continue;
          solid++; left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        const [mx, my] = f.muzzle.map(Math.round);
        const regions = Object.fromEntries(Object.entries({
          headHelmet: [110, 40, 165, 85], upperBody: [90, 85, 160, 155], lowerBody: [85, 155, 180, 250],
        }).map(([name, [x0, y0, x1, y1]]) => {
          let digest = 2166136261;
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            // Include visible pixels only; ignore RGB in fully transparent areas.
            const i = (y * 256 + x) * 4;
            for (let channel = 0; channel < 4; channel++)
              digest = Math.imul(digest ^ (data[i + 3] ? data[i + channel] : 0), 16777619) >>> 0;
          }
          return [name, digest.toString(16)];
        }));
        return { frame: f.index, bounds: [left, top, right + 1, bottom + 1], solid, regions,
          edgeAlpha, muzzleAlpha: data[(my * 256 + mx) * 4 + 3] };
      }) };
    }, { meta: revision === "before" ? old : after });
    assert.deepEqual([pixels.width, pixels.height], [1024, 1536]);
    if (revision === "after") for (const f of pixels.frames) {
      assert.deepEqual(f.bounds, after.frames[f.frame].bounds);
      assert.ok(f.edgeAlpha < 16, `visible cell edge: ${f.frame}`);
      assert.ok(f.solid > 6000, `missing body: ${f.frame}`);
      assert.ok(f.muzzleAlpha >= 128, `muzzle off weapon: ${f.frame}`);
    }
    pixelChecks[revision] = pixels;
    captures[revision] = {};
    for (const pose of poses) {
      // Clear the prior preview shot cue, then select/seek atomically so a
      // briefly playing frame cannot leave a frozen flash on a recovery cel.
      await page.evaluate(async () => {
        document.querySelector('[data-clip="idle"]').click();
        const slider = document.querySelector("#preview-time");
        slider.value = 0; slider.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      await page.evaluate(({ mode, time }) => {
        document.querySelector(`[data-clip="${mode}"]`).click();
        const slider = document.querySelector("#preview-time");
        slider.value = time; slider.dispatchEvent(new Event("input", { bubbles: true }));
      }, pose);
      await page.waitForFunction(frame => {
        const s = window.sePreviewSnapshot();
        return !s.playing && s.views.every(v => v.frame === frame);
      }, pose.frame);
      const s = await page.evaluate(() => window.sePreviewSnapshot());
      assert.equal(s.pose.frame, pose.frame);
      const meta = revision === "before" ? old : after;
      for (const v of s.views) {
        assert.equal(v.scale, v.scaleY);
        assert.equal(v.rotation, 0);
        assert.ok(v.bounds.left >= 0 && v.bounds.right <= s.canvas.width);
        assert.ok(v.bounds.top >= 0 && v.bounds.bottom <= s.canvas.height);
        if (v.bank === "v033") assert.ok(Math.abs(v.scale * meta.nativeStandingHeight - (v.actual ? 39 : 156)) < 1e-9);
      }
      const box = await page.locator("canvas").boundingBox();
      const view = s.views.find(v => v.bank === "v033" && !v.actual);
      const actual = s.views.find(v => v.bank === "v033" && v.actual);
      const detail = await page.screenshot({ clip: {
        x: box.x + view.x - 105, y: box.y + view.y - 175, width: 210, height: 190 } });
      const game = await page.screenshot({ clip: {
        x: box.x + actual.x - 40, y: box.y + actual.y - 45, width: 80, height: 52 } });
      captures[revision][pose.frame] = { detail: detail.toString("base64"), game: game.toString("base64") };
      if (revision === "after" && [0, 4, 15, 16, 17, 23].includes(pose.frame))
        await page.screenshot({ path: `${out}/production-frame-${pose.frame + 1}.png` });
      records.push({ revision, ...pose, snapshot: s });
    }
    writeFileSync(`${out}/${revision}-pixels.json`, JSON.stringify(pixels, null, 2) + "\n");
    await page.close();
  }
  for (let frame = 0; frame < 24; frame++)
    for (const region of ["headHelmet", "upperBody", "lowerBody"])
      assert.notEqual(pixelChecks.before.frames[frame].regions[region], pixelChecks.after.frames[frame].regions[region],
        `unchanged ${region} region in cel ${frame}`);
  // Compose only unretouched browser crops, at their captured pixel size.
  const sheet = await browser.newPage({ viewport: { width: 1352, height: 720 }, deviceScaleFactor: 1 });
  const card = p => `<section><h2>${p.frame + 1}/24 · ${p.mode}</h2><div class="pair">${["before", "after"].map(r =>
    `<div><h3>${r === "before" ? "Before · a920240" : "Corrected"}</h3><img width="210" height="190" src="data:image/png;base64,${captures[r][p.frame].detail}"><div class="actual">39px <img width="80" height="52" src="data:image/png;base64,${captures[r][p.frame].game}"></div></div>`).join("")}</div></section>`;
  const html = list => `<!doctype html><html lang="en"><meta charset="utf-8"><title>SE proportion correction</title><style>
    *{box-sizing:border-box}body{margin:0;padding:16px;background:#14212a;color:#e0e8ec;font:14px system-ui}
    h1{font-size:22px;margin:0 0 6px}p{margin:0 0 16px;color:#b6c5cb}.grid{display:grid;grid-template-columns:repeat(3,432px);gap:12px}
    section{background:#1c2b34;border:1px solid #50616a}h2{font-size:14px;margin:10px}h3{font-size:12px;font-weight:400;margin:0 0 5px;text-align:center;color:#b6c5cb}
    .pair{display:flex;justify-content:center;gap:4px}img{display:block}.actual{display:flex;align-items:center;justify-content:center;color:#b6c5cb;font-size:11px}
    </style><h1>SE proportion correction · all figures at equal display height</h1><p>Left: v0.3.3 at a920240. Right: corrected v0.3.3. 4× detail and native 39px. Actual production preview crops, same held cel; no rescaling or retouching.</p><div class="grid">${list.map(card).join("")}</div></html>`;
  for (const [name, list] of [["all-24-frames", [...poses].sort((a, b) => a.frame - b.frame)],
    ["key-poses", poses.filter(p => [0, 4, 15, 16, 17, 23].includes(p.frame))]]) {
    await sheet.setContent(html(list));
    await sheet.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
    await sheet.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  writeFileSync(`${out}/frames.json`, JSON.stringify({ baseline: base,
    method: "Production preview, baseline PNG/metadata routed from git show a920240; same 39px/4x, phase/time-slider seeks. Browser screenshots only.",
    assetSha256: hash(readFileSync(root + "source-atlas.png")), records, errors, failed }, null, 2) + "\n");
  console.log("Captured and checked all 24 cels before/after; no page errors or failed requests.");
} finally { await browser.close(); }
