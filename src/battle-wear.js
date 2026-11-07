// Cosmetic damage only: no openings, missing wall sections or new terrain.
export function facadeWear(g, point, u, v, salt) {
  for (let i = 0; i < 3; i++) {
    const t = 0.08 + i * 0.025,
      z = 12 + ((salt + i * 5) % 14),
      p = point(u, v, t, z);
    g.fillStyle(0x243b45, 0.8);
    g.fillCircle(p.x, p.y, 1.2);
    g.fillStyle(0xb6b29d, 0.7);
    g.fillRect(p.x - 1, p.y + 1, 2, 1);
  }
  const c = [
    point(u, v, 0.88, 26),
    point(u, v, 0.9, 21),
    point(u, v, 0.87, 18),
    point(u, v, 0.91, 13),
  ];
  g.lineStyle(1, 0x344d56, 0.8);
  g.beginPath();
  g.moveTo(c[0].x, c[0].y);
  for (const p of c.slice(1)) g.lineTo(p.x, p.y);
  g.strokePath();
  if (salt % 3 === 0) {
    const p = point(u, v, 0.12, 8);
    g.fillStyle(0x152c37, 0.22);
    g.fillEllipse(p.x, p.y, 13, 13);
    g.fillEllipse(p.x, p.y + 3, 19, 8);
  }
}
export function groundWear(g, p, seed) {
  if (seed % 53 === 0) {
    g.lineStyle(2, 0x1d2c32, 0.8);
    g.strokeEllipse(p.x + 3, p.y + 1, 7, 4);
    g.lineStyle(1, 0x6a7778, 0.5);
    g.strokeEllipse(p.x + 3, p.y, 7, 4);
  }
  if (seed % 31 === 0)
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0x8b9390 : 0x55666e, 0.6);
      g.fillTriangle(
        p.x - 5 + i * 3,
        p.y,
        p.x - 3 + i * 3,
        p.y - 2,
        p.x - 2 + i * 3,
        p.y + 1,
      );
    }
}
