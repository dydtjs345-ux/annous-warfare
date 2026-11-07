import { FoundationClock } from "../src/rifleman/clock.js";
import { RiflemanIntent, resolveRequest } from "../src/rifleman/rig.js";
import { completionMatrix } from "../src/rifleman/catalog.js";
import { LiveUSMCRenderer } from "../src/live-usmc-renderer.js";
import {
  liveRenderStatus,
  insertRenderInspection,
} from "../src/live-usmc-inspection.js";
import {
  proportionLayout,
  proportionFigure,
} from "../src/usmc-proportion-view.js";
import { SEPreviewClock, previewTravel } from "../src/usmc-se-animation.js";
import { SoldierPrototype } from "../src/soldier-prototype.js";
import { coverVisuals } from "../src/cover-art.js";
import { drawObstacle } from "../src/urban-visuals.js";
import { drawBuildingDetail } from "../src/urban-detail.js";
import { streetProps, drawStreetProp } from "../src/street-art.js";
import { obstacles, houses } from "../src/world.js";
import { MotionPresentation } from "../src/motion-presentation.js";
import { CombatVisuals } from "../src/combat-visuals.js";
import { CombatAtmosphere } from "../src/combat-atmosphere.js";
import { GrenadeVisuals } from "../src/grenade-visuals.js";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Battle } from "../src/simulation.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const { Battle: Base } = await import(
  pathToFileURL(
    resolve(process.argv[2] || "/tmp/aw-v035-base", "src/simulation.js"),
  )
);
import { inspectKorean, observeDecision } from "../src/korean-inspector.js";
import { drawReadability } from "../src/readability.js";
const meta = JSON.parse(
  readFileSync("public/assets/usmc-rifleman-v031/metadata.json"),
);
const refined = JSON.parse(
  readFileSync("public/assets/usmc-se-v033/metadata.json"),
);
const comparison = proportionLayout(364, 39, 4, [
  JSON.parse(readFileSync("public/assets/usmc-se-v032/metadata.json")),
  refined,
]);
const scene = {
  cache: {
    json: {
      get: (k) =>
        k === "usmc031-meta"
          ? meta
          : k === "usmc-live-meta"
            ? refined
            : undefined,
    },
  },
  add: { image: () => new Proxy({}, { get: () => () => scene.add.image() }) },
  textures: { exists: () => true },
  game: { loop: { delta: 16.7 } },
};
const sink = new Proxy({}, { get: () => () => {} }),
  runs = [];
for (const map of ["legacy", "expanded"])
  for (let seed = 2001; seed <= 2020; seed++) {
    const results = [];
    for (const [index, Type] of [Base, Battle].entries()) {
      let rng = seed;
      const b = new Type(
        () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 4294967296,
        {
          map,
          variant: (seed - 2001) % 4,
          spawn: Math.floor((seed - 2001) / 16) % 3,
          grenades: map === "expanded",
        },
      );
      if (index) {
        const iso = (x, y) => ({ x: (x - y) * 20, y: (x + y) * 10 });
        for (const d of coverVisuals(obstacles))
          drawObstacle(sink, d, iso(d.x, d.y));
        for (const h of houses) drawBuildingDetail(sink, h, iso);
        for (const d of streetProps(houses))
          drawStreetProp(sink, d, iso(d.x, d.y));
      }
      const seClock = new SEPreviewClock(),
        foundation = new FoundationClock(),
        rig = new RiflemanIntent();
      const hash = createHash("sha256"),
        visuals = new CombatVisuals(),
        atmosphere = new CombatAtmosphere(),
        grenades = new GrenadeVisuals(),
        motion = new MotionPresentation(),
        prototype = new SoldierPrototype(scene),
        live = new LiveUSMCRenderer(scene);
      prototype.enabled = true;
      for (let tick = 0; tick < 36000 && !b.result; tick++) {
        if (index) {
          seClock.advance(0.05);
          foundation.advance(0.05);
          foundation.pose("SE");
          foundation.pose("E");
          rig.request({
            locomotion: tick % 120 < 60 ? "walk" : "idle",
            weapon: tick % 90 < 45 ? "aim" : "lowReady",
          });
          rig.advance(0.05);
          resolveRequest({
            movementDirection: "SE",
            aimDirection: "N",
            locomotion: "walk",
            weapon: "aim",
          });
          if (tick % 40 === 0) {
            completionMatrix();
            foundation.setDirection(
              ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
                Math.floor(tick / 40) % 8
              ],
            );
          }
          previewTravel(seClock.time, seClock.mode);
        }
        if (index) motion.beforeStep(b);
        b.step(0.05);
        if (index && tick % 4 === 0) {
          const iso = (x, y) => ({ x: 20 * (x - y), y: 10 * (x + y) });
          visuals.update(b, 0.05, 4, false);
          motion.update(b, visuals.models, 0.5, 1 / 60, 4, false);
          atmosphere.update(b, 0.05, 4, false);
          grenades.update(b, 0.05, 4, false);
          for (const u of b.units)
            visuals.drawUnit(
              sink,
              b,
              u,
              iso(motion.position(u).x, motion.position(u).y),
              iso,
              false,
            );
          proportionFigure(
            refined,
            seClock.pose().frame,
            comparison.detail[1],
            39,
            4,
          );
          const u = b.units[1];
          prototype.setArt(tick % 120 < 60 ? "v031" : "v030");
          prototype.visualSize = [1, 1.3, 1.5][Math.floor(tick / 60) % 3];
          live.visualSize = prototype.visualSize;
          live.update(
            b,
            u,
            visuals.models[1],
            visuals.effects[1],
            motion.position(u),
          );
          live.hide();
          const newMode = tick % 160 < 120;
          const liveDrawn =
            newMode &&
            live.draw(
              sink,
              b,
              u,
              visuals.models[1],
              visuals.effects[1],
              iso(motion.position(u).x, motion.position(u).y),
              motion.position(u),
              true,
            );
          if (!liveDrawn)
            prototype.draw(
              sink,
              b,
              u,
              visuals.models[1],
              visuals.effects[1],
              iso(motion.position(u).x, motion.position(u).y),
              motion.position(u),
              true,
            );
          const status = liveRenderStatus({
            mode: newMode ? "v033" : "v031",
            enabled: true,
            inView: true,
            live: live.snapshot(),
            legacy: prototype.snapshot(),
            model: visuals.models[1],
          });
          insertRenderInspection(inspectKorean(u, b.time, true), status, true);
          visuals.drawTraces(sink, iso, (e) =>
            e.unitId === 1 ? live.shotAnchor(e.id) : null,
          );
          atmosphere.draw(sink, iso, null, (e) => live.shotAnchor(e.id));
          grenades.draw(sink, iso);
        }

        if (index)
          for (const u of b.units) {
            observeDecision(u, b.time);
            if (tick % 4 === 0) {
              inspectKorean(u, b.time, true);
              drawReadability(sink, u, { x: u.x, y: u.y }, (x, y) => ({
                x,
                y,
              }));
            }
          }
        hash.update(
          JSON.stringify([
            rng,
            b.time,
            b.result,
            b.grenadeStats,
            b.units.map((u) => [
              u.x,
              u.y,
              u.health,
              u.ammo,
              u.reserve,
              u.state,
              u.facing,
              u.suppression,
              u.assignment,
              u.posture,
              u.mount,
              u.treat,
              u.patientId,
              u.route,
              u.navigation,
              u.progress,
              u.diagnostics,
              u.activity,
            ]),
            b.squads.map((q) => [
              q.goal,
              q.maneuver,
              q.search?.phase,
              q.search?.goal,
            ]),
          ]),
        );
      }
      assert.ok(b.result, `${map}/${seed} timed out`);
      results.push({
        duration: b.time,
        result: b.result,
        digest: hash.digest("hex"),
      });
    }
    assert.deepEqual(results[0], results[1], `${map}/${seed} diverged`);
    runs.push({ map, seed, ...results[1] });
    console.log(map, seed, results[1].duration);
  }
writeFileSync(
  `${process.env.AW_REPORT_DIR || "reports"}/v035-parity.json`,
  JSON.stringify(
    { base: "b381e60", dt: 0.05, matched: 40, completeExecutions: 80, runs },
    null,
    2,
  ) + "\n",
);
