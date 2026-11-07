# v0.3.5 asset audit

Base: `b381e60` (main, merged v0.3.4). Existing working tree was clean;
v0.3.4 commits and corrected v0.3.3 images are preserved.

| Asset | Layout / registration | Reusable material | Limitation |
| --- | --- | --- | --- |
| Corrected SE v0.3.3 | 1024×1536 RGBA; 4×6 cells of 256×256; native height 201; foot `(132,247)` | Detailed integrated human, hands and M16; 0–3 low-ready idle, 4–11 walk, 12–15 raise, 16 aim, 17–19 recoil, 20–23 lower | One view; no separate high-ready stance; gait/gear/transition cleanup remains |
| SE metadata | Solid alpha bounds, foot and muzzle per cel | Ground alignment, uniform 39px scale, flash registration | No measured pelvis/shoulder/hand/stock sockets or foot-contact labels for independently composable layers |
| v0.3.4 live adapter | Read-only actual AI/target/shot adapter; single full-body image | Real shot timing, SE hysteresis, posture/direction fallback, bounded event origins | Strict SE sector; unsupported crouch/reload/strafe uses legacy; style pop on changes |
| v0.3.1 / v0.3.0 | Eight directional lower-body and torso sheets, separate weapon/arms | Stable fallback and old comparison | Not the approved detailed full-body style; cannot relabel as completed new eight-direction artwork |
| Existing SE preview | Phaser, playback controls, same-height comparisons | Art reference and geometry conventions | Isolated SE only; no admission matrix, new upper/lower pairing contract or missing-direction inspection |

The entire SE PNG and metadata stay byte-identical. We do not cut this body into
guessed upper/lower layers, warp anatomy, rotate it to fake another direction, or
mirror asymmetric kit. Existing full-body cels remain the strongest available
animated reference; they are not recertified as finished biomechanics.

## First new direction: E, inspected before any animation expansion

Two original image-authoring passes attempted four aligned stances of the same
character. This is not a crop of the supplied illustrated reference sheet.

1. [First candidate](v035-art-review/e-first-rejected.png): rejected. It retained
   the frontal SE view, had inconsistent spacing, and did not establish E.
2. [Revised E static candidate](../public/assets/rifleman-foundation-v035/e-static-prototype.png):
   clearer right profile, coherent vest/backpack placement and four actual
   whole-body poses. This is **static prototype artwork only**. It is not approved
   for live use or temporally consistent animation. Different stance art can be
   inspected; no walking/raising/lowering is synthesized between those images.

The revised source is exactly 1254×1254, with four 627×627 cells. Solid alpha
bounds were measured, not guessed; standing envelope 581 and common ground root
`(293,598)`. Aim lowers the head slightly, so its solid height is not stretched to
match the idle silhouette. Fine grip/stock/joint sockets and foot-contact phases
remain explicitly unannotated. Uniform render scaling preserves each cell.

Quality status: E anatomy/view/equipment can be compared at 39px and 4×, but
pixel-cluster cleanup, exact M16/equipment continuity, contact authoring and motion
require dedicated artwork review. Passing data validation is not artistic approval.

3. A [four-key E walking test](../public/assets/rifleman-foundation-v035/review/e-walk-keys.png)
   was authored separately from the four static poses. Actual 0.25× Phaser
   playback was reviewed frame by frame at 39px and 4×. It is **rejected for normal
   playback**: four held keys show abrupt stance jumps, equipment/texture changes
   remain visible, and there is no verified planted-foot/root-motion curve or
   complete contact/pass interpolation. The source sole bounds also vary by up
   to 4 native pixels. No per-frame vertical stretching or smoothing hides this.
   The explicit `?review=e-walk-keys` laboratory mode is a rejection review,
   watermarked as unaccepted. Its four cels are not advertised as a finished gait
   or used by the default lab/live renderer. No further E motion or other
   directions are generated after this failed motion gate.

## Completion boundary

Six existing SE prototype actions; four new E **static** prototype stances;
one rejected E walking test; **zero finished new directional animation sets**.
SE high-ready, usable E motion and all N/NE/S/SW/W/NW art are missing. The first
seven-action matrix records 0 finished, 10 prototype, 45 missing and 1 rejected
cell. The lab and completion matrix must say so.
The registered upper/lower pipeline can accept measured artist-authored pairs;
there are currently no production pairs. Live v0.3.4 remains unchanged.
