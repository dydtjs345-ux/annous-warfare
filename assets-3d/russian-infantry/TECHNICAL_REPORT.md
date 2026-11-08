# Russian infantry base: delivery and technical review

## Scope and structure

One Russian faction base accompanies the existing USMC base. Both Russian poses use the same mesh and rest skeleton. No separate rifleman, squad leader, machine gunner or medic bodies were created. Optional medic accessories and later weapons are not included.

The 1.78m adult anatomical foundation and 163-bone reference rig reuse the existing licensed CC0 MakeHuman inputs. Equipment is adapted and rebuilt from the repository's modeling utilities: EMR-style digital cloth, 6B47-inspired covered helmet with retention loops and stowed protective goggles, 6B45-inspired olive armor with abdominal protection, four tall AK pouches, belt/utility equipment, five-finger gloves, black combat boots and a patrol pack with side pockets. These are recognizable visual interpretations, not manufacturer-certified reproductions. Anatomy was not exaggerated for faction recognition.

| Mesh | Editable vertices | Triangles |
| --- | ---: | ---: |
| Russian character | 31,770 | 59,434 |
| AK-74M main assembly | 1,982 | 3,744 |
| Detachable magazine | 152 | 276 |

The helmeted character is approximately 1.817m tall. The rifle is 0.9435m overall. Source units are metres, Z up, forward −Y. Character transforms are identity; the kit rifle is parked separately. GLB exports convert to standard Y up. Character and rifle use separate UV atlases with baked base color, roughness, metallic and tangent-space normal PNGs (2048² character, 1024² rifle). GLBs and FBXs embed textures; standalone PNGs are also provided for FBX importers that require manual PBR reconnection. Blender projects pack the images.

## Shared skeleton and handling

All 163 bone names, parent links and rest matrices match `USMC_Rifleman.blend` exactly: maximum matrix-element difference **0.0**. The A-pose has identity pose transforms. Every character vertex has at most four normalized influences; maximum weight-sum error is approximately **5.22e−8**. This verifies structural compatibility, not full deformation or animation acceptance.

The low-ready source contains one authored static pose. The shared two-segment arm solver preserves arm lengths; finger bones establish the grips. Wrist-target errors are below **0.00013mm**. Actual evaluated hand geometry has 190 right-hand and 211 left-hand vertices within 5mm of the rifle; front, quarter and side images support connected two-handed handling. These measurements do not prove a collision-free hand volume at every finger.

`AK74M_Separate_Weapon` is a rigid replaceable assembly, with child `AK74M_Magazine` and six child markers: `attach_grip_R`, `attach_support_L`, `attach_muzzle`, `attach_magazine`, `attach_stock`, `attach_bolt`. Parenting is preserved through GLB and FBX reimport. The weapon origin is the grip datum; marker coordinates define palm contact offsets. An animator can constrain the rifle to the right hand, solve the support hand from its marker, and detach the magazine during a reload. This task does not install those runtime constraints or modify existing animation systems. The bolt marker is a reference; the internal bolt and trigger are not articulated.

## Isometric comparison

The pipeline matches `feat/usmc-isometric-evaluation` (`e4a1008`): orthographic camera at 30° elevation/−45° azimuth, projected ground basis `(20,10)` and `(−20,10)`, fixed three-area-light setup, AgX and 96-sample CPU Cycles. Eight headings rotate the complete 3D assembly. No mirrored or rotated 2D images are used.

There are **8 large renders**, **32 native renders**, **4 native comparison sheets**, an eight-direction overview and two large USMC/Russian detail comparisons. USMC images are the unchanged reference renders. Each pair uses equal projected figure height and the same background/lighting conventions. Russian alpha-threshold extents measure exactly 40, 60, 80 and 120px; reference USMC antialiasing gives occasional one-pixel differences, labelled in the sheets.

Visual review: the tan/green palette and black Russian boots provide the strongest 40px distinction. At 60px, the lower helmet/goggles, armor coverage, pack profile and AK iron-sight/curved-magazine outline contribute more. Front/rear foreshortening and torso occlusion limit rifle identification; weapon detail alone cannot identify factions at 40px. At 80–120px equipment and two-handed handling are clearer. This is an inspected static comparison, not a blinded recognition test or live-game visibility/performance validation.

## Validation and preservation

Final Khronos validation: **0 errors, 0 warnings on all three GLBs**. Asset checks pass for indices, finite coordinates, volumetric geometry, zero-area triangles, UVs, normals/tangents, PBR images, normalized skin weights, scale and separation. All **six GLB/FBX exports** reimport successfully into isolated fresh Blender scenes, with decoded embedded images, matching bone names and preserved magazine/socket hierarchy. The fresh-import GLB is also rendered for review.

The rifle and magazine have zero boundary/nonmanifold edges. The character has 2,820 boundary edges across garment/anatomical cuts and separate detail surfaces/caps; it is a layered game mesh, not a watertight printable volume. All source meshes have zero loose vertices, finite coordinates and no zero-area faces. Coincident wire caps are welded and the redundant internal muzzle-brake cap is removed. Helmet cover tabs conform to the shell.

The preservation audit compares every existing USMC file against its Git blob, checks that `main` still points to `b381e60`, and rejects tracked changes outside this new asset directory. No gameplay, AI, combat, renderer or existing animation file is edited. There is no engine integration change requiring game-behavior tests. File sizes are audited against GitHub's 100MiB per-file limit; checksums cover delivered files.

## Remaining production work

Initial skin weights need extreme-pose/deformation review, retargeted clip tests and production animation approval. Walking, aiming, firing/recoil, reloads, crouching, prone and cover animations are intentionally not produced. LODs, target-engine material/import review and army-scale performance budgets remain unverified. Fine cloth/face/hand work retains the reference asset's procedural quality level; this is not scan/sculpt fidelity. No merge is authorized or performed.

## Provenance and recovery

The workspace was initialized from an empty attached cloud environment after confirming current running/connected status. Shell, Python 3.12.14, Blender 4.3.2 background mode, GitHub access, USMC sources and the evaluation branch were verified before modeling. Network Git operations required the cloud proxy outside the shell sandbox; the executor itself was functional. See `validation/environment-verification.json`.

Anatomy, morphs and initial weights retain the original CC0 provenance at `../usmc-rifleman/source/third-party/provenance.json` and `LICENSE-MakeHuman-CC0.md`; copies of the license and provenance record accompany the Russian source. Local modeling/export/pose utilities derive from the existing USMC pipeline; original USMC files are read only. This branch is based on the evaluation branch, not a rewrite of main.
