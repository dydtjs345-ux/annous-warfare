# Add the preview to the existing game site

Target: **https://dydtjs345-ux.github.io/annous-warfare/animation-preview/**

This is a proposed deployment target, **not a verified live preview**. It returned HTTP 404 during this investigation. The existing game remains at https://dydtjs345-ux.github.io/annous-warfare/.

## Findings

- Pages uses GitHub Actions (`build_type: workflow`). `.github/workflows/deploy.yml` builds `dist/` and publishes that whole directory on pushes to `main` or manual dispatch.
- The `github-pages` environment has a custom deployment branch policy permitting **only `main`**. Dispatching this feature branch cannot publish through that policy. We have not changed or bypassed it.
- The existing workflow already grants `contents: read`, `pages: write`, and `id-token: write`. No new token, separate repository, Pages source change, or environment policy change is required for the proposed merge-based route.
- The last successful game deployment is run `42397239474`, main commit `b381e6017d01fa34f14e889ff639347db9e5feae`. Its artifact is no longer listed, so every file in a fresh build of that commit was compared directly with the live site instead: **all 27 files match byte for byte**.

## Proposed change

Branch `feat/pages-animation-subpath` starts from the currently deployed main commit, rather than the experimental animation branch. Only the completed `animation-preview-pages/` folder is copied from `afce5d0`, along with the staging/verifying scripts and workflow changes. Original animation sources and game code are untouched.

After the normal game build, `scripts/stage-animation-preview.mjs` adds the committed static bundle to `dist/animation-preview/`. It validates the source commit and both GLB hashes, refuses an existing route, and verifies that every preexisting game file keeps its exact bytes. The existing `animation-preview.html` page and root assets remain in place. Both the game and preview are uploaded together; uploading the standalone preview alone would replace the game and must not be done.

The bundle retains the 30° orthographic gameplay camera, free and side inspection, all clips, layered moving fire, two-soldier comparison, and single-faction/mixed six-soldier urban scenes. All runtime references are relative, including `./models/…`. Vite continues to use `/annous-warfare/`; no Vite configuration or live renderer change is needed.

The pull-request check builds and stages the combined site with read-only repository permission. It cannot deploy. The existing production workflow still deploys only on a main push or explicit manual dispatch.

## Approval and deployment steps

1. Review the pull request from `feat/pages-animation-subpath` into `main`, including the added staging step in `.github/workflows/deploy.yml`. **Approve its merge** if the combined deployment is acceptable. No merge has been performed by the assistant.
2. Merge the approved PR into `main`. The push automatically runs **Deploy game to GitHub Pages**. Leave Settings → Pages → Build and deployment set to **GitHub Actions**, and leave the `github-pages` environment's allowed branch as **main**.
3. Wait for both the build and `deploy` job to succeed. If automatic deployment did not start, use Actions → Deploy game to GitHub Pages → Run workflow → **main**. Do not choose the feature branch.
4. Verify the target URL and root game before announcing publication. From a checkout of the exact deployed main commit:

   ```sh
   npm ci
   npm run build
   node scripts/stage-animation-preview.mjs
   node scripts/verify-pages-preview.mjs https://dydtjs345-ux.github.io/annous-warfare/
   ```

   The verifier requests every game and preview file over HTTPS, including the actual `/animation-preview/` directory URL, checks HTTP 200, rejects unexpected redirects, and compares bytes with the matching local artifact. Allow normal Pages propagation if the deployment has just finished; a failed verification is not success. Clients behind an HTTP proxy must enable their Node runtime's environment-proxy support (Node 24: `NODE_USE_ENV_PROXY=1`).
5. On an iPhone, select Gameplay isometric, both factions, two-soldier comparison, and the six-soldier/mixed presentation modes. Check playback, headings, sizes, touch orbit/zoom, and moving fire. Physical-device performance remains unmeasured by the cloud tests.

If the connected GitHub integration rejects pushing workflow files, the account owner must push these workflow changes with a credential permitted to modify Actions workflows (fine-grained **Workflows: write**, or classic `workflow` scope), or apply the reviewed workflow diff through GitHub's editor. Do not expand Pages deployment access to all branches. This is a contingent credential requirement, not a Pages setting change.

## Validation evidence and rollback

- `validation/pages-live-game-baseline.json`: fresh main build versus all 27 live game files.
- `validation/pages-stage.json`: unchanged game bytes and complete preview inventory after staging.
- `validation/pages-mounted-assets.json`: exact asset bytes served under `/annous-warfare/animation-preview/`.
- `validation/pages-path.json`: focused mobile WebKit/Chromium nested-path checks, including both factions and six-soldier moving fire.
- Existing `validation/local/` results cover the unchanged full preview behavior. They are not proof of publication to GitHub Pages.

If the added preview must be withdrawn after merge, revert the integration PR and let the normal main deployment run again. That restores the previous game-only artifact. Do not change the Pages source branch or deploy a preview-only artifact as a rollback.
