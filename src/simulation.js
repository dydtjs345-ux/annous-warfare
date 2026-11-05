import { W, H, blocked, sight, cover, path } from "./world.js";
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
  constructor(random = Math.random) {
    this.random = random;
    this.time = 0;
    this.result = null;
    this.shots = [];
    this.squads = [
      { goal: { x: 13, y: 8 }, timer: 0 },
      { goal: { x: 16, y: 18 }, timer: 0 },
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
        });
  }
  injury(u, p, damage) {
    u.health[p] = Math.max(0, u.health[p] - damage);
    u.hit = 0.3;
    if (u.health.head <= 0 || u.health.torso <= 0) {
      u.active = false;
      u.dead = true;
      u.state = "Eliminated";
    } else if (
      u.health.torso < 22 ||
      u.health.head < 25 ||
      u.health["left leg"] + u.health["right leg"] < 25
    ) {
      u.active = false;
      u.state = "Incapacitated";
    }
  }
  step(dt) {
    if (this.result) return;
    this.time += dt;
    this.shots = this.shots.filter((s) => (s.life -= dt) > 0);
    for (let team = 0; team < 2; team++) {
      const squad = this.squads[team],
        alive = this.units.filter((u) => u.team === team && u.active),
        leader = alive.find((u) => u.role === "Leader") || alive[0];
      squad.timer -= dt;
      if (leader && squad.timer <= 0) {
        const known = alive
          .map((u) => u.memory)
          .filter((m) => m && this.time - m.time < 12);
        squad.goal = known.length
          ? { x: Math.round(known[0].x), y: Math.round(known[0].y) }
          : {
              x: 2 + Math.floor(this.random() * (W - 4)),
              y: 2 + Math.floor(this.random() * (H - 4)),
            };
        squad.timer = 8;
      }
    }
    for (const u of this.units) {
      u.hit = Math.max(0, u.hit - dt);
      if (!u.active) continue;
      u.cooldown -= dt;
      const enemies = this.units
        .filter(
          (e) =>
            e.team !== u.team &&
            e.active &&
            dist(u, e) < (e.hit > 0 ? Math.max(15, u.range) : u.range) &&
            sight(u, e),
        )
        .sort((a, b) => dist(u, a) - dist(u, b));
      const enemy = enemies[0];
      if (enemy) u.memory = { x: enemy.x, y: enemy.y, time: this.time };
      if (u.reload > 0) {
        u.reload -= dt;
        u.state = "Reloading";
        if (u.reload <= 0) {
          const n = Math.min(u.mag, u.reserve);
          u.ammo = n;
          u.reserve -= n;
        }
        continue;
      }
      if (u.role === "Medic" && !enemy) {
        const patient = this.units
          .filter(
            (a) =>
              a.team === u.team &&
              !a.dead &&
              a !== u &&
              Math.min(...Object.values(a.health)) < 65,
          )
          .sort((a, b) => dist(u, a) - dist(u, b))[0];
        if (patient) {
          u.state = "Moving to casualty";
          if (dist(u, patient) < 1.4) {
            u.state = "Treating";
            u.treat += dt;
            if (u.treat >= 1) {
              u.treat = 0;
              for (const p of parts)
                patient.health[p] = Math.min(100, patient.health[p] + 8);
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
          this.move(u, patient, dt);
          continue;
        }
      }
      if (u.ammo === 0 && u.reserve > 0) {
        u.reload = u.role === "LMG" ? 4.5 : 2.6;
        continue;
      }
      if (enemy && dist(u, enemy) <= u.range && u.ammo > 0) {
        u.facing = Math.atan2(enemy.y - u.y, enemy.x - u.x);
        u.state = "Engaging";
        if (u.cooldown <= 0) {
          u.ammo--;
          u.cooldown = u.role === "LMG" ? 0.2 : 0.65;
          this.shots.push({
            a: { x: u.x, y: u.y },
            b: { x: enemy.x, y: enemy.y },
            life: 0.09,
          });
          const arms = (u.health["left arm"] + u.health["right arm"]) / 200;
          const chance = Math.max(
            0.06,
            (0.72 - dist(u, enemy) * 0.033) *
              (0.4 + 0.6 * arms) *
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
            this.injury(enemy, p, p === "head" ? 65 : 28 + this.random() * 24);
          }
        }
        if (cover(u, enemy) < 0.25 && u.cooldown > 0.15) {
          const options = [];
          for (let dx = -2; dx <= 2; dx++)
            for (let dy = -2; dy <= 2; dy++) {
              const a = { x: Math.round(u.x) + dx, y: Math.round(u.y) + dy };
              if (
                !blocked(a.x, a.y) &&
                sight(a, enemy) &&
                cover(a, enemy) > 0.25
              )
                options.push(a);
            }
          if (options.length) {
            u.state = "Seeking cover";
            this.move(u, options[0], dt);
          }
        }
        continue;
      }
      const squad = this.squads[u.team],
        leader = this.units.find(
          (a) => a.team === u.team && a.role === "Leader" && a.active,
        );
      let goal =
        u.memory && this.time - u.memory.time < 10 ? u.memory : squad.goal;
      if (leader && leader !== u && dist(u, leader) > 5) {
        goal = leader;
        u.state = "Regrouping";
      } else
        u.state =
          u.memory && this.time - u.memory.time < 10
            ? "Searching last contact"
            : "Patrolling";
      this.move(u, goal, dt);
    }
    const counts = [0, 1].map(
      (t) => this.units.filter((u) => u.team === t && u.active).length,
    );
    if (counts.includes(0))
      this.result =
        counts[0] === counts[1]
          ? "Draw"
          : counts[0]
            ? "USMC victory"
            : "Russian infantry victory";
  }
  move(u, goal, dt) {
    if (
      !u.route.length ||
      u.routeGoal !== `${Math.round(goal.x)},${Math.round(goal.y)}`
    ) {
      u.route = path(u, goal);
      u.routeGoal = `${Math.round(goal.x)},${Math.round(goal.y)}`;
    }
    const n = u.route[0];
    if (!n) return;
    const dx = n[0] - u.x,
      dy = n[1] - u.y,
      d = Math.hypot(dx, dy);
    const legs = (u.health["left leg"] + u.health["right leg"]) / 200,
      speed = 1.7 * (0.25 + 0.75 * legs);
    if (d < speed * dt) {
      u.x = n[0];
      u.y = n[1];
      u.route.shift();
    } else {
      u.x += (dx / d) * speed * dt;
      u.y += (dy / d) * speed * dt;
    }
    u.facing = Math.atan2(dy, dx);
  }
}
