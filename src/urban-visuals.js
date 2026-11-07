import {drawCoverArt} from "./cover-art.js";
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
  if(drawCoverArt(g,d,p,h))return;
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
