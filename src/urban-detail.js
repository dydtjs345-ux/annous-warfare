// All variation derives from tile coordinates, never the simulation RNG.
import { streetAt, inside } from "./world.js";
export function drawGroundDetail(g, x, y, p) {
  const road = streetAt(x, y),
    pavement =
      !road &&
      !inside(x, y) &&
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([a, b]) => streetAt(x + a, y + b));
  const seed =
    (Math.imul(x + 31, 73856093) ^ Math.imul(y + 71, 19349663)) >>> 0;
  if (pavement) {
    g.fillStyle(0x657077, 0.8);
    g.fillPoints(
      [
        { x: p.x, y: p.y - 9 },
        { x: p.x + 18, y: p.y },
        { x: p.x, y: p.y + 9 },
        { x: p.x - 18, y: p.y },
      ],
      true,
    );
    g.lineStyle(1, 0x303f48, 0.7);
    g.lineBetween(p.x - 18, p.y, p.x, p.y + 9);
    g.lineBetween(p.x, p.y + 9, p.x + 18, p.y);
  }
  for (let i = 0; i < 5; i++) {
    const a = ((seed >>> (i * 4)) & 15) - 7,
      b = ((seed >>> (i * 3 + 1)) & 7) - 3;
    g.fillStyle(i % 2 ? 0x8a9699 : 0x111f29, road ? 0.14 : 0.18);
    g.fillRect(p.x + a, p.y + b, 2, 1);
  }
  if (road && seed % 7 === 0) {
    g.lineStyle(1, 0x17232c, 0.7);
    g.lineBetween(p.x - 9, p.y - 3, p.x - 2, p.y);
    g.lineBetween(p.x - 2, p.y, p.x + 1, p.y + 4);
    g.lineBetween(p.x - 2, p.y, p.x + 7, p.y + 1);
  }
  if (road && seed % 11 === 0) {
    g.fillStyle(0x15252e, 0.4);
    g.fillEllipse(p.x + 2, p.y, 16, 5);
    g.lineStyle(1, 0x8b9da3, 0.15);
    g.lineBetween(p.x - 3, p.y + 1, p.x + 7, p.y + 1);
  }
}
export function drawBuildingDetail(g, h, iso, height = 32) {
  const a = iso(h.x - 0.5, h.y - 0.5),
    b = iso(h.x + h.w - 0.5, h.y - 0.5),
    c = iso(h.x + h.w - 0.5, h.y + h.h - 0.5),
    d = iso(h.x - 0.5, h.y + h.h - 0.5);
  const point = (u, v, t, z = 0) => ({
    x: u.x + (v.x - u.x) * t,
    y: u.y + (v.y - u.y) * t - z,
  });
  // Roof membrane seams, raised parapet and weathered wall masonry.
  g.lineStyle(1, 0x7d9098, 0.25);
  for (let i = 1; i < h.w; i++) {
    const q = point(a, b, i / h.w, height),
      r = point(d, c, i / h.w, height);
    g.lineBetween(q.x, q.y, r.x, r.y);
  }
  g.lineStyle(2, 0x1c2c36, 0.8);
  for (const [u, v] of [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ]) {
    g.lineBetween(u.x, u.y - height + 2, v.x, v.y - height + 2);
  }
  g.lineStyle(1, 0xa1aca7, 0.65);
  g.lineBetween(d.x, d.y - height, c.x, c.y - height);
  g.lineBetween(b.x, b.y - height, c.x, c.y - height);
  for (const [u, v, n, bright] of [
    [d, c, h.w, false],
    [b, c, h.h, true],
  ]) {
    for (let i = 0; i < n; i++) {
      const q = point(u, v, (i + 0.5) / n);
      g.fillStyle(0x172b37, 0.9);
      g.fillPoints(
        [
          { x: q.x - 5, y: q.y - 24 },
          { x: q.x + 4, y: q.y - 20 },
          { x: q.x + 4, y: q.y - 10 },
          { x: q.x - 5, y: q.y - 14 },
        ],
        true,
      );
      g.lineStyle(1, bright ? 0x9aa9a8 : 0x738585, 0.8);
      g.lineBetween(q.x - 5, q.y - 13, q.x + 4, q.y - 9);
      g.lineStyle(1, 0x41545c, 0.8);
      g.lineBetween(q.x, q.y - 22, q.x, q.y - 12);
    }
    for (let z = 5; z < height; z += 8) {
      g.lineStyle(1, 0x354750, 0.4);
      g.lineBetween(u.x, u.y - z, v.x, v.y - z);
    }
  }
  const center = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 - height };
  g.fillStyle(0x1c2e38, 0.8);
  g.fillEllipse(center.x + 3, center.y + 3, 26, 10);
  g.fillStyle(0x61717a);
  g.fillRect(center.x - 8, center.y - 7, 17, 9);
  g.fillStyle(0x87928d);
  g.fillRect(center.x - 8, center.y - 8, 17, 2);
  for (let i = 0; i < 4; i++) {
    g.fillStyle(0x263b47);
    g.fillRect(center.x - 5 + i * 3, center.y - 5, 1, 4);
  }
}
