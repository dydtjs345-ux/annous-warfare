// Treatment uses the existing range, route, LOS and healing model. These rules
// choose/coordinate care; they never change incoming damage or weapon timing.
import { sight } from "./world.js";
import { squadThreats, uncertainThreats } from "./intelligence.js";
import { distance, careRouteSafe, protectionAt, exposure } from "./tactics.js";
export function choosePatient(b, u, enemy) {
  const threats = [...squadThreats(b, u.team), ...uncertainThreats(b, u)];
  const eligible = (p) =>
    p !== u &&
    p.team === u.team &&
    !p.dead &&
    Math.min(...Object.values(p.health)) < 65 &&
    ((distance(u, p) < 1.4 && sight(u, p)) || careRouteSafe(b, u, p)) &&
    (!enemy ||
      (u.suppression < 0.35 &&
        protectionAt(u, threats) >= 0.28 &&
        protectionAt(p, threats) >= 0.28));
  const candidates = b.units
    .filter(eligible)
    .sort(
      (a, c) =>
        Number(a.active) - Number(c.active) || distance(u, a) - distance(u, c),
    );
  const best = candidates[0],
    current = candidates.find((p) => p.id === u.patientId);
  // Keep safe care committed; a newly incapacitated casualty can take priority.
  const recentCare =
    b.time - (u.treatmentAt ?? -Infinity) < 0.2 &&
    distance(u, current ?? u) < 1.8;
  const patient =
    current &&
    (!best ||
      !current.active ||
      (best.active &&
        (recentCare || distance(u, current) <= distance(u, best) + 1)))
      ? current
      : best;
  if (patient && u.assignment?.type === "recon") {
    b.squads[u.team].nextCoordination = b.time;
    u.careReason = "Request leader reassignment for reachable casualty";
    return null;
  }
  u.careReason = patient
    ? enemy
      ? "Protected care under confirmed contact"
      : "Reachable casualty care"
    : enemy
      ? "No protected safe care opportunity under contact"
      : "No reachable casualty requiring treatment";
  return patient;
}
export function receivingTreatment(b, u, dt) {
  if (Math.min(...Object.values(u.health)) >= 65) return false;
  if (u.suppression > 0.55) return false;
  const threats = [...squadThreats(b, u.team), ...uncertainThreats(b, u)];
  if (exposure(u, threats) > 0.75) return false;
  return b.units.some(
    (m) =>
      m.active &&
      m.team === u.team &&
      m.role === "Medic" &&
      m.patientId === u.id &&
      m.state === "Treating" &&
      b.time - (m.treatmentAt ?? -Infinity) <= dt + 1e-8 &&
      distance(u, m) < 1.4 &&
      sight(u, m),
  );
}
