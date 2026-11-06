const labels = {
  head: "Head",
  torso: "Torso",
  "left arm": "LA",
  "right arm": "RA",
  "left leg": "LL",
  "right leg": "RL",
};
export function inspectSoldier(u) {
  const health = Object.entries(u.health)
    .map(([p, h]) => `${labels[p]} ${Math.ceil(h)}${h < 100 ? "*" : ""}`)
    .join(" · ");
  return `${u.name} · ${u.role} · Suppression ${Math.round(u.suppression * 100)}% · Ammo ${u.ammo}/${u.reserve}\nAction: ${u.state}\nObjective: ${u.order}${u.target ? ` → ${u.target.x},${u.target.y}` : ""} · ${u.navigation}\n${health} (* injured)`;
}
