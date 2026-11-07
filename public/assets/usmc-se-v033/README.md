# v0.3.3 SE anatomical refinement candidate

Original v0.3.2 atlas retained unchanged in `../usmc-se-v032/` for comparison.
This PNG is a new image-editing redraw of that atlas, preserving its 4×6 grid,
24 pose identities and detailed desert military texture. It is not a whole-body
vertical stretch, a concept-sheet crop, or a procedural geometric replacement.
The edited PNG is committed as returned, without runtime limb/torso warping.

Art direction used the requested starting guides: approximately 10–15% longer
apparent legs, 5% smaller helmet and 5–8% narrower torso. These are **not certified
pixel measurements** of every cel. Visible hips/waist, knee positions, arm/shoulder
relationships and equipment placement were redrawn across all poses, then
reviewed side by side at equal display height. Existing generated-cloth/gear
variation and imperfect gait weight transfer remain artist-cleanup work.

- RGBA 1024×1536, 24 complete human/weapon cells of 256×256, **SE only**.
- Registered ground origin `(132,246)`; v0.3.2 stays `(132,241)`.
- Native upright envelope ~205px versus the original's 200px. Each is uniformly
  normalized to **39px** in the default preview; anatomy is in the pixels,
  not an anisotropic scale setting. Normal 30px/45px alternatives remain.
- Metadata preserves logical cell identity and annotates the revised drawn muzzle.
  Rifle, shoulders, hands and equipment remain part of one full-body cel.
- Same unmodified v0.3.2 pose clock, timing, cue events and clip ordering.
- GPU texture is 6,291,456 RGBA bytes. Both comparison views share each bank's
  texture; no per-frame texture generation, external service or new dependency.
- Solid alpha bounds were inspected for clipping. That check does not prove
  anatomical correctness or exact planted-foot biomechanics.

This is a proportion-review prototype, not an approved final military sprite.
Precise joint/foot-contact authoring, temporal kit consistency and transition
in-betweens still require visual/artist review. No other new directions or battle
renderer conversion are included. No simulation, geometry, RNG or AI changes.
