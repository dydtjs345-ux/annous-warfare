# USMC rifleman v0.3.1 original PNG prototype

Original project artwork built by `python scripts/art/build-usmc-v031.py` (Pillow).
No pixels or illustrated poses were cut from the supplied design reference.
The reference guides silhouette, desert digital camouflage and equipment only.

- RGBA atlas: 264 trimmed frames; logical 96×112 canvas in every frame.
- Foot pivot `(48,96)`, upright crown y16, hip y62; native upright span 80px.
- Eight independent torso directions; eight traveled-distance phases per direction
  for walk, run, crouch and crawl. Arms and M16A4 are separate transparent PNGs.
- `rifleman.json` uses Phaser `sourceSize` / `spriteSourceSize` trim metadata.
  Do not use the packed crop origin as a foot pivot.
- `metadata.json` records the shoulder, arm, grip and muzzle rig. World geometry
  never depends on these values. Texture sampling is nearest, not blurred.
- At 1.0/1.3/1.5 display size, standing height is 30/39/45px before camera zoom.
- Old v0.3.0 atlas remains under `../usmc-rifleman/`; stock renderer remains available.

This is a reference-informed asset prototype, **not reference-quality finished art**.
The torso is fuller and the legs shorter than v0.3.0. The helmet, carrier,
magazine pouches, radio/IFAK silhouette, back pack, boots and rifle have more
native detail, but some equipment remains schematic. A dedicated sprite artist
is still needed for anatomically refined eight-direction drawings, directional
handedness/occlusion, individually authored weight transfer and terrain-aware
kneeling. Independent IK arms use simple sleeve textures and can stretch.
Reload/cover transitions are rig-driven, not a complete hand-authored atlas.
Grenade, treatment, mounting, incapacitation and death use the existing renderer
rather than pretending the new asset contains those finished animations.

Prone is selected only from actual full concealment/crawling presentation states;
this does not add a player-controlled or tactical prone mechanic. Riflemen cannot
become mounted LMGs through this prototype. No combat/RNG/timing changes.
