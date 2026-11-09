# Source attribution

The adult anatomy, morph targets, skeleton and initial weights share the USMC asset's CC0 MakeHuman data. `anatomy-provenance.json` and `LICENSE-MakeHuman-CC0.md` are verbatim copies of that asset's source records. Their file paths describe the original `../usmc-rifleman/source/third-party/` input directory, which is read only in this task.

The Russian model reuses that anatomical foundation and the repository's equipment/export/pose utilities. Its EMR-style material palette, modified helmet/protection, armor, pouches, belt, pack layout and AK-74M geometry are authored in `../tools/build_infantry.py` and the accompanying utilities. No external generated character mesh or unlicensed military model was imported.

`Russian_Infantry_Geometry.blend` retains procedural material construction before baking; `Russian_Infantry.blend` retains the same editable geometry with packed baked PBR images. The static low-ready project poses this same base mesh and skeleton. These projects are not additional role-specific characters.
