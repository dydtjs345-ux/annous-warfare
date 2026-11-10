import bpy,sys,os,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];CACHE=Path(os.environ.get('AW_SOURCE_CACHE',str(ROOT.parents[1]/'.cache/tactical-source/assets-3d')));sys.path.insert(0,str(CACHE/'infantry-animation/tools'))
from animation_io import pose
faction=os.environ.get('AW_FACTION','USMC');bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{faction}_CrawlRework.blend'))
r=bpy.data.objects['InfantryRig'];ch=bpy.data.objects[faction+'_Character'];w=bpy.data.objects['Weapon'];pose(r,'Lower_AimStance','FB_AimIdle_Upper',0);grip=w.matrix_world.inverted()@r.pose.bones['wrist.R'].matrix
labels=[]
for v in ch.data.vertices:
 name=ch.vertex_groups[max(v.groups,key=lambda g:g.weight).group].name;side=name[-1]if name.endswith(('.L','.R'))else''
 region='arm'+side if name.startswith(('upperarm','lowerarm'))else'hand'+side if name.startswith(('wrist','finger','metacarpal'))else'leg'+side if name.startswith(('upperleg','lowerleg'))else'boot'+side if name.startswith(('foot','toe'))else'body';labels.append(region)
frames=[];anchors={};drifts=[];pose0=None;loopError=0;segmentError=0
for i in range(145):
 t=i/60;p=t/2.4;pose(r,'TC_CrawlForward_Lower','TC_CrawlForward_Upper',t)
 matrices={b.name:b.matrix.copy()for b in r.pose.bones}
 if i==0:pose0=matrices
 if i==144:loopError=max(max(abs(v)for row in (matrices[n]-M)for v in row)for n,M in pose0.items())
 evaluated=ch.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();minimum={}
 for v,region in zip(mesh.vertices,labels):minimum[region]=min(minimum.get(region,100),v.co.z)
 evaluated.to_mesh_clear()
 contacts={}
 for side,offset in [('L',0),('R',.5)]:
  u=(p+offset)%1;stance=u<=.5+1e-8
  contacts[side]=stance
  if stance:
   pos=r.pose.bones['lowerarm01.'+side].head.copy();pos.y-=.23*t;key=('elbow',side,math.floor(p+offset+1e-8))
   if key not in anchors:anchors[key]=pos
   drifts.append({'time':t,'contact':'elbow.'+side,'errorM':(pos-anchors[key]).length})
 for side,offset in [('L',.5),('R',0)]:
  u=(p+offset)%1
  if u<=.6+1e-8:
   pos=r.pose.bones['foot.'+side].head.copy();pos.y-=.23*t;key=('foot',side,math.floor(p+offset+1e-8))
   if key not in anchors:anchors[key]=pos
   drifts.append({'time':t,'contact':'foot.'+side,'errorM':(pos-anchors[key]).length})
 for side in ['L','R']:
  for a,b in [('upperarm01.','lowerarm01.'),('lowerarm01.','wrist.'),('upperleg01.','lowerleg01.'),('lowerleg01.','foot.')]:segmentError=max(segmentError,abs((r.pose.bones[a+side].head-r.pose.bones[b+side].head).length-(r.data.bones[a+side].head_local-r.data.bones[b+side].head_local).length))
 frames.append({'time':t,'regionMinZ':minimum,'forearmSupport':contacts,'rightGripErrorM':(r.pose.bones['wrist.R'].head-(w.matrix_world@grip).translation).length,'weaponMinZ':min((w.matrix_world@v.co).z for v in w.data.vertices)})
result={'faction':faction,'sampleRateHz':60,'frames':frames,'contactDrift':drifts,'maxContactDriftM':max(v['errorM']for v in drifts),'maxSegmentLengthErrorM':segmentError,'loopMatrixError':loopError,'maxRightGripErrorM':max(v['rightGripErrorM']for v in frames),'minimumMeshZ':min(min(v['regionMinZ'].values())for v in frames),'minimumWeaponZ':min(v['weaponMinZ']for v in frames),'supportMisses':[{'time':v['time'],'side':s,'height':v['regionMinZ']['arm'+s]}for v in frames for s in ['L','R']if v['forearmSupport'][s]and v['regionMinZ']['arm'+s]>.015]}
(ROOT/'validation'/f'{faction}-source.json').write_text(json.dumps(result,indent=2)+'\n')
assert result['minimumMeshZ']>-.0041,result['minimumMeshZ'];assert result['minimumWeaponZ']>.001;assert not result['supportMisses'],result['supportMisses'];assert result['maxContactDriftM']<.0015,result['maxContactDriftM'];assert result['maxSegmentLengthErrorM']<.0001;assert result['loopMatrixError']<.0001;assert result['maxRightGripErrorM']<.0001
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/f'{faction}_CrawlRework.glb'));rigs=[o for o in bpy.data.objects if o.type=='ARMATURE'];assert len(rigs)==1 and len(rigs[0].data.bones)==163;result['reimport']={'armatures':1,'bones':163};(ROOT/'validation'/f'{faction}-source.json').write_text(json.dumps(result,indent=2)+'\n');print('SOURCE_VALIDATED',faction,{k:v for k,v in result.items()if k not in ['frames','contactDrift']},flush=True)
