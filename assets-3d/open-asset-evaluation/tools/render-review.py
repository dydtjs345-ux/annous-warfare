"""Render imported GLBs after Blender reimport, with identical camera and scale."""
import bpy,math,os,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];CACHE=Path('/workspace/open-asset-downloads/render')
faction=os.environ.get('AW_FACTION','USMC');action=os.environ.get('AW_ACTION','walk');view=os.environ.get('AW_VIEW','side');frames=int(os.environ.get('AW_FRAMES','1'))
data=json.loads((ROOT/'validation/retarget.json').read_text())['factions'][faction]['clips'][action];D=data['duration'];speed=data['speedMps'];travel=data['travel'][2]
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=30;scene.render.engine='CYCLES';scene.render.use_persistent_data=True;scene.cycles.samples=16;scene.cycles.use_denoising=False;scene.render.resolution_x=480;scene.render.resolution_y=420;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world=bpy.data.worlds.new('World');scene.world.color=(.22,.25,.30)
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);return m
floorMat=material('Ground',(.12,.16,.19));lineMat=material('Grid',(.24,.30,.34))
bpy.ops.mesh.primitive_plane_add(size=300);floor=bpy.context.object;floor.location.z=-.008;floor.data.materials.append(floorMat)
for y in range(-25,26):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(0,y*.25,-.006));o=bpy.context.object;o.scale=(20,.001,.001);o.data.materials.append(lineMat)
for x in range(-25,26):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x*.25,0,-.006));o=bpy.context.object;o.scale=(.001,20,.001);o.data.materials.append(lineMat)
for loc,power,size in [((2,-3,6),1300,5),((-4,2,4),900,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
actors=[]
for kind in ['original','imported']:
 old=set(bpy.data.objects);oldA=set(bpy.data.actions);bpy.ops.import_scene.gltf(filepath=str(CACHE/f'{faction}-{kind}.glb'));objects=[o for o in bpy.data.objects if o not in old];rig=next(o for o in objects if o.type=='ARMATURE');actions={a.name.split('_InfantryRig')[0]:a for a in bpy.data.actions if a not in oldA};
 for o in objects:
  if o.animation_data:
   o.animation_data.action=None
   for tr in o.animation_data.nla_tracks:tr.mute=True
 anchor=bpy.data.objects.new(kind+'_anchor',None);scene.collection.objects.link(anchor)
 for o in objects:
  if o.parent not in objects:o.parent=anchor
 actors.append((kind,rig,actions,anchor,objects));print(kind,len(rig.data.bones),list(actions),flush=True)
def apply(rig,a,t):
 for fc in a.fcurves:
  try:
   v=rig.path_resolve(fc.data_path)
   if hasattr(v,'__len__'):v[fc.array_index]=fc.evaluate(t*30)
  except Exception:pass
for ai,(kind,rig,actions,anchor,objects)in enumerate(actors):
 if kind not in os.environ.get('AW_KINDS','original,imported').split(','):continue
 for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
 if kind=='original':names=['FB_Walk_Lower','FB_Walk_Upper']if action=='walk'else['SR_Sprint_Lower','SR_Sprint_Upper'];duration=1.2 if action=='walk'else 2/3
 else:names=['OA_Quaternius_'+('Walk'if action=='walk'else'Sprint')];duration=D
 for n in names:assert n in actions,(n,list(actions))
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.15*480/420;cam.data.lens=50;scene.camera=cam
 dest=CACHE/f'{faction}-{action}-{view}-{kind}';dest.mkdir(exist_ok=True)
 for fi in range(frames):
  t=fi/24 if frames>1 else float(os.environ.get('AW_TIME','0.2'));phase=t%duration
  for _,r,_,_,obs in actors:
   for o in obs:o.hide_render=(r!=rig)or o.name.startswith('SpareMagazine')
  for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
  for n in names:apply(rig,actions[n],phase)
  anchor.location=(0,-speed*t if kind=='original'else -math.floor(t/D)*travel,0)
  target=Vector((0,-speed*t,.86));offset=Vector((6,0,0))if view=='side'else Vector((6,-6,math.sqrt(72)*math.tan(math.pi/6)))
  cam.location=target+offset;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.view_settings.view_transform='AgX';scene.render.filepath=str(dest/f'{fi:04d}.png');bpy.context.view_layer.update();bpy.ops.render.render(write_still=True)
 print('RENDERED',dest,flush=True)
