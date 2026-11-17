# Phase 2 publication and handoff

Verified HTTPS preview: https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/phase2-crouch/

**Stage A partial release:** new externally authored crouch idle/walk only. Dedicated stance entry/exit and crouched rifle aim/fire/reload remain unavailable. No new professional prone/crawl, cover or reload clip is presented as completed. Deep forward-leaning source style still needs user approval.

- GitHub feature branch: `feat/phase2-authored-crouch`.
- Model/contact checkpoint: `3f4b862d2ed54fea666a99a57736805378daab1c`.
- State controller/preview checkpoint: `eab1cb0`.
- **Deployed implementation:** `2e155e73929286ed743b1cb88e704a8c2a726570`. Subsequent branch commit adds publication evidence only.
- Separate preview Site source commit: `7e89e95b66cae428d050e357d9407cff6bdfbf9d`.
- Saved Site version **18**: `appgprj_6af0d17863348191b4ea48163f305325~appgver_c3de72a1b6c881919738deb75bf5a0c8`.
- Deployment: `appgdep_6afba1080d608191925311d3f81996a4`, native result **succeeded**, 2026-11-17 00:34:36 UTC.
- Public preview audience preserved. No GitHub `main` merge. GitHub `main` remains `b381e6017d01fa34f14e889ff639347db9e5feae`.

`validation/site-release.json` preserves the exact archive and version identifiers. The native unpacked archive content hash differs from the compressed tar.gz SHA-256; both are recorded explicitly. Do not redeploy merely because those two different representations have different hashes.

## Verified result

- All **225 served files** anonymously fetched over HTTPS and hash-matched, including the new compiled preview, manifest, actual model, H.264 comparisons, images and licenses.
- All **200 older runtime files** are unchanged in the publication payload; 199 served files are included in the HTTP check (the old `.nojekyll` marker is retained locally, not fetched).
- Original live-game and separate combat-test entry HTML remain byte-identical to their pre-task snapshots. All 1,016 pre-existing repository files remain unchanged.
- New model: `2549b894883ad6f8886060c742638a6c137fd52acb86f87ccbb1c02a0567da1c`, 5,534,192 bytes. A single server-side curl transfer took approximately 0.239 seconds. This is **not** Safari/mobile load-time measurement.
- Host serves video as `video/mp4` but returned HTTP 200 for a Range request. The page fetches a selected short MP4 into a Blob, and provides still comparisons as an additional fallback.
- Browser GPU rendering, real mobile Safari, device RAM, thermals and FPS are **not tested**. Narrow screens start with media; 3D is explicitly opened. The bundle targets Safari 15.4 syntax, which is not a device compatibility test.

Actual exported motion was inspected through side/isometric frame sequences and grip close-ups. Fourteen actual CPU-controller transition poses were rendered back onto the exported skin, with independently verified boot and rigid-weapon points. Khronos GLB checks, 480 Hz reimport/contact checks, eight-direction controller checks and actual catalog-to-clip resolution pass. See `validation/{visual-review,recordings,reimport,controller,preview,deployment-http}.json`.

## Continue from this state

Read `README.md` for exact clip sources/licenses and `tools/README.md` for reproduction. Preserve the approved model and four locomotion clips. The two new external loops are `P2_Quaternius_CrouchIdle_Rifle` and `P2_Quaternius_CrouchWalk_Rifle`, from actual CC0 UAL1 Standard RM `Crouch_Idle_Loop` and `Crouch_Fwd_Loop`. The two `P2_Legacy_*` clips are comparison retargets, not external imports.

Next obtain/validate a distributable authored foundation for the remaining Stage A actions. Rokoko archive access is registration-gated; Kevin's library redistribution restrictions remain material; Zen FBX 6000 now parses but axis/bind/root-height conversion is not validated. Do not promote a source merely because it parses. Existing crawl stays unapproved. Stages B–D and a Russian/AK variant of the external body remain unfinished. Existing original Russian/AK clips are preserved.
