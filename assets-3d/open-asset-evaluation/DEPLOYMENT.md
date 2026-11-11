# Verified comparison publication

Published comparison: https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/open-asset-review/

- Feature branch: `feat/open-animation-asset-evaluation`
- Animation assets, source evaluation and rendered comparisons: `6d1e7cf5bf07e0a3fcaf0439b326033b6b2c0334`
- Published preview implementation, including video/image fallbacks: `a537771bbf4e17c5de515a30dc694cbf4eb272e9`
- Hosting source commit: `072a277e19cc79bb24f676b4c55bad54c8368c72`
- Sites saved version: **16**, `appgprj_6af0d17863348191b4ea48163f305325~appgver_cba4547c62808191969a40cc611cddb0`
- Deployment: `appgdep_6af4950710208191b2c670d17c07603f`
- Native deployment status: **succeeded**, `2026-11-11T16:17:45.645919+00:00`
- Deployment archive SHA-256: `a1ad0bace3618e191ae7f989b2bf16031649663dbba3c88a87d5db365d398f65`

Hosting uses its own source repository. GitHub game `main` remains `b381e6017d01fa34f14e889ff639347db9e5feae`. No feature branch was merged into it.

## Verification

Anonymous HTTP checks downloaded and compared **all 156 public runtime files** with the final artifact. All matched byte-for-byte, including every comparison video, still image, animation patch, license, manifest, and the older preview files. The empty hidden `.nojekyll` marker is not a public runtime resource. All **119 pre-existing preview files** remain byte-identical in the deployment source.

The side/USMC/walk, isometric/Russian/sprint and unavailable-crawl query URLs return the correct comparison page. Actual GLB-derived comparisons cover both models, both imported motions, both camera views, and native 1× timing.

The production game's anonymous HTML hash remains `dd18bd9ccd543f4d95dbd8acbe7d5eb1e47f6011b93b8df22ff94a30f2c273cc`. The separate 6v6 combat test hash remains `6a050fc31fe0291174e4ebcd45e1899873de597596eef6edf264501b9ff10600`. These match the protected builds from before this task. The 842 existing tracked repository files are unchanged.

The preview host does **not** support the tested MP4 byte range: a request for bytes 0–127 returned HTTP **200**, MIME `video/mp4`, and the complete matching file. The final page fetches its selected short MP4 into a local Blob for seeking and offers a four-phase still-image comparison. The default mode loads no full soldier GLB. This is a delivery fallback, not a claim of verified Safari playback.

Actual asset playback was inspected through Blender-reimported GLB frame sequences and source/target contact sheets. CPU Three.js playback matches the exported transforms; both new animation GLBs have zero Khronos errors/warnings. Browser execution and physical iPhone/Safari remain unverified because the managed browser interface is unavailable. The exact [Sites skill instruction](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/SKILL.md) is quoted in the main evaluation report.

The imported walk/sprint remain **raw evaluation candidates**, with failed rifle grip and ground contact. They do not replace game animations. **Crawl has no acquired licensed source**: no fake imported crawl was generated. See `README.md` for the action/source/license matrix and measured limitations, and `validation/deployment-http.json` / `release.json` for machine-readable publication evidence.
