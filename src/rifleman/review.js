// Explicit quality-review sandbox only. This inventory is NOT a capability
// source for live combat or normal lab playback. Rejected art stays rejected.
import { FoundationClock, sampleClip, clipSeconds } from "./clock.js";
import { CATALOG } from "./catalog.js";
export const WALK_REVIEW = Object.freeze({
  id: "e-walk-keys",
  direction: "E",
  action: "walk",
  bank: "review-e-walk",
  status: "rejected",
  reason:
    "미채택 4키 보행 검토: 연결 셀·정밀 접지/이동 곡선·장비 일관성 추가 작화 필요. 실제 전투 및 기본 재생 사용 안 함.",
  asset: {
    direction: "E",
    kind: "whole-body",
    weaponIntegrated: true,
    image: "assets/rifleman-foundation-v035/review/e-walk-keys.png",
    metadata: "assets/rifleman-foundation-v035/review/e-walk-keys.json",
    grid: [2, 2],
    frameSize: [627, 627],
  },
  clip: {
    frames: [0, 1, 2, 3],
    durations: [0.25, 0.25, 0.25, 0.25],
    loop: true,
  },
});
export class QualityReviewClock extends FoundationClock {
  constructor(entry = WALK_REVIEW) {
    super();
    this.review = entry;
    this.direction = entry.direction;
    this.action = entry.action;
  }
  select(action) {
    if (action !== this.review.action) return false;
    this.time = 0;
    return true;
  }
  setDirection(direction) {
    return direction === this.review.direction;
  }
  total() {
    return clipSeconds(this.review.clip);
  }
  pose(direction = this.direction) {
    if (direction !== this.review.direction && direction !== "SE")
      return {
        direction,
        action: "walk",
        status: "missing",
        supported: false,
        renderable: false,
        frame: null,
        bank: null,
        reason: "이 후보에 해당 방향 그림 없음",
      };
    const reference = direction === "SE",
      c = reference ? CATALOG.directions.SE.clips.walk : this.review.clip,
      t = (this.time / this.total()) * clipSeconds(c),
      frame = sampleClip(c, t);
    return {
      ...frame,
      direction,
      action: "walk",
      local: t,
      stage: -1,
      bank: reference ? "se033" : this.review.bank,
      count: c.frames.length,
      status: reference ? "prototype" : "rejected",
      reason: reference
        ? "기존 SE 보행 · 같은 순환 위상 대조"
        : this.review.reason,
      supported: reference,
      renderable: true,
      reviewOnly: !reference,
      admitted: false,
    };
  }
  step() {
    this.playing = false;
    const p = sampleClip(this.review.clip, this.time),
      delta = this.review.clip.durations[p.index] - p.frameAge;
    this.time += Math.max(1e-8, delta);
    return this.pose();
  }
}
