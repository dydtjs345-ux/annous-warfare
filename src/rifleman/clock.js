// Lab playback only: no simulation, perception, randomness or live shot cues.
import { CATALOG, clipAvailability } from "./catalog.js";
export const clipSeconds = (c) => c.durations.reduce((a, b) => a + b, 0);
export const SEQUENCE = Object.freeze([
  { action: "idle", duration: 1.4 },
  { action: "walk", duration: 3 },
  { action: "lowReady", duration: 0.4 },
  { action: "raise", duration: 0.64 },
  { action: "aim", duration: 1.2 },
  { action: "lower", duration: 0.7 },
  { action: "idle", duration: 1.4 },
]);
export const sequenceSeconds = SEQUENCE.reduce((n, s) => n + s.duration, 0);
export function sampleClip(c, seconds) {
  const total = clipSeconds(c);
  let t = Math.max(0, seconds);
  t = c.loop ? t % total : Math.min(t, total - 1e-9);
  if (c.loop && total - t < 1e-9) t = 0;
  let index = 0,
    start = 0;
  while (index < c.frames.length - 1 && t >= start + c.durations[index] - 1e-9)
    start += c.durations[index++];
  return { frame: c.frames[index], index, frameAge: t - start };
}
export class FoundationClock {
  constructor(catalog = CATALOG) {
    this.catalog = catalog;
    this.direction = "SE";
    this.action = "sequence";
    this.time = 0;
    this.speed = 1;
    this.playing = true;
  }
  select(action) {
    if (
      action !== "sequence" &&
      !Object.hasOwn(this.catalog.directions.SE.clips, action)
    )
      return false;
    this.action = action;
    this.time = 0;
    return true;
  }
  setDirection(direction) {
    if (!this.catalog.directions[direction]) return false;
    this.direction = direction;
    return true;
  }
  total() {
    const a = clipAvailability(this.direction, this.action, this.catalog);
    return this.action === "sequence"
      ? sequenceSeconds
      : a.supported
        ? clipSeconds(a.clip)
        : 0;
  }
  seek(t) {
    this.time = Number.isFinite(Number(t)) ? Math.max(0, Number(t)) : 0;
    const a = clipAvailability(this.direction, this.action, this.catalog);
    if (a.supported && !a.clip.loop)
      this.time = Math.min(this.time, clipSeconds(a.clip));
    return this.pose();
  }
  advance(dt) {
    if (this.playing)
      this.seek(this.time + Math.max(0, Math.min(0.1, dt)) * this.speed);
    return this.pose();
  }
  pose(direction = this.direction) {
    let action = this.action,
      local = this.time,
      stage = -1;
    if (action === "sequence") {
      if (
        SEQUENCE.some(
          (s) => !clipAvailability(direction, s.action, this.catalog).supported,
        )
      )
        return {
          direction,
          action: "sequence",
          local: this.time,
          stage: -1,
          status: "missing",
          reason:
            "연결 순서의 보행·올림·내림 아트 미완성. 정지 그림을 이어붙여 동작으로 표시하지 않음.",
          supported: false,
          bank: null,
          frame: null,
          index: null,
          count: 0,
        };
      local %= sequenceSeconds;
      stage = 0;
      while (
        stage < SEQUENCE.length - 1 &&
        local >= SEQUENCE[stage].duration - 1e-9
      )
        local -= SEQUENCE[stage++].duration;
      action = SEQUENCE[stage].action;
    }
    const a = clipAvailability(direction, action, this.catalog);
    return {
      direction,
      action,
      local,
      stage,
      status: a.status,
      reason: a.reason,
      supported: a.supported,
      bank: a.bank ?? null,
      frame: a.supported ? sampleClip(a.clip, local).frame : null,
      index: a.supported ? sampleClip(a.clip, local).index : null,
      count: a.clip?.frames.length ?? 0,
    };
  }
  step() {
    this.playing = false;
    const p = this.pose();
    if (!p.supported) return p;
    const boundaries = [];
    let start = 0;
    const stages =
      this.action === "sequence"
        ? SEQUENCE
        : [{ action: this.action, duration: this.total() }];
    for (const s of stages) {
      const a = clipAvailability(this.direction, s.action, this.catalog);
      let offset = 0;
      if (a.supported)
        for (let cycle = 0; offset < s.duration - 1e-8; cycle++) {
          for (const d of a.clip.durations) {
            if (offset >= s.duration - 1e-8) break;
            boundaries.push(start + offset);
            offset += d;
          }
          if (!a.clip.loop) break;
        }
      start += s.duration;
    }
    const total = this.total(),
      local = this.time % total;
    if (
      this.action !== "sequence" &&
      !clipAvailability(this.direction, this.action, this.catalog).clip.loop &&
      this.time >= total - 1e-8
    )
      return this.pose();
    const next = boundaries.find((t) => t > local + 1e-7);
    if (next != null) this.time += next - local;
    else if (
      this.action === "sequence" ||
      clipAvailability(this.direction, this.action, this.catalog).clip.loop
    )
      this.time += total - local;
    else this.time = total;
    return this.pose();
  }
  snapshot() {
    return {
      direction: this.direction,
      action: this.action,
      time: this.time,
      speed: this.speed,
      playing: this.playing,
      pose: this.pose(),
      total: this.total(),
    };
  }
}
