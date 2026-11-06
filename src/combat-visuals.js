// Render-only clocks/effects. Movement phase comes from distance actually moved;
// reload/treatment phases come from real counters, never invented action timers.
import { FRAG } from "./grenades.js";
const EFFECT_TIMERS = ["shot", "hit", "heal", "complete", "fall"];
const NO_COMBAT = new Set([
  "fullCover",
  "dead",
  "incapacitated",
  "treating",
  "reloading",
  "deploying",
  "grenadePrep",
  "grenadeThrow",
  "unmounting",
]);
const CROUCHED = new Set([
  "fullCover",
  "treating",
  "deploying",
  "mounted",
  "mountedFiring",
  "unmounting",
  "reloading",
  "suppressed",
  "holdingCover",
  "observingCover",
]);
const AIMING = new Set(["Engaging", "Aiming"]);
const PURPOSEFUL_MOVEMENT = new Set([
  "Seeking cover",
  "Reacquiring contact",
  "Searching sector",
  "Moving to casualty",
]);
export function visualState(battle, u, fx, out = {}) {
  const p = u.presentation,
    legs = (u.health["left leg"] + u.health["right leg"]) / 2;
  out.moving = p.moving && !battle.result;
  out.covered = p.covered;
  out.observing = p.observing;
  out.suppressed = u.suppression > 0.55;
  out.injured = false;
  for (const part in u.health)
    if (u.health[part] < 100) {
      out.injured = true;
      break;
    }
  out.mountState = u.active ? (u.mount?.state ?? "unsupported") : "unsupported";
  out.mountProgress = ["deploying", "unmounting"].includes(out.mountState)
    ? Math.min(
        1,
        Math.max(
          0,
          (battle.time - u.mount.since) /
            Math.max(0.001, u.mount.readyAt - u.mount.since),
        ),
      )
    : out.mountState === "mounted"
      ? 1
      : 0;
  out.grenadeProgress = u.grenadePrep
    ? Math.min(1, (battle.time - u.grenadePrep.startedAt) / FRAG.prepare)
    : 0;
  out.reloadProgress = p.reloadProgress;
  out.treatmentProgress = u.treat ?? 0;
  out.stride = p.traveled * Math.PI * 2;
  out.direction = u.facing;
  out.crawl = legs < 35;
  out.limp = legs < 70;
  if (u.dead) out.pose = "dead";
  else if (!u.active) out.pose = "incapacitated";
  else if (u.grenadeThrownAt === battle.time) out.pose = "grenadeThrow";
  else if (u.grenadePrep) out.pose = "grenadePrep";
  else if (p.treating) out.pose = "treating";
  else if (out.mountState === "deploying" || out.mountState === "unmounting")
    out.pose = out.mountState;
  else if (p.reloading) out.pose = "reloading";
  else if (out.mountState === "mounted")
    out.pose =
      fx.shot > 0 && p.lastShotAt != null ? "mountedFiring" : "mounted";
  else if (u.posture?.mode === "full") out.pose = "fullCover";
  else if (out.moving)
    out.pose =
      u.state === "Seeking cover"
        ? "seekingCover"
        : out.crawl
          ? "crawling"
          : out.limp
            ? "limping"
            : p.brisk
              ? "running"
              : "walking";
  else if (fx.shot > 0 && p.lastShotAt != null) out.pose = "firing";
  else if (out.suppressed) out.pose = "suppressed";
  else if (AIMING.has(u.state) && p.direct) out.pose = "aiming";
  else if (p.covered)
    out.pose = p.observing ? "observingCover" : "holdingCover";
  else out.pose = p.observing ? "observing" : "idle";
  out.tucked = u.active && u.posture?.mode === "full";
  out.combat = u.active && !out.tucked && !NO_COMBAT.has(out.pose);
  out.flash = out.combat && fx.shot > 0;
  if (out.flash) out.direction = fx.angle;
  return out;
}
export class CombatVisuals {
  constructor() {
    this.battle = null;
    this.lastEvent = 0;
    this.clock = 0;
    this.effects = [];
    this.models = [];
    this.traces = [];
  }
  update(battle, realDt, speed, paused) {
    if (this.battle !== battle) {
      this.battle = battle;
      this.lastEvent = 0;
      this.clock = 0;
      this.traces.length = 0;
      this.effects = battle.units.map(() => ({
        shot: 0,
        hit: 0,
        heal: 0,
        complete: 0,
        fall: 0,
        angle: 0,
        fallDuration: 0.25,
      }));
      this.models = battle.units.map(() => ({}));
    }
    const dt = paused ? 0 : Math.min(realDt, 0.1);
    this.clock += dt;
    for (const fx of this.effects)
      for (const k of EFFECT_TIMERS) fx[k] = Math.max(0, fx[k] - dt);
    for (let i = this.traces.length - 1; i >= 0; i--)
      if ((this.traces[i].life -= dt) <= 0) this.traces.splice(i, 1);
    for (const e of battle.events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      const fx = this.effects[e.unitId];
      if (e.type === "shot") {
        // Every flash is a received real event. At high speed keep it for at least
        // one readable frame instead of dropping shots between fixed sim steps.
        fx.shot = Math.max(0.035, 0.1 / speed);
        fx.angle = e.angle;
        if (this.traces.length < 48)
          this.traces.push({
            x: e.x,
            y: e.y,
            targetX: e.targetX,
            targetY: e.targetY,
            life: Math.max(0.035, 0.09 / speed),
          });
      } else if (e.type === "damage") fx.hit = Math.max(0.06, 0.18 / speed);
      else if (e.type === "incapacitated" || e.type === "death") {
        fx.fall = Math.max(0.1, 0.25 / speed);
        fx.fallDuration = fx.fall;
      } else if (e.type === "treatmentTick")
        this.effects[e.patientId].heal = Math.max(0.12, 0.4 / speed);
      else if (e.type === "treatmentComplete") {
        this.effects[e.patientId].complete = Math.max(0.2, 0.65 / speed);
        fx.complete = Math.max(0.2, 0.65 / speed);
      }
    }
    for (const u of battle.units)
      visualState(battle, u, this.effects[u.id], this.models[u.id]);
  }
  drawUnit(g, battle, u, p, iso, selected) {
    const m = this.models[u.id],
      fx = this.effects[u.id],
      phase = Math.sin(m.stride),
      floorY = p.y;
    const down = m.pose === "dead" || m.pose === "incapacitated",
      prone = down || m.crawl || m.tucked;
    const crouch = CROUCHED.has(m.pose) || (m.covered && !m.moving);
    const bob = m.moving
      ? m.limp
        ? Math.max(0, phase) * 1.4
        : phase * (m.pose === "running" ? 1.8 : 1)
      : 0;
    const lean = m.pose === "seekingCover" ? 2 : 0;
    let top = prone ? -9 : crouch ? -20 : -30;
    if (down && fx.fall > 0) top -= (16 * fx.fall) / fx.fallDuration;
    if (m.suppressed && !down) top += 2;
    if (m.pose === "incapacitated" && fx.fall === 0)
      top += Math.sin(this.clock * 2 + u.id) * 0.35;
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(p.x + 3, floorY + 1, prone ? 24 : 20, 8);
    if (selected) {
      g.lineStyle(2, 0xf7df8c);
      g.strokeEllipse(p.x, floorY, 28, 14);
    }
    if (!down) {
      // A protected known lane is an arc; no evaluated protection is an open dot.
      if (m.covered) {
        g.lineStyle(2, 0x9dc9ad, 0.8);
        g.beginPath();
        g.arc(p.x, floorY, 12, 0, Math.PI, false);
        g.strokePath();
      } else if (!m.moving) {
        g.fillStyle(0xb6b3a3, 0.65);
        g.fillRect(p.x - 1, floorY + 4, 3, 2);
      }
      if (u.suppression > 0.1) {
        g.lineStyle(1, 0xf3c875, 0.3 + 0.6 * u.suppression);
        g.strokeEllipse(p.x, floorY + 2, 25, 12);
        if (m.suppressed) {
          g.fillStyle(0xf3c875);
          g.fillRect(p.x - 2, p.y + top - 7, 4, 2);
        }
      }
      if (
        m.moving &&
        [
          "Seeking cover",
          "Reacquiring contact",
          "Searching sector",
          "Moving to casualty",
        ].includes(u.state)
      ) {
        g.lineStyle(
          1,
          u.state === "Moving to casualty"
            ? 0xc2e4c4
            : u.state === "Seeking cover"
              ? 0xf1d28d
              : 0x9eb7c7,
          0.8,
        );
        g.lineBetween(p.x - 4, floorY + 5, p.x, floorY + 8);
        g.lineBetween(p.x, floorY + 8, p.x + 4, floorY + 5);
      }
    }
    // Original low-resolution humanoid silhouette; presentation only.
    const cloth = u.team ? 0x969985 : 0x87a4ad;
    const vest = u.team ? 0x515e51 : 0x465d63;
    const helmet = u.team ? 0x657264 : 0x58717b;
    const skin = down ? 0x978c85 : 0xc8b8ac;
    const torsoX = p.x - 5 + lean,
      torsoY = p.y + top + 8 + bob;
    // Equipment sits behind the body; its side follows the authoritative aim axis.
    const facingSide = Math.cos(m.direction) >= 0 ? -1 : 1;
    g.fillStyle(0x15212a);
    g.fillRect(p.x + facingSide * 6 - 3, torsoY + 1, 7, prone ? 5 : 10);
    g.fillStyle(u.team ? 0x495749 : 0x384e59);
    g.fillRect(p.x + facingSide * 6 - 2, torsoY + 2, 5, prone ? 3 : 7);
    g.fillStyle(0x7d8b83);
    g.fillRect(p.x + facingSide * 6, torsoY + 3, 1, 6);
    g.fillStyle(down ? (u.team ? 0x646570 : 0x506974) : cloth);
    g.fillRect(torsoX, torsoY, prone ? 17 : 10, prone ? 6 : crouch ? 9 : 12);
    g.lineStyle(1, 0x17232c, 0.9);
    g.strokeRect(torsoX, torsoY, prone ? 17 : 10, prone ? 6 : crouch ? 9 : 12);
    // Neck, head and shallow helmet brim remain separate pixels.
    g.fillStyle(skin);
    g.fillRect(p.x - 3 + lean, p.y + top + 3 + bob, 6, 5);
    g.fillRect(p.x - 1 + lean, p.y + top + 7 + bob, 2, 2);
    g.fillStyle(down ? 0x515a64 : helmet);
    g.fillRect(p.x - 4 + lean, p.y + top + bob, 8, 4);
    g.fillRect(p.x - 5 + lean, p.y + top + 3 + bob, 10, 2);
    g.fillStyle(vest);
    g.fillRect(
      torsoX + 2,
      torsoY + 1,
      prone ? 11 : 6,
      prone ? 4 : crouch ? 6 : 8,
    );
    // Original pixel clusters: vest webbing, magazine pouches, straps and fabric.
    g.fillStyle(0x23373c, .9);
    g.fillRect(torsoX + 2, torsoY + 2, 1, 7);
    g.fillRect(torsoX + 7, torsoY + 1, 1, 8);
    for(let pocket=0;pocket<3;pocket++) {
      g.fillStyle(pocket%2 ? 0x77867a : 0x637976);
      g.fillRect(torsoX+2+pocket*2,torsoY+5,2,3);
      g.fillStyle(0xb1b9a1,.55);g.fillRect(torsoX+2+pocket*2,torsoY+5,2,1);
    }
    g.fillStyle(u.team ? 0x414f43 : 0x3f5967,.8);
    g.fillRect(torsoX,torsoY+2,2,2);g.fillRect(torsoX+8,torsoY+7,2,3);
    // Helmet rim, crown highlight, chin strap and a dark eye-line.
    g.fillStyle(0x9aa99c,.8);g.fillRect(p.x-2+lean,p.y+top+1+bob,5,1);
    g.fillStyle(0x26363c);g.fillRect(p.x-4+lean,p.y+top+4+bob,8,1);
    g.fillRect(p.x+2+lean,p.y+top+5+bob,1,3);
    g.fillStyle(0xddd0b5,.7);g.fillRect(p.x-1+lean,p.y+top+6+bob,2,1);
    g.fillStyle(0x9aa6ad, 0.6);
    g.fillRect(torsoX + 3, torsoY + 3, 2, 2);
    if (!prone) {
      const legY = p.y - (crouch ? 6 : 8),
        stride = m.moving ? phase * (m.limp ? 1 : 2) : 0;
      g.fillStyle(vest);
      g.fillRect(p.x - 5, legY + stride, 3, crouch ? 4 : 7);
      g.fillRect(p.x + 2, legY - stride, 3, crouch ? 4 : 7);
      g.fillStyle(0x93a397,.6);
      g.fillRect(p.x-4,legY+stride,1,crouch?3:5);
      g.fillRect(p.x+3,legY-stride,1,crouch?3:5);
      g.fillStyle(0x35484a);g.fillRect(p.x-5,legY+2+stride,3,2);g.fillRect(p.x+2,legY+2-stride,3,2);
      g.fillStyle(0x17232c);
      g.fillRect(p.x - 6, legY + (crouch ? 3 : 6) + stride, 5, 2);
      g.fillRect(p.x + 1, legY + (crouch ? 3 : 6) - stride, 5, 2);
    } else {
      g.fillStyle(vest);
      g.fillRect(p.x + 8, p.y - 6 + (m.moving ? phase : 0), 8, 3);
      g.fillRect(p.x + 6, p.y - 2 - (m.moving ? phase : 0), 9, 3);
    }
    if (!down) {
      const aim = iso(u.x + Math.cos(m.direction), u.y + Math.sin(m.direction));
      let dx = aim.x - p.x,
        dy = aim.y - p.y,
        length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      const handY =
        p.y + (m.tucked ? -4 : crouch ? -11 : prone ? -6 : -14) + bob;
      // Sleeves and two bent forearms meet the weapon's authoritative hand axis.
      if (!["treating", "grenadePrep", "grenadeThrow"].includes(m.pose)) {
        g.lineStyle(3, cloth);
        g.lineBetween(p.x - 5 + lean, torsoY + 3, p.x - 5 + dx * 4, handY + 3);
        g.lineBetween(p.x + 5 + lean, torsoY + 3, p.x + 5 + dx * 4, handY + 3);
        g.lineStyle(2, skin);
        g.lineBetween(
          p.x - 5 + dx * 4,
          handY + 3,
          p.x + dx * 4,
          handY + dy * 4,
        );
        g.lineBetween(
          p.x + 5 + dx * 4,
          handY + 3,
          p.x + dx * 8,
          handY + dy * 8,
        );
      }
      const recoil = m.flash
        ? Math.min(m.mountState === "mounted" ? 1 : 2, fx.shot * 24)
        : 0;
      const barrel = u.role === "LMG" ? 17 : 13;
      if (["grenadePrep", "grenadeThrow"].includes(m.pose)) {
        g.lineStyle(3, skin);
        g.lineBetween(
          p.x + 4,
          torsoY + 3,
          p.x + 8,
          p.y + top + 5 - 4 * m.grenadeProgress,
        );
        g.fillStyle(0xb4b781);
        if (m.pose === "grenadePrep")
          g.fillRect(p.x + 6, p.y + top + 1 - 4 * m.grenadeProgress, 4, 5);
      } else if (m.pose === "treating") {
        const wave = Math.sin(m.treatmentProgress * Math.PI * 4) * 2;
        g.lineStyle(3, 0xe1c6a1);
        g.lineBetween(p.x - 4, handY, p.x + 3, handY + 6 + wave);
        g.lineBetween(p.x + 4, handY, p.x + 7, handY + 5 - wave);
        g.fillStyle(0x15212c);
        g.fillRect(p.x + 10, handY + 7, 7, 4);
        g.fillStyle(0xd6edda);
        g.fillRect(p.x + 12, handY + 7, 2, 4);
      } else {
        g.lineStyle(u.role === "LMG" ? 4 : 3, 0x15212c);
        g.lineBetween(
          p.x - dx * recoil,
          handY - dy * recoil,
          p.x + dx * (barrel - recoil),
          handY + dy * (barrel - recoil),
        );
        g.lineStyle(1, 0xa5ada4);
        g.lineBetween(
          p.x + dx * 5,
          handY + dy * 5,
          p.x + dx * (barrel - 2),
          handY + dy * (barrel - 2),
        );
        if (m.pose === "reloading") {
          const progress = m.reloadProgress,
            hand = Math.sin(progress * Math.PI * 2) * 4;
          g.fillStyle(0xe1c6a1);
          g.fillRect(p.x - 3 + hand, handY + 4, 4, 3);
          g.fillStyle(0x9aa89b);
          g.fillRect(p.x + hand, handY + 7, 3, 5);
          g.lineStyle(1, 0x87b7cf, 0.9);
          g.lineBetween(
            p.x - 7,
            p.y + top - 4,
            p.x - 7 + 14 * progress,
            p.y + top - 4,
          );
        } else {
          g.fillStyle(0xe1c6a1);
          g.fillRect(p.x + dx * 4 - 2, handY + dy * 4 - 1, 4, 3);
        }
        if (m.mountState !== "unsupported") {
          // Bipod and progress bar consume authoritative mount state only.
          const spread =
            m.mountState === "mounted"
              ? 4
              : 1 +
                3 *
                  (m.pose === "unmounting"
                    ? 1 - m.mountProgress
                    : m.mountProgress);
          const bx = p.x + dx * 12,
            by = handY + dy * 12;
          g.lineStyle(1, 0xd8ce94, 0.95);
          g.lineBetween(bx, by, bx - spread, by + 5);
          g.lineBetween(bx, by, bx + spread, by + 5);
          if (m.pose === "deploying" || m.pose === "unmounting") {
            g.lineStyle(2, m.pose === "deploying" ? 0xd8ce94 : 0x9eb7c7);
            g.lineBetween(
              p.x - 6,
              p.y + top - 4,
              p.x - 6 + 12 * m.mountProgress,
              p.y + top - 4,
            );
          }
        }
        if (m.flash) {
          const x = p.x + dx * barrel,
            y = handY + dy * barrel;
          g.fillStyle(0xffb85d, .045);g.fillCircle(x,y,21);
          g.fillStyle(0xffd18a,.08);g.fillCircle(x,y,16);
          g.fillStyle(0xffca65, 0.14);
          g.fillCircle(x, y, 13);
          g.fillStyle(0xfff0b4);
          g.fillTriangle(
            x + dx * 6,
            y + dy * 6,
            x - dy * 3,
            y + dx * 3,
            x + dy * 3,
            y - dx * 3,
          );
        }
      }
      if (m.injured) {
        g.fillStyle(0xa45d58);
        g.fillRect(p.x - 7, p.y + top + 12, 3, 2);
      }
    }
    if (m.pose === "observingCover") {
      g.lineStyle(1, 0xa3d3da, 0.8);
      g.lineBetween(p.x - 4, p.y + top - 4, p.x + 4, p.y + top - 4);
    }
    if (u.role === "LMG") {
      g.fillStyle(0x37483d);
      g.fillRect(p.x - 10, p.y + top + 10, 3, 6);
    }
    if (u.role === "Medic") {
      g.fillStyle(0xd9efe0);
      g.fillRect(p.x - 2, p.y + top + 12, 5, 2);
      g.fillRect(p.x, p.y + top + 10, 1, 6);
    }
    if (u.role === "Leader") {
      g.fillStyle(down ? 0x9a9172 : 0xf4d783);
      g.fillTriangle(
        p.x - 3,
        p.y + top - 6,
        p.x + 3,
        p.y + top - 6,
        p.x,
        p.y + top - 11,
      );
    }
    if (fx.hit > 0 && !u.dead) {
      g.lineStyle(2, 0xf2d0b0, 0.8);
      g.lineBetween(p.x - 12, p.y + top + 8, p.x - 8, p.y + top + 11);
      g.lineBetween(p.x + 8, p.y + top + 3, p.x + 11, p.y + top);
    }
    if (!u.dead && (fx.heal > 0 || fx.complete > 0)) {
      g.lineStyle(1, 0xb4e4b6, 0.85);
      g.strokeEllipse(p.x, p.y + 1, fx.complete > 0 ? 29 : 23, 13);
      if (fx.complete > 0) {
        g.fillStyle(0xb4e4b6);
        g.fillRect(p.x + 11, p.y + top - 5, 6, 2);
        g.fillRect(p.x + 13, p.y + top - 7, 2, 6);
      }
    }
    if (down) {
      g.lineStyle(2, u.dead ? 0x9a4646 : 0xf2c46a);
      g.lineBetween(p.x - 4, p.y - 5, p.x + 4, p.y + 3);
      g.lineBetween(p.x + 4, p.y - 5, p.x - 4, p.y + 3);
    }
  }
  drawTraces(g, iso) {
    for (const s of this.traces) {
      const a = iso(s.x, s.y),
        b = iso(s.targetX, s.targetY);
      g.lineStyle(1, 0xffe9ac, 0.55);
      g.lineBetween(a.x, a.y - 14, b.x, b.y - 14);
    }
  }
}
