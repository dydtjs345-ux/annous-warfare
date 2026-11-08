"""Render the actual GLB after a fresh import, using only embedded images."""
import bpy,sys,tempfile,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from finish_asset import render_views
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'models/USMC_Rifleman_Kit.glb'))
char=bpy.data.objects['USMC_Rifleman_Character'];weapon=bpy.data.objects['M16A4_Separate_Weapon'];rig=bpy.data.objects['USMC_Rifleman_Rig']
for b in rig.pose.bones:
 if b.custom_shape:b.custom_shape.hide_render=True
with tempfile.TemporaryDirectory(prefix='aw-glb-render-') as tmp:
 tmp=Path(tmp);(tmp/'previews').mkdir();render_views(tmp,char,weapon,rig,fast=True)
 shutil.copy2(tmp/'previews/quarter.png',ROOT/'previews/glb-roundtrip.png')
print('ACTUAL_GLB_RENDER_FINISHED',flush=True)
