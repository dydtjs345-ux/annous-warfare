"""Measure the actual final GLB, including skin, planted feet and between-key grip."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1];MODEL=ROOT/'models/TacticalSuit_Phase2.glb';refs=json.loads((ROOT.parent/'tactical-suit-evaluation/validation/rifle-reference.json').read_text())['actions']['walk'];authored=json.loads((ROOT/'validation/authored-retarget.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=240;bpy.ops.import_scene.gltf(filepath=str(MODEL));objects=[o for o in bpy.data.objects if not any(c.name=='glTF_not_exported'for c in o.users_collection)];rig=next(o for o in objects if o.type=='ARMATURE');weapon=bpy.data.objects['Weapon'];tracks={};rest={o:o.matrix_basis.copy()for o in objects}
for o in objects:
 if o.animation_data:
  o.animation_data.action=None
  for tr in o.animation_data.nla_tracks:
   tr.mute=True
   for st in tr.strips:tracks.setdefault(tr.name,[]).append((o,st.action))
feet={};meshes=[o for o in objects if o.type=='MESH'and o.vertex_groups]
for o in meshes:
 p=[o.matrix_world@v.co for v in o.data.vertices]
 if max(v.z for v in p)<.32:feet[o]={s:[i for i,v in enumerate(p)if(v.x>=0 if s=='Left'else v.x<0)]for s in ['Left','Right']}
assert feet,'Boot skin not found'
def contact(info,side,t,D):
 p=info['contactPlan'][side]
 return p['continuousContact']or any(a+k*D<=t<b+k*D for a,b in p['contactIntervalsS']for k in [-1,0,1])
report={'modelSha256':hashlib.sha256(MODEL.read_bytes()).hexdigest(),'source':'Final Phase 2 GLB reimported into Blender; no browser claim','sampleHz':480,'joints':len(rig.data.bones),'actions':{}}
for action in ['idle','walk']:
 info=authored['actions'][action];name=info['clip'];D=info['duration'];pairs=[p for n,ps in tracks.items()if n==name or n.startswith(name+'_')for p in ps];assert pairs
 landmarks={}
 for side,spec in info['contactSkinLandmarks'].items():
  goal=Vector(spec['restWorldM']);choices=[(o,j,(o.matrix_world@o.data.vertices[j].co-goal).length)for o,sets in feet.items()for j in sets[side]];o,j,error=min(choices,key=lambda x:x[2]);assert error<.0001,('Landmark rest mismatch',side,error);landmarks[side]=(o.name,j)
 rows=[];anchors={};maxdrift={s:0 for s in ['Left','Right']};maxsole={s:0 for s in ['Left','Right']};vertexAnchors={};vertexDrift={s:0 for s in ['Left','Right']};vertexHeight={s:0 for s in ['Left','Right']}
 for i in range(round(D*480)+1):
  t=i/480
  for o in objects:
   o.matrix_basis=rest[o]
   if o.type=='ARMATURE':
    for b in o.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
  for o,ac in pairs:
   for fc in ac.fcurves:
    try:o.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*240)
    except(ValueError,AttributeError,IndexError):pass
  bpy.context.view_layer.update();errors=[]
  for side,label in [('Left','L'),('Right','R')]:
   b=next(b for b in rig.pose.bones if side+'Hand_'in b.name);errors.append(((rig.matrix_world@b.head)-(weapon.matrix_world@Vector(refs['hands'][label]['wrist']))).length)
  minZ=100;footPoints={s:[]for s in ['Left','Right']};dg=bpy.context.evaluated_depsgraph_get()
  for o in meshes:
   e=o.evaluated_get(dg);m=e.to_mesh();points=[e.matrix_world@v.co for v in m.vertices];minZ=min(minZ,min(p.z for p in points))
   if o in feet:
    for side,indices in feet[o].items():footPoints[side].extend((o.name,j,points[j])for j in indices)
   e.to_mesh_clear()
  planted={s:contact(info,s,t,D)for s in ['Left','Right']};forefeet={}
  for side in ['Left','Right']:
   b=next(b for b in rig.pose.bones if side+'ToeBase_'in b.name);p=rig.matrix_world@b.head;forefeet[side]=list(p)
   if planted[side]:
    z=min(v.z for _,_,v in footPoints[side]);maxsole[side]=max(maxsole[side],z)
    if side not in anchors:
     anchors[side]=p.copy();candidates=[v for v in footPoints[side]if v[2].z<=z+.003];closest=next(v for v in footPoints[side]if (v[0],v[1])==landmarks[side]);vertexAnchors[side]=closest
    maxdrift[side]=max(maxdrift[side],math.hypot(p.x-anchors[side].x,p.y-anchors[side].y));mesh,index,start=vertexAnchors[side];v=next(v for n,j,v in footPoints[side]if n==mesh and j==index);vertexHeight[side]=max(vertexHeight[side],v.z)
    if v.z<=.006:vertexDrift[side]=max(vertexDrift[side],math.hypot(v.x-start.x,v.y-start.y))
   else:anchors.pop(side,None);vertexAnchors.pop(side,None)
  rows.append({'time':t,'wristErrorsM':errors,'minimumBodyZ':minZ,'planted':planted,'forefeetWorld':forefeet,'weaponMinZ':min((weapon.matrix_world@v.co).z for v in weapon.data.vertices)})
 result={'clip':name,'duration':D,'maximumWristErrorM':max(max(r['wristErrorsM'])for r in rows),'minimumBodyZ':min(r['minimumBodyZ']for r in rows),'minimumWeaponZ':min(r['weaponMinZ']for r in rows),'maximumPlantedForefootXYDriftM':maxdrift,'maximumSupportSoleHeightM':maxsole,'groundedSkinVertexXYDriftM':vertexDrift,'trackedSkinVertexMaxHeightM':vertexHeight,'frames':rows};report['actions'][action]=result;print('REIMPORT',action,{k:v for k,v in result.items()if k!='frames'},flush=True);(ROOT/'validation/reimport-partial.json').write_text(json.dumps(report,indent=2)+'\n')
 assert result['maximumWristErrorM']<.003;assert result['minimumBodyZ']>-.005;assert result['minimumWeaponZ']>.15;assert max(vertexDrift.values())<.003;assert max(maxsole.values())<.005
(ROOT/'validation/reimport.json').write_text(json.dumps(report,indent=2)+'\n')
