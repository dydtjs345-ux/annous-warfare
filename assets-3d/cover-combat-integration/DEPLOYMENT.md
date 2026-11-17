# Verified cover-combat preview deployment

Published 2026-11-17 UTC, separately from the playable game:

**https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/cover-combat/**

- GitHub feature branch: `feat/cover-peek-fire-integration`.
- Implementation commit: `7677b95598bd9ab0393ea3bac5a53b9fdb9af0e5`.
- Separate preview Site: `appgprj_6af0d17863348191b4ea48163f305325`, existing public audience preserved.
- Exact pushed hosting-source commit: `959e056294f372cbfb0bb7a683a161f395399938`. The hosting repository's `main` is separate from the game's GitHub `main`.
- Saved version: **19**, `appgprj_6af0d17863348191b4ea48163f305325~appgver_7fb979ad93a4819186fe11218b1ec195`.
- Deployment: `appgdep_6afbfdce068c8191924f67f42973de16`, native status **succeeded**, 2026-11-17T07:10:31.181619+00:00.

Anonymous HTTPS verification downloaded and compared **246 served files** against the committed site output, including all **21 new cover-route files**. All 226 files in the previous local preview snapshot remain byte-identical; its 225 served files also passed the anonymous download check (`.nojekyll` is not a served page). Native publication success and HTTP checks are separate from browser playback testing.

Review recordings:

- [Left/right peek, low-cover fire and return — isometric](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/cover-combat/recordings/priority-iso.mp4)
- [The same actions — side view](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/cover-combat/recordings/priority-side.mp4)
- [Corrected standing M16 / crouched AK cover exit](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/cover-combat/recordings/cover-exit.mp4)
- [Both rifles and stances / rear inspection](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/cover-combat/images/variants.jpg)

These are **offline Blender renders of the actual final exported animation playback**, sampled at 12 poses per second at real-time speed, encoded as H.264 24fps with duplicated frames. They are not browser screenshots or evidence of mobile frame rate. The interactive Korean viewer uses the actual rig, 104 real animation clips, deterministic contact constraints and a 30fps target, with 1× and half-speed controls.

The model is 6,902,436 bytes, M16 motion patch 9,356,096 bytes; initial optional 3D input is **16,258,532 bytes**, with AK motion fetched on demand. Individual server-side curl transfers measured about 0.22s and 0.27s after deployment. These measurements are **not iPhone/Safari loading time, memory or FPS**. No browser GPU or physical Safari QA was possible. Narrow screens display lightweight review media before optional 3D loading; the platform did not honor MP4 Range requests, so the viewer fetches a selected short recording as a Blob.

The existing GitHub game and separate combat test entry HTML match their pre-task SHA-256 snapshots. GitHub `main` remains `b381e6017d01fa34f14e889ff639347db9e5feae`. All 1,085 old repository files match their baseline Git blobs. No AI, map, squad system, approved locomotion clip, original model or original preview file was modified. No merge was performed.

See [README.md](README.md) for exact motion sources, derived-motion disclosure, licenses, clip list and limits. Detailed checks are in `validation/deployment-http.json`, `controller.json`, `*-export*.json`, `asset-merge.json`, `exit-contacts.json`, `exit-isolation.json`, `media.json` and `preservation.json`. Arbitrary cover-height adaptation, exhaustive triangle/self-collision checking and actual browser/device visual QA remain outside the verified result.
