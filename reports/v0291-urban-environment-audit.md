# Autonomous Warfare v0.2.9.1 — urban environment audit

Base: **2b30b30**, main containing merged v0.2.9 and its smooth-motion extension (PR #16). Branch: **feat/v0291-urban-environment**. Visual-only: existing soldiers, animation/interpolation, simulation timing, RNG, AI, collision, cover, ammunition, injuries, medical behavior and squad decisions are preserved. No automatic merge or production deployment.

## M1 — architecture and confirmed perspective defect

The prior window renderer reused a fixed positive-slant parallelogram for both visible faces, despite opposite wall slopes. Windows on the second face therefore disagreed with the building plane. `wallPoint` and `wallQuad` now express every frame, glass pane, mullion, sill, door and vent in wall-local horizontal/vertical coordinates. Frames are inset from corners; window tops remain below the parapet. Glass is recessed behind an outer frame, with narrow glints and occasional cosmetic cracks. Wider, more sparsely spaced openings replaced the initially crowded window pattern found during close-up review.

Doors are visibly shut decorative panels on existing solid building faces. There are no new usable doors, interiors, windows for firing or path entrances. Wall vents, drainage pipes, small posters and service panels add depth. Three coordinate-derived exterior/roof palettes and different roof seam patterns provide material variation. Rooftop vents remain visual fittings on inaccessible roof surfaces.

## M2 — functional cover silhouettes

`cover-art.js` draws rounded individual sacks in staggered sandbag courses; concrete uses a narrow cap and sloped Jersey faces; crates use boards, diagonal bracing and reinforced corners. Cars have separate body, hood, cabin/roof, windshield, side glazing, wheels and rust accents.

Adjacent paired vehicle cells are grouped **only for drawing**, each physical cell retained exactly once. The visual body spans the actual pair and is oriented along its axis. Single-cell fallbacks remain compact. Vertical sandbag/concrete sequences orient their artwork from neighboring cells rather than drawing every segment crosswise. This corrected a visual line-coherence defect; navigation and protection still use the unmodified cell map and material rules. All objects retain their existing material heights and footprints; wheel/edge details and soft shadows are cosmetic.

## M3/M4 — inhabited streets and restrained conflict damage

A coordinate-derived plan attaches eight small lamps, four utility poles, six bins and six benches to the twelve sealed building foundations. These thin fittings use existing blocked foundation cells so a non-colliding bench/bin does not visually promise a new place to shelter in open terrain. They are not added to obstacles, LOS or bullet collision. Small sign plates and posters suggest road/shop use without inventing enterable shops.

Flat road/pavement details include crossings, manholes/drain slots, stains, scattered refuse, tiny discarded tires and rubble/glass-like chips. Density is restricted, with manholes preferentially on road lanes. No simulation RNG is used. Facade pockmarks, shallow plaster cracks, dark scorch patches and cracked glass imply recent fighting without missing wall sections, passable breaches or destructible terrain. These are fixed cosmetic marks rather than fabricated live impacts.

## M5 — cache, depth and selected visibility

Static environment art is rasterized once per match into owned textures: buildings, material cover and fittings. Cached images retain the same world anchors and world-X+Y depth convention. Interpolated soldiers now use twelve reusable graphics layers at their interpolated depths; their sprites and animation code are byte-identical to the baseline. Existing real-event effects remain in the overlay layer. Ground keeps its existing once-per-match render texture. There is no per-frame procedural texture generation.

On restart the environment cache destroys old images and explicitly removes their texture keys. Tests confirm generation happens once despite repeated updates, and mobile checks repeat restart four extra times, requiring texture-key count to match active cache count. This checks static-cache ownership, not complete browser/GPU leak freedom.

Culling uses each cached image's bounds. For a selected soldier whose head/body projects into a foreground building prism, only that building fades to 48% opacity. A restrained outline matches the selected soldier's current low/upright bounds. Picking still maps to the original soldier and inspector knowledge remains authoritative. No soldier scaling, collision change, enemy reveal to AI or blanket transparency is introduced. Legacy roofs remain subject to the existing roof-hiding condition, now using cached images.

## Actual visual QA

Images are captured from the production game through existing spectator camera/input controls, without injecting soldier positions, actions or terrain. Seed 2049, layout 0, spawn 0. Art close-ups pause a real match for camera inspection; the firefight and selected-occlusion captures first wait for real gameplay opportunities. Before/after capture timing can differ slightly, so these are visual comparisons, not pixel-equality tests.

- [Before: merged v0.2.9](v0291-before.png) / [After overview](v0291-after.png)
- [Windows, shut door and wall fittings](v0291-architecture.png)
- [Rounded sandbag line](v0291-cover-sandbags.png)
- [Jersey barricade](v0291-cover-concrete.png) / [Vertical cover alignment](v0291-cover-vertical.png)
- [Vehicle](v0291-cover-vehicle.png) / [Boarded crate](v0291-cover-crates.png)
- [Decorated intersection](v0291-intersection.png)
- [Actual soldiers fighting around cover](v0291-fighting.png)
- [Selected soldier / foreground-building fade on mobile](v0291-mobile-selected.png)
- [Mobile Korean inspector and controls](v0291-inspector.png)

Reviewed the images for wall-plane alignment, corner margins, vehicle footprint, visibility of cover caps, decorative density and depth. Fixed dense windows and vertical barricade orientation during review. A screenshot timing race was fixed by retaining the identity of an actually firing soldier before pausing; it does not create a shot or force a pose. The screenshots use unchanged soldier sizes. `v0291-visual-qa.json` retains camera/soldier/cache snapshots and browser errors for captured gameplay cases.

## Deterministic regression

`check-v0291-parity.mjs` archives/imports the baseline Battle separately and compares 40 matched complete cases: legacy and expanded, each seeds **2001–2020**, fixed 0.05s step; expanded layout=(seed−2001)%4, spawn=floor((seed−2001)/16)%3, grenades only on expanded. The new side exercises the unchanged soldier/motion renderer, effects, Korean inspection and new environment paint/grouping helpers. Every-step RNG/result/time, positions, route/navigation/progress/diagnostics, ammo/reserve, wounds, suppression, assignments, postures, mounting, treatment, activity, grenade and squad objective hashes must match.

A separate 200-case legacy audit at the inherited 0.1s step preserves all archived `v025-after-A.json` replay hashes. **280 complete recorded executions** total (80 paired executions + 200 legacy); browser partial matches and unit-test battles are excluded. All paired outcomes/durations and per-step hashes match; all 200 legacy hashes match. No recorded timeout. This is equivalence, not a tactical balance improvement.

Existing simulation/AI/world/medical/grenade, soldier rendering and smooth-motion module bytes are checked against the baseline. `v0291-validation.json` records their SHA-256 hashes. The six added tests cover opposite wall planes, full-cell visual grouping/vertical orientation, deterministic foundation-only fittings, paint nonmutation/bounds, projected selected occlusion, and cache generation/destruction.

**237 automated tests pass; zero failures.** Production build passes with the existing Phaser chunk advisory. Pages base and workflow are unchanged. Package metadata uses valid SemVer `0.2.9-1`; the player-facing release label is v0.2.9.1.

## Mobile performance and usability

Mobile Chromium checks: Korean inspector expand/scroll/close/reselect, portrait/landscape, touch pan/pinch, camera, pause/restart and 1×/2×/4×, plus cache-key checks across repeated restarts. Final five-second 4× frame timing is in `v0291-mobile.json`. This desktop-emulated sample is not physical Safari performance and does not establish battery/thermal behavior or memory plateau. Static texture count/area is recorded for context; finite cached textures trade memory for fewer per-frame drawing operations.

## Milestones

- M1 **d0ff7e4** — wall-plane architecture and facade material variation.
- M2 **7412d60** — recognizable cover objects and paired vehicle footprints.
- M3 **499c0ea** — deterministic street fittings and flat road details.
- M4 **387392e** — restrained cosmetic damage.
- M5 **29ace85** — static texture ownership, unit depth and selected occlusion.
- M6 **1f66ca8** — final visual corrections, source equivalence, complete tests/simulations and delivered QA evidence in subsequent commit.

## Reproduce

```sh
npm install
npm test
npm run build
mkdir -p /tmp/aw-v0291-base
git archive 2b30b30 src package.json | tar -x -C /tmp/aw-v0291-base
node scripts/check-v0291-parity.mjs /tmp/aw-v0291-base
node scripts/audit-v025.mjs . reports/v0291-legacy.json 200 '' '' legacy
node scripts/verify-v0291.mjs /tmp/aw-v0291-base
npm run preview -- --port 4209
# Separate terminal, with Playwright + /usr/bin/chromium available:
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/mobile-v0291.mjs
AW_PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs node scripts/capture-v0291.mjs
```

## Limits and physical Safari checklist

This is original procedural environment art, not a full authored tile atlas. Repeated architectural families remain; single-cell vehicles are necessarily compact. Street signs/posters are pixel markings rather than readable prose. The thin fittings are cosmetic attachments, not independent physical props. Cosmetic damage does not evolve during combat. Existing coarse center-based depth sorting is preserved; selected transparency improves visibility but does not introduce a full per-pixel occlusion solver. The cache currently owns per-object textures rather than a packed atlas.

No new doors/interiors, soldier scaling, weapons, tactics or map geometry. Existing v0.2.9 tactical limitations and Korean dynamic-reason fallbacks remain unchanged.

**Physical iPhone Safari remains unverified.** Check both orientations and squad/full-map zoom, selecting a moving soldier near each building face, opacity restoration after closing/changing selection, facade/cover readability, thin poles crossing sprites, touch scrolling/pan/pinch, 1×/2×/4×, repeated restart and app background/resume. Watch long-session texture memory, frame rate, heat and battery behavior. If cache memory is excessive on older devices, profile a shared-material atlas before adding more detail. A feature-branch push does not deploy Pages.

## Final measured mobile/cache sample

The final 4× sample has 298 frames over five seconds: median/P95/max **16.7/16.8/33.4ms**. All recorded mobile checks pass with zero page errors. Layout 0 uses 82 static environment textures, 1,097,200 pixels (4,388,800 raw RGBA bytes), plus the existing 2000×1060 ground cache. This is not total GPU/browser memory: canvas/GPU copies and driver overhead are additional. See `v0291-cache-budget.json`. Physical Safari and long-session memory remain unverified.

## Delivery

Tested implementation commit `1f66ca805d176562b0f4ec1f7a06a27803377f61` is pushed. PR creation returned `Post "https://api.github.com/graphql": Forbidden`; no PR was created by that command and no merge occurred. [Prepared PR description](v0291-pr-description.md). Comparison: https://github.com/dydtjs345-ux/annous-warfare/compare/main...feat/v0291-urban-environment?expand=1
