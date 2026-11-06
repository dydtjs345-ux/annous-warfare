import { blocked, sight, cover, path, blastTransmission } from "./world.js";
import { emitVisualEvent } from "./presentation-state.js";
export const FRAG = Object.freeze({
  range: 7,
  minRange: 4.2,
  prepare: 0.7,
  flight: 0.65,
  fuse: 2.1,
  radius: 3.5,
  damage: 120,
  squadCooldown: 8,
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function initializeGrenades(b, enabled = false) {
  b.grenadesEnabled = enabled;
  b.grenades = [];
  b.grenadeSerial = 0;
  b.grenadeStats = {
    thrown: 0,
    detonated: 0,
    effective: 0,
    friendlyHits: 0,
    detections: 0,
    reactions: 0,
    safeReactions: 0,
  };
  for (const u of b.units) {
    u.frags = enabled && ["Leader", "Rifleman"].includes(u.role) ? 1 : 0;
    u.grenadePrep = null;
  }
}
export function friendlyRisk(b, u, target) {
  const nearSegment = (a, c) => {
    const dx = c.x - a.x,
      dy = c.y - a.y,
      n = dx * dx + dy * dy;
    const t = n
      ? Math.max(
          0,
          Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / n),
        )
      : 0;
    return (
      distance(target, { x: a.x + t * dx, y: a.y + t * dy }) < FRAG.radius + 0.6
    );
  };
  return b.units.some((a) => {
    if (a.team !== u.team || a.dead) return false;
    if (distance(a, target) < FRAG.radius + 0.6) return true;
    if (
      !a.presentation.moving &&
      a.assignment?.type !== "recon" &&
      !a.coverTarget
    )
      return false;
    let budget =
        1.7 *
        (0.25 + (0.75 * (a.health["left leg"] + a.health["right leg"])) / 200) *
        FRAG.fuse,
      p = { x: a.x, y: a.y };
    for (const [x, y] of a.route ?? []) {
      const d = distance(p, { x, y });
      if (!d) continue;
      const step = Math.min(d, budget),
        q = {
          x: p.x + ((x - p.x) * step) / d,
          y: p.y + ((y - p.y) * step) / d,
        };
      if (nearSegment(p, q)) return true;
      p = q;
      budget -= step;
      if (budget <= 0) break;
    }
    return false;
  });
}
export function grenadeOpportunity(b, u) {
  if (
    !b.grenadesEnabled ||
    !u.active ||
    !u.frags ||
    u.health["left arm"] + u.health["right arm"] < 80 ||
    (b.squads[u.team].grenadePreparer != null &&
      b.squads[u.team].grenadePreparer !== u.id) ||
    u.reload > 0 ||
    u.suppression > 0.45 ||
    u.assignment?.type === "recon" ||
    u.coverTarget ||
    u.presentation.moving ||
    b.time < (b.squads[u.team].grenadeAfter ?? 0) ||
    b.grenades.some((g) => g.team === u.team && !g.detonatedAt)
  )
    return null;
  const seen = (u.visibleEnemies ?? []).filter((e) => e.active && sight(u, e));
  for (const e of seen) {
    const d = distance(u, e);
    if (d < FRAG.minRange || d > FRAG.range || friendlyRisk(b, u, e)) continue;
    const cluster = seen.filter((a) => distance(a, e) < 1.8).length;
    if (
      cluster < 2 &&
      !(
        cover(e, u) >= 0.58 &&
        b.time - (b.squads[u.team].lastProgress ?? b.time) > 3
      )
    )
      continue;
    return {
      x: e.x,
      y: e.y,
      enemyId: e.id,
      reason:
        cluster >= 2
          ? "Confirmed cluster; friend-safe throw"
          : "Confirmed defended position; ineffective rifle fire",
    };
  }
  return null;
}
export function detonate(b, g) {
  g.detonatedAt = b.time;
  b.grenadeStats.detonated++;
  let effective = false;
  for (const u of b.units) {
    if (u.dead) continue;
    const d = distance(u, g.target);
    if (d >= FRAG.radius) continue;
    const pressure =
      (1 - d / FRAG.radius) ** 2 * blastTransmission(g.target, u);
    if (pressure <= 0.001) continue;
    u.suppression = Math.min(1, u.suppression + 0.8 * pressure);
    const amount = FRAG.damage * pressure;
    // Deterministic radial fragment envelope; existing body-part injury thresholds
    // decide casualties. No random-number draw and no team immunity.
    for (const [part, scale] of [
      ["head", 0.35],
      ["torso", 0.65],
      ["left leg", 0.8],
      ["right arm", 0.5],
    ])
      b.injury(u, part, amount * scale);
    if (amount > 1 && u.team === g.team) b.grenadeStats.friendlyHits++;
    if (amount > 10 && u.team !== g.team) effective = true;
  }
  if (effective) b.grenadeStats.effective++;
  emitVisualEvent(b, "grenadeBlast", b.units[g.throwerId], {
    x: g.target.x,
    y: g.target.y,
  });
  for (const u of b.units) {
    const t = u.knownGrenades?.get(g.id);
    if (t?.reacted && u.active) {
      const risk =
        Math.max(0, 1 - distance(u, g.target) / FRAG.radius) ** 2 *
        blastTransmission(g.target, u);
      if (risk < t.initialRisk * 0.5) b.grenadeStats.safeReactions++;
    }
    u.knownGrenades?.delete(g.id);
    if (u.grenadeThreat?.id === g.id) u.grenadeThreat = null;
  }
}
export function updateGrenades(b) {
  if (!b.grenadesEnabled) return;
  for (const squad of b.squads) {
    const u = b.units[squad.grenadePreparer];
    if (!u?.active || !u.grenadePrep) squad.grenadePreparer = null;
  }
  for (const g of b.grenades) {
    if (g.detonatedAt) continue;
    const t = Math.min(1, (b.time - g.thrownAt) / FRAG.flight);
    g.position = {
      x: g.start.x + (g.target.x - g.start.x) * t,
      y: g.start.y + (g.target.y - g.start.y) * t,
    };
    if (b.time >= g.detonateAt) {
      detonate(b, g);
      continue;
    }
    // Grounded grenades must be seen at close range. No perfect mid-flight landing
    // prediction or squad-wide omniscient awareness is granted.
    if (t >= 1)
      for (const u of b.units) {
        if (
          !u.active ||
          distance(u, g.position) > 6 ||
          !sight(u, g.position) ||
          u.knownGrenades?.has(g.id)
        )
          continue;
        u.knownGrenades ??= new Map();
        u.knownGrenades.set(g.id, {
          id: g.id,
          x: g.position.x,
          y: g.position.y,
          readyAt: b.time + 0.25 + 0.07 * (u.id % 3) + u.suppression * 0.2,
          initialRisk:
            Math.max(0, 1 - distance(u, g.position) / FRAG.radius) ** 2 *
            blastTransmission(g.position, u),
        });
        b.grenadeStats.detections++;
      }
  }
  for (const u of b.units) {
    const memories = [...(u.knownGrenades?.values() ?? [])];
    memories.sort((a, c) => {
      const risk = (t) =>
        Math.max(0, 1 - distance(u, t) / FRAG.radius) ** 2 *
        blastTransmission(t, u);
      return risk(c) - risk(a) || a.readyAt - c.readyAt;
    });
    u.grenadeThreat = memories[0] ?? null;
  }
  b.grenades = b.grenades.filter(
    (g) => !g.detonatedAt || b.time - g.detonatedAt < 0.6,
  );
}
function evade(b, u, dt) {
  const t = u.grenadeThreat;
  if (!t || b.time < t.readyAt) return false;
  const g = b.grenades.find((g) => g.id === t.id && !g.detonatedAt);
  if (!g) return false;
  const risk = (p) =>
    Math.max(0, 1 - distance(p, t) / FRAG.radius) ** 2 *
    blastTransmission(t, p);
  if (risk(u) < 0.04) return false;
  if (!t.destination) {
    const choices = [];
    for (let dx = -3; dx <= 3; dx++)
      for (let dy = -3; dy <= 3; dy++) {
        const p = { x: Math.round(u.x) + dx, y: Math.round(u.y) + dy };
        if (
          blocked(p.x, p.y) ||
          b.units.some(
            (a) =>
              a !== u && a.team === u.team && !a.dead && distance(a, p) < 0.65,
          )
        )
          continue;
        const r = risk(p);
        if (r >= risk(u) * 0.6) continue;
        choices.push({ ...p, score: r + distance(u, p) * 0.025 });
      }
    choices.sort((a, c) => a.score - c.score);
    for (const p of choices.slice(0, 8)) {
      const route = path(u, p);
      if (route.length && route.length <= 5) {
        t.destination = { x: p.x, y: p.y };
        if (!t.reacted) {
          b.grenadeStats.reactions++;
          t.initialRisk = risk(u);
        }
        t.reacted = true;
        break;
      }
    }
  }
  if (!t.destination) return false;
  u.grenadePrep = null;
  u.state = "Evading grenade";
  u.order = "Immediate grenade survival; retain squad task";
  u.decisionSource = "immediate threat";
  u.decisionReason = "Observed grounded grenade; delayed emergency response";
  u.assignmentPause = "grenade survival";
  b.move(u, t.destination, dt);
  return true;
}
export function grenadeAction(b, u, dt) {
  if (!b.grenadesEnabled) return false;
  if (evade(b, u, dt)) return true;
  if (u.grenadePrep) {
    const p = u.grenadePrep;
    if (
      u.suppression > 0.6 ||
      u.health["left arm"] + u.health["right arm"] < 80 ||
      !u.active ||
      friendlyRisk(b, u, p) ||
      !sight(u, p)
    ) {
      u.grenadePrep = null;
      b.squads[u.team].grenadePreparer = null;
      return false;
    }
    u.state = "Preparing grenade";
    u.order = p.reason;
    u.decisionReason = p.reason;
    u.assignmentPause = "grenade preparation";
    u.facing = Math.atan2(p.y - u.y, p.x - u.x);
    if (b.time - p.startedAt >= FRAG.prepare) {
      u.frags--;
      u.grenadeThrownAt = b.time;
      b.grenadeStats.thrown++;
      b.squads[u.team].grenadeAfter = b.time + FRAG.squadCooldown;
      b.grenades.push({
        id: ++b.grenadeSerial,
        team: u.team,
        throwerId: u.id,
        start: { x: u.x, y: u.y },
        target: { x: p.x, y: p.y },
        position: { x: u.x, y: u.y },
        thrownAt: b.time,
        detonateAt: b.time + FRAG.fuse,
      });
      emitVisualEvent(b, "grenadeThrow", u, { x: p.x, y: p.y });
      u.grenadePrep = null;
      u.state = "Throwing grenade";
    }
    return true;
  }
  const p = grenadeOpportunity(b, u);
  if (!p) return false;
  b.squads[u.team].grenadePreparer = u.id;
  u.grenadePrep = { ...p, startedAt: b.time };
  u.state = "Preparing grenade";
  u.order = p.reason;
  u.decisionReason = p.reason;
  u.assignmentPause = "grenade preparation";
  return true;
}
