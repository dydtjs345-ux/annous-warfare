import { crossingPermit } from "./crossings.js";
import { updateSecurity } from "./security.js";
import { coordinateFireMovement } from "./fire-movement.js";
import { suppressiveFire } from "./suppressive-fire.js";
import { updatePosture, holdPosture, releasePosture } from "./postures.js";
import {
  initializeGrenades,
  updateGrenades,
  grenadeAction,
} from "./grenades.js";
import { choosePatient, receivingTreatment } from "./medical.js";
import { updateMount, releaseMount, mountBonus } from "./mounting.js";
import {
  initializePresentation,
  beginPresentationStep,
  finishPresentationStep,
  emitVisualEvent,
} from "./presentation-state.js";
import {
  coordinateSquad,
  followAssignment,
  recordCombatLoss,
  updateProgress,
} from "./coordination.js";
import { refreshDiagnostics, firingStatus } from "./diagnostics.js";
import { initializeSearch, updateSearchState } from "./search.js";
import { expandedSpawns } from "./expanded-world.js";
import {
  initializeIntel,
  perceive,
  adoptContact,
  selectEnemy,
  squadThreats,
  uncertainThreats,
  reportCasualty,
  markObservedFire,
  reportGunfire,
} from "./intelligence.js";
import {
  accuracyFactor,
  decaySuppression,
  incomingFire,
  updateSquadTactics,
  localCover,
  followManeuver,
  careRouteSafe,
} from "./tactics.js";
import {
  configureWorld,
  W,
  H,
  blocked,
  sight,
  cover,
  path,
  reachableGoal,
  key,
} from "./world.js";
export const parts = [
  "head",
  "torso",
  "left arm",
  "right arm",
  "left leg",
  "right leg",
];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export class Battle {
  constructor(random = Math.random, options = {}) {
    this.world = {
      kind: options.map ?? "legacy",
      variant: options.variant ?? 0,
    };
    configureWorld(this.world.kind, this.world.variant);
    this.dimensions = { width: W, height: H };
    this.tacticalEnabled = options.tactical ?? this.world.kind === "expanded";
    this.contactTTL = options.contactTTL ?? 8;
    this.random = random;
    this.time = 0;
    this.result = null;
    this.shots = [];
    this.squads = [
      { goal: { x: 13, y: 8 }, timer: 8 },
      { goal: { x: 16, y: 18 }, timer: 8 },
    ];
    this.units = [];
    for (let team = 0; team < 2; team++)
      for (let i = 0; i < 6; i++)
        this.units.push({
          id: team * 6 + i,
          team,
          name: `${team ? "RU" : "USMC"} ${i + 1}`,
          role:
            i === 5
              ? "Medic"
              : i === 4
                ? "LMG"
                : i === 0
                  ? "Leader"
                  : "Rifleman",
          x: team ? 27 : 2,
          y: 8 + i * 1.5,
          health: Object.fromEntries(parts.map((p) => [p, 100])),
          ammo: i === 4 ? 60 : 30,
          mag: i === 4 ? 60 : 30,
          range: i === 4 ? 14 : i === 5 ? 10 : 12,
          reserve: i === 4 ? 300 : 180,
          reload: 0,
          cooldown: 0,
          state: "Advancing",
          active: true,
          dead: false,
          route: [],
          memory: null,
          hit: 0,
          facing: team ? Math.PI : 0,
          treat: 0,
          order: "Advance",
          target: null,
          navigation: "Awaiting update",
          replanAt: 0,
          suppression: 0,
          nextAssessment: 0,
          coverTarget: null,
        });
    if (this.world.kind === "expanded") {
      this.spawn = options.spawn ?? 0;
      const positions = expandedSpawns(this.spawn);
      for (const u of this.units) Object.assign(u, positions[u.team][u.id % 6]);
      for (let team = 0; team < 2; team++)
        this.squads[team].goal = {
          x: this.units[team * 6].x,
          y: this.units[team * 6].y,
        };
    }
    initializeIntel(this);
    initializePresentation(this);
    initializeGrenades(this, options.grenades ?? false);
    initializeSearch(this);
  }
  injury(u, p, damage) {
    const wasActive = u.active,
      wasDead = u.dead,
      oldHealth = u.health[p];
    u.health[p] = Math.max(0, u.health[p] - damage);
    u.hit = 0.3;
    reportCasualty(this, u);
    if (u.health.head <= 0 || u.health.torso <= 0) {
      u.active = false;
      u.dead = true;
      u.state = "Eliminated";
      u.order = u.navigation = "Eliminated";
      u.target = null;
    } else if (
      u.health.torso < 22 ||
      u.health.head < 25 ||
      u.health["left leg"] + u.health["right leg"] < 25
    ) {
      u.active = false;
      u.state = "Incapacitated";
      u.order = u.navigation = "Incapacitated";
      u.target = null;
    }
    if (wasActive && !u.active) {
      recordCombatLoss(this, u);
      u.grenadePrep = null;
      releaseMount(this, u, "Combat ineffective");
    }
    if (u.health[p] < oldHealth)
      emitVisualEvent(this, "damage", u, {
        part: p,
        amount: oldHealth - u.health[p],
      });
    if (!wasDead && u.dead) emitVisualEvent(this, "death", u);
    else if (wasActive && !u.active) emitVisualEvent(this, "incapacitated", u);
  }
  step(dt) {
    if (this.result) return;
    configureWorld(this.world.kind, this.world.variant);
    beginPresentationStep(this);
    this.time += dt;
    this.shots = this.shots.filter((s) => (s.life -= dt) > 0);
    for (const u of this.units) decaySuppression(u, dt);
    updateGrenades(this);
    for (const u of this.units) {
      updatePosture(this, u);
      updateSecurity(this, u);
    }
    perceive(this);
    for (const u of this.units) if (!u.dead) adoptContact(this, u);
    for (let team = 0; team < 2; team++) {
      updateSearchState(this, team);
      coordinateSquad(this, team);
      updateSquadTactics(this, team);
      coordinateFireMovement(this, team);
      const squad = this.squads[team],
        alive = this.units.filter((u) => u.team === team && u.active),
        leader = alive.find((u) => u.role === "Leader") || alive[0];
      squad.timer -= dt;
      if (!this.searchEnabled && leader && squad.timer <= 0) {
        const known = squadThreats(this, team);
        const desired = known.length
          ? { x: Math.round(known[0].x), y: Math.round(known[0].y) }
          : {
              x: 2 + Math.floor(this.random() * (W - 4)),
              y: 2 + Math.floor(this.random() * (H - 4)),
            };
        squad.goal = reachableGoal(leader, desired);
        squad.timer = 8;
      }
    }
    for (const u of this.units) {
      u.hit = Math.max(0, u.hit - dt);
      if (!u.active) continue;
      u.decisionReason = null;
      u.decisionSource = "personal decision";
      u.assignmentPause = u.assignment ? "personal priority" : null;
      u.waitingCoordination = false;
      u.holdReason = null;
      u.movementBlocker = null;
      u.order = "Hold";
      u.target = null;
      u.navigation = "Holding";
      u.cooldown -= dt;
      const enemies = u.visibleEnemies.filter((e) => e.active && sight(u, e));
      const enemy = selectEnemy(this, u, enemies);
      updateMount(this, u, enemy);
      if (grenadeAction(this, u, dt)) continue;
      u.treat =
        this.time - (u.treatmentAt ?? -Infinity) <= dt + 1e-8 ? u.treat : 0;
      if (u.reload > 0) {
        // Reload timing remains authoritative; hands being busy must not prevent
        // a short defensive move after direct contact / an incoming-fire report.
        const threats = enemies.length ? enemies : uncertainThreats(this, u);
        const relocating = threats.length && localCover(this, u, threats, dt);
        u.reload -= dt;
        u.state = "Reloading";
        u.order = relocating ? "Reload; improve protected position" : "Reload";
        if (u.reload <= 0) {
          const n = Math.min(u.mag, u.reserve);
          u.ammo = n;
          u.reserve -= n;
        }
        continue;
      }
      if (u.role === "Medic" && u.suppression < 0.55) {
        const patient = choosePatient(this, u, enemy);
        if (
          patient &&
          (!u.alert ||
            this.time >= u.alert.readyAt ||
            u.patientId === patient.id) &&
          (dist(u, patient) < 1.4 || careRouteSafe(this, u, patient))
        ) {
          if (u.patientId !== patient.id) u.treat = 0;
          u.patientId = patient.id;
          u.state = "Moving to casualty";
          u.order = "Treat casualty";
          if (dist(u, patient) < 1.4 && sight(u, patient)) {
            u.state = "Treating";
            if (u.patientId !== patient.id) u.treat = 0;
            u.patientId = patient.id;
            u.treatmentAt = this.time;
            u.treat += dt;
            if (u.treat >= 1) {
              u.treat = 0;
              const healthBefore = Object.values(patient.health).reduce(
                (a, b) => a + b,
                0,
              );
              for (const p of parts)
                patient.health[p] = Math.min(100, patient.health[p] + 8);
              const restored =
                Object.values(patient.health).reduce((a, b) => a + b, 0) -
                healthBefore;
              if (restored > 0) {
                emitVisualEvent(this, "treatmentTick", u, {
                  patientId: patient.id,
                  restored,
                });
                if (Math.min(...Object.values(patient.health)) >= 65)
                  emitVisualEvent(this, "treatmentComplete", u, {
                    patientId: patient.id,
                  });
              }
              if (
                patient.health.torso >= 30 &&
                patient.health.head >= 30 &&
                patient.health["left leg"] + patient.health["right leg"] >= 40
              ) {
                patient.active = true;
                patient.state = "Recovering";
              }
            }
            continue;
          }
          if (this.move(u, patient, dt) === false) {
            // Keep failures per casualty: another attempted goal must not erase
            // the first one and create an immediate retry alternation.
            u.failedCareRoutes = (u.failedCareRoutes ?? []).filter(
              (f) => f.until > this.time && f.patientId !== patient.id,
            );
            u.failedCareRoutes.push({
              patientId: patient.id,
              patient: { x: patient.x, y: patient.y },
              origin: { x: u.x, y: u.y },
              until: this.time + 8,
            });
            this.squads[u.team].nextCoordination = this.time;
          }
          continue;
        }
      }
      if (u.ammo === 0 && u.reserve > 0) {
        u.reload = u.role === "LMG" ? 4.5 : 2.6;
        u.state = "Reloading";
        u.order = "Reload";
        continue;
      }
      if (holdPosture(this, u)) continue;
      if (enemy && dist(u, enemy) <= u.range && u.ammo > 0) {
        u.facing = Math.atan2(enemy.y - u.y, enemy.x - u.x);
        u.decisionSource = "immediate threat";
        u.assignmentPause = "direct enemy contact";
        u.state = "Engaging";
        u.order = "Engage visible enemy";
        if (firingStatus(this, u, enemy).permitted) {
          u.firedAt = this.time;
          u.ammo--;
          u.cooldown = u.role === "LMG" ? 0.2 : 0.65;
          this.shots.push({
            a: { x: u.x, y: u.y },
            b: { x: enemy.x, y: enemy.y },
            life: 0.09,
          });
          emitVisualEvent(this, "shot", u, {
            x: u.x,
            y: u.y,
            targetX: enemy.x,
            targetY: enemy.y,
            angle: u.facing,
            weapon: u.role === "LMG" ? "LMG" : "rifle",
            supported: u.mount?.state === "mounted",
          });
          incomingFire(this, u, enemy);
          markObservedFire(this, u);
          if (this.searchEnabled) reportGunfire(this, u);
          const arms = (u.health["left arm"] + u.health["right arm"]) / 200;
          const chance = Math.max(
            0.06,
            (0.72 - dist(u, enemy) * 0.033) *
              (0.4 + 0.6 * arms) *
              accuracyFactor(u) *
              mountBonus(u, "accuracy") *
              (1 - cover(enemy, u)),
          );
          if (this.random() < chance) {
            const roll = this.random();
            const p =
              roll < 0.12
                ? "head"
                : roll < 0.55
                  ? "torso"
                  : parts[2 + Math.floor(this.random() * 4)];
            this.squads[u.team].lastProgress = this.time;
            this.injury(enemy, p, p === "head" ? 65 : 28 + this.random() * 24);
          }
        }
        if (this.time < u.aimAt) {
          u.state = "Aiming";
          u.order = "Acquire visible target";
        }
        this.squads[u.team].searches?.delete(u.id);
        u.contactWait = null;
        const maneuver = this.squads[u.team].maneuver;
        if (!localCover(this, u, enemies, dt))
          followManeuver(this, u, maneuver, dt);
        if (
          ["Engaging", "Aiming"].includes(u.state) &&
          ["deploying", "unmounting"].includes(u.mount?.state)
        ) {
          u.state =
            u.mount.state === "deploying" ? "Deploying LMG" : "Unmounting LMG";
          u.order = u.mount.reason;
        }
        continue;
      }
      const tactical = this.squads[u.team],
        maneuver = tactical.maneuver;
      const recent = u.memory && this.time - u.memory.time < this.contactTTL;
      const alertReady =
        u.alert && this.time >= u.alert.readyAt && this.time < u.alert.until;
      const uncertain = alertReady ? uncertainThreats(this, u) : [];
      // Local self-preservation precedes radio assignments and coordination waits.
      const defensive = enemies.length
        ? enemies
        : [
            ...squadThreats(this, u.team).filter(
              (t) =>
                t.confidence > 0.7 &&
                t.clearedAt == null &&
                dist(u, t) <= u.range,
            ),
            ...uncertain,
          ];
      // A stale personal cover approach must not repeatedly replace an active
      // leader-planned recon route after direct contact is lost.
      if (
        !enemies.length &&
        u.assignment?.type === "recon" &&
        u.suppression <= 0.55
      )
        u.coverTarget = null;
      if (
        defensive.length &&
        (enemies.length ||
          u.assignment?.type !== "recon" ||
          u.coverTarget ||
          u.suppression > 0.65) &&
        localCover(this, u, defensive, dt)
      )
        continue;
      if (!enemy && suppressiveFire(this, u)) continue;
      if (followManeuver(this, u, maneuver, dt)) continue;
      if (followAssignment(this, u, dt)) continue;
      if (recent) {
        if (u.suppression > 0.55) {
          u.state = "Pinned";
          u.order = "Maintain protection under fire";
          u.decisionSource = "immediate threat";
        } else {
          u.state = "Awaiting coordination";
          u.order = "Await observation assignment";
          u.waitingCoordination = true;
        }
        u.decisionReason =
          u.alternativeRejection ?? "Waiting for bounded squad reassessment";
        continue;
      }
      if (!recent && uncertain.length) {
        if (localCover(this, u, uncertain, dt)) continue;
        u.state = "Watching reported sector";
        u.order =
          u.role === "LMG"
            ? "Cover teammates; await visual confirmation"
            : "Cover nearby teammates";
        continue;
      }
      if (
        !recent &&
        alertReady &&
        u.alert.kind === "casualty" &&
        u.role !== "Medic"
      ) {
        u.state = "Covering casualty";
        u.order = "Cover nearby casualty";
        continue;
      }
      if (!recent && u.suppression > 0.65) {
        u.state = "Pinned";
        u.order = "Hold under incoming fire";
        continue;
      }
      if (!recent) u.coverTarget = null;
      const squad = this.squads[u.team],
        leader = this.units.find(
          (a) => a.team === u.team && a.role === "Leader" && a.active,
        );
      let goal =
        u.memory && this.time - u.memory.time < 10 ? u.memory : squad.goal;
      if (leader && leader !== u) {
        if (dist(u, leader) > 7) u.regrouping = true;
        if (dist(u, leader) < 4) u.regrouping = false;
      } else u.regrouping = false;
      if (leader && leader !== u && u.regrouping) {
        goal = leader;
        u.state = "Regrouping";
      } else
        u.state =
          u.memory && this.time - u.memory.time < 10
            ? "Searching last contact"
            : "Patrolling";
      u.order = u.state;
      this.move(u, this.formationGoal(u, goal), dt);
    }
    for (const u of this.units) {
      if (u.suppressionTask && u.state !== "Suppressing last-known")
        u.suppressionTask.active = false;
      if (u.active) updateProgress(this, u);
      refreshDiagnostics(this, u);
    }
    finishPresentationStep(this, dt);
    const counts = [0, 1].map(
      (t) => this.units.filter((u) => u.team === t && u.active).length,
    );
    if (counts.includes(0) && !this.grenades.some((g) => !g.detonatedAt))
      this.result =
        counts[0] === counts[1]
          ? "Draw"
          : counts[0]
            ? "USMC victory"
            : "Russian infantry victory";
  }
  // Assign nearby distinct cells without changing the squad's tactical objective.
  formationGoal(u, goal) {
    const offsets = [
      [0, 0],
      [-1, 0],
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 1],
    ];
    const [dx, dy] = offsets[u.id % 6];
    const desired = { x: Math.round(goal.x) + dx, y: Math.round(goal.y) + dy };
    if (
      u.formationKey === key(desired.x, desired.y) &&
      !(
        u.failedGoal &&
        u.failedGoal.until > this.time &&
        dist(u.formationTarget, u.failedGoal) < 0.8
      )
    )
      return u.formationTarget;
    const candidates = [];
    for (let x = desired.x - 2; x <= desired.x + 2; x++)
      for (let y = desired.y - 2; y <= desired.y + 2; y++) {
        if (
          !blocked(x, y) &&
          !(
            u.failedGoal &&
            u.failedGoal.until > this.time &&
            dist({ x, y }, u.failedGoal) < 0.8
          ) &&
          !this.units.some(
            (a) =>
              a !== u &&
              a.team === u.team &&
              a.active &&
              a.formationTarget?.x === x &&
              a.formationTarget?.y === y,
          )
        )
          candidates.push({ x, y });
      }
    candidates.sort((a, b) => dist(a, desired) - dist(b, desired));
    const target = candidates.find(
      (a) =>
        (Math.round(u.x) === a.x && Math.round(u.y) === a.y) ||
        path(u, a).length,
    );
    u.formationKey = key(desired.x, desired.y);
    u.formationTarget = target || reachableGoal(u, desired);
    return u.formationTarget;
  }
  spaceFree(u, position) {
    return (
      !blocked(Math.round(position.x), Math.round(position.y)) &&
      !this.units.some(
        (a) => a !== u && !a.dead && dist(a, position) < 0.6 - 1e-8,
      )
    );
  }
  noteMovementFailure(u) {
    // Give the next recovery attempt a fresh progress window.
    u.navProgressAt = this.time;
    u.navPosition = { x: u.x, y: u.y };
    if (!u.progress) updateProgress(this, u);
    if (u.progress && this.time - (u.lastFailureAt ?? -Infinity) > 1) {
      u.progress.failedAttempts++;
      u.lastFailureAt = this.time;
    }
  }
  move(u, goal, dt) {
    releasePosture(u);
    if (!u.active) return false;
    if (u.state !== "Evading grenade" && receivingTreatment(this, u, dt)) {
      u.navigation = "Receiving treatment; retain squad objective";
      u.decisionReason =
        "Hold for active nearby medic; immediate survival may interrupt";
      if (!["Engaging", "Aiming", "Reloading"].includes(u.state))
        u.state = "Receiving treatment";
      return true;
    }
    if (u.mount && u.mount.state !== "unsupported" && dist(u, goal) > 0.2) {
      releaseMount(this, u, "Movement objective requires unmounting");
      u.navigation = "Unmounting before movement";
      u.state = "Unmounting LMG";
      return true;
    }
    if (
      this.time - (u.lastMoveCall ?? -Infinity) > 1 ||
      !u.navPosition ||
      dist(u, u.navPosition) >= 0.5
    ) {
      u.navProgressAt = this.time;
      u.navPosition = { x: u.x, y: u.y };
    }
    u.lastMoveCall = this.time;
    u.target = { x: Math.round(goal.x), y: Math.round(goal.y) };
    if (blocked(u.target.x, u.target.y)) u.target = reachableGoal(u, u.target);
    const goalKey = key(u.target.x, u.target.y);
    if (
      u.routeGoal !== goalKey ||
      (!u.route.length && this.time >= u.replanAt)
    ) {
      u.route = path(u, u.target);
      u.routeBlockedByUnits = false;
      u.routeGoal = goalKey;
      u.replanAt = this.time + 0.6;
    }
    // BFS starts at a rounded cell; finish the remaining fractional step inside it.
    if (
      !u.route.length &&
      Math.round(u.x) === u.target.x &&
      Math.round(u.y) === u.target.y &&
      dist(u, u.target) > 0.01
    ) {
      u.route = [[u.target.x, u.target.y]];
    }
    const n = u.route[0];
    if (!n) {
      u.navigation =
        dist(u, u.target) < 0.1
          ? "Arrived"
          : u.routeBlockedByUnits
            ? "Waiting for spacing"
            : "No route";
      if (u.navigation === "Arrived") {
        u.navProgressAt = this.time;
        return true;
      }
      u.movementBlocker = u.routeBlockedByUnits
        ? "Soldier congestion"
        : "No terrain route";
      u.failedGoal = { ...u.target, until: this.time + 8 };
      this.noteMovementFailure(u);
      return false;
    }
    if (!crossingPermit(this, u, u.route)) return true;
    // Tiny back-and-forth steps are not net navigation progress, even if each
    // leg is collision-free. Use the same timeout as blocked-route recovery.
    if (this.time - u.navProgressAt > 3 && dist(u, u.target) > 0.2) {
      u.navigation = "No net movement progress";
      u.movementBlocker = "No net movement progress";
      u.failedGoal = { ...u.target, until: this.time + 8 };
      this.noteMovementFailure(u);
      return false;
    }
    const dx = n[0] - u.x,
      dy = n[1] - u.y,
      d = Math.hypot(dx, dy);
    const legs = (u.health["left leg"] + u.health["right leg"]) / 200;
    const step = Math.min(d, 1.7 * (0.25 + 0.75 * legs) * dt);
    const next = d
      ? { x: u.x + (dx / d) * step, y: u.y + (dy / d) * step }
      : { x: u.x, y: u.y };
    // Sweep short increments so accelerated simulation cannot cross another unit.
    let clear = true;
    for (let t = 0.2; t <= 1.001; t += 0.2)
      if (
        !this.spaceFree(u, {
          x: u.x + (next.x - u.x) * t,
          y: u.y + (next.y - u.y) * t,
        })
      )
        clear = false;
    if (!clear) {
      u.navigation = "Waiting for spacing";
      u.movementBlocker = "Soldier congestion";
      if (this.time >= u.replanAt) {
        const occupied = new Set(
          this.units
            .filter(
              (a) =>
                a !== u &&
                !a.dead &&
                (a.team === u.team ||
                  dist(u, a) < 0.8 ||
                  (u.visibleEnemies?.some((e) => e.id === a.id) &&
                    sight(u, a))),
            )
            .map((a) => key(Math.round(a.x), Math.round(a.y))),
        );
        occupied.delete(key(Math.round(u.x), Math.round(u.y)));
        // A casualty is an approach endpoint. Including that occupied endpoint
        // rejects every detour, although care starts at 1.4 tiles with clear LOS.
        // Keep physical separation and first-step collision checks below intact.
        if (
          (this.world.kind === "urban" || this.world.kind === "expanded") &&
          u.role === "Medic" &&
          u.state === "Moving to casualty" &&
          u.patientId === goal.id &&
          goal.team === u.team &&
          !goal.dead
        )
          occupied.delete(key(Math.round(goal.x), Math.round(goal.y)));
        u.route = path(u, u.target, occupied, (p) => {
          for (let t = 0.2; t <= 1.001; t += 0.2)
            if (
              !this.spaceFree(u, {
                x: u.x + (p.x - u.x) * t,
                y: u.y + (p.y - u.y) * t,
              })
            )
              return false;
          return true;
        });
        u.routeBlockedByUnits = true;
        u.replanAt = this.time + 0.6;
      }
      if (this.time - u.navProgressAt > 3) {
        u.failedGoal = { ...u.target, until: this.time + 8 };
        this.noteMovementFailure(u);
        return false;
      }
      return true;
    }
    u.x = next.x;
    u.y = next.y;
    // Travel direction must not overwrite this interval's authoritative shot aim.
    const aiming = (u.visibleEnemies ?? []).find(
      (e) =>
        e.id === u.engagementId &&
        e.active &&
        sight(u, e) &&
        dist(u, e) <= u.range,
    );
    if (this.tacticalEnabled) u.movementHeading = Math.atan2(dy, dx);
    if (u.firedAt !== this.time)
      u.facing = aiming
        ? Math.atan2(aiming.y - u.y, aiming.x - u.x)
        : this.tacticalEnabled
          ? (u.observationHeading ?? Math.atan2(dy, dx))
          : Math.atan2(dy, dx);
    u.navigation = "Moving";
    if (d <= step) u.route.shift();
    return true;
  }
}
