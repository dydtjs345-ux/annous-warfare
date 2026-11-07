// Shared by the Phaser laboratory and its public, standalone SVG mirror.
// Presentation only: uses the original PNG frame inventories, never Battle/RNG.
import { FoundationClock, sampleClip, clipSeconds } from "./clock.js";
import { WALK_REVIEW } from "./review.js";
export class WalkComparisonClock extends FoundationClock {
  constructor() {
    super();
    this.direction = "E";
    this.action = "walk";
  }
  select(action) {
    return action === "walk";
  }
  setDirection(direction) {
    return direction === "E";
  }
  referencePose() {
    const local =
      ((this.time % this.total()) / this.total()) *
      clipSeconds(WALK_REVIEW.clip);
    return {
      ...sampleClip(WALK_REVIEW.clip, local),
      direction: "E",
      action: "walk",
      local,
      stage: -1,
      bank: WALK_REVIEW.bank,
      count: 4,
      status: "rejected",
      reason: WALK_REVIEW.reason,
      supported: false,
      renderable: true,
      reviewOnly: true,
      admitted: false,
    };
  }
  snapshot() {
    return {
      ...super.snapshot(),
      comparison: true,
      reference: this.referencePose(),
      liveCombatAdmission: false,
    };
  }
}
