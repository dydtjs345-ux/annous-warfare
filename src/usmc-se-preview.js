import Phaser from "phaser";
import { proportionLayout, proportionFigure } from "./usmc-proportion-view.js";
import {
  CLIPS,
  DEMO_DURATION,
  clipDuration,
  SEPreviewClock,
  previewTravel,
  shotCuesBetween,
} from "./usmc-se-animation.js";
import "./usmc-se-preview.css";

const BANKS = ["v032", "v033"];
const assetRoot = (bank) =>
  import.meta.env.BASE_URL + `assets/usmc-se-${bank}/`;
const $ = (selector) => document.querySelector(selector);
const clock = new SEPreviewClock();
const stage = $("#preview-stage");
class SEPreview extends Phaser.Scene {
  preload() {
    for (const bank of BANKS) {
      const root = assetRoot(bank);
      this.load.spritesheet(`usmc-se-${bank}`, root + "source-atlas.png", {
        frameWidth: 256,
        frameHeight: 256,
        endFrame: 23,
      });
      this.load.json(`usmc-se-design-${bank}`, root + "metadata.json");
    }
    this.load.on("loaderror", (file) => {
      $("#preview-error").hidden = false;
      $("#preview-error").textContent =
        "시제품 그림을 불러오지 못했습니다: " + file.key;
    });
  }
  create() {
    this.designs = BANKS.map((bank) =>
      this.cache.json.get(`usmc-se-design-${bank}`),
    );
    if (
      this.designs.some(
        (d, i) => !d || !this.textures.exists(`usmc-se-${BANKS[i]}`),
      )
    )
      return;
    this.design = this.designs[0];
    this.floor = this.add.graphics().setDepth(-10);
    this.overlay = this.add.graphics().setDepth(10);
    this.views = BANKS.flatMap((bank, index) =>
      [1, 0].map((actual) => ({
        bank,
        index,
        actual: !!actual,
        image: this.add.image(0, 0, `usmc-se-${bank}`, 0).setDepth(1),
      })),
    );
    this.body = this.views[0].image;
    const style = {
      fontFamily: "system-ui,sans-serif",
      fontSize: "12px",
      color: "#bfcbce",
      align: "center",
    };
    this.actualLabels = BANKS.map(() =>
      this.add.text(0, 38, "", style).setOrigin(0.5).setDepth(20),
    );
    this.detailLabels = BANKS.map(() =>
      this.add.text(0, 204, "", style).setOrigin(0.5).setDepth(20),
    );
    this.detailTitle = this.add
      .text(0, 174, "", style)
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
        this.scale.setParentSize(stage.clientWidth, stage.clientHeight);
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
      stacked: this.positions.stacked,
      views: this.views.map(({ bank, index, actual, image: im }) => ({
        bank,
        actual,
        x: im.x,
        y: im.y,
        scale: im.scaleX,
        scaleY: im.scaleY,
        rotation: im.rotation,
        originX: im.originX,
        originY: im.originY,
        frame: Number(im.frame.name),
        groundY: im.y,
        bounds: proportionFigure(
          this.designs[index],
          Number(im.frame.name),
          { x: im.x, y: im.y },
          30 * this.size,
          actual ? 1 : this.zoom,
        ).bounds,
      })),
      canvas: { width: this.scale.width, height: this.scale.height },
      muzzles: this.muzzles?.map((p) => ({ ...p })),
    });
  }
  layout() {
    if (!this.design) return;
    this.positions = proportionLayout(
      this.scale.width,
      30 * this.size,
      this.zoom,
      this.designs,
    );
    const height = this.positions.height;
    if (Math.abs(stage.clientHeight - height) > 1)
      stage.style.height = height + "px";
    // RESIZE refreshes from cached parentSize. Updating only gameSize leaves
    // a stale, clipped canvas until Phaser's parent polling runs.
    if (
      this.scale.width !== stage.clientWidth ||
      this.scale.height !== stage.clientHeight
    )
      this.scale.setParentSize(stage.clientWidth, stage.clientHeight);
    BANKS.forEach((bank, i) => {
      const version = i ? "v0.3.3" : "v0.3.2",
        a = this.positions.actual[i],
        d = this.positions.detailLabels[i];
      this.actualLabels[i]
        .setPosition(a.x, 38)
        .setText(`${version} · ${Math.round(30 * this.size)}px`);
      this.detailLabels[i]
        .setPosition(d.x, d.y)
        .setText(`${version} · ${this.zoom}×`);
    });
    this.detailTitle
      .setPosition(this.scale.width * 0.5, 174)
      .setText(`${this.zoom}× 비율 비교 · 같은 동작`);
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
  drawFigure(im, pose, x, y, scale, design) {
    const frame = design.frames[pose.frame],
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
      const k = (scale * design.nativeStandingHeight) / 39,
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
    this.muzzles = this.views.map(({ index, actual, image }) => {
      const pos = (actual ? this.positions.actual : this.positions.detail)[
          index
        ],
        mag = actual ? 1 : this.zoom;
      this.drawFloor(pos.x, pos.y, mag, this.groundDistance);
      const scale =
        ((30 * this.size) / this.designs[index].nativeStandingHeight) * mag;
      return this.drawFigure(
        image,
        pose,
        pos.x,
        pos.y,
        scale,
        this.designs[index],
      );
    });
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
