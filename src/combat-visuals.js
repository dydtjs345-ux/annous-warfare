// Render-only clocks/effects. Movement phase comes from distance actually moved;
// reload/treatment phases come from real counters, never invented action timers.
const EFFECT_TIMERS = ["shot", "hit", "heal", "complete", "fall"];
const NO_COMBAT = new Set(["dead", "incapacitated", "treating", "reloading"]);
const CROUCHED = new Set([
  "treating",
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
  out.reloadProgress = p.reloadProgress;
  out.treatmentProgress = u.treat ?? 0;
  out.stride = p.traveled * Math.PI * 2;
  out.direction = u.facing;
  out.crawl = legs < 35;
  out.limp = legs < 70;
  if (u.dead) out.pose = "dead";
  else if (!u.active) out.pose = "incapacitated";
  else if (p.treating) out.pose = "treating";
  else if (p.reloading) out.pose = "reloading";
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
  out.combat = u.active && !NO_COMBAT.has(out.pose);
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
      prone = down || m.crawl;
    const crouch = CROUCHED.has(m.pose) || (m.covered && !m.moving);
    const bob = m.moving
      ? m.limp
        ? Math.max(0, phase) * 1.4
        : phase * (m.pose === "running" ? 1.8 : 1)
      : 0;
    const lean = m.pose === "seekingCover" ? 2 : 0;
    let top = prone ? -9 : crouch ? -19 : -27;
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
    const body = down
      ? u.dead
        ? u.team
          ? 0x806661
          : 0x526f66
        : u.team
          ? 0x9f8077
          : 0x739e90
      : u.team
        ? 0xd69283
        : 0x83d7c0;
    g.fillStyle(body);
    g.fillRect(
      p.x - 7 + lean,
      p.y + top + 7 + bob,
      prone ? 18 : 13,
      prone ? 6 : crouch ? 10 : 14,
    );
    g.lineStyle(1, 0x18242a);
    g.strokeRect(
      p.x - 7 + lean,
      p.y + top + 7 + bob,
      prone ? 18 : 13,
      prone ? 6 : crouch ? 10 : 14,
    );
    g.fillStyle(down ? 0x525c51 : u.team ? 0x5e6550 : 0x667957);
    g.fillRect(p.x - 5 + lean, p.y + top + bob, 10, 7);
    g.fillStyle(down ? 0xa3927c : 0xe1c6a1);
    g.fillRect(p.x - 3 + lean, p.y + top + 6 + bob, 6, 4);
    if (!prone) {
      g.fillStyle(0x18242a);
      const leg = crouch ? 4 : 8;
      g.fillRect(p.x - 6, p.y - 7 + (m.moving ? phase * 2 : 0), 4, leg);
      g.fillRect(
        p.x + 2,
        p.y - 7 - (m.moving ? (m.limp ? phase : phase * 2) : 0),
        4,
        leg,
      );
    } else if (m.moving) {
      g.fillStyle(0x18242a);
      g.fillRect(p.x + 6, p.y - 5 + phase, 7, 2);
    }
    if (!down) {
      const aim = iso(u.x + Math.cos(m.direction), u.y + Math.sin(m.direction));
      let dx = aim.x - p.x,
        dy = aim.y - p.y,
        length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      const handY = p.y + (crouch ? -11 : prone ? -6 : -14) + bob;
      const recoil = m.flash ? Math.min(2, fx.shot * 24) : 0;
      const barrel = u.role === "LMG" ? 17 : 13;
      if (m.pose === "treating") {
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
        if (m.flash) {
          const x = p.x + dx * barrel,
            y = handY + dy * barrel;
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
