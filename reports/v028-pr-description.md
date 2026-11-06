Adds read-only soldier posture/movement/security cues, a Korean soldier inspector with expandable/closable mobile panel, and an 18-entry per-soldier observed decision history. Existing combat/AI modules and original animation renderer are byte-identical to merged v0.2.7.

Validation: 220 passing tests, successful production build, 40 final matched full-match comparisons (80 executions), an initial 80-execution comparison, and 200 preserved legacy hashes. Total recorded complete executions: 360. Mobile Chromium selection, native scroll, close/reselect, orientation, pan/pinch and 1×/2×/4× pass.

Limits: physical iPhone Safari unverified; history samples at 10Hz and can miss brief transitions; 101 direct state/reason literals and observed common conditional explanations are translated, while unrecognized dynamic reasons use an explicit Korean fallback. No combat balancing or automatic merge.

Full audit: reports/v028-soldier-readability-audit.md
