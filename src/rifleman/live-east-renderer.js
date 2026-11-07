import { LiveUSMCRenderer } from "../live-usmc-renderer.js";
import { CATALOG } from "./catalog.js";
import { LiveEastState, EAST_ART } from "./live-east-state.js";
export function preloadEastRifleman(scene) {
  for (const bank of ["eQuiet", "eHandling"]) {
    const d = CATALOG.banks[bank],
      root = import.meta.env?.BASE_URL ?? "/annous-warfare/";
    scene.load.spritesheet(bank, root + d.image, {
      frameWidth: d.frameSize[0],
      frameHeight: d.frameSize[1],
      endFrame: 7,
    });
    scene.load.json(bank + "-meta", root + d.metadata);
  }
}
export class LiveEastRenderer extends LiveUSMCRenderer {
  constructor(scene) {
    super(scene, {
      texture: "eQuiet",
      metadata: "eQuiet-meta",
      art: EAST_ART,
      controller: new LiveEastState(),
    });
  }
  update(...args) {
    super.update(...args);
    this.textureKey = this.plan.bank ?? "eQuiet";
    this.design = this.scene.cache.json.get(this.textureKey + "-meta");
    if (
      this.image.texture?.key !== this.textureKey &&
      this.scene.textures.exists(this.textureKey)
    )
      this.image.setTexture(this.textureKey, this.plan.frame ?? 0);
  }
  draw(...args) {
    // Metadata is another gate: accidentally changing an inventory flag cannot
    // admit an unreviewed sheet. No fallback to a made-up rotated/mirrored E.
    if (!this.design?.combatApproved) {
      this.hide();
      return false;
    }
    return super.draw(...args);
  }
}
