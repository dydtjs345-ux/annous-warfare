const { chromium } = await import(
  process.env.AW_PLAYWRIGHT_MODULE || "playwright"
);
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const records = [],
  errors = [],
  failed = [];
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("requestfailed", (r) => failed.push(r.url()));
  await p.goto(
    "http://127.0.0.1:4209/annous-warfare/?seed=2049&layout=0&spawn=0&debug=1",
  );
  await p.waitForFunction(() => window.awSnapshot);
  await p.getByRole("button", { name: "일시정지", exact: true }).click();
  let s = await p.evaluate(() => window.awSnapshot()),
    u = s.units.find((u) => u.id === 1),
    box = await p.locator("canvas").boundingBox();
  await p.mouse.click(box.x + u.screenX, box.y + u.screenY);
  await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => window.awSnapshot().selected), 1);
  await p.screenshot({ path: "reports/v031-existing.png" });
  const time = await p.evaluate(() => window.awSnapshot().time);
  await p.locator("#prototype-toggle").click();
  for (const art of ["v030", "v031"])
    for (const size of ["1", "1.3", "1.5"]) {
      await p.locator("#prototype-art").selectOption(art);
      await p.locator("#prototype-scale").selectOption(size);
      await p.waitForTimeout(150);
      s = await p.evaluate(() => window.awSnapshot());
      assert.equal(s.time, time);
      assert.equal(s.prototype.enabled, true);
      assert.equal(s.prototype.scale, Number(size));
      assert.equal(s.prototype.state.eligible, true);
      await p.screenshot({ path: `reports/v031-${art}-scale-${size}.png` });
      records.push({
        art,
        size,
        canvas: await p.locator("canvas").boundingBox(),
        snapshot: s,
      });
    }
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  writeFileSync(
    "reports/v031-comparison.json",
    JSON.stringify(
      {
        method:
          "stock, v030 and v031 on same paused production battlefield, seed 2049 layout0 spawn0; renderer-only UI toggle and scale",
        errors,
        failed,
        records,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await b.close();
}
