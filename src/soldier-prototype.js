// Isolated asset renderer for USMC rifleman #1. No simulation writes/RNG.
const DIRS = 8,
  TAU = Math.PI * 2;
export const eligiblePrototype = (u) =>
  u.id === 1 && u.team === 0 && u.role === "Rifleman";
export function screenAngle(direction) {
  return Math.atan2(
    (Math.sin(direction) + Math.cos(direction)) * 0.5,
    Math.cos(direction) - Math.sin(direction),
  );
}
export function directionFrame(angle) {
  return ((Math.round(angle / (TAU / DIRS)) % DIRS) + DIRS) % DIRS;
}
export const LEGACY_DESIGN = {
  nativeStandingHeight: 56,
  baseDisplayHeight: 30,
  logicalFrame: [64, 72],
  footAnchor: [32, 64],
  shoulders: [
    [25, 20],
    [38, 20],
  ],
  crouchDrop: 14,
  gripOffset: [2, -37],
  upperArmLength: 8,
  forearmLength: 9,
  armWidth: 7,
  weaponSize: [38, 12],
  weaponGrip: [12, 6],
  weaponMuzzle: [36, 6],
  supportGripDistance: 11,
};
export function prototypePose(u, m, visualSize = 1, design = LEGACY_DESIGN) {
  const scale = [1, 1.3, 1.5].includes(visualSize) ? visualSize : 1;
  return {
    eligible: eligiblePrototype(u) && u.active,
    scale: (scale * design.baseDisplayHeight) / design.nativeStandingHeight,
    angle: screenAngle(m.renderDirection ?? m.direction),
    foreshorten:
      Math.hypot(
        Math.cos(m.renderDirection ?? m.direction) -
          Math.sin(m.renderDirection ?? m.direction),
        0.5 *
          (Math.sin(m.renderDirection ?? m.direction) +
            Math.cos(m.renderDirection ?? m.direction)),
      ) / Math.SQRT2,
    body: directionFrame(screenAngle(m.renderDirection ?? m.direction)),
    legs: directionFrame(screenAngle(u.movementHeading ?? u.facing)),
    phase: m.moving
      ? ((Math.floor(((m.renderStride ?? m.stride) / TAU) * 8) % 8) + 8) % 8
      : 0,
    lowering: Math.max(0, Math.min(1, (30 + (m.renderTop ?? -30)) / 10)),
    prone: m.tucked || m.crawl,
  };
}
export function preloadPrototype(scene) {
  const root =
    (import.meta.env?.BASE_URL ?? "/annous-warfare/") + "assets/usmc-rifleman/";
  scene.load.atlas(
    "usmc-rifleman",
    root + "rifleman.png",
    root + "rifleman.json",
  );
  for (const name of ["sleeve", "forearm", "m16a4"])
    scene.load.image("usmc-" + name, root + name + ".png");
  scene.load.json("usmc-meta", root + "metadata.json");
  const upgraded =
    (import.meta.env?.BASE_URL ?? "/annous-warfare/") +
    "assets/usmc-rifleman-v031/";
  scene.load.atlas(
    "usmc031-rifleman",
    upgraded + "rifleman.png",
    upgraded + "rifleman.json",
  );
  for (const name of ["sleeve", "forearm", "m16a4"])
    scene.load.image("usmc031-" + name, upgraded + name + ".png");
  scene.load.json("usmc031-meta", upgraded + "metadata.json");
}
export class SoldierPrototype {
  constructor(scene) {
    this.scene = scene;
    this.enabled = false;
    this.visualSize = 1;
    this.art = "v030";
    this.design = LEGACY_DESIGN;
    this.battle = null;
    this.lowReady = 1;
    this.state = null;
    this.parts = [];
    const image = (key, frame) => {
      const im = scene.add.image(0, 0, key, frame);
      this.parts.push(im);
      return im;
    };
    this.stand = image("usmc-rifleman", "stand-0-0").setOrigin(0.5, 64 / 72);
    this.crouch = image("usmc-rifleman", "crouch-0-0").setOrigin(0.5, 64 / 72);
    this.torso = image("usmc-rifleman", "torso-0").setOrigin(0.5, 64 / 72);
    this.prone = image("usmc-rifleman", "prone-0").setOrigin(0.5, 64 / 72);
    this.arms = [0, 1].map(() => ({
      upper: image("usmc-sleeve").setOrigin(0.5, 0),
      fore: image("usmc-forearm").setOrigin(0.5, 0),
    }));
    this.gun = image("usmc-m16a4").setOrigin(12 / 38, 6 / 12);
    this.hide();
    if (scene.cache?.json?.get("usmc031-meta")) this.setArt("v031");
  }
  setArt(art) {
    this.art = art === "v031" ? "v031" : "v030";
    const prefix = this.art === "v031" ? "usmc031" : "usmc";
    this.design = {
      ...LEGACY_DESIGN,
      ...(this.scene.cache?.json?.get(prefix + "-meta") ?? {}),
    };
    const d = this.design;
    for (const [im, frame] of [
      [this.stand, "stand-0-0"],
      [this.crouch, "crouch-0-0"],
      [this.torso, "torso-0"],
      [this.prone, this.art === "v031" ? "prone-0-0" : "prone-0"],
    ])
      im.setTexture(prefix + "-rifleman", frame).setOrigin(
        d.footAnchor[0] / d.logicalFrame[0],
        d.footAnchor[1] / d.logicalFrame[1],
      );
    for (const a of this.arms) {
      a.upper.setTexture(prefix + "-sleeve");
      a.fore.setTexture(prefix + "-forearm");
    }
    this.gun
      .setTexture(prefix + "-m16a4")
      .setOrigin(
        d.weaponGrip[0] / d.weaponSize[0],
        d.weaponGrip[1] / d.weaponSize[1],
      );
  }
  hide() {
    if (this.state) this.state.visible = false;
    for (const p of this.parts) p.setVisible(false);
  }
  snapshot() {
    return this.state
      ? {
          ...this.state,
          muzzle: this.state.muzzle ? { ...this.state.muzzle } : undefined,
          grip: this.state.grip ? { ...this.state.grip } : undefined,
        }
      : null;
  }
  hitTest(point, foot) {
    const k = this.visualSize;
    return (
      this.enabled &&
      Math.abs(point.x - foot.x) < 10 * k &&
      point.y >= foot.y - 31 * k &&
      point.y <= foot.y + 3
    );
  }
  draw(g, b, u, m, fx, p, view, selected, paused = false, speed = 1) {
    if (
      !this.enabled ||
      !eligiblePrototype(u) ||
      !u.active ||
      [
        "grenadePrep",
        "grenadeThrow",
        "treating",
        "deploying",
        "unmounting",
        "mounted",
        "mountedFiring",
      ].includes(m.pose) ||
      !this.scene.textures.exists(
        this.art === "v031" ? "usmc031-rifleman" : "usmc-rifleman",
      )
    ) {
      this.hide();
      return false;
    }
    if (this.battle !== b) {
      this.battle = b;
      this.lowReady = 1;
    }
    this.hide();
    const plan = prototypePose(view, m, this.visualSize, this.design),
      design = this.design,
      s = plan.scale,
      depth = (view.x + view.y) * 100;
    const show = (im, offset = 0) =>
      im
        .setVisible(true)
        .setDepth(depth + offset)
        .setScale(s)
        .setPosition(p.x, p.y);
    const crouch = plan.lowering;
    show(this.stand)
      .setFrame(
        `${this.art === "v031" && m.pose === "running" ? "run" : "stand"}-${plan.legs}-${plan.phase}`,
      )
      .setAlpha(1 - crouch);
    show(this.crouch, 0.01)
      .setFrame(`crouch-${plan.legs}-${plan.phase}`)
      .setAlpha(crouch);
    const shadow = plan.prone ? 23 : 17;
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(
      p.x + 2,
      p.y + 2,
      shadow * this.visualSize,
      6 * this.visualSize,
    );
    if (selected) {
      g.lineStyle(1, 0xf2dba0);
      g.strokeEllipse(p.x, p.y + 1, 24 * this.visualSize, 11 * this.visualSize);
    }
    if (plan.prone) {
      this.stand.setVisible(false);
      this.crouch.setVisible(false);
      show(this.prone, 0.02).setFrame(
        this.art === "v031"
          ? `prone-${plan.body}-${m.moving ? plan.phase : 0}`
          : `prone-${plan.body}`,
      );
      if (m.tucked || this.art === "v030") {
        this.state = { ...plan, art: this.art, pose: "prone", visible: true };
        return true;
      }
    }
    const upperY = p.y + design.crouchDrop * crouch * s;
    if (!plan.prone)
      show(this.torso, 0.03)
        .setFrame(`torso-${plan.body}`)
        .setPosition(p.x, upperY);
    const dt = paused ? 0 : Math.min(this.scene.game.loop.delta / 1000, 0.05),
      ready =
        ["aiming", "firing", "seekingCover", "reloading"].includes(m.pose) ||
        m.flash
          ? 0
          : m.moving
            ? 0.35
            : 1;
    this.lowReady = m.flash
      ? 0
      : this.lowReady +
        (ready - this.lowReady) * (1 - Math.exp(-dt * 18 * Math.sqrt(speed)));
    const angle = plan.angle + (m.flash ? 0 : this.lowReady * 0.22),
      dx = Math.cos(angle),
      dy = Math.sin(angle),
      recoil = m.flash ? Math.min(1, fx.shot * 12) * this.visualSize : 0;
    const grip = {
      x: p.x + dx * (plan.prone ? 16 : design.gripOffset[0]) * s - dx * recoil,
      y: plan.prone
        ? p.y - 10 * s + dy * 8 * s
        : upperY + design.gripOffset[1] * s - dy * recoil,
    };
    let support = {
      x: grip.x + dx * design.supportGripDistance * s * plan.foreshorten,
      y: grip.y + dy * design.supportGripDistance * s * plan.foreshorten,
    };
    if (m.pose === "reloading") {
      const progress = m.renderReloadProgress ?? m.reloadProgress;
      support = {
        x: grip.x + Math.sin(progress * TAU) * 3 * s,
        y: grip.y + (5 + Math.sin(progress * Math.PI) * 4) * s,
      };
    }
    const shoulder = plan.prone
      ? [
          { x: p.x - 5 * s, y: p.y - 13 * s },
          { x: p.x + 5 * s, y: p.y - 13 * s },
        ]
      : design.shoulders.map(([x, y]) => ({
          x: p.x + (x - design.footAnchor[0]) * s,
          y: upperY + (y - design.footAnchor[1]) * s,
        }));
    for (let i = 0; i < 2; i++) {
      const start = shoulder[i],
        end = i === 0 ? grip : support,
        L1 = design.upperArmLength * s,
        L2 = design.forearmLength * s,
        vx = end.x - start.x,
        vy = end.y - start.y,
        d = Math.max(0.001, Math.hypot(vx, vy)),
        a = Math.min(L1, (L1 * L1 - L2 * L2 + d * d) / (2 * d)),
        h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      let nx = -vy / d,
        ny = vx / d;
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const elbow = {
        x: start.x + (vx / d) * a + nx * h,
        y: start.y + (vy / d) * a + ny * h,
      };
      for (const [im, A, B] of [
        [this.arms[i].upper, start, elbow],
        [this.arms[i].fore, elbow, end],
      ]) {
        im.setVisible(true)
          .setPosition(A.x, A.y)
          .setDisplaySize(design.armWidth * s, Math.hypot(B.x - A.x, B.y - A.y))
          .setRotation(Math.atan2(B.y - A.y, B.x - A.x) - Math.PI / 2)
          .setDepth(depth + 0.04 + i * 0.001);
      }
    }
    show(this.gun, 0.06)
      .setScale(s * plan.foreshorten, s)
      .setPosition(grip.x, grip.y)
      .setRotation(angle);
    const muzzle = {
      x:
        grip.x +
        dx *
          (design.weaponMuzzle[0] - design.weaponGrip[0]) *
          s *
          plan.foreshorten,
      y:
        grip.y +
        dy *
          (design.weaponMuzzle[0] - design.weaponGrip[0]) *
          s *
          plan.foreshorten,
    };
    if (m.flash) {
      g.fillStyle(0xffcc7c, 0.12);
      g.fillCircle(muzzle.x, muzzle.y, 7 * this.visualSize);
      g.fillStyle(0xffedb6);
      g.fillTriangle(
        muzzle.x + dx * 4,
        muzzle.y + dy * 4,
        muzzle.x - dy * 2,
        muzzle.y + dx * 2,
        muzzle.x + dy * 2,
        muzzle.y - dx * 2,
      );
    }
    if (fx.hit > 0) {
      g.lineStyle(1, 0xe4b3a4, 0.7);
      g.strokeEllipse(p.x, upperY - 33 * s, 12 * s, 15 * s);
    }
    this.state = {
      ...plan,
      art: this.art,
      pose: m.pose,
      visible: true,
      muzzle,
      grip,
      gunAngle: angle,
      flash: !!m.flash,
    };
    return true;
  }
}
