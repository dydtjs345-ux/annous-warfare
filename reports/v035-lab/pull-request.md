This adds a reusable, quality-gated rifleman animation foundation and an in-game mobile laboratory while preserving the v0.3.4 live renderer. Eight direction identifiers, independent movement/aim requests and component clocks, measured layer-pair contracts, authored handling/turn contracts, exact stepping, slow motion and SE-reference comparisons are available.

**The finished eight-direction animated rifleman is not delivered.** Existing SE animation remains a prototype. New E artwork provides four detailed static stances. A separately authored four-key E walk failed the motion gate and stays excluded from normal playback/live combat; only an explicit watermarked rejection-review URL can inspect it. Six other views have no new art. The first-set matrix records 0 finished, 10 prototype, 45 missing and 1 rejected cell. No rotated/mirrored substitutes or detached weapon layers fill the gaps.

Validation:
- 290 tests pass (274 existing + 16 new grouped tests); production build passes.
- 40 paired complete replays / 80 executions match main b381e60 tick hashes exactly.
- 39 existing JS modules and corrected SE PNG/metadata remain byte-identical. AI, combat, pathfinding, medical systems and original live animation behavior are unchanged.
- Mobile Chromium: lab controls, scrolling, both orientations, modal pause restoration and selection pass. Existing live selection, camera, scales, inspector, preview, speeds and restart regression checks pass.
- Physical iPhone Safari remains unverified. Motion art and fine pixel/kit/contact cleanup still need dedicated artist work.

Confirmed lab defects fixed: stale-width sprite positions after orientation changes, nonlooping frame-step wrap and looping scrubber phase. The original browser regression's close-button locator is scoped to its dialog now that two dialogs exist.

[Full audit, matrix and artist handoff](https://github.com/dydtjs345-ux/annous-warfare/blob/feat/v035-rifleman-animation-foundation/reports/v035-rifleman-animation-foundation.md)

[SE reference playback](https://github.com/dydtjs345-ux/annous-warfare/blob/feat/v035-rifleman-animation-foundation/reports/v035-lab/se-connected.mp4) · [Rejected E walking review](https://github.com/dydtjs345-ux/annous-warfare/blob/feat/v035-rifleman-animation-foundation/reports/v035-lab/e-keys-rejected-review.mp4)

Review code and artwork separately. No automatic merge or live promotion of unfinished art.
