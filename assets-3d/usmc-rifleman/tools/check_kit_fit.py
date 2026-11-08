"""Pre-bake side fit render against the actual human torso."""
import bpy,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from finish_asset import render_views,aim
char=bpy.data.objects['USMC_Rifleman_Character'];weapon=bpy.data.objects['M16A4_Separate_Weapon'];rig=bpy.data.objects['USMC_Rifleman_Rig']
with tempfile.TemporaryDirectory(prefix='aw-kit-fit-')as tmp:
 tmp=Path(tmp);(tmp/'previews').mkdir();render_views(tmp,char,weapon,rig,fast=True)
scene=bpy.context.scene;scene.cycles.samples=48;cam=scene.camera;weapon.hide_render=True
cam.location=(4,0,1.5);aim(cam,(0,0,1.30));cam.data.ortho_scale=1.0
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.filepath='/tmp/aw-kit-fit.png'
bpy.ops.render.render(write_still=True)
print('KIT_GEOMETRY_FIT_RENDERED',flush=True)
