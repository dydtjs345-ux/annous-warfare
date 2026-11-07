import { FRAG } from "./grenades.js";
// One fixed-step visual buffer; never extrapolates or writes a soldier.
export const angleDelta = (a, b) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));
const mix = (a, b, t) => a + (b - a) * t;
const crouched = new Set([
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
function snapshot(b, u, out = {}) {
  out.x = u.x;
  out.y = u.y;
  out.stride = u.presentation.traveled * Math.PI * 2;
  out.reload = u.presentation.reloadProgress;
  out.reloading = u.presentation.reloading;
  out.treat = u.treat ?? 0;
  out.treating = u.presentation.treating;
  out.mount = u.mount?.state;
  out.mountProgress =
    u.mount?.readyAt > u.mount?.since
      ? Math.max(
          0,
          Math.min(
            1,
            (b.time - u.mount.since) / (u.mount.readyAt - u.mount.since),
          ),
        )
      : 0;
  out.grenade = u.grenadePrep
    ? Math.min(1, (b.time - u.grenadePrep.startedAt) / FRAG.prepare)
    : 0;
  return out;
}

function turn(from, to, dt, rate) {
  const delta = angleDelta(from, to);
  return (
    from +
    Math.max(-rate * dt, Math.min(rate * dt, delta * (1 - Math.exp(-dt * 24))))
  );
}
export class MotionPresentation {
  constructor() {
    this.battle = null;
    this.records = [];
    this.views = [];
  }
  ensure(b) {
    if (this.battle === b) return;
    this.battle = b;
    this.records = b.units.map((u) => ({
      previous: snapshot(b, u),
      x: u.x,
      y: u.y,
      direction: u.facing,
      observation: u.observationHeading ?? u.facing,
      movement: u.movementHeading ?? u.facing,
      top: null,
      hand: null,
      leg: null,
      view: Object.create(u),
    }));
    this.views = this.records.map((r) => r.view);
  }
  beforeStep(b) {
    this.ensure(b);
    for (const u of b.units) snapshot(b, u, this.records[u.id].previous);
  }
  update(b, models, alpha, realDt, speed = 1, paused = false) {
    this.ensure(b);
    const t = Math.max(0, Math.min(1, alpha)),
      dt = paused ? 0 : Math.min(realDt, 0.05),
      rate = 12 * Math.sqrt(speed);
    for (const u of b.units) {
      const r = this.records[u.id],
        m = models[u.id],
        p = r.previous;
      if (!m) continue;
      const reset = !u.active || Math.hypot(u.x - p.x, u.y - p.y) > 0.6;
      if (!paused || r.top == null) {
        r.x = reset ? u.x : mix(p.x, u.x, t);
        r.y = reset ? u.y : mix(p.y, u.y, t);
        if (u.active)
          r.direction = m.flash
            ? m.direction
            : turn(
                r.direction,
                m.direction,
                dt,
                rate * (m.pose === "aiming" ? 2 : 1),
              );
        if (u.active)
          r.observation = turn(
            r.observation,
            u.observationHeading ?? u.facing,
            dt,
            rate,
          );
        if (u.active)
          r.movement = turn(
            r.movement,
            u.movementHeading ?? u.facing,
            dt,
            rate,
          );
        const low = crouched.has(m.pose) || (m.covered && !m.moving),
          prone = m.crawl || m.tucked;
        const target = prone ? -9 : low ? -20 : -30,
          hand = m.tucked ? -4 : prone ? -6 : low ? -11 : -14,
          leg = low ? -6 : -8;
        const blend = 1 - Math.exp(-dt * 24 * Math.sqrt(speed));
        // New full concealment and real shots must never display an upright hidden body
        // or a lagging gun. Other stance changes ease over a short settling interval.
        if (r.top == null || m.tucked || m.flash || reset) {
          r.top = target;
          r.hand = hand;
          r.leg = leg;
        } else {
          r.top = mix(r.top, target, blend);
          r.hand = mix(r.hand, hand, blend);
          r.leg = mix(r.leg, leg, blend);
        }
        m.renderStride = reset ? m.stride : mix(p.stride, m.stride, t);
        m.renderReloadProgress =
          p.reloading && u.presentation.reloading
            ? mix(p.reload, m.reloadProgress, t)
            : m.reloadProgress;
        m.renderTreatmentProgress =
          p.treating && u.presentation.treating
            ? mix(
                p.treat,
                m.treatmentProgress + (m.treatmentProgress < p.treat ? 1 : 0),
                t,
              )
            : m.treatmentProgress;
        m.renderMountProgress =
          p.mount === u.mount?.state
            ? mix(p.mountProgress, m.mountProgress, t)
            : m.mountProgress;
        m.renderGrenadeProgress = u.grenadePrep
          ? mix(p.grenade, m.grenadeProgress, t)
          : m.grenadeProgress;
      }
      m.renderDirection = m.flash ? m.direction : r.direction;
      m.renderTop = u.active ? r.top : undefined;
      m.renderHandHeight = u.active ? r.hand : undefined;
      m.renderLegOffset = r.leg;
      r.view.x = r.x;
      r.view.y = r.y;
      r.view.facing = r.direction;
      r.view.observationHeading = r.observation;
      r.view.movementHeading = r.movement;
    }
  }
  position(u) {
    return (this.battle && this.records[u.id]?.view) || u;
  }
}
