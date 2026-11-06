// Small execution layer around the existing conditional flank planner.
import { terrainSight } from "./world.js";
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function coordinateFireMovement(b, team) {
  if (!b.tacticalEnabled) return;
  const q = b.squads[team],
    m =
      q.maneuver?.until > b.time && b.units[q.maneuver.unitId]?.active
        ? q.maneuver
        : null;
  const f = (q.fireMovement ??= {
    started: 0,
    completed: 0,
    aborted: 0,
    plan: null,
    next: 0,
  });
  if (b.time < f.next && m === f.plan) return;
  f.next = b.time + 0.5;
  if (f.plan !== m) {
    if (f.plan) {
      const old = f.plan,
        u = b.units[old.unitId];
      if (u?.active && dist(u, old.target) < 0.6) f.completed++;
      else f.aborted++;
    }
    f.plan = m ?? null;
    for (const u of b.units.filter((u) => u.team === team)) {
      u.tacticalRole = null;
      u.fireMovementReason = null;
    }
    if (m) {
      f.started++;
      m.supportStarted = b.time;
    }
  }
  if (!m || m.until <= b.time) return;
  const mover = b.units[m.unitId];
  const known = [...q.intel.contacts.values()].filter(
    (c) => b.time - c.time < b.contactTTL,
  );
  const support = b.units
    .filter(
      (u) =>
        u.team === team &&
        u !== mover &&
        u.active &&
        u.role !== "Medic" &&
        u.ammo >= 3 &&
        u.reload <= 0 &&
        u.suppression < 0.85 &&
        known.some((c) => dist(u, c) <= u.range && terrainSight(u, c)),
    )
    .sort(
      (a, c) =>
        (a.role === "LMG" ? -1 : 0) - (c.role === "LMG" ? -1 : 0) ||
        a.id - c.id,
    )
    .slice(
      0,
      Math.max(
        1,
        Math.min(
          2,
          b.units.filter((u) => u.team === team && u.active).length - 1,
        ),
      ),
    );
  m.supportIds = support.map((u) => u.id);
  for (const u of b.units.filter((u) => u.team === team)) {
    u.tacticalRole =
      u === mover
        ? "maneuver"
        : support.includes(u)
          ? "support"
          : u.role === "Medic"
            ? "care / local security"
            : null;
    u.fireMovementReason =
      u === mover
        ? "Reach improved protected angle under squad support"
        : support.includes(u)
          ? "Maintain pressure for assigned maneuver"
          : null;
  }
  if (support.some((u) => b.time - (u.firedAt ?? -Infinity) < 1.5))
    m.lastSupport = b.time;
}
export function maneuverSupported(b, u, m) {
  if (!b.tacticalEnabled || !m.supportIds) return true;
  if (b.time - (m.lastSupport ?? -Infinity) < 1.5) return true;
  if (b.time - (m.supportStarted ?? b.time) > 3) {
    m.until = b.time;
    u.decisionReason = "Maneuver canceled: supporting pressure unavailable";
    return false;
  }
  u.state = "Awaiting covering fire";
  u.order = "Brief support establishment before maneuver";
  u.decisionReason = "No recent shot from assigned support element";
  return false;
}
