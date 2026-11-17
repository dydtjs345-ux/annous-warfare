"""Cover exit derived from existing 45-degree turns and the approved Quaternius walk.
No original turn/walk clip is replaced. Settle, contact retarget and braking are explicit adaptations.
"""
import bpy,math,sys,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('cover_rig',ROOT/'tools/cover-rig.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ExitRig(m.CoverRig):
 D=4+1/3
 def __init__(self,kind):
  super().__init__(kind,keep_approved=True);self.pose(0,1,'Stand','Corner');self.footBase={s:self.p(s+'Foot').copy()for s in ['Left','Right']};self.native(0);self.nativeStart={s:self.p(s+'Foot').copy()for s in ['Left','Right']};self.nativeHip0=self.p('Hips').copy();self.pose(0,1,'Stand','Corner');self.cache={};self.turnBases={};self.lastFeet=None
 def snapshot(self):return{n:b.matrix_basis.copy()for n,b in self.rig.pose.bones.items()},self.weapon.matrix_world.copy()
 def apply(self,snap):
  poses,W=snap
  for n,M in poses.items():self.rig.pose.bones[n].matrix_basis=M
  self.weapon.matrix_world=W;self.update()
 def blend(self,A,B,u):
  for n,b in self.rig.pose.bones.items():
   p,q,s=A[0][n].decompose();p1,q1,s1=B[0][n].decompose();b.matrix_basis=Matrix.Translation(p.lerp(p1,u))@q.slerp(q1,u).to_matrix().to_4x4()@Matrix.Diagonal((*s.lerp(s1,u),1))
  p,q,s=A[1].decompose();p1,q1,s1=B[1].decompose();self.weapon.matrix_world=Matrix.Translation(p.lerp(p1,u))@q.slerp(q1,u).to_matrix().to_4x4();self.update()
 def hands(self,Q=None,P=None):
  if Q is not None:self.weapon.matrix_world=Matrix.Translation(P)@Q.to_matrix().to_4x4();self.update()
  W=self.weapon.matrix_world;Q=W.to_quaternion();center=(self.p('LeftArm')+self.p('RightArm'))/2;errors=[]
  for s,label,sgn in [('Left','L',1),('Right','R',-1)]:
   d=self.ref['hands'][label];r,e=self.solve(s+'Arm',s+'ForeArm',s+'Hand',W@Vector(d['wrist']),center+Vector((sgn*.4,.05,-.3)));errors.append(e);H=Q@Quaternion(d['handFrame']);self.orient(s+'Hand',H@self.handCorrections[s]);normal=H@Vector((0,0,1))
   for di,digit in enumerate(['Thumb','Index','Middle','Ring','Pinky'],1):
    for ph in range(1,4):n=f'{s}Hand{digit}{ph}';self.orient(n,self.frame(Q@Vector(d['fingerDirections'][f'{di}-{ph}']),normal)@self.fingerCorrections[n])
  return errors
 def feet(self,goals,qs,yaw=0):
  for _ in range(3):
   # Keep actual leg lengths rather than stretching the knees.
   down=0
   for s in ['Left','Right']:
    hip=self.p(s+'UpLeg');L=(self.rest[s+'Leg']['p']-self.rest[s+'UpLeg']['p']).length+(self.rest[s+'Foot']['p']-self.rest[s+'Leg']['p']).length-.002;d=hip-goals[s];xy=Vector((d.x,d.y,0)).length
    if xy<L:down=max(down,d.z-math.sqrt(L*L-xy*xy))
   if down>0:
    b=self.rig.pose.bones[self.bones['Hips']];M=b.matrix.copy();p=self.rig.matrix_world@M.translation;p.z-=down;M.translation=self.rig.matrix_world.inverted()@p;b.matrix=M;self.update()
   for s,sgn in [('Left',1),('Right',-1)]:
    self.solve(s+'UpLeg',s+'Leg',s+'Foot',goals[s],self.p('Hips')+Quaternion((0,0,1),yaw)@Vector((sgn*.2,-1,-.5)));self.orient(s+'Foot',qs[s][0]);self.orient(s+'ToeBase',qs[s][1]);low=self.bootmin(s)
    if low<.001:goals[s].z+=.001-low
 def native(self,t):
  for b in self.rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
  self.weapon.matrix_world=Matrix.Identity(4)
  for role,action in self.approved['SU_Quaternius_Walk_Rifle']:
   o=self.rig if role=='rig'else self.weapon if role=='Weapon'else None
   if not o:continue
   for fc in action.fcurves:
    try:o.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*self.approvedFPS)
    except(ValueError,AttributeError,IndexError):pass
  self.update()
 def turn(self,t,side):
  sign=1 if side>0 else-1;step=min(1,int(t/.9));tt=min(.9,t-step*.9);names=['Turn_Left','Upper_Turn_Left']if side>0 else['Turn_Right','Upper_Turn_Right']
  for b in self.src.pose.bones:b.matrix_basis=Matrix.Identity(4)
  for name in names:
   for fc in self.actions[name].fcurves:
    try:self.src.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(tt*30)
    except(ValueError,AttributeError,IndexError):pass
  self.update()
  if side not in self.turnBases:
   values={s:(m.worldpoint(self.src,'foot.'+label).copy(),m.worldq(self.src,'foot.'+label).copy())for s,label in [('Left','L'),('Right','R')]}
   if tt!=0:
    for b in self.src.pose.bones:b.matrix_basis=Matrix.Identity(4)
    for name in names:
     for fc in self.actions[name].fcurves:
      try:self.src.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(0)
      except(ValueError,AttributeError,IndexError):pass
    self.update();values={s:(m.worldpoint(self.src,'foot.'+label).copy(),m.worldq(self.src,'foot.'+label).copy())for s,label in [('Left','L'),('Right','R')]}
   self.turnBases[side]=values
   if tt!=0:return self.turn(t,side)
  extra=Quaternion((0,0,1),sign*step*math.pi/4);sourceRoot=self.src.pose.bones['root'];qy=(self.src.matrix_world@sourceRoot.matrix).to_quaternion()@self.sourceRest['Hips']['q'].inverted();yaw=qy.to_euler('XYZ').z+sign*step*math.pi/4
  for b in self.rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
  self.update()
  for k,n in self.mapping.items():self.orient(k,extra@m.worldq(self.src,n)@self.sourceRest[k]['q'].inverted()@self.rest[k]['q'])
  hip=.83+(self.nativeHip0.z-.83)*m.smooth(max(0,(t-.9)/.9));b=self.rig.pose.bones[self.bones['Hips']];M=b.matrix.copy();M.translation=self.rig.matrix_world.inverted()@Vector((0,.03,hip));b.matrix=M;self.update();goals={};qs={};lifts={}
  pivot=Vector((0,.03,0))
  for s,label in [('Left','L'),('Right','R')]:
   n='foot.'+label;srcp=m.worldpoint(self.src,n);srcq=m.worldq(self.src,n);q0=self.turnBases[side][s][1];footYaw=(srcq@q0.inverted()).to_euler('XYZ').z;R=extra@Quaternion((0,0,1),footYaw);p=pivot+R@(self.footBase[s]-pivot);lift=max(0,srcp.z-self.turnBases[side][s][0].z);p.z=self.footBase[s].z+lift*.94;goals[s]=p;qs[s]=[R@self.rest[s+'Foot']['q'],R@self.rest[s+'ToeBase']['q']];lifts[s]=lift
  swing=max(lifts,key=lifts.get)
  if lifts[swing]>.001:
   supporting='Right'if swing=='Left'else'Left';v=goals[supporting]-Vector((0,.03,goals[supporting].z));shift=v.normalized()*(.085*min(1,lifts[swing]/.045));b=self.rig.pose.bones[self.bones['Hips']];M=b.matrix.copy();p=self.rig.matrix_world@M.translation;p+=shift;M.translation=self.rig.matrix_world.inverted()@p;b.matrix=M;self.update()
  self.feet(goals,qs,yaw);center=(self.p('LeftArm')+self.p('RightArm'))/2;Q=Quaternion((0,0,1),yaw)@m.rot(28,0,10);P=center+Quaternion((0,0,1),yaw)@Vector((-.13,-.11,-.13));self.hands(Q,P);return goals,qs
 def prepare(self,stance,style,side):
  key=(stance,style,side)
  if key in self.cache:return self.cache[key]
  self.pose(0,side,stance,style);A=self.snapshot();self.turn(0,side);B=self.snapshot();self.turn(1.8,side);end=self.snapshot();goals={s:self.p(s+'Foot').copy()for s in ['Left','Right']};qs={s:[self.q(s+'Foot'),self.q(s+'ToeBase')]for s in ['Left','Right']};R=Quaternion((0,0,1),side*math.pi/2);self.native(0);pivot=Vector((0,.03,0));F=Matrix.Translation(pivot)@R.to_matrix().to_4x4()@Matrix.Translation(Vector((-self.nativeHip0.x,-self.nativeHip0.y,0)));nativeGoals={s:F@self.p(s+'Foot')for s in ['Left','Right']};offset={s:Vector((goals[s].x-nativeGoals[s].x,goals[s].y-nativeGoals[s].y,0))for s in ['Left','Right']};data=(A,B,end,goals,qs,F,offset);self.cache[key]=data;return data
 def exitPose(self,t,stance='Stand',style='Corner',side=1):
  A,B,turnEnd,endGoals,endQ,F,offset=self.prepare(stance,style,side);yaw=side*math.pi/2
  if t<.8:
   self.blend(A,B,m.smooth(t/.8));goals={s:self.footBase[s].copy()for s in ['Left','Right']};qs={s:[self.rest[s+'Foot']['q'],self.rest[s+'ToeBase']['q']]for s in ['Left','Right']};self.feet(goals,qs);errors=self.hands()
  elif t<2.6:self.turn(t-.8,side);errors=[0,0]
  else:
   w=min(4/3,t-2.6);self.native(w);nativeWorld={n:self.rig.matrix_world@b.matrix for n,b in self.rig.pose.bones.items()};nativeW=F@self.weapon.matrix_world;goals={s:F@self.p(s+'Foot')+offset[s]for s in ['Left','Right']};qs={s:[(F@nativeWorld[self.bones[s+'Foot']]).to_quaternion(),(F@nativeWorld[self.bones[s+'ToeBase']]).to_quaternion()]for s in ['Left','Right']}
   for b in sorted(self.rig.pose.bones,key=lambda b:len(b.parent_recursive)):b.matrix=self.rig.matrix_world.inverted()@F@nativeWorld[b.name];self.update()
   self.weapon.matrix_world=nativeW;self.update();blend=m.smooth(min(1,w/.22))
   if blend<1:
    current=self.snapshot();self.blend(turnEnd,current,blend)
    for s in ['Left','Right']:goals[s].z=endGoals[s].z+(goals[s].z-endGoals[s].z)*blend;qs[s]=[endQ[s][k].slerp(qs[s][k],blend)for k in range(2)]
   if t>2.6+4/3:
    stop=t-(2.6+4/3);q=m.smooth(min(1,stop/.4));forward=Vector((side,0,0));advance=1.05*(stop-stop*stop/.8);root=self.rig.pose.bones[self.bones['Hips']];M=root.matrix.copy();p=self.rig.matrix_world@M.translation;p+=forward*advance;M.translation=self.rig.matrix_world.inverted()@p;root.matrix=M;self.update();swing='Right';goals[swing]+=forward*(.36*q);goals[swing].z+=.06*math.sin(math.pi*min(1,stop/.4))**2
    for s in ['Left','Right']:goals[s].z=goals[s].z+(endGoals[s].z-goals[s].z)*q;qs[s]=[qs[s][k].slerp(Quaternion((0,0,1),yaw)@self.rest[s+('Foot'if k==0 else'ToeBase')]['q'],q)for k in range(2)]
   self.feet(goals,qs,yaw);center=(self.p('LeftArm')+self.p('RightArm'))/2;desiredQ=Quaternion((0,0,1),yaw)@m.rot(28,0,10);desiredP=center+Quaternion((0,0,1),yaw)@Vector((-.13,-.11,-.13));u=m.smooth(min(1,max(0,(t-(2.6+4/3))/.4)));Q=self.weapon.matrix_world.to_quaternion().slerp(desiredQ,u);P=self.weapon.matrix_world.translation.lerp(desiredP,u);errors=self.hands(Q,P)
  return {'time':t,'phase':'exit','feet':{s:list(self.skinpoint(s))for s in ['Left','Right']},'wrists':{s:list(self.p(s+'Hand'))for s in ['Left','Right']},'wristErrorsM':errors,'bootMinZ':[self.bootmin(s)for s in ['Left','Right']],'hips':list(self.p('Hips'))}
