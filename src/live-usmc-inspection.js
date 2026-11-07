import { LIVE_ANIMATION_KO, LIVE_REASON_KO } from "./live-usmc-state.js";
const RENDERERS = {
  v033: "v0.3.3 Animated",
  v031: "v0.3.1",
  v030: "v0.3.0",
  stock: "기존 기본 표현",
  offscreen: "화면 밖",
};
const LEGACY_POSES = {
  walking: "보행",
  running: "빠른 이동",
  seekingCover: "엄폐 이동",
  limping: "절뚝임",
  crawling: "기어감",
  aiming: "조준",
  firing: "사격",
  idle: "대기",
  observing: "관측",
  observingCover: "엄폐 관측",
  holdingCover: "엄폐 유지",
  suppressed: "제압 상태",
  reloading: "재장전",
  fullCover: "완전 엄폐",
  prone: "낮은 자세",
  dead: "사망",
  incapacitated: "전투 불능",
  treating: "치료",
  grenadePrep: "수류탄 준비",
  grenadeThrow: "수류탄 투척",
  deploying: "거치 준비",
  unmounting: "거치 해제",
  mounted: "거치",
  mountedFiring: "거치 사격",
};
export function liveRenderStatus({
  mode,
  enabled,
  inView,
  live,
  legacy,
  model,
}) {
  let renderer,
    animation,
    frame = null,
    reason;
  if (!inView) {
    renderer = "offscreen";
    animation = null;
    reason = "화면 밖이므로 그림 생략";
  } else if (enabled && mode === "v033" && live?.visible) {
    renderer = "v033";
    animation = live.animation;
    frame = live.frame;
    reason = LIVE_REASON_KO[live.reason];
  } else {
    renderer =
      enabled && legacy?.visible
        ? mode === "v030"
          ? "v030"
          : "v031"
        : "stock";
    animation = legacy?.visible ? legacy.pose : model?.pose;
    reason = !enabled
      ? "시제품 비교 꺼짐"
      : mode !== "v033"
        ? "선택한 기존 렌더러로 비교"
        : (LIVE_REASON_KO[live?.fallback] ?? "이 상태의 SE 자산 없음");
  }
  return {
    requested: mode,
    renderer,
    animation,
    frame,
    reason: reason ?? "판단 근거 기록 없음",
    label: RENDERERS[renderer],
  };
}
export function renderInspection(status, expanded = false) {
  if (!status) return "시각 표현: 준비 중";
  const animation =
    LIVE_ANIMATION_KO[status.animation] ??
    LEGACY_POSES[status.animation] ??
    "표시 동작 없음";
  return `시각 표현: ${status.label} · ${animation}${status.frame == null ? "" : ` (${status.frame + 1}/24)`}${expanded ? `\n시각 전환: ${status.reason}` : ""}`;
}
export function insertRenderInspection(text, status, expanded) {
  const lines = text.split("\n");
  lines.splice(1, 0, renderInspection(status, expanded));
  return lines.join("\n");
}
