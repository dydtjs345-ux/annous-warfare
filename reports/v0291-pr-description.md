## Environment-only update

Corrects both wall-plane window perspectives, adds recessed framed glass/sills and shut decorative doors, varies roof/facade materials and adds attached vents/pipes/posters. Cover now reads as rounded sandbag courses, sloped Jersey barriers, reinforced board crates and cars spanning actual paired solid cells. Thin street fittings, flat road details and cosmetic recent battle damage do not participate in collision/LOS/bullets.

Static environment art is cached per match and freed on restart. Interpolated soldiers retain their baseline sprite/animation code and depth; selected soldiers behind a building receive selective opacity and a posture-sized outline. No soldier scaling or tactical changes.

## Validation

- 237 tests pass; production build passes with the existing Phaser chunk advisory.
- All 40 paired full-game comparisons against merged v0.2.9 preserve per-tick outcomes/time/RNG/navigation/ammo/wounds/medical/cover/grenade hashes.
- All 200 archived legacy hashes preserved; 280 recorded complete executions total.
- Nine production QA captures via spectator controls only; no soldier/action/terrain injection.
- Mobile Chromium Korean inspector, gestures, orientation, pause/restart, 1×/2×/4× and repeated texture-cache cleanup checks pass. Short 4× frame sample 16.7ms median /16.8ms P95. Physical iPhone Safari remains unverified.

Audit and actual before/after images: reports/v0291-urban-environment-audit.md

Limits: procedural/repeated architecture; decorative doors remain sealed; thin fittings are cosmetic foundation attachments; existing center-depth/2D LOS approximations remain; per-object textures consume memory and are not an atlas. No real-device long-session memory/thermal guarantee. Do not merge automatically.
