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
// Two genuine side-by-side columns even at 320px phone width. The source cels
// are narrow enough for 4x / 39px without downscaling or horizontal scrolling.
export function walkComparisonLayout(width, displayHeight = 39) {
  const foot = 220 + displayHeight * 4;
  return {
    width,
    stacked: false,
    height: foot + 32,
    points: [
      { x: width * 0.25, y: 110 },
      { x: width * 0.75, y: 110 },
      { x: width * 0.25, y: foot },
      { x: width * 0.75, y: foot },
    ],
  };
}
