# Korean infantry preview with tactical review

This folder extends the preserved `66d3892` standalone preview with the new tactical catalog, paired-layer playback, cover references and a continuous world-travel demonstration.

Existing Site identity is retained in `.openai/hosting.json`. The public origin remains https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/ . New tactical review opens with `?review=tactical`.

Build from the repository root using `node animation-preview-pages/tools/build-tactical.mjs` after preparing the source cache. The build retains existing review media and all earlier clips, adds versioned tactical GLBs, and bundles for Safari 15.4+ syntax. Runtime Safari verification is tracked separately.

See [the tactical asset report](../assets-3d/tactical-combat/README.md) for clip names, source files, validation, limitations and reproduction instructions. The live game and isolated 6v6 combat test have separate deployment identities and are preserved.
