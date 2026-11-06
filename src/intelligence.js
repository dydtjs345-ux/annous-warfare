import { sight } from "./world.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function initializeIntel(battle) {
  for (const squad of battle.squads) {
    squad.intention ??= "Advance";
    squad.intel = {
      contacts: new Map(),
      incoming: new Map(),
      casualties: new Map(),
    };
  }
  for (const u of battle.units) u.intel = battle.squads[u.team].intel;
}
export function contacts(battle, team) {
  const intel = battle.squads[team].intel;
  return intel
    ? [...intel.contacts.values()]
        .filter((c) => battle.time - c.time < battle.contactTTL)
        .map((c) => ({
          ...c,
          confirmed: c.time === battle.time,
          confidence:
            Math.max(0, 1 - (battle.time - c.time) / battle.contactTTL) *
            (c.clearedAt != null ? 0.5 : 1),
        }))
    : [];
}
export function squadThreats(battle, team) {
  // Legacy unit memories remain useful local snapshots; never refresh their age
  // merely because another soldier reads them.
  const shared = contacts(battle, team);
  const local = battle.units
    .filter(
      (u) =>
        u.team === team &&
        !u.dead &&
        u.memory &&
        battle.time - u.memory.time < battle.contactTTL,
    )
    .map((u) => u.memory);
  return [
    ...new Map(
      [...local, ...shared].map((c) => [c.enemyId ?? `${c.x},${c.y}`, c]),
    ).values(),
  ];
}
export function notifySquad(battle, reporter, kind, report) {
  const squad = battle.squads[reporter.team];
  squad.nextTactical = Math.min(
    squad.nextTactical ?? Infinity,
    battle.time + 0.45,
  );
  if (kind === "sighting")
    squad.nextCoordination = Math.min(
      squad.nextCoordination ?? Infinity,
      battle.time + 0.45,
    );
  for (const u of battle.units)
    if (u.team === reporter.team && !u.dead && distance(u, reporter) <= 7) {
      // Repeated bursts refresh the board, not the reaction countdown.
      if (!u.alert || battle.time > u.alert.until)
        u.alert = {
          kind,
          report,
          at: battle.time,
          readyAt: battle.time + 0.2 + (u.id % 6) * 0.065,
          until: battle.time + 2.2,
        };
    }
}
export function reportIncoming(battle, receiver, shooter) {
  if (!receiver.intel) return;
  const angle = Math.atan2(shooter.y - receiver.y, shooter.x - receiver.x);
  // A 45-degree bearing, with no shooter identity, position, or range.
  const bearing = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const report = {
    kind: "direction",
    reporterId: receiver.id,
    origin: { x: receiver.x, y: receiver.y },
    bearing,
    time: battle.time,
  };
  receiver.intel.incoming.set(receiver.id, report);
  if (battle.time >= (receiver.nextFireReport ?? 0)) {
    notifySquad(battle, receiver, "incoming fire", report);
    receiver.nextFireReport = battle.time + 1;
  }
}
// Hearing yields a coarse bearing from the listener, never a shooter identity,
// exact coordinates, distance, firing permission or a synthetic visual contact.
export function reportGunfire(battle, shooter) {
  for (const u of battle.units) {
    if (!u.active || u.team === shooter.team || distance(u, shooter) > 20)
      continue;
    if (battle.time < (u.nextSoundReport ?? 0)) continue;
    const report = {
      kind: "gunfire",
      origin: { x: u.x, y: u.y },
      bearing:
        Math.round(
          Math.atan2(shooter.y - u.y, shooter.x - u.x) / (Math.PI / 4),
        ) *
        (Math.PI / 4),
      reporterId: u.id,
      time: battle.time,
    };
    u.intel.sounds.set(u.id, report);
    u.nextSoundReport = battle.time + 2;
    notifySquad(battle, u, "audible gunfire", report);
    const squad = battle.squads[u.team];
    squad.nextCoordination = Math.min(
      squad.nextCoordination ?? Infinity,
      battle.time + 0.45,
    );
  }
}
export function reportCasualty(battle, u) {
  if (!u.intel) return;
  const report = {
    kind: "casualty",
    unitId: u.id,
    x: u.x,
    y: u.y,
    time: battle.time,
  };
  u.intel.casualties.set(u.id, report);
  notifySquad(battle, u, "casualty", report);
}
export function uncertainThreats(battle, u) {
  if (!u.intel) return [];
  return [...u.intel.incoming.values()]
    .filter((r) => battle.time - r.time < 3 && distance(u, r.origin) <= 7)
    .map((r) => ({
      x: r.origin.x + Math.cos(r.bearing) * 6,
      y: r.origin.y + Math.sin(r.bearing) * 6,
      approximate: true,
    }));
}
export function perceive(battle) {
  const visible = new Map();
  // Gather every sighting before any soldier acts: no team or unit turn-order lag.
  for (const u of battle.units) {
    u.visibleEnemies = [];
    if (!u.active) continue;
    for (const e of battle.units)
      if (
        e.team !== u.team &&
        e.active &&
        distance(u, e) < (e.hit > 0 ? Math.max(15, u.range) : u.range) &&
        sight(u, e)
      ) {
        u.visibleEnemies.push(e);
        visible.set(`${u.team}:${e.id}`, true);
        const prior = u.intel.contacts.get(e.id);
        u.intel.contacts.set(e.id, {
          kind: "sighting",
          enemyId: e.id,
          x: e.x,
          y: e.y,
          time: battle.time,
          observedBy: u.id,
          observers:
            prior?.time === battle.time
              ? [...new Set([...prior.observers, u.id])]
              : [u.id],
          firedAt: prior?.firedAt ?? null,
          clearedAt: null,
        });
        if (!prior) notifySquad(battle, u, "sighting", { enemyId: e.id });
      }
  }
  for (let team = 0; team < 2; team++) {
    const intel = battle.squads[team].intel;
    for (const [id, c] of intel.contacts) {
      const cleared =
        !visible.has(`${team}:${id}`) &&
        battle.units.some(
          (u) =>
            u.team === team &&
            u.active &&
            distance(u, c) < u.range &&
            sight(u, c),
        );
      if (cleared && c.clearedAt == null) c.clearedAt = battle.time;
      if (battle.time - c.time >= battle.contactTTL) intel.contacts.delete(id);
    }
    for (const [id, r] of intel.incoming)
      if (battle.time - r.time >= 3) intel.incoming.delete(id);
    for (const [id] of intel.casualties) {
      const casualty = battle.units.find((u) => u.id === id);
      if (casualty.dead || Math.min(...Object.values(casualty.health)) >= 65)
        intel.casualties.delete(id);
    }
  }
}
export function adoptContact(battle, u) {
  const known = contacts(battle, u.team);
  const remember = (c) => {
    u.memory = { ...c };
    if (c.time >= (u.lastConfirmedAt ?? -Infinity)) {
      u.lastConfirmedAt = c.time;
      u.lastConfirmedObserverId = c.observedBy ?? null;
    }
  };
  // Preserve an existing assignment/contact; new information is not a focus-fire order.
  const current = known.find((c) => c.enemyId === u.memory?.enemyId);
  if (current) {
    remember(current);
    return;
  }
  if (
    u.memory &&
    battle.time - u.memory.time < battle.contactTTL &&
    u.memory.enemyId == null
  )
    return;
  u.memory = null;
  if (u.alert && battle.time < u.alert.readyAt) return;
  const chosen = known.sort((a, b) => distance(u, a) - distance(u, b))[0];
  if (chosen) remember(chosen);
}
export function selectEnemy(battle, u, enemies) {
  const inRange = enemies.filter((e) => distance(u, e) <= u.range);
  const candidates = inRange.length ? inRange : enemies;
  const existing = candidates.find((e) => e.id === u.engagementId);
  const ranked = [...candidates].sort((a, b) => {
    const priority = (e) => {
      let score = distance(u, e);
      if (
        u.role === "LMG" &&
        contacts(battle, u.team).some((c) => c.enemyId === e.id)
      ) {
        const threatensBuddy = [...u.intel.incoming.values()].some(
          (r) =>
            battle.time - r.time < 3 &&
            Math.cos(
              Math.atan2(e.y - r.origin.y, e.x - r.origin.x) - r.bearing,
            ) > 0.85,
        );
        if (threatensBuddy) score -= 3;
      }
      return score;
    };
    return priority(a) - priority(b);
  });
  const enemy = existing || ranked[0];
  if (!enemy) {
    if (battle.time - (u.lastTargetSeenAt ?? -Infinity) > 0.3) {
      u.engagementId = null;
      u.aimAt = 0;
    }
    return null;
  }
  u.lastTargetSeenAt = battle.time;
  if (u.engagementId !== enemy.id) {
    u.engagementId = enemy.id;
    u.aimAt = Math.max(
      battle.time + (u.role === "LMG" ? 0.55 : 0.35) + u.suppression * 0.25,
      u.alert?.readyAt ?? 0,
    );
  }
  return enemy;
}

export function markObservedFire(battle, shooter) {
  for (const observer of battle.units) {
    if (!observer.active || observer.team === shooter.team) continue;
    if (
      !observer.visibleEnemies.some((e) => e.id === shooter.id) ||
      !sight(observer, shooter)
    )
      continue;
    const c = observer.intel.contacts.get(shooter.id);
    if (c) c.firedAt = battle.time;
  }
}
