import { inspectSoldier } from "./inspection.js";
import Phaser from "phaser";
import "./style.css";
import { Battle } from "./simulation.js";
import { W, H, houses, obstacles, inside } from "./world.js";
const iso = (x, y) => ({ x: 700 + (x - y) * 20, y: 55 + (x + y) * 10 });
class Battlefield extends Phaser.Scene {
  create() {
    this.battle = new Battle();
    this.speed = 1;
    this.paused = false;
    this.acc = 0;
    this.selected = null;
    this.g = this.add.graphics();
    this.input.addPointer(2);
    const c = this.cameras.main;
    c.setBackgroundColor("#101b26");
    c.setZoom(Math.min(this.scale.width / 1050, this.scale.height / 680));
    c.centerOn(760, 325);
    this.lastTouches = null;
    this.down = null;
    this.input.on("pointerdown", (p) => {
      this.down = { x: p.x, y: p.y };
      this.gestureMoved =
        this.input.manager.pointers.filter((p) => p.isDown).length > 1;
    });
    this.input.on("pointermove", (p) => {
      const pointers = this.input.manager.pointers.filter((p) => p.isDown);
      if (this.down && Math.hypot(p.x - this.down.x, p.y - this.down.y) > 8)
        this.gestureMoved = true;
      if (pointers.length >= 2) {
        const [a, b] = pointers;
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (this.lastTouches)
          c.setZoom(
            Phaser.Math.Clamp((c.zoom * d) / this.lastTouches, 0.3, 2.5),
          );
        this.lastTouches = d;
      } else if (p.isDown) {
        this.lastTouches = null;
        c.scrollX -= (p.x - p.prevPosition.x) / c.zoom;
        c.scrollY -= (p.y - p.prevPosition.y) / c.zoom;
      }
    });
    this.input.on("pointerup", (p) => {
      this.lastTouches = null;
      if (
        this.down &&
        !this.gestureMoved &&
        Math.hypot(p.x - this.down.x, p.y - this.down.y) < 8
      ) {
        const w = c.getWorldPoint(p.x, p.y);
        this.selected =
          this.battle.units
            .map((u) => ({ u, p: iso(u.x, u.y) }))
            .filter(
              (a) => Math.hypot(a.p.x - w.x, a.p.y - 12 - w.y) < 22 / c.zoom,
            )
            .sort(
              (a, b) =>
                Math.hypot(a.p.x - w.x, a.p.y - 12 - w.y) -
                Math.hypot(b.p.x - w.x, b.p.y - 12 - w.y),
            )[0]?.u || this.selected;
      }
    });
    this.input.on("wheel", (_, __, ___, dy) =>
      c.setZoom(Phaser.Math.Clamp(c.zoom * (dy > 0 ? 0.9 : 1.1), 0.3, 2.5)),
    );
    document.querySelector("#pause").onclick = () => {
      this.paused = !this.paused;
      document.querySelector("#pause").textContent = this.paused
        ? "Resume"
        : "Pause";
    };
    document.querySelectorAll("[data-speed]").forEach(
      (b) =>
        (b.onclick = () => {
          this.speed = Number(b.dataset.speed);
          document
            .querySelectorAll("[data-speed]")
            .forEach((x) => x.classList.toggle("active", x === b));
        }),
    );
    document.querySelector("#restart").onclick = () => {
      this.battle = new Battle();
      this.acc = 0;
      this.paused = false;
      document.querySelector("#pause").textContent = "Pause";
      this.selected = null;
      document.querySelector("#outcome").hidden = true;
    };
  }
  tile(x, y, color) {
    const p = iso(x, y);
    this.g.fillStyle(color);
    this.g.fillPoints(
      [
        { x: p.x, y: p.y - 10 },
        { x: p.x + 20, y: p.y },
        { x: p.x, y: p.y + 10 },
        { x: p.x - 20, y: p.y },
      ],
      true,
    );
  }
  update(_, delta) {
    if (!this.paused) {
      this.acc += Math.min(delta / 1000, 0.1) * this.speed;
      while (this.acc >= 0.05) {
        this.battle.step(0.05);
        this.acc -= 0.05;
      }
    }
    const g = this.g;
    g.clear();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const street = (x >= 12 && x <= 17) || y === 13;
        this.tile(
          x,
          y,
          inside(x, y)
            ? 0x6c6456
            : street
              ? 0x303b45
              : (x + y) % 3
                ? 0x344b40
                : 0x3b5143,
        );
        if (street && x === 15 && y % 3 === 0) {
          const p = iso(x, y);
          g.lineStyle(2, 0x9b9b75, 0.5);
          g.lineBetween(p.x - 5, p.y - 2, p.x + 5, p.y + 2);
        }
      }
    // Open door leaves mark the passable openings on both sides of each house.
    for (const h of houses)
      for (const y of [h.y, h.y + h.h - 1]) {
        const p = iso(h.x + 2, y);
        g.lineStyle(4, 0xb59b70);
        g.lineBetween(p.x - 9, p.y - 7, p.x - 9, p.y - 22);
      }
    const drawables = [...obstacles]
      .map(([k, type]) => {
        const [x, y] = k.split(",").map(Number);
        return { x, y, type };
      })
      .concat(this.battle.units.map((u) => ({ ...u, unit: u })))
      .sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const d of drawables) {
      const p = iso(d.x, d.y);
      if (!d.unit) {
        const height = d.type === "wall" ? 23 : d.type === "fence" ? 12 : 9;
        g.fillStyle(0x000000, 0.22);
        g.fillRect(p.x, p.y, 25, 8);
        g.fillStyle(d.type === "fence" ? 0x786e51 : 0x727a79);
        g.fillPoints(
          [
            { x: p.x - 18, y: p.y - 9 - height },
            { x: p.x + 18, y: p.y + 9 - height },
            { x: p.x + 18, y: p.y + 9 },
            { x: p.x - 18, y: p.y - 9 },
          ],
          true,
        );
        g.lineStyle(2, 0xa5aaa0);
        g.lineBetween(p.x - 18, p.y - 9 - height, p.x + 18, p.y + 9 - height);
        continue;
      }
      const u = d.unit,
        legs = (u.health["left leg"] + u.health["right leg"]) / 2,
        crawl = legs < 35 || !u.active;
      const bob =
        u.route.length && u.active
          ? Math.sin(this.battle.time * (legs < 70 ? 7 : 12) + u.id) * 1.6
          : 0;
      g.fillStyle(0x000000, 0.4);
      g.fillEllipse(p.x + 3, p.y + 1, 20, 8);
      if (this.selected === u) {
        g.lineStyle(2, 0xf7df8c);
        g.strokeEllipse(p.x, p.y, 26, 13);
      }
      g.fillStyle(u.team ? 0xd69283 : 0x83d7c0);
      g.fillRect(
        p.x - 7,
        p.y - (crawl ? 8 : 22) + bob,
        crawl ? 17 : 13,
        crawl ? 6 : 14,
      );
      g.fillStyle(u.team ? 0x5e6550 : 0x667957);
      g.fillRect(p.x - 5, p.y - (crawl ? 10 : 28) + bob, 10, 7);
      g.fillStyle(0xe1c6a1);
      g.fillRect(p.x - 3, p.y - (crawl ? 7 : 22) + bob, 6, 4);
      g.lineStyle(3, u.hit > 0 ? 0xffffff : 0x15212c);
      const aim = iso(u.x + Math.cos(u.facing), u.y + Math.sin(u.facing));
      g.lineBetween(
        p.x,
        p.y - 13,
        p.x + (aim.x - p.x) * 0.55,
        p.y - 13 + (aim.y - p.y) * 0.55,
      );
      if (!crawl) {
        g.fillStyle(0x18242a);
        g.fillRect(p.x - 6, p.y - 7, 4, 7 + bob);
        g.fillRect(p.x + 2, p.y - 7, 4, 7 - bob);
      }
      if (u.role === "Medic") {
        g.fillStyle(0xffffff);
        g.fillRect(p.x - 2, p.y - 17, 5, 2);
        g.fillRect(p.x, p.y - 19, 1, 6);
      }
      if (u.role === "Leader") {
        g.fillStyle(0xf4d783);
        g.fillTriangle(p.x - 3, p.y - 34, p.x + 3, p.y - 34, p.x, p.y - 39);
      }
      if (!u.active) {
        g.lineStyle(2, u.dead ? 0x9a4646 : 0xf2c46a);
        g.lineBetween(p.x - 4, p.y - 5, p.x + 4, p.y + 3);
        g.lineBetween(p.x + 4, p.y - 5, p.x - 4, p.y + 3);
      }
    }
    // Roofs are removed for houses containing any soldier, so interior fighting stays legible.
    for (const h of houses)
      if (!this.battle.units.some((u) => u.active && inside(u.x, u.y) === h)) {
        const a = iso(h.x, h.y),
          b = iso(h.x + h.w - 1, h.y),
          c = iso(h.x + h.w - 1, h.y + h.h - 1),
          d = iso(h.x, h.y + h.h - 1);
        g.fillStyle(0x394951, 0.92);
        g.fillPoints(
          [a, b, c, d].map((p) => ({ x: p.x, y: p.y - 32 })),
          true,
        );
        g.lineStyle(2, 0x819294);
        g.strokePoints([a, b, c, d, a].map((p) => ({ x: p.x, y: p.y - 32 })));
      }
    for (const s of this.battle.shots) {
      const a = iso(s.a.x, s.a.y),
        b = iso(s.b.x, s.b.y);
      g.lineStyle(1, 0xffe9ac, 0.65);
      g.lineBetween(a.x, a.y - 14, b.x, b.y - 14);
      g.fillStyle(0xffca65, 0.13);
      g.fillCircle(a.x, a.y - 14, 24);
      g.fillStyle(0xffeeae);
      g.fillCircle(a.x, a.y - 14, 4);
    }
    document.querySelector("#counts").textContent =
      `USMC ${this.battle.units.filter((u) => u.team === 0 && u.active).length} · RU ${this.battle.units.filter((u) => u.team === 1 && u.active).length}`;
    const u = this.selected;
    if (u) document.querySelector("#inspect").textContent = inspectSoldier(u);
    else
      document.querySelector("#inspect").textContent =
        "Tap a soldier to inspect • Drag to pan • Pinch to zoom";
    if (this.battle.result) {
      const o = document.querySelector("#outcome");
      o.hidden = false;
      o.textContent = this.battle.result + " · Elimination";
    }
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  pixelArt: true,
  antialias: false,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: Battlefield,
});
