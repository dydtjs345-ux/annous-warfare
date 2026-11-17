# Cover peeking and firing integration — work in progress

Separate branch `feat/cover-peek-fire-integration`, based on latest approved `cc66fecc4abd6d34868c53aeaeb6d8ad482c0168`. No game/AI/map changes and no original file replacements.

The current actual Tactical Suit has eight locomotion/crouch clips and **no cover-combat clips**. Original USMC/Russian rigs contain functioning legacy `TC_CoverLeanLeft/Right`, `TC_CoverAimLeft/Right`, `TC_CoverFireLeft/Right`, `TC_CoverAboveAim/Fire`, `TC_CoverReturnLeft/Right`, `TC_CoverLower` and `TC_CoverExit` pairs. Those are existing project clips on the older rigs, not new external imports or completed actions on the current suit. Blind firing is missing from both older rigs.

Actual acquired Quaternius UAL1/UAL2 free Standard inventories have no validated dedicated rifle cover/peek/blind-fire set. The previously acquired Kevin pack has standing rifle actions but material library-redistribution restrictions; Rokoko remains registration-gated; the three acquired Zen FBX files parse but their canonical bind/axis/root conversion remains unvalidated. No new external motion is being falsely claimed. Source inventories and license records are retained separately.

The authorized fallback here is **derived project rifle motion**: `Lower_AimStance` + `FB_AimIdle_Upper`, and actual `FB_Recoil_Shot` data, retargeted onto the approved 87-joint suit. Cover-specific pelvis balance, distributed lumbar/thoracic lean and rotation, clavicle movement, head/sight alignment and arm/leg IK are explicit modifications. These are not untouched professionally authored cover clips. Original project M16A4 and AK-74M geometry/grip references are reused.

Priority is actual left/right peek, low-cover fire and return with building-corner, waist-wall and low-barrier geometry. Authoring/contact prototypes and early geometry checks are underway; no task-completion claim is made until final exported playback and preview are validated.
