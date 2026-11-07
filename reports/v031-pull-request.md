USMC rifleman #1 now has a separate higher-detail transparent PNG rig with a fuller torso, shorter relative legs, more equipment detail and an M16A4 silhouette. The comparison controls retain the stock renderer, v0.3.0 bank, and 1.0/1.3/1.5 sizes. Existing motion and authoritative combat events drive the independent torso/legs, run, crouch, crawl, reload and real-shot animations.

This is a reference-informed prototype, not finished reference-quality military artwork. No illustrated reference poses were cropped into an atlas. Dedicated directional anatomy/hand/equipment/transition art is still needed; unsupported grenade/treatment/mount/casualty poses retain stock rendering. The audit includes actual in-game comparisons, shot frames and a combat video.

Validation: 247 tests pass, production build succeeds, 40 paired configurations / 80 complete simulations match v0.3.0 exactly, including inherited replay hashes. Mobile Chromium checks passed selection/inspector/scroll, both banks, pinch/pan, orientation, pause/restart and 1x/2x/4x. Five-second 4x RAF P50 16.7ms, P95 16.8ms on desktop emulation; physical iPhone Safari remains unverified.

Foundation is e032103 from feat/v030-tactical-soldier-prototype. Main is still dec95ef, so this PR includes the preserved v0.3.0 commits until that foundation merges. v0.3.1-only diff starts at e032103. No tactical/combat changes relative to that foundation.

See reports/v031-high-detail-soldier-audit.md, reports/v031-validation.json and public/assets/usmc-rifleman-v031/README.md for evidence, source/pivots and limitations. Do not merge automatically.
