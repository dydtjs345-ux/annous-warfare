"""Inspect downloaded external geometry and authored source keyframes, without editing assets."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];CACHE=Path('/workspace/open-asset-downloads');OUT=ROOT/'review';OUT.mkdir(exist_ok=True)
def setup():
 bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=30;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=False;s.render.resolution_x=420;s.render.resolution_y=440;s.render.resolution_percentage=100;s.world=bpy.data.worlds.new('World');s.world.color=(.18,.22,.26);s.view_settings.view_transform='AgX';return s
def studio(s):
 bpy.ops.mesh.primitive_plane_add(size=100);bpy.context.object.location.z=-.01
 for loc,power in [((3,-4,6),1400),((-3,2,4),1100)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();o=bpy.context.object;o.data.type='ORTHO';o.data.ortho_scale=2.25*420/440;target=Vector((0,0,.86));o.location=target+Vector((6,-6,math.sqrt(72)*math.tan(math.pi/6)));o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();s.camera=o
def clear_animation():
 for o in bpy.data.objects:
  if o.animation_data:
   o.animation_data.action=None
   for tr in o.animation_data.nla_tracks:tr.mute=True
  if o.type=='ARMATURE':
   for b in o.pose.bones:b.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update()
for name in (['danly']if __import__('os').environ.get('AW_DANLY_ONLY')=='1'else['bamen','danly']):
 s=setup();bpy.ops.import_scene.gltf(filepath=str(CACHE/f'{name}-soldier-mirror.glb'));clear_animation();objects=list(bpy.data.objects);rig=next(o for o in objects if o.type=='ARMATURE');root=bpy.data.objects.new('InspectionNormalization',None);s.collection.objects.link(root)
 for o in objects:
  if o.parent not in objects:o.parent=root

 if name=='danly':
  # Inspect the downloaded bind geometry; the mirror's armature scales fail in Blender.
  for o in objects:
   for m in o.modifiers:
    if m.type=='ARMATURE':m.show_viewport=False;m.show_render=False
 bpy.context.view_layer.update();verts=[]
 for o in objects:
  if o.type=='MESH':
   e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();verts.extend(e.matrix_world@v.co for v in m.vertices);e.to_mesh_clear()
 low=Vector(tuple(min(v[k]for v in verts)for k in range(3)));high=Vector(tuple(max(v[k]for v in verts)for k in range(3)));scale=1.74/(high.z-low.z);root.scale=(scale,)*3;root.location=(-scale*(high.x+low.x)/2,-scale*(high.y+low.y)/2,-scale*low.z);studio(s);s.render.filepath=str(OUT/f'Sketchfab-{name}-inspection.png');bpy.ops.render.render(write_still=True);print(name,'bones',len(rig.data.bones),'rest height',high.z-low.z,flush=True)
import os
if os.environ.get('AW_MODELS_ONLY')=='1':raise SystemExit
s=setup();bpy.ops.import_scene.gltf(filepath=str(ROOT/'source/UAL1_Standard_RM.glb'));clear_animation();rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');actions={a.name.split('_Armature')[0]:a for a in bpy.data.actions};print('SOURCE',list(actions),flush=True);studio(s);sourceGround={}
for action,D in [('Walk_Loop',4/3),('Sprint_Loop',2/3)]:
 a=actions[action];rig.animation_data.action=a;minZ=100;rows=[]
 for i in range(round(D*30)+1):
  s.frame_set(0,subframe=0);s.frame_set(i);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();meshes=[]
  for o in bpy.data.objects:
   if o.type=='MESH'and o.vertex_groups:
    e=o.evaluated_get(dg);m=e.to_mesh();meshes+=[(e.matrix_world@v.co).z for v in m.vertices];e.to_mesh_clear()
  minZ=min(minZ,min(meshes));rows.append({'time':i/30,'minimumMeshZ':min(meshes)})
  if i in [0,round(D*30/4),round(D*30/2),round(D*30*3/4)]:
   root=rig.matrix_world@rig.pose.bones['pelvis'].head;target=Vector((0,root.y,.86));s.camera.location=target+Vector((6,-6,math.sqrt(72)*math.tan(math.pi/6)));s.camera.rotation_euler=(target-s.camera.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(OUT/f'Quaternius-{action}-phase-{i:02d}.png');bpy.ops.render.render(write_still=True)
 sourceGround[action]={'minimumMeshZ':minZ,'samples':rows}
(ROOT/'validation/source-ground.json').write_text(json.dumps(sourceGround,indent=2)+'\n')
