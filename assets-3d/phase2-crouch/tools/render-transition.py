"""Render actual CPU Three.js controller matrices on the unchanged exported skin."""
import bpy,json,re,os,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];doc=json.loads((ROOT/'validation/controller-poses.json').read_text());view=os.environ.get('SU_VIEW','iso');bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=False;s.cycles.max_bounces=2;s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.world=bpy.data.worlds.new('World');s.world.color=(.18,.22,.26);s.render.use_persistent_data=True;s.view_settings.view_transform='AgX'
bpy.ops.import_scene.gltf(filepath=str(ROOT/'models/TacticalSuit_Phase2.glb'));objects=list(bpy.data.objects);rig=next(o for o in objects if o.type=='ARMATURE')
for o in objects:
 if o.animation_data:
  o.animation_data.action=None
  for tr in o.animation_data.nla_tracks:tr.mute=True
for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));Ci=C.inverted()
def matrix(a):return C@Matrix(tuple(tuple(a[c*4+r]for c in range(4))for r in range(4)))@Ci
def name(x):return re.sub(r'[\[\].:/]','',re.sub(r'\s','_',x))
bones=sorted(list(rig.pose.bones),key=lambda b:len(b.parent_recursive));offset={b.name:matrix(doc['rest'][name(b.name)]).inverted()@rig.matrix_world@b.matrix for b in bones}
weapon=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine'];rigidIndices={}
for o in[weapon,mag]:
 rigidIndices[o.name]=[]
 for p in doc['rigidLocal'][o.name]:
  target=C@Vector(p);best=min(o.data.vertices,key=lambda v:(v.co-target).length);assert(best.co-target).length<.0001;rigidIndices[o.name].append(best.index)
# Locate the actual vertex used by the live controller, then verify posed skin against it.
bind=json.loads((ROOT/'validation/skin-bindings.json').read_text());landmarks={}
for side,info in bind['feet'].items():
 p=C@Vector(info['restWorldYUp']);best=(float('inf'),None,None)
 for o in objects:
  if o.type!='MESH'or not o.vertex_groups:continue
  for v in o.data.vertices:
   e=(o.matrix_world@v.co-p).length
   if e<best[0]:best=(e,o,v.index)
 assert best[0]<.0001,best[0];landmarks[side]=best[1:]
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.location.z=-.0005;m=bpy.data.materials.new('Floor');m.diffuse_color=(.16,.20,.23,1);floor.data.materials.append(m)
lights=[]
for p in [(2,-3,6),(-3,2,4)]:
 bpy.ops.object.light_add(type='AREA',location=p);l=bpy.context.object;l.data.energy=1100;l.data.size=4;lights.append((l,Vector(p)))
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.15;s.camera=camera;dest=Path('/workspace/phase2-crouch-frames')/('controller-'+view);dest.mkdir(exist_ok=True);checks=[]
for i,frame in enumerate(doc['frames']):
 for b in bones:
  b.matrix=rig.matrix_world.inverted()@matrix(frame['nodes'][name(b.name)])@offset[b.name];bpy.context.view_layer.update()
 for o in[weapon,mag]:
  o.matrix_world=matrix(frame['nodes'][o.name]);bpy.context.view_layer.update()
 bpy.context.view_layer.update();errors={};dg=bpy.context.evaluated_depsgraph_get()
 for side,(o,vi)in landmarks.items():
  e=o.evaluated_get(dg);mesh=e.to_mesh();p=e.matrix_world@mesh.vertices[vi].co;e.to_mesh_clear();errors[side]=(p-C@Vector(frame['feet'][side])).length
 assert max(errors.values())<.0001,errors
 rigidError=0
 for o in[weapon,mag]:
  for vi,p in zip(rigidIndices[o.name],frame['rigidPoints'][o.name]):rigidError=max(rigidError,(o.matrix_world@o.data.vertices[vi].co-C@Vector(p)).length)
 assert rigidError<.0001,rigidError
 center=C@Vector(frame['travel'])+Vector((0,0,.86));delta=Vector((6,0,0))if view=='side'else Vector((6,-6,4.898979));camera.location=center+delta;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
 for l,p in lights:l.location=center+p;l.rotation_euler=(center-l.location).to_track_quat('-Z','Y').to_euler()
 s.render.filepath=str(dest/f'{i:04d}.png');bpy.ops.render.render(write_still=True);checks.append({'time':frame['time'],'state':frame['state'],'skinVsActualControllerErrorM':errors,'rigidWeaponVsActualControllerErrorM':rigidError})
(ROOT/'validation'/f'transition-render-{view}.json').write_text(json.dumps({'frames':checks,'browserGpuTested':False,'method':'Actual Three.js controller matrices, mapped to exported Blender skin with verified rest-basis offsets'},indent=2)+'\n');print('CONTROLLER REVIEW',view,len(checks),flush=True)
