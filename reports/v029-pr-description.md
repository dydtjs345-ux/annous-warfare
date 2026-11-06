## Visual update

Original layered infantry pixel clusters (helmet, vest/pouches, straps, directional backpack and shaded limbs); urban asphalt/pavement wear, building facades/roofs and obstacle material detail; actual-event smoke/casings/damage dust with restrained muzzle bloom. Static ground is cached once per match and destroyed/rebuilt on restart. No external assets/dependencies or new renderer.

## Validation

- 223 tests pass; production build passes with the existing Phaser chunk advisory.
- All 40 renderer-active paired full-match comparisons against merged v0.2.8 preserve per-tick RNG/combat/navigation/medical/grenade hashes and outcome/duration. Initial paired round also retained.
- All 200 legacy archived hashes preserved; 360 recorded complete executions total.
- Mobile Chromium inspector, touch scrolling/selection/pan/pinch, orientation, pause/restart and 1×/2×/4× pass. Final short 4× frame sample ~16.7ms median/P95. Physical iPhone Safari unverified.
- Before/after screenshots and actual cover/peek/fire/treatment/grenade captures reviewed. Combat close-ups use labeled controlled real-Battle fixtures, not fabricated poses.

Full audit: reports/v029-hybrid-visual-audit.md

Limitations: procedural rather than authored eight-direction sprite atlases; repeated materials remain visible; no invented missed-bullet terrain impacts; no real-device thermal/memory guarantee. Existing AI/medical/tactical limitations remain untouched. Do not merge automatically.
