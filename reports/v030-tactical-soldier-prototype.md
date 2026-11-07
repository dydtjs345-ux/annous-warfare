# v0.3.0 tactical soldier visual prototype

Base: **dec95ef**, main containing merged v0.2.9.1 (PR #17). Branch: **feat/v030-tactical-soldier-prototype**. Only **USMC rifleman #1** is eligible. The normal renderer remains the default; no global soldier enlargement or tactical changes.

## M1 — existing system reused

`Battle`/presentation-state exposes actual movement distance, firing events, reload progress, injury, suppression, treatment and tactical posture. Existing `MotionPresentation` supplies render-only position, shortest-angle heading, stance settling and action phases; `CombatVisuals` supplies the authoritative pose and actual shot direction. Those modules are byte-identical to the merged baseline. The new adapter consumes them instead of creating an animation controller that can issue orders or change combat.

Position, camera framing, world depth and normal picking remain on the existing interpolated positions. The prototype's lower-body frame uses travel direction, its upper-body frame follows the weapon/observation heading, and the rifle uses the continuous projected event angle. Korean inspection still reads the original soldier, not sprite data.

## M2 — genuine asset pipeline and proportional design

This is a new transparent-PNG layer pipeline, not a scaled copy of the old procedural humanoid. Original offline pixel construction generates `public/assets/usmc-rifleman/`: a 512×1296 RGBA atlas, Phaser frame JSON, sleeves/forearms, an independent M16A4 PNG and explicit anchor/design metadata. There are **144 frames**: eight torso directions, eight traveled-distance gait frames in eight directions for standing/crouching, and eight prone frames. No proprietary or external art is used; Python/Pillow is optional for rebuilding art and is not a runtime dependency.

The upright design span is 56 native pixels, with an eight-pixel head target: approximately **seven-head proportions**. Helmet/head, tapering torso, long articulated legs, boots, coyote vest/webbing/pouches, small backpack and original desert digital camouflage replace the old large-head silhouette. Lighting is restrained above-left. The fixed-stock rifle asset includes a receiver, magazine, rail-style handguard, exposed barrel, front sight and small optic silhouette. It is an M16A4-inspired silhouette without weapon-stat changes, not a historically certified equipment reconstruction.

The native sprite is rendered at **30px standing height for 1.0×**, 39px for 1.3× and 45px for 1.5× before camera zoom. Foot anchors stay fixed. Shoulder/hip/foot and rifle grip/muzzle anchors are documented in metadata. Rifle projection shortens its screen length when pointing toward/away from the viewer; support hand and flash/smoke anchors follow the same projected length. This fixed a visual perspective issue caught during firing-frame review.

### Art review and honest quality boundary

The prototype visibly changes anatomy, camouflage and rifle/kit silhouette. It is **not a finished production-quality military sprite**. At 1.0× many equipment pixels disappear; 1.3× gives a better evaluation balance, while 1.5× stands out beside stock soldiers. The torso is still fairly frontal in some side directions and some kit detail is schematic. Eight-direction anatomy, helmet shape, camouflage clusters, hand contact and equipment accuracy need a dedicated artist pass. The genuine atlas/layer/metadata pipeline is in place precisely so these can be replaced without rewriting simulation or animation integration. Do not present this as a final historically accurate asset or a full squad conversion.

## M3 — tactical animation and safe fallbacks

- Idle/scanning: existing smoothed headings choose torso octants; rifle holds a low-ready angle and eases to readiness on actual aim/cautious movement.
- Walking/running: eight lower-body frames advance from actual interpolated traveled distance, using travel direction independently of the upper body. No arbitrary time-driven walk in place.
- Cautious movement: the actual seeking-cover/aiming state brings the weapon ready. Existing stance settling blends lower-body stance and lowers the upper layer.
- Full cover/crawling: the compact prone asset is used; a tucked body does not display a firing weapon or muzzle flash.
- Aiming/firing: receiver and support hands are connected by two-bone arm placement. Real firing overrides low-ready offset immediately. Recoil and flashes consume actual shot effects only. Smoke/casings latch to the new rifle's muzzle/receiver instead of the old procedural weapon location.
- Reload: existing real reload progress moves the support hand toward the magazine while keeping the receiver anchored. No reload timer, ammo change or invented completion.
- Unsupported grenade/treatment/mount poses and dead/incapacitated states deliberately fall back to the existing renderer. The designated unit is a rifleman, not an LMG/medic. These prototype-specific assets are unfinished; a brief return to stock colors during fallback is a known limitation, not a claim of complete state coverage.

There is no foot IK or fully authored transition atlas. Gait and torso direction changes are sampled pixel frames; short stance crossfades and the existing interpolation reduce snapping, but perfect foot planting and all-angle anatomy are not claimed. Full concealment/firing exceptions remain immediate for truthful gameplay visualization.

## M4 — evaluation controls and actual comparisons

A compact Korean comparison row provides **시제품 #1: 켜짐/꺼짐** and **1.0× / 1.3× / 1.5×**. Enabling selects the designated rifleman for identification. Follow-camera behavior still follows its existing commander; free pan/zoom remains available. Other soldiers use the unchanged renderer. Head picking is extended only as a fallback for this evaluation sprite, keeping the selected object the actual unit. Display size never changes body separation, pathfinding, cover, targeting, perception or weapon stats.

All size comparison captures use the same paused production battlefield, seed 2049 / layout 0 / spawn 0; the capture script asserts simulation time unchanged across toggle/scale changes.

- [Existing renderer](v030-existing.png)
- [Prototype 1.0×](v030-scale-1.png) / [1.3×](v030-scale-1.3.png) / [1.5×](v030-scale-1.5.png)
- [Enlarged side-by-side actual screenshot crops](v030-comparison-detail.png)
- [Korean mobile inspector / prototype](v030-mobile-prototype.png)

## M5 — animation evidence and confirmed integration fixes

[Actual production gameplay recording](v030-prototype-gameplay.mp4), [contact sheet](v030-animation-contact.png), [consecutive firing frames](v030-firing-frames.png) and [combat still](v030-combat.png). Seed 2049/layout0/spawn0, prototype 1.3×. The recording exercises 1×/2×/4×, then uses 1× in the known real contact window to inspect weapon alignment. It does not insert shots or force poses. Capture-time-derived frame durations are retained. CDP recording overhead affects host frame rate and is not a performance benchmark.

The recording sampler initially failed to report firing even though the soldier was actually firing. Root cause: it retained a mutable render-diagnostic object whose old `visible` flag was changed when the next frame hid its image layers. A copied `snapshot()` now freezes recorded observations; a regression test reproduces this reference-lifetime error. This was an observability fix, not an AI/firing-timing change. Later firing samples pass exact projected-shot-angle checks.

[Reload frames](v030-reload-frames.png), [full-cover frames](v030-full-frames.png), [peek frames](v030-peek-frames.png) come from a labeled local-only real-Battle fixture using controlled initial positions/ammo and the production adapter. The reload starts because actual ammo is empty; no action/pose is assigned by the capture script. These fixtures are not deployed entrypoints or normal-match tactical statistics. `v030-action-frames.json` stores real model/phase snapshots.

### Deterministic tests

The paired harness compares merged v0.2.9.1 against the new branch for legacy and expanded maps, seeds **2001–2020** on each, dt **0.05s**, expanded layout=(seed−2001)%4, spawn=floor((seed−2001)/16)%3, grenades only in expanded. It runs the prototype adapter with all three display sizes, unchanged motion/inspection/effects and environment helpers. Every-step RNG/result/time, movement/navigation/progress/diagnostics, ammo/reserve, health, suppression, assignments, postures, mounting/treatment, activity, grenade and squad-objective hashes must match.

The initial 40-pair round is retained, then the same 40 pairs rerun after visual corrections. Each is 80 complete executions. Separately, all 200 inherited legacy replay hashes must match archived `v025-after-A.json`. **360 recorded complete executions** total, excluding unit-test battles, partial browser fixtures, failed recording attempts and unretained exploratory runs. This is presentation equivalence, not a claim of improved combat performance.

The suite adds six grouped prototype tests to the existing 237: target/size isolation; RGBA/atlas/metadata; Pages-safe URLs; direction/foreshortening bounds; render nonmutation, actual-shot geometry, smoke anchoring and immutable snapshots; disabled/unsupported/casualty fallback. Full tests, build, final replay and mobile results are recorded below and in machine-readable files.

### Mobile/performance architecture

Only one prototype has nine reusable image layers. Texture frames are preloaded once, with nearest/pixel sampling, and no per-frame texture/canvas generation. The main atlas is approximately 2.65MB uncompressed RGBA, excluding renderer copies/metadata. No new npm dependency or service. Startup waits for the small local asset preload; simulation tick timing is unchanged.

Mobile Chromium tests cover Korean inspection/scroll/close, head selection at 1.5×, other-soldier selection, pan/pinch, orientation, pause/restart, 1×/2×/4×, and cache cleanup. The short 4× frame sample is desktop emulation; it does not certify physical iPhone Safari, heat, battery or memory plateau. Actual enlarged pixels can overlap nearby cover more at 1.5×; physical footprint and visibility mechanics remain unchanged. Do not globally increase soldier sizes based on this prototype alone.

## Milestones and reproduction

- M1–M3 **11a7530**: inspected existing authority, added original assets/metadata and state-driven adapter with focused tests.
- M4 **505c03b**: isolated toggle/size UI and real paused comparisons.
- M5: real recording/frame review, perspective/anchor/snapshot corrections, complete validation and report in follow-up commit.

```sh
npm install
npm test
npm run build
# Optional artwork rebuild (Pillow 13.0.0 tested):
python3 scripts/art/build-usmc-rifleman.py
mkdir -p /tmp/aw-v030-base
git archive dec95ef src package.json | tar -x -C /tmp/aw-v030-base
node scripts/check-v030-parity.mjs /tmp/aw-v030-base
node scripts/audit-v025.mjs . reports/v030-legacy.json 200 '' '' legacy
node scripts/verify-v030.mjs /tmp/aw-v030-base
npm run preview -- --port 4209
# Separate terminal; Playwright and /usr/bin/chromium required:
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/capture-v030.mjs
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/mobile-v030.mjs
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/record-v030.mjs
# Local-only reload/cover/peek QA:
npm run dev -- --port 4210
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/check-v030-actions.mjs
```

Record scripts save JPEG/PNG sequences under `/tmp`; ffmpeg can encode the recorded concat sequence and extract contact sheets. They require no simulation command API. Pages deployment base and workflow are unchanged; feature branches do not deploy production automatically.

## Physical iPhone checklist / next art work

Physical iPhone Safari is **unverified**. Toggle rifleman #1 at normal zoom; compare all three sizes, head/body taps, Korean inspection, camera focus/free pan/pinch, and all speeds. Watch foot cadence and direction changes; compare actual firing, muzzle/smoke and support-hand anchors; reload and cover transitions; fallback during grenades and casualty states. Pause while turning/reloading, restart repeatedly, background/resume and observe several full matches for frame/texture stability.

Next art work should refine eight-direction side anatomy, helmet fabric/shape, pouch/backpack definition, weapon-side-specific artwork, foot planting and unsupported action/casualty frames. Obtain visual/historical review before calling this a production-quality 2000s USMC asset. Existing tactical/medical/navigation limits and Korean dynamic-reason fallbacks are preserved rather than addressed here.

## Final recorded results

**243 tests pass; zero failures. Production build passes** (existing Phaser chunk advisory). Final 40-pair per-tick hashes/outcomes/durations match both the baseline and initial round. All **200 legacy hashes** match. **360 recorded complete executions**, zero recorded timeout.

| Paired cohort (20 configurations each) | Shared baseline/final P50 / P90 / P95 / max, seconds |
|---|---|
| legacy | 70.85 / 162.10 / 196.85 / 196.85 |
| expanded | 92.60 / 159.95 / 186.40 / 186.40 |

The final actual recording contains **12 observed prototype firing soldier-frames** with exact projected event-angle checks; these are repeated visual samples, not 12 unique shots. Asset rebuilding produced identical hashes before the final prone-volume art refinement; metadata/frame tests pass after that refinement too. Native prone helmet/backpack volume was improved after frame review, without changing any tactical state.

Final mobile Chromium sample: **300 frames over five seconds at 4×**, median/P95/max **16.7/16.7/16.8ms**, with the isolated prototype enabled at 1.3×. All recorded mobile checks pass, including another soldier remaining selectable while the prototype is enabled. This short desktop sample is not physical-device certification.
