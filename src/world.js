import { expandedWorld, expandedStreet } from "./expanded-world.js";
export let W = 30,
  H = 26;
const legacyHouses = [
  { x: 5, y: 4, w: 6, h: 6 },
  { x: 19, y: 4, w: 6, h: 6 },
  { x: 5, y: 16, w: 6, h: 6 },
  { x: 19, y: 16, w: 6, h: 6 },
];
export let houses = legacyHouses;
export const key = (x, y) => `${x},${y}`;
export const obstacles = new Map();
export const materials = Object.freeze({
  wall: { height: 23, solid: true, protection: 0.8, mount: false, blast: 0 },
  "low wall": {
    height: 9,
    solid: false,
    protection: 0.58,
    mount: true,
    blast: 0.45,
  },
  fence: {
    height: 12,
    solid: false,
    protection: 0.28,
    mount: false,
    blast: 0.9,
  },
  sandbag: {
    height: 10,
    solid: false,
    protection: 0.62,
    mount: true,
    blast: 0.4,
  },
  concrete: {
    height: 11,
    solid: false,
    protection: 0.7,
    mount: true,
    blast: 0.28,
  },
  vehicle: {
    height: 18,
    solid: true,
    protection: 0.76,
    mount: false,
    blast: 0.12,
  },
  crates: {
    height: 19,
    solid: true,
    protection: 0.5,
    mount: false,
    blast: 0.3,
  },
});
export const material = (type) => materials[type] ?? materials.wall;
let activeWorld = null;
export function configureWorld(kind = "legacy", variant = 0) {
  const id = `${kind}:${variant % (kind === "expanded" ? 4 : 3)}`;
  if (activeWorld === id) return;
  activeWorld = id;
  obstacles.clear();
  if (kind === "expanded") {
    const map = expandedWorld(variant);
    W = map.width;
    H = map.height;
    houses = map.houses;
    for (const [k, type] of map.obstacles) obstacles.set(k, type);
    return;
  }
  W = 30;
  H = 26;
  houses = legacyHouses;
  for (const h of houses)
    for (let x = h.x; x < h.x + h.w; x++)
      for (let y = h.y; y < h.y + h.h; y++)
        if (
          x === h.x ||
          x === h.x + h.w - 1 ||
          y === h.y ||
          y === h.y + h.h - 1
        ) {
          if (x === h.x + 2 && (y === h.y || y === h.y + h.h - 1)) continue;
          obstacles.set(key(x, y), "wall");
        }
  for (const y of [2, 12, 14, 23])
    for (let x = 3; x < 27; x++)
      if (x % 7 !== 0 && x !== 14 && x !== 15)
        obstacles.set(key(x, y), y === 12 || y === 14 ? "low wall" : "fence");

  if (kind === "urban") {
    for (const [k, type] of obstacles)
      if (type === "low wall")
        obstacles.set(
          k,
          Number(k.split(",")[1]) === 12 ? "sandbag" : "concrete",
        );
    const add = (x, y, type) => {
      if (!obstacles.has(key(x, y))) obstacles.set(key(x, y), type);
    };
    for (const y of [5, 6, 7, 8])
      add(12, y, variant % 2 ? "concrete" : "sandbag");
    for (const y of [17, 18, 19, 20])
      add(17, y, variant % 2 ? "sandbag" : "concrete");
    for (const [x, y] of [
      [12, 10],
      [13, 11],
    ])
      add(x, y, "sandbag");
    for (const [x, y] of [
      [15, 5 + (variant % 3)],
      [15, 6 + (variant % 3)],
      [15, 19],
      [16, 19],
    ])
      add(x, y, "vehicle");
    for (const [x, y] of [
      [3, 6],
      [26, 19],
      [11, 3 + (variant % 2)],
      [18, 22],
    ])
      add(x, y, "crates");
  }
}
configureWorld();
export const streetAt = (x, y) =>
  W === 54 ? expandedStreet(x, y) : (x >= 12 && x <= 17) || y === 13;
export const inside = (x, y) =>
  houses.find(
    (h) => x > h.x && x < h.x + h.w - 1 && y > h.y && y < h.y + h.h - 1,
  );
export const blocked = (x, y) =>
  x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || obstacles.has(key(x, y));
// Symmetric grid traversal: quarter-tile sampling previously disagreed by
// direction near wall corners. Corner-touching wall cells block both ways.
export function traceRay(a, b, visit) {
  let x = Math.floor(a.x + 0.5),
    y = Math.floor(a.y + 0.5);
  const endX = Math.floor(b.x + 0.5),
    endY = Math.floor(b.y + 0.5);
  const dx = b.x - a.x,
    dy = b.y - a.y,
    sx = Math.sign(dx),
    sy = Math.sign(dy);
  const stepX = dx ? Math.abs(1 / dx) : Infinity,
    stepY = dy ? Math.abs(1 / dy) : Infinity;
  let tx = dx ? (x + (sx > 0 ? 0.5 : -0.5) - a.x) / dx : Infinity;
  let ty = dy ? (y + (sy > 0 ? 0.5 : -0.5) - a.y) / dy : Infinity;
  for (let i = 0; i < 256; i++) {
    if (!visit(x, y)) return false;
    if (x === endX && y === endY) return true;
    if (Math.abs(tx - ty) < 1e-10) {
      if (!visit(x + sx, y) || !visit(x, y + sy)) return false;
      x += sx;
      y += sy;
      tx += stepX;
      ty += stepY;
    } else if (tx < ty) {
      x += sx;
      tx += stepX;
    } else {
      y += sy;
      ty += stepY;
    }
  }
  return false;
}
const visibleCell = (x, y) => {
  const type = obstacles.get(key(x, y));
  return !type || !material(type).solid;
};
export const terrainSight = (a, b) => traceRay(a, b, visibleCell);
// Full-cover bodies/eyes are below suitable low obstacles; flanks remain visible.
// Plain map points and remembered snapshots have no posture, so terrain planning
// never gains access to a hidden soldier's live state.
export const sight = (a, b) =>
  terrainSight(a, b) &&
  !(a.posture?.mode === "full" && cover(a, b) >= 0.58) &&
  !(b.posture?.mode === "full" && cover(b, a) >= 0.58);
export function cover(target, attacker) {
  const dx = attacker.x - target.x,
    dy = attacker.y - target.y,
    d = Math.hypot(dx, dy);
  if (!d) return 0;
  let result = 0;
  for (let t = 0.4; t <= 1.5; t += 0.2) {
    const o = obstacles.get(
      key(
        Math.round(target.x + (dx / d) * t),
        Math.round(target.y + (dy / d) * t),
      ),
    );
    if (o) result = Math.max(result, material(o).protection);
  }
  return result;
}
export function path(a, b, occupied = new Set(), firstStepAllowed = null) {
  const start = key(Math.round(a.x), Math.round(a.y)),
    goal = key(Math.round(b.x), Math.round(b.y));
  const queue = [start],
    prev = new Map([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i];
    if (k === goal) break;
    const [x, y] = k.split(",").map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = key(x + dx, y + dy);
      if (
        k === start &&
        firstStepAllowed &&
        !firstStepAllowed({ x: x + dx, y: y + dy })
      )
        continue;
      if (!blocked(x + dx, y + dy) && !occupied.has(n) && !prev.has(n)) {
        prev.set(n, k);
        queue.push(n);
      }
    }
  }
  if (!prev.has(goal)) return [];
  let k = goal,
    out = [];
  while (k !== start) {
    out.unshift(k.split(",").map(Number));
    k = prev.get(k);
  }
  return out;
}

// Resolve invalid orders to the closest reachable terrain cell, never a wall.
export function reachableGoal(start, desired) {
  const queue = [[Math.round(start.x), Math.round(start.y)]];
  const seen = new Set([key(...queue[0])]);
  let best = queue[0],
    score = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i],
      d = Math.hypot(x - desired.x, y - desired.y);
    if (d < score) {
      best = [x, y];
      score = d;
    }
    if (d === 0) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = key(nx, ny);
      if (!blocked(nx, ny) && !seen.has(k)) {
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
  }
  return { x: best[0], y: best[1] };
}

// Fragment protection samples the same grid, including low obstacles. Each cell
// attenuates once; direct fragments do not pass through solid house walls.
export function blastTransmission(a, b) {
  const seen = new Set();
  let factor = 1;
  traceRay(a, b, (x, y) => {
    const k = key(x, y);
    if (seen.has(k)) return true;
    seen.add(k);
    const t = obstacles.get(k);
    if (t) factor *= material(t).blast;
    return factor > 1e-6;
  });
  return factor;
}
