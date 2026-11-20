# Complete infantry visual consolidation

This is an integration build with explicit asset gaps, **not a claim that all requested 3D animations are complete**. New branch: `integration/complete-infantry-visual-system`, based on the stable playable 6v6 `ceffb8534caa5a6ff8a3afe55858e175012c8cd9`. Main stays at `b381e6017d01fa34f14e889ff639347db9e5feae`.

## Selection and history

All remote branch heads are recorded in `branches.json`. PRs 23, 24 and 25 remain open/draft, with no review comments or user approval records. PRs 1–21 were merged into main. `integration/v035-infantry-6v6-test` is still the older v035 2D laboratory (`9626d59`), not a merged 6v6 build. The 6v6 branch is its own functioning integration (`ceffb85`). Later tactical, crawl, external evaluation, actual Suit recovery, authored crouch and cover branches descend from this asset line; they did not update main's renderer. The newest individual path-command branch was inspected and deliberately excluded: this task adds no path commands, tactical pause, new AI or combat-map geometry.

Original USMC geometry originates at `aba8585`, Russian/AK at `1ab40c2`, shared animation at `a1d2804`, reload polish at `a93cbae`, upper-body fixes at `5481fc8`, SR at `66d3892`. The latest original-rig package `aa650ce` preserves these and adds candidate tactical clips; the later torso-crawl patch at `cfded5c` is separately named REC and manual-only. No older sprint replaces SR. The visibly inferior FB sprint is removed from automatic UI selection, retained only as a named comparison in the isolated clip page.

The actual **Military tactical suit (LowPolyGameReady)** by **DanlyVostok / 1799danly**, Sketchfab UID `ef698ce36b1545a78ce592dd3db4c7ed`, CC BY 4.0, really was imported. It is not the project USMC mesh. Latest validated appearance is the unchanged 87-joint skin in `TacticalSuit_Phase2.glb` (`cc66fec`) and its preserved cover extension (`922fc66`). Geometry, source licenses and source hashes remain preserved. See `EXTERNAL-MODEL-SOURCE.md` and the shipped attribution files.

Default automatic battle: original distinct tan USMC/M16A4 and green Russian/AK-74M, evaluated into eight-direction atlases with 163-bone full-body lower/upper composition and additive recoil. LMG bodies retain the original faction mesh with an explicitly generic legacy weapon; mounted/bipod and LMG reload retain the complete original drawing. There is no validated M249/PKM asset.

The latest external Suit is available **inside this playable build** as an explicit USMC model selector for supported idle, walk and tactical sprint, and in the developer 3D inspector. Russian appearance is preserved. Selecting Suit explicitly warns that all unsupported actions use the existing 2D USMC renderer; this model substitution is never represented as a Suit animation. Default remains the faction originals to avoid unsolicited mid-combat model switching. A consistent external-Suit-only combat model still needs aim/moving-fire/reload/casualty/medical clips. Existing cover aim/fire cannot be substituted for open-ground combat or ordinary reload. No new animations or retargets are authored to hide that gap.

## Automatic and manual paths

The full nine-column, action/model-specific inventory is `INVENTORY.md` / `inventory.json`. Automatic atlas actions: Idle, Walk, SR Sprint, AimWalk, MovingFire, Aim, Fire, Reload, Start, Stop, Raise, TurnLeft and TurnRight. Actual movement/brisk/aim/shot/reload evidence drives these; distance drives gait, reload progress drives full weapon/magazine motion. Start is an observed idle-to-walk transition; SR acceleration/deceleration compositions remain manual because their authored travel curves do not match existing instantaneous AI speed changes.

Death and incapacity have highest priority even if stale moving/shooting/reload flags remain set. Limp/crawl injury and suppressed reaction now explicitly retain existing presentation instead of playing healthy locomotion. Medic treatment, hit effects, suppression, injury, incapacitation and death are genuinely gameplay-triggered **legacy procedural visuals**, not new skeletal clips. No death, downed, medic, dedicated hit or injury clip exists on either selected 3D rig. The inventory says so. Casualties cannot be resurrected by a walking or firing overlay.

Developer inspector (Korean by default): select any of the twelve soldiers; inspect actual model, action, gameplay trigger, source and fallback. Manual preview uses separately loaded model instances, rigs and controllers. It cannot write to battle, AI, RNG, health, ammo or unit positions. Returning to combat disposes the WebGL renderer, model geometry/materials/textures, controls and animation frame. A selection made while loading is invalidated safely. Closing the panel also releases its view. One additional low-power WebGL context exists only while the user requests manual inspection; the default battle downloads no source GLBs.

Manual-only: original crouch/prone/crawl/cover families, latest torso-crawl patch, all existing SR transitions, authored Suit crouch pair, forward emergency-escape candidate, and non-blind Suit cover enter/aim/fire/return/exit with both rifles. These are candidates, not newly approved gameplay. There is no matching validated emergency-retreat AI state; forward escape is not target-facing/backwards retreat. New authored crouch approval remains outstanding. All blind-fire variants are excluded from selectable actions and gameplay, including unrealistic overhead fire; original source files are preserved unchanged. Missing clips are not silently replaced in the manual view.

## Rig and rendering

No bone-track renaming is used as a retarget. Existing already-retargeted 87-bone assets stay on their actual rig; 163-bone faction motions stay on theirs. CPU checks exercise the actual retained controllers, gait continuity, upper/lower masks, additive shots, reload hand release, unsupported-state rejection, and both rifle-specific cover patches. Source geometry/skin/node preservation is checked byte-for-byte. The latest crawl patch is explicitly renamed REC only to distinguish a variant on the *same* compatible hierarchy, not to fake skeleton compatibility.

The game retains Phaser depth `(x+y)*100`, existing interpolated movement, fixed common ground anchors and 100ms image crossfades. Upper and lower source motion is composed before baking, so no runtime upper layer freezes torso motion. Generic LMG overlays and injury/casualty procedural fallbacks remain material visual limitations. Contact, deformation and equipment need human review on target devices; numeric source checks do not prove absence of every clipping/self-collision issue.

## Verification and limits

- Full pre-existing `npm test` suite passed (`full-test.log`). Main production build passed separately.
- Read-only adapter parity: seeds 7, 19, 42 on the existing expanded map have identical combat hashes/RNG counts. Actual events cover movement, shots, reload, damage, suppression, incapacitation, death, treatment ticks and treatment completion. See `../infantry-test/simulation.json`.
- Targeted terminal/limp/start regression checks and actual selected controller/rig checks pass (`rig-tests.json`). These do not establish browser or physical-device performance.
- The supported local Sites relay failed readiness after starting its preview; it was stopped. HTTPS browser/deployment checks are recorded separately after publication.
- No physical iPhone is available. Cloud Chromium/software renderer and any desktop WebKit checks are not iPhone Safari hardware, sustained-FPS, thermal or memory-pressure tests. No mobile performance is inferred.

Original index/game entry, simulation, AI, map, medical code, source models and original animations remain unchanged. Main and the existing GitHub Pages workflow/deployment are not modified or dispatched. A separate Sites project is used for this preview; no previous Sites project is updated.
