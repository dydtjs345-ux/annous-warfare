# Mobile infantry animation preview

Standalone static preview for the original animated GLBs at `a1d280461f94456c905b677b213a6ee31245b1d0` on `feat/shared-infantry-combat-animation`. The source models and existing playable game are unchanged.

## Controls

- Choose USMC / M16A4 or Russian infantry / AK-74M, or compare both simultaneously. Single-soldier mode keeps only the selected faction in GPU memory; comparison loads both and starts them together on the same animation clock.
- The default **Gameplay isometric** camera is orthographic at 30° elevation, matching the established Blender evaluation at `(6, -6, 6 * sqrt(2/3))` in Blender's Z-up coordinates. The browser uses the equivalent Y-up offset `(6, 4.899, 6)`. The camera stays fixed across the eight soldier headings. Original measured reference spans preserve the 60 / 80 / 120 CSS-pixel standing heights.
- **Free 3D inspection** retains orthographic projection. Drag to orbit and pinch, scroll, or use the touch zoom buttons. **Side view** uses a horizontal orthographic camera relative to the selected soldier heading to expose foot placement and gait. Returning to gameplay resets the inspection camera and zoom.
- A plain ground plane receives realtime directional-light shadows from the actual animated geometry. A quarter-metre grid moves with the authored travel speed so in-place locomotion can be inspected against the ground.
- Choose any of the 21 source clips, or one of 17 combined motions, including continuous moving fire and weapon-specific reloads.
- Play/pause, replay, change speed from 0.25× to 2×, select any of eight actual 3D headings, and choose a 60 / 80 / 120 CSS-pixel standing reference.
- Moving fire uses independent lower-body aiming walk, upper-body aiming, and additive recoil. Turning fire off keeps the walking action and its current phase.
- A genuine continuous MP4 recording is available as an optional fallback. The primary preview renders and animates the GLBs in WebGL.

## Build

Use Node 22 or later from the repository checkout:

```sh
npm ci --prefix animation-preview-pages
npm run build --prefix animation-preview-pages
```

The builder reads the two GLBs, animation manifest, and review recording directly from the pinned Git commit, verifies both model SHA-256 hashes, and produces `dist/`. Three.js and the loader are bundled locally for Safari 15.4 or later; there are no runtime CDN or import-map dependencies. All site assets use relative URLs so the preview works at a GitHub Pages project path.

`src/reference-spans.json` contains standing-height camera calibration measured from the original Blender projects. `tools/camera_spans.py` documents the offline measurement and never saves the source projects. The phone does not scan all mesh vertices to establish its camera.

## Deployment isolation

Publish only `dist/` to a separate public repository, `dydtjs345-ux/annous-warfare-animation-preview`, and enable its GitHub Pages source branch. `.nojekyll` preserves the static bundle. The existing `annous-warfare` Pages site has a `main`-based Actions deployment and must not be replaced or reconfigured for this preview.

The checked-in `dist/` directory is the ready-to-upload site, including both exact pinned animated GLBs. `source.json` identifies the source commit and byte hashes. No runtime connection to the playable game is needed.

### Current publication blocker

The GitHub integration returned HTTP 403, `Resource not accessible by integration`, for `POST /user/repos` when creating the separate repository. The integration exposes only the existing `annous-warfare` repository among project/preview repositories. No separate Pages site was created, and no public preview URL has been verified. The existing game Pages configuration remains unchanged.

To finish publication, the account owner must create the public preview repository and grant this integration access, including repository contents and Pages administration permissions, or publish `dist/` there directly. For a manual publication, put the **contents** of `dist/` at the root of a branch in that separate repository, then select that branch and `/ (root)` in Settings → Pages → Deploy from a branch. Use the HTTPS URL reported by Pages after its build succeeds. Run the mobile checks against that URL before marking publication complete.

## Verification

`tools/mobile-test.mjs` exercises iPhone 13 viewport and touch emulation in Playwright WebKit and Chromium. It checks real frame advancement, both faction downloads and hashes, all 38 motion/clip selections per faction, gait continuity during repeated recoil, burst stop while walking, reload recovery, eight 3D headings, display scales, touch playback, relative asset loading, and portrait/landscape overflow. It records browser errors and screenshots.

Camera checks assert orthographic projection, 30° gameplay elevation, fixed camera position across all headings, side-view elevation, inspection rotation and zoom, shadow receivers, and simultaneous locomotion/recoil with identical gait phase and recoil counts in two-soldier mode. The comparison panels stack on phones and sit side by side on wider screens. Both retain the same native standing height; this is not a perspective camera or a sprite transformation.

The recorded local run passed in WebKit 26.5 and Chromium 156 with zero browser errors or failed asset responses. Each faction preserved its walking action and phase while producing five recoil impulses during the sampled moving-fire burst. See `validation/local/mobile-validation.json` and its portrait/landscape screenshots. These tests used a project-path URL, matching Pages relative-path behavior; public HTTPS testing is still blocked by the repository-creation permission failure.

To test any deployed site, set `PREVIEW_URL` to its public HTTPS URL, `REVIEW_OUTPUT` to an output directory, and run `npm test --prefix animation-preview-pages`. Install Playwright WebKit and its platform libraries first; Chromium uses `/usr/bin/chromium` in this cloud environment. `TEST_ENGINES` can select a comma-separated subset.

Browser emulation is not a physical iPhone test. The preview requires WebGL 2; physical-device performance, pinch gestures, and battery use have not been measured. Comparison mode requires two model downloads and two renderers; single-soldier mode remains available for lower memory use. The assets retain the source phase's flat-ground animation limitations; this publication adds no terrain adaptation or live combat integration.
