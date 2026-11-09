# Korean mobile infantry animation preview

Public preview: https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/

The current motion revision is **sprint-review-2**. The rebuilt sprint is **opt-in, awaiting visual approval**. Ordinary `Sprint` still plays the previous FB sprint. No original game, AI, character geometry, skin weights, 163-bone rest hierarchy or old animation is changed.

- [OLD / NEW sprint](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/?review=sprint)
- [Walk / NEW sprint](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/?review=sprint-walk)
- [Actual 9.12m travel](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/?review=travel)
- [Sprint report and normal/slow moving comparisons](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/sprint-report.html)
- [Earlier full-body moving-fire comparison](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/?review=body&state=MovingFire&markers=1)

## Controls and motion

Korean is the default; English switches without reloading assets. There are **22 motion choices and 44 individual clip choices**. Existing technical IDs and option values remain unchanged. Original individual clips are explicitly identified; `SR_` clips are separate sprint candidates.

Gameplay camera is fixed orthographic at30° across eight real3D soldier headings. Free inspection has touch orbit, pinch and zoom buttons. Fixed side and front cameras show gait/deformation. Scales are60/80/120 CSS-pixel standing references; posture changes visible height naturally. One renderer compares OLD/NEW with identical camera, scale, ground and lighting. USMC/Russian comparison and six-soldier same/mixed-faction modes remain available.

New running carry, pelvis/spine compensation and foot contact paths are authored together, then exported as synchronized lower/upper masks. The route applies authored acceleration/deceleration distance to the **soldier assembly**, over fixed ground and a fixed30° camera. Blender forward -Y maps to GLB forward +Z; a world-space planted-foot test guards against backward travel. Normal in-place mode instead moves ground in the opposite direction. Moving fire and weapon-specific reloads remain available and retain their original data.

See [sprint technical documentation](../assets-3d/sprint-rebuild/README.md) for the measured root cause, motion contract, source projects, contact diagnostics and limits. The earlier upper-body work remains documented in [full-body-debug](../assets-3d/full-body-debug/README.md).

## Build and validation

```sh
npm ci --prefix animation-preview-pages
npm run build --prefix animation-preview-pages
npm run test:dom --prefix animation-preview-pages
npm run test:motion --prefix animation-preview-pages
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright npm test --prefix animation-preview-pages
```

Node22+, Blender4.3.2 and Python3.12 are used. The build verifies original `a1d2804` hashes, packages `assets-3d/sprint-rebuild/models`, and includes reports/movies. Each GLB preserves all34 previous clip definitions and the previous binary buffer, mesh nodes and skins; ten new animation layers are appended. Model filenames contain SHA-256 prefixes, the manifest is fetched without cache, model bytes are verified before playback and HTML JS/CSS URLs are cache-versioned. All runtime resources use relative same-origin paths; no CDN/import-map dependency is required. Safari15.4+ is the bundle target.

DOM tests verify every Korean/English label, preserved options, errors and review links. Motion tests use actual Actor/mixer methods for66 states/clips per faction/profile, new transition recovery, phase masks, preserved default sprint, continuous moving fire, reload restoration,9.12m travel and world-space foot contact. The public Chromium suite compares all163 source joints through the five new compositions, tests eight headings/scale/cameras, both-faction and six-soldier views, touch play/pause, loaded hashes, actual fixed-ground travel, and records normal RAF playback at normal/slow speed. A result is successful only when `assets-3d/sprint-rebuild/diagnostics/browser-after.json` has `passed:true`.

Tests use desktop Chromium software rendering with an emulated iPhone layout. **Physical iPhone Safari/WebKit and mobile GPU performance are not verified.** Cloud browser recordings run slowly; the separate Blender movies evaluate actual3D geometry at30Hz. Flat-ground motion, specified transition entry/exit phases and visual review are the scope; terrain adaptation, arbitrary interruptions and live combat integration are not implemented.

## Deployment

Reuse the existing Site identity in `.openai/hosting.json` and preserve its public audience. Its generated static source mirror is separate from this GitHub feature branch and the playable game's GitHub Pages deployment. Do not create a new Site or replace the game.

`dist/` is the complete static bundle. Current publication and deployed-file verification are recorded in `assets-3d/sprint-rebuild/diagnostics/publication.json` and `public-https.json` when those operations have completed. The historical mobile tests/upper-body reports refer to their recorded earlier revisions; `npm test` selects the sprint candidate suite.
