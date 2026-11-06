// Aim selection reads radio snapshots only. Live bodies participate solely in
// physical projectile/near-miss resolution after an actual, paid-for shot.
import { contacts, markObservedFire, reportGunfire } from "./intelligence.js";
import { sight, terrainSight, cover } from "./world.js";
import { incomingFire, accuracyFactor } from "./tactics.js";
import { mountBonus } from "./mounting.js";
import { emitVisualEvent } from "./presentation-state.js";
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function segmentDistance(a, end, p) {
  const dx = end.x - a.x,
    dy = end.y - a.y,
    l = dx * dx + dy * dy;
  const t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : -1;
  return t < 0 || t > 1
    ? Infinity
    : Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function suppressionCandidate(b, u) {
  if (
    !b.tacticalEnabled ||
    !u.active ||
    u.role === "Medic" ||
    u.suppression > 0.55 ||
    u.reload > 0 ||
    u.ammo < (u.role === "LMG" ? 8 : 10) ||
    u.posture?.mode === "full" ||
    u.grenadePrep ||
    ["deploying", "unmounting"].includes(u.mount?.state)
  )
    return null;
  if (b.squads[u.team].maneuver?.unitId === u.id) return null;
  if (
    ["search", "escort", "recon", "care"].includes(u.assignment?.type) &&
    u.tacticalRole !== "support"
  )
    return null;
  return (
    contacts(b, u.team)
      .filter((c) => {
        const age = b.time - c.time;
        return (
          age >= 0.2 &&
          age < Math.min(b.contactTTL, u.role === "LMG" ? 5 : 2.5) &&
          c.confidence > 0.45 &&
          c.clearedAt == null &&
          dist(u, c) <= u.range &&
          sight(u, c) &&
          !b.units.some(
            (a) =>
              a !== u &&
              a.team === u.team &&
              !a.dead &&
              segmentDistance(u, c, a) < 0.6,
          )
        );
      })
      .sort(
        (a, c) => c.confidence - a.confidence || a.enemyId - c.enemyId,
      )[0] ?? null
  );
}
export function suppressiveFire(b, u) {
  const c = suppressionCandidate(b, u);
  if (!c) {
    if (u.suppressionTask) u.suppressionTask.active = false;
    return false;
  }
  let t = u.suppressionTask;
  if (!t || t.enemyId !== c.enemyId || t.observedAt !== c.time) {
    t = u.suppressionTask = {
      enemyId: c.enemyId,
      x: c.x,
      y: c.y,
      observedAt: c.time,
      readyAt: b.time + 0.3 + (u.id % 6) * 0.055,
      shots: 0,
      limit: u.role === "LMG" ? 10 : 2,
      active: true,
      reason: "Bounded pressure on credible last-observed firing lane",
    };
  }
  if (t.shots >= t.limit) {
    t.active = false;
    t.reason = "Remembered-lane shot budget exhausted";
    return false;
  }
  // A brief aim is preparation, never a fake shot, and never renews the snapshot.
  u.state = "Suppressing last-known";
  u.order = "Cover remembered lane; conserve ammunition";
  u.decisionReason = t.reason;
  u.facing = Math.atan2(c.y - u.y, c.x - u.x);
  t.active = true;
  if (b.time < t.readyAt || u.cooldown > 0) return true;
  u.ammo--;
  u.cooldown = u.role === "LMG" ? 0.2 : 0.65;
  u.firedAt = b.time;
  t.shots++;
  emitVisualEvent(b, "shot", u, {
    x: u.x,
    y: u.y,
    targetX: c.x,
    targetY: c.y,
    angle: u.facing,
    weapon: u.role === "LMG" ? "LMG" : "rifle",
    supported: u.mount?.state === "mounted",
    suppressive: true,
  });
  incomingFire(b, u, c, true);
  markObservedFire(b, u);
  if (b.searchEnabled) reportGunfire(b, u);
  const bodies = b.units
    .filter(
      (a) =>
        a.team !== u.team &&
        a.active &&
        dist(u, a) <= u.range &&
        segmentDistance(u, c, a) < 0.25 &&
        sight(u, a),
    )
    .sort((a, d) => dist(u, a) - dist(u, d));
  const hit = bodies[0];
  if (
    hit &&
    b.random() <
      0.12 * accuracyFactor(u) * mountBonus(u, "accuracy") * (1 - cover(hit, u))
  ) {
    const parts = [
      "head",
      "torso",
      "left arm",
      "right arm",
      "left leg",
      "right leg",
    ];
    const part = parts[Math.floor(b.random() * 6)];
    b.injury(hit, part, part === "head" ? 65 : 28 + b.random() * 24);
  }
  return true;
}
