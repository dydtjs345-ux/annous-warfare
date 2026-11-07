// Artwork inventory, not a list of promised capabilities. Live admission needs
// explicit per-clip and per-sheet approval; lab prototypes cannot grant it.
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
  fire: "사격 / 반동",
});
export const FUTURE_ACTIONS = Object.freeze({
  run: "달리기",
  tactical: "경계 이동",
  strafe: "옆걸음",
  backpedal: "뒷걸음",
  reload: "재장전",
  crouch: "웅크리기",
  lean: "기울여 보기",
  prone: "엎드림 / 포복",
  hit: "피격 반응",
  death: "사망",
});
export const STATUS_KO = Object.freeze({
  prototype: "PROTOTYPE · 시제품",
  missing: "MISSING · 미작화",
  verified: "COMPLETE · 완료",
  rejected: "REJECTED · 미채택",
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
    eWalk2: {
      direction: "E",
      image: "assets/rifleman-foundation-v035/production/e-walk-v2.png",
      metadata: "assets/rifleman-foundation-v035/production/e-walk-v2.json",
      grid: [4, 2],
      frameSize: [384, 512],
      nativeStandingHeight: 459,
      kind: "whole-body",
      weaponIntegrated: true,
    },
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
    eHandling: {
      direction: "E",
      image: "assets/rifleman-foundation-v035/production/e-handling.png",
      metadata: "assets/rifleman-foundation-v035/production/e-handling.json",
      grid: [4, 2],
      frameSize: [384, 512],
      nativeStandingHeight: 459,
      kind: "whole-body",
      weaponIntegrated: true,
    },
    eQuiet: {
      direction: "E",
      image: "assets/rifleman-foundation-v035/production/e-quiet.png",
      metadata: "assets/rifleman-foundation-v035/production/e-quiet.json",
      grid: [4, 2],
      frameSize: [384, 512],
      nativeStandingHeight: 459,
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
              fire: prototype(
                "fire",
                "기존 SE 실제 반동 셀. 새 방향 작화와 구분.",
              ),
            },
          }
        : d === "E"
          ? {
              status: "prototype",
              bank: "eHandling",
              note: "E 정지·총기 조작 7동작 완료. 보행은 접지·좌우 다리 연속성 미검증 시제품; E 전체 세트는 미완성.",
              clips: {
                idle: {
                  bank: "eQuiet",
                  frames: [0, 1, 2, 3],
                  durations: [0.8, 0.8, 0.8, 0.8],
                  loop: true,
                  status: "verified",
                  liveApproved: true,
                  note: "새 전신 호흡 4셀. 39px/4× 연속·셀별 검토 완료; 양발 접지, 미세 어깨 호흡.",
                },
                lowReady: {
                  bank: "eQuiet",
                  frames: [0],
                  durations: [1],
                  loop: true,
                  status: "verified",
                  liveApproved: true,
                  note: "호흡 세트의 낮은 준비 0번 셀. 양손이 총기를 함께 지지.",
                },
                highReady: {
                  bank: "eQuiet",
                  frames: [4, 5, 6, 7],
                  durations: [0.8, 0.8, 0.8, 0.8],
                  loop: true,
                  status: "verified",
                  liveApproved: true,
                  note: "높은 준비 4셀. 양손·어깨·총기가 함께 유지됨. 낮은 준비와의 연결 작화는 별도 미완성.",
                },
                raise: {
                  bank: "eHandling",
                  frames: [0, 1, 2, 3],
                  durations: [0.15, 0.17, 0.17, 0.2],
                  status: "verified",
                  liveApproved: true,
                  note: "4셀 전신 올림. 셀별 발 기준 등록으로 32px 전체 인물 배치 차이 제거. 양손·개머리판·어깨 연결 검토 완료.",
                },
                aim: {
                  bank: "eHandling",
                  frames: [4],
                  durations: [0.8],
                  loop: true,
                  status: "verified",
                  liveApproved: true,
                  note: "발을 고정한 견착. 총구 방향 E 전용; 다른 방향으로 그림을 돌리지 않음.",
                },
                lower: {
                  bank: "eHandling",
                  frames: [3, 2, 1, 0],
                  durations: [0.18, 0.18, 0.17, 0.17],
                  status: "verified",
                  liveApproved: true,
                  note: "4셀 올림 경로의 역재생 내림. 별도 신규 셀로 중복 집계하지 않음.",
                },
                fire: {
                  bank: "eHandling",
                  frames: [5, 6, 7, 4],
                  durations: [0.055, 0.065, 0.1, 0.48],
                  loop: true,
                  status: "verified",
                  liveApproved: true,
                  note: "전신 반동 3셀과 견착 복귀 1셀. 연구실은 시연 루프; 전투에서는 실제 shot 이벤트에만 반응.",
                },
                walk: {
                  bank: "eWalk2",
                  frames: [0, 1, 2, 3, 4, 5, 6, 7],
                  durations: [
                    0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125,
                  ],
                  loop: true,
                  status: "prototype",
                  note: "8셀 보행 시제품: 앞다리 반복·높은 무릎·접지 곡선·시작/정지 연결이 미달. 전투에 사용 안 함. 이전 거부작은 별도 링크에 보존.",
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
  const bank = c?.bank ?? d?.bank;
  if (!bank)
    return {
      supported: false,
      status: "missing",
      reason: d?.note ?? "방향 그림 없음",
    };
  if (catalog.banks[bank]?.direction !== direction)
    return {
      supported: false,
      status: "missing",
      reason: "등록 방향과 그림 방향이 다름. 회전·반전 대체 불가",
    };
  if (
    catalog.banks[bank].kind !== "whole-body" ||
    catalog.banks[bank].weaponIntegrated !== true
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
    bank,
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
