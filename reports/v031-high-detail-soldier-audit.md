# v0.3.1 — high-detail USMC rifleman prototype

Branch: `feat/v031-high-detail-soldier`. Foundation: **e032103**, the completed v0.3.0 PNG prototype. No restart of the previous work. The stock renderer and v0.3.0 art remain available. Only **USMC rifleman #1** is eligible; the other 11 soldiers and world geometry are unchanged. No merge or automatic feature-branch deployment. A final fetch found main still at **dec95ef** (v0.2.9.1); v0.3.0 is not merged there. The branch deliberately preserves its required v0.3.0 foundation, so a comparison against main also includes those prior commits. The v0.3.1-only comparison starts at e032103.

## What changed, and the art-quality boundary

New original transparent PNGs under `public/assets/usmc-rifleman-v031/` replace the rough design when the new art bank is selected. They are generated offline by `scripts/art/build-usmc-v031.py`, not cropped from the supplied illustrated reference sheet. That reference guides the anatomy, desert digital camouflage, equipment and M16 silhouette; no illustrated poses have been repackaged as animation frames.

The new Marine has a fuller chest/carrier, more natural shoulder span, shorter relative legs, a connected neck/helmet, front magazine pouches and webbing, radio/IFAK silhouette, rear backpack, knee panels and boots. The rifle has a fixed stock, receiver, grip, magazine, rail handguard, exposed barrel, front-sight post and optic silhouette. Pixel edges use the existing nearest-sampled Phaser pipeline. Uniform texture is original desert digital camouflage inspired by MARPAT, not an authenticated reproduction of the issued pattern.

**This is a working asset/animation prototype below the supplied reference's finished quality.** Native kit detail is clearer, but not every pouch/hand/anatomical contour is artist-quality. Some side views remain too frontal, the IK sleeves can stretch, and equipment occlusion/handedness is simplified. Dedicated sprite artwork is still required for refined eight-direction anatomy, natural weight transfer, exact equipment, hand contact, and complete authored reload/cover/prone transition frames. The supplied reference cannot safely become an atlas by cropping. The genuine PNG pipeline makes replacing these assets possible without touching combat logic.

| Design measurement | v0.3.0 | v0.3.1 |
|---|---:|---:|
| Logical source canvas | 64×72 | 96×112 |
| Native upright crown-to-foot design span | 56px | 80px |
| Foot anchor | (32,64) | (48,96) |
| Hip anchor y | 34 | 62 |
| Hip-to-foot / upright span | 53.6% | 42.5% |
| Display heights at 1.0× / 1.3× / 1.5× | 30 / 39 / 45px | 30 / 39 / 45px |
| Atlas frames | 144 | 264 |
| Atlas texture | 512×1296 | 1024×375 |

The dimensions are rig measurements, not a claim of medically exact anatomy. Size 1.3× is the default evaluation choice; 1.5× is available. No global soldier enlargement, collision or perceived target size change.

## Asset and animation architecture

The atlas contains eight torso directions plus eight lower-body phases in eight directions for **walk**, **run**, **crouch** and **crawl/prone**. These are layer frames, not 264 finished full-body drawings. Every trimmed frame preserves logical 96×112 `sourceSize` and crop offsets; feet share one pivot. Separate 9×20 sleeve/forearm textures and 54×18 M16A4 texture use metadata shoulder, grip and muzzle anchors. The packed atlas is 1,536,000 raw RGBA bytes; both old and new banks are preloaded for instant comparison, so total texture memory increases by this amount plus the small pieces/metadata. No new npm runtime dependency or per-frame texture generation.

`SoldierPrototype.setArt()` changes the render-only rig and textures. Existing `MotionPresentation` still controls interpolated positions, shortest-angle turns, stride and action progress. Lower-body octants follow smoothed travel heading independently of the torso/weapon heading. Arm IK, low-ready easing, exact firing-angle override, foreshortening and shot effect anchors reuse v0.3.0. Neither metadata nor animation can issue an order, change RNG, advance a simulation tick, modify weapon stats or change injury/treatment.

| Visual behavior | Actual source / limit |
|---|---|
| Idle/scanning, low ready | Existing smoothed facing; no invented targets or shots |
| Walk / run | Actual movement pose and traveled-distance gait; new run family |
| Cautious weapon-ready movement | Existing seeking-cover/aim state; same readiness easing |
| Crouch / cover transitions | Existing interpolated renderTop; matching lower-body blend and torso drop |
| Full concealment | Immediate compact prone presentation; no visible firing weapon while tucked |
| Crawl / prone aiming | Actual crawl state, distance phase, independent projected rifle/arms |
| Aim / real fire | Authoritative shot direction, actual shot-only flash/recoil/smoke anchors |
| Reload | Real reload progress moves support hand to the magazine; no new timer |
| Suppression / injury | Existing state/stance and actual hit feedback; no invented panic |
| Grenade, treatment, mounting, incapacity/death | Existing stock renderer fallback; new art does not claim these complete frames |

Prone does not add a new tactical stance or command. Full concealment still prioritizes truthful immediate hiding rather than a delayed artistic transition. Walk-to-run and octant boundaries are frame changes; fully authored blend frames remain an artwork task.

## Actual visual QA

Same paused production seed **2049**, layout **0**, spawn **0**: [stock](v031-existing.png), [v0.3.0 1.3×](v031-v030-scale-1.3.png), [v0.3.1 1.3×](v031-v031-scale-1.3.png), [v0.3.1 1.5×](v031-v031-scale-1.5.png). All six bank/size comparisons retain the same simulation time and selection. [Four-times nearest pixel inspection](v031-comparison-detail.png) preserves aspect ratio; it is not replacement artwork. `v031-comparison.json` records the actual canvas coordinates, selection and timing.

Visual review confirmed improved torso/leg balance and a more readable equipped silhouette. It also found a genuine transparent gap between rear-facing helmet and collar. The source neck pixels were connected in all octants, then screenshots and recordings refreshed. This was an asset defect, not a simulation-facing problem. The feet/pivot stayed aligned with the selection ring across banks and all sizes. At normal zoom some native equipment detail necessarily collapses; the enlarged inspection is not evidence that every detail reads on an iPhone.

[Actual combat recording](v031-prototype-gameplay.mp4) includes 1×/2×/4× movement, observation turns and actual #1 firing in the existing match. `v031-animation.json` records immutable per-frame observations and screencast timestamps. Real shot samples assert the exact projected shot angle rather than a delayed interpolated muzzle. Pause freezes the prototype state. [Reload](v031-reload-frames.png), [full cover](v031-full-frames.png), [peek](v031-peek-frames.png) are actual local real-Battle fixture frames with controlled initial positions/ammo, not assigned fake actions or normal-match statistics. The fixture's initial pre-render snapshot needed an optional-model guard in the capture script; production logic was unchanged.

## Deterministic verification

`check-v031-parity.mjs` compares **e032103** and the updated code for legacy and expanded maps, seeds **2001–2020** on each, dt **0.05s**. Layout=(seed−2001)%4, spawn=floor((seed−2001)/16)%3, grenades only in expanded. Forty paired configurations are **80 completed executions**. The render-side run loads the new rig metadata, alternates old/new art, cycles all three scales and exercises motion, effects, inspection and environment helpers. Every-step hashes include RNG, result/time, navigation/routes/progress, ammo/reserve, health, suppression, assignments, postures, mounting, treatment, activity, grenades and squad objectives.

**40/40 pairs match exactly**, with zero outcome/duration/hash divergence or timeouts. This is presentation parity, not an AI performance improvement. The inherited 200-case legacy archive was not separately rerun in this release; all simulation modules are byte-identical to e032103 and the focused legacy pairs plus the full existing suite are rerun. No claim of additional unrecorded complete matches.

## Validation results

Final machine-readable results and logs are supplied alongside this report. Four new grouped tests cover proportion metadata, all trimmed frame families/bounds/pivots, both-bank nonmutation/muzzle alignment, RGBA sizes and independent torso/travel directions. Existing tactical, navigation, medic, grenade, mobile-inspector, animation and prototype regressions are retained.

| Check | Final result |
|---|---|
| npm install | Passed, offline cache; no new dependency |
| Full automated suite | **247 passed, 0 failed** (243 inherited + 4 new) |
| Production build | Passed; existing large-chunk advisory remains |
| Complete paired simulations | **80 executions / 40 configurations**, all exact matches |
| Inherited 40 replay hashes | All unchanged |
| Actual #1 firing samples | **18** visible shot frames; exact projected angle checks passed |
| Captured combat frames | **271** CDP frames; MP4 and shot-frame sheet retained |
| Asset source rebuild | Byte-identical PNG/JSON output |
| Mobile Chromium | Touch/inspection/banks/sizes/gestures/orientation/speeds/restarts passed; no page errors |
| 4× short RAF sample | 298 intervals, P50 16.7ms / P95 16.8ms / max 33.3ms |
| Physical iPhone Safari | **Unverified** |

The frame sample is five seconds on desktop Chromium emulation, not a physical-phone performance guarantee. [Firing-frame comparison](v031-firing-frames.png), [mobile prototype](v031-mobile-prototype.png), [Korean inspector](v031-inspector.png). `v031-validation.json` checks these evidence files and byte-identical core/shared-renderer modules against the saved foundation. No AI/combat performance improvement is claimed.

## Mobile use and remaining limits

Use **시제품 #1 → 켜짐**, **그림 → v0.3.1** and **크기 → 1.3× / 1.5×**. Choose v0.3.0 for the previous PNG rig or turn the toggle off for stock. Enabling identifies/selects #1. The small selector row wraps on narrow screens. Korean soldier inspection and camera controls remain unchanged. Only one soldier uses nine reusable image objects. The 1.5× head remains selectable; this render-only hit area does not alter combat collision.

Desktop Chromium mobile emulation covers 390×844 portrait and 844×390 landscape, both art banks, head/other-unit selection, expanded Korean inspector/native touch scroll/close, pinch, pan, pause, restart/cache cleanup and 1×/2×/4×. These checks cannot certify Safari texture filtering, thermal behavior, battery or long-session memory. Main production bundle still emits Vite's existing >500kB chunk advisory; no dependency/bundle split overhaul was attempted.

**Physical iPhone Safari remains unverified.** Manual checks:

1. Open the reviewed branch build, enable #1 and compare stock/v0.3.0/v0.3.1 at 1.3× and 1.5×; inspect torso/legs, helmet/neck, hand/rifle contact and crispness at normal zoom.
2. Tap head/body and another soldier; expand/scroll/close Korean inspection; switch portrait/landscape, pan/pinch and follow #1.
3. Watch walks/runs and turns at all three speeds. Check foot cadence, upper/lower direction independence, cover silhouette, actual firing flash/smoke and reload hand timing.
4. Confirm grenade/casualty fallback remains understandable. Pause during a turn/reload, change speed, restart repeatedly and background/resume Safari.
5. Observe full matches for clipping at cover, long-session memory and device heat. Artist review is still needed before calling this reference-quality production art.

## Reproduction and milestones

```sh
npm install
npm test
npm run build
# Optional offline art source rebuild (Pillow 13 tested):
python scripts/art/build-usmc-v031.py
mkdir -p /tmp/aw-v031-base
git archive e032103 src package.json | tar -x -C /tmp/aw-v031-base
node scripts/check-v031-parity.mjs /tmp/aw-v031-base
npm run preview -- --port 4209
# Other terminal, with Playwright and Chromium installed:
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/capture-v031.mjs
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/mobile-v031.mjs
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/record-v031.mjs
# See record script's /tmp concat list for ffmpeg MP4 encoding.
# Local-only real-action fixtures:
npm run dev -- --port 4211
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/check-v031-actions.mjs
python scripts/contact-v031.py
node scripts/verify-v031.mjs /tmp/aw-v031-base
```

- **ee565de**: original new atlas/rig, independent layers, run/crawl families and focused tests.
- **8d90f31**: both-bank comparison, size UI, neck seam correction and evidence.
- M5 final validation/report commit: full suite, paired replay, mobile and actual combat evidence.
