// Preview geometry only. No simulation/world imports or per-limb transforms.
export function proportionLayout(width, displayHeight, zoom, designs) {
  const radius = Math.max(
    ...designs.flatMap((d) =>
      d.frames.map(
        (f) =>
          (Math.max(
            f.footAnchor[0] - f.bounds[0],
            f.bounds[2] - f.footAnchor[0],
          ) /
            d.nativeStandingHeight) *
          displayHeight *
          zoom,
      ),
    ),
  );
  const stacked = width < radius * 4 + 32,
    extent = displayHeight * zoom;
  const foot = Math.max(372, 232 + extent),
    secondFoot = foot + 84 + extent;
  return {
    stacked,
    height: stacked ? secondFoot + 28 : foot + 28,
    actual: [
      { x: width * 0.25, y: 140 },
      { x: width * 0.75, y: 140 },
    ],
    detail: stacked
      ? [
          { x: width * 0.5, y: foot },
          { x: width * 0.5, y: secondFoot },
        ]
      : [
          { x: width * 0.25, y: foot },
          { x: width * 0.75, y: foot },
        ],
    detailLabels: stacked
      ? [
          { x: width * 0.5, y: 204 },
          { x: width * 0.5, y: foot + 56 },
        ]
      : [
          { x: width * 0.25, y: 204 },
          { x: width * 0.75, y: 204 },
        ],
  };
}
export function proportionFigure(
  design,
  frameIndex,
  position,
  displayHeight,
  magnification = 1,
) {
  const frame = design.frames[frameIndex],
    a = frame.footAnchor,
    scale = (displayHeight / design.nativeStandingHeight) * magnification;
  return {
    frame: frameIndex,
    x: position.x,
    y: position.y,
    scale,
    originX: a[0] / design.frameSize[0],
    originY: a[1] / design.frameSize[1],
    muzzle: {
      x: position.x + (frame.muzzle[0] - a[0]) * scale,
      y: position.y + (frame.muzzle[1] - a[1]) * scale,
    },
    bounds: {
      left: position.x + (frame.bounds[0] - a[0]) * scale,
      right: position.x + (frame.bounds[2] - a[0]) * scale,
      top: position.y + (frame.bounds[1] - a[1]) * scale,
      bottom: position.y + (frame.bounds[3] - a[1]) * scale,
    },
  };
}
