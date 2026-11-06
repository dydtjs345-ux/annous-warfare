import { observes, formationDesired } from "./security.js";
import { W, H, blocked, sight, key } from "./world.js";
import { searchRoutes } from "./search-path.js";
import { receivingTreatment } from "./medical.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const isSearchAssignment = (a) =>
  a?.type === "search" || a?.type === "escort";

export function initializeSearch(b) {
  b.searchEnabled = b.world.kind === "expanded";
  if (!b.searchEnabled) return;
  const nodes = [];
  for (let y = 2; y < H - 1; y += 4)
    for (let x = 2; x < W - 1; x += 4)
      if (!blocked(x, y)) nodes.push({ id: nodes.length, x, y });
  // These are sampled visible landmarks, not a claim that an entire sector is clear.
  b.searchNodes = nodes;
  b.searchViews = nodes.map((n) =>
    nodes.filter((p) => distance(n, p) <= 10 && sight(n, p)).map((p) => p.id),
  );
  for (const squad of b.squads) {
    squad.intel.sounds = new Map();
    squad.search = {
      phase: "SEARCH",
      since: 0,
      lastVisual: null,
      everContact: false,
      seen: new Float64Array(nodes.length).fill(-Infinity),
      visits: new Uint16Array(nodes.length),
      blockedUntil: new Float64Array(nodes.length),
      goal: null,
      revision: 0,
      nextObserve: 0,
      nextPlan: 0,
      completed: 0,
      repeated: 0,
      failedObjectives: 0,
      goalChangesWithoutProgress: 0,
      lastProgress: 0,
      blocker: null,
      history: [],
      reason: "No enemy position known; explore visible street landmarks",
    };
  }
}
export function updateSearchState(b, team) {
  if (!b.searchEnabled) return;
  const squad = b.squads[team],
    s = squad.search,
    own = b.units.filter((u) => u.team === team && u.active);
  if (b.time >= s.nextObserve) {
    s.nextObserve = b.time + 1;
    for (const node of b.searchNodes)
      if (
        own.some(
          (u) =>
            distance(u, node) <= Math.min(10, u.range) &&
            (b.tacticalEnabled ? observes(u, node) : sight(u, node)),
        )
      ) {
        if (!Number.isFinite(s.seen[node.id])) s.lastProgress = b.time;
        s.seen[node.id] = b.time;
      }
  }
  for (const [id, r] of squad.intel.sounds)
    if (b.time - r.time >= 8) squad.intel.sounds.delete(id);
  const confirmed = [...squad.intel.contacts.values()].some(
    (c) => c.time === b.time,
  );
  if (confirmed) {
    s.lastVisual = b.time;
    s.everContact = true;
    s.lastProgress = b.time;
  }
  const sector = squad.lastSector;
  const recentSector =
    sector &&
    b.time - sector.at <
      (sector.origin === "casualty area" ? 6 : b.contactTTL + 20);
  let phase;
  if (confirmed)
    phase = own.some((u) => b.time - (u.firedAt ?? -Infinity) < 0.8)
      ? "ENGAGE"
      : "CONTACT";
  else if (
    s.lastVisual != null &&
    b.time - s.lastVisual < 0.4 &&
    ["CONTACT", "ENGAGE"].includes(s.phase)
  )
    phase = s.phase;
  else if (s.lastVisual != null && b.time - s.lastVisual < 1.2)
    phase = "LOST_CONTACT";
  else if (squad.intel.contacts.size || recentSector || squad.intel.sounds.size)
    phase = "REACQUIRE";
  else if (
    s.everContact &&
    ["CONTACT", "ENGAGE", "LOST_CONTACT", "REACQUIRE"].includes(s.phase)
  )
    phase = "SEARCH_AGAIN";
  else if (s.phase === "SEARCH_AGAIN" && b.time - s.since < 2)
    phase = "SEARCH_AGAIN";
  else phase = "SEARCH";
  if (s.phase !== phase) {
    s.phase = phase;
    s.since = b.time;
  }
}
export function suspendSearch(squad, b) {
  squad.search.suspended = true;
  for (const [id, a] of squad.assignments)
    if (isSearchAssignment(a)) {
      squad.assignments.delete(id);
      b.units[id].assignment = null;
    }
}
function destination(b, u, desired, reserved) {
  const candidates = [];
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++) {
      const p = {
        x: Math.round(desired.x) + dx,
        y: Math.round(desired.y) + dy,
      };
      if (
        blocked(p.x, p.y) ||
        reserved.some((a) => distance(a, p) < 0.8) ||
        b.units.some(
          (a) =>
            a !== u && a.team === u.team && !a.dead && distance(a, p) < 0.65,
        )
      )
        continue;
      candidates.push(p);
    }
  candidates.sort(
    (a, c) =>
      distance(a, desired) - distance(c, desired) ||
      distance(u, a) - distance(u, c),
  );
  const tree = searchRoutes(u);
  for (const p of candidates)
    if (Number.isFinite(tree.distance(p)))
      return { ...p, route: tree.route(p) };
  return null;
}
function chooseArea(b, team, lead) {
  const s = b.squads[team].search,
    tree = searchRoutes(lead);
  const sound = [...b.squads[team].intel.sounds.values()].sort(
    (a, c) => c.time - a.time,
  )[0];
  const sector = sound
    ? {
        x: sound.origin.x + Math.cos(sound.bearing) * 8,
        y: sound.origin.y + Math.sin(sound.bearing) * 8,
      }
    : null;
  let best = null;
  for (const n of b.searchNodes) {
    const travel = tree.distance(n);
    if (!Number.isFinite(travel) || travel < 3 || s.blockedUntil[n.id] > b.time)
      continue;
    const age = b.time - s.seen[n.id];
    const gain = b.searchViews[n.id].filter(
      (id) => b.time - s.seen[id] > 60,
    ).length;
    const recent = s.history.slice(-5).includes(n.id);
    const score =
      (Number.isFinite(age) ? Math.min(age, 180) * 0.08 : 22) +
      Math.min(gain, 10) * 1.2 -
      travel * 0.22 -
      (recent ? 8 : 0) +
      (sector ? Math.max(0, 10 - distance(n, sector)) * 0.8 : 0);
    if (!best || score > best.score)
      best = {
        ...n,
        score,
        travel,
        source: sector
          ? "uncertain gunfire bearing"
          : "unobserved / stale landmark",
        evidenceAt: sound?.time,
      };
  }
  return best;
}
export function coordinateSearch(
  b,
  team,
  { alive, commander, assign, careAvailable },
) {
  const squad = b.squads[team],
    s = squad.search;
  s.suspended = false;
  for (const [id, a] of squad.assignments)
    if (
      !isSearchAssignment(a) &&
      !(a.type === "care" && careAvailable(b.units[id]))
    ) {
      squad.assignments.delete(id);
      b.units[id].assignment = null;
    }
  const capable = alive.filter(
    (u) => u.suppression < 0.55 && (u.ammo > 0 || u.reserve > 0 || u.frags > 0),
  );
  const rank = { Leader: 0, Rifleman: 1, LMG: 2, Medic: 3 };
  capable.sort(
    (a, c) =>
      rank[a.role] -
        rank[c.role] +
        (a.health.torso < 35 ? 3 : 0) -
        (c.health.torso < 35 ? 3 : 0) || a.id - c.id,
  );
  const fighters = capable.filter((u) => u.role !== "Medic");
  const moving = (
    fighters.length ? fighters : capable.filter((u) => !careAvailable(u))
  ).slice(0, 2);
  if (!moving.length) {
    s.blocker = alive.every((u) => u.ammo === 0 && u.reserve === 0 && !u.frags)
      ? "Ammunition exhausted; no viable elimination action"
      : "No available search element; suppression or care priority";
    for (const u of alive) assign(u, "defend", s.blocker, {});
    return;
  }
  s.blocker = null;
  const lead = moving[0];
  const reached =
    s.goal &&
    moving.some(
      (u) =>
        u.assignment?.searchRevision === s.revision &&
        distance(u, u.assignment.target) < 0.5 &&
        distance(u, s.goal) < 4 &&
        (b.tacticalEnabled ? observes(u, s.goal) : sight(u, s.goal)),
    );
  const failed = s.goal && moving.some((u) => u.assignment?.failed);
  const expired = s.goal && b.time > s.goal.until;
  const staleSound =
    s.goal?.evidenceAt != null && b.time - s.goal.evidenceAt > 12;
  if (
    !s.goal ||
    ((reached || failed || expired || staleSound) && b.time - s.goal.at > 3)
  ) {
    if (s.goal) {
      if (reached) {
        s.completed++;
        s.visits[s.goal.id]++;
        s.lastProgress = b.time;
      } else {
        s.failedObjectives++;
        s.blockedUntil[s.goal.id] = b.time + 30;
      }
    }
    const next = chooseArea(b, team, lead);
    if (next) {
      if (s.history.includes(next.id)) s.repeated++;
      s.history.push(next.id);
      if (s.history.length > 24) s.history.shift();
      s.revision++;
      s.goal = {
        ...next,
        at: b.time,
        until: b.time + Math.max(25, next.travel / 0.65 + 12),
      };
      s.reason = `${next.source}; reachable unexplored street area`;
      squad.goal = { x: next.x, y: next.y };
    } else {
      s.goal = null;
      s.blocker = "No reachable search landmark";
    }
  }
  if (!s.goal) return;
  const reserved = [];
  for (const u of alive) {
    if (u.role === "Medic" && careAvailable(u)) {
      assign(
        u,
        "care",
        "Evaluate reachable casualty before district search",
        {},
      );
      continue;
    }
    const primary = moving.includes(u),
      type = primary ? "search" : "escort";
    let a = squad.assignments.get(u.id);
    // Preserve an in-progress route. An arrived escort must nevertheless renew
    // its support point once the lead leaves supporting distance; displacement
    // from the old planning anchor alone can leave it observing behind the squad.
    const escortMoved =
      a?.type === "escort" &&
      (a.leadId !== lead.id ||
        distance(a.leadAnchor, lead) > 3 ||
        (distance(u, a.target) < 0.5 &&
          distance(u, lead) > (a.supportDistance ?? 4) + 0.5));
    if (
      !a ||
      a.type !== type ||
      a.searchRevision !== s.revision ||
      a.failed ||
      escortMoved
    ) {
      const desired = primary
        ? { x: s.goal.x + (moving.indexOf(u) ? 1 : 0), y: s.goal.y }
        : b.tacticalEnabled
          ? formationDesired(
              b,
              u,
              lead,
              alive.filter((a) => !moving.includes(a)).indexOf(u),
            )
          : {
              x: lead.x - Math.cos(lead.facing) * 3,
              y: lead.y - Math.sin(lead.facing) * 3,
            };
      const p = destination(b, u, desired, reserved);
      if (!p) {
        assign(u, "defend", "No available distinct search position", {});
        continue;
      }
      a = assign(
        u,
        type,
        primary ? s.reason : "Support and follow the squad search element",
        {
          target: { x: p.x, y: p.y },
          route: p.route,
          searchRevision: s.revision,
          leadId: lead.id,
          leadAnchor: { x: lead.x, y: lead.y },
          supportDistance: b.tacticalEnabled
            ? Math.max(4, distance(p, lead) + 0.5)
            : 4,
          lastMovement: b.time,
          anchor: { x: u.x, y: u.y },
          until: s.goal.until,
        },
      );
      u.route = p.route.map((n) => [...n]);
      if (b.time >= (u.coverUntil ?? 0)) u.coverTarget = null;
      u.routeGoal = key(p.x, p.y);
      u.replanAt = b.time + 0.6;
    }
    reserved.push(a.target);
    if (u.reload > 0 || u.state === "Reloading") {
      a.lastMovement = b.time;
      a.until += 1.5;
    }
    a.commanderId = commander.id;
  }
  squad.coordinationReason =
    "Commander assigned search element and supporting followers";
}
export function followSearch(b, u, dt) {
  const squad = b.squads[u.team],
    a = u.assignment,
    s = squad.search;
  u.decisionSource = "squad leader";
  u.assignmentPause = null;
  if (a.failed) {
    u.state = "Awaiting coordination";
    u.order = "Replan blocked search route";
    u.decisionReason = a.failure ?? "Search route unavailable";
    squad.nextCoordination = b.time;
    return true;
  }
  if (receivingTreatment(b, u, dt)) {
    a.lastMovement = b.time;
    a.until += dt;
    b.move(u, a.target, dt);
    return true;
  }
  if (
    a.type === "escort" &&
    distance(u, b.units[a.leadId]) <= (a.supportDistance ?? 4)
  ) {
    u.state = "Covering search";
    u.order = "Observe and support the moving search element";
    u.holdReason = "Within supporting distance of assigned search element";
    u.decisionReason = u.holdReason;
    a.lastMovement = b.time;
    return true;
  }
  if (distance(u, a.target) < 0.3) {
    u.state = "Covering search";
    u.order = "Observe the reached search area";
    u.decisionReason = "Reached assigned observation point";
    a.lastMovement = b.time;
    return true;
  }
  if (distance(u, a.anchor) > 0.5) {
    a.anchor = { x: u.x, y: u.y };
    a.lastMovement = b.time;
    s.lastProgress = b.time;
  }
  if (b.time - a.lastMovement > 5) {
    a.failed = true;
    a.failure = "No net search movement progress";
    squad.nextCoordination = b.time;
    return true;
  }
  u.state =
    a.type === "search" ? "Searching district" : "Following search element";
  u.order = a.reason;
  u.decisionReason = a.reason;
  if (b.move(u, a.target, dt) === false) {
    a.failed = true;
    a.failure = u.movementBlocker;
    squad.nextCoordination = b.time;
  }
  return true;
}
export function searchDiagnostic(b, u) {
  const s = b.squads[u.team].search;
  return {
    phase: s.phase,
    goal: s.goal ? { x: s.goal.x, y: s.goal.y } : null,
    suspended: !!s.suspended,
    source: s.goal?.source ?? "none",
    observed: s.seen.filter((t) => Number.isFinite(t)).length,
    total: b.searchNodes.length,
    reason: s.blocker ?? s.reason,
    progressAge: b.time - s.lastProgress,
  };
}
