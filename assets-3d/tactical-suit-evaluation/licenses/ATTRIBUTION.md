# Actual Tactical Suit model and imported motion

## Character

**Military tactical suit (LowPolyGameReady)** by **DanlyVostok (1799danly)**.

- Creator: https://sketchfab.com/1799danly
- Original listing: https://sketchfab.com/3d-models/military-tactical-suit-lowpolygameready-ef698ce36b1545a78ce592dd3db4c7ed
- License: **Creative Commons Attribution 4.0 International (CC BY 4.0)**, https://creativecommons.org/licenses/by/4.0/ . Full text accompanies this attribution.
- License metadata: `Sketchfab-danly.json`, retrieved 2026-11-11 from the public Sketchfab model API.
- Downloaded copy: https://raw.githubusercontent.com/cktang88/3d-fps/130ac2a5c856401ec36e7d35afcfefe40c5801f4/public/assets/models/characters/soldier_tac.glb
- SHA-256: `fe02bc307077d7a5a74069d085893988d93751495871c84082256e60bf9bfc9e` (4,532,132 bytes).
- That GLB embeds the original model title, creator, source UID and CC-BY-4.0 license. The mirror repository also credits this model separately. Its software license is not substituted for the character's CC BY license.
- The official authenticated Sketchfab download API returned HTTP 401. This evaluation uses the credited public mirror, not an authenticated original archive. The mirror's completeness against that archive is unverified.

**Modifications:** repaired position/inverse-bind units and zero-weight helper binds; removed one zero-weight dummy root and unreachable FBX wrappers; reconstructed neutral bind pose; seated the existing headphone component; uniform display height of 1.74 m; retargeted Quaternius motions with explicit limb contact and rifle-grip constraints; reused the project's existing M16A4. Character shape, textures and equipment remain from the actual external model. No original USMC body is included in the Tactical Suit output. The mirror's unused animation data is excluded; no animation from that mirror is adopted.

## Motion

**Quaternius — Universal Animation Library 1, Standard, root motion**.

- https://quaternius.itch.io/universal-animation-library
- https://quaternius.com/packs/universalanimationlibrary.html
- License: **CC0 1.0 Universal**; accompanying publisher license and README retained.
- Input: `../open-asset-evaluation/source/UAL1_Standard_RM.glb`
- SHA-256: `be684571ed655a1b892c2c07e6e2aeca053b606c442d34004adaf1d944090d01`
- Actual source clips used: `Walk_Loop`, `Sprint_Loop`. Native durations preserved. No imported crawl is claimed.
- Changes: skeleton/bind-pose retarget, leg-length scaling, source ankle trajectories with sole/reach cleanup, existing M16 carry alignment and baked arm/hand/finger grip constraints. Pelvis and spine rotations remain source-driven. No procedural replacement gait was created.

## Existing project assets

Original USMC model, existing walk/sprint and M16A4: read-only project inputs from `assets-3d/tactical-combat/`. The weapon is reused under the user's authorization for this repository; no independent third-party weapon license is asserted. The Russian rig and all original model/animation files are untouched. Comparative renders include the original model for evaluation, with explicit labels.

Neither the model creator nor Quaternius has endorsed this evaluation.
