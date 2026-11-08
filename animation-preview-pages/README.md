# Mobile infantry animation preview

Standalone static preview for the original animated GLBs at `a1d280461f94456c905b677b213a6ee31245b1d0` on `feat/shared-infantry-combat-animation`. The source models and existing playable game are unchanged.

For the proposed `/animation-preview/` deployment inside the existing GitHub Pages game site, see [GITHUB-PAGES.md](GITHUB-PAGES.md). That target requires an approved merge; the separate Sites publication below remains independent.

## Controls

- Choose USMC / M16A4 or Russian infantry / AK-74M, or compare both simultaneously. Single-soldier mode keeps only the selected faction in GPU memory; comparison loads both and starts them together on the same animation clock.
- The default **Gameplay isometric** camera is orthographic at 30° elevation, matching the established Blender evaluation at `(6, -6, 6 * sqrt(2/3))` in Blender's Z-up coordinates. The browser uses the equivalent Y-up offset `(6, 4.899, 6)`. The camera stays fixed across the eight soldier headings. Original measured reference spans preserve the 60 / 80 / 120 CSS-pixel standing heights.
- **Free 3D inspection** retains orthographic projection. Drag to orbit and pinch, scroll, or use the touch zoom buttons. **Side view** uses a horizontal orthographic camera relative to the selected soldier heading to expose foot placement and gait. Returning to gameplay resets the inspection camera and zoom.
- A plain ground plane receives realtime directional-light shadows from the actual animated geometry. A quarter-metre grid moves with the authored travel speed so in-place locomotion can be inspected against the ground.
- **Squad preview** puts six independently animated soldiers in one orthographic scene. Select a USMC squad, Russian squad, or mixed squad with three of each. A road, sidewalks, building corners, barriers, and crates establish scale. Formation spacing is 2.4 metres across and 4 metres between rows. The same 60 / 80 / 120 CSS-pixel reference applies; the view grows vertically to keep all six visible without shrinking them.
- Squad mode uses one WebGL renderer and shares geometry, materials, and textures within each faction. Skeletons and animation mixers remain independent. The camera is locked to gameplay view. Locomotion is an **in-place formation review**, rather than navigation through the buildings; the original authored gait and recoil play continuously, and no AI or pathfinding is added.
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

## Public deployment

Public preview: **https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/**

The preview is hosted separately through Sites, with public access and no login requirement. The existing `annous-warfare` GitHub Pages configuration remains an unchanged `main`-based Actions deployment. GitHub denied creation of a separate preview repository with HTTP 403, `Resource not accessible by integration`; Sites provides the independent public deployment instead.

The checked-in `dist/` directory is the ready static site. `source.json` identifies the animation source commit and exact GLB byte hashes. All runtime dependencies and assets are hosted at relative paths on the preview's own origin.

The persisted Site identity is in `.openai/hosting.json`. Reuse that project ID for future updates; do not register another Site. The Sites source mirror contains the exact static bundle and manifest at commit `53c3b9a5b4671b4406fcea46028d2a9cf830fa92`. Saved version 1 was published through Sites. `validation/publication.json` records the IDs and `validation/public-https.json` records anonymous HTTPS checks: the page and all nine referenced assets returned HTTP 200 and matched the tested bundle byte for byte.

The Sites source-helper scripts and managed browser tool were unavailable in this executor. The static mirror was pushed with the returned scoped credential through hidden stdin and transient Git authentication, then packaged under the documented static hosting contract. No credentials are stored in this repository. Public browser interaction on the deployed origin was not run; the identical bundle was tested locally in mobile WebKit and Chromium, and the public origin was checked without authentication using an iPhone Safari user agent.

## Verification

`tools/mobile-test.mjs` exercises iPhone 13 viewport and touch emulation in Playwright WebKit and Chromium. It checks real frame advancement, both faction downloads and hashes, all 38 motion/clip selections per faction, gait continuity during repeated recoil, burst stop while walking, reload recovery, eight 3D headings, display scales, touch playback, relative asset loading, and portrait/landscape overflow. It records browser errors and screenshots.

Camera checks assert orthographic projection, 30° gameplay elevation, fixed camera position across all headings, side-view elevation, inspection rotation and zoom, shadow receivers, and simultaneous locomotion/recoil with identical gait phase and recoil counts in two-soldier mode. The comparison panels stack on phones and sit side by side on wider screens. Both retain the same native standing height; this is not a perspective camera or a sprite transformation.

Squad checks exercise USMC, Russian, and mixed compositions; walking, sprinting, aiming, and moving fire; all three display sizes; independent skeletons with shared mesh buffers; one canvas/renderer; minimum spacing; urban reference objects; six visible foot/head positions; real playback advancement; and cleanup when returning to single-soldier view. Squad screenshots accompany the JSON results.

The recorded local run passed in WebKit 26.5 and Chromium 156 with zero browser errors or failed asset responses. Each faction preserved its walking action and phase while producing five recoil impulses during the sampled moving-fire burst. See `validation/local/mobile-validation.json` and its portrait/landscape screenshots. These tests used a project-path URL, matching Pages relative-path behavior; public HTTPS byte verification is recorded separately in `validation/public-https.json`.

To test any deployed site, set `PREVIEW_URL` to its public HTTPS URL, `REVIEW_OUTPUT` to an output directory, and run `npm test --prefix animation-preview-pages`. Install Playwright WebKit and its platform libraries first; Chromium uses `/usr/bin/chromium` in this cloud environment. `TEST_ENGINES` can select a comma-separated subset.

Browser emulation is not a physical iPhone test. The preview requires WebGL 2; physical-device performance, pinch gestures, and battery use have not been measured. Comparison mode requires two model downloads and two renderers; single-soldier mode remains available for lower memory use. The assets retain the source phase's flat-ground animation limitations; this publication adds no terrain adaptation or live combat integration.
