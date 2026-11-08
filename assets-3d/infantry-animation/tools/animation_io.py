"""Evaluate authored Actions for source review; export independently blendable layers."""
import bpy,json,struct,math,re,bmesh
from pathlib import Path
from mathutils import Matrix,Quaternion,Vector
ROOT=Path(__file__).resolve().parents[1]

def apply_action(rig,action,time):
 for fc in action.fcurves:
  m=re.match(r'pose.bones\["(.+)"\]\.(.+)',fc.data_path)
  if m:
   name,prop=m.groups();getattr(rig.pose.bones[name],prop)[fc.array_index]=fc.evaluate(time*30)
 for p in rig.pose.bones:p.rotation_quaternion.normalize()

def pose(rig,lower,upper,time,recoil=None,recoil_time=0):
 rig.animation_data.action=None
 for track in rig.animation_data.nla_tracks:track.mute=True
 for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
 if lower:apply_action(rig,bpy.data.actions[lower],time)
 if upper:apply_action(rig,bpy.data.actions[upper],time)
 if recoil:
  values={p.name:(p.location.copy(),p.rotation_quaternion.copy())for p in rig.pose.bones}
  apply_action(rig,bpy.data.actions['Upper_Aim'],0);ref={p.name:(p.location.copy(),p.rotation_quaternion.copy())for p in rig.pose.bones}
  apply_action(rig,bpy.data.actions[recoil],recoil_time)
  for p in rig.pose.bones:
   l,q=values[p.name];lr,qr=ref[p.name];p.location=l+(p.location-lr);p.rotation_quaternion=q@qr.inverted()@p.rotation_quaternion
 bpy.context.view_layer.update()

def parse_glb(path):
 data=path.read_bytes();js=None;binary=None
 for offset in [12]:
  while offset<len(data):
   size,kind=struct.unpack_from('<II',data,offset);chunk=data[offset+8:offset+8+size]
   if kind==0x4e4f534a:js=json.loads(chunk)
   elif kind==0x004e4942:binary=chunk
   offset+=8+size
 return js,binary

def write_glb(path,j,binary):
 text=json.dumps(j,separators=(',',':')).encode();text+=b' '*((-len(text))%4);binary+=b'\0'*((-len(binary))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(text)+8+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary)

def export_glb(faction):
 rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];weapon=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine']
 spare=bpy.data.objects.get('SpareMagazine');objects=[rig,char,weapon,mag,*([spare]if spare else[])]
 meta=json.loads((ROOT/'validation'/f'{faction}-authoring.json').read_text());rig.animation_data.action=None
 for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
 for name in meta['actions']:
  track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,bpy.data.actions[name]);strip.action_frame_start=0;strip.action_frame_end=round(meta['actions'][name]['duration']*30);track.mute=True
 for name,info in meta['actions'].items():
  for objname,actionname in info.get('object_actions',{}).items():
   obj=bpy.data.objects[objname];obj.animation_data_create();obj.animation_data.action=None
   for old in list(obj.animation_data.nla_tracks):obj.animation_data.nla_tracks.remove(old)
   track=obj.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,bpy.data.actions[actionname]);track.mute=True
 bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=72;bpy.context.scene.render.fps=30
 for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update()
 bpy.ops.object.select_all(action='DESELECT')
 for ob in [*objects,*[o for o in weapon.children if o.type=='EMPTY']]:ob.select_set(True)
 bpy.context.view_layer.objects.active=rig
 for ob in [o for o in objects if o.type=='MESH']:
  bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
 path=ROOT/'models'/f'{faction}_Animated.glb'
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=True,export_skins=True,export_tangents=True,export_extras=True)
 j,binary=parse_glb(path);removed={}
 # The exporter samples the armature. Remove channels outside each authored mask;
 # otherwise constant sampled bones would overwrite the other runtime layers.
 for anim in j.get('animations',[]):
  name=anim['name'];allowed=set(meta['actions'][name]['bones']);before=len(anim['channels'])
  anim['channels']=[c for c in anim['channels']if j['nodes'][c['target']['node']].get('name')in allowed or j['nodes'][c['target']['node']].get('name')in ['Magazine','SpareMagazine']]
  used=sorted(set(c['sampler']for c in anim['channels']));mapping={old:i for i,old in enumerate(used)};anim['samplers']=[anim['samplers'][i]for i in used]
  for c in anim['channels']:c['sampler']=mapping[c['sampler']]
  removed[name]=before-len(anim['channels'])
 for index,node in enumerate(j['nodes']):
  if 'skin' in node:
   for parent in j['nodes']:
    if index in parent.get('children',[]):parent['children'].remove(index)
   for scene in j['scenes']:
    if index not in scene['nodes']:scene['nodes'].append(index)
 j.setdefault('extras',{})['animation_architecture']={'fps':30,'layers':['lower','upper','recoil'],'recoil_reference':'Upper_Aim first frame','source_bones':163,'in_place_root_motion':'Integrate gait speed from manifest; do not restart gait on fire.'}
 write_glb(path,j,binary)
 (ROOT/'validation'/f'{faction}-export.json').write_text(json.dumps({'animations':[{'name':a['name'],'channels':len(a['channels'])}for a in j.get('animations',[])],'mask_channels_removed':removed},indent=2)+'\n')
 print('EXPORTED_LAYERED_GLB',faction,[(a['name'],len(a['channels']))for a in j.get('animations',[])],flush=True)
 return meta
