const labels = {
  head: "Head",
  torso: "Torso",
  "left arm": "LA",
  "right arm": "RA",
  "left leg": "LL",
  "right leg": "RL",
};
export function inspectSoldier(u) {
  const wounds = Object.entries(u.health).filter(([, h]) => h < 100);
  const health = Object.entries(u.health)
    .map(([p, h]) => `${labels[p]} ${Math.ceil(h)}${h < 100 ? "*" : ""}`)
    .join(" · ");
  const d = u.diagnostics;
  const contact = d
    ? `${d.source}${d.targetId != null ? ` · enemy #${d.targetId}` : ""}${d.targetDistance != null ? ` · ${d.distanceEstimated ? "last-known " : ""}${d.targetDistance.toFixed(1)} tiles` : ""}`
    : "none";
  const age =
    d?.contactAge != null
      ? `${d.contactAge.toFixed(1)}s${d.observerId != null ? ` · observer #${d.observerId}` : ""}`
      : "—";
  return `${u.name} · ${u.role} · Suppression ${Math.round(u.suppression * 100)}% · Ammo ${u.ammo}/${u.reserve}\nAction: ${u.state} (${(d?.stateTime ?? 0).toFixed(1)}s)\nObjective: ${u.order}${u.target ? ` → ${u.target.x},${u.target.y}` : ""} · ${u.navigation}\nContact: ${contact}\nLast confirmed: ${age} · Direct LOS: ${d?.directLOS ? "yes" : "no"}\nFire: ${d?.firingPermitted ? "permitted" : "not permitted"} · ${d?.notFiring ?? "No identified visible target"}\nDecision: ${d?.decision ?? "Awaiting decision"}\nBlocker: ${d?.blocker ?? "none"}${d?.stalemate ? ` · Limitation: ${d.stalemate}` : ""}\n${health}\n${wounds.length ? "* marks actual injuries" : "No injuries"}`;
}
