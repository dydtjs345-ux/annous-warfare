# Verified delivery — 2026-11-16

- Branch: `feat/tactical-suit-character-comparison`.
- Recovered work checkpoint: `8e7b05e7b9259ee85857f171eabd87b0e0a6faa7`.
- Validated implementation and published manifest commit: `04103dec776129d0d5508ff96d64ff582e58a8a3`.
- GitHub main was rechecked after publication and remains `b381e6017d01fa34f14e889ff639347db9e5feae`. No merge was performed.

Public URLs:

- [Korean unified infantry review](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/infantry-integration/)
- [Original USMC versus actual Tactical Suit appearance/motion](https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/tactical-suit-review/)
- [Full implementation/research/limits](README.md)

The actual character is DanlyVostok's CC BY 4.0 Military tactical suit (LowPolyGameReady), acquired from its credited pinned mirror. Quaternius CC0 walk and sprint remain separate imported motions; source-preserved idle and tactical sprint were retargeted additionally. No original USMC body is substituted. The external Russian skin/weapon variant, external crawl/cover/aim/fire/reload, blind fire and crouched reload are not completed or represented by fake substitutes.

Publication used the existing public preview Site, preserving its audience. The Site hosting repository is separate from the game repository. Its source commit is `6ce6ab63ea24aedb31d3adf76f9d8eb34368e01b`; updating that repository's hosting branch did not change or merge the game's GitHub main branch.

Saved Site version **17**: `appgprj_6af0d17863348191b4ea48163f305325~appgver_dc3c163bb82c8191aea464557c99412e`. Deployment `appgdep_6afb668eccd88191ae6a75ddb69491ff` returned terminal **succeeded**. An environment restart interrupted the save response; the version was recovered through version history and deployed once, rather than recreating it.

Anonymous HTTPS verification compared **199 public files** against the packaged output, including both actual-model GLBs, both review pages, JavaScript, models, images, movies and credits. **156 prior Site files** remain exact; the only prior runtime edit is the requested motion-only label/link correction in `/open-asset-review/index.html`. Protected game entry points remain exact:

| Build | Verified SHA-256 |
|---|---|
| Live GitHub Pages game | `dd18bd9ccd543f4d95dbd8acbe7d5eb1e47f6011b93b8df22ff94a30f2c273cc` |
| Separate 6v6 combat test | `6a050fc31fe0291174e4ebcd45e1899873de597596eef6edf264501b9ff10600` |

Actual integrated model SHA-256: `dedb449bc98f55fd2d1f96b414476e85d3b26ba62a57180db8278dbc1d665126` (4,530,116 bytes). The earlier two-clip actual-model comparison uses `b1a1d002478a9a573b98d6069242356b37df4223afbdc345360451acbc545ac7`. The original USMC and Russian GLBs are still the preserved `112592f71ac7…` and `46d44c1bbdf5…` files.

The unified page adds 7,107,355 bytes across 19 files, excluding reused original models already hosted at the root. Its default USMC plus external model GLBs total **20,155,152 bytes**. This is a payload measurement, not a loading-time, memory or FPS benchmark. The separate recorded-comparison page totals 8,137,056 bytes across 24 files and loads its selected image/movie as needed. The host ignores video byte ranges; the pages fetch selected short MP4s into local Blobs for seeking, with static comparison images available.

**Verification boundary:** exported GLBs, actual animated phase renders, CPU state-controller playback, build consistency and public asset delivery were checked. Browser execution, mobile layout on a device, WebGL FPS/memory and physical iPhone Safari were not tested. The managed Sites skill disallows substitute browser paths when its required CUA interface is absent. No browser or mobile pass is claimed.

Remaining work is precisely recorded in `README.md` and `research.json`: authorized usable cover/crawl sources, license/format resolution, further external-model weapon/stance retargeting, cover/crawl endpoint/contact review, an external Russian variant if desired, and real browser/mobile validation. Source archives used only for research remain in `/workspace/animation-recovery-downloads`; restricted Kevin source files were not published. All reusable validated work is committed and backed up.
