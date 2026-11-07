# v0.3.5 — rifleman animation foundation

Branch: `feat/v035-rifleman-animation-foundation`

Baseline: **`b381e60`**, latest main at start, containing merged v0.3.4.

The reusable foundation and mobile laboratory work. **The requested finished
eight-direction animated rifleman is not achieved.** Existing SE motion is
retained as a reference prototype; E has four new static prototype stances and
one rejected walking-key experiment. Six views have no new artwork. Available
image-authoring tools produced detailed candidate images, but not a sufficiently
consistent, fully contact-authored motion set. Dedicated pixel-animation work
remains necessary. Tests are not treated as artistic approval.

## Existing artwork audit

[Detailed asset audit and rejected candidates](v035-asset-audit.md).

The corrected v0.3.3 SE bank is reused **unchanged**: 1024×1536 RGBA, 24 complete
256×256 human/weapon cels, native standing height 201px, foot root `(132,247)` and
per-cel muzzle/bounds. Its low-ready idle, eight-step gait, four-cell raise,
shouldered aim, recoil and four-cell lower provide the strongest available
animated reference. It has no dedicated high-ready pose or measured independent
pelvis/hand/stock sockets. Kit variation and imperfect weight transfer remain.

The older eight-view v0.3.1 assets remain the stable live fallback; they are not
renamed as finished detailed foundation art. The v0.3.4 actual-shot adapter,
direction hysteresis, interpolation, scale controls and inspector stay intact.

## Artwork authored and quality gates

Only **E** was attempted. No other new direction was batch-generated.

1. An initial four-stance candidate retained the frontal SE perspective. It was
   rejected before motion expansion. [Rejected source](v035-art-review/e-first-rejected.png).
2. A corrected true-right-profile candidate established four distinct static
   whole-body poses: idle carry, low-ready, high-ready and shouldered aim. It
   preserves a detailed desert uniform, helmet, vest/pouches, radio/backpack,
   gloves, boots and fixed-stock M16 silhouette. Both hands and the rifle are
   baked with the torso. It remains **static prototype art**, not a completed
   animation or final pixel-art master.
3. A separately authored four-key walking experiment was inspected in actual
   Phaser playback. It is **rejected from normal playback**. Four held keys
   produce abrupt stance changes; kit/texture variation remains; contact/pass
   in-betweens and a verified planted-foot/root-motion curve are absent. Sole
   bounds vary by up to four native pixels. No stretching, smoothing or weapon
   rotation hides these defects. Expansion stops after this failed motion gate.

The new PNGs are original purpose-authored candidates using our SE character as
design reference. They are not crops of the supplied conceptual illustration.
Original generated files were preserved; committed PNGs are copied unchanged.
No procedural geometric replacement figures were created.

The E source is 1254×1254, four 627×627 cells. Solid alpha bounds were measured;
common root `(293,598)`, native standing envelope 581. Uniform scaling gives
39px; head lowering in the aim pose is preserved. The static sole envelope varies
by one native pixel. Walking review deliberately retains the same master scale
and registration to expose inconsistencies. Fine grip/stock/joint sockets and
foot contacts are **unannotated**, rather than invented.

| Gate | Result / remaining work |
| --- | --- |
| Anatomy/view | E profile is distinct; static anatomy is plausible but not finally approved |
| Equipment | Detailed kit retained; exact pouch/M16/texture continuity still needs artist cleanup |
| Grounding | Roots and bounds measured; continuous contact/weight-transfer curves are not verified |
| Hands/rifle | One complete image, no detached rotating gun; fine attachment annotations still needed for layers |
| Transitions | SE inherited prototype edges available; E raise/lower/turn/start/stop art missing |
| 39px/4× readability | Reviewed in desktop/mobile captures; fine pixel clusters require dedicated cleanup |
| Motion admission | E walking candidate fails; not used by default lab or live combat |

## Completion matrix

**P** = prototype; **M** = missing usable art; **R** = rejected motion candidate.
There are **0 finished**, **10 prototype**, **45 missing**, **1 rejected** cells
across the first seven actions. **No full directional animation set is finished.**

| Action | N | NE | E | SE | S | SW | W | NW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Idle / breathing | M | M | P¹ | P² | M | M | M | M |
| Low-ready | M | M | P | P | M | M | M | M |
| High-ready | M | M | P | M | M | M | M | M |
| Raise rifle | M | M | M | P | M | M | M | M |
| Shouldered aim | M | M | P | P | M | M | M | M |
| Lower rifle | M | M | M | P | M | M | M | M |
| Basic walking | M | M | R | P | M | M | M | M |

¹ E idle is **one held stance**, with no breathing frames. All four E P cells
are static pictures, not connected motion. ² SE idle reuses four existing
low-ready cels; precise breathing acting is not recertified. SE aim is one cell.

New full-body running, tactical movement, strafing, backing up, reload, crouch,
lean, prone, injury and death animation sets remain missing. Existing SE live
recoil and existing legacy special-state/injury presentation still function;
those are not newly completed eight-direction foundation sets.

## Architecture

- `catalog.js`: immutable eight-direction inventory, per-action capability and
  quality status. Wrong-view bank registration is rejected. No rotation or
  mirroring substitutes a missing view. `autoAdmitToCombat` is false.
- `clock.js`: pure lab clip sampling, connected SE reference sequence, exact cel
  stepping, pause/seek/speed and loop-phase scrubbing. Missing E sequences cannot
  stitch static pictures together to impersonate movement.
- `rig.js`: separate locomotion/weapon clocks and persistent requested movement
  and aim directions. Whole-body cels are used where available. Independent
  directions or moving-aim combinations require an explicit verified pair;
  unsupported combinations return their real blocker.
- Registered layers must contain lower body and **entire upper torso, both arms,
  hands and weapon**, with a common measured pelvis seam and compatible native
  scale. Required shoulder/stock/trigger/support-hand/muzzle sockets are checked.
  Gun-only layers, wrong directions/banks, absent sockets and unreviewed pairs are
  refused. No production layer pairs currently exist.
- Handling uses authored raise/lower edges; reversal preserves visual progress.
  E static aim does not imply a raise. Verified whole-body turn edges can be
  consumed when authored; currently **zero** turn edges exist. Missing or
  interrupted unpainted turns require fallback, with an explicit presentation
  resynchronization API. Unit-test turn/pair fixtures test contracts, not artwork.
- `review.js`: explicit rejected-candidate sandbox. Its E walking pose remains
  `supported: false`, `status: rejected`, `admitted: false` while an opt-in
  `renderable` flag permits inspection. It never enters the normal capability
  set or live renderer. Reference SE is compared at the same gait-cycle phase.

These modules import no combat simulation or AI and draw no simulation RNG.
They do not replace the v0.3.4 live adapter. Future animation work needs real
frames, contact curves, compatible pairings and authored transition mappings;
the existence of a state name does not mean that animation exists.

## Mobile animation laboratory

Open **8방향 연구실**, or `rifleman-lab.html` under Vite's Pages base path.
It provides all eight direction choices, seven action choices, connected SE
reference playback, actual 30/39/45px sizes, 4× inspection, 0.1×/0.25×/0.5× slow
motion, 1×/2×/4×, pause, scrub, exact frame stepping and ground/bounds guides.
Missing directions stay empty with an explanation. E high-ready is compared
against an explicitly labeled low-ready SE reference because SE high-ready does
not exist. Narrow-screen magnified views stack; actual-size views stay paired.

The Korean matrix distinguishes prototypes, missing and rejected art. An
independent movement/aim readiness inspector reports actual capability failures.
The explicit `?review=e-walk-keys` link shows a red unaccepted-art warning,
locks the candidate direction/action and cannot promote the bank. Normal E walk
selection remains empty.

The in-game modal pauses the battle and restores its exact prior pause state and
selection on close. The original SE preview remains available. Iframes are
removed on closing. Cached PNG banks and four reusable images avoid per-frame
texture generation; no independent weapon object exists. Default lab texture
banks occupy about 12 MiB decoded RGBA, excluding Phaser/browser/the paused
battle's existing allocations. The review bank is loaded only in explicit review
mode. No new runtime dependency or external image request was introduced.

## Screenshots and actual playback

All captures use the production Phaser build, real PNGs and native controls.
These videos are **laboratory playback**, not new live-combat animations.

| Evidence | What it actually demonstrates |
| --- | --- |
| [SE connected sequence MP4](v035-lab/se-connected.mp4), 10.03s | Existing idle → walk → stop → raise → aim → lower → idle through the new lab clock |
| [SE 0.25× gait MP4](v035-lab/se-walk-slow.mp4), 4.77s | All eight existing walking cels, actual-size and 4× comparison |
| [Rejected E 0.25× walking-key MP4](v035-lab/e-keys-rejected-review.mp4), 4.77s | Four new keys, coarseness/continuity defects and explicit rejection watermark; **not a completed gait** |

[E idle](v035-lab/E-idle.png) · [E low-ready](v035-lab/E-lowReady.png) ·
[E high-ready](v035-lab/E-highReady.png) · [E aim](v035-lab/E-aim.png) ·
[E walk rejected in normal mode](v035-lab/E-walk.png) · [Missing N](v035-lab/N-aim.png).

[SE walk](v035-lab/SE-walk.png) · [SE raise](v035-lab/SE-raise.png) ·
[SE aim](v035-lab/SE-aim.png) · [SE lower](v035-lab/SE-lower.png).
Rejected keys: [1](v035-lab/E-rejected-key-1.png), [2](v035-lab/E-rejected-key-2.png),
[3](v035-lab/E-rejected-key-3.png), [4](v035-lab/E-rejected-key-4.png).

Frame-by-frame review checked body/weapon connectivity, anatomy, repeated gait
keys, ground/root registration and kit changes. Reference playback observed all
21 cels used by the first set, including all eight walking and four raising and
lowering cels. This confirms playback coverage, **not finished artistic quality**.
[Capture records](v035-lab/visual-evidence.json) ·
[Actual per-frame samples](v035-lab/playback-samples.jsonl).

## Verification and defects corrected

- Final **`npm test`: 290 passed, 0 failed** — 274 existing plus 16 new grouped tests.
- `npm run build`: passed; pre-existing large Phaser/common-chunk warning remains.
- `check-v035-parity.mjs`: **40 paired complete replays / 80 executions** exactly
  match main `b381e60`. Twenty legacy and twenty expanded seeds 2001–2020; variant
  `(seed-2001)%4`, expanded spawn `floor((seed-2001)/16)%3`, expanded grenades on.
- Per-tick digests include RNG, outcome/time, health by body part, ammo, movement,
  facing, suppression, assignments, cover/mounting, medical treatment, routes,
  navigation, progress/activity, squad/search and grenade statistics. Foundation
  clocks/rig requests and original renderers/effects/inspection run on the updated
  side. **Zero divergences and no paired-run timeouts**. Duration ranges remain
  exactly 38.95–196.85s legacy and 61.50–186.40s expanded.
- **39 existing JS modules** other than the two UI integration files remain
  byte-identical, including all AI/combat/world/navigation/medical/grenade code,
  interpolation and the entire v0.3.4 live renderer. Corrected SE PNG and metadata
  also have identical SHA-256 values. No battlefield renderer selection changes.
- `verify-v035.mjs` validates source/asset hashes, matrix boundaries, actual
  recording states, rejection flags, frame counts, bounds, zero rotation/mirroring,
  test totals, replay cohort and both browser reports.

Confirmed fixes made during validation:

1. **Orientation clipping**: recursive Phaser height resizing reused the previous
   cached width. The canvas narrowed after rotation while anchors retained
   landscape x-coordinates. Geometry now derives from current DOM content width,
   rechecks width after height changes, and has a pure layout regression plus
   repeated mobile orientation checks.
2. **Nonlooping frame-step endpoint**: stepping after a finished raise could wrap
   the phase calculation. Completed nonlooping clips now hold their last cel.
3. **Loop scrubber**: a looping clip could show a pinned end-time thumb while its
   cels looped. The scrubber now follows actual local playback phase.
4. **QA close-button ambiguity**: adding a second modal exposed an unscoped old
   browser locator. The existing regression now targets the original SE dialog's
   close button explicitly; assertions were preserved. An environment override
   allows testing the same suite at port 4235.

New tests also cover catalog completeness, real PNG dimensions/bounds, static
versus motion distinction, missing E/N refusal, pause/speed/seek, interrupted
handling, direction/combination refusals, measured layer seams and invalid pairs,
verified-turn contracts/fallback resync, rejected-review isolation and no combat
mutation/RNG consumption. None certify pixel-art quality.

[Replay hashes](v035-parity.json) · [Validation / source hashes](v035-lab/validation.json).

## Mobile results and limitations

Chromium 155, touch emulation, **390×844** and **844×390**:
direction/action selection, 39px/4× bounds, scrolling over the canvas inside the
iframe, exact stepping, scales, missing/rejected views, Korean labels, pairing
failure reasons, modal lifecycle, prior pause restoration and retained soldier
selection passed. Three extra lab open/close cycles removed their iframes.
Original live mobile tests also pass selection including the enlarged helmet,
prototype controls, inspector scrolling, pinch/pan, orientations, 1×/2×/4×,
preview and five restarts with cache cleanup.

Final five-second **lab 4×** sample: 300 RAF intervals, P50 **16.7ms**, P95
**16.7ms**, maximum **16.8ms**. Live-battle regression sample during concurrent
cloud QA: 290 intervals, P50 **16.7ms**, P95 **16.8ms**, maximum **50ms**. These
are desktop Chromium observations, not physical iPhone performance or a
long-duration memory profile.

[In-game mobile lab](v035-lab/mobile-in-game-lab.png) ·
[Mobile E inspection](v035-lab/mobile-E-highReady.png) · [Lab results](v035-lab/mobile.json) ·
[Unchanged live inspection](v035-live-regression/mobile-inspector.png) ·
[Live mobile results](v035-live-regression/mobile.json).

**Physical iPhone Safari is unverified.** Other remaining limits: no finished
directional set, no registered production upper/lower pairs or turn clips, no
accepted E motion, unresolved pixel/kit/contact cleanup and inherited SE gait
imperfections. Live legacy/new-style transitions retain their v0.3.4 behavior.
Available image-authoring tools have not met the final anatomical/temporal
animation standard. Do not interpret the functioning laboratory as completion
of that artwork requirement.

## Artist handoff and manual iPhone checklist

[Detailed artist delivery contract](../public/assets/rifleman-foundation-v035/README.md).
Finish one view before expanding. Prioritize a contact-authored E or refined SE
gait, clear hip/knee/ankle phases and weight transfer, stable kit/M16 geometry,
real breathing, coherent raise/lower/high-ready edges and start/stop poses.
Supply measured foot/joint/grip/stock/muzzle sockets, native scale, per-frame
registration, pair permissions and interruption/turn correspondence. Review
each stage at 39px and 4× before admitting it.

On a physical iPhone:

1. Build this branch and serve `dist` at the existing `/annous-warfare/` base.
   Open **8방향 연구실**; verify the battle pauses and resumes its prior state.
2. Compare SE and E at 39px and 4×, in both orientations. Scroll over the canvas
   and matrix. Inspect head/vest/boots, pouches, both grips and ground alignment.
3. Step every SE walk/raise/lower cel, use 0.1×/0.25×, scrub, pause and restart.
   Verify E stills never impersonate breathing or a connected raise.
4. Select missing views and E walk: normal mode must stay empty with the real
   reason. Open the rejected-key link only to inspect defects; it must remain
   watermarked and excluded from normal/live rendering.
5. Close/reopen repeatedly, test the original SE preview, camera pan/pinch,
   soldier selection, Korean inspector, scale controls and 1×/2×/4× live playback.
   Watch for WebGL/context restoration, thermal slowdown and long-session memory.
6. Review the art itself. Tests passing is not approval to expand or replace live
   sprites. Record specific foot/kit/pose defects for the artist.

## Reproduction and delivery

`npm test` and `npm run build` require no new dependencies. Serve with
`npm run preview -- --port 4235`. With Playwright, Chromium and FFmpeg installed,
`bash scripts/evidence-v035.sh` repeats browser captures, recordings and mobile
checks. Set `AW_PLAYWRIGHT_MODULE` for externally installed QA tooling.

Archive baseline `src`, `package.json` and `public/assets/usmc-se-v033` from
`b381e60` into `/tmp/aw-v035-base`, then run `node scripts/check-v035-parity.mjs`.
Save the full test log to `/tmp/aw-v035-tests-final.log` and run
`node scripts/verify-v035.mjs` to regenerate the validation summary.

Milestones: **`6f7df3c`** asset audit / initial contracts / static E prototype;
**`8a174b1`** mobile lab, rejection review, verified pairing/turn contracts,
orientation fix and regression checks; **`3f71902`** visual evidence, completion
matrix and combat-parity results.

Changed areas: `src/rifleman/` (catalog, clocks, rig, layout, lab and rejection
review), `rifleman-lab.html`, the existing modal helper and main UI binding,
`index.html`, dialog CSS, Vite's extra page entry, package version/test command,
`test/rifleman-foundation.test.js`, new E/review PNG+JSON assets, QA scripts,
README and reports. No gameplay or original live animation asset files changed.

Review comparison:
https://github.com/dydtjs345-ux/annous-warfare/compare/main...feat/v035-rifleman-animation-foundation

No merge or main/Pages deployment is performed.

The branch was pushed successfully. A GitHub REST PR-creation request returned
`Forbidden`, so no PR was created. The comparison URL above and
[prepared PR description](v035-lab/pull-request.md) are ready for review.
