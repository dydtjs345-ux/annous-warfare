import bpy,sys,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT.parent/'infantry-animation/tools'));from animation_io import pose
report=[]
for faction in ['USMC','Russian']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{faction}_SprintReview.blend'));r=bpy.data.objects['InfantryRig'];w=bpy.data.objects['Weapon'];pose(r,'Lower_Idle','FB_LowReady_Upper',0);reference=w.matrix_world.inverted()@r.pose.bones['wrist.L'].matrix;checks=[]
 for state,D in [('Sprint',2/3),('IdleToSprint',1.2),('WalkToSprint',1.2),('SprintToWalk',1.2),('SprintToStop',1.2)]:
  errors=[];rotations=[]
  for i in range(round(D*60)+1):
   pose(r,'SR_'+state+'_Lower','SR_'+state+'_Upper',i/60);expected=w.matrix_world@reference;actual=r.pose.bones['wrist.L'].matrix;errors.append((expected.translation-actual.translation).length);a=math.degrees(expected.to_quaternion().rotation_difference(actual.to_quaternion()).angle);rotations.append(min(a,360-a))
  assert max(errors)<.01 and max(rotations)<5,(faction,state,max(errors),max(rotations));checks.append({'state':state,'max_support_wrist_position_error_m':max(errors),'max_support_wrist_rotation_error_deg':max(rotations)})
 report.append({'faction':faction,'reference':'same LowReady weapon-relative support wrist frame','checks':checks});print('GRIP_VALIDATED',faction,checks,flush=True)
(ROOT/'diagnostics/grip-validation.json').write_text(json.dumps(report,indent=2))
