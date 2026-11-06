import { squadThreats, uncertainThreats } from "./intelligence.js";
import { protectionAt, exposure, positionScore } from "./tactics.js";
import { sight } from "./world.js";
import { searchDiagnostic } from "./search.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function firingStatus(battle, u, enemy) {
  if (!u.active)
    return {
      permitted: false,
      reason: u.dead ? "Eliminated" : "Incapacitated",
    };
  if (u.grenadePrep) return { permitted: false, reason: "Preparing grenade" };
  if (["deploying", "unmounting"].includes(u.mount?.state))
    return { permitted: false, reason: `LMG ${u.mount.state}` };
  if (u.reload > 0) return { permitted: false, reason: "Reloading" };
  if (u.ammo <= 0)
    return {
      permitted: false,
      reason: u.reserve ? "Magazine empty" : "Ammunition exhausted",
    };
  if (!enemy)
    return {
      permitted: false,
      reason:
        u.memory?.clearedAt != null
          ? "Last-known position now observed empty"
          : u.memory && distance(u, u.memory) > u.range
            ? "Known contact outside weapon range; no direct target"
            : u.memory
              ? "No direct line of sight to known contact"
              : "No identified visible target",
    };
  if (!enemy.active)
    return { permitted: false, reason: "Visible target incapacitated" };
  if (!sight(u, enemy))
    return { permitted: false, reason: "Line of sight blocked" };
  if (distance(u, enemy) > u.range)
    return { permitted: false, reason: "Outside weapon range" };
  if (battle.time < u.aimAt)
    return { permitted: false, reason: "Acquiring target / reaction delay" };
  if (u.cooldown > 0 && u.firedAt !== battle.time)
    return { permitted: false, reason: "Weapon firing interval" };
  return { permitted: true, reason: "Clear firing opportunity" };
}
const reasons = {
  "Deploying LMG":
    "Deploying weapon support on a verified low-wall firing lane",
  "Unmounting LMG":
    "Releasing support before repositioning / changing firing lane",
  Engaging: "Maintaining a visible firing solution",
  Aiming: "Acquiring a directly visible target",
  Reloading: "Reloading individual weapon",
  Treating: "Uninterrupted treatment within reach and line of sight",
  "Moving to casualty": "Approaching a reachable casualty",
  "Seeking cover": "Committed to a scored improvement in protection",
  Flanking: "Conditional maneuver with covering support",
  Pinned: "Incoming pressure makes exposure unsafe",
  "Watching reported sector":
    "Short defensive reaction to approximate incoming fire",
  "Covering casualty": "Briefly covering a nearby casualty",
  Patrolling: "Searching without enemy position knowledge",
  Regrouping: "Outside squad spacing; returning within regroup hysteresis",
};
export function refreshDiagnostics(battle, u) {
  if (u.diagnosticState !== u.state) {
    u.diagnosticState = u.state;
    u.stateSince = battle.time;
  }
  const visible = (u.visibleEnemies ?? []).filter(
    (e) =>
      sight(u, e) &&
      distance(u, e) < (e.hit > 0 ? Math.max(15, u.range) : u.range),
  );
  const direct = visible.find((e) => e.id === u.engagementId);
  const memory =
    u.memory && battle.time - u.memory.time < battle.contactTTL
      ? u.memory
      : null;
  const incoming = [...u.intel.incoming.values()].find(
    (r) => battle.time - r.time < 3 && distance(u, r.origin) <= 7,
  );
  const contact = direct ? u.intel.contacts.get(direct.id) : memory;
  const source = direct
    ? "direct sighting"
    : memory
      ? memory.time === battle.time &&
        !memory.observers?.every((id) => id === u.id)
        ? "shared sighting"
        : "last-known position"
      : incoming
        ? "incoming-fire bearing"
        : "none";
  const target = direct ?? memory;
  const firing = ["Throwing grenade", "Evading grenade"].includes(u.state)
    ? { permitted: false, reason: u.state }
    : firingStatus(battle, u, direct);
  const threats = [
    ...squadThreats(battle, u.team),
    ...uncertainThreats(battle, u),
  ];
  u.diagnostics = {
    ...(battle.searchEnabled ? { search: searchDiagnostic(battle, u) } : {}),
    now: battle.time,
    cover: threats.length
      ? {
          protection: protectionAt(u, threats),
          exposure: exposure(u, threats),
          score: positionScore(u, u, threats),
        }
      : null,
    source,
    targetId: target?.enemyId ?? direct?.id ?? null,
    targetDistance: target ? distance(u, target) : null,
    distanceEstimated: !direct,
    contactAge: contact
      ? Math.max(0, battle.time - contact.time)
      : u.lastConfirmedAt != null
        ? battle.time - u.lastConfirmedAt
        : null,
    observerId: contact?.observedBy ?? u.lastConfirmedObserverId ?? null,
    confidence: memory?.confidence ?? (direct ? 1 : null),
    directLOS: !!direct,
    firingPermitted: firing.permitted,
    notFiring: firing.reason,
    decision: u.decisionReason ?? reasons[u.state] ?? u.navigation,
    stateTime: battle.time - (u.stateSince ?? battle.time),
    assignment: u.assignment?.type ?? "none",
    assignmentSource: u.decisionSource ?? "personal decision",
    assignmentCommander: u.assignment?.commanderId ?? null,
    assignmentDestination: u.assignment?.target ?? null,
    assignmentPause:
      u.assignmentPause ??
      (u.assignment?.failed ? "awaiting reassignment" : null),
    maintainingReason: u.holdReason ?? null,
    alternatives: u.alternativeRejection ?? null,
    progressAge: battle.time - (u.progress?.lastUseful ?? 0),
    movementAge:
      u.progress?.lastMovement == null
        ? null
        : battle.time - u.progress.lastMovement,
    sightAge:
      u.progress?.lastSight == null ? null : battle.time - u.progress.lastSight,
    engagementAge:
      u.progress?.lastEngagement == null
        ? null
        : battle.time - u.progress.lastEngagement,
    objectiveAge: battle.time - (u.progress?.lastObjective ?? 0),
    failedAttempts: u.progress?.failedAttempts ?? 0,
    waitingCoordination: !!u.waitingCoordination,
    casualtyResponse:
      u.casualtyResponse && battle.time - u.casualtyResponse.at < 12
        ? u.casualtyResponse.text
        : null,
    blocker: u.movementBlocker ?? null,
    stalemate: !u.active
      ? null
      : u.ammo === 0 && u.reserve === 0
        ? "No ammunition"
        : (u.movementBlocker ??
          (u.state === "Observing contact" ||
          (u.waitingCoordination &&
            u.alternativeRejection?.startsWith("No reachable"))
            ? "No safe reacquisition route"
            : null)),
  };
}
