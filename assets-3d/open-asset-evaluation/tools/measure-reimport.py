"""Inspect actual Blender-reimported GLBs: body motion, geometry/ground and rifle alignment."""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1];CACHE=Path('/workspace/open-asset-downloads/render');source=json.loads((ROOT/'validation/retarget.json').read_text());report={}
def apply(r,a,t):
 for fc in a.fcurves:
  try:r.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*30)
  except (ValueError,AttributeError,IndexError):pass
def pose(r,actions,names,t):
 for p in r.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
 for n in names:apply(r,actions[n],t)
 bpy.context.view_layer.update()
def span(qs):return max(math.degrees(2*math.acos(min(1,abs(a.normalized().dot(b.normalized())))))for a in qs for b in qs)
for faction in ['USMC','Russian']:
 report[faction]={}
 for kind in ['original','imported']:
  bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(CACHE/f'{faction}-{kind}.glb'));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');assert len(rig.data.bones)==163
  for o in bpy.data.objects:
   if o.animation_data:
    o.animation_data.action=None
    for tr in o.animation_data.nla_tracks:tr.mute=True
  actions={a.name.split('_InfantryRig')[0]:a for a in bpy.data.actions};character=next(o for o in bpy.data.objects if o.type=='MESH'and o.vertex_groups);weapon=bpy.data.objects.get('Weapon');assert weapon
  # A fixed grip reference from the original weapon-controlled walk. This is
  # a wrist alignment diagnostic, not a claim about palm/finger contact.
  if kind=='original':
   pose(rig,actions,['FB_Walk_Lower','FB_Walk_Upper'],0);leftGrip=weapon.matrix_world.inverted()@(rig.matrix_world@rig.pose.bones['wrist.L'].head);rightGrip=weapon.matrix_world.inverted()@(rig.matrix_world@rig.pose.bones['wrist.R'].head)
  result={}
  for action in ['walk','sprint']:
   info=source['factions'][faction]['clips'][action];D=info['duration']if kind=='imported'else(1.2 if action=='walk'else 2/3)
   names=[info['name']]if kind=='imported'else(['FB_Walk_Lower','FB_Walk_Upper']if action=='walk'else['SR_Sprint_Lower','SR_Sprint_Upper']);qs={n:[]for n in ['root','spine05','spine04','spine03','spine02','spine01','clavicle.L','clavicle.R']};rel=[];rows=[];maxSourceError=0
   for i in range(round(D*60)+1):
    t=min(i/60,D);pose(rig,actions,names,t)
    for n in qs:qs[n].append(rig.pose.bones[n].rotation_quaternion.copy())
    rel.append(rig.pose.bones['root'].matrix.to_quaternion().inverted()@rig.pose.bones['spine02'].matrix.to_quaternion())
    dg=bpy.context.evaluated_depsgraph_get();ev=character.evaluated_get(dg);mesh=ev.to_mesh();minimum=min((ev.matrix_world@v.co).z for v in mesh.vertices);ev.to_mesh_clear();weaponMin=min((weapon.matrix_world@v.co).z for v in weapon.data.vertices)
    gl=lambda side:(rig.matrix_world@rig.pose.bones['wrist.'+side].head)
    if kind=='imported'and i%2==0:
     sample=info['samples'][min(i//2,len(info['samples'])-1)]
     for n,b in sample['bones'].items():
      expected=Vector((b['p'][0],-b['p'][2],b['p'][1]));actual=rig.matrix_world@rig.pose.bones[n].head;maxSourceError=max(maxSourceError,(expected-actual).length)
    rows.append({'time':t,'meshMinZ':minimum,'weaponMinZ':weaponMin,'leftWristToReferenceGripM':(gl('L')-weapon.matrix_world@leftGrip).length,'rightWristToReferenceGripM':(gl('R')-weapon.matrix_world@rightGrip).length,'feet':{s:list(rig.matrix_world@rig.pose.bones['foot.'+s].head)for s in ['L','R']}})
   result[action]={'duration':D,'samplesHz':60,'localRotationRangeDeg':{n:span(q)for n,q in qs.items()},'chestRelativePelvisRangeDeg':span(rel),'minimumMeshZ':min(r['meshMinZ']for r in rows),'minimumWeaponZ':min(r['weaponMinZ']for r in rows),'maxLeftWristToReferenceGripM':max(r['leftWristToReferenceGripM']for r in rows),'maxRightWristToReferenceGripM':max(r['rightWristToReferenceGripM']for r in rows),'maxGLBReimportPositionErrorM':maxSourceError,'samples':rows}
   assert kind!='imported'or maxSourceError<.0001,(faction,action,maxSourceError)
   print('MEASURED',faction,kind,action,{k:v for k,v in result[action].items()if k!='samples'},flush=True)
  report[faction][kind]={'bones':len(rig.data.bones),'clips':result}
(ROOT/'validation/reimport-mechanics.json').write_text(json.dumps(report,indent=2)+'\n')
