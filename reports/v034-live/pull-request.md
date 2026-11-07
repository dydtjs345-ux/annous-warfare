The corrected v0.3.3 SE atlas previously appeared only in the animation preview; actual combat still drew v0.3.1. USMC rifleman id 1 now defaults to v0.3.3 Animated during compatible SE movement and engagements. A read-only adapter maps real target acquisition, traveled distance, aim deadlines and shot events to connected full-body walking, raising, aiming, recoil and lowering cels.

The atlas is never rotated or mirrored. Other directions, independent strafing/aiming and unsupported low-cover/special actions retain stable legacy rendering, with actual renderer/frame and fallback reasons in the Korean inspector and opt-in debug overlay. Existing scale controls and v0.3.1 comparison remain available. No tactical AI, combat calculations, pathfinding or artwork changed.

Validation:
- 274 automated tests pass, including 16 new grouped animation/integration tests.
- Production build passes; existing vendor chunk-size warning remains.
- 40 paired complete replays (80 executions) exactly match main e68ba18 tick hashes.
- 36 existing JavaScript modules outside the two rendering integration points remain byte-identical; corrected PNG/metadata also unchanged.
- Mobile Chromium: selection, Korean inspection/scroll, pan/pinch, portrait/landscape, renderer/scale controls, pause/restart and 1x/2x/4x pass. Physical iPhone Safari remains unverified.

Real, unmodified AI-controlled battles are recorded, including first contact, connected recoil, all four lowering cels, and return to SE walking after engagement/fallback. Remaining limits are fixed-direction angular quantization, inherited atlas imperfections and visible style transitions to legacy rendering. No other directions or unsupported action art is presented as complete.

[Audit, supported states, exact screenshots, replay hashes and Safari checklist](https://github.com/dydtjs345-ux/annous-warfare/blob/feat/v034-live-combat-animation/reports/v034-live-combat-animation.md)

[First contact recording](https://github.com/dydtjs345-ux/annous-warfare/blob/feat/v034-live-combat-animation/reports/v034-live/first-contact.mp4) · [Combat and movement resumption](https://github.com/dydtjs345-ux/annous-warfare/blob/feat/v034-live-combat-animation/reports/v034-live/contact-and-resume.mp4) · [Complete lowering](https://github.com/dydtjs345-ux/annous-warfare/blob/feat/v034-live-combat-animation/reports/v034-live/complete-lower.mp4)

Review only; do not merge automatically.
