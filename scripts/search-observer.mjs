import { createHash } from "node:crypto";
export function searchObserver(b) {
  const hash = createHash("sha256"),
    last = [
      { visible: new Set(), lost: new Map(), rev: 0 },
      { visible: new Set(), lost: new Map(), rev: 0 },
    ];
  const metrics = {
    firstContact: null,
    firstSound: null,
    searchSquadSeconds: 0,
    phaseSeconds: {},
    contactLosses: 0,
    reacquired: 0,
    reacquisitionDelays: [],
    goalChanges: 0,
    repeats: 0,
    failedObjectives: 0,
    goalChangesWithoutProgress: 0,
    recentRepeatedGoals: 0,
  };
  let sampleAt = 0;
  return {
    step(dt) {
      for (let team = 0; team < 2; team++) {
        const q = b.squads[team],
          s = q.search,
          l = last[team];
        metrics.phaseSeconds[s.phase] =
          (metrics.phaseSeconds[s.phase] ?? 0) + dt;
        if (["SEARCH", "SEARCH_AGAIN"].includes(s.phase))
          metrics.searchSquadSeconds += dt;
        const ids = new Set(
          [...q.intel.contacts.values()]
            .filter((c) => c.time === b.time)
            .map((c) => c.enemyId),
        );
        if (ids.size && metrics.firstContact == null)
          metrics.firstContact = b.time;
        if (q.intel.sounds.size && metrics.firstSound == null)
          metrics.firstSound = b.time;
        for (const id of l.visible)
          if (!ids.has(id) && !l.lost.has(id)) {
            l.lost.set(id, b.time);
            metrics.contactLosses++;
          }
        for (const id of ids)
          if (l.lost.has(id)) {
            metrics.reacquired++;
            metrics.reacquisitionDelays.push(b.time - l.lost.get(id));
            l.lost.delete(id);
          }
        l.visible = ids;
        if (s.revision !== l.rev) {
          metrics.goalChanges++;
          const seen = s.seen.filter(Number.isFinite).length;
          if (l.rev && seen === l.seen && b.time - s.lastProgress > 5)
            metrics.goalChangesWithoutProgress++;
          if (
            s.goal &&
            s.visits[s.goal.id] &&
            b.time - s.seen[s.goal.id] < 60 &&
            s.goal.evidenceAt == null
          )
            metrics.recentRepeatedGoals++;
          l.rev = s.revision;
          l.seen = seen;
        }
      }
      if (b.time >= sampleAt) {
        sampleAt = b.time + 1;
        hash.update(
          JSON.stringify([
            b.time,
            b.squads.map((q) => [
              q.search.phase,
              q.search.goal,
              [...q.search.seen],
              [...q.search.visits],
              q.search.history,
              [...q.assignments.values()].map((a) => [
                a.unitId,
                a.type,
                a.target,
                a.failed,
              ]),
            ]),
          ]),
        );
      }
    },
    finish() {
      const squads = b.squads.map((q) => ({
        phase: q.search.phase,
        observed: q.search.seen.filter(Number.isFinite).length,
        landmarks: b.searchNodes.length,
        coverage:
          q.search.seen.filter(Number.isFinite).length / b.searchNodes.length,
        completed: q.search.completed,
        repeats: q.search.repeated,
        failedObjectives: q.search.failedObjectives,
        blocker: q.search.blocker,
        goal: q.search.goal,
        history: q.search.history,
      }));
      metrics.coverage = squads.reduce((n, q) => n + q.coverage, 0) / 2;
      metrics.repeats = squads.reduce((n, q) => n + q.repeats, 0);
      metrics.failedObjectives = squads.reduce(
        (n, q) => n + q.failedObjectives,
        0,
      );
      metrics.unresolvedContacts = last.reduce((n, l) => n + l.lost.size, 0);
      const live = b.units.filter((u) => u.active);
      metrics.timeoutReason = b.result
        ? null
        : live.every((u) => u.ammo === 0 && u.reserve === 0 && !u.frags)
          ? "Ammunition exhausted"
          : squads
              .map((q) => q.blocker)
              .filter(Boolean)
              .join("; ") ||
            (live.some((u) => b.time - (u.progress?.lastMovement ?? 0) < 10)
              ? "Active movement/combat without resolution"
              : "No recent useful movement; inspect trace");
      return { ...metrics, squads, digest: hash.digest("hex") };
    },
  };
}
