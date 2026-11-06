// Original grid layout, independent of combat RNG. Buildings are sealed blocks;
// this release has no interiors, doors, windows or CQB behavior in expanded mode.
export function expandedWorld(variant = 0) {
  const width = 54,
    height = 44,
    houses = [],
    obstacles = new Map();
  const v = ((variant % 4) + 4) % 4;
  const add = (x, y, type) => {
    const k = `${x},${y}`;
    if (!obstacles.has(k)) obstacles.set(k, type);
  };
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++) {
      const n = row * 4 + col;
      const h = {
        x: 5 + col * 13 + ((n + v + Math.floor(v / 2)) % 2),
        y: 5 + row * 13 + ((col + v) % 2),
        w: 6 + ((row + v) % 2),
        h: 6 + ((n + v) % 2),
        sealed: true,
      };
      h.w = Math.min(h.w, 51 - h.x);
      houses.push(h);
      for (let x = h.x; x < h.x + h.w; x++)
        for (let y = h.y; y < h.y + h.h; y++) add(x, y, "wall");
    }
  const line = (x, y, n, vertical, type) => {
    for (let i = 0; i < n; i++)
      add(x + (vertical ? 0 : i), y + (vertical ? i : 0), type);
  };
  line(5, 14, 7, false, "sandbag");
  line(44, 15, 6, false, "concrete");
  line(18, 27, 6, false, "sandbag");
  line(31, 28, 7, false, "concrete");
  line(14, 19, 5, true, v % 2 ? "concrete" : "sandbag");
  line(40, 6, 5, true, v % 2 ? "sandbag" : "concrete");
  for (const [x, y] of [
    [28, 14],
    [29, 15],
  ])
    add(x, y, "sandbag");
  for (const [x, y] of [
    [16, 8 + (v % 2)],
    [16, 9 + (v % 2)],
    [28, 23],
    [28, 24],
    [21, 16],
    [22, 16],
    [46, 28],
    [47, 28],
  ])
    add(x, y, "vehicle");
  for (const [x, y] of [
    [12, 22],
    [38, 34],
    [30, 11],
    [17, 39],
  ])
    add(x, y, "crates");
  return { width, height, houses, obstacles };
}
export function expandedStreet(x, y) {
  return (
    (x >= 13 && x <= 16) ||
    (x >= 26 && x <= 29) ||
    (x >= 39 && x <= 42) ||
    (y >= 13 && y <= 16) ||
    (y >= 26 && y <= 29) ||
    x <= 3 ||
    x >= 51 ||
    y <= 3 ||
    y >= 39
  );
}
export function expandedSpawns(configuration = 0) {
  const mode = ((configuration % 3) + 3) % 3;
  return [0, 1].map((team) =>
    Array.from({ length: 6 }, (_, i) =>
      mode === 1
        ? { x: (team ? 35 : 8) + i * 1.5, y: team ? 41 : 2 }
        : {
            x: team ? 51 : 2,
            y: (mode === 2 ? (team ? 6 : 28) : team ? 28 : 8) + i * 1.5,
          },
    ),
  );
}
