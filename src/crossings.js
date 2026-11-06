// Bounded traffic reservations on existing routes, never an independent order.
import { streetAt, terrainSight, cover } from "./world.js";
import { squadThreats, uncertainThreats } from "./intelligence.js";
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const road = (p) => streetAt(Math.round(p.x), Math.round(p.y));
export function crossingSegment(u, route) {
  if (road(u)) return null;
  const points = route.slice(0, 12).map(([x, y]) => ({ x, y }));
  const first = points.findIndex(road);
  if (first < 0 || dist(u, points[first]) > 1.5) return null;
  let last = first;
  while (last < points.length && road(points[last])) last++;
  if (last === points.length || last - first > 6 || last - first < 2)
    return null;
  const entry = points[first],
    exit = points[last],
    axis = Math.abs(exit.x - u.x) > Math.abs(exit.y - u.y) ? "x" : "y";
  return {
    entry,
    exit,
    key: `${axis}:${Math.floor((axis === "x" ? entry.x : entry.y) / 13)}:${Math.floor((axis === "x" ? entry.y : entry.x) / 8)}`,
  };
}
export function crossingPermit(b, u, route) {
  if (!b.tacticalEnabled) return true;
  const q = b.squads[u.team],
    stats = (q.crossingStats ??= {
      completed: 0,
      waits: 0,
      emergency: 0,
      expired: 0,
    });
  let gate = q.crossing;
  if (gate) {
    for (const [id, a] of gate.active) {
      const unit = b.units[id];
      if (road(unit)) a.entered = true;
      if (
        a.entered &&
        !road(unit) &&
        (unit.x - a.entry.x) * (a.exit.x - a.entry.x) +
          (unit.y - a.entry.y) * (a.exit.y - a.entry.y) >=
          (a.exit.x - a.entry.x) ** 2 + (a.exit.y - a.entry.y) ** 2 - 0.5
      ) {
        stats.completed++;
        gate.active.delete(id);
      } else if (
        !unit.active ||
        b.time - (unit.lastMoveCall ?? a.at) > 3 ||
        (!a.entered && b.time - a.at > 3)
      )
        gate.active.delete(id);
    }
    if (b.time - gate.at > 8) {
      stats.expired++;
      q.crossing = null;
      gate = null;
    }
  }
  u.crossingWaitUntil = 0;
  const segment = crossingSegment(u, route);
  if (!segment) return true;
  const threats = [...squadThreats(b, u.team), ...uncertainThreats(b, u)];
  if (!threats.length) return true;
  const risky = threats.some(
    (t) => terrainSight(segment.entry, t) && cover(segment.entry, t) < 0.28,
  );
  if (!risky) return true;
  const urgent =
    u.state === "Evading grenade" ||
    u.suppression > 0.65 ||
    u.hit > 0 ||
    threats.some((t) => terrainSight(u, t) && cover(u, t) < 0.28);
  if (urgent) {
    u.crossingAt = b.time;
    u.crossingReason = "Emergency crossing: staying at exposed entry is unsafe";
    stats.emergency++;
    return true;
  }
  if (!gate || gate.key !== segment.key) {
    gate = q.crossing = { key: segment.key, at: b.time, active: new Map() };
  }
  const capacity =
    b.units.filter((a) => a.team === u.team && a.active).length >= 4 ? 2 : 1;
  if (gate.active.has(u.id) || gate.active.size < capacity) {
    if (!gate.active.has(u.id))
      gate.active.set(u.id, { ...segment, at: b.time, entered: false });
    u.crossingAt = b.time;
    u.crossingReason = "Cross in a small element; other soldiers observe";
    return true;
  }
  stats.waits++;
  u.crossingWaitUntil = b.time + 0.25;
  u.crossingAt = b.time;
  u.crossingReason =
    "Observe while the current crossing element clears the road";
  u.state = "Covering crossing";
  u.order = "Cover crossing; retain assigned destination";
  u.decisionReason = u.crossingReason;
  u.holdReason = u.crossingReason;
  u.navigation = "Waiting for crossing element";
  // Pause only the route watchdog; actual movement/progress counters stay honest.
  u.navProgressAt = b.time;
  return false;
}
