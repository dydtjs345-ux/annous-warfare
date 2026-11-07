import Phaser from "phaser";
import { preloadPrototype, SoldierPrototype } from "./soldier-prototype.js";
import {
  CLIPS,
  DEMO_DURATION,
  clipDuration,
  SEPreviewClock,
  previewTravel,
  shotCuesBetween,
} from "./usmc-se-animation.js";
import "./usmc-se-preview.css";

const root = import.meta.env.BASE_URL + "assets/usmc-se-v032/";
const $ = (selector) => document.querySelector(selector);
const clock = new SEPreviewClock();
const stage = $("#preview-stage");
class SEPreview extends Phaser.Scene {
  preload() {
    this.load.spritesheet("usmc-se-body", root + "source-atlas.png", {
      frameWidth: 256,
      frameHeight: 256,
      endFrame: 23,
    });
    this.load.json("usmc-se-design", root + "metadata.json");
    preloadPrototype(this);
    this.load.on("loaderror", (file) => {
      $("#preview-error").hidden = false;
      $("#preview-error").textContent =
        "시제품 그림을 불러오지 못했습니다: " + file.key;
    });
  }
  create() {
    this.design = this.cache.json.get("usmc-se-design");
    if (!this.design || !this.textures.exists("usmc-se-body")) return;
    this.floor = this.add.graphics().setDepth(-10);
    this.overlay = this.add.graphics().setDepth(10);
    this.body = this.add.image(0, 0, "usmc-se-body", 0).setDepth(1);
    this.detail = this.add.image(0, 0, "usmc-se-body", 0).setDepth(1);
    this.legacy = new SoldierPrototype(this);
    this.legacy.enabled = true;
    this.legacy.setArt("v031");
    this.legacyUnit = {
      id: 1,
      team: 0,
      role: "Rifleman",
      active: true,
      x: 0,
      y: 0,
      facing: 0,
      movementHeading: 0,
    };
    this.legacyBattle = {};
    this.legacyModel = {};
    const style = {
      fontFamily: "system-ui,sans-serif",
      fontSize: "12px",
      color: "#bfcbce",
      align: "center",
    };
    this.actualLabel = this.add
      .text(0, 38, "", style)
      .setOrigin(0.5)
      .setDepth(20);
    this.oldLabel = this.add.text(0, 38, "", style).setOrigin(0.5).setDepth(20);
    this.detailLabel = this.add
      .text(0, 184, "", style)
      .setOrigin(0.5)
      .setDepth(20);
    this.size = 1.3;
    this.zoom = 4;
    this.groundDistance = 0;
    this.flashRemaining = 0;
    this.shotCues = 0;
    this.cueMode = null;
    this.cueTime = -1;
    this.lastUI = -1;
    this.scale.on("resize", () => this.layout());
    this.resizeObserver = new ResizeObserver(() => {
      if (
        stage.clientWidth !== this.scale.width ||
        stage.clientHeight !== this.scale.height
      )
        this.scale.resize(stage.clientWidth, stage.clientHeight);
    });
    this.resizeObserver.observe(stage);
    this.events.once("shutdown", () => this.resizeObserver.disconnect());
    this.layout();
    this.bindControls();
    window.sePreviewSnapshot = () => ({
      time: clock.time,
      mode: clock.mode,
      playing: clock.playing,
      speed: clock.speed,
      pose: { ...(this.lastPose ?? clock.pose()) },
      shotCues: this.shotCues,
      size: this.size,
      zoom: this.zoom,
      direction: "SE",
      total: clock.mode === "demo" ? DEMO_DURATION : clipDuration(clock.mode),
      source: "whole-body-atlas",
      independentWeaponObjects: 0,
      frameSize: [256, 256],
      groundDistance: this.groundDistance,
      views: [this.body, this.detail].map((im) => ({
        x: im.x,
        y: im.y,
        scale: im.scaleX,
        rotation: im.rotation,
        originX: im.originX,
        originY: im.originY,
        frame: Number(im.frame.name),
      })),
      canvas: { width: this.scale.width, height: this.scale.height },
      legacy: this.legacy.snapshot(),
      muzzles: this.muzzles?.map((p) => ({ ...p })),
    });
  }
  layout() {
    if (!this.design) return;
    const height = Math.max(400, 260 + 30 * this.size * this.zoom);
    if (Math.abs(stage.clientHeight - height) > 1)
      stage.style.height = height + "px";
    const w = this.scale.width;
    this.actualLabel
      ?.setPosition(w * 0.25, 38)
      .setText(`SE 새 동작 · ${Math.round(30 * this.size)}px`);
    this.oldLabel
      ?.setPosition(w * 0.75, 38)
      .setText(`v0.3.1 · ${Math.round(30 * this.size)}px`);
    this.detailLabel
      ?.setPosition(w * 0.5, 184)
      .setText(`새 동작 · ${this.zoom}× 카메라 확대`);
  }
  bindControls() {
    document.querySelectorAll("[data-clip]").forEach(
      (button) =>
        (button.onclick = () => {
          clock.select(button.dataset.clip);
          clock.playing = true;
          this.lastUI = -1;
          this.syncUI();
        }),
    );
    $("#preview-pause").onclick = () => {
      clock.playing = !clock.playing;
      this.syncUI();
    };
    $("#preview-step").onclick = () => {
      clock.step();
      this.syncUI();
    };
    $("#preview-restart").onclick = () => {
      clock.seek(0);
      this.groundDistance = 0;
      this.flashRemaining = 0;
      this.shotCues = 0;
      this.cueMode = null;
      this.cueTime = -1;
      this.syncUI();
    };
    $("#preview-time").oninput = (e) => {
      clock.playing = false;
      clock.seek(e.target.value);
      this.syncUI();
    };
    $("#preview-speed").onchange = (e) => {
      clock.speed = Number(e.target.value);
    };
    $("#preview-size").onchange = (e) => {
      this.size = Number(e.target.value);
      this.layout();
    };
    $("#preview-zoom").onchange = (e) => {
      this.zoom = Number(e.target.value);
      this.layout();
    };
    this.syncUI();
  }
  syncUI() {
    const pose = clock.pose(),
      total = clock.mode === "demo" ? DEMO_DURATION : clipDuration(clock.mode);
    const localTime =
      clock.mode === "demo" || CLIPS[clock.mode].loop
        ? clock.time % total
        : Math.min(clock.time, total);
    $("#preview-state").textContent =
      `${pose.label} · 프레임 ${pose.frame + 1}/24 · ${localTime.toFixed(2)}초 · 방향 SE`;
    $("#preview-pause").textContent = clock.playing ? "일시정지" : "재생";
    const slider = $("#preview-time");
    slider.max = total;
    if (document.activeElement !== slider) slider.value = localTime;
    document
      .querySelectorAll("[data-clip]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.clip === clock.mode),
      );
  }
  drawFloor(cx, cy, scale, distance) {
    const g = this.floor,
      s = scale,
      shift = distance % 30;
    g.fillStyle(0x23343d);
    g.fillEllipse(cx, cy + 4 * s, 110 * s, 30 * s);
    g.lineStyle(1, 0x53616a, 0.35);
    for (let i = -2; i <= 2; i++) {
      const x = cx + (i * 30 - shift) * s;
      g.lineBetween(x - 35 * s, cy - 17 * s, x + 35 * s, cy + 18 * s);
    }
    g.lineStyle(1, 0x657078, 0.2);
    g.strokeEllipse(cx, cy + 2 * s, 100 * s, 42 * s);
  }
  drawFigure(im, pose, x, y, scale) {
    const frame = this.design.frames[pose.frame],
      a = frame.footAnchor;
    im.setFrame(pose.frame)
      .setOrigin(a[0] / 256, a[1] / 256)
      .setScale(scale)
      .setPosition(x, y);
    const muzzle = {
      x: x + (frame.muzzle[0] - a[0]) * scale,
      y: y + (frame.muzzle[1] - a[1]) * scale,
    };
    const g = this.overlay;
    if (pose.flash) {
      // Only the preview's explicit shot cue. No asset has a baked flash.
      const k = (scale * 200) / 39,
        x = Math.round(muzzle.x),
        y = Math.round(muzzle.y);
      // A tiny stepped pixel cluster instead of a flat circular/vector flare.
      g.fillStyle(0xffc779, 0.035);
      g.fillCircle(x + k, y, 3 * k);
      g.fillStyle(0xffda9a, 0.06);
      g.fillCircle(x + k, y, 2 * k);
      g.fillStyle(0xf2b260, 0.8);
      g.fillRect(x, y - k, 2 * k, 2 * k);
      g.fillStyle(0xffe8b1, 0.96);
      g.fillRect(x, y, 3 * k, k);
      g.fillStyle(0xeab069, 0.55);
      g.fillRect(x + 3 * k, y, Math.max(1, k), Math.max(1, k * 0.5));
    }
    if ($("#preview-anchors").checked) {
      g.lineStyle(1, 0x7fc9bf);
      g.lineBetween(x - 4, y, x + 4, y);
      g.lineBetween(x, y - 4, x, y + 4);
      g.lineStyle(1, 0xe9c38e);
      g.strokeCircle(muzzle.x, muzzle.y, Math.max(2, scale * 5));
    }
    return muzzle;
  }
  update(_, delta) {
    if (!this.design || !this.body) return;
    const pose = clock.advance(delta / 1000),
      w = this.scale.width,
      h = this.scale.height,
      s = (30 * this.size) / this.design.nativeStandingHeight;
    const discontinuity =
      this.cueMode !== clock.mode || clock.time < this.cueTime;
    if (discontinuity) {
      this.flashRemaining = 0;
      this.cueTime = -1e-8;
      this.shotCues = 0;
    }
    if (clock.playing) {
      this.flashRemaining = Math.max(
        0,
        this.flashRemaining - Math.min(delta / 1000, 0.1),
      );
      const cues = shotCuesBetween(this.cueTime, clock.time, clock.mode);
      if (cues.length) {
        this.flashRemaining = 0.05;
        this.shotCues += cues.length;
      }
    }
    this.cueTime = clock.time;
    this.cueMode = clock.mode;
    pose.flash =
      pose.clip === "fire" && (pose.flash || this.flashRemaining > 0);
    this.lastPose = { ...pose };
    this.groundDistance = previewTravel(clock.time, clock.mode) * s;
    this.floor.clear();
    this.overlay.clear();
    this.drawFloor(w * 0.25, 140, 1, this.groundDistance);
    this.drawFloor(w * 0.75, 140, 1, this.groundDistance);
    this.drawFloor(w * 0.5, h - 28, this.zoom, this.groundDistance);
    this.muzzles = [
      this.drawFigure(this.body, pose, w * 0.25, 140, s),
      this.drawFigure(this.detail, pose, w * 0.5, h - 28, s * this.zoom),
    ];
    const m = this.legacyModel;
    Object.assign(m, {
      pose: pose.walking
        ? "walking"
        : ["raise", "aim", "fire"].includes(pose.clip)
          ? pose.flash
            ? "firing"
            : "aiming"
          : "idle",
      moving: pose.walking,
      direction: 0,
      renderDirection: 0,
      renderTop: -30,
      renderStride: clock.time * Math.PI * 2,
      stride: clock.time * Math.PI * 2,
      flash: pose.flash,
      tucked: false,
      crawl: false,
    });
    this.legacy.visualSize = this.size;
    this.legacy.draw(
      this.overlay,
      this.legacyBattle,
      this.legacyUnit,
      m,
      { shot: pose.flash ? 0.04 : 0, hit: 0 },
      { x: w * 0.75, y: 140 },
      this.legacyUnit,
      false,
      !clock.playing,
      clock.speed,
    );
    if (Math.floor(clock.time * 10) !== this.lastUI) {
      this.lastUI = Math.floor(clock.time * 10);
      this.syncUI();
    }
  }
}
const previewGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "preview-stage",
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  input: { mouse: false, touch: false, keyboard: false },
  backgroundColor: "#1c2b34",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: SEPreview,
});

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) previewGame.destroy(true);
});
let wasPlaying = true;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    wasPlaying = clock.playing;
    clock.playing = false;
  } else {
    clock.playing = wasPlaying;
  }
});
