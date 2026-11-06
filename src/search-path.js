import { W, H, blocked } from "./world.js";

// One terrain BFS per squad objective, rather than a BFS for every candidate.
// This is map knowledge only; enemy positions never participate in this tree.
export function searchRoutes(start) {
  const width = W,
    height = H,
    parent = new Int32Array(width * height).fill(-1),
    distance = new Int32Array(width * height).fill(-1),
    queue = [];
  const sx = Math.round(start.x),
    sy = Math.round(start.y),
    root = sy * width + sx;
  if (blocked(sx, sy)) return { distance: () => Infinity, route: () => [] };
  queue.push(root);
  distance[root] = 0;
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      x = id % width,
      y = Math.floor(id / width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        n = ny * width + nx;
      if (blocked(nx, ny) || distance[n] >= 0) continue;
      distance[n] = distance[id] + 1;
      parent[n] = id;
      queue.push(n);
    }
  }
  const index = (p) => Math.round(p.y) * width + Math.round(p.x);
  return {
    distance: (p) => (distance[index(p)] >= 0 ? distance[index(p)] : Infinity),
    route: (p) => {
      let n = index(p);
      if (distance[n] < 0) return [];
      const out = [];
      while (n !== root) {
        out.push([n % width, Math.floor(n / width)]);
        n = parent[n];
      }
      return out.reverse();
    },
  };
}
