import { blocked, key, sight, cover } from "./world.js";
import { contacts, squadThreats, uncertainThreats } from "./intelligence.js";
import {
  distance,
  planningCellFree,
  localCover,
  careRouteSafe,
} from "./tactics.js";

export function commanderFor(battle, team) {
  const order = { Leader: 0, Rifleman: 1, LMG: 2, Medic: 3 };
  return (
    battle.units
      .filter((u) => u.team === team && u.active)
      .sort((a, b) => order[a.role] - order[b.role] || a.id - b.id)[0] ?? null
  );
}
export function recordCombatLoss(battle, u) {
  const squad = battle.squads[u.team];
  squad.lossEvents ??= [];
  squad.lossRevision = (squad.lossRevision ?? 0) + 1;
  squad.lossEvents.push({
    revision: squad.lossRevision,
    unitId: u.id,
    role: u.role,
    at: battle.time,
    kind: u.dead ? "killed" : "incapacitated",
    position: { x: u.x, y: u.y },
    previousAssignment: u.assignment?.type ?? null,
  });
  squad.assignments?.delete(u.id);
  u.assignment = null;
  squad.lossEvents = squad.lossEvents.slice(-12);
  squad.intel.lossEvents = squad.lossEvents;
  squad.nextCoordination = Math.min(
    squad.nextCoordination ?? Infinity,
    battle.time + 0.45,
  );
}

// Tiny priority queue for bounded risk-weighted navigation, independent of RNG.
class Queue {
  constructor() {
    this.items = [];
  }
  push(n) {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= n.cost) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = n;
  }
  pop() {
    const a = this.items,
      first = a[0],
      last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].cost < a[c].cost) c++;
        if (a[c].cost >= last.cost) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = last;
    }
    return first;
  }
  get length() {
    return this.items.length;
  }
}
export function knownRisk(p, threats) {
  let risk = 0;
  for (const t of threats) {
    const rangeWeight = Math.max(0, Math.min(1, (18 - distance(p, t)) / 4));
    const confidence = t.confidence ?? 1;
    if (rangeWeight && sight(p, t))
      risk = Math.max(risk, (1 - cover(p, t)) * confidence * rangeWeight);
  }
  return risk;
}
function routeTo(n) {
  const route = [];
  while (n.prev) {
    route.unshift([n.x, n.y]);
    n = n.prev;
  }
  return route;
}
export function observationPlan(battle, u, area, threats) {
  // A coarse historical sector may be centered on a wall. Observe a nearby
  // walkable map cell; never substitute a hidden enemy's current position.
  if (blocked(Math.round(area.x), Math.round(area.y))) {
    outer: for (let radius = 1; radius <= 4; radius++)
      for (const [dx, dy] of [
        [0, -radius],
        [-radius, 0],
        [radius, 0],
        [0, radius],
      ]) {
        const p = { x: Math.round(area.x) + dx, y: Math.round(area.y) + dy };
        if (!blocked(p.x, p.y)) {
          area = p;
          break outer;
        }
      }
  }
  const heap = new Queue(),
    seen = new Map(),
    cells = new Map(),
    riskCache = new Map();
  const start = {
    x: Math.round(u.x),
    y: Math.round(u.y),
    cost: 0,
    steps: 0,
    run: 0,
    prev: null,
  };
  heap.push(start);
  seen.set(`${start.x},${start.y},0`, 0);
  const rejects = { unsafe: 0, occupied: 0, noBenefit: 0, failed: 0 };
  let expanded = 0;
  const risk = (p) => {
    const k = key(p.x, p.y);
    if (!riskCache.has(k)) riskCache.set(k, knownRisk(p, threats));
    return riskCache.get(k);
  };
  while (heap.length && expanded < 900) {
    const n = heap.pop(),
      state = `${n.x},${n.y},${n.run}`;
    if (n.cost !== seen.get(state)) continue;
    expanded++;
    const cell = key(n.x, n.y);
    if (!cells.has(cell) || n.cost < cells.get(cell).cost) cells.set(cell, n);
    if (n.steps >= 30) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const p = { x: n.x + dx, y: n.y + dy };
      if (blocked(p.x, p.y)) continue;
      if (
        battle.units.some(
          (a) =>
            a !== u && a.team === u.team && !a.dead && distance(a, p) < 0.6,
        )
      )
        continue;
      if (!n.prev) {
        let clear = true;
        for (let t = 0.2; t <= 1.001; t += 0.2) {
          const point = { x: u.x + (p.x - u.x) * t, y: u.y + (p.y - u.y) * t };
          if (
            blocked(Math.round(point.x), Math.round(point.y)) ||
            battle.units.some(
              (a) =>
                a !== u &&
                a.team === u.team &&
                !a.dead &&
                distance(a, point) < 0.6,
            )
          )
            clear = false;
        }
        if (!clear) continue;
      }
      const r = risk(p),
        run = r > 0.75 ? n.run + 1 : 0;
      if (run > 3) {
        rejects.unsafe++;
        continue;
      }
      const cost = n.cost + 1 + r * 3,
        k = `${p.x},${p.y},${run}`;
      if (cost > 65 || cost >= (seen.get(k) ?? Infinity)) continue;
      seen.set(k, cost);
      heap.push({ ...p, cost, steps: n.steps + 1, run, prev: n });
    }
  }
  let best = null,
    bestView = null;
  for (const n of cells.values()) {
    if (n.steps < 2 || distance(u, n) < 1) continue;
    if (!planningCellFree(battle, u, n)) {
      rejects.occupied++;
      continue;
    }
    if (
      (u.failedGoal?.until > battle.time && distance(n, u.failedGoal) < 1) ||
      u.recentReconGoals?.some(
        (g) => g.until > battle.time && distance(g, n) < 1,
      )
    ) {
      rejects.failed++;
      continue;
    }
    if (
      [...(battle.squads[u.team].assignments?.values() ?? [])].some(
        (a) =>
          a.unitId !== u.id &&
          a.type === "recon" &&
          a.target &&
          distance(a.target, n) < 1,
      )
    ) {
      rejects.occupied++;
      continue;
    }
    const view = sight(n, area) && distance(n, area) <= u.range;
    const gain = distance(u, area) - distance(n, area);
    if (distance(n, area) < 3 || (!view && (gain < 1 || risk(n) > 0.6))) {
      rejects.noBenefit++;
      continue;
    }
    const score =
      (view ? 9 : Math.min(gain, 8) * 0.7 + 1) +
      cover(n, area) * 1.5 -
      n.cost * 0.16;
    if (!best || score > best.score)
      best = {
        target: { x: n.x, y: n.y },
        route: routeTo(n),
        score,
        view,
        travel: n.steps,
        risk: risk(n),
      };
    if (view && (!bestView || score > bestView.score))
      bestView = {
        target: { x: n.x, y: n.y },
        route: routeTo(n),
        score,
        view,
        travel: n.steps,
        risk: risk(n),
      };
  }
  best = bestView ?? best;
  if (best && !best.view) {
    // A short approach is useful only if its terrain component can eventually
    // observe the area. Do not pace inside an entirely sealed house.
    const todo = [{ x: start.x, y: start.y }],
      visited = new Set([key(start.x, start.y)]);
    let possible = false;
    for (let i = 0; i < todo.length; i++) {
      const p = todo[i],
        d = distance(p, area);
      if (d >= 3 && d <= u.range && sight(p, area)) {
        possible = true;
        break;
      }
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = { x: p.x + dx, y: p.y + dy },
          k = key(n.x, n.y);
        if (
          !visited.has(k) &&
          !blocked(n.x, n.y) &&
          !battle.units.some(
            (a) =>
              a !== u && a.team === u.team && !a.dead && distance(a, n) < 0.6,
          )
        ) {
          visited.add(k);
          todo.push(n);
        }
      }
    }
    if (!possible) best = null;
  }
  return {
    plan: best,
    rejects,
    expanded,
    reason: best
      ? best.view
        ? "Reachable observation lane"
        : "Safe intermediate approach to observation area"
      : `No reachable observation/approach in ${expanded} examined states (unsafe ${rejects.unsafe}, occupied ${rejects.occupied}, no benefit ${rejects.noBenefit}, failed ${rejects.failed})`,
  };
}

function actionableCare(battle, u) {
  return battle.units.some(
    (a) =>
      a !== u &&
      a.team === u.team &&
      !a.dead &&
      Math.min(...Object.values(a.health)) < 65 &&
      ((distance(u, a) < 1.4 && sight(u, a)) || careRouteSafe(battle, u, a)),
  );
}
function progressFor(u, time) {
  return (u.progress ??= {
    anchor: { x: u.x, y: u.y },
    lastMovement: null,
    lastSight: null,
    lastEngagement: null,
    lastTreatment: null,
    lastObjective: time,
    lastUseful: 0,
    failedAttempts: 0,
  });
}
function setAssignment(battle, squad, u, type, reason, extra = {}) {
  const old = squad.assignments.get(u.id);
  if (old?.type === type && type !== "recon") {
    old.reason = reason;
    old.commanderId = squad.commanderId;
    u.assignment = old;
    return old;
  }
  const a = {
    unitId: u.id,
    type,
    source: "squad leader",
    commanderId: squad.commanderId,
    at: battle.time,
    reason,
    ...extra,
  };
  squad.assignments.set(u.id, a);
  u.assignment = a;
  progressFor(u, battle.time).lastObjective = battle.time;
  squad.assignmentRevision = (squad.assignmentRevision ?? 0) + 1;
  return a;
}
export function coordinateSquad(battle, team) {
  const squad = battle.squads[team];
  if (battle.time < (squad.nextCoordination ?? 0)) return;
  squad.nextCoordination = battle.time + 1.5;
  squad.assignments ??= new Map();
  const alive = battle.units.filter((u) => u.team === team && u.active),
    commander = commanderFor(battle, team);
  if (!commander) return;
  const changed = squad.commanderId !== commander.id;
  squad.commanderId = commander.id;
  const loss = squad.lossEvents?.at(-1),
    casualty = (squad.handledLoss ?? 0) !== (squad.lossRevision ?? 0);
  if (casualty) {
    squad.handledLoss = squad.lossRevision;
    squad.casualtyReplans = (squad.casualtyReplans ?? 0) + 1;
    for (const u of alive)
      u.casualtyResponse = {
        at: battle.time,
        text: `Reassessed after ${loss.role} #${loss.unitId} ${loss.kind}; commander #${commander.id}`,
      };
  }
  if (casualty && !squad.lastSector)
    squad.lastSector = {
      x: Math.round(loss.position.x / 4) * 4,
      y: Math.round(loss.position.y / 4) * 4,
      at: battle.time,
      origin: "casualty area",
    };
  const known = contacts(battle, team).sort(
    (a, b) => b.confidence - a.confidence || b.time - a.time,
  );
  if (known.length) {
    const c = known[0];
    squad.lastSector = {
      x: Math.round(c.x / 4) * 4,
      y: Math.round(c.y / 4) * 4,
      at: c.time,
    };
  }
  const sector =
    !known.length &&
    squad.lastSector &&
    battle.time - squad.lastSector.at <
      (squad.lastSector.origin === "casualty area" ? 6 : battle.contactTTL + 20)
      ? squad.lastSector
      : null;
  const area = known[0] ?? sector;
  const threats = squadThreats(battle, team);
  for (const [id, a] of squad.assignments) {
    const u = battle.units[id];
    if (!u?.active) {
      squad.assignments.delete(id);
      continue;
    }
    u.assignment = a;
    a.commanderId = squad.commanderId;
    if (a.type === "recon") {
      if (u.role === "Medic" && actionableCare(battle, u)) {
        squad.assignments.delete(id);
        u.assignment = null;
        u.coverTarget = null;
        u.alternativeRejection =
          "Leader releases medic recon for actionable casualty care";
        continue;
      }
      if (
        a.contactId != null &&
        !known.some((c) => c.enemyId === a.contactId)
      ) {
        a.contactId = null;
        a.sector = true;
        a.area = {
          x: Math.round(a.area.x / 4) * 4,
          y: Math.round(a.area.y / 4) * 4,
        };
        a.reason =
          "Contact expired; continue committed observation approach as sector search";
      }
      const direct = (u.visibleEnemies ?? []).some(
        (e) => e.active && distance(u, e) <= u.range && sight(u, e),
      );
      const completed = distance(u, a.target) < 0.3 || direct;
      const changedContact = known.find((c) => c.enemyId === a.contactId);
      if (
        changedContact &&
        distance(changedContact, a.area) > 6 &&
        !sight(a.target, changedContact)
      ) {
        a.failed = true;
        u.alternativeRejection =
          "Confirmed contact left the assigned observation area";
      }
      const expired = battle.time > a.until;
      if (completed || expired || a.failed) {
        if (completed) {
          u.recentReconGoals ??= [];
          u.recentReconGoals.push({ ...a.target, until: battle.time + 8 });
          u.recentReconGoals = u.recentReconGoals.filter(
            (g) => g.until > battle.time,
          );
        }
        squad.assignments.delete(id);
        u.assignment = null;
        u.coverTarget = null;
        u.reconRetryAt = battle.time + (a.failed ? 2 : completed ? 1.5 : 3);
      }
    }
  }
  // Only live, progressing local moves reserve space; stale labels cannot consume recon slots.
  for (const u of alive)
    if (
      u.coverTarget &&
      !(u.visibleEnemies ?? []).some((e) => e.active) &&
      battle.time - (u.navProgressAt ?? 0) > 2
    )
      u.coverTarget = null;
  const recon = [...squad.assignments.values()].filter(
    (a) => a.type === "recon",
  );
  if (!area) {
    for (const u of alive)
      if (squad.assignments.has(u.id)) {
        squad.assignments.delete(u.id);
        u.assignment = null;
      }
    return;
  }
  const budget = alive.length >= 4 ? 2 : 1;
  const movingCover = alive.filter(
    (u) =>
      u.coverTarget &&
      battle.time - (u.navProgressAt ?? 0) < 2 &&
      distance(u, u.coverTarget) > 0.2,
  ).length;
  const fit = (a) =>
    a.active &&
    a.ammo > 0 &&
    a.reload <= 0 &&
    a.suppression < 0.55 &&
    a.health.torso > 35 &&
    a.health["left leg"] + a.health["right leg"] > 60;
  const stalled =
    alive.length > 0 &&
    alive.every((a) => battle.time - (a.progress?.lastUseful ?? 0) > 12);
  const noFitFighter = !alive.some((a) => a.role !== "Medic" && fit(a));
  if (recon.length + movingCover < budget && !squad.maneuver) {
    const eligible = alive.filter((u) => {
      let reason = null;
      if (squad.assignments.get(u.id)?.type === "recon")
        reason = "Committed recon objective still active";
      else if (u.suppression >= 0.55)
        reason = "Suppression makes recon exposure unsafe";
      else if (u.reload > 0)
        reason = "Reloading; investigator must be combat-ready";
      else if (u.ammo <= 0) reason = "No loaded ammunition for recon";
      else if (
        (u.health.torso <= 35 &&
          !(
            stalled &&
            noFitFighter &&
            u.health.torso >= 25 &&
            u.suppression < 0.35
          )) ||
        u.health["left leg"] + u.health["right leg"] <= 60
      )
        reason = "Injuries require a defensive role";
      else if (battle.time < (u.reconRetryAt ?? 0))
        reason = u.lastPlanRejection
          ? `${u.lastPlanRejection}; brief retry cooldown`
          : "Brief retry cooldown after completed/failed task";
      else if (u.alert && battle.time < u.alert.readyAt)
        reason = "Reaction delay before new assignment";
      else if (
        (u.visibleEnemies ?? []).some(
          (e) => e.active && distance(u, e) <= u.range && sight(u, e),
        )
      )
        reason = "Preserve current direct firing opportunity";
      else if (
        u.role === "Medic" &&
        (alive.some(
          (a) =>
            a !== u &&
            a.role !== "Medic" &&
            (a.ammo > 0 || a.reserve > 0) &&
            !(stalled && noFitFighter),
        ) ||
          actionableCare(battle, u))
      )
        reason = "Medic reserved for survival and actionable casualty care";
      if (reason) {
        u.alternativeRejection = reason;
        return false;
      }
      return true;
    });
    const role = { Rifleman: 0, Leader: 1, LMG: 2, Medic: 3 };
    eligible.sort(
      (a, b) =>
        role[a.role] - role[b.role] ||
        (a.progress?.lastUseful ?? 0) - (b.progress?.lastUseful ?? 0) ||
        a.id - b.id,
    );
    const options = [];
    for (const u of eligible.slice(0, 3)) {
      const result = observationPlan(battle, u, area, threats);
      u.alternativeRejection = result.plan ? null : result.reason;
      u.alternativeChecks = result.expanded;
      if (result.plan) {
        u.lastPlanRejection = null;
        options.push({ u, ...result });
      } else {
        u.lastPlanRejection = result.reason;
        u.reconRetryAt = battle.time + 3;
      }
    }
    options.sort(
      (a, b) =>
        b.plan.score - a.plan.score + (role[a.u.role] - role[b.u.role]) * 0.35,
    );
    const chosen = options[0];
    if (chosen) {
      const { u, plan } = chosen;
      const a = setAssignment(
        battle,
        squad,
        u,
        "recon",
        stalled && noFitFighter
          ? `Cautious survivor reassessment: ${chosen.reason}`
          : chosen.reason,
        {
          target: plan.target,
          area: { x: area.x, y: area.y },
          contactId: sector ? null : area.enemyId,
          sector: !!sector,
          route: plan.route,
          lastMovement: battle.time,
          anchor: { x: u.x, y: u.y },
          until:
            battle.time +
            Math.min(
              45,
              8 +
                plan.travel /
                  (1.7 *
                    (0.25 +
                      (0.75 * (u.health["left leg"] + u.health["right leg"])) /
                        200)),
            ),
        },
      );
      u.coverTarget = null;
      u.route = a.route.map((n) => [...n]);
      u.routeGoal = key(a.target.x, a.target.y);
      u.replanAt = battle.time + 0.6;
    }
  }
  const scouts = [...squad.assignments.values()].filter(
    (a) => a.type === "recon",
  );
  for (const u of alive) {
    if (squad.assignments.get(u.id)?.type === "recon") continue;
    const canWatch = scouts.some((a) => {
      const scout = battle.units[a.unitId];
      return (
        sight(u, scout) ||
        a.route.slice(0, 8).some(([x, y]) => sight(u, { x, y }))
      );
    });
    const casualty = u.role === "Medic" && actionableCare(battle, u);
    setAssignment(
      battle,
      squad,
      u,
      u.role === "Medic" && casualty
        ? "care"
        : canWatch
          ? "overwatch"
          : "defend",
      u.role === "Medic" && casualty
        ? "Evaluate casualties before recon"
        : canWatch
          ? "Cover the assigned recon approach"
          : scouts.length
            ? "Recon element has movement priority"
            : (u.alternativeRejection ??
              "No eligible safe investigator; reassess available roles"),
      {},
    );
  }
  squad.coordinationReason = casualty
    ? "Combat loss redistributed tactical tasks"
    : changed
      ? "Temporary commander selected"
      : "Contact/sector, roles and progress reassessed";
}
export function followAssignment(battle, u, dt) {
  const squad = battle.squads[u.team],
    a = squad.assignments?.get(u.id);
  if (!a) return false;
  u.assignment = a;
  if (u.suppression > 0.55) {
    u.assignmentPause = "suppression";
    u.decisionSource = "immediate threat";
    const threats = u.memory ? [u.memory] : uncertainThreats(battle, u);
    if (threats.length && localCover(battle, u, threats, dt)) return true;
    u.state = "Pinned";
    u.order = "Protect self before assigned movement";
    u.decisionReason = "Suppression temporarily overrides squad movement";
    u.holdReason = u.decisionReason;
    return true;
  }
  if (a.type === "care") {
    u.assignmentPause = "casualty care";
    return false;
  }
  if (a.type === "recon") {
    u.decisionSource = "squad leader";
    if (a.failed || battle.time > a.until) {
      u.state = "Awaiting coordination";
      u.order = "Replan expired/blocked approach";
      u.waitingCoordination = true;
      u.holdReason = u.alternativeRejection ?? "Approach expired";
      return true;
    }
    u.decisionSource = "squad leader";
    u.assignmentPause = null;
    u.waitingCoordination = false;
    u.state = a.sector ? "Searching sector" : "Reacquiring contact";
    u.order = a.sector
      ? "Search last reported sector"
      : "Recon assigned observation lane";
    u.decisionReason = a.reason;
    if (distance(u, a.anchor) >= 0.5) {
      a.anchor = { x: u.x, y: u.y };
      a.lastMovement = battle.time;
    }
    if (battle.time - a.lastMovement > 4) {
      a.failed = true;
      u.alternativeRejection = "Assigned approach made no movement progress";
      u.reconRetryAt = battle.time + 2;
      squad.nextCoordination = battle.time;
      u.state = "Awaiting coordination";
      u.waitingCoordination = true;
      return true;
    }
    if (battle.time >= (a.nextRiskCheck ?? 0)) {
      a.nextRiskCheck = battle.time + 0.75;
      const threats = squadThreats(battle, u.team);
      let run = 0,
        longest = 0;
      for (const [x, y] of u.route) {
        run = knownRisk({ x, y }, threats) > 0.75 ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
      if (longest > 4) {
        a.failed = true;
        u.alternativeRejection =
          "Newly reported danger invalidates the approach";
        squad.nextCoordination = battle.time;
        u.state = "Awaiting coordination";
        u.waitingCoordination = true;
        return true;
      }
    }
    if (battle.move(u, a.target, dt) === false) {
      a.failed = true;
      u.alternativeRejection =
        u.movementBlocker ?? "Navigation rejected destination";
      squad.nextCoordination = battle.time;
      u.state = "Awaiting coordination";
      u.waitingCoordination = true;
      return true;
    }
    return true;
  }
  const scouts = [...squad.assignments.values()].filter(
    (x) => x.type === "recon" && !x.failed,
  );
  u.decisionSource = "squad leader";
  u.assignmentPause = null;
  u.waitingCoordination = !scouts.length;
  u.state =
    a.type === "overwatch" && scouts.length
      ? "Covering search"
      : "Awaiting coordination";
  u.order =
    a.type === "overwatch"
      ? "Overwatch assigned recon element"
      : "Maintain defense; evaluate alternatives";
  u.decisionReason = a.reason;
  u.holdReason = a.reason;
  return true;
}
export function updateProgress(battle, u) {
  const p = progressFor(u, battle.time);
  const a = u.assignment;
  const objective =
    u.decisionSource === "squad leader" && a
      ? `${a.type}:${a.target?.x},${a.target?.y}:${a.contactId}`
      : `${u.order}:${u.target?.x},${u.target?.y}:${u.engagementId}`;
  if (p.objective !== objective) {
    p.objective = objective;
    p.lastObjective = battle.time;
  }
  if (distance(u, p.anchor) >= 1) {
    p.lastMovement = battle.time;
    p.anchor = { x: u.x, y: u.y };
    p.lastUseful = battle.time;
  }
  if ((u.visibleEnemies ?? []).some((e) => e.active && sight(u, e))) {
    p.lastSight = battle.time;
    p.lastUseful = battle.time;
  }
  if (u.firedAt === battle.time) {
    p.lastEngagement = battle.time;
    p.lastUseful = battle.time;
  }
  if (u.state === "Treating") {
    p.lastTreatment = battle.time;
    p.lastUseful = battle.time;
  }
  if (
    u.state === "Covering search" &&
    [...(battle.squads[u.team].assignments?.values() ?? [])].some(
      (a) =>
        a.type === "recon" &&
        battle.time - a.lastMovement < 2 &&
        sight(u, battle.units[a.unitId]),
    )
  )
    p.lastUseful = battle.time;
}
