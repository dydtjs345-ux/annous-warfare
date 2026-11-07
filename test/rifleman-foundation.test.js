import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATALOG,
  DIRECTIONS,
  ACTIONS,
  clipAvailability,
  completionMatrix,
  assertClip,
} from "../src/rifleman/catalog.js";
import {
  FoundationClock,
  sampleClip,
  clipSeconds,
  sequenceSeconds,
} from "../src/rifleman/clock.js";
import {
  resolveRequest,
  composeRegisteredPair,
  RiflemanIntent,
} from "../src/rifleman/rig.js";
import { Battle } from "../src/simulation.js";
test("eight-direction inventory distinguishes prototypes from missing art without automatic combat admission", () => {
  assert.deepEqual(DIRECTIONS, ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  assert.equal(CATALOG.autoAdmitToCombat, false);
  const statuses = completionMatrix().flatMap((r) =>
    Object.values(r.directions),
  );
  assert.equal(statuses.filter((s) => s === "verified").length, 0);
  assert.equal(statuses.filter((s) => s === "prototype").length, 10);
  assert.equal(statuses.filter((s) => s === "missing").length, 46);
  assert.ok(!clipAvailability("SE", "highReady").supported);
  assert.ok(!clipAvailability("N", "aim").supported);
  assert.throws(() => {
    CATALOG.directions.SE.bank = "fake";
  }, TypeError);
});
test("available clips fit the real PNG grids and share measured ground/height metadata", () => {
  for (const [bank, d] of Object.entries(CATALOG.banks)) {
    const png = readFileSync("public/" + d.image),
      m = JSON.parse(readFileSync("public/" + d.metadata));
    assert.equal(png.readUInt32BE(16), d.grid[0] * d.frameSize[0]);
    assert.equal(png.readUInt32BE(20), d.grid[1] * d.frameSize[1]);
    assert.equal(m.nativeStandingHeight, d.nativeStandingHeight);
    for (const f of m.frames) {
      assert.equal(f.footAnchor.length, 2);
      assert.ok(f.bounds[0] >= 0 && f.bounds[1] >= 0);
      assert.ok(f.bounds[2] <= d.frameSize[0] && f.bounds[3] <= d.frameSize[1]);
    }
    for (const dir of Object.values(CATALOG.directions).filter(
      (q) => q.bank === bank,
    ))
      for (const c of Object.values(dir.clips))
        if (c.frames) assertClip(c, m.frames.length);
  }
  assert.throws(() => assertClip({ frames: [999], durations: [0.1] }, 24));
  assert.throws(() => assertClip({ frames: [0], durations: [0] }, 24));
});
test("SE frame stepping visits every gait cel and nonlooping raises hold their endpoint", () => {
  const c = new FoundationClock();
  c.select("walk");
  const frames = new Set();
  for (let i = 0; i < 8; i++) {
    frames.add(c.pose().frame);
    c.step();
  }
  assert.deepEqual([...frames], [4, 5, 6, 7, 8, 9, 10, 11]);
  c.select("raise");
  assert.equal(c.pose().frame, 12);
  for (let i = 0; i < 6; i++) c.step();
  assert.equal(c.pose().frame, 15);
  const t = c.time;
  c.step();
  assert.equal(c.time, t);
  assert.equal(c.playing, false);
});
test("a missing E sequence never cuts four static poses together to impersonate movement", () => {
  const c = new FoundationClock();
  c.setDirection("E");
  for (let i = 0; i < 100; i++) {
    const p = c.advance(0.1);
    assert.equal(p.supported, false);
    assert.equal(p.frame, null);
  }
  c.select("walk");
  assert.equal(c.pose().supported, false);
  c.select("idle");
  assert.equal(c.pose().count, 1);
  c.advance(0.1);
  assert.equal(c.pose().frame, 0);
  assert.match(c.pose().reason, /호흡 움직임 없음/);
  c.select("highReady");
  assert.equal(c.pose().frame, 2);
});
test("reference sampling does not change chosen direction and no missing view falls back to SE", () => {
  const c = new FoundationClock();
  c.select("walk");
  c.seek(0.31);
  c.setDirection("NW");
  assert.equal(c.pose().supported, false);
  assert.equal(c.pose().bank, null);
  const before = JSON.stringify(c.snapshot());
  assert.equal(c.pose("SE").supported, true);
  assert.equal(JSON.stringify(c.snapshot()), before);
  c.setDirection("SE");
  assert.equal(c.pose().frame, 6);
});
test("playback pause, seeking, slow motion and 1x/2x/4x have stable cel timing", () => {
  for (const speed of [0.1, 0.25, 0.5, 1, 2, 4]) {
    const c = new FoundationClock();
    c.select("walk");
    c.speed = speed;
    for (let i = 0; i < 10; i++) c.advance(0.05);
    assert.ok(Math.abs(c.time - 0.5 * speed) < 1e-8);
    c.playing = false;
    const p = c.snapshot();
    c.advance(0.1);
    assert.deepEqual(c.snapshot(), p);
    c.seek(Infinity);
    assert.equal(c.time, 0);
    c.seek(-5);
    assert.equal(c.time, 0);
  }
  const c = new FoundationClock();
  c.seek(sequenceSeconds);
  assert.equal(c.pose().stage, 0);
  assert.equal(sampleClip(CATALOG.directions.SE.clips.raise, 100).frame, 15);
});
test("actual pose graph uses full-body raise/lower cels and preserves progress when interrupted", () => {
  const a = new RiflemanIntent();
  a.request({ weapon: "aim" });
  assert.equal(a.plan().frame, 12);
  a.advance(0.2);
  assert.equal(a.plan().frame, 13);
  const before = a.amount;
  a.request({ weapon: "lowReady" });
  assert.equal(a.transition.from, before);
  a.advance(0.1);
  assert.ok(a.amount < before);
  a.advance(1);
  assert.equal(a.amount, 0);
  a.request({ weapon: "aim" });
  a.advance(1);
  assert.equal(a.plan().frame, 16);
  a.request({ weapon: "lowReady" });
  a.advance(1);
  assert.equal(a.plan().frame, 0);
});
test("component clocks survive weapon requests while unpainted moving-aim combinations are refused", () => {
  const a = new RiflemanIntent();
  a.request({ locomotion: "walk" });
  a.advance(0.2);
  const t = a.lowerTime;
  a.request({ weapon: "aim" });
  assert.equal(a.lowerTime, t);
  assert.equal(a.plan().supported, false);
  a.advance(0.1);
  assert.ok(a.lowerTime > t);
  a.request({ locomotion: "idle" });
  assert.equal(a.plan().supported, true);
  const p = a.plan();
  assert.equal(p.rotation, 0);
  assert.equal(p.flipX, false);
  assert.equal(p.weaponIntegrated, true);
});
test("static E aiming does not imply an authored raise/turn or high-ready transition", () => {
  const a = new RiflemanIntent(CATALOG, "E");
  assert.equal(a.plan().supported, true);
  a.request({ weapon: "aim" });
  assert.equal(a.plan().supported, false);
  assert.match(a.plan().reason, /연결 셀 없음/);
  a.request({ weapon: "lowReady" });
  assert.equal(a.plan().supported, true);
  a.request({ weapon: "highReady" });
  assert.equal(a.plan().supported, false);
  const b = new RiflemanIntent();
  b.request({ aimDirection: "E", movementDirection: "E" });
  assert.equal(b.plan().supported, false);
  assert.match(b.plan().reason, /방향 전환/);
});
test("independent movement/aim directions remain intact and require an explicitly reviewed art pair", () => {
  const r = {
      locomotion: "walk",
      weapon: "aim",
      movementDirection: "SE",
      aimDirection: "NE",
    },
    text = JSON.stringify(r);
  assert.equal(resolveRequest(r).supported, false);
  assert.equal(JSON.stringify(r), text);
  const key = "SE:NE:walk:aim",
    pair = { quality: "verified", id: key };
  const c = { ...CATALOG, pairs: { [key]: pair } };
  assert.equal(resolveRequest(r, 0.4, 0.2, c).kind, "registered-pair");
  assert.equal(resolveRequest(r, 0.4, 0.2, c).request.aimDirection, "NE");
});
function layers() {
  const pair = {
    quality: "verified",
    lowerBank: "l",
    upperBank: "u",
    movementDirection: "SE",
    aimDirection: "NE",
  };
  const lower = {
    bank: "l",
    direction: "SE",
    kind: "lower-body",
    nativeStandingHeight: 200,
    frame: {
      index: 0,
      footAnchor: [100, 200],
      sockets: { pelvis: [100, 120] },
    },
  };
  const upper = {
    bank: "u",
    direction: "NE",
    kind: "upper-with-arms-and-weapon",
    weaponIntegrated: true,
    nativeStandingHeight: 200,
    frame: {
      index: 0,
      muzzle: [160, 90],
      sockets: {
        pelvis: [100, 120],
        shoulder: [100, 70],
        stock: [103, 70],
        triggerHand: [110, 85],
        supportHand: [130, 86],
      },
    },
  };
  return { pair, lower, upper };
}
test("registered layered geometry joins measured pelvis sockets without rotating weapon-only parts", () => {
  const x = layers(),
    before = JSON.stringify(x),
    p = composeRegisteredPair(x.pair, x.lower, x.upper, { x: 500, y: 300 }, 40);
  assert.equal(p.layers[1].y, 284);
  assert.deepEqual(p.muzzle, { x: 512, y: 278 });
  assert.ok(p.layers.every((l) => l.rotation === 0 && !l.flipX));
  assert.equal(JSON.stringify(x), before);
  p.layers[0].origin[0] = 9;
  assert.equal(x.lower.frame.footAnchor[0], 100);
});
test("unreviewed, gun-only, misregistered and unmeasured layered inputs are rejected", () => {
  for (const mutate of [
    (x) => (x.pair.quality = "prototype"),
    (x) => (x.upper.kind = "weapon"),
    (x) => (x.upper.bank = "wrong"),
    (x) => (x.upper.direction = "S"),
    (x) => delete x.upper.frame.sockets.supportHand,
    (x) => (x.upper.nativeStandingHeight = 100),
  ]) {
    const x = layers();
    mutate(x);
    assert.throws(() =>
      composeRegisteredPair(x.pair, x.lower, x.upper, { x: 0, y: 0 }, 39),
    );
  }
});
test("lab/rig observation cannot modify an existing combat or consume its random generator", () => {
  let calls = 0;
  const b = new Battle(
    () => {
      calls++;
      return 0.65;
    },
    { map: "expanded", variant: 0, spawn: 0, grenades: true },
  );
  const before = JSON.stringify(b),
    count = calls,
    c = new FoundationClock(),
    a = new RiflemanIntent();
  for (let i = 0; i < 100; i++) {
    c.advance(0.05);
    c.pose("E");
    a.request({ weapon: i % 2 ? "aim" : "lowReady" });
    a.advance(0.05);
    completionMatrix();
  }
  assert.equal(calls, count);
  assert.equal(JSON.stringify(b), before);
});
