# Before editing: exported crawl torso diagnosis

Baseline originals: `aa650ce`. Previous revised crawl: asset commit `9d195c9`, preserved at branch parent `e94ec93`. This revision uses a separate branch, `feat/crawl-torso-weight-transfer`.

The actual prior GLB animation tracks and source Actions were inspected before authoring changes. Both factions' root, pelvis, five spine joints, clavicles and shoulder helpers were checked in the existing browser player. Source/browser joint positions match within 0.0014 mm; independently interpolated exported tracks match the applied node properties. Both layers have weight 1 and disjoint bindings. Movement is not missing from the exported clips or suppressed by a competing playback layer.

The rig's `root` carries the pelvic frame. `pelvis.L/R` are helpers parented to it; their constant local rotation does not mean the pelvis is stationary. The five deforming spine joints run `spine05 → spine04 → spine03 → spine02 → spine01`; clavicles and shoulder helpers descend from the upper chest. The hierarchy supports relative pelvis/lumbar/rib-cage motion without a skeleton rewrite.

| Previous revised joint | Local angular range | World angular range |
| --- | ---: | ---: |
| Root / pelvic frame | 11.77° | 11.77° |
| Lower lumbar `spine05` | 3.47° | 8.53° |
| `spine04` | 2.95° | 6.00° |
| `spine03` | 2.57° | 5.94° |
| Main rib cage `spine02` | 2.18° | 6.36° |
| Upper chest `spine01` | 1.67° | 6.98° |
| Clavicle | 5.60° | approximately 9–10° |
| Shoulder helper | 0° | inherited clavicle motion |

These ranges are diagnostics, not quality targets. The previous counterrotation largely steadies the chest while the limbs perform large strokes. It has no distinct loaded waist curve or chest-over-support-side path. Clavicle corrections account for contact reach, but shoulder movement reads primarily as vertical adjustment rather than a deliberate advancing/retracting girdle.

Skin inspection also matters: approximately 68–69% of the rib-cage region's summed skin weights belong to `spine02`. The waist blends several spine joints and some rigid equipment weighted to root. The rigid vest/backpack limits visible soft-tissue motion, but does not prevent meaningful whole-rib-cage turning and lumbar articulation. Skin weights and original models will be preserved; the motion must work through the existing deform joints.

Planned mechanics: acquire left forearm + opposite leg support, move the trunk projection toward that side, turn the pelvic frame with knee recovery, flex the lumbar region laterally, rotate the rib cage independently as the shoulder pulls, unload into a controlled bilateral handoff, then mirror for right support. Keep the existing 2.4 s cycle, 0.23 m/s actor translation and normal playback rate. All changes will be keyed into only the existing forward-crawl pair, without runtime body offsets or random sway.

Evidence: `validation/*-before-source.json` includes source hierarchy, skin-region weights and actual sample poses. `validation/before-playback.json` includes exported track inventories and direct browser/source comparisons.
