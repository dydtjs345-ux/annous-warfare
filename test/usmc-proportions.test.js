import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  proportionLayout,
  proportionFigure,
} from "../src/usmc-proportion-view.js";
const oldRoot = "public/assets/usmc-se-v032/",
  root = "public/assets/usmc-se-v033/",
  designs = [oldRoot, root].map((p) =>
    JSON.parse(readFileSync(p + "metadata.json")),
  );
test("refined SE atlas retains 24 complete registered cells and the exact v032 comparison source", () => {
  const d = designs[1],
    png = readFileSync(root + "source-atlas.png");
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(png[25], 6);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1024, 1536]);
  assert.equal(d.direction, "SE");
  assert.equal(d.frames.length, 24);
  assert.equal(
    d.sourceBaseSha256,
    createHash("sha256")
      .update(readFileSync(oldRoot + "source-atlas.png"))
      .digest("hex"),
  );
  for (let i = 0; i < 24; i++) {
    const f = d.frames[i];
    assert.equal(f.index, i);
    assert.deepEqual(f.cell, [i % 4, Math.floor(i / 4)]);
    assert.deepEqual(f.footAnchor, [132, 247]);
    assert.ok(
      f.bounds[0] > 0 &&
        f.bounds[1] > 0 &&
        f.bounds[2] < 256 &&
        f.bounds[3] < 256,
    );
    assert.ok(f.muzzle.every((n) => n > 0 && n < 256));
  }
});
test("39px/4x comparisons fit side by side on iPhone and large magnifications stack safely", () => {
  const fit = proportionLayout(364, 39, 4, designs);
  assert.equal(fit.stacked, false);
  assert.equal(fit.detail[0].y, fit.detail[1].y);
  assert.equal(proportionLayout(364, 45, 6, designs).stacked, true);
  for (const width of [304, 364, 818, 956])
    for (const size of [30, 39, 45])
      for (const zoom of [2, 4, 6]) {
        const layout = proportionLayout(width, size, zoom, designs);
        for (let bank = 0; bank < 2; bank++)
          for (let frame = 0; frame < 24; frame++) {
            const p = proportionFigure(
              designs[bank],
              frame,
              layout.detail[bank],
              size,
              zoom,
            );
            assert.ok(
              p.bounds.left >= 0 && p.bounds.right <= width,
              `${width}/${size}/${zoom}/${bank}/${frame}: horizontal clip`,
            );
            assert.ok(
              p.bounds.top > 210 && p.bounds.bottom < layout.height,
              `${width}/${size}/${zoom}/${bank}/${frame}: vertical clip`,
            );
          }
      }
});
test("both versions share a ground origin, frame and nominal height without anisotropic body scaling", () => {
  const layout = proportionLayout(956, 39, 4, designs);
  for (let frame = 0; frame < 24; frame++)
    for (let bank = 0; bank < 2; bank++) {
      const d = designs[bank],
        p = proportionFigure(d, frame, layout.detail[bank], 39, 4);
      assert.equal(p.y, layout.detail[0].y);
      assert.equal(p.frame, frame);
      assert.ok(Math.abs(p.scale * d.nativeStandingHeight - 156) < 1e-10);
      assert.equal(p.originY, d.frames[frame].footAnchor[1] / 256);
      assert.ok(p.muzzle.x >= p.bounds.left && p.muzzle.x <= p.bounds.right);
    }
});
