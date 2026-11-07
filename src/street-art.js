// Tiny cosmetic fittings live on existing solid building foundations, not paths.
export function streetProps(houses) {
  const out = [];
  houses
    .filter((h) => h.sealed)
    .forEach((h, i) => {
      out.push({
        x: h.x + h.w - 0.7,
        y: h.y + h.h - 0.7,
        decoration: i % 3 === 0 ? "utility" : "lamp",
      });
      out.push({
        x: h.x + h.w - 2,
        y: h.y + h.h - 0.65,
        decoration: i % 2 ? "bench" : "bin",
      });
    });
  return out;
}
export function drawStreetProp(g, d, p) {
  if (d.decoration === "lamp" || d.decoration === "utility") {
    const H = d.decoration === "utility" ? 50 : 42;
    g.fillStyle(0x091b26, 0.28);
    g.fillEllipse(p.x + 4, p.y + 2, 16, 5);
    g.lineStyle(3, 0x223943);
    g.lineBetween(p.x, p.y, p.x, p.y - H);
    g.lineStyle(1, 0x8d9b98, 0.8);
    g.lineBetween(p.x - 1, p.y - 2, p.x - 1, p.y - H);
    if (d.decoration === "utility") {
      g.lineStyle(2, 0x6c7775);
      g.lineBetween(p.x - 9, p.y - H + 3, p.x + 9, p.y - H - 3);
      for (const side of [-1, 1]) {
        g.fillStyle(0xb4b9a5);
        g.fillRect(p.x + side * 7 - 1, p.y - H - 4, 2, 4);
      }
    } else {
      g.lineStyle(2, 0x789091);
      g.lineBetween(p.x, p.y - H, p.x - 8, p.y - H - 4);
      g.fillStyle(0xb4c1b8);
      g.fillRect(p.x - 13, p.y - H - 4, 7, 2);
      g.fillStyle(0xdae5d6, 0.08);
      g.fillEllipse(p.x - 9, p.y - H, 14, 7);
    }
    // Small road-name plate, attached to the pole and clearly not a barricade.
    g.fillStyle(0x365c66);
    g.fillRect(p.x + 2, p.y - 25, 11, 5);
    g.fillStyle(0xb2c9c6);
    g.fillRect(p.x + 4, p.y - 23, 7, 1);
  } else if (d.decoration === "bin") {
    g.fillStyle(0x284348);
    g.fillRect(p.x - 4, p.y - 9, 8, 9);
    g.fillStyle(0x6a8180);
    g.fillRect(p.x - 5, p.y - 10, 10, 2);
    g.lineStyle(1, 0x102c36);
    g.lineBetween(p.x - 2, p.y - 7, p.x - 2, p.y - 1);
    g.lineBetween(p.x + 2, p.y - 7, p.x + 2, p.y - 1);
  } else {
    g.lineStyle(2, 0x243b46);
    g.lineBetween(p.x - 8, p.y - 2, p.x - 8, p.y + 2);
    g.lineBetween(p.x + 8, p.y + 4, p.x + 8, p.y + 7);
    g.lineStyle(2, 0x8a8068);
    g.lineBetween(p.x - 10, p.y - 4, p.x + 10, p.y + 5);
    g.lineBetween(p.x - 10, p.y - 8, p.x + 10, p.y + 1);
    g.lineStyle(1, 0xb5aa8b);
    g.lineBetween(p.x - 10, p.y - 5, p.x + 10, p.y + 4);
  }
}
export function drawStreetDecal(g, x, y, p, road, seed) {
  if (!road) return;
  if ((x % 13 === 1 || y % 13 === 1) && seed % 7 === 0) {
    g.fillStyle(0x172e3a, 0.7);
    g.fillEllipse(p.x, p.y, 11, 6);
    g.lineStyle(1, 0x879494, 0.6);
    g.strokeEllipse(p.x, p.y, 10, 5);
    for (let i = -2; i <= 2; i += 2)
      g.lineBetween(p.x - 3, p.y + i * 0.5, p.x + 3, p.y + i * 0.5);
  }
  if (
    (y === 12 || y === 25) &&
    ((x >= 13 && x <= 16) || (x >= 26 && x <= 29) || (x >= 39 && x <= 42))
  ) {
    g.lineStyle(3, 0xc1c4ad, 0.35);
    g.lineBetween(p.x - 8, p.y - 4, p.x + 8, p.y + 4);
  }
  if (seed % 41 === 0) {
    g.fillStyle(0xb4b3a1, 0.4);
    g.fillRect(p.x + 4, p.y - 1, 3, 2);
    g.lineStyle(1, 0x192e3b);
    g.lineBetween(p.x + 3, p.y, p.x + 9, p.y + 2);
  }
}
