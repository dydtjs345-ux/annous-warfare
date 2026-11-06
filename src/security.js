// Observation is directional and LOS-limited; navigation never follows a gun barrel.
import { sight, blocked, streetAt } from "./world.js";
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export function observes(u, p) {
  if (!sight(u, p)) return false;
  if (u.observationHeading == null) return true;
  if (Math.hypot(p.x - u.x, p.y - u.y) <= 2.5) return true;
  return Math.cos(angle(u, p) - u.observationHeading) >= Math.cos(1.4);
}
export function updateSecurity(b, u) {
  if (!b.tacticalEnabled || !u.active) return;
  u.initialObservationHeading ??= u.facing;
  const focus = [...u.intel.contacts.values()].find(
    (c) => c.enemyId === u.engagementId && b.time - c.time < 0.7,
  );
  if (focus) {
    u.observationHeading = angle(u, focus);
    u.scanReason = "Follow a recently confirmed engagement snapshot";
    return;
  }
  if (b.time < (u.nextScanAt ?? 0)) return;
  u.nextScanAt = b.time + 0.9 + (u.id % 6) * 0.08;
  const offsets = [0, Math.PI / 2, -Math.PI / 2, 0, Math.PI];
  const slot = (Math.floor(b.time / 1.2) + (u.id % 6)) % offsets.length;
  u.observationHeading =
    (u.movementHeading ?? u.initialObservationHeading) + offsets[slot];
  u.scanReason =
    slot === 4
      ? "Rear security"
      : slot === 1 || slot === 2
        ? "Check side approach"
        : "Observe route ahead";
  if (b.time - (u.firedAt ?? -Infinity) > 0.15) u.facing = u.observationHeading;
}
export function formationDesired(b, u, lead, slot) {
  const q = b.squads[u.team];
  const f = (q.formation ??= {
    mode: "staggered",
    next: 0,
    candidate: null,
    since: b.time,
  });
  const heading =
    lead.movementHeading ??
    Math.atan2(q.search.goal.y - lead.y, q.search.goal.x - lead.x);
  const dx = Math.cos(heading),
    dy = Math.sin(heading);
  if (b.time >= f.next) {
    f.next = b.time + 1.5;
    const narrow = [-1, 1].some((side) =>
      blocked(
        Math.round(lead.x - dy * 1.3 * side),
        Math.round(lead.y + dx * 1.3 * side),
      ),
    );
    const separated = b.units.some(
      (a) =>
        a.team === u.team &&
        a.active &&
        Math.hypot(a.x - lead.x, a.y - lead.y) > 14,
    );
    const desired = narrow
      ? "loose column"
      : separated
        ? "compact regroup"
        : streetAt(Math.round(lead.x), Math.round(lead.y))
          ? "staggered"
          : "dispersed";
    if (f.candidate !== desired) {
      f.candidate = desired;
      f.since = b.time;
    } else if (b.time - f.since >= 2) f.mode = desired;
  }
  const side = slot % 2 ? 1 : -1;
  const behind =
    f.mode === "loose column"
      ? 2 + slot * 1.35
      : f.mode === "compact regroup"
        ? 1.8 + Math.floor(slot / 2)
        : 2.5 + Math.floor(slot / 2) * 1.3;
  const lateral =
    f.mode === "loose column"
      ? 0.25
      : f.mode === "compact regroup"
        ? 0.8
        : f.mode === "dispersed"
          ? 2
          : 1.2;
  u.formationMode = f.mode;
  return {
    x: lead.x - dx * behind - dy * lateral * side,
    y: lead.y - dy * behind + dx * lateral * side,
  };
}
