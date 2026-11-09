# Coordinated tactical reloads

This extension adds M16A4 and AK-74M retention reloads to the existing infantry preview. It leaves the original character sources, 163-bone rigs, weapon mounts, skins, and all 21 original exported clips unchanged. No game or AI code is changed.

The M16A4 sequence lasts 3.7 seconds; the AK-74M sequence lasts 4.1 seconds. Both begin and finish in the original shouldered aiming pose. The whole rifle lifts and cants toward the torso while the spine, clavicles, head, wrists, fingers, and planted stance respond. Eased trajectories include alignment pauses, magazine seating checks, and a faster return to the sight line. The old magazine is removed and stowed; a separate replacement comes from an adjacent front pouch. M16A4 insertion follows a straight path. AK-74M insertion pivots around the front lug before the rear catch seats. These are chambered-round tactical reloads, so they do not include an empty-chamber charging cycle.

## Assets

- `source/{USMC,Russian}_TacticalReload.blend`: standalone packed-texture projects, with original Actions retained plus the new authored Actions and active reload NLA tracks.
- `models/{USMC,Russian}_TacticalReload.glb`: complete character exports containing the two new reload clips for export/reimport validation. These are **not replacements** for the original 21-clip game assets.
- `curves/{USMC,Russian}-reload.json`: compact glTF-derived keyframes loaded by the browser onto the original unchanged GLBs.
- `Reload_Tactical`: upper-body and magazine-object tracks; `Reload_Tactical_Lower`: planted stance and weight shift. Their UUIDs are distinct. The browser isolates magazine tracks from upper-body crossfades.
- `review/{USMC,Russian}-{normal,slow}.mp4`: original/improved side-by-side continuous recordings at 1× and 0.5×. Slow motion uses actual 60 Hz evaluations of the 3D animation. It does not interpolate screenshots.
- `review/*-phases-*.png`: detailed pose comparisons. `review/*-native-{60,80,120}.png`: comparisons rendered at native gameplay standing-reference heights, with no resizing of soldier images.

The weapon remains a separate object parented to the original right-wrist mount. Both magazine objects retain the original weapon hierarchy; baked relative transforms maintain their hand-carried positions. Visibility changes occur while fully occluded inside a pouch. At recovery, the seated replacement is exchanged for the identical canonical seated magazine without a spatial jump.

## Validation

Run the authoring scripts with Blender 4.3.2 and the Node tools with the preview's installed Three.js dependencies. `author_reload.py` accepts `AW_FACTION`; `render_review.py` accepts `AW_FACTION`, `AW_VARIANT`, `AW_RENDER`, and `AW_ENGINE`. The packagers use Pillow, Noto Sans CJK, FFmpeg, and temporary frame directories described in their source.

Recorded results are in `validation/`:

- `glb-validation.json`: 163 joints per faction; both new clips; Khronos glTF validation has zero errors and zero warnings. Informational unused-accessor notices remain.
- `reimports.json`: isolated Blender GLB reimport verifies hierarchy, bone positions, weapon/magazine transforms, and deformed surface bounds against authored samples. Maximum differences are below 0.01 mm.
- `contacts.json`: planted foot targets remain fixed; source palm/magazine contact error is below 0.01 mm. Rifle origin lifts approximately 16.7 cm / 13.8 cm and changes orientation about 36°. M16 insertion lateral error and AK front-lug drift are below 0.01 mm; AK rock-in rotation is approximately 23°. All eight headings occlude magazine visibility events.
- `runtime-retarget.json`: actual Three.js mixers apply the exported curves to the unchanged original GLBs. Sampled trajectories match within 0.01 mm; interpolated palm contact is checked at 120 Hz with a 5 mm tolerance.
- `controller.json`: exercises the actual preview Actor controller, original/improved reload completion, magazine restoration, other motion states, and gait continuity from aiming walk to moving fire.
- `*-authoring.json`: original Action fingerprints and authored trajectories. `packed-sources.json`: packed texture check. Video/native reports describe camera and packaging checks.

The review recordings use Blender Workbench textured studio lighting with a fixed 30° orthographic camera and the existing gameplay scale calibration. The interactive preview retains its existing PBR renderer, camera, contact shadows, eight headings, faction comparison, and six-soldier squad scene.

## Review and limits

In the Korean preview choose **보기 모드 → 재장전 원본 / 개선 비교**. Select the faction, then **재장전 · 보통 속도** or **재장전 · 느리게**. The left panel uses the untouched original reload; the right uses this extension. Both use a shared clock. Size and direction controls remain available. The expandable **재장전 비교 영상** provides both factions' normal/slow recordings independently of WebGL.

These are authored, sampled skeletal Actions for a stationary, flat-ground retention reload. They do not add moving reloads, empty-weapon reloads, terrain adaptation, arbitrary interruption logic, or live combat integration. Contact checks cover defined gripping intervals; they are not a complete mesh self-collision proof. Small-scale visual review used actual Blender renders. The managed Sites browser tool was unavailable for this revision; new WebGL interaction, Safari layout, and physical-iPhone performance have not been visually re-tested. Public HTTPS verification is reported separately and must not be interpreted as a device test.
