// Bounded presentation-only effects. Real events are the sole trigger; no RNG.
import { inView } from "./view.js";
export class GrenadeVisuals {
  constructor() {
    this.battle = null;
    this.serial = 0;
    this.clock = 0;
    this.effects = [];
  }
  update(b, dt, speed = 1, paused = false) {
    if (this.battle !== b) {
      this.battle = b;
      this.serial = 0;
      this.clock = 0;
      this.effects.length = 0;
    }
    if (!paused) this.clock += Math.min(dt, 0.1) * Math.sqrt(speed);
    for (let i = this.effects.length - 1; i >= 0; i--)
      if (this.clock - this.effects[i].at > 2) this.effects.splice(i, 1);
    for (const e of b.events) {
      if (e.id <= this.serial) continue;
      this.serial = e.id;
      if (e.type !== "grenadeBlast" && e.type !== "grenadeThrow") continue;
      if (this.effects.length >= 32) this.effects.shift();
      this.effects.push({
        x:
          e.type === "grenadeThrow"
            ? (e.startX ?? b.units?.[e.unitId]?.x ?? e.x)
            : e.x,
        y:
          e.type === "grenadeThrow"
            ? (e.startY ?? b.units?.[e.unitId]?.y ?? e.y)
            : e.y,
        kind: e.type,
        at: this.clock,
      });
    }
  }
  draw(g, iso, view = null) {
    for (const e of this.effects) {
      const p = iso(e.x, e.y),
        age = this.clock - e.at;
      if (view && !inView(p, view, 90)) continue;
      if (e.kind === "grenadeThrow") {
        if (age > 0.5) continue;
        g.lineStyle(2, 0xe2d29a, 1 - age * 2);
        g.strokeEllipse(p.x, p.y - 12, 18 + age * 25, 9 + age * 12);
        continue;
      }
      if (age < 0.22) {
        g.fillStyle(0xffefc7, Math.max(0, 1 - age / 0.22));
        g.fillEllipse(p.x, p.y - 5, 30 + age * 100, 17 + age * 45);
        g.fillStyle(0xffc67a, 0.9 * (1 - age / 0.22));
        g.fillRect(p.x - 6, p.y - 12, 12, 10);
      }
      const fade = Math.max(0, 1 - age / 2),
        radius = 12 + Math.min(age, 1.4) * 28;
      g.fillStyle(0x181d20, 0.5 * fade);
      g.fillEllipse(p.x, p.y, 35, 15);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.39996,
          x = p.x + Math.cos(a) * radius,
          y = p.y - 6 + Math.sin(a) * radius * 0.45 - age * 4;
        g.fillStyle(i % 2 ? 0x6f7067 : 0x898477, 0.3 * fade);
        g.fillEllipse(x, y, 14 + age * 9, 9 + age * 5);
        if (age < 0.5) {
          g.fillStyle(0xb8ad91, 1 - age * 2);
          g.fillRect(x, y, 2, 2);
        }
      }
    }
  }
}
