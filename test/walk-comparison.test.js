import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WalkComparisonClock } from "../src/rifleman/walk-comparison.js";
import { walkComparisonLayout } from "../src/rifleman/lab-layout.js";
import { CATALOG, clipAvailability } from "../src/rifleman/catalog.js";
import { WALK_REVIEW } from "../src/rifleman/review.js";
test("one common loop samples real eight-frame and rejected four-frame banks in phase", () => {
  const c = new WalkComparisonClock(),
    newer = [],
    older = [];
  for (let i = 0; i < 8; i++) {
    const p = c.pose(),
      r = c.referencePose();
    newer.push(p.frame);
    older.push(r.frame);
    assert.equal(p.bank, "eWalk2");
    assert.equal(r.bank, WALK_REVIEW.bank);
    assert.equal(p.count, 8);
    assert.equal(r.count, 4);
    c.step();
  }
  assert.deepEqual(newer, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(older, [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(c.pose().frame, 0);
  assert.equal(c.referencePose().frame, 0);
});
test("pause, slow motion and speed controls preserve phase without hidden frame advancement", () => {
  const c = new WalkComparisonClock();
  c.speed = 0.25;
  c.advance(0.1);
  assert.equal(c.time, 0.025);
  c.playing = false;
  const s = c.snapshot();
  c.advance(0.1);
  assert.deepEqual(c.snapshot(), s);
  c.playing = true;
  c.speed = 4;
  c.advance(0.1);
  assert.equal(c.time, 0.42500000000000004);
  c.step();
  assert.equal(c.playing, false);
  assert.equal(c.pose().frame, 4);
  c.seek(0);
  assert.equal(c.pose().frame, 0);
});
test("comparison cannot relabel or admit rejected or prototype art", () => {
  const c = new WalkComparisonClock();
  assert.equal(c.pose().status, "prototype");
  assert.equal(c.referencePose().status, "rejected");
  assert.equal(c.referencePose().admitted, false);
  assert.equal(c.snapshot().liveCombatAdmission, false);
  assert.notEqual(clipAvailability("E", "walk").clip.liveApproved, true);
  assert.equal(c.setDirection("SE"), false);
  assert.equal(c.select("fire"), false);
  assert.equal(c.direction, "E");
  assert.equal(c.action, "walk");
});
test("every original gait cel fits both side-by-side columns at 39px and 4x on narrow phones", () => {
  for (const width of [280, 304, 372, 818, 1080]) {
    const l = walkComparisonLayout(width, 39);
    assert.equal(l.stacked, false);
    for (const [selected, a] of [
      [true, CATALOG.banks.eWalk2],
      [false, WALK_REVIEW.asset],
    ]) {
      const d = JSON.parse(readFileSync("public/" + a.metadata));
      for (const actual of [true, false]) {
        const v = l.points[actual ? (selected ? 0 : 1) : selected ? 2 : 3],
          s = (39 / d.nativeStandingHeight) * (actual ? 1 : 4);
        for (const f of d.frames) {
          assert.ok(v.x + (f.bounds[0] - f.footAnchor[0]) * s >= 0);
          assert.ok(v.x + (f.bounds[2] - f.footAnchor[0]) * s <= width);
          assert.ok(v.y + (f.bounds[1] - f.footAnchor[1]) * s >= 0);
          assert.ok(v.y + (f.bounds[3] - f.footAnchor[1]) * s <= l.height);
        }
      }
    }
  }
});
test("public preview embeds exact existing PNGs rather than another rendered video or altered atlas", () => {
  const source = readFileSync("previews/v035-e-walk.svg", "utf8");
  const pngs = [
    ...source.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g),
  ].map((m) => Buffer.from(m[1], "base64"));
  assert.equal(pngs.length, 2);
  assert.ok(
    pngs[0].equals(readFileSync("public/" + CATALOG.banks.eWalk2.image)),
  );
  assert.ok(pngs[1].equals(readFileSync("public/" + WALK_REVIEW.asset.image)));
  assert.ok(!source.includes(".mp4"));
  assert.ok(!source.includes("https://"));
});
