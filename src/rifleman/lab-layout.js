// Pure geometry. Always called with the current DOM content width, not Phaser's
// previous cached parent width during a recursive orientation/height resize.
export function laboratoryLayout(width, displayHeight) {
  const stacked = width < 640,
    h = displayHeight * 4,
    firstFoot = 250 + h,
    secondFoot = firstFoot + 68 + h;
  return {
    width,
    stacked,
    height: stacked ? secondFoot + 30 : firstFoot + 32,
    points: [
      { x: width * 0.25, y: 145 },
      { x: width * 0.75, y: 145 },
      stacked
        ? { x: width * 0.5, y: firstFoot }
        : { x: width * 0.25, y: firstFoot },
      stacked
        ? { x: width * 0.5, y: secondFoot }
        : { x: width * 0.75, y: firstFoot },
    ],
  };
}
