# Forward crawl: inspected user-supplied references

This study precedes authoring. Scope: revise only `TC_CrawlForward_Lower` and `TC_CrawlForward_Upper` in separate copies for both existing faction rigs. Preserve all other animations and the game.

Both attached MOV files were decoded with FFmpeg. Native size is 480 × 1038. The first, `1-crawl_reference_second_small.mov`, lasts 14.25 seconds and contains a screen recording comparing Arma 3 (top) and Arma Reforger (bottom). The second, `2-crawl_reference_small.mov`, lasts 6 seconds and shows real training footage. No animation data or proprietary game assets were extracted.

Initial inspection used complete 6 Hz frame sequences, full-clip overviews, and enlarged chronological crops. Initial sheet labels are resampling times. The selected native frames have exact presentation timestamps, frame indexes, hashes and extraction settings in the accompanying record. The compressed footage does not have a uniform native frame rate.

| Inspected interval | Visible observation | Authoring implication |
| --- | --- | --- |
| Real training, 0.83–1.67 s | Rear view: one knee bends and moves outward while the opposite leg stays longer. The hips shift/roll with this recovery. The backpack changes orientation with the torso instead of staying square. | Couple lateral pelvic roll and yaw to knee recovery and the supporting side. Keep the abdomen low. Do not run an independent leg loop below a fixed torso. |
| Real training, 1.83–3.17 s | Low rear/side view: the shoulder/upper arm approaches the ground; the body advances over a forearm support while the other side recovers. Chest and hips have a visible relative angle and do not move as one rigid plank. | Author explicit forearm support intervals, alternating shoulder reach/pull, spine counterrotation and delayed chest response. Ground-relative planted contacts must remain stable while the body advances. |
| Real training, approximately 3.7–5.5 s | The person settles into a weapon-up prone aim after the crawl. The rifle and shoulder position change from the low movement posture. | Forward crawl should carry/control the rifle low, with support-limb recovery permitted. Do not lock both hands to the original high aim pose throughout the crawl. This revision does not change the separate aim animation. |
| Game comparison, approximately 9.0–12.2 s, Reforger lower panel | Rear/oblique movement includes alternating knee recovery and whole-body roll. A camera turn exposes the low profile and moving shoulder line. Vegetation obscures exact contacts. | Use this as a secondary silhouette/coordination reference, not as evidence for exact contact heights or joint angles. |

The compressed moving camera, UI overlays and occasional cuts obscure individual fingers, some feet and the far arm. Exact joint angles, contact forces, center of mass, speed and left/right phase timing cannot be recovered reliably. The implementation will be an original keyed motion guided by these visible relationships, with contact and reach checked on our own rigs.

The original crawl's arms never approach the floor sufficiently and both hands are constrained to the aimed rifle; its thighs articulate much more than its chest and shoulders. The revision must change support and body coordination, not add noise or merely increase playback speed. The existing 2.4-second cycle and 0.23 m/s forward travel are retained so that comparison uses the same distance and cadence.
