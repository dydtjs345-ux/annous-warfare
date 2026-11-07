// Artwork inventory, not a list of promised capabilities. Live combat does not
// import this module; admission requires real authored frames and visual review.
import { CLIPS } from "../usmc-se-animation.js";
export const DIRECTIONS = Object.freeze([
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
]);
export const ACTIONS = Object.freeze({
  idle: "대기 / 호흡",
  lowReady: "낮은 준비",
  highReady: "높은 준비",
  raise: "총기 올림",
  aim: "견착 조준",
  lower: "총기 내림",
  walk: "기본 보행",
});
export const FUTURE_ACTIONS = Object.freeze({
  run: "달리기",
  tactical: "경계 이동",
  strafe: "옆걸음",
  backpedal: "뒷걸음",
  fire: "사격 / 반동",
  reload: "재장전",
  crouch: "웅크리기",
  lean: "기울여 보기",
  prone: "엎드림 / 포복",
  hit: "피격 반응",
  death: "사망",
});
export const STATUS_KO = Object.freeze({
  prototype: "시제품",
  missing: "아트 없음",
  verified: "검증 완료",
  rejected: "품질 기준 미달",
});
const freeze = (obj) => {
  for (const v of Object.values(obj)) if (v && typeof v === "object") freeze(v);
  return Object.freeze(obj);
};
const prototype = (name, note) => ({
  ...CLIPS[name],
  frames: [...CLIPS[name].frames],
  durations: [...CLIPS[name].durations],
  status: "prototype",
  note,
});
export const CATALOG = freeze({
  schema: 1,
  character: "usmc-rifleman-master",
  autoAdmitToCombat: false,
  banks: {
    e035: {
      direction: "E",
      image: "assets/rifleman-foundation-v035/e-static-prototype.png",
      metadata: "assets/rifleman-foundation-v035/e-static-prototype.json",
      grid: [2, 2],
      frameSize: [627, 627],
      nativeStandingHeight: 581,
      kind: "whole-body",
      weaponIntegrated: true,
    },
    se033: {
      direction: "SE",
      image: "assets/usmc-se-v033/source-atlas.png",
      metadata: "assets/usmc-se-v033/metadata.json",
      grid: [4, 6],
      frameSize: [256, 256],
      nativeStandingHeight: 201,
      kind: "whole-body",
      weaponIntegrated: true,
    },
  },
  directions: Object.fromEntries(
    DIRECTIONS.map((d) => [
      d,
      d === "SE"
        ? {
            status: "prototype",
            bank: "se033",
            note: "기존 SE 기준 그림. 발 무게 이동·장비 일관성·연결 동작은 추가 작화 검토 필요.",
            clips: {
              idle: prototype(
                "idle",
                "기존 낮은 준비 4셀. 정밀 호흡 연기는 검증되지 않음.",
              ),
              lowReady: {
                frames: [0],
                durations: [1],
                loop: true,
                status: "prototype",
                note: "대기와 같은 기존 그림. 별도 편안한 대기 자세는 미작화.",
              },
              highReady: {
                status: "missing",
                note: "총기 올림 중간 셀을 높은 준비 자세로 위장하지 않음.",
              },
              raise: prototype(
                "raise",
                "기존 4셀. 양손·어깨·총기가 한 그림에 포함됨.",
              ),
              aim: prototype(
                "aim",
                "기존 단일 견착 셀. 조준 호흡 반복 작화는 없음.",
              ),
              lower: prototype(
                "lower",
                "기존 4셀. 정밀 역방향 연결은 작화 검토 필요.",
              ),
              walk: prototype(
                "walk",
                "기존 8셀. 정확한 접지·체중 이동은 시제품 수준.",
              ),
            },
          }
        : d === "E"
          ? {
              status: "prototype",
              bank: "e035",
              note: "새 E 정지 자세 시제품. 동작 연속성·호흡·보행은 미작화. 전투 사용 안 함.",
              clips: {
                ...Object.fromEntries(
                  ["idle", "lowReady", "highReady", "aim"].map((action, i) => [
                    action,
                    {
                      frames: [i],
                      durations: [1],
                      loop: true,
                      status: "prototype",
                      note:
                        action === "idle"
                          ? "E 정지 그림 1셀. 호흡 움직임 없음."
                          : "E 정지 자세 1셀. 연결 동작 없음; 연구실에서만 검토.",
                    },
                  ]),
                ),
                walk: {
                  status: "rejected",
                  note: "4개 보행 키 후보는 접지·연결·장비 일관성 검증 미달. 기본 재생에서 제외.",
                },
              },
            }
          : {
              status: "missing",
              bank: null,
              note: `${d} 전용 그림이 없음. SE 회전·좌우 반전으로 대신하지 않음.`,
              clips: {},
            },
    ]),
  ),
  // Edges use authored cels, never a rotating rifle or cross-faded limbs.
  transitions: {
    "lowReady:aim": { clip: "raise", reverse: "lower" },
    "aim:lowReady": { clip: "lower", reverse: "raise" },
  },
  turns: {}, // No turn cels exist. Runtime callers must retain their fallback.
  pairs: {}, // No independently composable upper/lower artwork has passed review.
});
export function clipAvailability(direction, action, catalog = CATALOG) {
  if (!DIRECTIONS.includes(direction))
    return { supported: false, status: "missing", reason: "방향 식별자 오류" };
  const d = catalog.directions[direction],
    c = d?.clips[action];
  if (!d?.bank)
    return {
      supported: false,
      status: "missing",
      reason: d?.note ?? "방향 그림 없음",
    };
  if (catalog.banks[d.bank]?.direction !== direction)
    return {
      supported: false,
      status: "missing",
      reason: "등록 방향과 그림 방향이 다름. 회전·반전 대체 불가",
    };
  if (
    catalog.banks[d.bank].kind !== "whole-body" ||
    catalog.banks[d.bank].weaponIntegrated !== true
  )
    return {
      supported: false,
      status: "missing",
      reason: "양손·어깨·총기가 결합된 전신 그림이 아님",
    };
  if (!c?.frames?.length)
    return {
      supported: false,
      status: c?.status === "rejected" ? "rejected" : "missing",
      reason:
        c?.note ??
        `${ACTIONS[action] ?? FUTURE_ACTIONS[action] ?? "해당 동작"} 그림 없음`,
    };
  return {
    supported: true,
    status: c.status,
    reason: c.note,
    bank: d.bank,
    clip: c,
  };
}
export function completionMatrix(catalog = CATALOG) {
  return Object.entries(ACTIONS).map(([action, label]) => ({
    action,
    label,
    directions: Object.fromEntries(
      DIRECTIONS.map((d) => [d, clipAvailability(d, action, catalog).status]),
    ),
  }));
}
export function assertClip(clip, frameCount) {
  if (!clip?.frames?.length || clip.frames.length !== clip.durations?.length)
    throw new Error("frame/duration count mismatch");
  if (clip.frames.some((f) => !Number.isInteger(f) || f < 0 || f >= frameCount))
    throw new Error("frame outside atlas");
  if (clip.durations.some((d) => !Number.isFinite(d) || d <= 0))
    throw new Error("invalid frame duration");
  return true;
}
