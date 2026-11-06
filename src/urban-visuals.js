import { material } from "./world.js";
import { FRAG } from "./grenades.js";
import { inView } from "./view.js";
const colors = {
  wall: 0x727a79,
  "low wall": 0x727a79,
  fence: 0x786e51,
  sandbag: 0x8e8965,
  concrete: 0x879294,
  vehicle: 0x506875,
  crates: 0x877156,
};
export function drawObstacle(g, d, p) {
  const h = material(d.type).height,
    c = colors[d.type] ?? 0x727a79;
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(p.x + 5, p.y + 3, 42, 16);
  g.fillStyle(c);
  g.fillPoints(
    [
      { x: p.x - 19, y: p.y - 9 - h },
      { x: p.x + 19, y: p.y + 9 - h },
      { x: p.x + 19, y: p.y + 9 },
      { x: p.x - 19, y: p.y - 9 },
    ],
    true,
  );
  g.fillStyle(c, 0.8);
  g.fillPoints(
    [
      { x: p.x, y: p.y - 10 - h },
      { x: p.x + 19, y: p.y - h },
      { x: p.x, y: p.y + 10 - h },
      { x: p.x - 19, y: p.y - h },
    ],
    true,
  );
  g.lineStyle(1, 0xb4bab0, 0.8);
  g.lineBetween(p.x - 19, p.y - 9 - h, p.x + 19, p.y + 9 - h);
  // Contact-edge occlusion and material wear stay inside existing footprints.
  g.lineStyle(1, 0x23343c, 0.85);
  g.lineBetween(p.x - 18, p.y - 8, p.x + 18, p.y + 9);
  for (let chip = 0; chip < 4; chip++) {
    g.fillStyle(chip % 2 ? 0xadb5aa : 0x283d46, 0.35);
    g.fillRect(p.x - 13 + chip * 8, p.y - h + chip * 3, 3, 1);
  }
  if (d.type === "sandbag") {
    for (let i = 0; i < 3; i++) {
      g.fillStyle(i % 2 ? 0xa49b76 : 0x787653);
      g.fillRect(p.x - 15 + i * 11, p.y - h - 5 + i * 5, 10, 5);
      g.fillStyle(0xb1a881);
      g.fillRect(p.x - 11 + i * 11, p.y - h - 9 + i * 5, 9, 4);
    }
  }
  if (d.type === "concrete") {
    g.lineStyle(2, 0x505e62);
    g.lineBetween(p.x - 4, p.y - h - 2, p.x - 4, p.y + 1);
    g.fillStyle(0xb4b9ab);
    g.fillRect(p.x + 5, p.y - h + 2, 5, 3);
  }
  if (d.type === "vehicle") {
    // Wheel arches, hood ribs, dark cabin glazing and rust panels.
    g.fillStyle(0x111d26);
    g.fillEllipse(p.x - 11, p.y + 1, 9, 8);
    g.fillEllipse(p.x + 12, p.y + 11, 9, 8);
    g.fillStyle(0x6c7e83);
    g.fillRect(p.x - 12, p.y, 3, 2);
    g.fillRect(p.x + 11, p.y + 9, 3, 2);
    g.lineStyle(1, 0x9ba6a2, 0.7);
    g.lineBetween(p.x - 15, p.y - h - 1, p.x + 14, p.y - h + 13);
    g.fillStyle(0x705e50, 0.7);
    g.fillRect(p.x + 5, p.y - h + 9, 5, 2);

    g.fillStyle(0x172730);
    g.fillRect(p.x - 16, p.y - 3, 8, 6);
    g.fillRect(p.x + 9, p.y + 5, 8, 5);
    g.fillStyle(0x9aaeb8);
    g.fillPoints(
      [
        { x: p.x - 10, y: p.y - h - 2 },
        { x: p.x, y: p.y - h - 6 },
        { x: p.x + 9, y: p.y - h },
        { x: p.x, y: p.y - h + 4 },
      ],
      true,
    );
    g.lineStyle(2, 0x34434b);
    g.lineBetween(p.x - 14, p.y - h + 3, p.x + 10, p.y - h + 14);
  }
  if (d.type === "crates") {
    g.lineStyle(2, 0x4e4438);
    g.strokeRect(p.x - 12, p.y - h + 2, 20, 10);
    g.lineBetween(p.x - 12, p.y - h + 2, p.x + 8, p.y - h + 12);
    g.lineBetween(p.x + 8, p.y - h + 2, p.x - 12, p.y - h + 12);
    for (let plank = 0; plank < 4; plank++) {
      g.lineStyle(1, 0x342f2b, 0.6);
      g.lineBetween(
        p.x - 11,
        p.y - h + 3 + plank * 2,
        p.x + 7,
        p.y - h + 3 + plank * 2,
      );
    }
    g.fillStyle(0xa48d68);
    g.fillRect(p.x - 5, p.y - h - 8, 12, 7);
  }
}
export function drawGrenades(g, b, iso, view = null) {
  for (const frag of b.grenades ?? []) {
    const p = iso(frag.position.x, frag.position.y);
    if (view && !inView(p, view, 80)) continue;
    if (frag.detonatedAt) continue; // Event-driven persistent blast layer draws this.
    const t = Math.min(1, (b.time - frag.thrownAt) / FRAG.flight),
      height = Math.sin(t * Math.PI) * 25;
    if (t < 1) {
      const a = Math.max(0, t - 0.16),
        tail = iso(
          frag.start.x + (frag.target.x - frag.start.x) * a,
          frag.start.y + (frag.target.y - frag.start.y) * a,
        );
      g.lineStyle(2, 0xc7bd8e, 0.65);
      g.lineBetween(
        tail.x,
        tail.y - Math.sin(a * Math.PI) * 25 - 5,
        p.x,
        p.y - height - 5,
      );
    }
    g.fillStyle(0x000000, 0.5);
    g.fillEllipse(p.x, p.y, 9, 4);
    g.fillRect(p.x - 3, p.y - height - 5, 6, 7);
    g.fillStyle(0xb4b781);
    g.fillRect(p.x - 2, p.y - height - 4, 4, 5);
    g.fillStyle(0xf8d189);
    g.fillRect(p.x - 1, p.y - height - 6, 2, 2);
    if (t >= 1) {
      g.lineStyle(1, 0xe8bd74, 0.55);
      g.strokeEllipse(p.x, p.y, 14, 7);
    }
  }
}
