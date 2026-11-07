// Capability-gated rendering contracts. No cutting the whole-body SE PNG into
// guessed limbs; a layered pairing needs independently authored, reviewed art.
import { CATALOG, clipAvailability } from "./catalog.js";
import { clipSeconds, sampleClip } from "./clock.js";
const blocked = (reason, request) => ({
  supported: false,
  reason,
  request: { ...request },
  layers: [],
});
export function resolveRequest(
  request,
  lowerTime = 0,
  upperTime = 0,
  catalog = CATALOG,
) {
  const {
    locomotion = "idle",
    weapon = "lowReady",
    movementDirection = "SE",
    aimDirection = "SE",
  } = request;
  const pairKey = [movementDirection, aimDirection, locomotion, weapon].join(
    ":",
  );
  const pair = catalog.pairs[pairKey];
  if (pair?.quality === "verified")
    return {
      supported: true,
      kind: "registered-pair",
      pair,
      request: { ...request },
      lowerTime,
      upperTime,
    };
  if (movementDirection !== aimDirection)
    return blocked(
      "독립 이동·조준 방향의 검증된 상하체 조합 아트 없음",
      request,
    );
  if (locomotion !== "idle" && (locomotion !== "walk" || weapon !== "lowReady"))
    return blocked(
      "이동 중 무기 동작에 필요한 연결 전신/상하체 아트 없음",
      request,
    );
  const action = locomotion === "walk" ? "walk" : weapon,
    a = clipAvailability(aimDirection, action, catalog);
  if (!a.supported) return blocked(a.reason, request);
  return {
    supported: true,
    kind: "whole-body",
    bank: a.bank,
    frame: sampleClip(a.clip, locomotion === "walk" ? lowerTime : upperTime)
      .frame,
    status: a.status,
    request: { ...request },
    rotation: 0,
    flipX: false,
    weaponIntegrated: true,
    layers: [],
  };
}
const point = (p) =>
  Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
// A future upper layer includes torso + BOTH arms/hands + rifle. It is never
// a gun-only layer. Sockets must be measured by the artist, not guessed here.
export function composeRegisteredPair(pair, lower, upper, foot, displayHeight) {
  if (
    pair?.quality !== "verified" ||
    lower.kind !== "lower-body" ||
    upper.kind !== "upper-with-arms-and-weapon" ||
    upper.weaponIntegrated !== true
  )
    throw new Error("unreviewed or disconnected layered artwork");
  if (
    pair.lowerBank !== lower.bank ||
    pair.upperBank !== upper.bank ||
    pair.movementDirection !== lower.direction ||
    pair.aimDirection !== upper.direction
  )
    throw new Error("pair identity or direction mismatch");
  if (
    !Number.isFinite(lower.nativeStandingHeight) ||
    lower.nativeStandingHeight <= 0
  )
    throw new Error("invalid native scale");
  if (lower.nativeStandingHeight !== upper.nativeStandingHeight)
    throw new Error("incompatible native scale");
  for (const p of [
    lower.frame.footAnchor,
    lower.frame.sockets?.pelvis,
    upper.frame.sockets?.pelvis,
    upper.frame.sockets?.shoulder,
    upper.frame.sockets?.triggerHand,
    upper.frame.sockets?.supportHand,
    upper.frame.sockets?.stock,
    upper.frame.muzzle,
  ])
    if (!point(p)) throw new Error("missing measured attachment socket");
  const s = displayHeight / lower.nativeStandingHeight,
    root = lower.frame.footAnchor,
    seam = lower.frame.sockets.pelvis,
    join = {
      x: foot.x + (seam[0] - root[0]) * s,
      y: foot.y + (seam[1] - root[1]) * s,
    },
    up = upper.frame.sockets.pelvis;
  return {
    kind: "registered-pair",
    scale: s,
    layers: [
      {
        bank: lower.bank,
        frame: lower.frame.index,
        x: foot.x,
        y: foot.y,
        origin: [...root],
        rotation: 0,
        flipX: false,
      },
      {
        bank: upper.bank,
        frame: upper.frame.index,
        x: join.x,
        y: join.y,
        origin: [...up],
        rotation: 0,
        flipX: false,
      },
    ],
    muzzle: {
      x: join.x + (upper.frame.muzzle[0] - up[0]) * s,
      y: join.y + (upper.frame.muzzle[1] - up[1]) * s,
    },
  };
}
// Separate component clocks survive weapon changes. This is opt-in foundation
// code, NOT a replacement for LiveUSMCState. It cannot issue any battle order.
export class RiflemanIntent {
  constructor(catalog = CATALOG, initialFacing = "SE") {
    this.catalog = catalog;
    this.lowerTime = 0;
    this.upperTime = 0;
    this.weapon = "lowReady";
    this.amount = 0;
    this.transition = null;
    this.requested = {
      locomotion: "idle",
      weapon: "lowReady",
      movementDirection: initialFacing,
      aimDirection: initialFacing,
    };
    this.facing = initialFacing;
    this.turnBlocked = false;
    this.transitionMissing = null;
  }
  request(intent) {
    this.requested = { ...this.requested, ...intent };
    this.turnBlocked = this.requested.aimDirection !== this.facing;
    const desired = this.requested.weapon;
    if (!["lowReady", "aim"].includes(desired)) {
      this.transition = null;
      this.transitionMissing =
        "자세 연결 프레임 미작화; 정지 자세만 직접 보기 가능";
      return;
    }
    const target = desired === "aim" ? 1 : 0;
    if (this.transition?.to === target) return;
    if (!this.transition && this.amount === target) {
      this.weapon = desired;
      this.transitionMissing = null;
      return;
    }
    const key = target ? "lowReady:aim" : "aim:lowReady",
      edge = this.catalog.transitions[key];
    if (!edge) {
      this.transition = null;
      this.transitionMissing = "자세 연결 경로 없음";
      return;
    }
    const a = clipAvailability(
      this.requested.aimDirection,
      edge.clip,
      this.catalog,
    );
    if (!a.supported) {
      this.transition = null;
      this.transitionMissing =
        "총기 올림/내림 연결 셀 없음. 정지 그림을 연결 애니메이션으로 대신하지 않음";
      return;
    }
    this.transitionMissing = null;
    this.transition = {
      clip: edge.clip,
      from: this.amount,
      to: target,
      elapsed: 0,
      duration: clipSeconds(a.clip) * Math.abs(target - this.amount),
    };
    this.upperTime = 0;
  }
  advance(dt) {
    const t = Math.max(0, dt);
    if (this.requested.locomotion !== "idle") this.lowerTime += t;
    this.upperTime += t;
    if (this.transition) {
      const a = this.transition;
      a.elapsed = Math.min(a.duration, a.elapsed + t);
      this.amount = a.duration
        ? a.from + ((a.to - a.from) * a.elapsed) / a.duration
        : a.to;
      if (a.elapsed >= a.duration) {
        this.weapon = a.to ? "aim" : "lowReady";
        this.transition = null;
        this.upperTime = 0;
      }
    }
    return this.plan();
  }
  plan() {
    if (this.turnBlocked)
      return blocked(
        "방향 전환·상하체 연결 프레임 미작화; 기존 렌더러 유지 필요",
        this.requested,
      );
    if (this.transitionMissing)
      return blocked(this.transitionMissing, this.requested);
    const weapon = this.transition?.clip ?? this.requested.weapon;
    let upper = this.upperTime;
    if (this.transition) {
      const a = clipAvailability(
        this.requested.aimDirection,
        weapon,
        this.catalog,
      );
      if (a.supported)
        upper =
          clipSeconds(a.clip) *
          (this.transition.to ? this.amount : 1 - this.amount);
    }
    return {
      ...resolveRequest(
        { ...this.requested, weapon },
        this.lowerTime,
        upper,
        this.catalog,
      ),
      clocks: { locomotion: this.lowerTime, handling: this.upperTime },
      transition: this.transition ? { ...this.transition } : null,
    };
  }
}
