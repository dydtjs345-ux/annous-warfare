"""Portable sampled 7.2-second moving-fire take, flattened from the source NLA.
GLB retains all independently reusable layers; FBX is a full-body review take.
"""
import bpy,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];faction=os.environ.get('AW_FACTION','Russian')
rig=bpy.data.objects['InfantryRig'];scene=bpy.context.scene;scene.frame_start=0;scene.frame_end=216;scene.render.fps=30
assert len(rig.animation_data.nla_tracks)==3
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.context.scene.objects:
 if ob.type in ['MESH','ARMATURE','EMPTY']:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(ROOT/'models'/f'{faction}_MovingFire.fbx'),use_selection=True,object_types={'ARMATURE','MESH','EMPTY'},add_leaf_bones=False,use_armature_deform_only=True,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=False,bake_anim_step=1,bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True,axis_forward='-Z',axis_up='Y')
print('EXPORTED_MOVING_FIRE_FBX',faction,flush=True)
