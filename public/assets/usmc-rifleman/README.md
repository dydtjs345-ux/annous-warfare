# Original USMC rifleman prototype assets

Rebuild from repository root with `python3 scripts/art/build-usmc-rifleman.py` (Pillow; validated with 13.0.0). No runtime Python dependency. Artwork is original offline raster construction, not copied game sprites or an enlargement of the old renderer.

`rifleman.png` is an RGBA atlas with 144 untrimmed 64×72 frames; `rifleman.json` is the Phaser hash atlas. `metadata.json` records design dimensions/anchors. Frame keys: `torso-{direction}`; `stand-{direction}-{phase}`; `crouch-{direction}-{phase}`; `prone-{direction}`. Directions are projected screen octants; phases are eight samples of actual traveled-distance stride.

The two independent sleeve/forearm PNGs are articulated to the receiver/support grip. `m16a4.png` has a fixed stock, receiver, magazine, rail handguard, exposed barrel and front sight. It is continuously rotated and foreshortened by projection; it is not eight authored directional rifle images.

Crown/sole design span is 56 native pixels with an 8-pixel head design target (about seven heads). 1.0× displays this at the old 30-pixel standing height; 1.3× and 1.5× are evaluation sizes for one rifleman only. The original desert digital pattern is MARPAT-inspired, not issued-fabric reproduction. Equipment is period-inspired, not museum-verified. This is a working visual prototype and replacement-ready asset pipeline; directional anatomy and kit detail require an artist pass before production approval.
