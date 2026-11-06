import {
  reportIncoming,
  squadThreats,
  uncertainThreats,
} from "./intelligence.js";
import { mountBonus } from "./mounting.js";
import { blocked, cover, sight, path } from "./world.js";

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const accuracyFactor = (u) => 1 - 0.65 * u.suppression;
export function decaySuppression(u, dt) {
  u.suppression = Math.max(0, u.suppression - 0.12 * dt);
}

// The existing hitscan trace also supplies near-miss pressure. Walls stop pressure.
export function incomingFire(battle, shooter, target) {
  const dx = target.x - shooter.x,
    dy = target.y - shooter.y,
    length2 = dx * dx + dy * dy;
  for (const u of battle.units) {
    if (!u.active || u.team === shooter.team) continue;
    const t = length2
      ? Math.max(
          0,
          Math.min(
            1,
            ((u.x - shooter.x) * dx + (u.y - shooter.y) * dy) / length2,
          ),
        )
      : 0;
    const near = distance(u, { x: shooter.x + t * dx, y: shooter.y + t * dy });
    if (near <= 0.9 && sight(shooter, u)) {
      reportIncoming(battle, u, shooter);
      u.suppression = Math.min(
        1,
        u.suppression +
          (shooter.role === "LMG" ? 0.2 : 0.12) *
            mountBonus(shooter, "suppression") *
            (1 - 0.5 * cover(u, shooter)),
      );
    }
  }
}

export function exposure(position, threats) {
  return threats.reduce(
    (risk, t) =>
      Math.max(risk, sight(position, t) ? 1 - cover(position, t) : 0),
    0,
  );
}
export function routeRisk(route, threats) {
  let total = 0,
    run = 0,
    longest = 0;
  for (const [x, y] of route) {
    const risk = exposure({ x, y }, threats);
    total += risk;
    if (risk > 0.75) run++;
    else run = 0;
    longest = Math.max(longest, run);
  }
  return { average: total / Math.max(1, route.length), longest };
}
export function positionScore(u, p, threats) {
  if (blocked(Math.round(p.x), Math.round(p.y))) return -Infinity;
  const protection = threats.reduce(
    (v, t) => Math.min(v, sight(p, t) ? cover(p, t) : 0.85),
    1,
  );
  const firing = threats.some((t) => sight(p, t) && distance(p, t) <= u.range);
  const range = Math.min(...threats.map((t) => distance(p, t)));
  return (
    protection * (3 + u.suppression * 2) +
    (firing ? (u.role === "Medic" ? 0.25 : 1.5) : 0) -
    exposure(p, threats) * (1 + u.suppression) -
    Math.abs(range - u.range * 0.65) * 0.06 -
    distance(u, p) * 0.12
  );
}

// Bounded local search; only the best ten candidates incur a BFS. Hysteresis
// compares a candidate to the current position, so good cover has no movement timer.
// Tactical destination selection uses friendly locations and reported snapshots,
// while the physical movement solver still prevents all actual collisions.
export function planningCellFree(battle, u, p) {
  if (blocked(Math.round(p.x), Math.round(p.y))) return false;
  if (
    battle.units.some(
      (a) => a !== u && a.team === u.team && !a.dead && distance(a, p) < 0.6,
    )
  )
    return false;
  return ![...u.intel.contacts.values()].some(
    (c) => c.time === battle.time && distance(c, p) < 0.6,
  );
}
export function protectionAt(p, threats) {
  return threats.length
    ? Math.min(...threats.map((t) => (sight(p, t) ? cover(p, t) : 0.85)))
    : 0;
}
export function chooseCover(battle, u, threats) {
  u.coverEvaluation ??= {};
  u.coverEvaluation.best = null;
  const current = positionScore(u, u, threats),
    protection = protectionAt(u, threats),
    firing = threats.some(
      (t) => !t.approximate && sight(u, t) && distance(u, t) <= u.range,
    ),
    candidates = [];
  for (let dx = -3; dx <= 3; dx++)
    for (let dy = -3; dy <= 3; dy++) {
      const p = { x: Math.round(u.x) + dx, y: Math.round(u.y) + dy };
      if (distance(u, p) < 0.5 || !planningCellFree(battle, u, p)) continue;
      if (
        u.failedGoal &&
        u.failedGoal.until > battle.time &&
        distance(p, u.failedGoal) < 0.8
      )
        continue;
      if (
        battle.units.some(
          (a) =>
            a !== u &&
            a.team === u.team &&
            a.active &&
            a.coverTarget &&
            distance(a.coverTarget, p) < 0.8,
        )
      )
        continue;
      // Keep an effective firing lane unless pressure genuinely warrants shelter.
      if (protectionAt(p, threats) < protection + 0.27) continue;
      if (
        firing &&
        u.suppression < 0.7 &&
        !threats.some(
          (t) => !t.approximate && sight(p, t) && distance(p, t) <= u.range,
        )
      )
        continue;
      const score = positionScore(u, p, threats);
      if (score > current + 0.65) candidates.push({ ...p, score });
    }
  candidates.sort((a, b) => b.score - a.score);
  for (const p of candidates.slice(0, 10)) {
    const route = path(u, p);
    if (!route.length || route.length > 8) continue;
    const risk = routeRisk(route, threats);
    if (u.suppression > 0.55 && risk.longest > 2) continue;
    if (p.score - risk.average * 0.6 > current + 0.65) {
      u.coverEvaluation.best = {
        x: p.x,
        y: p.y,
        score: p.score,
        protection: protectionAt(p, threats),
      };
      return { x: p.x, y: p.y };
    }
  }
  return null;
}

export function planFlank(battle, team, threats) {
  // Approximate bearings and aging snapshots cannot justify a maneuver.
  threats = threats.filter((t) => !t.approximate && (t.confidence ?? 1) > 0.6);

  const squad = battle.squads[team],
    alive = battle.units.filter((u) => u.team === team && u.active);
  const leader =
    alive.find((u) => u.id === squad.commanderId) ??
    alive.find((u) => u.role === "Leader");
  if (
    !leader ||
    alive.length < 4 ||
    !threats.length ||
    battle.time < (squad.flankCooldown ?? 0)
  )
    return null;
  const pinned =
    alive.filter((u) => u.suppression > 0.45).length >= 2 ||
    alive.some((u) => u.suppression >= 0.8);
  if (!pinned && battle.time - (squad.lastProgress ?? battle.time) < 12)
    return null;
  const covering = alive.filter(
    (u) =>
      u.ammo > 0 &&
      u.reload <= 0 &&
      u.suppression < 0.85 &&
      threats.some((t) => distance(u, t) <= u.range && sight(u, t)),
  );
  if (covering.length < 2) return null;
  const threat = threats[0],
    d = distance(leader, threat) || 1,
    dx = (threat.x - leader.x) / d,
    dy = (threat.y - leader.y) / d;
  const candidates = alive.filter(
    (u) =>
      u.role === "Rifleman" &&
      u.suppression < 0.45 &&
      u.ammo >= 5 &&
      u.health.torso > 50 &&
      u.health["left leg"] + u.health["right leg"] > 120,
  );
  for (const u of candidates) {
    const choices = [];
    for (const side of [-1, 1])
      for (const lateral of [3, 4, 5, 6])
        for (const forward of [-2, 0, 2, 4]) {
          const p = {
            x: Math.round(u.x + dx * forward - dy * lateral * side),
            y: Math.round(u.y + dy * forward + dx * lateral * side),
          };
          if (
            !planningCellFree(battle, u, p) ||
            distance(p, threat) < 3 ||
            distance(p, threat) > u.range ||
            !sight(p, threat)
          )
            continue;
          if (
            cover(p, threat) < 0.25 ||
            Math.abs((p.x - leader.x) * dy - (p.y - leader.y) * dx) < 3
          )
            continue;
          choices.push({ target: p, score: positionScore(u, p, threats) });
        }
    choices.sort((a, b) => b.score - a.score);
    const viable = [];
    for (const choice of choices.slice(0, 6)) {
      const route = path(u, choice.target);
      if (!route.length || route.length > 18) continue;
      const risk = routeRisk(route, threats);
      if (risk.average > 0.6 || risk.longest > 3) continue;
      // Leave at least two capable shooters behind, including the machine gunner.
      if (covering.filter((a) => a !== u).length < 2) continue;
      viable.push({ target: choice.target, risk: risk.average, route });
    }
    viable.sort((a, b) => a.risk - b.risk || a.route.length - b.route.length);
    if (viable.length)
      return {
        unitId: u.id,
        target: viable[0].target,
        threat: { ...threat },
        until: battle.time + 14,
      };
  }
  return null;
}

export function updateSquadTactics(battle, team) {
  const squad = battle.squads[team];
  if (battle.time < (squad.nextTactical ?? 0)) return;
  squad.nextTactical = battle.time + 3;
  const alive = battle.units.filter((u) => u.team === team && u.active);
  const threats = squadThreats(battle, team);
  if (!threats.length) {
    if (squad.maneuver)
      squad.flankCooldown = Math.max(
        squad.flankCooldown ?? 0,
        battle.time + 24,
      );
    const reports = battle.squads[team].intel;
    squad.intention = reports?.casualties.size
      ? "Protect casualty"
      : reports?.incoming.size
        ? "Assess reported sector"
        : "Advance";
    squad.maneuver = null;
    squad.lastProgress = battle.time;
    return;
  }
  squad.lastProgress ??= battle.time;
  const m = squad.maneuver,
    u = m && alive.find((a) => a.id === m.unitId);
  if (
    m &&
    u &&
    m.until > battle.time &&
    u.suppression < 0.65 &&
    u.health.torso > 50 &&
    u.health["left leg"] + u.health["right leg"] > 120 &&
    distance(u, m.target) > 0.5 &&
    threats.some(
      (t) =>
        (m.threat.enemyId == null || t.enemyId === m.threat.enemyId) &&
        distance(t, m.threat) < 3,
    )
  )
    return;
  if (m) {
    squad.maneuver = null;
    squad.flankCooldown = battle.time + 24;
  }
  squad.intention = "Hold and engage";
  if (battle.time < (squad.flankCooldown ?? 0)) return;
  squad.maneuver = planFlank(battle, team, threats);
  if (squad.maneuver) {
    squad.intention = "Cover and maneuver";
    squad.flankCooldown = battle.time + 30;
  }
}

export function localCover(battle, u, threats, dt) {
  if (!threats.length) return false;
  const protection = protectionAt(u, threats),
    risk = exposure(u, threats);
  const focus = threats.reduce(
    (a, t) => (exposure(u, [t]) > exposure(u, [a]) ? t : a),
    threats[0],
  );
  const direction = Math.atan2(focus.y - u.y, focus.x - u.x);
  const changed =
    u.coverDirection != null &&
    Math.abs(
      Math.atan2(
        Math.sin(direction - u.coverDirection),
        Math.cos(direction - u.coverDirection),
      ),
    ) > 0.6;
  const first = u.coverDirection == null;
  const urgent = protection < 0.28 && u.suppression > 0.65;
  const d = (u.coverEvaluation ??= {});
  Object.assign(d, {
    protection,
    exposure: risk,
    score: positionScore(u, u, threats),
  });
  if (first || changed || (urgent && !u.coverUrgent))
    u.nextAssessment = battle.time;
  u.coverUrgent = urgent;
  if (
    battle.time >= u.nextAssessment &&
    (!u.coverTarget || changed || battle.time > u.coverUntil)
  ) {
    d.evaluatedAt = battle.time;
    u.nextAssessment = battle.time + 1.5 + (u.id % 6) * 0.12;
    u.coverDirection = direction;
    const squad = battle.squads[u.team];
    const moving = new Set(
      battle.units
        .filter(
          (a) =>
            a !== u &&
            a.team === u.team &&
            a.active &&
            a.coverTarget &&
            distance(a, a.coverTarget) > 0.2,
        )
        .map((a) => a.id),
    );
    if (squad.maneuver?.until > battle.time && squad.maneuver.unitId !== u.id)
      moving.add(squad.maneuver.unitId);
    for (const a of squad.assignments?.values() ?? [])
      if (
        a.unitId !== u.id &&
        a.type === "recon" &&
        !a.failed &&
        distance(battle.units[a.unitId], a.target) > 0.5
      )
        moving.add(a.unitId);
    const committed =
      battle.time < (u.positionUntil ?? 0) &&
      protection >= 0.28 &&
      !changed &&
      !urgent;
    // Assess before reporting a coordination/commitment blocker: diagnostics can
    // distinguish an unavailable useful candidate from no improvement at all.
    const previous = u.coverTarget;
    let candidate = chooseCover(battle, u, threats);
    const hasLane = (p) =>
      threats.some(
        (t) => !t.approximate && sight(p, t) && distance(p, t) <= u.range,
      );
    const keep =
      previous &&
      planningCellFree(battle, u, previous) &&
      !(
        u.failedGoal &&
        u.failedGoal.until > battle.time &&
        distance(previous, u.failedGoal) < 0.8
      ) &&
      protectionAt(previous, threats) >= 0.28 &&
      positionScore(u, previous, threats) >
        positionScore(u, u, threats) + 0.35 &&
      (u.suppression >= 0.7 || !hasLane(u) || hasLane(previous)) &&
      (!candidate ||
        positionScore(u, candidate, threats) <
          positionScore(u, previous, threats) + 0.65);
    if (keep) candidate = previous;
    const blockedBy =
      candidate && committed && !keep
        ? "position commitment"
        : candidate && moving.size >= 2 && !urgent && !keep
          ? "squad fire-and-movement budget"
          : null;
    d.blockedBy = blockedBy;
    u.coverTarget = blockedBy ? null : candidate;
    d.reason = keep
      ? "Retain useful committed cover destination; alternative gain insufficient"
      : blockedBy
        ? "Preserve firing support; defer relocation"
        : candidate
          ? "Meaningful directional protection gain; reachable route"
          : protection >= 0.28
            ? "Current protection adequate; no meaningful firing-position improvement"
            : "No reachable meaningful improvement; retain combat initiative";
    u.coverUntil = battle.time + 8;
    if (candidate && !blockedBy && !keep) {
      u.coverRelocationStarted = battle.time;
      u.coverEmergency = urgent;
      if (urgent)
        d.reason =
          "Urgent directional protection gain overrides movement budget";
    }
  }
  if (!u.coverTarget) return false;
  if (distance(u, u.coverTarget) < 0.2) {
    u.coverTarget = null;
    u.positionUntil = battle.time + 5;
    u.nextAssessment = battle.time + 1;
    d.reason = "Reached protected firing position";
    d.blockedBy = null;
    u.coverRelocations = (u.coverRelocations ?? 0) + 1;
    return false;
  }
  u.state = "Seeking cover";
  u.order = "Improve protected firing position";
  u.decisionReason = d.reason;
  if (battle.move(u, u.coverTarget, dt) === false) {
    u.coverTarget = null;
    u.nextAssessment = battle.time + 1;
    d.blockedBy = "navigation failure";
    d.reason = "Cover route failed; reject destination and retain combat";
    return false;
  }
  return true;
}

// Revalidate a committed maneuver against fresh observations and congestion
// detours; abort rather than turn a safe flank into an exposed charge.
export function followManeuver(battle, u, m, dt) {
  if (!m || m.unitId !== u.id || m.until <= battle.time || !u.active)
    return false;
  const squad = battle.squads[u.team];
  const leader = battle.units.find(
    (a) =>
      a.team === u.team &&
      a.active &&
      (a.id === squad.commanderId ||
        (squad.commanderId == null && a.role === "Leader")),
  );
  if (
    u.suppression >= 0.65 ||
    u.health.torso <= 50 ||
    u.health["left leg"] + u.health["right leg"] <= 120 ||
    !leader
  ) {
    m.until = battle.time;
    return false;
  }
  if (battle.time >= (m.checkAt ?? 0)) {
    m.checkAt = battle.time + 0.75;
    const threats = squadThreats(battle, u.team);
    const route =
      u.routeGoal === `${m.target.x},${m.target.y}`
        ? u.route
        : path(u, m.target);
    const risk = routeRisk(route, threats);
    if (
      !threats.length ||
      risk.average > 0.6 ||
      risk.longest > 3 ||
      !threats.some(
        (t) =>
          (m.threat.enemyId == null || t.enemyId === m.threat.enemyId) &&
          distance(t, m.threat) <= 3,
      )
    ) {
      m.until = battle.time;
      return false;
    }
    const support = battle.units.filter(
      (a) =>
        a.team === u.team &&
        a !== u &&
        a.active &&
        a.ammo > 0 &&
        a.reload <= 0 &&
        a.suppression < 0.85 &&
        threats.some((t) => distance(a, t) <= a.range && sight(a, t)),
    );
    if (support.length < 2) {
      m.until = battle.time;
      return false;
    }
  }
  u.decisionSource = "squad leader";
  u.state = "Flanking";
  u.order = squad.intention;
  if (battle.move(u, m.target, dt) === false) {
    m.until = battle.time;
    return false;
  }
  return true;
}

export function careRouteSafe(battle, u, patient) {
  if (
    u.failedGoal &&
    u.failedGoal.until > battle.time &&
    distance(patient, u.failedGoal) < 1
  )
    return false;
  const threats = [
    ...squadThreats(battle, u.team),
    ...uncertainThreats(battle, u),
  ];
  const threatKey = threats
    .map(
      (t) =>
        `${t.enemyId ?? "bearing"}:${Math.round(t.x * 2)},${Math.round(t.y * 2)}`,
    )
    .sort()
    .join(";");
  if (
    !u.careCheck ||
    u.careCheck.threatKey !== threatKey ||
    battle.time >= u.careCheck.until ||
    u.careCheck.patientId !== patient.id ||
    distance(u.careCheck.origin, u) > 1 ||
    distance(u.careCheck.patient, patient) > 1
  ) {
    const route = path(u, patient),
      risk = routeRisk(route, threats);
    u.careCheck = {
      threatKey,
      patientId: patient.id,
      origin: { x: u.x, y: u.y },
      patient: { x: patient.x, y: patient.y },
      until: battle.time + 0.75,
      safe: route.length > 0 && risk.average <= 0.6 && risk.longest <= 3,
    };
  }
  return u.careCheck.safe;
}
