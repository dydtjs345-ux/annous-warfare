// Opt-in, read-only E artwork adapter. The SE adapter remains the default.
// A capability here requires both authored cels AND a recorded art approval.
import { LiveUSMCState } from "../live-usmc-state.js";
import { clipAvailability } from "./catalog.js";
import { sampleClip, clipSeconds } from "./clock.js";
const RAD = Math.PI / 180;
export const EAST_ART = Object.freeze({
  center: 0,
  enter: 6 * RAD,
  exit: 10 * RAD,
  barrel: 0,
  aimEnter: 6 * RAD,
  aimExit: 10 * RAD,
  travelDifference: 15 * RAD,
});
const ACTION = Object.freeze({
  idle: "idle",
  walking: "walk",
  raising: "raise",
  aiming: "aim",
  firing: "fire",
  lowering: "lower",
});
export class LiveEastState extends LiveUSMCState {
  constructor() {
    super(EAST_ART, { raise: 0.69, lower: 0.7 });
  }
  update(b, u, m, view = u) {
    const state = super.update(b, u, m, view),
      action = ACTION[state.animation],
      art = clipAvailability("E", action);
    let frame = null;
    if (art.supported) {
      let time = b.time;
      if (action === "raise") time = state.amount * clipSeconds(art.clip);
      else if (action === "lower")
        time = (1 - state.amount) * clipSeconds(art.clip);
      else if (action === "fire") time = Math.max(0, b.time - state.shotAt);
      frame = sampleClip(
        action === "fire" ? { ...art.clip, loop: false } : art.clip,
        time,
      ).frame;
    }
    // A rendered prototype walk or static pose is never automatic live approval.
    const approved =
      art.status === "verified" && art.clip?.liveApproved === true;
    this.state = {
      ...state,
      action,
      direction: "E",
      bank: art.bank,
      frame,
      frameCount: art.bank ? 8 : 0,
      renderer: "v035-e",
      supported: state.supported && approved,
      fallback: state.fallback ?? (approved ? null : "eastArtwork"),
    };
    const last = this.history.at(-1);
    if (last?.time === b.time) last.frame = frame;
    return this.state;
  }
}
