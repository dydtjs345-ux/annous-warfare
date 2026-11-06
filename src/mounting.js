// Conservative map contract: only explicitly mountable low barricade materials
// are supports. Fences, vehicles, crates and solid house walls never qualify.
import { obstacles, key, blocked, sight, cover, material } from "./world.js";
import { emitVisualEvent } from "./presentation-state.js";
export const MOUNT = Object.freeze({
  deploy: 0.8,
  unmount: 0.35,
  cooldown: 3,
  halfArc: Math.PI / 4,
  accuracy: 1.12,
  suppression: 1.15,
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const delta = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export function mountSite(u, enemy) {
  if (!u.active) return { reason: "Combat ineffective" };
  if (
    !enemy ||
    !enemy.active ||
    !sight(u, enemy) ||
    distance(u, enemy) > u.range
  )
    return { reason: "No direct in-range firing lane" };
  if (blocked(Math.round(u.x), Math.round(u.y)))
    return { reason: "Position inside obstacle" };
  const direction = angle(u, enemy);
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const p = { x: Math.round(u.x) + dx, y: Math.round(u.y) + dy };
      const d = distance(u, p);
      if (!material(obstacles.get(key(p.x, p.y))).mount || d < 0.55 || d > 1.35)
        continue;
      if (delta(direction, angle(u, p)) > Math.PI / 5 || cover(u, enemy) < 0.58)
        continue;
      return {
        position: { x: u.x, y: u.y },
        obstacle: p,
        direction,
        reason: "Low barricade in firing direction; clear lane",
      };
    }
  return { reason: "No aligned low-wall support" };
}
function transition(b, u, state, reason) {
  u.mount.state = state;
  u.mount.since = b.time;
  u.mount.reason = reason;
  emitVisualEvent(b, "mountState", u, { state, direction: u.mount.direction });
}
export function releaseMount(b, u, reason = "Repositioning required") {
  if (!u.mount || u.mount.state === "unsupported") return true;
  if (!u.active) {
    u.mount.state = "unsupported";
    u.mount.reason = "Combat ineffective";
    return false;
  }
  if (u.mount.state !== "unmounting") {
    transition(b, u, "unmounting", reason);
    u.mount.readyAt = b.time + MOUNT.unmount;
    u.mount.retryAt = b.time + MOUNT.unmount + MOUNT.cooldown;
  }
  return false;
}
export function updateMount(b, u, enemy) {
  if (u.role !== "LMG") return;
  const m = (u.mount ??= {
    state: "unsupported",
    reason: "Not assessed",
    since: b.time,
    retryAt: 0,
  });
  if (!u.active) {
    m.state = "unsupported";
    m.reason = "Combat ineffective";
    return;
  }
  if (m.state === "unmounting") {
    if (b.time + 1e-8 >= m.readyAt) transition(b, u, "unsupported", m.reason);
    return;
  }
  const site = mountSite(u, enemy);
  const flanked =
    !!enemy &&
    (u.visibleEnemies ?? []).some(
      (t) =>
        t.active &&
        sight(u, t) &&
        distance(u, t) < u.range * 0.75 &&
        cover(u, t) < 0.28 &&
        delta(
          angle(u, t),
          m.state === "unsupported" ? angle(u, enemy) : m.direction,
        ) > MOUNT.halfArc,
    );
  if (m.state === "mounted" || m.state === "deploying") {
    const moved = distance(u, m.position) > 0.15;
    const invalid =
      enemy &&
      (!site.position ||
        site.obstacle.x !== m.obstacle.x ||
        site.obstacle.y !== m.obstacle.y ||
        delta(angle(u, enemy), m.direction) > MOUNT.halfArc);
    if (
      moved ||
      flanked ||
      invalid ||
      u.suppression > 0.85 ||
      (!enemy && b.time - (u.lastConfirmedAt ?? 0) > 1.5)
    ) {
      releaseMount(
        b,
        u,
        moved
          ? "Position changed"
          : flanked
            ? "Exposed flank threat"
            : u.suppression > 0.85
              ? "Unsafe incoming pressure"
              : invalid
                ? "Firing direction / lane unsuitable"
                : "Contact lost",
      );
      return;
    }
    if (m.state === "deploying" && b.time + 1e-8 >= m.readyAt)
      transition(b, u, "mounted", "Supported firing lane ready");
    return;
  }
  m.reason = site.reason;
  if (
    !site.position ||
    flanked ||
    u.reload > 0 ||
    u.ammo <= 0 ||
    u.suppression > 0.6 ||
    u.coverTarget ||
    b.time < m.retryAt
  ) {
    if (flanked) m.reason = "Exposed flank threat";
    else if (u.reload > 0) m.reason = "Reloading";
    else if (u.ammo <= 0) m.reason = "No loaded ammunition";
    else if (b.time < m.retryAt) m.reason = "Reposition / remount cooldown";
    else if (u.coverTarget) m.reason = "Cover repositioning in progress";
    else if (u.suppression > 0.6) m.reason = "Too suppressed to deploy";
    return;
  }
  Object.assign(m, site);
  transition(b, u, "deploying", "Deploying on aligned low barricade");
  m.readyAt = b.time + MOUNT.deploy;
}
export function mountBonus(u, kind) {
  return u.active && u.mount?.state === "mounted" ? MOUNT[kind] : 1;
}
