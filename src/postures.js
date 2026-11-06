// Authoritative low-cover height changes. Rendering only reads these decisions.
import { cover, terrainSight, shelteredAt } from "./world.js";
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const MOVEMENT = new Set([
  "Seeking cover",
  "Flanking",
  "Reacquiring contact",
  "Searching sector",
  "Searching district",
  "Following search element",
  "Moving to casualty",
  "Evading grenade",
]);
export function updatePosture(b, u) {
  if (!b.tacticalEnabled) return;
  const p = (u.posture ??= {
    mode: "sustained",
    since: b.time,
    until: 0,
    reason: "No aligned shelter",
    transitions: 0,
  });
  const known = [...u.intel.contacts.values()].filter(
    (c) => b.time - c.time < b.contactTTL && c.clearedAt == null,
  );
  const threat = known.find(
    (c) => dist(u, c) <= u.range && terrainSight(u, c) && shelteredAt(u, c),
  );
  const flanked = known.some(
    (c) => dist(u, c) <= u.range && terrainSight(u, c) && cover(u, c) < 0.28,
  );
  const transit =
    u.presentation.moving ||
    MOVEMENT.has(u.state) ||
    u.tacticalRole === "maneuver";
  const next = (mode, duration, reason) => {
    if (p.mode !== mode) {
      p.transitions++;
      p.since = b.time;
    }
    p.mode = mode;
    p.until = b.time + duration;
    p.reason = reason;
  };
  if (!u.active || !threat || transit || u.grenadePrep || flanked) {
    next(
      "sustained",
      0,
      !u.active
        ? "Combat ineffective"
        : flanked
          ? "Known unprotected flank requires a combat response"
          : transit
            ? "Movement takes priority"
            : "No credible aligned low-cover threat",
    );
    return;
  }
  p.direction = Math.atan2(threat.y - u.y, threat.x - u.x);
  if (u.reload > 0 || u.suppression > 0.78) {
    next(
      "full",
      0.5,
      u.reload > 0
        ? "Reload protected by aligned cover"
        : "Recover under heavy pressure",
    );
    return;
  }
  if (b.time < p.until) return;
  const phase = ((u.id * 37) % 11) / 10;
  if (p.mode === "full") {
    const support = u.role === "LMG" || u.tacticalRole === "support";
    next(
      support ? "sustained" : "peek",
      support ? 2.4 + phase : 0.85 + phase * 0.45 - u.suppression * 0.3,
      support
        ? "Maintain supporting firing lane"
        : "Brief deliberate exposure to engage",
    );
  } else
    next(
      "full",
      0.65 + phase * 0.45 + u.suppression * 0.6,
      "Return behind low cover and reassess",
    );
}
export function holdPosture(b, u) {
  if (u.posture?.mode !== "full" || !u.active) return false;
  u.state = "Full cover";
  u.order = "Shelter; reassess known threat";
  u.decisionReason = u.posture.reason;
  u.holdReason = u.posture.reason;
  return true;
}
export function releasePosture(u) {
  if (u.posture?.mode === "full") {
    u.posture.mode = "sustained";
    u.posture.until = 0;
    u.posture.reason = "Movement requires leaving shelter";
  }
}
