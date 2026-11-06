import { MOUNT } from "./mounting.js";
const labels = {
  head: "Head",
  torso: "Torso",
  "left arm": "LA",
  "right arm": "RA",
  "left leg": "LL",
  "right leg": "RL",
};
const elapsed = (value) => (value == null ? "never" : `${value.toFixed(1)}s`);
export function inspectSoldier(u) {
  const wounds = Object.entries(u.health).filter(([, h]) => h < 100);
  const health = Object.entries(u.health)
    .map(([p, h]) => `${labels[p]} ${Math.ceil(h)}${h < 100 ? "*" : ""}`)
    .join(" · ");
  const a = u.activity;
  const time = (value) => `${value.toFixed(1)}s`;
  const activity = a
    ? `\nActivity (exclusive active time ${time(a.total)}): engage ${time(a.engaging)} · recon ${time(a.searching)} · move ${time(a.moving)} · cover ${time(a.cover)} · treat ${time(a.treating)} · reload ${time(a.reloading)} · observe/wait ${time(a.waiting)}\nContribution ${time(a.contribution)} · preparation ${time(a.preparation)} · passive waiting ${time(a.passive)}`
    : "";
  const c = u.coverEvaluation;
  const current = u.diagnostics
    ? u.diagnostics.cover
    : c?.score != null
      ? c
      : null;
  const coverText = `\nCover: ${current ? `protection ${Math.round(current.protection * 100)}% · exposure ${Math.round(current.exposure * 100)}% · score ${current.score.toFixed(2)}` : "no current known threat"}\nCover assessment: ${c?.reason ?? "Not yet evaluated"}${c?.evaluatedAt != null ? ` (${Math.max(0, (u.diagnostics?.now ?? c.evaluatedAt) - c.evaluatedAt).toFixed(1)}s ago)` : ""}\nCandidate: ${c?.best ? `${c.best.x},${c.best.y} · protection ${Math.round(c.best.protection * 100)}%` : "none"} · cover blocker: ${c?.blockedBy ?? "none"}`;
  const m = u.mount;
  const mountText =
    u.role === "LMG"
      ? `\nLMG: ${m?.state ?? "unsupported"} · ${m?.reason ?? "Not assessed"}${m && m.state !== "unsupported" ? `\nSupport: ${m.position.x.toFixed(1)},${m.position.y.toFixed(1)} · direction ${Math.round((m.direction * 180) / Math.PI)}°` : ""}\nSupport bonuses: accuracy ×${m?.state === "mounted" ? MOUNT.accuracy : 1} · suppression ×${m?.state === "mounted" ? MOUNT.suppression : 1}`
      : "";
  const d = u.diagnostics;
  const contact = d
    ? `${d.source}${d.targetId != null ? ` · enemy #${d.targetId}` : ""}${d.targetDistance != null ? ` · ${d.distanceEstimated ? "last-known " : ""}${d.targetDistance.toFixed(1)} tiles` : ""}`
    : "none";
  const age =
    d?.contactAge != null
      ? `${d.contactAge.toFixed(1)}s${d.observerId != null ? ` · observer #${d.observerId}` : ""}`
      : "—";
  const postureText = u.posture
    ? `\nPosture: ${u.posture.mode} · ${u.posture.reason}`
    : "";
  const searchText = d?.search
    ? `\nSearch: ${d.search.phase}${d.search.suspended ? " · search travel suspended" : ""}\n${d.search.suspended ? "Last search area" : "Search area"}: ${d.search.goal ? `${d.search.goal.x},${d.search.goal.y}` : "none"} · ${d.search.source}\nObserved landmarks: ${d.search.observed}/${d.search.total} · progress ${d.search.progressAge.toFixed(1)}s ago\nSearch decision: ${d.search.reason}`
    : "";
  return `${u.name} · ${u.role} · Suppression ${Math.round(u.suppression * 100)}% · Ammo ${u.ammo}/${u.reserve}\nAction: ${u.state} (${(d?.stateTime ?? 0).toFixed(1)}s)\nObjective: ${u.order}${u.target ? ` → ${u.target.x},${u.target.y}` : ""} · ${u.navigation}\nContact: ${contact}\nLast confirmed: ${age} · Direct LOS: ${d?.directLOS ? "yes" : "no"}\nFire: ${d?.firingPermitted ? "permitted" : "not permitted"} · ${d?.notFiring ?? "No identified visible target"}\nDecision: ${d?.decision ?? "Awaiting decision"}\nAssignment: ${d?.assignment ?? "none"} · ${d?.assignmentSource ?? "personal decision"}${d?.assignmentCommander != null ? ` (#${d.assignmentCommander})` : ""}${d?.assignmentDestination ? ` → ${d.assignmentDestination.x},${d.assignmentDestination.y}` : ""}${d?.assignmentPause ? ` · paused: ${d.assignmentPause}` : ""}\nHolding: ${d?.maintainingReason ?? "—"}\nAlternatives: ${d?.alternatives ?? "—"}\nProgress: ${(d?.progressAge ?? 0).toFixed(1)}s · move ${elapsed(d?.movementAge)} · sight ${elapsed(d?.sightAge)} · engage ${elapsed(d?.engagementAge)}\nObjective age: ${(d?.objectiveAge ?? 0).toFixed(1)}s · failures ${d?.failedAttempts ?? 0} · coordination wait ${d?.waitingCoordination ? "yes" : "no"}${d?.casualtyResponse ? `\nCasualty response: ${d.casualtyResponse}` : ""}\nBlocker: ${d?.blocker ?? "none"}${d?.stalemate ? ` · Limitation: ${d.stalemate}` : ""}\n${health}\n${wounds.length ? "* marks actual injuries" : "No injuries"}${coverText}${mountText}${u.frags != null ? `\nFrag: ${u.frags} · ${u.grenadePrep ? "preparing" : u.state === "Evading grenade" ? "emergency evasion" : u.frags > 0 ? "available; awaiting safe opportunity" : "none"} · ${u.grenadePrep?.reason ?? "Confirmed targets and friendly clearance required"}` : ""}${postureText}${searchText}${activity}`;
}
