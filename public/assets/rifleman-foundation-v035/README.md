# Rifleman foundation — laboratory only

`e-static-prototype.png` is original image-authored art, using our corrected SE
character as its design reference. It is a four-stance **static prototype**,
not an animation sheet, source-concept crop, mirrored SE sprite or final asset.
It is not admitted to live combat.

1254×1254 RGBA; 2×2 cells, 627px square. Pose order: idle carry, low ready, high
ready, shouldered aim. All hands, arms, torso, equipment and rifle are baked
together. Cell-aligned foot root `(293,598)` and solid bounds are recorded in
JSON. Uniform scale `displayHeight / 581`; no anatomy warping. The approximately
1px sole-envelope variation is less than 0.1px at 39px display size. The aiming
pose's head drops naturally; it is not stretched to equalize every silhouette.

No breathing, walking, raising, lowering, recoil, turn, strafe or transition cels
exist for E. Do not interpolate the four static pictures to claim those actions.
No fine joint/grip/stock/contact metadata is fabricated. The laboratory keeps
missing actions empty with their actual reason, alongside the unchanged SE
reference. Production quality and temporal consistency remain unapproved.

## Artist delivery contract

Finish and review one direction before authoring the next. Prefer transparent
PNG banks plus JSON. Match the detailed corrected SE character's anatomy,
desert camouflage, helmet, vest, pouches, radio, backpack, gloves, boots and
M16A4 silhouette. Author asymmetric kit separately in each view.

For each bank supply:

- Direction, lighting reference, native standing-height scale, cell dimensions,
  grid, transparent padding, per-cel solid bounds and foot root.
- Real frame durations and explicit clip/transition identity. A static high-ready
  pose is not a raise sequence. Idle carry and low ready may not be silently
  relabeled as independent breathing animations.
- Contact foot(s), planted-foot coordinates, hip/knee/ankle phases and travel per
  gait cycle, including start/stop poses. Identify joints requiring cleanup.
- For whole-body cels, keep hands/rifle/shoulders integrated. For layered art,
  deliver lower body and **entire upper torso, both arms/hands and rifle** with
  measured common pelvis seam, shoulder, stock, trigger/support hand and muzzle
  sockets. Upper/lower must use the same native scale. No gun-only rotating layer.
- An explicit reviewed pairing list for movement/aim directions, gait and weapon
  pose. Without a reviewed pair, the engine refuses composition. Artist fixtures
  in unit tests are geometry tests, not production artwork.
- Pose and turn edges, interruption/recovery frames, planted-foot phase
  compatibility and transition quality review. No turn frames currently exist.

Quality gates: anatomy, equipment continuity, foot grounding/weight transfer,
hand-to-rifle/stock alignment, pose transitions, readability at 39px, and style
match at 4×. Record failure honestly; do not mark a bank `verified` solely because
PNG dimensions or tests pass. Even verified lab art needs an explicit later
integration decision; `autoAdmitToCombat` is false.

[Audit and remaining artwork](../../../reports/v035-asset-audit.md).
