import { facadeWear, groundWear } from "./battle-wear.js";
import { drawStreetDecal } from "./street-art.js";
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
  drawStreetDecal(g, x, y, p, road, seed);
  if (road || pavement) groundWear(g, p, seed);
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
// Every facade ornament is parameterized on its own wall plane.
export const wallPoint = (a, b, t, z) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t - z,
});
export function wallQuad(a, b, left, right, bottom, top) {
  return [
    wallPoint(a, b, left, top),
    wallPoint(a, b, right, top),
    wallPoint(a, b, right, bottom),
    wallPoint(a, b, left, bottom),
  ];
}
export function buildingPalette(h) {
  const variant = (h.x * 3 + h.y * 7) % 3;
  return [
    { dark: 0x56636a, light: 0x768189, roof: 0x354953 },
    { dark: 0x625d57, light: 0x8b8172, roof: 0x414b50 },
    { dark: 0x53665f, light: 0x7c8c82, roof: 0x3e4e52 },
  ][variant];
}
export function drawBuildingDetail(g, h, iso, height = 32) {
  const a = iso(h.x - 0.5, h.y - 0.5),
    b = iso(h.x + h.w - 0.5, h.y - 0.5),
    c = iso(h.x + h.w - 0.5, h.y + h.h - 0.5),
    d = iso(h.x - 0.5, h.y + h.h - 0.5),
    variant = (h.x * 3 + h.y * 7) % 3;
  // Roof panels and parapet remain entirely on the existing inaccessible roof.
  g.lineStyle(1, 0x87969a, 0.3);
  for (let i = 1; i < h.w; i++) {
    const q = wallPoint(a, b, i / h.w, height),
      r = wallPoint(d, c, i / h.w, height);
    g.lineBetween(q.x, q.y, r.x, r.y);
  }
  if (variant === 1)
    for (let i = 1; i < h.h; i++) {
      const q = wallPoint(a, d, i / h.h, height),
        r = wallPoint(b, c, i / h.h, height);
      g.lineStyle(1, 0x182c36, 0.55);
      g.lineBetween(q.x, q.y, r.x, r.y);
    }
  g.lineStyle(2, 0x1a2b34, 0.9);
  for (const [u, v] of [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ])
    g.lineBetween(u.x, u.y - height + 2, v.x, v.y - height + 2);
  g.lineStyle(1, 0xa6b4af, 0.8);
  g.lineBetween(d.x, d.y - height, c.x, c.y - height);
  g.lineBetween(b.x, b.y - height, c.x, c.y - height);
  for (const [u, v, n, bright] of [
    [d, c, h.w, false],
    [b, c, h.h, true],
  ]) {
    const panel = (l, r, bot, top, color, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillPoints(wallQuad(u, v, l, r, bot, top), true);
    };
    for (let z = 4; z < height; z += 7) {
      g.lineStyle(1, 0x35454b, 0.3);
      const q = wallPoint(u, v, 0, z),
        r = wallPoint(u, v, 1, z);
      g.lineBetween(q.x, q.y, r.x, r.y);
    }
    const slots = Math.max(2, Math.floor(n / 2));
    for (let i = 0; i < slots; i++) {
      const left = (i + 0.22) / slots,
        right = (i + 0.78) / slots,
        door = i === 1 && !bright;
      if (door) {
        panel(left - 0.035, right + 0.035, 0, 26, 0x354048);
        panel(left, right, 0, 24, 0x283a42);
        panel(left + 0.04, right - 0.04, 3, 21, 0x47555a);
        const knob = wallPoint(u, v, right - 0.025, 11);
        g.fillStyle(0xb2a98b);
        g.fillRect(knob.x, knob.y, 2, 2);
        continue;
      }
      // Outer frame, inner recess, glass, mullion and sill all share the same plane.
      panel(left - 0.02, right + 0.02, 10, 27, bright ? 0xa0a9a3 : 0x7f8d8b);
      panel(left, right, 11, 26, 0x182a33);
      panel(left + 0.025, right - 0.025, 12, 25, bright ? 0x36525d : 0x29434f);
      const mid = (left + right) / 2;
      panel(mid - 0.008, mid + 0.008, 11, 26, 0x899a9e);
      const glintA = wallPoint(u, v, left + 0.04, 23),
        glintB = wallPoint(u, v, Math.min(right - 0.04, left + 0.13), 17);
      g.lineStyle(1, 0xa4c0c6, 0.6);
      g.lineBetween(glintA.x, glintA.y, glintB.x, glintB.y);
      panel(left - 0.035, right + 0.035, 9, 11, bright ? 0xaab1a4 : 0x8b9c97);
      panel(left - 0.035, right + 0.035, 8, 9, 0x33454c);
    }
    panel(0.78, 0.87, 2, 7, 0xc0b48f, 0.7);
    panel(0.79, 0.86, 4, 5, 0x516e76);
    const pipeA = wallPoint(u, v, 0.96, height - 1),
      pipeB = wallPoint(u, v, 0.96, 1);
    g.lineStyle(3, 0x32454d);
    g.lineBetween(pipeA.x, pipeA.y, pipeB.x, pipeB.y);
    g.lineStyle(1, 0x9ca9a4, 0.7);
    g.lineBetween(pipeA.x - 1, pipeA.y, pipeB.x - 1, pipeB.y);
    facadeWear(g, wallPoint, u, v, h.x + h.y + (bright ? 1 : 0));
    // Wall-mounted vent and a fixed, shut service panel; no doorway is navigable.
    panel(0.05, 0.15, 2, 8, 0x31454d);
    for (let z = 3; z < 8; z += 2) {
      const q = wallPoint(u, v, 0.055, z),
        r = wallPoint(u, v, 0.145, z);
      g.lineStyle(1, 0x84938e);
      g.lineBetween(q.x, q.y, r.x, r.y);
    }
  }
  const p = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 - height };
  g.fillStyle(0x1d303a, 0.65);
  g.fillEllipse(p.x + 4, p.y + 4, 25, 10);
  g.fillStyle(0x6b7b80);
  g.fillRect(p.x - 8, p.y - 7, 17, 9);
  g.fillStyle(0xa1aaa0);
  g.fillRect(p.x - 8, p.y - 8, 17, 2);
  for (let i = 0; i < 4; i++) {
    g.fillStyle(0x243c47);
    g.fillRect(p.x - 5 + i * 3, p.y - 5, 1, 4);
  }
}
