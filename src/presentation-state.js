// Read-only observation of authoritative decisions. Nothing in tactical AI reads
// these fields, and these observers never draw RNG or change combat values.
import { cover, sight } from "./world.js";
export const ACTIVITY_KEYS = [
  "engaging",
  "searching",
  "moving",
  "cover",
  "treating",
  "reloading",
  "waiting",
];
export function initializePresentation(battle) {
  battle.events = [];
  battle.eventSerial = 0;
  for (const u of battle.units) {
    u.presentation = {
      startX: u.x,
      startY: u.y,
      previousReload: 0,
      traveled: 0,
      moving: false,
      speed: 0,
      covered: false,
      protection: 0,
      treating: false,
      reloading: false,
      reloadDuration: 0,
      reloadProgress: 0,
      lastShotAt: null,
    };
    u.activity = Object.fromEntries(
      [...ACTIVITY_KEYS, "total", "contribution", "preparation", "passive"].map(
        (k) => [k, 0],
      ),
    );
  }
}
export function emitVisualEvent(battle, type, u, details = {}) {
  const event = {
    id: ++battle.eventSerial,
    type,
    unitId: u.id,
    time: battle.time,
    ...details,
  };
  battle.events.push(event);
  if (battle.events.length > 96) battle.events.shift();
  if (type === "shot") u.presentation.lastShotAt = battle.time;
  return event;
}
export function beginPresentationStep(battle) {
  while (battle.events.length && battle.time - battle.events[0].time > 0.8)
    battle.events.shift();
  for (const u of battle.units) {
    const p = u.presentation;
    p.startX = u.x;
    p.startY = u.y;
    p.previousReload = u.reload;
  }
}
export function activityKind(u) {
  const p = u.presentation;
  if (!u.active) return null;
  if (p.treating) return "treating";
  if (p.reloading) return "reloading";
  if (p.shotThisStep) return "engaging";
  if (["deploying", "unmounting"].includes(u.mount?.state)) return "cover";
  if (p.shotThisStep || (["Engaging", "Aiming"].includes(u.state) && p.direct))
    return "engaging";
  if (p.moving)
    return [
      "Reacquiring contact",
      "Searching sector",
      "Searching last contact",
    ].includes(u.state)
      ? "searching"
      : "moving";
  if (p.covered) return "cover";
  return "waiting";
}
function actualOverwatch(battle, u) {
  if (u.state !== "Covering search") return false;
  return [...(battle.squads[u.team].assignments?.values() ?? [])].some(
    (a) =>
      a.type === "recon" &&
      a.lastMovement > a.at &&
      battle.time - a.lastMovement < 2 &&
      battle.units[a.unitId]?.active &&
      (sight(u, battle.units[a.unitId]) ||
        a.route.slice(0, 8).some(([x, y]) => sight(u, { x, y }))),
  );
}
export function finishPresentationStep(battle, dt) {
  for (const u of battle.units) {
    const p = u.presentation,
      d = Math.hypot(u.x - p.startX, u.y - p.startY);
    p.moving = u.active && d > 1e-6;
    p.speed = d / dt;
    if (p.moving) {
      p.gaitSpeed =
        p.gaitSpeed == null ? p.speed : 0.7 * p.gaitSpeed + 0.3 * p.speed;
      p.brisk = p.brisk ? p.gaitSpeed > 1.1 : p.gaitSpeed > 1.45;
    }
    p.traveled += d;
    p.treating =
      u.active && u.state === "Treating" && u.treatmentAt === battle.time;
    p.reloading =
      u.active &&
      (u.reload > 0 || (p.previousReload > 0 && u.state === "Reloading"));
    if (p.previousReload <= 0 && u.reload > 0) {
      p.reloadDuration = u.reload;
      emitVisualEvent(battle, "reloadStart", u, { duration: u.reload });
    }
    if (p.previousReload > 0 && u.reload <= 0)
      emitVisualEvent(battle, "reloadEnd", u);
    p.reloadProgress = p.reloadDuration
      ? Math.max(0, Math.min(1, 1 - u.reload / p.reloadDuration))
      : 0;
    const direct = (u.visibleEnemies ?? []).find(
      (e) => e.active && sight(u, e),
    );
    p.direct = !!direct;
    const threat =
      (u.visibleEnemies ?? []).find(
        (e) => e.id === u.engagementId && e.active && sight(u, e),
      ) ??
      (u.memory && battle.time - u.memory.time < battle.contactTTL
        ? u.memory
        : null);
    p.protection = threat ? cover(u, threat) : 0;
    p.covered = !!threat && p.protection >= 0.28;
    p.observing = [
      "Holding contact",
      "Covering search",
      "Observing contact",
      "Awaiting coordination",
      "Watching reported sector",
      "Covering casualty",
    ].includes(u.state);
    p.shotThisStep = p.lastShotAt === battle.time;
    p.overwatch = actualOverwatch(battle, u);
    const lane = !!(
      u.memory &&
      u.memory.clearedAt == null &&
      (u.memory.confidence ?? 1) > 0.6 &&
      p.covered &&
      sight(u, u.memory)
    );
    const kind = activityKind(u);
    if (kind) {
      u.activity[kind] += dt;
      u.activity.total += dt;
      const useful =
        kind === "treating" ||
        kind === "engaging" ||
        p.direct ||
        p.overwatch ||
        lane;
      const bucket =
        kind === "reloading" ||
        (["deploying", "unmounting"].includes(u.mount?.state) &&
          !p.shotThisStep) ||
        (p.moving && !useful)
          ? "preparation"
          : useful
            ? "contribution"
            : "passive";
      u.activity[bucket] += dt;
    }
  }
}
