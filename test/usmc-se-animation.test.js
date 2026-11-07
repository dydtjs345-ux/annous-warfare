import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLIPS,
  DEMO,
  DEMO_DURATION,
  demoPose,
  clipFrame,
  clipDuration,
  SEPreviewClock,
  previewTravel,
  shotCuesBetween,
} from "../src/usmc-se-animation.js";
const root = "public/assets/usmc-se-v032/",
  meta = JSON.parse(readFileSync(root + "metadata.json"));
test("SE original atlas has complete bodies, transparent RGBA and a consistent source/foot pivot", () => {
  const png = readFileSync(root + "source-atlas.png");
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(png[25], 6);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1024, 1536]);
  assert.equal(meta.direction, "SE");
  assert.equal(meta.frames.length, 24);
  assert.deepEqual(meta.frameSize, [256, 256]);
  for (const f of meta.frames) {
    assert.deepEqual(f.footAnchor, [132, 241]);
    assert.ok(
      f.bounds[0] > 0 &&
        f.bounds[1] > 0 &&
        f.bounds[2] < 256 &&
        f.bounds[3] < 256,
      "no clipped cel silhouette",
    );
    assert.ok(f.muzzle.every((n) => n > 0 && n < 256));
  }
  assert.deepEqual(
    [...new Set(Object.values(CLIPS).flatMap((c) => c.frames))].sort(
      (a, b) => a - b,
    ),
    Array.from({ length: 24 }, (_, i) => i),
  );
});
test("complete demo reaches all ordered phases and only two preview shot cues", () => {
  const stages = [];
  let shots = 0,
    wasFlash = false;
  for (let t = 0; t < DEMO_DURATION; t += 0.005) {
    const p = demoPose(t);
    if (stages.at(-1) !== p.stage) stages.push(p.stage);
    if (p.flash && !wasFlash) shots++;
    wasFlash = p.flash;
    if (p.flash) {
      assert.equal(p.clip, "fire");
      assert.equal(p.frame, 17);
    }
  }
  assert.deepEqual(
    stages,
    DEMO.map((_, i) => i),
  );
  assert.equal(shots, 2);
  assert.equal(demoPose(DEMO_DURATION).clip, "idle");
});
test("pause freezes the complete pose and 1x/2x/4x render grouping stays frame-equivalent", () => {
  const results = [];
  for (const speed of [1, 2, 4]) {
    const c = new SEPreviewClock();
    c.select("walk");
    c.speed = speed;
    for (let n = 0; n < 120 / speed; n++) c.advance(1 / 120);
    results.push(c.pose().frame);
    c.playing = false;
    const frozen = structuredClone(c.pose()),
      time = c.time;
    for (let n = 0; n < 20; n++) c.advance(0.1);
    assert.deepEqual(c.pose(), frozen);
    assert.equal(c.time, time);
  }
  assert.deepEqual(results, [4, 4, 4]);
});
test("raise/lower keep the entire terminal pose and never snap back when held", () => {
  for (const clip of ["raise", "lower"]) {
    assert.equal(clipFrame(clip, 100).frame, CLIPS[clip].frames.at(-1));
    const c = new SEPreviewClock();
    c.select(clip);
    for (let n = 0; n < 200; n++) c.advance(0.1);
    assert.equal(c.time, clipDuration(clip));
    const p = c.pose();
    c.step();
    assert.deepEqual(c.pose(), p);
  }
});
test("frame stepping preserves short recoil cels and does not invent motion in held aim", () => {
  const c = new SEPreviewClock();
  c.select("fire");
  assert.equal(c.pose().frame, 17);
  assert.equal(c.step().frame, 18);
  assert.equal(c.step().frame, 19);
  assert.equal(c.step().frame, 16);
  assert.equal(c.playing, false);
  c.select("aim");
  const time = c.time;
  c.step();
  assert.equal(c.time, time);
  assert.equal(c.pose().flash, false);
});
test("low-ready and raising/lowering frames cannot show firing flashes", () => {
  for (const mode of ["idle", "walk", "raise", "aim", "lower"])
    for (let t = 0; t < 3; t += 0.01)
      assert.equal(demoPose(t, mode).flash, false);
  const c = new SEPreviewClock();
  c.select("unknown");
  assert.equal(c.mode, "demo");
  assert.equal(c.seek(-2).frame, 0);
});
test("camera-tracked travel is derived from the pose clock without seek or pause drift", () => {
  assert.equal(previewTravel(1.4), 0);
  assert.equal(previewTravel(5.4), 360);
  assert.equal(previewTravel(9), 360);
  assert.equal(previewTravel(DEMO_DURATION + 5.4), 720);
  assert.equal(previewTravel(0.5, "walk"), 45);
  assert.equal(previewTravel(100, "aim"), 0);
  const c = new SEPreviewClock();
  c.select("walk");
  c.seek(0.5);
  const a = previewTravel(c.time, c.mode);
  c.playing = false;
  c.advance(0.1);
  assert.equal(previewTravel(c.time, c.mode), a);
  c.seek(0.2);
  c.seek(0.5);
  assert.equal(previewTravel(c.time, c.mode), a);
});
test("short shot cues survive 1x/2x/4x rendering without changing the body clip", () => {
  for (const speed of [1, 2, 4]) {
    let count = 0,
      from = -1e-8;
    for (let t = 0; t < DEMO_DURATION; t += speed / 60) {
      count += shotCuesBetween(from, t, "demo").length;
      from = t;
    }
    assert.equal(count, 2);
  }
  assert.deepEqual(shotCuesBetween(-1e-8, 0.0667, "fire"), [0]);
  assert.deepEqual(shotCuesBetween(0.1, 0.1, "fire"), []);
  assert.deepEqual(shotCuesBetween(0, 100, "walk"), []);
});
