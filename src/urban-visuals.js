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
    g.fillStyle(0xa48d68);
    g.fillRect(p.x - 5, p.y - h - 8, 12, 7);
  }
}
export function drawGrenades(g, b, iso, view = null) {
  for (const frag of b.grenades ?? []) {
    const p = iso(frag.position.x, frag.position.y);
    if (view && !inView(p, view, 80)) continue;
    if (frag.detonatedAt) {
      const age = b.time - frag.detonatedAt,
        f = Math.max(0, 1 - age / 0.6);
      g.fillStyle(0xffd28a, f * 0.35);
      g.fillEllipse(p.x, p.y, 60 * (1 - f) + 15, 30 * (1 - f) + 8);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          x = p.x + Math.cos(a) * (15 + 25 * (1 - f)),
          y = p.y + Math.sin(a) * (8 + 12 * (1 - f));
        g.fillStyle(i % 2 ? 0xc6b295 : 0xf5d39a, f);
        g.fillRect(x, y, 3, 3);
      }
      continue;
    }
    const t = Math.min(1, (b.time - frag.thrownAt) / FRAG.flight),
      height = Math.sin(t * Math.PI) * 25;
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(p.x, p.y, 7, 3);
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
