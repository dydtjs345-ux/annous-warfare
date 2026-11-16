"""Validate actual exported GLB playback, including between-key hand alignment."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[1];refs=json.loads((ROOT/'validation/rifle-reference.json').read_text())['actions'];authored=json.loads((ROOT/'validation/retarget-grips.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=240;bpy.ops.import_scene.gltf(filepath=str(ROOT/'models/TacticalSuit_Quaternius_Rifle.glb'))
objects=[o for o in bpy.data.objects if not any(c.name=='glTF_not_exported'for c in o.users_collection)];rig=next(o for o in objects if o.type=='ARMATURE');weapon=bpy.data.objects.get('Weapon');assert weapon;tracks={};rest={o:o.matrix_basis.copy()for o in objects}
for o in objects:
 if o.animation_data:
  o.animation_data.action=None
  for tr in o.animation_data.nla_tracks:
   tr.mute=True
   for st in tr.strips:tracks.setdefault(tr.name,[]).append((o,st.action))
report={'source':'Exported TacticalSuit_Quaternius_Rifle.glb, reimported into Blender','sampleHz':480,'bones':len(rig.data.bones),'characterMesh':'Actual Tactical Suit; original USMC body absent','actions':{}}
for action,D in [('walk',4/3),('sprint',2/3)]:
 name='SU_Quaternius_'+('Walk'if action=='walk'else'Sprint')+'_Rifle';pairs=[pair for tr,pairs in tracks.items()if tr==name or tr.startswith(name+'_')for pair in pairs];assert pairs
 rows=[]
 for i in range(round(D*480)+1):
  t=i/480
  for o in objects:
   o.matrix_basis=rest[o]
   if o.type=='ARMATURE':
    for b in o.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
  for o,ac in pairs:
   for fc in ac.fcurves:
    try:o.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*240)
    except (ValueError,AttributeError,IndexError):pass
  bpy.context.view_layer.update();errors=[]
  for side,label in [('Left','L'),('Right','R')]:
   bone=next(b for b in rig.pose.bones if side+'Hand_'in b.name);actual=rig.matrix_world@bone.head;goal=weapon.matrix_world@Vector(refs[action]['hands'][label]['wrist']);errors.append((actual-goal).length)
  low=100
  for o in objects:
   if o.type=='MESH'and o.vertex_groups:
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();low=min(low,min((e.matrix_world@v.co).z for v in m.vertices));e.to_mesh_clear()
  bodyError=0
  if i%2==0:
   expected=authored['actions'][action]['frames'][i//2]
   for key,part in [('pelvisWorldQ','Hips'),('chestWorldQ','Spine2')]:
    bone=next(b for b in rig.pose.bones if part+'_'in b.name);q=(rig.matrix_world@bone.matrix).to_quaternion().normalized();eq=Quaternion(expected[key]).normalized();bodyError=max(bodyError,math.degrees(2*math.acos(min(1,abs(q.dot(eq))))))
  rows.append({'time':t,'gripErrorsM':errors,'meshMinZ':low,'weaponMinZ':min((weapon.matrix_world@v.co).z for v in weapon.data.vertices),'bodyOrientationErrorDeg':bodyError})
 result={'duration':D,'maxWristErrorM':max(max(r['gripErrorsM'])for r in rows),'minimumMeshZ':min(r['meshMinZ']for r in rows),'minimumWeaponZ':min(r['weaponMinZ']for r in rows),'maxBodyOrientationErrorDeg':max(r['bodyOrientationErrorDeg']for r in rows),'frames':rows};report['actions'][action]=result;print('REIMPORTED',action,{k:v for k,v in result.items()if k!='frames'},flush=True)
 (ROOT/'validation/reimport-partial.json').write_text(json.dumps(report,indent=2)+'\n')
 assert result['maxWristErrorM']<.003,result['maxWristErrorM'];assert result['minimumMeshZ']>-.004,result['minimumMeshZ'];assert result['minimumWeaponZ']>.15
(ROOT/'validation/reimport.json').write_text(json.dumps(report,indent=2)+'\n')
