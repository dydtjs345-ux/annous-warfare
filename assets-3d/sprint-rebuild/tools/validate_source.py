"""Source, NLA, GLB reimport, actual contact and preserved assets validation."""
import bpy,sys,math,json,hashlib,os
from pathlib import Path
from mathutils import Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT.parent/'infantry-animation/tools'));from animation_io import pose,apply_action
NAMES=['root','pelvis.L','pelvis.R','upperleg01.L','lowerleg01.L','foot.L','upperleg01.R','lowerleg01.R','foot.R','spine05','spine04','spine03','spine02','spine01','clavicle.L','clavicle.R','shoulder01.L','shoulder01.R','neck01','head','wrist.L','wrist.R']
report=[];dense=[]
def point(b):return list(b.matrix.translation)
def geometry(ch,r):
 return {'rest':hashlib.sha256(str([(b.name,b.parent.name if b.parent else None,list(sum((list(x)for x in b.matrix_local),[])))for b in r.data.bones]).encode()).hexdigest(),'geometry':hashlib.sha256(str([list(v.co)for v in ch.data.vertices]).encode()).hexdigest(),'weights':hashlib.sha256(str([[(g.group,g.weight)for g in v.groups]for v in ch.data.vertices]).encode()).hexdigest()}
for faction in ['USMC','Russian']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT.parent/'full-body-debug/source'/f'{faction}_FullBody.blend'));before=geometry(bpy.data.objects[faction+'_Character'],bpy.data.objects['InfantryRig'])
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{faction}_SprintReview.blend'));r=bpy.data.objects['InfantryRig'];ch=bpy.data.objects[faction+'_Character'];assert before==geometry(ch,r);meta=json.loads((ROOT/'diagnostics'/f'{faction}-authored.json').read_text());bones=[b.name for b in r.data.bones];boots={};maxloop=0;records=[]
 for side in ['L','R']:
  g=ch.vertex_groups['foot.'+side].index;boots[side]=[v.co.copy() for v in ch.data.vertices if v.co.z<.25 and any(x.group==g and x.weight>.99 for x in v.groups)]
 for state in ['Sprint','IdleToSprint','WalkToSprint','SprintToWalk','SprintToStop']:
  lo='SR_'+state+'_Lower';up='SR_'+state+'_Upper';info=meta['all_export_actions'][lo];D=info['duration'];samples=[]
  for i in range(round(D*60)+1):
   t=i/60;pose(r,lo,up,t);row={'t':t,'bones':{},'feet':{}}
   for n in bones:
    b=r.pose.bones[n];row['bones'][n]={'p':list(b.head),'q':list(b.matrix.to_quaternion())}
   for side in ['L','R']:
    M=r.pose.bones['foot.'+side].matrix@r.data.bones['foot.'+side].matrix_local.inverted();pts=[M@p for p in boots[side]];idx=min(range(len(pts)),key=lambda k:pts[k].z);hip=r.pose.bones['upperleg01.'+side].head;knee=r.pose.bones['lowerleg01.'+side].head;foot=r.pose.bones['foot.'+side].head
    row['feet'][side]={'min_z':pts[idx].z,'support':list(pts[idx]),'index':idx,'knee_flex_deg':180-math.degrees((hip-knee).angle(foot-knee)),'hip_angle_deg':math.degrees(math.atan2(-(knee-hip).y,-(knee-hip).z)),'ankle_deg':math.degrees(math.atan2(M[2][1],M[1][1])-math.atan2((foot-knee).y,-(foot-knee).z)+math.atan2((r.data.bones['foot.'+side].head_local-r.data.bones['lowerleg01.'+side].head_local).y,-(r.data.bones['foot.'+side].head_local-r.data.bones['lowerleg01.'+side].head_local).z)),'matrix':list(sum((list(x)for x in M),[]))}
   row['weapon']={'p':list(bpy.data.objects['Weapon'].matrix_world.translation),'q':list(bpy.data.objects['Weapon'].matrix_world.to_quaternion())};samples.append(row)
  if state=='Sprint':
   maxloop=max((Vector(samples[0]['bones'][n]['p'])-Vector(samples[-1]['bones'][n]['p'])).length for n in bones);assert maxloop<1e-5
  # Compare actual NLA composition rather than only direct F-curve evaluation.
  test=.173;pose(r,lo,up,test);expected={n:r.pose.bones[n].matrix.copy()for n in bones}
  for tr in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(tr)
  for name in [lo,up]:
   tr=r.animation_data.nla_tracks.new();st=tr.strips.new(name,0,bpy.data.actions[name]);st.action_frame_start=0;st.action_frame_end=D*30;st.extrapolation='NOTHING'
  bpy.context.scene.frame_set(int(test*30),subframe=test*30%1);bpy.context.view_layer.update();nlaerr=max(abs(r.pose.bones[n].matrix[x][y]-M[x][y])for n,M in expected.items()for x in range(4)for y in range(4));assert nlaerr<.0001
  records.append({'state':state,'duration':D,'samples':samples,'nla_error':nlaerr})
 stats={};run=records[0]['samples']
 for side in ['L','R']:
  slips=[]
  for A,B in zip(run,run[1:]):
   a=A['feet'][side];b=B['feet'][side]
   if max(a['min_z'],b['min_z'])<.008 and a['index']==b['index']:
    slips.append(math.hypot((b['support'][0]-a['support'][0])*60,(b['support'][1]-a['support'][1])*60-3.6))
  stats[side]={'ankle_relative_deg':[min(x['feet'][side]['ankle_deg']for x in run),max(x['feet'][side]['ankle_deg']for x in run)],'hip_angle_deg':[min(x['feet'][side]['hip_angle_deg']for x in run),max(x['feet'][side]['hip_angle_deg']for x in run)],'knee_flex_deg':[min(x['feet'][side]['knee_flex_deg']for x in run),max(x['feet'][side]['knee_flex_deg']for x in run)],'sole_z_m':[min(x['feet'][side]['min_z']for x in run),max(x['feet'][side]['min_z']for x in run)],'contact_fraction':sum(x['feet'][side]['min_z']<.008 for x in run)/len(run),'same_material_contact_slip_rms_mps':math.sqrt(sum(x*x for x in slips)/len(slips)),'same_material_contact_slip_max_mps':max(slips)}
 stats['flight_fraction']=sum(x['feet']['L']['min_z']>.008 and x['feet']['R']['min_z']>.008 for x in run)/len(run);stats['vertical_root_range_m']=[min(x['bones']['root']['p'][2]for x in run),max(x['bones']['root']['p'][2]for x in run)]
 for side in ['L','R']:assert -25<stats[side]['ankle_relative_deg'][0] and stats[side]['ankle_relative_deg'][1]<30
 # Boundaries of the transition must match source idle/walk/new canonical poses.
 transitions=[]
 for record in records[1:]:
  name=record['state'];entry,exit={'IdleToSprint':('Idle','New'),'WalkToSprint':('Walk','New'),'SprintToWalk':('New','Walk'),'SprintToStop':('New','Idle')}[name];errors=[]
  for kind,sample in [(entry,record['samples'][0]),(exit,record['samples'][-1])]:
   lo,up={'Idle':('Lower_Idle','FB_LowReady_Upper'),'Walk':('FB_Walk_Lower','FB_Walk_Upper'),'New':('SR_Sprint_Lower','SR_Sprint_Upper')}[kind];pose(r,lo,up,0);errors.append(max((r.pose.bones[n].head-Vector(sample['bones'][n]['p'])).length for n in bones))
  slips=[];distances=meta['all_export_actions']['SR_'+name+'_Lower']['travel_samples_m']
  for i,(A,B)in enumerate(zip(record['samples'],record['samples'][1:])):
   for side in ['L','R']:
    x=A['feet'][side];y=B['feet'][side]
    if max(x['min_z'],y['min_z'])<.008 and x['index']==y['index']:
     slips.append(math.hypot((y['support'][0]-x['support'][0])*60,(y['support'][1]-x['support'][1]-distances[i+1]['distance_m']+distances[i]['distance_m'])*60))
  transitions.append({'state':name,'boundary_errors_m':errors,'ankle_relative_deg':[min(x['feet'][side]['ankle_deg']for x in record['samples']for side in ['L','R']),max(x['feet'][side]['ankle_deg']for x in record['samples']for side in ['L','R'])],'same_material_contact_slip_rms_mps':math.sqrt(sum(v*v for v in slips)/len(slips)),'same_material_contact_slip_max_mps':max(slips)});assert max(errors)<.002,(name,errors);assert -35<transitions[-1]['ankle_relative_deg'][0] and transitions[-1]['ankle_relative_deg'][1]<40,(name,transitions[-1]['ankle_relative_deg'])
 dense.append({'faction':faction,'states':records,'bones':bones});report.append({'faction':faction,'bones':len(bones),'preserved_geometry_rest_weights':before,'geometry_rest_weights_match':True,'loop_error_m':maxloop,'running':stats,'transitions':transitions})
 print('SOURCE_SPRINT',faction,json.dumps(report[-1]),flush=True)
(ROOT/'diagnostics/source-samples.json').write_text(json.dumps(dense,separators=(',',':')))
(ROOT/'diagnostics/source-stats.json').write_text(json.dumps(report,indent=2))
if os.environ.get('AW_SOURCE_ONLY')=='1':sys.exit(0)
# Reimport in a fresh empty scene and compare bone positions and rotation changes.
for item,ref in zip(report,dense):
 faction=item['faction'];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/f'{faction}_SprintReview.glb'));r=next(o for o in bpy.data.objects if o.type=='ARMATURE');actions={t.name:t.strips[0].action for t in r.animation_data.nla_tracks}
 for name,ac in actions.items():ac.name=name
 for ac in bpy.data.actions:
  if not ac.fcurves:continue
  offset=min(k.co.x for f in ac.fcurves for k in f.keyframe_points)
  for f in ac.fcurves:
   for k in f.keyframe_points:k.co.x-=offset;k.handle_left.x-=offset;k.handle_right.x-=offset
 checks=[]
 for record in ref['states']:
  maxp=0;maxq=0;q0={};rows=record['samples']
  for sample in rows:
   t=sample['t'];pose(r,'SR_'+record['state']+'_Lower','SR_'+record['state']+'_Upper',t)
   for name,row in sample['bones'].items():
    p=r.matrix_world@r.pose.bones[name].head;q=(r.matrix_world@r.pose.bones[name].matrix).to_quaternion();maxp=max(maxp,(p-Vector(row['p'])).length)
    if name not in q0:q0[name]=q.copy()
    actual=q@q0[name].inverted();expected=Quaternion(row['q'])@Quaternion(rows[0]['bones'][name]['q']).inverted();angle=math.degrees(actual.rotation_difference(expected).angle);maxq=max(maxq,min(angle,360-angle))
  assert maxp<.002 and maxq<.15,(faction,record['state'],maxp,maxq);checks.append({'state':record['state'],'max_position_error_m':maxp,'max_rotation_delta_error_degrees':maxq})
 item['reimport']=checks;print('REIMPORT_SPRINT',faction,checks,flush=True)
(ROOT/'diagnostics/source-and-reimport.json').write_text(json.dumps(report,indent=2))
