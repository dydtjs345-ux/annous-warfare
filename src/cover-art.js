// Read-only visual grouping: underlying obstacle cells remain untouched.
export function coverVisuals(obstacles) {
  const used = new Set(),
    out = [];
  for (const [key, type] of obstacles) {
    if (used.has(key)) continue;
    const [x, y] = key.split(",").map(Number),
      cells = [[x, y]];
    used.add(key);
    if (type === "vehicle") {
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        const k = `${x + dx},${y + dy}`;
        if (!used.has(k) && obstacles.get(k) === "vehicle") {
          cells.push([x + dx, y + dy]);
          used.add(k);
          break;
        }
      }
    }
    out.push({
      x: cells.reduce((s, p) => s + p[0], 0) / cells.length,
      y: cells.reduce((s, p) => s + p[1], 0) / cells.length,
      type,
      cells,
    });
  }
  return out;
}
export function drawCoverArt(g, d, p, h) {
  const span = d.cells?.length ?? 1,
    alongY = span === 2 && d.cells[0][0] === d.cells[1][0];
  const project = (s, t, z = 0) => ({
    x: p.x + (alongY ? -20 : 20) * s + (alongY ? 20 : -20) * t,
    y: p.y + 10 * s + 10 * t - z,
  });
  const face = (points, color, alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillPoints(
      points.map(([s, t, z]) => project(s, t, z)),
      true,
    );
  };
  if (d.type === "sandbag") {
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 3; i++) {
        const q = project(
          -0.31 + i * 0.3 + (row % 2 ? 0.06 : 0),
          0.22,
          row * 3 + 3,
        );
        g.fillStyle(0x4c5141);
        g.fillEllipse(q.x, q.y, 13, 6);
        g.fillStyle((row + i) % 2 ? 0xa29b76 : 0x8a8b66);
        g.fillEllipse(q.x, q.y - 1, 12, 5);
        g.lineStyle(1, 0xbdb28d, 0.7);
        g.lineBetween(q.x - 4, q.y - 2, q.x + 3, q.y - 1);
        g.fillStyle(0x666d50);
        g.fillRect(q.x + 4, q.y - 1, 2, 2);
      }
    return true;
  }
  if (d.type === "concrete") {
    face(
      [
        [-0.5, -0.43, 0],
        [0.5, -0.43, 0],
        [0.5, -0.14, h],
        [-0.5, -0.14, h],
      ],
      0x7a898c,
    );
    face(
      [
        [-0.5, 0.43, 0],
        [0.5, 0.43, 0],
        [0.5, 0.14, h],
        [-0.5, 0.14, h],
      ],
      0x9ba4a1,
    );
    face(
      [
        [-0.5, -0.14, h],
        [0.5, -0.14, h],
        [0.5, 0.14, h],
        [-0.5, 0.14, h],
      ],
      0xb7bfaf,
    );
    face(
      [
        [0.5, -0.43, 0],
        [0.5, 0.43, 0],
        [0.5, 0.14, h],
        [0.5, -0.14, h],
      ],
      0x566c76,
    );
    for (const s of [-0.32, 0.32]) {
      const a = project(s, 0.32, 2),
        b = project(s, 0.13, h - 1);
      g.lineStyle(1, 0x485b64, 0.8);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    return true;
  }
  if (d.type === "crates") {
    for (const t of [-0.45, 0.45]) {
      face(
        [
          [-0.45, t, 0],
          [0.45, t, 0],
          [0.45, t, h],
          [-0.45, t, h],
        ],
        t > 0 ? 0x927a59 : 0x6f654f,
      );
      for (let z = 3; z < h; z += 4) {
        const a = project(-0.43, t, z),
          b = project(0.43, t, z);
        g.lineStyle(1, 0x3e453e, 0.8);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    face(
      [
        [0.45, -0.45, 0],
        [0.45, 0.45, 0],
        [0.45, 0.45, h],
        [0.45, -0.45, h],
      ],
      0x6c624c,
    );
    face(
      [
        [-0.45, -0.45, h],
        [0.45, -0.45, h],
        [0.45, 0.45, h],
        [-0.45, 0.45, h],
      ],
      0xa18d68,
    );
    for (const s of [-0.43, 0.43])
      for (const t of [-0.43, 0.43]) {
        const a = project(s, t, 0),
          b = project(s, t, h);
        g.lineStyle(2, 0xb4a582);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.fillStyle(0x3d4e50);
        g.fillRect(b.x - 1, b.y, 3, 3);
      }
    const a = project(-0.4, 0.46, 2),
      b = project(0.4, 0.46, h - 2);
    g.lineStyle(2, 0xc0ad7f);
    g.lineBetween(a.x, a.y, b.x, b.y);
    return true;
  }
  if (d.type === "vehicle") {
    const L = 0.46 * span;
    for (const t of [-0.4, 0.4])
      for (const s of [-L * 0.67, L * 0.67]) {
        const q = project(s, t, 3);
        g.fillStyle(0x101c25);
        g.fillEllipse(q.x, q.y, 8, 8);
      }
    face(
      [
        [-L, -0.43, 4],
        [L, -0.43, 4],
        [L, -0.4, 10],
        [-L, -0.4, 11],
      ],
      0x485e68,
    );
    face(
      [
        [-L, 0.43, 4],
        [L, 0.43, 4],
        [L, 0.4, 10],
        [-L, 0.4, 11],
      ],
      0x718187,
    );
    face(
      [
        [L, -0.43, 4],
        [L, 0.43, 4],
        [L, 0.4, 10],
        [L, -0.4, 10],
      ],
      0x435965,
    );
    face(
      [
        [-L, -0.4, 11],
        [L, -0.4, 10],
        [L, 0.4, 10],
        [-L, 0.4, 11],
      ],
      0x8a9693,
    );
    // Cabin, windshield and hood occupy the combined solid-cell footprint.
    face(
      [
        [-L * 0.65, -0.35, 11],
        [L * 0.18, -0.35, 10],
        [0, -0.26, h],
        [-L * 0.48, -0.26, h],
      ],
      0x364e5c,
    );
    face(
      [
        [-L * 0.65, 0.35, 11],
        [L * 0.18, 0.35, 10],
        [0, 0.26, h],
        [-L * 0.48, 0.26, h],
      ],
      0x284552,
    );
    face(
      [
        [-L * 0.48, -0.26, h],
        [0, -0.26, h],
        [0, 0.26, h],
        [-L * 0.48, 0.26, h],
      ],
      0x9ba6a0,
    );
    face(
      [
        [L * 0.18, -0.35, 10],
        [L * 0.18, 0.35, 10],
        [0, 0.26, h],
        [0, -0.26, h],
      ],
      0x456a7b,
    );
    const a = project(L * 0.12, -0.25, 13),
      b = project(L * 0.12, 0.25, 13);
    g.lineStyle(1, 0xb1c0bc, 0.8);
    g.lineBetween(a.x, a.y, b.x, b.y);
    for (const s of [-L * 0.67, L * 0.67]) {
      const q = project(s, 0.43, 3);
      g.fillStyle(0x101c25);
      g.fillEllipse(q.x, q.y, 8, 8);
      g.fillStyle(0x81918e);
      g.fillEllipse(q.x, q.y, 3, 3);
    }
    const rust = project(L * 0.55, 0.4, 7);
    g.fillStyle(0x8f6a50, 0.8);
    g.fillRect(rust.x - 2, rust.y, 5, 2);
    return true;
  }
  return false;
}
