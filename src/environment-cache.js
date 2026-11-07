// Static image ownership and occlusion are presentation-only.
export function buildingBounds(h, iso) {
  const ps = [
    [h.x - 0.5, h.y - 0.5],
    [h.x + h.w - 0.5, h.y - 0.5],
    [h.x + h.w - 0.5, h.y + h.h - 0.5],
    [h.x - 0.5, h.y + h.h - 0.5],
  ].map(([x, y]) => iso(x, y));
  const x = Math.floor(Math.min(...ps.map((p) => p.x)) - 16),
    y = Math.floor(Math.min(...ps.map((p) => p.y)) - 48);
  return {
    x,
    y,
    width: Math.ceil(Math.max(...ps.map((p) => p.x)) + 16 - x),
    height: Math.ceil(Math.max(...ps.map((p) => p.y)) + 18 - y),
  };
}
export function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
export function buildingOccludes(h, u, iso) {
  if (!u || h.x + (h.w - 1) / 2 + h.y + (h.h - 1) / 2 <= u.x + u.y)
    return false;
  const a = iso(h.x - 0.5, h.y - 0.5),
    b = iso(h.x + h.w - 0.5, h.y - 0.5),
    c = iso(h.x + h.w - 0.5, h.y + h.h - 0.5),
    d = iso(h.x - 0.5, h.y + h.h - 0.5),
    roof = (p) => ({ x: p.x, y: p.y - 32 }),
    poly = [roof(a), roof(b), b, c, d, roof(d)],
    p = iso(u.x, u.y);
  return (
    pointInPolygon({ x: p.x, y: p.y - 18 }, poly) ||
    pointInPolygon({ x: p.x, y: p.y - 5 }, poly)
  );
}
export class EnvironmentCache {
  constructor(scene, drawables, iso, paint) {
    this.scene = scene;
    this.records = [];
    this.obscured = false;
    for (const [i, d] of drawables.entries()) {
      const p = iso(d.x, d.y),
        bounds = d.building
          ? buildingBounds(d.building, iso)
          : d.decoration
            ? { x: p.x - 26, y: p.y - 64, width: 52, height: 80 }
            : { x: p.x - 46, y: p.y - 48, width: 92, height: 78 },
        key = `urban-static-${i}`;
      const g = scene.make.graphics({ x: 0, y: 0, add: false }),
        local = (x, y) => {
          const q = iso(x, y);
          return { x: q.x - bounds.x, y: q.y - bounds.y };
        };
      paint(g, d, local);
      g.generateTexture(key, bounds.width, bounds.height);
      g.destroy();
      const sprite = scene.add
        .image(bounds.x, bounds.y, key)
        .setOrigin(0, 0)
        .setDepth(d.legacyRoof ? 100000 : (d.x + d.y) * 100);
      this.records.push({ d, bounds, key, sprite });
    }
  }
  update(view, selected, iso, legacyVisible) {
    this.obscured = false;
    for (const r of this.records) {
      const b = r.bounds,
        visible =
          b.x + b.width >= view.x &&
          b.y + b.height >= view.y &&
          b.x <= view.x + view.width &&
          b.y <= view.y + view.height &&
          (!r.d.legacyRoof || legacyVisible(r.d.building));
      r.sprite.setVisible(visible);
      const obscures =
        visible &&
        r.d.building &&
        buildingOccludes(r.d.building, selected, iso);
      r.sprite.setAlpha(obscures ? 0.48 : 1);
      if (obscures) this.obscured = true;
    }
  }
  destroy() {
    for (const r of this.records) {
      r.sprite.destroy();
      this.scene.textures.remove(r.key);
    }
    this.records.length = 0;
  }
}
