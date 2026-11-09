"""Evaluate the same authored layers and 60Hz fire schedule used by diagnostics."""
import bpy,sys,math
from pathlib import Path
from mathutils import Matrix
BASE=Path(__file__).resolve().parents[2]/'infantry-animation';sys.path.insert(0,str(BASE/'tools'));from animation_io import pose,apply_action
PAIRS={'before':{'Walk':('Lower_Walk','Upper_LowReady'),'Sprint':('Lower_Sprint','Upper_Sprint'),'AimWalk':('Lower_AimWalk','Upper_Aim'),'MovingFire':('Lower_AimWalk','Upper_Aim'),'Reload':('Reload_Tactical_Lower','Reload_Tactical')},'after':{'Walk':('FB_Walk_Lower','FB_Walk_Upper'),'Sprint':('FB_Sprint_Lower','FB_Sprint_Upper'),'AimWalk':('FB_AimWalk_Lower','FB_AimWalk_Upper'),'MovingFire':('FB_AimWalk_Lower','FB_AimWalk_Upper'),'Reload':('FB_Reload_Lower','FB_Reload_Upper')}}
def evaluate(rig,mag,spare,variant,state,t,D):
 lo,up=PAIRS[variant][state];reference='Upper_Aim'if variant=='before'else'FB_AimIdle_Upper';shot='Recoil_Shot'if variant=='before'else'FB_Recoil_Shot'
 if state=='Reload'and t>D:pose(rig,'Lower_AimStance',reference,0);mag.matrix_basis=Matrix.Identity(4);spare.matrix_basis=Matrix.Diagonal((.001,.001,.001,1));return
 pose(rig,None,None,0)
 for name in [lo,up]:
  duration=(bpy.data.actions[name].frame_range[1]-bpy.data.actions[name].frame_range[0])/30;apply_action(rig,bpy.data.actions[name],min(t,duration)if state=='Reload'else t%duration)
 if state=='MovingFire':
  starts=[];nextShot=0
  for i in range(1,round(t*60)+1):
   now=i/60
   if now+1e-9>=nextShot:starts.append(now-1/60);nextShot=now+.14
  for start in starts[-2:]:
   age=t-start
   if not 0<=age<.2:continue
   current={b.name:(b.location.copy(),b.rotation_quaternion.copy())for b in rig.pose.bones};apply_action(rig,bpy.data.actions[reference],0);ref={b.name:(b.location.copy(),b.rotation_quaternion.copy())for b in rig.pose.bones};apply_action(rig,bpy.data.actions[shot],age)
   for b in rig.pose.bones:
    p,q=current[b.name];p0,q0=ref[b.name];b.location=p+b.location-p0;b.rotation_quaternion=q@q0.inverted()@b.rotation_quaternion
 if state=='Reload':
  for ob,name in [(mag,'Reload_Tactical_Magazine'),(spare,'Reload_Tactical_SpareMagazine')]:
   ob.rotation_mode='QUATERNION'
   for f in bpy.data.actions[name].fcurves:getattr(ob,f.data_path)[f.array_index]=f.evaluate(t*30)
 else:mag.matrix_basis=Matrix.Identity(4);spare.matrix_basis=Matrix.Diagonal((.001,.001,.001,1))
 bpy.context.view_layer.update()
