// Static public mirror of the same laboratory pane; no game/simulation imports.
import { WalkComparisonClock } from "./walk-comparison.js";
import { walkComparisonLayout } from "./lab-layout.js";
const clock = new WalkComparisonClock(),
  root = document.documentElement;
const $ = (id) => document.getElementById(id);
const svgNS = "http://www.w3.org/2000/svg";
const make = (tag, attrs, parent = root, text) => {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs ?? {}))
    e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
};
const label = (id, text, x, y, extra = {}) =>
  make("text", { id, x, y, ...extra }, root, text);
const title = label("heading", "E 보행 비교 · v0.3.5", 12, 28, {
  "font-size": 18,
  "font-weight": 700,
});
label("subheading", "실제 PNG · 신규 8셀 / 이전 4셀", 12, 50, {
  fill: "#a9bbc1",
});
const buttons = [];
function button(id, text, fn) {
  const g = make("g", {
    id,
    role: "button",
    tabindex: 0,
    "aria-label": text,
    class: "control",
  });
  const r = make("rect", { rx: 5, height: 44 }, g),
    t = make("text", { "text-anchor": "middle", y: 28 }, g, text);
  g.addEventListener("click", () => {
    fn();
    render();
  });
  g.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
      render();
    }
  });
  buttons.push({ id, g, r, t });
  return g;
}
button("play", "재생", () => (clock.playing = true));
button("pause", "일시정지", () => (clock.playing = false));
button("slow", "느리게 · 0.25×", () => {
  clock.speed = 0.25;
  clock.playing = true;
});
button("step", "다음 프레임", () => clock.step());
button("restart", "처음부터", () => clock.seek(0));
for (const speed of [0.25, 0.5, 1, 2, 4])
  button("speed-" + speed, speed + "×", () => (clock.speed = speed));
const status = label("playback-state", "", 12, 235, { fill: "#e6d2aa" });
const counters = [
  label("new-counter", "", 12, 257, { fill: "#e2c58e" }),
  label("old-counter", "", 12, 275, { fill: "#e6b4a3" }),
];
const floor = make("g", { stroke: "#4b616b", "stroke-width": 1, opacity: 0.6 });
root.insertBefore(floor, $("new-image-actual"));
const views = [
  { selected: true, actual: true },
  { selected: false, actual: true },
  { selected: true, actual: false },
  { selected: false, actual: false },
].map((v) => ({
  ...v,
  image: $(
    v.selected
      ? "new-image-" + (v.actual ? "actual" : "large")
      : "old-image-" + (v.actual ? "actual" : "large"),
  ),
  name: make("text", {
    "text-anchor": "middle",
    "font-size": 11,
    fill: v.selected ? "#e2c58e" : "#e6b4a3",
  }),
  frame: make("text", { "text-anchor": "middle", "font-size": 11 }),
}));
label("note1", "PROTOTYPE / REJECTED · 완료 아님", 12, 735, {
  fill: "#e6b4a3",
});
label("note2", "한 단계 = 새 1/8주기 · 이전은 두 단계마다 변경", 12, 755, {
  "font-size": 11,
  fill: "#a9bbc1",
});
let width,
  layout,
  last = 0,
  lastFrame = "",
  lastUI = "";
function resize() {
  // Standalone SVG documents may use a 980px mobile layout viewport. Keep the
  // viewBox in device CSS pixels so the displayed soldier is still 39px tall.
  width = Math.max(280, Math.min(innerWidth, screen.width || innerWidth));
  const cssWidth =
    document.documentElement.getBoundingClientRect().width || innerWidth;
  root.setAttribute("viewBox", `0 0 ${width} 780`);
  root.style.height = (780 * cssWidth) / width + "px";
  const gap = 6,
    pad = 12;
  buttons.forEach((b, i) => {
    let col, n, y;
    if (i < 3) {
      col = i;
      n = 3;
      y = 67;
    } else if (i < 5) {
      col = i - 3;
      n = 2;
      y = 117;
    } else {
      col = i - 5;
      n = 5;
      y = 167;
    }
    const w = (width - pad * 2 - gap * (n - 1)) / n;
    b.g.setAttribute("transform", `translate(${pad + col * (w + gap)} ${y})`);
    b.r.setAttribute("width", w);
    b.t.setAttribute("x", w / 2);
    b.t.setAttribute("font-size", i === 2 ? 11 : 13);
  });
  layout = walkComparisonLayout(width, 39);
  floor.replaceChildren();
  views.forEach((v, i) => {
    v.foot = { x: layout.points[i].x, y: layout.points[i].y + 290 };
    const labelY = v.actual ? 303 : 454;
    v.name.setAttribute("x", v.foot.x);
    v.name.setAttribute("y", labelY);
    v.name.textContent = v.selected
      ? "새 8셀 · PROTOTYPE"
      : "이전 4셀 · REJECTED";
    v.frame.setAttribute("x", v.foot.x);
    v.frame.setAttribute("y", labelY + 17);
    const r = v.actual ? 34 : Math.min(65, width * 0.2);
    make(
      "ellipse",
      { cx: v.foot.x, cy: v.foot.y + 2, rx: r, ry: r * 0.22, fill: "none" },
      floor,
    );
    make(
      "path",
      { d: `M${v.foot.x - r},${v.foot.y}h${r * 2}`, fill: "none" },
      floor,
    );
  });
  lastFrame = "";
  render();
}
function render() {
  const pose = clock.pose(),
    old = clock.referencePose();
  const tag = `${pose.frame}:${old.frame}:${width}`;
  if (tag !== lastFrame) {
    for (const v of views) {
      const p = v.selected ? pose : old,
        d = globalThis.WALK_DESIGN[v.selected ? "new" : "old"],
        f = d.frames[p.frame],
        s = (39 / d.nativeStandingHeight) * (v.actual ? 1 : 4);
      const [x, y] = f.footAnchor,
        [fw, fh] = d.frameSize;
      v.image.setAttribute("x", v.foot.x - x * s);
      v.image.setAttribute("y", v.foot.y - y * s);
      v.image.setAttribute("width", fw * s);
      v.image.setAttribute("height", fh * s);
      v.image.setAttribute(
        "viewBox",
        `${(p.frame % d.grid[0]) * fw} ${Math.floor(p.frame / d.grid[0]) * fh} ${fw} ${fh}`,
      );
      v.frame.textContent = `${v.actual ? "39px" : "4×"} · 프레임 ${p.index + 1}/${p.count}`;
    }
    counters[0].textContent = `새 보행 ${pose.index + 1}/8 · PROTOTYPE`;
    counters[1].textContent = `이전 보행 ${old.index + 1}/4 · REJECTED`;
    lastFrame = tag;
  }
  const ui = `${clock.playing}:${clock.speed}`;
  if (ui !== lastUI) {
    status.textContent = `${clock.playing ? "재생 중" : "일시정지"} · ${clock.speed}× · 공통 1초 반복`;
    for (const b of buttons) {
      const pressed =
        b.id === "play"
          ? clock.playing
          : b.id === "pause"
            ? !clock.playing
            : b.id === "slow"
              ? clock.speed === 0.25
              : b.id === "speed-" + clock.speed;
      b.g.setAttribute("aria-pressed", String(pressed));
    }
    lastUI = ui;
  }
}
window.walkPreviewSnapshot = () => ({
  ...clock.snapshot(),
  width,
  displayHeight: 39,
  magnification: 4,
  independentWeaponObjects: 0,
  views: views.map((v) => ({
    selected: v.selected,
    actual: v.actual,
    x: v.foot.x,
    y: v.foot.y,
    viewBox: v.image.getAttribute("viewBox"),
    bounds: v.image.getBoundingClientRect().toJSON(),
  })),
});
addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  last = 0;
});
function tick(now) {
  if (last && !document.hidden) clock.advance((now - last) / 1000);
  last = now;
  render();
  requestAnimationFrame(tick);
}
resize();
requestAnimationFrame(tick);
