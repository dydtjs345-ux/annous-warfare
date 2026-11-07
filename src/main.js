import { SoldierPrototype, preloadPrototype } from "./soldier-prototype.js";
import { EnvironmentCache } from "./environment-cache.js";
import { streetProps, drawStreetProp } from "./street-art.js";
import { coverVisuals } from "./cover-art.js";
import { MotionPresentation } from "./motion-presentation.js";
import { CombatAtmosphere } from "./combat-atmosphere.js";
import {
  drawGroundDetail,
  drawBuildingDetail,
  buildingPalette,
} from "./urban-detail.js";
import { drawReadability } from "./readability.js";
import { GrenadeVisuals } from "./grenade-visuals.js";
import { drawObstacle, drawGrenades } from "./urban-visuals.js";
import { CombatVisuals } from "./combat-visuals.js";
import { inspectKorean, observeDecision, ko } from "./korean-inspector.js";
import {
  projection,
  fitZoom,
  framedView,
  pickSoldier,
  inView,
} from "./view.js";
import Phaser from "phaser";
import "./style.css";
import { Battle } from "./simulation.js";
import { W, H, houses, obstacles, inside, streetAt } from "./world.js";

const params = new URLSearchParams(location.search);
const mapMode = ["legacy", "urban"].includes(params.get("map"))
  ? params.get("map")
  : "expanded";
class Battlefield extends Phaser.Scene {
  preload() {
    preloadPrototype(this);
  }
  create() {
    this.seed = params.has("seed")
      ? Number(params.get("seed")) >>> 0
      : (Math.random() * 4294967296) >>> 0;
    this.speed = 1;
    this.paused = false;
    this.acc = 0;
    this.selected = null;
    this.ground = this.add.graphics();
    this.g = this.add.graphics().setDepth(1000000);
    this.visuals = new CombatVisuals();
    this.motion = new MotionPresentation();
    this.prototypeVisual = new SoldierPrototype(this);
    this.prototypeVisual.visualSize = 1.3;
    document.querySelector("#prototype-art").onchange = (e) =>
      this.prototypeVisual.setArt(e.target.value);
    document.querySelector("#prototype-toggle").onclick = () => {
      this.prototypeVisual.enabled = !this.prototypeVisual.enabled;
      if (this.prototypeVisual.enabled) this.selected = this.battle.units[1];
      document.querySelector("#prototype-toggle").textContent = this
        .prototypeVisual.enabled
        ? "시제품 #1: 켜짐"
        : "시제품 #1: 꺼짐";
    };
    document.querySelector("#prototype-scale").onchange = (e) => {
      this.prototypeVisual.visualSize = Number(e.target.value);
    };
    this.atmosphere = new CombatAtmosphere();
    this.grenadeVisuals = new GrenadeVisuals();
    this.input.addPointer(2);
    this.newMatch();
    this.input.on("pointerdown", (p) => {
      this.down = { x: p.x, y: p.y };
      this.gestureMoved =
        this.input.manager.pointers.filter((p) => p.isDown).length > 1;
      this.lastTouches = null;
    });
    this.input.on("pointermove", (p) => {
      const c = this.cameras.main,
        pointers = this.input.manager.pointers.filter((p) => p.isDown);
      if (this.down && Math.hypot(p.x - this.down.x, p.y - this.down.y) > 8)
        this.gestureMoved = true;
      if (pointers.length >= 2) {
        this.freeCamera();
        const [a, b] = pointers,
          d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (this.lastTouches)
          c.setZoom(
            Phaser.Math.Clamp(
              (c.zoom * d) / this.lastTouches,
              this.minimumZoom(),
              2.5,
            ),
          );
        this.lastTouches = d;
      } else if (p.isDown) {
        this.freeCamera();
        this.lastTouches = null;
        c.scrollX -= (p.x - p.prevPosition.x) / c.zoom;
        c.scrollY -= (p.y - p.prevPosition.y) / c.zoom;
      }
    });
    this.input.on("pointerup", (p) => {
      this.lastTouches = null;
      if (
        this.down &&
        !this.gestureMoved &&
        Math.hypot(p.x - this.down.x, p.y - this.down.y) < 8
      ) {
        const c = this.cameras.main,
          w = c.getWorldPoint(p.x, p.y);
        const picked = pickSoldier(
          this.motion.battle === this.battle
            ? this.motion.views
            : this.battle.units,
          w,
          c.zoom,
          this.iso,
        );
        if (picked) this.selected = this.battle.units[picked.id];
        else if (this.prototypeVisual.enabled) {
          const u = this.battle.units[1],
            v = this.motion.position(u);
          if (u.active && this.prototypeVisual.hitTest(w, this.iso(v.x, v.y)))
            this.selected = u;
        }
      }
    });
    this.input.on("wheel", (_, __, ___, dy) => {
      this.freeCamera();
      const c = this.cameras.main;
      c.setZoom(
        Phaser.Math.Clamp(
          c.zoom * (dy > 0 ? 0.9 : 1.1),
          this.minimumZoom(),
          2.5,
        ),
      );
    });
    this.scale.on("resize", () => this.frameCamera(false));
    // Inspector/orientation layout changes must update input and camera bounds
    // immediately, rather than waiting for Phaser's 500ms parent-size poll.
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(([entry]) => {
        const width = Math.floor(entry.contentRect.width),
          height = Math.floor(entry.contentRect.height);
        if (
          width > 0 &&
          height > 0 &&
          (this.scale.width !== width || this.scale.height !== height)
        )
          this.scale.setParentSize(width, height);
      });
      observer.observe(document.querySelector("#game"));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        observer.disconnect(),
      );
    }
    document.querySelector("#pause").onclick = () => {
      this.paused = !this.paused;
      document.querySelector("#pause").textContent = this.paused
        ? "계속"
        : "일시정지";
    };
    document.querySelectorAll("[data-speed]").forEach(
      (button) =>
        (button.onclick = () => {
          this.speed = Number(button.dataset.speed);
          document
            .querySelectorAll("[data-speed]")
            .forEach((x) => x.classList.toggle("active", x === button));
        }),
    );
    document.querySelector("#restart").onclick = () => {
      this.seed = (this.seed + 1) >>> 0;
      this.newMatch();
    };
    document.querySelector("#focus").onclick = () => {
      const modes = ["Map", "USMC", "RU"];
      this.viewMode = modes[(modes.indexOf(this.viewMode) + 1) % modes.length];
      this.frameCamera(true);
    };
    // Opt-in read-only spectator diagnostics for reproducible browser checks.
    // No reference or command API into the simulation is exposed.
    if (params.has("debug"))
      window.awSnapshot = () => {
        const c = this.cameras.main,
          v = c.worldView;
        return {
          seed: this.seed,
          map: { ...this.battle.world },
          spawn: this.battle.spawn,
          width: W,
          height: H,
          speed: this.speed,
          paused: this.paused,
          time: this.battle.time,
          selected: this.selected?.id ?? null,
          prototype: {
            art: this.prototypeVisual.art,
            enabled: this.prototypeVisual.enabled,
            scale: this.prototypeVisual.visualSize,
            state: this.prototypeVisual.snapshot(),
          },
          environmentCache: {
            count: this.staticEnvironment.records.length,
            textureCount: Object.keys(this.textures.list).filter((k) =>
              k.startsWith("urban-static-"),
            ).length,
            obscured: this.staticEnvironment.obscured,
          },
          viewMode: this.viewMode,
          view: {
            x: v.x,
            y: v.y,
            width: v.width,
            height: v.height,
            zoom: c.zoom,
          },
          bounds: { ...this.geometry.bounds },
          grenadeStats: { ...this.battle.grenadeStats },
          grenadeEffects: this.grenadeVisuals.effects.map((e) => ({
            kind: e.kind,
            x: e.x,
            y: e.y,
          })),
          squads: this.battle.squads.map((q) => ({
            phase: q.search?.phase,
            commander: q.commanderId,
          })),
          units: this.battle.units.map((u) => {
            const rendered =
              this.motion.battle === this.battle ? this.motion.position(u) : u;
            const p = this.iso(rendered.x, rendered.y);
            const model = this.visuals.models[u.id];
            return {
              id: u.id,
              team: u.team,
              role: u.role,
              active: u.active,
              x: u.x,
              y: u.y,
              state: u.state,
              renderX: rendered.x,
              renderY: rendered.y,
              renderDirection: model?.renderDirection,
              renderObservation: rendered.observationHeading,
              authoritativeDirection: u.facing,
              authoritativeObservation: u.observationHeading,
              renderStride: model?.renderStride,
              pose: model?.pose,
              flash: model?.flash,
              shotDirection: this.visuals.effects[u.id]?.angle,
              renderTop: model?.renderTop,
              screenX: (p.x - v.x) * c.zoom,
              screenY: (p.y - 12 - v.y) * c.zoom,
            };
          }),
        };
      };
  }
  newMatch() {
    let r = this.seed;
    const variant = params.has("layout")
        ? Number(params.get("layout")) | 0
        : this.seed % 4,
      spawn = params.has("spawn")
        ? Number(params.get("spawn")) | 0
        : Math.floor(this.seed / 4) % 3;
    this.battle = new Battle(
      () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296,
      { map: mapMode, variant, spawn, grenades: mapMode !== "legacy" },
    );
    this.geometry = projection(W, H);
    this.iso = this.geometry.project;
    this.acc = 0;
    this.paused = false;
    this.selected = null;
    this.viewMode = "USMC";
    document.querySelector("#pause").textContent = "일시정지";
    document.querySelector("#outcome").hidden = true;
    this.drawables = [...this.battle.units.map((unit) => ({ unit }))];
    for (const d of coverVisuals(obstacles)) {
      if (mapMode === "expanded" && d.type === "wall") continue;
      this.drawables.push(d);
    }
    if (mapMode === "expanded")
      for (const building of houses)
        this.drawables.push({
          building,
          x: building.x + (building.w - 1) / 2,
          y: building.y + (building.h - 1) / 2,
        });
    this.drawables.push(...streetProps(houses));
    this.staticEnvironment?.destroy();
    this.unitGraphics?.forEach((g) => g.destroy());
    this.unitGraphics = this.battle.units.map(() => this.add.graphics());
    const staticDrawables = this.drawables.filter((d) => !d.unit);
    if (mapMode !== "expanded")
      for (const h of houses)
        staticDrawables.push({
          building: h,
          x: h.x + (h.w - 1) / 2,
          y: h.y + (h.h - 1) / 2,
          legacyRoof: true,
        });
    this.staticEnvironment = new EnvironmentCache(
      this,
      staticDrawables,
      this.iso,
      (g, d, iso) => {
        const p = iso(d.x, d.y);
        if (d.building) this.drawBuilding(g, d.building, iso);
        else if (d.decoration) drawStreetProp(g, d, p);
        else drawObstacle(g, d, p);
      },
    );
    this.drawGround();
    // Bake static ground once per match, never once per animation frame.
    this.groundCache?.destroy();
    const bounds = this.geometry.bounds;
    this.groundCache = this.add
      .renderTexture(
        bounds.x,
        bounds.y,
        Math.ceil(bounds.width),
        Math.ceil(bounds.height),
      )
      .setOrigin(0, 0)
      .setDepth(-1);
    this.ground.setVisible(true);
    this.groundCache.draw(this.ground, -bounds.x, -bounds.y);
    this.ground.setVisible(false);
    this.ground.clear();
    this.frameCamera(true);
    this.nextUI = 0;
  }
  minimumZoom() {
    return Math.min(
      0.3,
      fitZoom(this.geometry.bounds, this.scale.width, this.scale.height),
    );
  }
  focusPoint() {
    if (this.viewMode === "Map")
      return {
        x: this.geometry.bounds.x + this.geometry.bounds.width / 2,
        y: this.geometry.bounds.y + this.geometry.bounds.height / 2,
      };
    const team = this.viewMode === "RU" ? 1 : 0,
      q = this.battle.squads[team];
    const u =
      this.battle.units.find((u) => u.id === q.commanderId && u.active) ||
      this.battle.units.find((u) => u.team === team && u.active) ||
      this.battle.units[team * 6];
    const rendered =
      this.motion.battle === this.battle ? this.motion.position(u) : u;
    return this.iso(rendered.x, rendered.y);
  }
  frameCamera(resetZoom) {
    const c = this.cameras.main,
      b = this.geometry.bounds;
    if (this.viewMode === "Map")
      c.setZoom(fitZoom(b, this.scale.width, this.scale.height));
    else if (resetZoom)
      c.setZoom(
        Math.max(this.minimumZoom(), Math.min(1, this.scale.width / 450)),
      );
    else c.setZoom(Phaser.Math.Clamp(c.zoom, this.minimumZoom(), 2.5));
    this.boundCamera();
    if (this.viewMode !== "Free") {
      const v = framedView(
        b,
        this.scale.width,
        this.scale.height,
        c.zoom,
        this.focusPoint(),
      );
      c.centerOn(v.centerX, v.centerY);
    }
    document.querySelector("#focus").textContent = {
      USMC: "미군",
      RU: "러시아",
      Map: "전체",
      Free: "자유",
    }[this.viewMode];
    document
      .querySelector("#focus")
      .setAttribute(
        "aria-label",
        `카메라 초점: ${this.viewMode}; switch spectator view`,
      );
  }
  boundCamera() {
    const c = this.cameras.main,
      b = this.geometry.bounds;
    const stamp = `${c.zoom}:${c.width}:${c.height}`;
    if (this.boundStamp === stamp && this.boundGeometry === this.geometry)
      return;
    this.boundStamp = stamp;
    this.boundGeometry = this.geometry;
    // Phaser clamps an oversized viewport to the bounds' top/left. Pad only
    // those axes so a fit-to-map overview remains centered in either orientation.
    const px = Math.max(0, (c.width / c.zoom - b.width) / 2),
      py = Math.max(0, (c.height / c.zoom - b.height) / 2);
    c.setBounds(b.x - px, b.y - py, b.width + px * 2, b.height + py * 2);
  }
  freeCamera() {
    this.viewMode = "Free";
    document.querySelector("#focus").textContent = "자유";
    document
      .querySelector("#focus")
      .setAttribute("aria-label", "카메라 초점: Free; switch spectator view");
  }
  drawGround() {
    const g = this.ground;
    g.clear();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = this.iso(x, y),
          street = streetAt(x, y);
        g.fillStyle(
          inside(x, y)
            ? 0x555b5b
            : street
              ? 0x303b45
              : (x + y) % 3
                ? 0x394951
                : 0x3f4d53,
        );
        g.fillPoints(
          [
            { x: p.x, y: p.y - 10 },
            { x: p.x + 20, y: p.y },
            { x: p.x, y: p.y + 10 },
            { x: p.x - 20, y: p.y },
          ],
          true,
        );
        drawGroundDetail(g, x, y, p);
        if (street && x % 13 === 2 && y % 3 === 0) {
          g.lineStyle(2, 0x9b9b75, 0.5);
          g.lineBetween(p.x - 5, p.y - 2, p.x + 5, p.y + 2);
        }
      }
    if (mapMode !== "expanded")
      for (const h of houses)
        for (const y of [h.y, h.y + h.h - 1]) {
          const p = this.iso(h.x + 2, y);
          g.lineStyle(4, 0xb59b70);
          g.lineBetween(p.x - 9, p.y - 7, p.x - 9, p.y - 22);
        }
  }
  drawBuilding(g, h, iso = this.iso) {
    const a = iso(h.x - 0.5, h.y - 0.5),
      b = iso(h.x + h.w - 0.5, h.y - 0.5),
      c = iso(h.x + h.w - 0.5, h.y + h.h - 0.5),
      d = iso(h.x - 0.5, h.y + h.h - 0.5),
      height = 32;
    // Restrained ambient shadow cast by the existing solid building only.
    g.fillStyle(0x0b1722, 0.28);
    g.fillPoints(
      [
        { x: d.x + 8, y: d.y + 4 },
        { x: c.x + 8, y: c.y + 4 },
        { x: c.x + 8, y: c.y + 12 },
        { x: d.x + 8, y: d.y + 12 },
      ],
      true,
    );
    const palette = buildingPalette(h);
    g.fillStyle(palette.dark);
    g.fillPoints(
      [{ x: d.x, y: d.y - height }, { x: c.x, y: c.y - height }, c, d],
      true,
    );
    g.fillStyle(palette.light);
    g.fillPoints(
      [{ x: b.x, y: b.y - height }, { x: c.x, y: c.y - height }, c, b],
      true,
    );
    const roof = [a, b, c, d].map((p) => ({ x: p.x, y: p.y - height }));
    g.fillStyle(palette.roof);
    g.fillPoints(roof, true);
    drawBuildingDetail(g, h, iso, height);
    g.lineStyle(2, 0x819294);
    g.strokePoints([...roof, roof[0]]);
  }
  update(_, delta) {
    if (!this.paused) {
      this.acc += Math.min(delta / 1000, 0.1) * this.speed;
      while (this.acc >= 0.05) {
        this.motion.beforeStep(this.battle);
        this.battle.step(0.05);
        this.acc -= 0.05;
      }
    }
    this.visuals.update(this.battle, delta / 1000, this.speed, this.paused);
    this.motion.update(
      this.battle,
      this.visuals.models,
      this.acc / 0.05,
      delta / 1000,
      this.speed,
      this.paused,
    );
    this.boundCamera();
    if (this.viewMode !== "Free" && this.viewMode !== "Map")
      this.frameCamera(false);
    this.grenadeVisuals.update(
      this.battle,
      delta / 1000,
      this.speed,
      this.paused,
    );
    this.atmosphere.update(this.battle, delta / 1000, this.speed, this.paused);
    const g = this.g,
      v = this.cameras.main.worldView;
    g.clear();
    const selectedView = this.selected
      ? this.motion.position(this.selected)
      : null;
    this.staticEnvironment.update(
      v,
      selectedView,
      this.iso,
      (h) => !this.battle.units.some((u) => u.active && inside(u.x, u.y) === h),
    );
    this.prototypeVisual.hide();
    for (const u of this.battle.units) {
      const rendered = this.motion.position(u),
        p = this.iso(rendered.x, rendered.y),
        ug = this.unitGraphics[u.id];
      ug.clear();
      ug.setVisible(inView(p, v, 65));
      ug.setDepth((rendered.x + rendered.y) * 100);
      if (!ug.visible) continue;
      const drawn =
        u.id === 1 &&
        this.prototypeVisual.draw(
          ug,
          this.battle,
          u,
          this.visuals.models[u.id],
          this.visuals.effects[u.id],
          p,
          rendered,
          this.selected === u,
          this.paused,
          this.speed,
        );
      if (!drawn)
        this.visuals.drawUnit(
          ug,
          this.battle,
          u,
          p,
          this.iso,
          this.selected === u,
        );
      drawReadability(ug, rendered, p, this.iso);
    }
    if (this.selected && this.staticEnvironment.obscured) {
      const p = this.iso(selectedView.x, selectedView.y),
        m = this.visuals.models[this.selected.id],
        low = m.tucked || m.crawl || !this.selected.active,
        top = low ? -9 : (m.renderTop ?? -30);
      g.lineStyle(1, 0xc0e4d3, 0.9);
      g.strokeEllipse(p.x, p.y + top / 2, low ? 24 : 14, Math.abs(top) + 2);
    }
    this.visuals.drawTraces(g, this.iso);
    drawGrenades(g, this.battle, this.iso, v);
    this.grenadeVisuals.draw(g, this.iso, v);
    this.atmosphere.draw(g, this.iso, v, (e) =>
      e.unitId === 1 &&
      this.prototypeVisual.enabled &&
      this.prototypeVisual.state?.visible &&
      this.prototypeVisual.state.flash
        ? this.prototypeVisual.state
        : null,
    );
    if (this.time.now >= this.nextUI) {
      this.nextUI = this.time.now + 100;
      document.querySelector("#counts").textContent =
        `USMC ${this.battle.units.filter((u) => u.team === 0 && u.active).length} · RU ${this.battle.units.filter((u) => u.team === 1 && u.active).length}`;
      for (const u of this.battle.units) observeDecision(u, this.battle.time);
      document.querySelector("#inspect-text").textContent = this.selected
        ? inspectKorean(
            this.selected,
            this.battle.time,
            document.querySelector("#inspect").classList.contains("expanded"),
          )
        : "병사를 터치하면 상태와 판단 기록을 볼 수 있습니다.";
      document.querySelector("#inspect").hidden = !this.selected;
      const phases = this.battle.squads
        .map((q) => ko(q.search?.phase))
        .filter(Boolean)
        .join(" / ");
      document.querySelector("footer").textContent =
        `${phases || "섬멸전"} · ${W}×${H} · 시드 ${this.seed} · 수류탄 ${this.battle.grenadeStats.thrown}/${this.battle.grenadeStats.detonated}`;
    }
    if (this.battle.result) {
      const o = document.querySelector("#outcome");
      o.hidden = false;
      o.textContent = this.battle.result.includes("USMC")
        ? "미 해병대 승리"
        : "러시아 보병 승리";
    }
  }
}
document.querySelector("#detail").onclick = () => {
  const p = document.querySelector("#inspect");
  p.classList.toggle("expanded");
  document.querySelector("#detail").textContent = p.classList.contains(
    "expanded",
  )
    ? "간단히"
    : "자세히";
};
document.querySelector("#close-inspect").onclick = () => {
  const scene = game.scene.scenes[0];
  if (scene) scene.selected = null;
  document.querySelector("#inspect").hidden = true;
};
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  pixelArt: true,
  antialias: false,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: Battlefield,
});
