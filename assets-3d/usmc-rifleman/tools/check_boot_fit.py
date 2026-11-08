"""Fast pre-bake geometry fit check; render goes to /tmp, not delivery images."""
import bpy,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from finish_asset import render_views,aim
char=bpy.data.objects['USMC_Rifleman_Character'];weapon=bpy.data.objects['M16A4_Separate_Weapon'];rig=bpy.data.objects['USMC_Rifleman_Rig']
with tempfile.TemporaryDirectory(prefix='aw-fit-')as tmp:
 tmp=Path(tmp);(tmp/'previews').mkdir();render_views(tmp,char,weapon,rig,fast=True)
scene=bpy.context.scene;scene.cycles.samples=48;cam=scene.camera
cam.location=(.72,-1.5,.56);aim(cam,(0,-.08,.20));cam.data.ortho_scale=.67
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.filepath='/tmp/aw-boot-fit.png'
bpy.ops.render.render(write_still=True)
print('BOOT_GEOMETRY_FIT_RENDERED',flush=True)
