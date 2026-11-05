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
export function sight(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  for (let i = 1; i < d * 4; i++) {
    const t = i / (d * 4);
    if (
      obstacles.get(
        key(
          Math.round(a.x + (b.x - a.x) * t),
          Math.round(a.y + (b.y - a.y) * t),
        ),
      ) === "wall"
    )
      return false;
  }
  return true;
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
export function path(a, b) {
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
      if (!blocked(x + dx, y + dy) && !prev.has(n)) {
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
