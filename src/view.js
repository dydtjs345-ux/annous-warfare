export function projection(width, height) {
  const originX = height * 20 + 180,
    originY = 55;
  const project = (x, y) => ({
    x: originX + (x - y) * 20,
    y: originY + (x + y) * 10,
  });
  const inverse = (x, y) => ({
    x: ((x - originX) / 20 + (y - originY) / 10) / 2,
    y: ((y - originY) / 10 - (x - originX) / 20) / 2,
  });
  return {
    project,
    inverse,
    bounds: {
      x: originX - (height - 1) * 20 - 40,
      y: 5,
      width: (width + height - 2) * 20 + 80,
      height: (width + height - 2) * 10 + 100,
    },
  };
}
export function fitZoom(bounds, width, height) {
  return Math.min((width - 12) / bounds.width, (height - 12) / bounds.height);
}
export function framedView(bounds, width, height, zoom, center) {
  const halfW = width / (zoom * 2),
    halfH = height / (zoom * 2);
  const clamp = (n, a, c) => Math.max(a, Math.min(c, n));
  const x =
    halfW * 2 >= bounds.width
      ? bounds.x + bounds.width / 2
      : clamp(center.x, bounds.x + halfW, bounds.x + bounds.width - halfW);
  const y =
    halfH * 2 >= bounds.height
      ? bounds.y + bounds.height / 2
      : clamp(center.y, bounds.y + halfH, bounds.y + bounds.height - halfH);
  return {
    centerX: x,
    centerY: y,
    x: x - halfW,
    y: y - halfH,
    width: halfW * 2,
    height: halfH * 2,
    zoom,
  };
}
export function pickSoldier(units, point, zoom, project) {
  let chosen = null,
    best = 22 / zoom;
  for (const u of units) {
    const p = project(u.x, u.y),
      d = Math.hypot(p.x - point.x, p.y - 12 - point.y);
    if (d < best) {
      best = d;
      chosen = u;
    }
  }
  return chosen;
}
export function inView(p, view, margin = 65) {
  return (
    p.x >= view.x - margin &&
    p.x <= view.x + view.width + margin &&
    p.y >= view.y - margin &&
    p.y <= view.y + view.height + margin
  );
}
