# USMC SE full-body animation candidate (v0.3.2)

`source-atlas.png` is a new original, tool-generated transparent RGBA atlas,
created for this SE-only prototype. It is not extracted from the user's concept
sheet, any game screenshot, or proprietary sprite art. A second generation pass
corrected insufficient cell gutters/a clipped walk boot in the first candidate.
The original generated output is committed unchanged; no cropped concept poses
or procedural stick-body components are presented as production artwork.

- 1024×1536 PNG, 4 columns × 6 rows, 256×256 logical cells, 24 complete body cels.
- Row 0: four low-ready/idle cels. Rows 1–2: eight walking cels.
- Row 3: four rifle-raise cels. Row 4: shouldered aim/recoil/recovery cels.
- Row 5: four rifle-lower cels.
- All are the same SE quarter-view. No other new directions.
- Root under the pelvis: `(132,241)` in every cell; native upright span ~200px.
- Game display height: 30 / 39 / 45px before camera magnification.
- Both hands, arms, shoulders, torso, gear and rifle are part of **one cel**.
  There is no independent weapon object or runtime limb stretching/rotation.
- Muzzle points in `metadata.json` annotate barrel tips for demo-only flashes.
  No muzzle flash is painted into the source. This is not ballistic data.
- Phaser selects whole cells and uniform transforms; no runtime image generation.
- This is an isolated animation preview, not an eight-direction battle renderer.

**The supplied reference-quality artwork requirement is NOT satisfied yet.**
The equipment is more convincing than v0.3.1, but generated fabric/pouch details
vary between cels. Gait weight transfer, exact planted-foot travel, the loop seam
and direction-specific weapon perspective need a dedicated sprite artist's
cleanup and approval. Native microtexture is illustration-like rather than a
fully hand-authored limited-palette pixel grid. Do not call this finished
production art or an authentic historical equipment reconstruction. The preview
is designed to expose these limits at real game scale and enlarged, not hide
them behind test counts. Further directions await visual approval.

No runtime image-generation service/dependency, AI gameplay changes, or copied
reference pixels. Python/Pillow was used only to inspect bounds/alpha and write
metadata; the PNG is the original generated output.
