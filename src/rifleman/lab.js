import Phaser from "phaser";
import {
  CATALOG,
  DIRECTIONS,
  ACTIONS,
  STATUS_KO,
  completionMatrix,
  clipAvailability,
} from "./catalog.js";
import { FoundationClock, playbackPhase } from "./clock.js";
import { resolveRequest } from "./rig.js";
import { laboratoryLayout, walkComparisonLayout } from "./lab-layout.js";
import { QualityReviewClock, WALK_REVIEW } from "./review.js";
import { WalkComparisonClock } from "./walk-comparison.js";
import "./lab.css";
const $ = (s) => document.querySelector(s),
  review =
    new URLSearchParams(location.search).get("review") === WALK_REVIEW.id,
  banks = review
    ? { se033: CATALOG.banks.se033, [WALK_REVIEW.bank]: WALK_REVIEW.asset }
    : Object.fromEntries(
        [
          ...new Set(
            Object.values(CATALOG.directions).flatMap((d) =>
              Object.values(d.clips)
                .filter((c) => c.frames)
                .map((c) => c.bank ?? d.bank),
            ),
          ),
        ]
          .map((id) => [id, CATALOG.banks[id]])
          .concat([[WALK_REVIEW.bank, WALK_REVIEW.asset]]),
      );
let comparing =
    !review && new URLSearchParams(location.search).get("compare") === "e-walk",
  clock = review
    ? new QualityReviewClock()
    : comparing
      ? new WalkComparisonClock()
      : new FoundationClock(),
  standardClock = new FoundationClock();
const addOption = (select, value, text) => {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = text;
  select.append(o);
};
const pArtApproved = (p) =>
  clipAvailability(p.direction, p.action).clip?.liveApproved === true;
for (const d of DIRECTIONS) {
  for (const selector of ["#lab-direction", "#rig-move", "#rig-aim"])
    addOption($(selector), d, d);
}
for (const selector of ["#lab-direction", "#rig-move", "#rig-aim"])
  $(selector).value = "SE";
addOption($("#lab-action"), "sequence", "연결 순서 · 보행은 시제품");
for (const [action, label] of Object.entries(ACTIONS))
  addOption($("#lab-action"), action, label);
if (review) {
  $("#lab-direction").value = "E";
  $("#lab-action").value = "walk";
  $("#lab-direction").disabled = true;
  $("#lab-action").disabled = true;
  $("#lab-review-warning").hidden = false;
  $("#lab-review-warning").textContent = WALK_REVIEW.reason;
  $("#lab-view-note").textContent =
    "미채택 E 보행 4키 후보를 실제 크기와 4×로 검토합니다. 기본 재생·완료 세트·실제 전투에는 포함하지 않습니다. 오른쪽은 기존 SE 8셀을 같은 순환 위상으로 대조한 것입니다. 연결·접지·장비 변화가 남아 있어 완성 동작이 아닙니다.";
}
const originalNote = $("#lab-view-note").textContent;
$("#lab-e-sheet").src = import.meta.env.BASE_URL + CATALOG.banks.e035.image;
const matrix = completionMatrix();
const heading = document.createElement("tr");
for (const text of ["동작", ...DIRECTIONS]) {
  const e = document.createElement("th");
  e.textContent = text;
  heading.append(e);
}
$("#lab-matrix thead").append(heading);
for (const row of matrix) {
  const tr = document.createElement("tr"),
    label = document.createElement("th");
  label.textContent = row.label;
  tr.append(label);
  for (const d of DIRECTIONS) {
    const td = document.createElement("td"),
      a = clipAvailability(d, row.action);
    td.dataset.status = a.status;
    td.textContent = STATUS_KO[a.status];
    td.title = a.reason;
    tr.append(td);
  }
  $("#lab-matrix tbody").append(tr);
}
const statuses = matrix.flatMap((r) => Object.values(r.directions));
$("#lab-matrix-summary").textContent =
  `COMPLETE ${statuses.filter((s) => s === "verified").length} / PROTOTYPE ${statuses.filter((s) => s === "prototype").length} / MISSING ${statuses.filter((s) => s === "missing").length} / REJECTED ${statuses.filter((s) => s === "rejected").length}. E 정지·총기 조작 7동작 완료 / 신규 승인 16셀. E 보행은 PROTOTYPE, 이전 4키 보행은 REJECTED로 보존. 새 완성 방향 세트는 아직 0입니다.`;
const stage = $("#lab-stage");
class RiflemanLab extends Phaser.Scene {
  preload() {
    for (const [bank, d] of Object.entries(banks)) {
      this.load.spritesheet(bank, import.meta.env.BASE_URL + d.image, {
        frameWidth: d.frameSize[0],
        frameHeight: d.frameSize[1],
        endFrame: d.grid[0] * d.grid[1] - 1,
      });
      this.load.json(bank + "-meta", import.meta.env.BASE_URL + d.metadata);
    }
    this.load.on("loaderror", (f) => {
      $("#lab-error").hidden = false;
      $("#lab-error").textContent = "그림을 불러오지 못했습니다: " + f.key;
    });
  }
  create() {
    this.size = 39;
    this.lastUI = -1;
    this.meta = Object.fromEntries(
      Object.keys(banks).map((k) => [k, this.cache.json.get(k + "-meta")]),
    );
    this.floor = this.add.graphics().setDepth(-10);
    this.guide = this.add.graphics().setDepth(10);
    const textStyle = {
      fontFamily: "system-ui,sans-serif",
      fontSize: "12px",
      color: "#bfcbce",
      align: "center",
    };
    this.views = [
      { selected: true, actual: true },
      { selected: false, actual: true },
      { selected: true, actual: false },
      { selected: false, actual: false },
    ].map((v) => ({
      ...v,
      image: this.add.image(0, 0, "__WHITE").setVisible(false),
      label: this.add.text(0, 0, "", textStyle).setOrigin(0.5),
      missing: this.add
        .text(0, 0, "", { ...textStyle, color: "#bdab8a" })
        .setOrigin(0.5),
    }));
    this.scale.on("resize", () => this.layout());
    this.observer = new ResizeObserver(() => {
      if (
        stage.clientWidth !== this.scale.width ||
        stage.clientHeight !== this.scale.height
      )
        this.scale.setParentSize(stage.clientWidth, stage.clientHeight);
    });
    this.observer.observe(stage);
    this.events.once("shutdown", () => this.observer.disconnect());
    const changed = () => {
      this.lastUI = -1;
      this.syncUI();
    };
    this.comparisonUI = () => {
      $("#lab-compare").setAttribute("aria-pressed", String(comparing));
      $("#lab-compare").disabled = review;
      $("#lab-direction").disabled = review || comparing;
      $("#lab-action").disabled = review || comparing;
      $("#lab-direction").value = clock.direction;
      $("#lab-action").value = clock.action;
      for (const id of ["#lab-direction", "#lab-action", "#lab-size"])
        $(id).closest("label").hidden = comparing;
      if (comparing) {
        this.size = 39;
        $("#lab-size").value = "39";
      }
      $("#lab-size").disabled = comparing;
      $("#walk-counters").hidden = !comparing;
      $("#lab-view-note").textContent = comparing
        ? "왼쪽: 새 8프레임 PROTOTYPE · 오른쪽: 이전 4프레임 REJECTED. 같은 1초 주기를 실제 PNG로 반복합니다. 윗줄 39px, 아랫줄 4×. 다음 프레임은 새 그림 1/8주기씩 진행하며 이전 그림은 두 번마다 바뀝니다. 어느 보행도 완료/전투용으로 승인되지 않았습니다."
        : originalNote;
      this.layout();
      changed();
    };
    $("#lab-compare").onclick = () => {
      comparing = !comparing;
      if (comparing) {
        standardClock = clock;
        clock = new WalkComparisonClock();
      } else clock = standardClock;
      const url = new URL(location.href);
      if (comparing) url.searchParams.set("compare", "e-walk");
      else url.searchParams.delete("compare");
      history.replaceState(null, "", url);
      this.comparisonUI();
    };
    $("#lab-play").onclick = () => {
      clock.playing = true;
      changed();
    };
    $("#lab-slow").onclick = () => {
      clock.speed = 0.25;
      clock.playing = true;
      $("#lab-speed").value = "0.25";
      changed();
    };
    $("#lab-direction").onchange = (e) => {
      clock.setDirection(e.target.value);
      changed();
    };
    $("#lab-action").onchange = (e) => {
      clock.select(e.target.value);
      clock.playing = true;
      changed();
    };
    $("#lab-speed").onchange = (e) => {
      clock.speed = Number(e.target.value);
      changed();
    };
    $("#lab-pause").onclick = () => {
      clock.playing = !clock.playing;
      changed();
    };
    $("#lab-step").onclick = () => {
      clock.step();
      changed();
    };
    $("#lab-restart").onclick = () => {
      clock.seek(0);
      changed();
    };
    $("#lab-time").oninput = (e) => {
      clock.playing = false;
      clock.seek(e.target.value);
      changed();
    };
    $("#lab-size").onchange = (e) => {
      this.size = Number(e.target.value);
      this.layout();
      changed();
    };
    $("#lab-anchors").onchange = () => changed();
    for (const id of ["#rig-gait", "#rig-move", "#rig-aim", "#rig-weapon"])
      $(id).onchange = () => this.probe();
    this.probe();
    this.comparisonUI();
    window.riflemanLabSnapshot = () => ({
      ...clock.snapshot(),
      reviewOnly: review,
      comparing,
      displayHeight: this.size,
      magnification: 4,
      reference: this.referencePose(),
      completion: completionMatrix(),
      probe: this.probePlan,
      independentWeaponObjects: 0,
      liveCombatAdmission: false,
      liveApprovedClip: !review && pArtApproved(clock.pose()),
      stacked: this.stacked,
      canvas: { width: this.scale.width, height: this.scale.height },
      views: this.views.map((v) => ({
        selected: v.selected,
        actual: v.actual,
        visible: v.image.visible,
        bank: v.pose?.bank ?? null,
        action: v.pose?.action ?? null,
        frame: v.image.visible ? Number(v.image.frame.name) : null,
        scale: v.image.scaleX,
        scaleY: v.image.scaleY,
        rotation: v.image.rotation,
        flipX: v.image.flipX,
        x: v.image.x,
        y: v.image.y,
        originX: v.image.originX,
        originY: v.image.originY,
        bounds: v.bounds ? { ...v.bounds } : null,
      })),
    });
  }
  probe() {
    const request = {
      locomotion: $("#rig-gait").value,
      weapon: $("#rig-weapon").value,
      movementDirection: $("#rig-move").value,
      aimDirection: $("#rig-aim").value,
    };
    this.probePlan = resolveRequest(request, 0, 0);
    $("#rig-result").textContent = this.probePlan.supported
      ? `표현 가능: ${this.probePlan.kind === "whole-body" ? "등록된 전신 그림" : "검증된 상하체 쌍"} · ${STATUS_KO[this.probePlan.status] ?? "검증된 쌍"}\n실제 전투 적용은 별도입니다.`
      : `표현 불가: ${this.probePlan.reason}\n실제 병사의 이동·조준 방향은 바꾸지 않고 기존 렌더러를 유지해야 합니다.`;
  }
  referencePose() {
    if (comparing) return clock.referencePose();
    const p = clock.pose("SE");
    return p.supported
      ? p
      : {
          ...p,
          ...clipAvailability("SE", "lowReady"),
          action: "lowReady",
          bank: "se033",
          frame: 0,
          count: 1,
          index: 0,
          reason: "선택 동작의 SE 아트 없음; 낮은 준비 기준 그림만 표시",
        };
  }
  layout() {
    const {
        width: w,
        stacked,
        height,
        points,
      } = (comparing ? walkComparisonLayout : laboratoryLayout)(
        stage.clientWidth,
        this.size,
      ),
      h = this.size * 4;
    this.stacked = stacked;
    if (Math.abs(stage.clientHeight - height) > 1)
      stage.style.height = height + "px";
    if (stage.clientWidth !== w) {
      this.layout();
      return;
    }
    if (
      this.scale.width !== stage.clientWidth ||
      this.scale.height !== stage.clientHeight
    ) {
      this.scale.setParentSize(stage.clientWidth, stage.clientHeight);
      // setParentSize may synchronously reenter layout while orientation changes
      // the DOM width. Never let an outer, stale layout overwrite the fresh one.
      return this.layout();
    }
    this.floor.clear();
    this.views.forEach((v, i) => {
      v.foot = points[i];
      v.label.setOrigin(0.5, comparing ? 0 : 0.5);
      v.label.setPosition(
        v.foot.x,
        v.actual ? (comparing ? 8 : 38) : v.foot.y - h - (comparing ? 56 : 32),
      );
      v.label.setWordWrapWidth(v.actual || !this.stacked ? w / 2 - 16 : w - 24);
      v.missing.setPosition(v.foot.x, v.foot.y - (v.actual ? 25 : h * 0.5));
      const r = v.actual ? 38 : comparing ? Math.min(70, w * 0.21) : 84;
      this.floor.lineStyle(1, 0x3b5058, 0.55);
      for (let j = -2; j <= 2; j++)
        this.floor.lineBetween(
          v.foot.x - r,
          v.foot.y + j * 8,
          v.foot.x + r,
          v.foot.y + j * 8,
        );
      this.floor.lineStyle(1, 0x607681, 0.55);
      this.floor.strokeEllipse(v.foot.x, v.foot.y + 1, r * 1.5, r * 0.45);
    });
    this.lastUI = -1;
  }
  syncUI() {
    const p = clock.pose();
    $("#lab-pause").textContent = clock.playing ? "일시정지" : "계속";
    $("#lab-play").disabled = clock.playing;
    $("#lab-slow").setAttribute("aria-pressed", String(clock.speed === 0.25));
    $("#lab-speed").value = String(clock.speed);
    if (comparing) {
      const old = clock.referencePose();
      $("#walk-new-counter").textContent =
        `새 보행 ${p.index + 1}/8 · PROTOTYPE`;
      $("#walk-old-counter").textContent =
        `이전 보행 ${old.index + 1}/4 · REJECTED`;
    }
    $("#lab-state").textContent =
      `${p.direction} · ${ACTIONS[p.action] ?? "연결 순서"} · ${STATUS_KO[p.status]}${p.supported || p.renderable ? ` · ${p.index + 1}/${p.count}셀` : ""}\n${p.reason}`;
    $("#lab-time").max = String(clock.total() || 1);
    $("#lab-time").value = String(playbackPhase(clock));
    for (const v of this.views) {
      const q = v.selected ? p : this.referencePose(),
        name = comparing
          ? v.selected
            ? "새 8프레임 · PROTOTYPE"
            : "이전 4프레임 · REJECTED"
          : v.selected
            ? `${clock.direction} 선택`
            : `SE 기준${q.action !== p.action ? " · 낮은 준비 참고" : ""}`;
      const text = comparing
        ? `${name}\n${v.actual ? "39px" : "4×"} · ${q.index + 1}/${q.count}`
        : `${name} · ${v.actual ? `${this.size}px` : "4×"}${v.selected && clock.direction === "E" ? ` · ${q.status === "verified" ? "COMPLETE" : review ? "REJECTED" : "PROTOTYPE"}` : ""}`;
      if (v.label.text !== text) v.label.setText(text);
      const missing =
        q.supported || q.renderable
          ? ""
          : v.selected
            ? "아트 미완성\nSE로 대체하지 않음"
            : "기준 아트 없음";
      if (v.missing.text !== missing) v.missing.setText(missing);
    }
  }
  update(_, delta) {
    if (!this.views) return;
    clock.advance(delta / 1000);
    this.guide.clear();
    for (const v of this.views) {
      const p = v.selected ? clock.pose() : this.referencePose(),
        d = this.meta[p.bank],
        f = d?.frames[p.frame];
      v.pose = p;
      v.bounds = null;
      if (
        !(
          p.supported ||
          ((review || comparing) && p.reviewOnly && p.renderable)
        ) ||
        !f ||
        !this.textures.exists(p.bank)
      ) {
        v.image.setVisible(false);
        continue;
      }
      const s = (this.size / d.nativeStandingHeight) * (v.actual ? 1 : 4),
        root = f.footAnchor;
      v.image
        .setTexture(p.bank, p.frame)
        .setOrigin(root[0] / d.frameSize[0], root[1] / d.frameSize[1])
        .setScale(s)
        .setRotation(0)
        .setFlipX(false)
        .setPosition(v.foot.x, v.foot.y)
        .setVisible(true);
      v.bounds = {
        left: v.foot.x + (f.bounds[0] - root[0]) * s,
        right: v.foot.x + (f.bounds[2] - root[0]) * s,
        top: v.foot.y + (f.bounds[1] - root[1]) * s,
        bottom: v.foot.y + (f.bounds[3] - root[1]) * s,
      };
      if ($("#lab-anchors").checked) {
        this.guide.lineStyle(1, 0x82d2c1, 0.8);
        this.guide.strokeRect(
          v.bounds.left,
          v.bounds.top,
          v.bounds.right - v.bounds.left,
          v.bounds.bottom - v.bounds.top,
        );
        this.guide.lineBetween(v.foot.x - 5, v.foot.y, v.foot.x + 5, v.foot.y);
        this.guide.lineBetween(v.foot.x, v.foot.y - 5, v.foot.x, v.foot.y + 5);
      }
    }
    if (this.time.now >= this.lastUI) {
      this.lastUI = this.time.now + 100;
      this.syncUI();
    }
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "lab-stage",
  pixelArt: true,
  antialias: false,
  backgroundColor: "#1c2b34",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: 440 },
  scene: RiflemanLab,
});
