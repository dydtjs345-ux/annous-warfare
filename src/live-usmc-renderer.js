import { LiveUSMCState, SE_ART } from "./live-usmc-state.js";
export function preloadLiveUSMC(scene) {
  const root =
    (import.meta.env?.BASE_URL ?? "/annous-warfare/") + "assets/usmc-se-v033/";
  scene.load.spritesheet("usmc-live-v033", root + "source-atlas.png", {
    frameWidth: 256,
    frameHeight: 256,
    endFrame: 23,
  });
  scene.load.json("usmc-live-meta", root + "metadata.json");
}
export class LiveUSMCRenderer {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.controller = options.controller ?? new LiveUSMCState();
    this.textureKey = options.texture ?? "usmc-live-v033";
    this.art = options.art ?? SE_ART;
    this.image = scene.add.image(0, 0, this.textureKey, 0).setVisible(false);
    this.design = scene.cache.json.get(options.metadata ?? "usmc-live-meta");
    this.visualSize = 1.3;
    this.state = null;
    this.anchors = new Map();
    this.battle = null;
  }
  update(b, u, m, fx, view) {
    if (this.battle !== b) {
      this.anchors.clear();
      this.battle = b;
    }
    this.plan = this.controller.update(b, u, m, view);
    this.state = { ...this.plan, visible: false };
  }
  hide() {
    this.image.setVisible(false);
    if (this.state) this.state.visible = false;
  }
  draw(g, b, u, m, fx, p, view, selected) {
    if (!this.design || !this.scene.textures.exists(this.textureKey)) {
      this.hide();
      if (this.state) this.state.fallback = "asset";
      return false;
    }
    if (!this.plan?.supported || !u.active || u.dead) {
      this.hide();
      return false;
    }
    const frame = this.design.frames[this.plan.frame],
      a = frame.footAnchor,
      size = [1, 1.3, 1.5].includes(this.visualSize) ? this.visualSize : 1.3,
      s = (30 * size) / this.design.nativeStandingHeight,
      dimensions = this.design.frameSize ?? [256, 256];
    this.image
      .setFrame(this.plan.frame)
      .setOrigin(a[0] / dimensions[0], a[1] / dimensions[1])
      .setScale(s)
      .setPosition(p.x, p.y)
      .setRotation(0)
      .setDepth((view.x + view.y) * 100 + 0.03)
      .setVisible(true);
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(p.x + 2, p.y + 2, 17 * size, 6 * size);
    if (selected) {
      g.lineStyle(1, 0xf2dba0);
      g.strokeEllipse(p.x, p.y + 1, 24 * size, 11 * size);
    }
    const muzzle = {
        x: p.x + (frame.muzzle[0] - a[0]) * s,
        y: p.y + (frame.muzzle[1] - a[1]) * s,
      },
      grip = {
        x: p.x + ((frame.grip?.[0] ?? 152) - a[0]) * s,
        y: p.y + ((frame.grip?.[1] ?? 100) - a[1]) * s,
      },
      gunAngle = frame.barrelAngle ?? this.art.barrel;
    if (this.plan.flash) {
      const dx = Math.cos(gunAngle),
        dy = Math.sin(gunAngle),
        k = size;
      g.fillStyle(0xffc779, 0.06);
      g.fillCircle(muzzle.x, muzzle.y, 3 * k);
      g.fillStyle(0xffe4a3, 0.95);
      g.fillTriangle(
        muzzle.x + dx * 3 * k,
        muzzle.y + dy * 3 * k,
        muzzle.x - dy * k,
        muzzle.y + dx * k,
        muzzle.x + dy * k,
        muzzle.y - dx * k,
      );
      if (this.plan.shotId && !this.anchors.has(this.plan.shotId)) {
        this.anchors.set(this.plan.shotId, {
          muzzle: { ...muzzle },
          grip: { ...grip },
        });
        if (this.anchors.size > 8)
          this.anchors.delete(this.anchors.keys().next().value);
      }
    }
    if (fx.hit > 0) {
      g.lineStyle(1, 0xe4b3a4, 0.7);
      g.strokeEllipse(p.x, p.y - 20 * size, 13 * size, 17 * size);
    }
    this.state = {
      ...this.plan,
      visible: true,
      scale: s,
      muzzle,
      grip,
      gunAngle,
    };
    return true;
  }
  shotAnchor(eventId) {
    return this.anchors.get(eventId) ?? null;
  }
  hitTest(point, foot) {
    if (!this.state?.visible) return false;
    const f = this.design.frames[this.state.frame],
      a = f.footAnchor,
      s = this.state.scale;
    return (
      point.x >= foot.x + (f.bounds[0] - a[0]) * s &&
      point.x <= foot.x + (f.bounds[2] - a[0]) * s &&
      point.y >= foot.y + (f.bounds[1] - a[1]) * s &&
      point.y <= foot.y + (f.bounds[3] - a[1]) * s
    );
  }
  snapshot() {
    return this.state
      ? {
          ...this.state,
          muzzle: this.state.muzzle ? { ...this.state.muzzle } : null,
          grip: this.state.grip ? { ...this.state.grip } : null,
        }
      : null;
  }
}
