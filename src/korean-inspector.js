// Presentation-only localization: unknown explanations are never invented.
export const NO_REASON = "판단 근거 기록 없음";
const pairs = {
  Leader: "분대장",
  Rifleman: "소총수",
  LMG: "경기관총수",
  Medic: "의무병",
  Engaging: "교전 중",
  Aiming: "조준 중",
  Reloading: "재장전 중",
  Treating: "치료 중",
  "Moving to casualty": "부상자에게 이동",
  "Seeking cover": "엄폐물로 이동",
  Flanking: "측방 기동",
  Pinned: "제압됨",
  Regrouping: "재집결",
  "Full cover": "완전 엄폐",
  "Suppressing last-known": "마지막 목격 지점에 제압사격",
  "Awaiting covering fire": "지원사격 대기",
  "Covering crossing": "도로 횡단 지원",
  "Evading grenade": "수류탄 회피",
  "Preparing grenade": "수류탄 투척 준비",
  "Searching district": "구역 수색",
  "Following search element": "수색조 추종",
  "Covering search": "수색조 엄호",
  "Awaiting coordination": "분대 조정 대기",
  "Reacquiring contact": "적 재탐색",
  "Observing contact": "적 접촉 관측",
  "Holding contact": "접촉 유지",
  "Deploying LMG": "기관총 거치 준비",
  "Unmounting LMG": "기관총 거치 해제",
  Incapacitated: "전투 불능",
  Dead: "사망",
  full: "완전 엄폐",
  peek: "짧게 노출",
  sustained: "지속 사격 자세",
  mounted: "거치 완료",
  deploying: "거치 중",
  unmounting: "거치 해제 중",
  unsupported: "비거치",
  support: "지원사격",
  maneuver: "기동조",
  "care / local security": "치료 / 근거리 경계",
  search: "수색",
  escort: "수색조 엄호",
  recon: "정찰",
  overwatch: "감시 엄호",
  none: "없음",
  "personal decision": "개인 판단",
  "squad leader": "분대장",
  "immediate threat": "즉각적 위협",
  "direct sighting": "직접 목격",
  "shared sighting": "무전 공유 목격",
  "last-known position": "마지막 목격 위치",
  "incoming-fire bearing": "추정 피탄 방향",
  SEARCH: "수색",
  CONTACT: "접촉",
  ENGAGE: "교전",
  LOST_CONTACT: "접촉 상실",
  REACQUIRE: "재탐색",
  SEARCH_AGAIN: "수색 재개",
  "Bounded pressure on credible last-observed firing lane":
    "신뢰 가능한 마지막 목격 사선에 제한적으로 제압사격",
  "Friendly body in remembered firing lane": "기억된 사선에 아군이 진입함",
  "Remembered-lane shot budget exhausted":
    "해당 목격 정보에 대한 사격 한도 소진",
  "Movement takes priority": "이동 임무 우선",
  "Combat ineffective": "전투 수행 불가",
  "Return behind low cover and reassess": "낮은 엄폐물 뒤로 복귀하여 재평가",
  "Brief deliberate exposure to engage": "교전을 위해 잠시 노출",
  "Maintain supporting firing lane": "지원사격 사선 유지",
  "Reload protected by aligned cover": "위협 방향의 엄폐를 이용해 재장전",
  "Recover under heavy pressure": "강한 제압을 피해 회복",
  "No credible aligned low-cover threat":
    "낮은 엄폐물 방향에 유효한 알려진 위협 없음",
  "Known unprotected flank requires a combat response":
    "알려진 측방 위협에 대응 필요",
  "Uninterrupted treatment within reach and line of sight":
    "시야와 치료 거리가 확보되어 치료 지속",
  "Approaching a reachable casualty": "접근 가능한 부상자에게 이동",
  "Maintaining a visible firing solution":
    "직접 보이는 적에 대한 사격 기회 유지",
  "Acquiring a directly visible target": "직접 보이는 표적 조준",
  "Reloading individual weapon": "개인 화기 재장전",
  "Incoming pressure makes exposure unsafe": "적 제압사격으로 노출 위험 증가",
  "Medic reserved for survival and actionable casualty care":
    "생존과 실행 가능한 치료를 위해 의무병 대기",
  "Cover the assigned recon approach": "배정된 정찰 접근로 엄호",
  "Support and follow the squad search element": "분대 수색조 추종 및 지원",
  "Reaction delay before new assignment": "새 임무에 반응하기 전 대기",
  "Recon element has movement priority": "정찰조 이동 우선",
  "Reachable observation lane": "접근 가능한 관측 지점",
  "No recent shot from assigned support element":
    "배정된 지원조의 최근 사격 없음",
  "Maintain pressure for assigned maneuver":
    "배정된 기동조를 위해 사격 압력 유지",
  "Reach improved protected angle under squad support":
    "분대 지원 아래 보호되는 유리한 각도로 이동",
  "Observe while the current crossing element clears the road":
    "선행 횡단조가 도로를 벗어날 때까지 관측",
  "Cross in a small element; other soldiers observe":
    "소규모 조로 횡단하고 다른 병사는 관측",
  "Emergency crossing: staying at exposed entry is unsafe":
    "출발 지점이 위험하여 긴급 횡단",
  "Full cover: weapon below cover line":
    "완전 엄폐 상태로 총구가 엄폐선 아래에 있음",
  "Clear firing opportunity": "유효한 사격 기회",
  "Line of sight blocked": "사선 차단",
  "No identified visible target": "식별된 가시 표적 없음",
  "No direct line of sight to known contact": "알려진 적에 대한 직접 시야 없음",
  "Known contact outside weapon range; no direct target":
    "알려진 적이 사거리 밖이며 직접 표적 없음",
  "Weapon firing interval": "화기 사격 간격 대기",
  "Acquiring target / reaction delay": "표적 조준 / 반응 지연",
  "Magazine empty": "탄창 소진",
  "Ammunition exhausted": "탄약 소진",
  "Rear security": "후방 경계",
  "Check side approach": "측면 접근로 확인",
  "Observe route ahead": "전방 이동로 관측",
  "Follow a recently confirmed engagement snapshot":
    "최근 확인한 교전 위치 관측",
  "Soldier congestion": "병사 밀집으로 이동 차단",
  "Waiting for crossing element": "횡단조 통과 대기",
  "loose column": "느슨한 종대",
  staggered: "엇갈린 대형",
  dispersed: "분산 대형",
  "compact regroup": "밀집 재집결",
};
Object.assign(
  pairs,
  Object.fromEntries(
    `Squad movement or care assignment takes priority|분대 이동 또는 치료 임무 우선
unobserved / stale landmark; reachable unexplored street area|미관측 또는 오래된 도로 지점 중 접근 가능한 구역 수색
Survival, role or weapon-handling priority|생존·역할·화기 조작 우선
Meaningful directional protection gain; reachable route|위협 방향 방호가 실질적으로 개선되고 접근 경로가 있음
Contact too fresh for blind fire, stale or cleared|접촉 정보가 너무 새롭거나 오래되었거나 빈 위치로 확인되어 기억 사격 보류
Brief retry cooldown after completed/failed task|임무 완료 또는 실패 후 짧은 재시도 대기
Remembered lane outside weapon range|기억된 사선이 사거리 밖에 있음
Searching sector|구역 수색 중
uncertain gunfire bearing; reachable unexplored street area|불확실한 총성 방향을 참고하여 접근 가능한 미수색 도로 탐색
No eligible remembered contact|기억 사격에 적합한 접촉 정보 없음
Retain useful committed cover destination; alternative gain insufficient|다른 위치의 이득이 부족하여 유효한 기존 엄폐 목적지 유지
Confirmed cluster; friend-safe throw|직접 확인한 적 밀집과 아군 안전을 검토한 투척
No available distinct search position|다른 병사와 겹치지 않는 수색 위치 없음
Evaluate casualties before recon|정찰 전에 부상자 평가
Waiting for bounded squad reassessment|제한된 시간 동안 분대 재평가 대기
Friendly body may intersect remembered lane|아군이 기억된 사선에 들어올 수 있음
Safe intermediate approach to observation area|관측 구역으로 가는 안전한 중간 접근 지점
Remembered lane blocked by cover|엄폐물이 기억된 사선을 차단
Route exposure changed|경로의 노출 위험이 바뀜
No eligible safe investigator; reassess available roles|안전한 정찰 수행자가 없어 가용 역할 재평가
Cautious survivor reassessment: Reachable observation lane|생존자 역할을 신중히 재평가하여 접근 가능한 관측 사선 선택
Confirmed defended position; ineffective rifle fire|직접 확인한 방어 위치에 소총 사격 효과가 낮음
Deploying weapon support on a verified low-wall firing lane|확인된 낮은 엄폐물 사선에 화기 받침 전개
Evaluate reachable casualty before district search|구역 수색 전에 접근 가능한 부상자 평가
Releasing support before repositioning / changing firing lane|재배치 또는 사선 변경 전에 거치 해제
Assigned maneuver takes priority|배정된 기동 임무 우선
Reached maneuver objective|기동 목표 도착
No supporting shots during bounded recovery interval|제한된 회복 대기 동안 지원사격 없음
Maneuver soldier combat ineffective|기동 병사가 전투 수행 불가
Changed contact, pressure or physical capability|접촉·제압·신체 능력 조건이 변경됨
Covering casualty|부상자 엄호 중
Acquire visible target|가시 표적 조준
Advance|전진
Advancing|전진 중
Await observation assignment|관측 임무 대기
Awaiting update|정보 갱신 대기
Brief support establishment before maneuver|기동 전 짧은 지원사격 준비
Committed recon objective still active|진행 중인 정찰 목표 유지
Contact expired; continue committed observation approach as sector search|접촉 정보 만료 후 기존 접근을 구역 수색으로 계속
Cover crossing; retain assigned destination|배정 목적지를 유지하며 횡단 엄호
Cover nearby casualty|근처 부상자 엄호
Cover remembered lane; conserve ammunition|기억된 사선을 엄호하며 탄약 절약
Cover repositioning in progress|엄폐 위치 변경 진행 중
Cover route failed; reject destination and retain combat|엄폐 접근 실패로 목적지를 제외하고 교전 유지
Eliminated|전사
Engage visible enemy|보이는 적과 교전
Exposed flank threat|노출된 측면에 위협 발생
Hold|현 위치 유지
Holding|현 위치 유지 중
Hold for active nearby medic; immediate survival may interrupt|근처 의무병의 치료를 위해 대기하며 긴급 위험에는 대응
Hold under incoming fire|적 사격 아래 엄폐 유지
Immediate grenade survival; retain squad task|분대 임무를 보존하며 수류탄부터 회피
Improve protected firing position|보호되는 사격 위치로 개선
Injuries require a defensive role|부상으로 방어 역할 필요
Low barricade in firing direction; clear lane|사격 방향에 낮은 장애물이 있고 사선 확보됨
Maintain protection under fire|적 사격 아래 방호 유지
Maneuver canceled: supporting pressure unavailable|지원사격이 없어 기동 취소
Movement requires leaving shelter|이동을 위해 엄폐 자세 해제
Moving|이동 중
No aligned low-wall support|사격 방향에 적합한 낮은 받침 없음
No aligned shelter|위협 방향에 적합한 엄폐 없음
No direct in-range firing lane|사거리 내 직접 사선 없음
No enemy position known; explore visible street landmarks|알려진 적 위치가 없어 관측 가능한 도로 지점 탐색
No loaded ammunition|장전된 탄약 없음
No loaded ammunition for recon|장전된 탄약이 없어 정찰 불가
No net movement progress|실질적인 이동 진전 없음
Not assessed|아직 평가하지 않음
Observe and support the moving search element|이동 중인 수색조 관측 및 지원
Observe the reached search area|도착한 수색 구역 관측
Observed grounded grenade; delayed emergency response|지면의 수류탄을 발견하여 반응 지연 후 회피
Outside weapon range|화기 사거리 밖
Position inside obstacle|장애물 내부 위치
Preserve current direct firing opportunity|현재의 직접 사격 기회 유지
Protect self before assigned movement|배정된 이동보다 즉각적인 자기 방호 우선
Reached assigned observation point|배정 관측 지점 도착
Reached protected firing position|보호된 사격 위치 도착
Receiving treatment|치료받는 중
Receiving treatment; retain squad objective|분대 목표를 유지하며 치료받는 중
Recovering|회복 중
Reload|재장전
Reloading; investigator must be combat-ready|정찰 수행 전 재장전 필요
Replan blocked search route|막힌 수색 경로 재계획
Replan expired/blocked approach|만료되거나 막힌 접근로 재계획
Reposition / remount cooldown|재배치 또는 재거치 대기 시간
Repositioning required|위치 변경 필요
Shelter; reassess known threat|엄폐하며 알려진 위협 재평가
Suppression makes recon exposure unsafe|제압으로 정찰 노출이 위험함
Suppression temporarily overrides squad movement|제압으로 분대 이동을 일시 중지
Throwing grenade|수류탄 투척 중
Too suppressed to deploy|제압이 심하여 거치 불가
Treat casualty|부상자 치료
Unmounting before movement|이동 전에 거치 해제
Urgent directional protection gain overrides movement budget|긴급한 방향 방호 개선을 위해 이동 제한보다 우선
Visible target incapacitated|보이는 표적이 전투 불능
Waiting for spacing|간격 확보 대기
Watching reported sector|보고된 위협 구역 관측
Within supporting distance of assigned search element|배정 수색조의 지원 거리 내 위치
navigation failure|경로 탐색 실패`
      .split("\n")
      .map((line) => line.split("|")),
  ),
);
export const ko = (v) =>
  pairs[v] ??
  (typeof v === "string" && v.startsWith("Current action: ")
    ? `현재 행동: ${pairs[v.slice(16)] ?? NO_REASON}`
    : NO_REASON);
const seconds = (v) =>
  Number.isFinite(v) ? `${Math.max(0, v).toFixed(1)}초` : "기록 없음";
const direction = (v) =>
  Number.isFinite(v)
    ? `${(((((v * 180) / Math.PI) % 360) + 360) % 360).toFixed(0)}°`
    : "이동 없음";
const histories = new WeakMap();
export function observeDecision(u, now) {
  let h = histories.get(u);
  if (!h) {
    h = { last: new Map(), rows: [] };
    histories.set(u, h);
  }
  const facts = [
    ["행동", u.state],
    ["자세", u.posture?.mode],
    ["분대 임무", u.assignment?.type],
    ["판단", u.decisionReason],
    ["지원사격", u.suppressionTask?.reason],
  ];
  for (const [label, value] of facts) {
    if (!value || h.last.get(label) === value) continue;
    h.last.set(label, value);
    h.rows.push({ time: now, text: `${label}: ${ko(value)}` });
  }
  const c = u.diagnostics;
  if (c?.contactAge != null && c.targetId != null) {
    const key = `${c.targetId}:${now - c.contactAge}`;
    if (h.last.get("contact") !== key) {
      h.last.set("contact", key);
      const last = h.rows.at(-1);
      if (!last?.text.startsWith("적 목격") || now - last.time > 2)
        h.rows.push({
          time: now,
          text: `적 목격 정보 갱신: #${c.targetId} (${ko(c.source)})`,
        });
    }
  }
  if (h.rows.length > 18) h.rows.splice(0, h.rows.length - 18);
  return h.rows;
}
export function inspectKorean(u, now = 0, detailed = true) {
  const d = u.diagnostics,
    rows = observeDecision(u, now);
  const status = u.dead ? "사망" : !u.active ? "전투 불능" : "생존";
  const base = `병사 #${u.id} · ${u.team === 0 ? "미 해병대" : "러시아 보병"} · ${ko(u.role)} · ${status}\n행동: ${ko(u.state)} · ${seconds(d?.stateTime)}\n판단 근거: ${ko(u.decisionReason)}\n엄폐 자세: ${ko(u.posture?.mode)} · ${ko(u.posture?.reason)}`;
  if (!detailed) return base;
  const health = Object.entries(u.health)
    .map(
      ([p, h]) =>
        `${{ head: "머리", torso: "몸통", "left arm": "왼팔", "right arm": "오른팔", "left leg": "왼다리", "right leg": "오른다리" }[p]} ${Math.ceil(h)}%${h < 100 ? " (부상)" : ""}`,
    )
    .join(" · ");
  const a = u.activity;
  return (
    base +
    `\n분대 임무: ${ko(u.assignment?.type)} · ${ko(u.assignment?.reason)}\n전술 역할: ${u.tacticalRole ? ko(u.tacticalRole) : "별도 배정 없음"} · ${ko(u.fireMovementReason)}${u.fireMovementTarget ? ` · 이동 목표 ${u.fireMovementTarget.x}, ${u.fireMovementTarget.y}` : ""}\n이동 목표: ${u.assignment?.target ? `${u.assignment.target.x}, ${u.assignment.target.y}` : "배정 없음"}\n건강: ${health}\n탄약: ${u.ammo} / 예비 ${u.reserve} · 재장전 ${seconds(u.reload)}\n제압: ${Math.round(u.suppression * 100)}%\n최근 확인 접촉: ${d?.targetId != null ? `적 #${d.targetId}` : "신원 확인 없음"} · ${ko(d?.source)} · ${seconds(d?.contactAge)} 전\n직접 시야: ${d?.directLOS ? "있음" : "없음"} · 사격 ${d?.firingPermitted ? "허용" : "불가"} · ${ko(d?.notFiring)}\n관측 방향: ${direction(u.observationHeading)} · 이동 방향: ${u.presentation?.moving ? direction(u.movementHeading) : `정지 (최근 ${direction(u.movementHeading)})`}\n치료: ${u.state === "Treating" ? `아군 #${u.patientId} · 이번 치료 주기 ${Math.min(100, Math.floor(u.treat * 100))}%` : "진행 중인 치료 없음"}\n기관총: ${ko(u.mount?.state)} · ${ko(u.mount?.reason)}\n제압사격: ${u.suppressionTask?.active ? "진행" : "중단 / 없음"} · ${ko(u.suppressionTask?.reason)}\n항법: ${ko(u.navigation)} · 차단: ${ko(d?.blocker)}\n최근 횡단 판단: ${u.crossingReason ? ko(u.crossingReason) + " · " + seconds(now - u.crossingAt) + " 전" : "횡단 기록 없음"}\n${a ? `활동 시간(중복 없음): 교전 ${seconds(a.engaging)} · 수색 ${seconds(a.searching)} · 이동 ${seconds(a.moving)} · 엄폐 ${seconds(a.cover)} · 치료 ${seconds(a.treating)} · 재장전 ${seconds(a.reloading)} · 관측/대기 ${seconds(a.waiting)}` : ""}\n최근 판단 기록 (관측된 전환)\n` +
    rows
      .slice()
      .reverse()
      .map((r) => `${r.time.toFixed(1)}초 · ${r.text}`)
      .join("\n")
  );
}
