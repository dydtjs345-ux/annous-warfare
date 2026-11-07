// SE-only visual demonstration. This module imports no Battle, weapon or AI code.
// Each index is an entire human pose, including both arms, hands and the rifle.
export const CLIPS = Object.freeze({
  idle: {
    label: "대기 · 낮은 준비 자세",
    frames: [0, 1, 2, 3],
    durations: [0.35, 0.35, 0.35, 0.35],
    loop: true,
  },
  walk: {
    label: "보행 · 몸통/어깨/장비 동조",
    frames: [4, 5, 6, 7, 8, 9, 10, 11],
    durations: [0.13, 0.12, 0.12, 0.13, 0.13, 0.12, 0.12, 0.13],
    loop: true,
  },
  raise: {
    label: "총기 올리기 · 양손/견착",
    frames: [12, 13, 14, 15],
    durations: [0.14, 0.16, 0.16, 0.18],
  },
  aim: {
    label: "조준 · 견착 유지",
    frames: [16],
    durations: [0.8],
    loop: true,
  },
  fire: {
    label: "사격 · 상체와 총기의 동시 반동",
    frames: [17, 18, 19, 16],
    durations: [0.055, 0.065, 0.1, 0.48],
    loop: true,
  },
  lower: {
    label: "총기 내리기 · 준비 자세 복귀",
    frames: [20, 21, 22, 23],
    durations: [0.15, 0.18, 0.18, 0.19],
  },
});
export const DEMO = Object.freeze([
  { clip: "idle", duration: 1.4, label: "대기" },
  { clip: "walk", duration: 4, label: "보행 (카메라 추적)" },
  { clip: "idle", duration: 0.4, label: "정지 · 발 디딤" },
  { clip: "raise", duration: 0.64, label: "총기 올리기" },
  { clip: "aim", duration: 0.8, label: "조준 안정" },
  { clip: "fire", duration: 1.4, label: "사격 시연 · 2회" },
  { clip: "aim", duration: 0.7, label: "반동 복귀 · 조준" },
  { clip: "lower", duration: 0.7, label: "총기 내리기" },
  { clip: "idle", duration: 1.4, label: "준비 자세 복귀" },
]);
export const DEMO_DURATION = DEMO.reduce(
  (sum, stage) => sum + stage.duration,
  0,
);
export const clipDuration = (clip) =>
  CLIPS[clip].durations.reduce((a, b) => a + b, 0);
export function clipFrame(clip, seconds) {
  const data = CLIPS[clip] ?? CLIPS.idle,
    total = data.durations.reduce((a, b) => a + b, 0);
  let t = Math.max(0, seconds);
  t = data.loop ? t % total : Math.min(t, total - 1e-8);
  if (data.loop && total - t < 1e-9) t = 0;
  let index = 0,
    start = 0;
  while (
    index < data.frames.length - 1 &&
    t >= start + data.durations[index] - 1e-10
  )
    start += data.durations[index++];
  return {
    frame: data.frames[index],
    index,
    phaseTime: t,
    frameAge: t - start,
  };
}
export function demoPose(time, mode = "demo") {
  const seconds = Math.max(0, time);
  let clip = mode,
    local = seconds,
    label = CLIPS[mode]?.label,
    stage = -1;
  if (mode === "demo") {
    local = seconds % DEMO_DURATION;
    stage = 0;
    while (stage < DEMO.length - 1 && local >= DEMO[stage].duration - 1e-10)
      local -= DEMO[stage++].duration;
    ({ clip, label } = DEMO[stage]);
  }
  const frame = clipFrame(clip, local);
  return {
    ...frame,
    clip,
    local,
    label,
    stage,
    // A preview cue, explicitly not a simulation shot or an ammunition change.
    flash: clip === "fire" && frame.index === 0 && frame.frameAge < 0.045,
    walking: clip === "walk",
  };
}
export class SEPreviewClock {
  constructor() {
    this.time = 0;
    this.mode = "demo";
    this.playing = true;
    this.speed = 1;
  }
  advance(dt) {
    if (this.playing) this.time += Math.max(0, Math.min(dt, 0.1)) * this.speed;
    if (this.mode !== "demo" && !CLIPS[this.mode].loop)
      this.time = Math.min(this.time, clipDuration(this.mode));
    return this.pose();
  }
  pose() {
    return demoPose(this.time, this.mode);
  }
  select(mode) {
    if (mode !== "demo" && !CLIPS[mode]) return;
    this.mode = mode;
    this.time = 0;
  }
  seek(time) {
    this.time = Math.max(0, Number(time) || 0);
    return this.pose();
  }
  step() {
    this.playing = false;
    // Find the next authored cel boundary, without skipping a short recoil cel.
    const start = this.pose().frame;
    if (this.mode !== "demo" && CLIPS[this.mode].frames.length === 1)
      return this.pose();
    if (
      this.mode !== "demo" &&
      !CLIPS[this.mode].loop &&
      this.time >= clipDuration(this.mode)
    )
      return this.pose();
    for (let i = 0; i < 1501; i++) {
      this.time += 0.001;
      if (this.mode !== "demo" && !CLIPS[this.mode].loop)
        this.time = Math.min(this.time, clipDuration(this.mode));
      if (this.pose().frame !== start) break;
    }
    return this.pose();
  }
}

// Camera-tracked preview travel only. Derived from the clock so seeking, pauses,
// frame grouping and changing speed cannot accumulate floor/pose drift.
export function previewTravel(time, mode = "demo") {
  const t = Math.max(0, time);
  if (mode === "walk") return t * 90;
  if (mode !== "demo") return 0;
  const cycles = Math.floor(t / DEMO_DURATION),
    local = t % DEMO_DURATION;
  return (cycles * 4 + Math.max(0, Math.min(4, local - 1.4))) * 90;
}

// Explicit demo-only shot cues, including those crossed between render frames.
// At 4x a short recoil cel can be skipped by a render, but its cue must survive.
export function shotCuesBetween(from, to, mode = "demo") {
  if (to < from || !["demo", "fire"].includes(mode)) return [];
  const period = mode === "demo" ? DEMO_DURATION : clipDuration("fire");
  const fireIndex = DEMO.findIndex((stage) => stage.clip === "fire");
  const fireStart = DEMO.slice(0, fireIndex).reduce(
    (sum, stage) => sum + stage.duration,
    0,
  );
  const starts =
    mode === "demo"
      ? Array.from(
          {
            length: Math.round(DEMO[fireIndex].duration / clipDuration("fire")),
          },
          (_, i) => fireStart + i * clipDuration("fire"),
        )
      : [0];
  const out = [];
  for (
    let cycle = Math.max(0, Math.floor(from / period));
    cycle <= Math.floor(to / period);
    cycle++
  )
    for (const start of starts) {
      const t = cycle * period + start;
      if (t > from + 1e-10 && t <= to + 1e-10) out.push(t);
    }
  return out;
}
