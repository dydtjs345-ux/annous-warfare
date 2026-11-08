"""Actual source, hand-detail, weapon and fresh-import GLB render review."""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from finish_infantry import render_views,aim
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source/Russian_Infantry.blend'))
char=bpy.data.objects['Russian_Infantry_Character'];weapon=bpy.data.objects['AK74M_Separate_Weapon'];rig=bpy.data.objects['Russian_Infantry_Rig']
render_views(ROOT,char,weapon,rig)
scene=bpy.context.scene;cam=scene.camera
# Standalone rifle at an inspection angle; no change saved back into the source.
char.hide_render=True
cam.location=(1.8,-.8,1.8);aim(cam,weapon.location+Vector((0,0,.04)));cam.data.ortho_scale=1.13
scene.render.resolution_x=1024;scene.render.resolution_y=640;scene.render.filepath=str(ROOT/'previews/AK74M.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'isometric-evaluation/source/Russian_Infantry_LowReady.blend'))
root=bpy.data.objects['Evaluation_Facing_Assembly'];root.rotation_euler.z=0
scene=bpy.context.scene;cam=scene.camera;scene.render.resolution_x=1024;scene.render.resolution_y=768;scene.cycles.samples=48
cam.location=(1.5,-2.5,1.8);aim(cam,(-.08,-.27,1.17));cam.data.ortho_scale=.75
scene.render.filepath=str(ROOT/'previews/low-ready-hands.png');bpy.ops.render.render(write_still=True)
# Render the exported GLB itself in a new scene with the same studio setup.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'models/Russian_Infantry_Kit.glb'))
char=bpy.data.objects['Russian_Infantry_Character'];weapon=bpy.data.objects['AK74M_Separate_Weapon'];rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
# render_views writes quarter.png, so use a dedicated temporary destination.
from tempfile import TemporaryDirectory
from shutil import copyfile
with TemporaryDirectory() as tmp:
 p=Path(tmp);(p/'previews').mkdir();render_views(p,char,weapon,rig,fast=True);copyfile(p/'previews/quarter.png',ROOT/'previews/glb-roundtrip.png')
print('SOURCE_AND_REIMPORT_RENDER_REVIEW_FINISHED')
