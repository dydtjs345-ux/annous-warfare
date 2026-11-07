// Read-only live presentation adapter. No Battle writes, RNG, demo clock or orders.
import { clipFrame, clipDuration } from "./usmc-se-animation.js";
import { screenAngle } from "./soldier-prototype.js";
const RAD = Math.PI / 180;
export const SE_ART = {
  center: screenAngle(0),
  enter: 20 * RAD,
  exit: 26 * RAD,
  barrel: 10 * RAD,
  aimEnter: 20 * RAD,
  aimExit: 22.5 * RAD,
  travelDifference: 15 * RAD,
};
export const angleDistance = (a, b) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export const sectorGate = (held, angle, center, enter, exit) =>
  Number.isFinite(angle) &&
  angleDistance(angle, center) <= (held ? exit : enter);
const SPECIAL = new Set([
  "dead",
  "incapacitated",
  "reloading",
  "treating",
  "grenadePrep",
  "grenadeThrow",
  "deploying",
  "unmounting",
  "mounted",
  "mountedFiring",
  "fullCover",
  "suppressed",
  "limping",
  "crawling",
]);
export const LIVE_ANIMATION_KO = {
  idle: "대기 / 낮은 준비",
  walking: "보행",
  raising: "총기 올림",
  aiming: "견착 조준",
  firing: "실제 사격 / 반동",
  lowering: "총기 내림",
  inactive: "행동 불가",
};
export const LIVE_REASON_KO = {
  ready: "SE 전신 프레임 지원",
  asset: "SE 그림을 불러오지 못함",
  identity: "USMC 소총수 #1 전용",
  inactive: "사망 / 전투 불능",
  special: "이 동작의 SE 전신 프레임 없음",
  posture: "낮은 엄폐 / 부상 자세는 기존 표현 사용",
  facing: "관찰·무기 방향이 SE 범위 밖",
  travel: "이동과 관찰 방향을 함께 표현할 수 없음",
  barrel: "고정 SE 총열과 실제 조준 방향 차이",
  movingCombat: "이동 중 견착·사격 / 전환은 기존 표현 사용",
  movement: "실제 이동 거리로 보행 프레임 재생",
  target: "실제 직접 표적 조준",
  suppression: "실제 최종 목격 위치 사격 임무",
  shot: "실제 shot 이벤트",
  ended: "실제 교전 종료 후 낮은 준비 자세로 복귀",
  rest: "실제 정지 / 교전 없음",
  finished: "전투 종료",
};
export class LiveUSMCState {
  constructor(art = SE_ART, durations = null) {
    // A presentation-only direction may supply its authored sector and timing.
    // Default SE behavior and its existing battle integration are unchanged.
    this.art = art;
    this.durations = durations;
    this.reset(null);
  }
  reset(b) {
    this.battle = b;
    this.serial = 0;
    this.lastShot = null;
    this.amount = 0;
    this.transition = null;
    this.lookHeld = false;
    this.moveHeld = false;
    this.aimHeld = false;
    this.history = [];
    this.tag = null;
    this.state = null;
  }
  amountAt(now) {
    if (!this.transition) return this.amount;
    const t = Math.max(
      0,
      Math.min(1, (now - this.transition.at) / this.transition.duration),
    );
    return (
      this.transition.from + (this.transition.to - this.transition.from) * t
    );
  }
  update(b, u, m, view = u) {
    if (this.battle !== b) this.reset(b);
    const now = b.time;
    let newest = null;
    for (const e of b.events ?? []) {
      if (e.id <= this.serial) continue;
      this.serial = Math.max(this.serial, e.id);
      if (e.type === "shot" && e.unitId === u.id) newest = e;
    }
    if (newest)
      this.lastShot = { id: newest.id, time: newest.time, angle: newest.angle };
    const eligible = u.id === 1 && u.team === 0 && u.role === "Rifleman";
    const active = !!u.active && !u.dead;
    const visibleTarget =
      active &&
      !b.result &&
      ["Engaging", "Aiming"].includes(u.state) &&
      !!u.presentation?.direct &&
      (u.visibleEnemies ?? []).some((e) => e.id === u.engagementId && e.active);
    const suppressing =
      active && !b.result && u.state === "Suppressing last-known";
    const intent = visibleTarget || suppressing;
    const shotAge = this.lastShot
      ? Math.max(0, now - this.lastShot.time)
      : Infinity;
    const shot =
      active &&
      !b.result &&
      this.lastShot &&
      ((m.flash && shotAge < 0.8) || shotAge < 0.22);
    this.amount = this.amountAt(now);
    if (
      this.transition &&
      now >= this.transition.at + this.transition.duration
    ) {
      this.amount = this.transition.to;
      this.transition = null;
    }
    if (!active || b.result) {
      this.amount = 0;
      this.transition = null;
      this.lastShot = null;
    } else if (shot) {
      this.amount = 1;
      this.transition = null;
    } else {
      const desired = intent ? 1 : 0;
      if (
        (!this.transition && Math.abs(this.amount - desired) > 1e-6) ||
        (this.transition && this.transition.to !== desired)
      ) {
        const clip = desired ? "raise" : "lower";
        let duration = this.durations?.[clip] ?? clipDuration(clip);
        // Existing aim/reaction deadline governs raise pacing. A real shot always
        // overrides an unfinished raise; animation never delays firing.
        if (desired && u.aimAt > now)
          duration = Math.min(duration, u.aimAt - now);
        this.transition = {
          from: this.amount,
          to: desired,
          at: now,
          duration: Math.max(0.05, duration * Math.abs(desired - this.amount)),
        };
      }
    }
    const moving = !!m.moving && !b.result;
    let animation, frame, reason;
    if (!active) {
      animation = "inactive";
      frame = 0;
      reason = "inactive";
    } else if (b.result) {
      animation = "idle";
      frame = 0;
      reason = "finished";
    } else if (shot) {
      animation = "firing";
      frame = m.flash ? 17 : shotAge < 0.12 ? 18 : 19;
      reason = "shot";
    } else if (this.transition) {
      animation = this.transition.to ? "raising" : "lowering";
      const progress = this.transition.to ? this.amount : 1 - this.amount;
      frame = clipFrame(
        this.transition.to ? "raise" : "lower",
        progress * clipDuration(this.transition.to ? "raise" : "lower"),
      ).frame;
      reason = this.transition.to
        ? suppressing
          ? "suppression"
          : "target"
        : "ended";
    } else if (intent) {
      animation = "aiming";
      frame = 16;
      reason = suppressing ? "suppression" : "target";
    } else if (moving) {
      animation = "walking";
      const stride = m.renderStride ?? m.stride ?? 0;
      frame = 4 + (((Math.floor((stride / (2 * Math.PI)) * 8) % 8) + 8) % 8);
      reason = "movement";
    } else {
      animation = "idle";
      frame = clipFrame("idle", now).frame;
      reason = "rest";
    }
    const lookAngle = screenAngle(m.renderDirection ?? m.direction ?? u.facing),
      moveAngle = screenAngle(
        view.movementHeading ?? u.movementHeading ?? u.facing,
      ),
      aimAngle = screenAngle(m.direction ?? u.facing);
    this.lookHeld = sectorGate(
      this.lookHeld,
      lookAngle,
      this.art.center,
      this.art.enter,
      this.art.exit,
    );
    this.moveHeld = sectorGate(
      this.moveHeld,
      moveAngle,
      this.art.center,
      this.art.enter,
      this.art.exit,
    );
    this.aimHeld = sectorGate(
      this.aimHeld,
      aimAngle,
      this.art.barrel,
      this.art.aimEnter,
      this.art.aimExit,
    );
    let fallback = null;
    if (!eligible) fallback = "identity";
    else if (!active) fallback = "inactive";
    else if (
      SPECIAL.has(m.pose) ||
      m.tucked ||
      m.crawl ||
      m.limp ||
      m.suppressed
    )
      fallback = "special";
    else if ((m.renderTop ?? -30) > -26 || (!moving && m.covered))
      fallback = "posture";
    else if (!this.lookHeld) fallback = "facing";
    else if (
      moving &&
      (!this.moveHeld ||
        angleDistance(lookAngle, moveAngle) > this.art.travelDifference)
    )
      fallback = "travel";
    else if (moving && (intent || this.amount > 1e-6 || animation === "firing"))
      fallback = "movingCombat";
    else if (
      (intent || animation === "firing" || animation === "raising") &&
      !this.aimHeld
    )
      fallback = "barrel";
    this.state = {
      animation,
      frame,
      reason,
      supported: !fallback,
      fallback,
      amount: this.amount,
      lookAngle,
      moveAngle,
      aimAngle,
      moving,
      targetId: visibleTarget ? u.engagementId : null,
      shotId: shot ? this.lastShot?.id : null,
      shotAt: shot ? this.lastShot?.time : null,
      flash: !!(shot && m.flash),
      time: now,
    };
    const tag = `${animation}:${fallback ?? "SE"}`;
    if (tag !== this.tag) {
      this.history.push({ time: now, animation, frame, reason, fallback });
      if (this.history.length > 32) this.history.shift();
      this.tag = tag;
    }
    return this.state;
  }
  snapshot() {
    return this.state ? { ...this.state } : null;
  }
}
