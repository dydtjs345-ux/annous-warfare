# v0.3.2 — USMC SE connected-body animation prototype

Branch: **feat/v032-usmc-animation-prototype**. Foundation: **c6cc07e**, the preserved v0.3.1 work. A final fetch confirmed its tree is identical to latest main **5626262**, the PR #18 merge; no rebase or discarded work was needed. New direction: **SE only**. No other seven-direction conversion, no automatic merge, no change to the existing battle renderer.

**Status: functional visual prototype for review; the reference-quality artwork requirement is NOT satisfied yet.** The new complete-body cels are substantially more detailed than the old geometric rig, but generated cloth/gear varies between frames, gait/footwork and transition polish still need a dedicated sprite artist. Tests cannot certify those qualities. Further directions and battle integration wait for visual approval.

## Open and inspect

From the game, tap **SE 동작 보기**. The battle pauses while the modal is open; closing restores its previous pause state. The old v0.3.1 battle visuals and tactical inspector remain unchanged. The preview can also be opened directly at `/annous-warfare/animation-preview.html` on a branch build.

Choose a single phase or the continuous **idle → walk → stop → raise → aim → fire → lower → idle** demonstration. It lasts **11.44 seconds** per loop. Pause, step individual cels, scrub time, slow to 0.5×, or use 1×/2×/4×. Game-scale choices are 30/39/45px (1.0×/1.3×/1.5×), with an additional 2×/4×/6× camera view. The top comparison renders both new and v0.3.1 figures at the same game-scale height. The default is **39px** and 4× magnification.

### Actual captures

- **[Complete MP4 sequence](v032-se-sequence.mp4)** · **[GIF preview](v032-se-sequence.gif)**
- [Idle / low-ready](v032-idle.png)
- [Walking](v032-walk.png) · [eight consecutive walking cels](v032-walk-cels.png)
- [Raising the rifle](v032-raise.png) · [all four raise cels](v032-raise-cels.png)
- [Settled aim](v032-aim.png)
- [Firing](v032-fire.png) · [recoil/recovery cels](v032-fire-cels.png)
- [Returning to low-ready](v032-lower.png) · [all four lower cels](v032-lower-cels.png)
- [Mobile preview](v032-mobile-preview.png) · [game after closing preview](v032-game-after-preview.png)

These are actual production-build Chromium renders, selected through the preview's phase buttons/time slider. The strips are unretouched browser screenshot regions tiled for frame-by-frame review. They are not cropped poses from the supplied concept sheet. `v032-frames.json` records held phase times, frame numbers and view transforms. The MP4 is a real CDP screencast; GIF is a reduced 12fps derivative. This is an explicitly scripted animation demonstration, **not a recording of new animation running in autonomous combat**.

## Confirmed v0.3.1 cause and chosen architecture

`SoldierPrototype` independently selected lower-body frames, kept a fairly static torso octant, and rotated the rifle continuously while extending two sleeve/forearm pieces to the moving grips. That made a mathematically attached rig appear mannequin-like, especially when the gun turned while the torso did not. Scaling or recoloring those parts would preserve that problem.

The new figure has **one complete body cel** at a time: helmet, head, torso, shoulders, both arms/hands, pouches, backpack, legs, boots and rifle are drawn together. Runtime changes only the frame, uniform scale and the whole figure's ground position. There is no separate gun sprite, independent weapon rotation, IK limb extension, runtime limb scaling or invented human made from simple shapes. The actual-size and magnified views share the same cel, origin and phase. The old renderer is retained beside them to expose the difference.

This deliberately prioritizes physical connection over continuous free-angle aiming. It is **not yet a battle renderer**: it cannot display arbitrary aiming directions or all gameplay states. Only the independent SE preview consumes the new atlas. The existing game still uses its current v0.3.1 renderer, real shot events, aiming/perception, damage, injuries, medic and movement systems.

## Original assets and registration

`public/assets/usmc-se-v032/source-atlas.png` is a newly generated original transparent RGBA image, **1024×1536**, 4 columns × 6 rows of **256×256** logical cells. The user's concept image guided the direction/design; none of its illustrated poses were cropped, traced into cells, or reused as an atlas. A second original generation pass corrected a boot reaching the first candidate's cell boundary and improved gutters. The refined PNG is committed unchanged. Metadata was written after inspecting its alpha/bounds; Python did not redraw it into geometric parts.

| Raw atlas row | Complete body poses |
|---|---|
| 0 | Four low-ready / idle cels |
| 1–2 | Eight walking cels |
| 3 | Four rifle-raise cels |
| 4 | Settled aim, subtle recoil and recovery |
| 5 | Four rifle-lower cels |

All frames use the root/foot registration **(132,241)**. Upright design span is approximately **200px**, rendered at 39px by default. Small in-cel pose movement is retained; roots do not follow arbitrary sprite bounding-box centers. Barrel-tip annotations place brief demonstration flashes at the actual drawn muzzle. There are no baked muzzle flashes. The source includes helmet/strap, desert digital camouflage, carrier/pouches, backpack, boots and an M16A4-style fixed-stock silhouette. Exact equipment reconstruction and issued-pattern authenticity are not certified.

Raw atlas memory is **6,291,456 RGBA bytes**, shared by both new-figure images. The preview additionally loads the old assets for comparison. This is a temporary second Phaser context in an iframe; it is created on demand and removed on close, not a per-frame texture generator. The static asset requires no runtime image-generation service, backend or new npm dependency. Nearest sampling and rounded render positions preserve crisp display edges; this does not turn the source's fine illustration-like microtexture into finished hand-authored pixel art.

## Sequences and timing

- **Walking:** eight whole-body poses, approximately one cycle per second, with alternating legs and small shoulder/torso/kit changes. The preview uses a camera-tracked ground illustration. It is not a physically calibrated root-motion/plant-lock system; do not infer precise foot-contact accuracy from it.
- **Raise:** four connected poses over 0.64s. Hands/elbows raise together, stock approaches the shoulder, upper body settles into aim. No independently rotated gun.
- **Aim/fire:** a held shouldered cel plus recoil/recovery cels. Two demonstration cues during the continuous sequence; no game ammunition, weapon interval or damage changes. A bounded 50ms visual latch preserves short cues that a 4× render could skip. It does not create extra shots. The flash is a small pixel cluster, not the oversized flat disc found in early review.
- **Lower:** four connected poses over 0.7s. Arms and stock lower together and finish at low-ready. Nonlooping raise/lower hold their final pose instead of restarting abruptly.
- **Inspection controls:** stepping does not skip the brief recoil cels, a held aim does not invent a new frame, pause freezes the complete pose/effects, and scrubbing derives ground travel from the same clock rather than accumulated wall time.

`SEPreviewClock` is a pure visual clock with no Battle/AI imports. `usmc-se-preview.js` draws its frames. Main-game integration passes only modal pause/restore callbacks; it never passes a Battle object to the preview. Vite builds a separate HTML entry with the existing Pages base `/annous-warfare/`. The existing simulation/update loop is byte-identical to the foundation.

## Visual review: what passed and what remains partial

| Criterion | Observation |
|---|---|
| Rifle/hands/shoulders remain connected | Working: complete cels contain all parts; no independent transforms can pull them apart. Raise/lower strips show the stock and arms changing together. |
| Natural upper-body participation | Improved but not final: shoulders/torso/kit change with cels instead of a frozen torso and free gun. At 39px the smallest changes are subtle. |
| Walking | Prototype: visible alternating poses, body-height and kit changes; some bent-knee poses look too jog-like and cloth/gear shifts between cels. Artist retiming/cleanup and true planted-foot calibration remain necessary. |
| Aim/fire/lower | Working connected sequence, but only a few cels. Some silhouette/texture changes are not clean production in-betweens. Recoil is intentionally restrained and easier to inspect enlarged. |
| Registration / clipping | Fixed logical cells and pivots; no opaque silhouette reaches a cell border in the retained candidate. No detached limbs, old-weapon overlay or cut-off boot was observed in the final captures. |
| Direction / weapon projection | Fixed SE character candidate only. Accurate arbitrary gameplay aiming and additional directions are deferred, not faked by rotating this whole character. |
| Reference art quality | **Not satisfied.** Generated detail is more convincing than v0.3.1, but temporal consistency and authored military pixel-art finish need dedicated artwork. |

Important corrections made during review:

1. Rejected the first candidate's insufficient walking-foot gutter and refined the source before integration.
2. Replaced the old torso/independent rifle mechanism for the new preview figure with complete cels.
3. Kept a stable registered root through all frame changes; did not use per-frame auto-centering.
4. Stopped completed raise/lower clips from snapping back to their first pose.
5. Made single-frame aim stepping hold still and made recoil stepping visit the short cels.
6. Derived preview ground travel from pose time so seek/pause/speed changes cannot accumulate floor drift. Exact physical foot-lock remains unfinished.
7. Preserved demonstration firing cues across skipped 4× render cels and reduced the overlarge circular flash found in the first captures.
8. Disabled canvas pointer capture in the preview so native mobile vertical scrolling works. This changes no battlefield touch handler.
9. Closing removes the preview iframe and restores both previously running and previously paused battles. Three repeated opens/closes were checked.

These findings come from actual phase screenshots, every walk/raise/recoil/lower cel, mobile renders and the captured complete sequence. Passing tests alone was not treated as visual approval.

## Tests and deterministic compatibility

The full suite passes **255 tests, zero failures**: 247 inherited + 8 new grouped tests. The new tests cover atlas/registration data, ordered demo phases and shot count, pause/speed grouping, terminal pose holds, recoil/aim stepping, no flashes in non-fire clips, deterministic camera-tracked travel, and preserving shot cues across 1×/2×/4× renders. Build succeeds, with Vite's existing large-chunk advisory. Pages base and deployment workflow are retained.

`check-v032-parity.mjs` compares **c6cc07e** against this branch for legacy and expanded maps, seeds **2001–2020** on each, dt **0.05s**, layout=(seed−2001)%4, spawn=floor((seed−2001)/16)%3, expanded grenades enabled. It exercises the existing render/inspection helpers plus the new pure preview clock alongside one side of the comparison. It hashes every tick's RNG, outcome/time, navigation/movement/progress, health/ammo/reserve, suppression, tactical assignments, posture/mount/treatment, activity, grenade and squad state.

**40/40 paired configurations match: 80 complete combat executions, zero divergences/timeouts.** The inherited 40 replay digests also match the v0.3.1 dataset. Existing simulation, AI, perception, geometry, medic, grenade, injury, posture and rendering modules are byte-identical; only main's modal UI callback is added. The update/step loop remains identical. The old 200-case archive was not separately rerun; no claim of extra unrecorded matches.

| Simulated duration | v0.3.1 baseline | v0.3.2 | Difference |
|---|---:|---:|---:|
| Legacy median | 70.55s | 70.55s | 0 |
| Legacy P95 / maximum | 162.10 / 196.85s | 162.10 / 196.85s | 0 |
| Expanded median | 92.30s | 92.30s | 0 |
| Expanded P95 / maximum | 159.95 / 186.40s | 159.95 / 186.40s | 0 |

P95 is nearest rank over 20 cases per map; median is the midpoint of the two central durations. Outcomes, ammunition, injuries, treatments, navigation and replay digests match exactly. No tactical/AI performance improvement is claimed. A spectator opening the preview intentionally pauses wall-clock battle progress, just as pressing pause does.

## Mobile and performance observations

Production Chromium checks cover 390×844 portrait and 844×390 landscape, individual phases, frame-step/scrub, 1.5× size plus 6× magnification, native vertical touch scroll (including over the canvas), no horizontal overflow, modal close/cleanup and battle pause restoration. The existing game checks pass soldier/head selection, Korean inspector expansion/scroll/close, camera pan/pinch, both old art banks, 1×/2×/4× and pause/restart/cache cleanup. No page errors or failed asset requests in preview checks.

Desktop recording traverses all nine demo stages and all 24 source cels at 1×, with full-cycle checks at 2× and 4×. Each cycle records exactly two preview shot cues and visible flashes at every speed. The recording is an animation demo, not an additional complete combat simulation.

| Short emulated-mobile 4× sample | Intervals | P50 | P95 | Max |
|---|---:|---:|---:|---:|
| SE preview, battle paused behind it | 301 | 16.7ms | 16.7ms | 16.8ms |
| Existing game | 299 | 16.7ms | 16.7ms | 33.4ms |

These are five-second desktop Chromium RAF samples, not GPU timing or physical phone benchmarks. They do not establish a long-term memory plateau, Safari thermal behavior or battery performance. Two WebGL contexts and the original comparison assets add temporary preview memory; removal/repeated opening was checked, not profiled on a real iPhone. The source atlas loads only on opening the preview.

**Physical iPhone Safari is unverified.** Manual checklist:

1. Open the reviewed branch build; tap **SE 동작 보기**. Compare new/old at 39px and 45px before magnifying.
2. Watch the whole sequence at 1×, then 0.5× and frame-step every walking/raising/recoil/lowering cel. Judge shoulder motion, hand contact, stock placement, natural leg phases and texture flicker.
3. Compare 2×/4×/6× camera views; examine crispness and any clipped barrel/boot. Do not approve just because a larger image looks detailed.
4. Scroll vertically over the canvas and controls, rotate the phone, close the dialog from any scroll position. Check that an already paused battle stays paused and a running one resumes.
5. Verify original selection, Korean inspector, pan/pinch, focus, restart and all battle speeds after closing. Background/resume Safari and repeat preview opens while monitoring heat/memory.
6. Visually approve or request artist cleanup of **SE only** before any additional direction or battle-renderer replacement.

## Files, milestones and reproduction

- Assets: `public/assets/usmc-se-v032/{source-atlas.png,metadata.json,README.md}`.
- New preview: `animation-preview.html`, `src/usmc-se-animation.js`, `src/usmc-se-preview.js`, `src/usmc-se-preview.css`, `src/animation-preview-dialog.js`.
- Game entry/UI: `index.html`, `src/main.js`, `src/style.css`, `vite.config.js`, `package.json`, `package-lock.json`, `README.md`.
- Regression/evidence: `test/usmc-se-animation.test.js`, `scripts/{capture-v032,record-v032,mobile-v032-preview,mobile-v032-game,check-v032-parity,verify-v032}.mjs`, `scripts/evidence-v032.sh`, this report and the `reports/v032-*` logs/data/captures.
- **391fac2** — M1: original SE cel candidate, registration and pure connected-pose clock; focused tests and initial visual review.
- **b1b7b54** — M2: isolated Phaser preview, comparison controls, modal lifecycle and mobile-safe UI; browser review/phase corrections.
- **18a4769** — M3: final suite/build, deterministic comparison, complete recording/contact sheets, mobile validation and audit.

```sh
npm install
npm test
npm run build
npm run preview -- --port 4232
# Open /annous-warfare/ and tap SE 동작 보기.
# Or open /annous-warfare/animation-preview.html directly.
# With Playwright and /usr/bin/chromium available, from another terminal:
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/capture-v032.mjs
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/record-v032.mjs
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/mobile-v032-preview.mjs
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/mobile-v032-game.mjs
bash scripts/evidence-v032.sh # ffmpeg/ffprobe; tile actual capture regions and encode video
mkdir -p /tmp/aw-v032-base
git archive c6cc07e src package.json | tar -x -C /tmp/aw-v032-base
node scripts/check-v032-parity.mjs /tmp/aw-v032-base
node scripts/verify-v032.mjs /tmp/aw-v032-base
```

Feature-branch pushes do not deploy production Pages. No merge is authorized. This candidate is provided for visual approval with the unfinished art/gait quality explicitly exposed.


## Delivery status

The branch was pushed. An attempted draft PR returned `Post "https://api.github.com/graphql": Forbidden`; no PR was created or merged. The exact prepared body is [v032-pull-request.md](v032-pull-request.md). The reviewed implementation/evidence milestone is **18a4769**; the final documentation commit records this delivery status without changing the tested code.

- [Prepared comparison against main](https://github.com/dydtjs345-ux/annous-warfare/compare/main...feat/v032-usmc-animation-prototype?expand=1)
- [Stable v0.3.1-to-v0.3.2 review](https://github.com/dydtjs345-ux/annous-warfare/compare/c6cc07e...feat/v032-usmc-animation-prototype)

Only SE is provided. Artwork/gait finish remains open for visual review; no other directions or in-battle replacement will proceed before approval.
