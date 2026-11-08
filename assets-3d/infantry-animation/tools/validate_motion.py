"""Numerical checks on actual authored skeleton poses, contacts and layers."""
import bpy,sys,json,os,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from animation_io import pose,apply_action
faction=os.environ.get('AW_FACTION','Russian');rig=bpy.data.objects['InfantryRig'];weapon=bpy.data.objects['Weapon'];char=bpy.data.objects[faction+'_Character'];meta=json.loads((ROOT/'validation'/f'{faction}-authoring.json').read_text());records={}
assert len(rig.data.bones)==163 and len(meta['actions'])==21
assert all(abs(sum(g.weight for g in v.groups)-1)<1e-5 and len(v.groups)<=4 for v in char.data.vertices)
for name in meta['actions']:assert bpy.data.actions.get(name)
# Closed endpoints on all loop layers, independent of visual rendering.
loops={}
for name,info in meta['actions'].items():
 if not info['loop']:continue
 a=bpy.data.actions[name];max_delta=max(abs(fc.evaluate(0)-fc.evaluate(info['duration']*30))for fc in a.fcurves);assert max_delta<1e-5,(name,max_delta);loops[name]=max_delta
# In-place stance motion must cancel the documented world travel speed.
plants={}
points={}
for side in ['L','R']:
 g=char.vertex_groups['foot.'+side].index;points[side]=[v.co.copy()for v in char.data.vertices if v.co.z<.25 and any(w.group==g and w.weight>.99 for w in v.groups)]
def foot_matrix(side):return rig.pose.bones['foot.'+side].matrix@rig.data.bones['foot.'+side].matrix_local.inverted()
def contact(side,M):
 values=[M@p for p in points[side]];minimum=min(p.z for p in values);ids=[i for i,p in enumerate(values)if p.z<minimum+1e-7]
 pitch=math.atan2(M[2][1],M[1][1]);i=min(ids,key=lambda j:points[side][j].y)if pitch>=0 else max(ids,key=lambda j:points[side][j].y)
 return i,values[i],minimum
for kind,speed,duration,duty in [('Walk',1.05,1.2,.62),('Sprint',3,.8,.32),('AimWalk',.62,1.2,.70)]:
 residuals=[]
 for i in range(round(duration*30)):
  t=i/30;t1=(i+1)/30;pose(rig,'Lower_'+kind,'Upper_Aim'if kind=='AimWalk'else'Upper_LowReady',t);m0={s:foot_matrix(s)for s in ['L','R']}
  pose(rig,'Lower_'+kind,'Upper_Aim'if kind=='AimWalk'else'Upper_LowReady',t1);m1={s:foot_matrix(s)for s in ['L','R']}
  for j,side in enumerate(['L','R']):
   phase=(t/duration+j*.5)%1;phase1=(t1/duration+j*.5)%1
   if .01<phase<duty-.01 and .01<phase1<duty-.01:
    index,p0,z0=contact(side,m0[side]);_,_,z1=contact(side,m1[side]);p1=m1[side]@points[side][index]
    if abs(p1.z-z1)<2e-6:residuals.append(((p1-p0)*30+Vector((0,-speed,0))).length)
 assert residuals and max(residuals)<.015,(kind,residuals)
 plants[kind]={'samples':len(residuals),'max_planted_support_vertex_world_velocity_residual_mps':max(residuals),'speed_mps':speed,'duration':duration}
transitions={}
for name,info in meta['actions'].items():
 if not info.get('contact_authored'):continue
 endpoint_errors=[];residuals=[]
 for t,kind in [(0,info['entry_gait']),(info['duration'],info['exit_gait'])]:
  pose(rig,name,'Upper_LowReady',t);observed={n:rig.pose.bones[n].matrix.copy()for n in info['bones']};pose(rig,'Lower_'+kind,'Upper_LowReady',0)
  error=max(abs(x-y)for n,M in observed.items()for r1,r2 in zip(M,rig.pose.bones[n].matrix)for x,y in zip(r1,r2));assert error<.001,(name,'endpoint mismatch',t,error);endpoint_errors.append(error)
 samples=info['plant_samples'];travel=info['travel_samples_m']
 for i in range(len(samples)-1):
  pose(rig,name,'Upper_LowReady',samples[i]['t']);m0={s:foot_matrix(s)for s in ['L','R']};pose(rig,name,'Upper_LowReady',samples[i+1]['t']);m1={s:foot_matrix(s)for s in ['L','R']}
  for side in ['L','R']:
   if samples[i]['feet'][side]['stance']and samples[i+1]['feet'][side]['stance']:
    index,p0,z0=contact(side,m0[side]);_,_,z1=contact(side,m1[side]);p1=m1[side]@points[side][index]
    if abs(p1.z-z1)<2e-6:residuals.append(((p1-p0)-Vector((0,travel[i+1]['distance_m']-travel[i]['distance_m'],0))).length*30)
 assert residuals and max(residuals)<.015,(name,'stance drift',residuals)
 transitions[name]={'max_endpoint_matrix_error':max(endpoint_errors),'support_vertex_samples':len(residuals),'max_planted_world_velocity_residual_mps':max(residuals),'root_travel_m':info['root_travel_end_m']}
turns={}
for name,sign in [('Turn_Left',1),('Turn_Right',-1)]:
 pose(rig,name,'Upper_LowReady',.9);observed={n:rig.pose.bones[n].matrix.copy()for n in meta['actions'][name]['bones']};pose(rig,'Lower_Idle','Upper_LowReady',0);R=Matrix.Rotation(sign*math.pi/4,4,'Z')
 error=max(abs(x-y)for n,M in observed.items()for r1,r2 in zip(M,R@rig.pose.bones[n].matrix)for x,y in zip(r1,r2));assert error<.001,(name,'turn endpoint mismatch',error);turns[name]=error
# Additive recoil must not alter a single lower-body transform.
recoil=[]
for time in [.1,.3,.5,.8,1.05]:
 pose(rig,'Lower_AimWalk','Upper_Aim',time);before={n:rig.pose.bones[n].matrix.copy()for n in meta['actions']['Lower_AimWalk']['bones']}
 pose(rig,'Lower_AimWalk','Upper_Aim',time,'Recoil_Shot',1/30)
 delta=max(abs(x-y)for n,M in before.items()for r1,r2 in zip(M,rig.pose.bones[n].matrix)for x,y in zip(r1,r2));assert delta<1e-6;recoil.append(delta)
# Check both palm anchors against actual weapon-local contact targets.
def palm(side):
 b=rig.data.bones['wrist.'+side];w=b.head_local;m=[rig.data.bones[f'finger{i}-1.{side}'].head_local for i in range(2,6)];a=w+(sum(m,Vector())/4-w)*.58
 return rig.pose.bones[b.name].matrix@b.matrix_local.inverted()@a
contacts=[]
for time in [0,.2,.6,1.0]:
 for rt in [None,1/30,2/30]:
  pose(rig,'Lower_AimWalk','Upper_Aim',time,'Recoil_Shot'if rt is not None else None,rt or 0)
  r=Vector((-.025,.061,-.028)if faction=='Russian'else(-.029,.048,-.036));l=Vector((.005,-.148,.043)if faction=='Russian'else(.005,-.12,.055))
  er=(palm('R')-weapon.matrix_world@r).length;el=(palm('L')-weapon.matrix_world@l).length;assert er<.001 and el<.006,(time,rt,er,el);contacts.append({'time':time,'recoil_time':rt,'right_palm_error_m':er,'left_palm_error_m':el})
# Magazine paths are actual animated objects with a concealed exchange at the pouch.
reload=meta['actions']['Reload'];mags=[bpy.data.objects['Magazine'],bpy.data.objects['SpareMagazine']];magrecords=[]
for fraction in [.30,.40,.65,.78,.86]:
 frame=round(fraction*reload['duration']*30);t=frame/30;pose(rig,'Lower_AimStance','Reload',t)
 for ob in mags:
  ob.rotation_mode='QUATERNION';ob.matrix_basis=Matrix.Identity(4)
  action=bpy.data.actions[reload['object_actions'][ob.name]]
  for fc in action.fcurves:getattr(ob,fc.data_path)[fc.array_index]=fc.evaluate(frame)
 bpy.context.view_layer.update();held=mags[0 if fraction<.52 else 1];target=held.matrix_world@Vector((.024,-.12,-.075));error=(palm('L')-target).length
 if fraction<.84:assert error<.006,('Magazine handoff error',fraction,error)
 magrecords.append({'fraction':fraction,'held':held.name,'left_palm_contact_error_m':error,'weapon_relative_translation_m':list(held.location)})
for ob in mags:ob.matrix_basis=Matrix.Identity(4)if ob.name=='Magazine'else Matrix.Diagonal((.001,.001,.001,1))
report={'faction':faction,'loop_endpoint_max_curve_deltas':loops,'planted_foot_checks':plants,'contact_transitions':transitions,'turn_orientation_commit_endpoint_errors':turns,'moving_fire_lower_body_matrix_deltas':recoil,'aim_and_recoil_palm_contacts':contacts,'reload_handoffs':magrecords,'max_ik_wrist_error_m':meta['max_ik_wrist_error_m'],'skin_repair':meta['skin_repair'],'limitations':['Flat-contact intervals are tested against authored travel speed; heel/toe roll and starts/stops need separate biomechanical judgement.','Nearest contact anchors do not prove collision-free finger volumes.']}
(ROOT/'validation'/f'{faction}-motion-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('MOTION_VALIDATION_PASS',faction,json.dumps(plants),flush=True)
