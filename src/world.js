export const W = 30,
  H = 26;
export const houses = [
  { x: 5, y: 4, w: 6, h: 6 },
  { x: 19, y: 4, w: 6, h: 6 },
  { x: 5, y: 16, w: 6, h: 6 },
  { x: 19, y: 16, w: 6, h: 6 },
];
export const key = (x, y) => `${x},${y}`;
export const obstacles = new Map();
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
export const inside = (x, y) =>
  houses.find(
    (h) => x > h.x && x < h.x + h.w - 1 && y > h.y && y < h.y + h.h - 1,
  );
export const blocked = (x, y) =>
  x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || obstacles.has(key(x, y));
// Symmetric grid traversal: quarter-tile sampling previously disagreed by
// direction near wall corners. Corner-touching wall cells block both ways.
export function sight(a, b) {
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
  const wall = (xx, yy) => obstacles.get(key(xx, yy)) === "wall";
  for (let i = 0; i < 256; i++) {
    if (wall(x, y)) return false;
    if (x === endX && y === endY) return true;
    if (Math.abs(tx - ty) < 1e-10) {
      if (wall(x + sx, y) || wall(x, y + sy)) return false;
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
    if (o)
      result = Math.max(
        result,
        o === "wall" ? 0.8 : o === "low wall" ? 0.58 : 0.28,
      );
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
