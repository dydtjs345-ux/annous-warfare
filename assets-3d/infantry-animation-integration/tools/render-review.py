"""Review actual exported meshes and animation, with explicit character labels."""
import bpy,os,math,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];kind=os.environ.get('SU_KIND','suit');mode=os.environ.get('SU_MODE','motion');action=os.environ.get('SU_ACTION','walk');view=os.environ.get('SU_VIEW','iso');N=int(os.environ.get('SU_FRAMES','1'));time0=float(os.environ.get('SU_TIME','.2'))
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=60;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=False;s.render.use_persistent_data=True;s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.world=bpy.data.worlds.new('World');s.world.color=(.18,.22,.26)
path=ROOT/'models/TacticalSuit_Integrated.glb'
bpy.ops.import_scene.gltf(filepath=str(path));objects=[o for o in bpy.data.objects if not any(c.name=='glTF_not_exported'for c in o.users_collection)];rig=next(o for o in objects if o.type=='ARMATURE');tracks={}
for o in objects:
 if o.animation_data:
  o.animation_data.action=None
  for tr in o.animation_data.nla_tracks:
   tr.mute=True
   for st in tr.strips:tracks.setdefault(tr.name,[]).append((o,st.action))
rest={o:o.matrix_basis.copy()for o in objects}
def pose(time):
 for o in objects:
  o.matrix_basis=rest[o]
  if o.type=='ARMATURE':
   for b in o.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
 names=['SU_Project_Idle_Rifle'if action=='idle'else'SU_Project_TacticalSprint_Rifle']
 if mode=='motion':
  for name in names:
   hits=[pair for tr,pairs in tracks.items()if tr==name or tr.startswith(name+'_')for pair in pairs]
   assert hits,(name,list(tracks))
   for o,ac in hits:
    for fc in ac.fcurves:
     try:o.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(time*60)
     except (ValueError,AttributeError,IndexError):pass
 bpy.context.view_layer.update()
for o in objects:
 if o.name.startswith('SpareMagazine')or(mode=='appearance'and o.name.startswith(('Weapon','Magazine'))):o.hide_render=True
def bounds():
 pts=[];dg=bpy.context.evaluated_depsgraph_get()
 for o in objects:
  if o.type=='MESH'and not o.hide_render:
   e=o.evaluated_get(dg);m=e.to_mesh();pts.extend(e.matrix_world@v.co for v in m.vertices);e.to_mesh_clear()
 return Vector(tuple(min(p[k]for p in pts)for k in range(3))),Vector(tuple(max(p[k]for p in pts)for k in range(3)))
if mode=='appearance'or kind=='original':
 low,high=bounds();anchor=bpy.data.objects.new('ComparisonDisplay',None);s.collection.objects.link(anchor)
 for o in objects:
  if o.parent not in objects:o.parent=anchor
 k=1.74/(high.z-low.z);anchor.scale=(k,)*3;anchor.location=(-k*(high.x+low.x)/2,-k*(high.y+low.y)/2,-k*low.z);bpy.context.view_layer.update()
D=2.4 if action=='idle'else 2/3
if mode=='motion':
 root=next(b for b in rig.pose.bones if('Hips'in b.name)or b.name=='root');pose(0);start=rig.matrix_world@root.head;pose(D);end=rig.matrix_world@root.head;travel=end-start;speed=-travel.y/D
 if kind=='original':speed=1.05 if action=='walk'else 3.0
else:speed=0
if action=='sprint':speed=3.6*.876617875398629
else:speed=0
assembly=bpy.data.objects.new('ReviewWorldTranslation',None);s.collection.objects.link(assembly)
for o in objects:
 if o.parent not in objects:o.parent=assembly
bpy.ops.mesh.primitive_plane_add(size=300);floor=bpy.context.object;floor.location.z=-.006;m=bpy.data.materials.new('StudioGround');m.diffuse_color=(.16,.20,.23,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.16,.20,.23,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1;floor.data.materials.append(m)
lights=[]
for pos,power in [((2,-3,6),1100),((-3,2,4),900)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=4;lights.append((o,Vector(pos)))
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=.65 if view.startswith('hands')else 2.15;s.camera=camera;s.view_settings.view_transform='AgX';dest=Path('/workspace/infantry-integration-frames')/f'{mode}-{action}-{view}-{kind}';dest.mkdir(parents=True,exist_ok=True)
for i in range(N):
 t=i/24 if N>1 else time0;duration=D if kind=='suit'else(1.2 if action=='walk'else 2/3);pose(t%D);assembly.location.y=-speed*t;bpy.context.view_layer.update()
 if mode=='motion'and kind=='original':
  displacement=Vector((0,-speed*t,0));rig.location+=rig.parent.matrix_world.to_3x3().inverted()@displacement if rig.parent else displacement;bpy.context.view_layer.update()
 target=Vector((0,-speed*t,.86))if mode=='motion'else Vector((0,0,.86))
 if view.startswith('hands'):
  left=next(b for b in rig.pose.bones if'LeftHand_'in b.name)if kind=='suit'else rig.pose.bones['wrist.L'];right=next(b for b in rig.pose.bones if'RightHand_'in b.name)if kind=='suit'else rig.pose.bones['wrist.R'];target=rig.matrix_world@((left.head+right.head)/2)
 offset=Vector((-6,-6,3))if view=='hands-right'else Vector((6,0,0))if view=='side'else Vector((6,-6,4.898979))
 camera.location=target+offset;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
 for light,pos in lights:light.location=target+pos;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
 s.render.filepath=str(dest/f'{i:04d}.png');bpy.ops.render.render(write_still=True)
print('RENDERED',str(dest),N,'speed',speed,flush=True)
