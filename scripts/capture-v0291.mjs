const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { expandedWorld } from "../src/expanded-world.js";
import { buildingOccludes } from "../src/environment-cache.js";
import { projection } from "../src/view.js";
const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  }),
  errors = [],
  records = [];
const project = projection(54, 44).project;
async function focus(p, x, y, zoom = 1.8) {
  const canvas = await p.locator("canvas").boundingBox(),
    cx = canvas.x + canvas.width / 2,
    cy = canvas.y + canvas.height / 2;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  await p.mouse.move(cx + 12, cy, { steps: 2 });
  await p.mouse.up();
  for (let i = 0; i < 18; i++) {
    const s = await p.evaluate(() => window.awSnapshot());
    if (Math.abs(s.view.zoom - zoom) < 0.08) break;
    await p.mouse.wheel(0, s.view.zoom < zoom ? -100 : 100);
    await p.waitForTimeout(30);
  }
  for (let i = 0; i < 18; i++) {
    const s = await p.evaluate(() => window.awSnapshot()),
      goal = project(x, y),
      dx = (s.view.x + s.view.width / 2 - goal.x) * s.view.zoom,
      dy = (s.view.y + s.view.height / 2 - goal.y) * s.view.zoom;
    if (Math.abs(dx) + Math.abs(dy) < 5) break;
    await p.mouse.move(cx, cy);
    await p.mouse.down();
    await p.mouse.move(
      cx + Math.max(-canvas.width * 0.6, Math.min(canvas.width * 0.6, dx)),
      cy + Math.max(-canvas.height * 0.6, Math.min(canvas.height * 0.6, dy)),
      { steps: 3 },
    );
    await p.mouse.up();
    await p.waitForTimeout(30);
  }
}
try {
  const p = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(
    "http://127.0.0.1:4209/annous-warfare/?seed=2049&layout=0&spawn=0&debug=1",
  );
  await p.waitForFunction(() => window.awSnapshot);
  await p.getByRole("button", { name: "일시정지", exact: true }).click();
  if (!process.argv.includes("--combat-only"))
    for (const [name, x, y] of [
      ["architecture", 9, 10],
      ["cover-sandbags", 8, 14],
      ["cover-concrete", 33, 28],
      ["cover-vehicle", 16, 8.5],
      ["cover-crates", 12, 22],
      ["cover-vertical", 14, 21],
      ["intersection", 14, 14],
    ]) {
      await focus(p, x, y);
      await p.waitForTimeout(150);
      await p.screenshot({ path: `reports/v0291-${name}.png` });
      records.push({
        name,
        target: [x, y],
        snapshot: await p.evaluate(() => window.awSnapshot()),
      });
    }
  await p.goto(
    "http://127.0.0.1:4209/annous-warfare/?seed=2049&layout=0&spawn=0&debug=1",
  );
  await p.waitForFunction(() => window.awSnapshot);
  await p.locator('[data-speed="4"]').click();
  const detected = await p.waitForFunction(
    () => window.awSnapshot().units.find((u) => u.flash),
    {},
    { timeout: 30000 },
  );
  const firingId = await detected.evaluate((u) => u.id);
  await p.getByRole("button", { name: "일시정지", exact: true }).click();
  let s = await p.evaluate(() => window.awSnapshot()),
    u = s.units.find((u) => u.id === firingId);
  assert.ok(u);
  await focus(p, u.renderX, u.renderY, 1.8);
  await p.screenshot({ path: "reports/v0291-fighting.png" });
  records.push({
    name: "fighting",
    snapshot: await p.evaluate(() => window.awSnapshot()),
  });
  await p.close();
  const m = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  m.on("pageerror", (e) => errors.push(e.message));
  await m.goto(
    "http://127.0.0.1:4209/annous-warfare/?seed=2049&layout=0&spawn=0&debug=1",
  );
  await m.waitForFunction(() => window.awSnapshot);
  await m.locator('[data-speed="4"]').tap();
  let target;
  const houses = expandedWorld(0).houses;
  for (let i = 0; i < 180; i++) {
    s = await m.evaluate(() => window.awSnapshot());
    target = s.units.find(
      (u) =>
        u.active &&
        houses.some((h) =>
          buildingOccludes(h, { x: u.renderX, y: u.renderY }, project),
        ),
    );
    if (target) break;
    await m.waitForTimeout(120);
  }
  assert.ok(target, "natural building occlusion opportunity");
  await m.getByRole("button", { name: "일시정지", exact: true }).tap();
  await focus(m, target.renderX, target.renderY, 1);
  await m.waitForTimeout(150);
  s = await m.evaluate(() => window.awSnapshot());
  u = s.units.find((u) => u.id === target.id);
  const box = await m.locator("canvas").boundingBox();
  await m.touchscreen.tap(box.x + u.screenX, box.y + u.screenY);
  await m.waitForTimeout(300);
  s = await m.evaluate(() => window.awSnapshot());
  assert.equal(s.selected, target.id);
  assert.equal(s.environmentCache.obscured, true);
  await m.screenshot({ path: "reports/v0291-mobile-selected.png" });
  records.push({ name: "mobile-selected", snapshot: s });
  assert.deepEqual(errors, []);
  writeFileSync(
    "reports/v0291-visual-qa.json",
    JSON.stringify(
      {
        method:
          "actual production game via camera/UI only; no soldier, terrain or state injection",
        errors,
        records,
      },
      null,
      2,
    ) + "\n",
  );
  await m.close();
} finally {
  await browser.close();
}
