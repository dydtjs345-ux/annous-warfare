"""Derived cover poses from preserved project rifle aim; no claim of untouched mocap."""
import bpy,json,math,os,re,sys
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion,Euler
ROOT=Path(__file__).resolve().parents[1]
def smooth(v):v=max(0,min(1,v));return v*v*v*(10+v*(-15+6*v))
def rot(x=0,y=0,z=0):return Euler(tuple(math.radians(v)for v in (x,y,z)),'XYZ').to_quaternion()
def worldpoint(r,n):return r.matrix_world@r.pose.bones[n].head
def worldq(r,n):return(r.matrix_world@r.pose.bones[n].matrix).to_quaternion().normalized()
class CoverRig:
 def __init__(self,kind='M16A4',keep_approved=False):
  self.kind=kind;self.ref=json.loads((ROOT/'validation/project-rifle-source.json').read_text())['factions'][kind]
  bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT.parent/'phase2-crouch/models/TacticalSuit_Phase2.glb'))
  self.objects=set(bpy.data.objects);self.rig=next(o for o in self.objects if o.type=='ARMATURE');self.rig.name='TacticalSuitRig';self.weapon=bpy.data.objects['Weapon'];self.mag=bpy.data.objects['Magazine']
  self.approved={};self.approvedFPS=bpy.context.scene.render.fps
  for o in self.objects:
   if o.animation_data:
    o.animation_data.action=None
    for tr in list(o.animation_data.nla_tracks):
     if keep_approved:
      for st in tr.strips:self.approved.setdefault(tr.name,[]).append(('rig'if o.type=='ARMATURE'else o.name,st.action))
     o.animation_data.nla_tracks.remove(tr)
  if not keep_approved:
   for a in list(bpy.data.actions):bpy.data.actions.remove(a)
  for b in self.rig.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
  bpy.context.view_layer.update()
  if kind=='AK74M':
   old=[self.weapon,self.mag]
   for o in old:o.name='Discard_'+o.name
   with bpy.data.libraries.load(str(ROOT/'source/AK74M_AimReference.blend'),link=False)as(f,t):t.objects=['Weapon','Magazine']
   for o in t.objects:
    if o.name not in bpy.context.scene.objects:bpy.context.scene.collection.objects.link(o)
   self.weapon,self.mag=t.objects;self.objects.update(t.objects)
   for o in old:self.objects.discard(o);bpy.data.objects.remove(o,do_unlink=True)
  self.weapon.parent=None;self.weapon.matrix_world=Matrix.Identity(4);self.weapon.animation_data_clear();self.mag.animation_data_clear()
  self.bones={}
  for b in self.rig.pose.bones:
   key=b.name.split(':')[-1];key=re.sub(r'_\d+$','',key);self.bones[key]=b.name
  self.rest={k:{'p':worldpoint(self.rig,n),'q':worldq(self.rig,n)}for k,n in self.bones.items()}
  self.meshes=[o for o in self.objects if o.type=='MESH'and o.vertex_groups]
  self.boots={s:[]for s in ['Left','Right']};self.landmarks={}
  for o in self.meshes:
   coords=[o.matrix_world@v.co for v in o.data.vertices]
   if max(v.z for v in coords)>.32:continue
   for side in ['Left','Right']:
    vs=[(i,p)for i,p in enumerate(coords)if(p.x>0 if side=='Left'else p.x<0)];self.boots[side]+=[(o,i)for i,p in vs]
  for side,vs in self.boots.items():
   low=min((o.matrix_world@o.data.vertices[i].co).z for o,i in vs);front=min((o.matrix_world@o.data.vertices[i].co).y for o,i in vs if(o.matrix_world@o.data.vertices[i].co).z<low+.003)
   self.landmarks[side]=min([(o,i)for o,i in vs if(o.matrix_world@o.data.vertices[i].co).z<low+.003 and(o.matrix_world@o.data.vertices[i].co).y<front+.015],key=lambda v:abs((v[0].matrix_world@v[0].data.vertices[v[1]].co).x-self.rest[side+'ToeBase']['p'].x))
  self.sourcePath=ROOT.parent/'tactical-combat/source'/('USMC_Tactical.blend'if kind=='M16A4'else'Russian_Tactical.blend')
  with bpy.data.libraries.load(str(self.sourcePath),link=False)as(f,t):t.objects=['InfantryRig'];t.actions=['Lower_AimStance','FB_AimIdle_Upper','FB_Recoil_Shot','Turn_Left','Turn_Right','Upper_Turn_Left','Upper_Turn_Right']
  self.src=t.objects[0];bpy.context.scene.collection.objects.link(self.src);self.src.hide_render=True;self.actions={a.name:a for a in t.actions}
  for b in self.src.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
  if self.src.animation_data:
   self.src.animation_data.action=None
   for tr in self.src.animation_data.nla_tracks:tr.mute=True
  self.mapping={'Hips':'root','Spine':'spine05','Spine1':'spine03','Spine2':'spine02','Neck':'neck01','Head':'head'}
  for side,s in [('Left','L'),('Right','R')]:
   self.mapping.update({side+key:value+'.'+s for key,value in [('Shoulder','clavicle'),('Arm','upperarm01'),('ForeArm','lowerarm01'),('Hand','wrist'),('UpLeg','upperleg01'),('Leg','lowerleg01'),('Foot','foot'),('ToeBase','toe1-1')]})
  self.sourceRest={k:{'p':self.src.matrix_world@self.src.data.bones[n].head_local,'q':(self.src.matrix_world@self.src.data.bones[n].matrix_local).to_quaternion().normalized()}for k,n in self.mapping.items()}
  def frame(y,z):
   y=y.normalized();z=(z-y*y.dot(z)).normalized();return Matrix((y.cross(z),y,z)).transposed().to_quaternion()
  self.frame=frame;self.handCorrections={};self.fingerCorrections={}
  for side in ['Left','Right']:
   p=self.rest[side+'Hand']['p'];y=self.rest[side+'HandMiddle1']['p']-p;x=self.rest[side+'HandIndex1']['p']-self.rest[side+'HandPinky1']['p'];y.normalize();x=(x-y*y.dot(x)).normalized();H=Matrix((x,y,x.cross(y))).transposed().to_quaternion();self.handCorrections[side]=H.inverted()@self.rest[side+'Hand']['q'];normal=H@Vector((0,0,1))
   for digit in ['Thumb','Index','Middle','Ring','Pinky']:
    for j in range(1,4):
     key=f'{side}Hand{digit}{j}';n=self.bones[key];direction=self.rest.get(f'{side}Hand{digit}{j+1}',{}).get('p',self.rig.matrix_world@self.rig.data.bones[n].tail_local)-self.rest[key]['p'];self.fingerCorrections[key]=frame(direction,normal).inverted()@self.rest[key]['q']
  self.sourcePose(0);self.recoilTracks={}
  for fc in self.actions['FB_Recoil_Shot'].fcurves:self.recoilTracks.setdefault(fc.data_path,[]).append(fc)
  self.recoilReference={path:list(self.src.path_resolve(path))for path in self.recoilTracks}
  self.aimBase={k:worldq(self.src,n)for k,n in self.mapping.items()};self.baseHeight=self.rest['Hips']['p'].z
 def update(self):bpy.context.view_layer.update()
 def p(self,key):return worldpoint(self.rig,self.bones[key])
 def q(self,key):return worldq(self.rig,self.bones[key])
 def orient(self,key,q):
  b=self.rig.pose.bones[self.bones[key]];p=b.head.copy();b.matrix=Matrix.Translation(p)@(self.rig.matrix_world.to_quaternion().inverted()@q).to_matrix().to_4x4();self.update()
 def sourcePose(self,t,shot=None):
  for b in self.src.pose.bones:b.matrix_basis=Matrix.Identity(4)
  for a in [self.actions['Lower_AimStance'],self.actions['FB_AimIdle_Upper']]:
   for fc in a.fcurves:
    try:self.src.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*30)
    except(ValueError,AttributeError,IndexError):pass
  if shot is not None and hasattr(self,'recoilTracks'):
   for path,curves in self.recoilTracks.items():
    base=self.recoilReference[path];values=base.copy();target=self.src.path_resolve(path)
    for fc in curves:values[fc.array_index]=fc.evaluate(shot*30)
    if path.endswith('rotation_quaternion'):
     q=Quaternion(target)@Quaternion(base).inverted()@Quaternion(values)
     for i,v in enumerate(q):target[i]=v
    else:
     for i,v in enumerate(values):target[i]+=v-base[i]
  self.update()
 def solve(self,a,b,c,goal,pole):
  A=self.p(a);l1=(self.rest[b]['p']-self.rest[a]['p']).length;l2=(self.rest[c]['p']-self.rest[b]['p']).length;v=goal-A;L=v.length;u=v.normalized();safe=max(abs(l1-l2)+1e-5,min(L,l1+l2-1e-5));along=(l1*l1-l2*l2+safe*safe)/(2*safe);p=pole-A;p=(p-u*p.dot(u)).normalized();height=math.sqrt(max(0,l1*l1-along*along))
  if 'UpLeg'in a and A.z+u.z*along+p.z*height<.15:
   up=Vector((0,0,1));up=(up-u*up.dot(u)).normalized();side=u.cross(up).normalized();tilt=max(-1,min(1,(.15-A.z-u.z*along)/max(1e-8,height*up.z)));sign=1 if p.dot(side)>=0 else-1;p=up*tilt+side*sign*math.sqrt(max(0,1-tilt*tilt))
  B=A+u*along+p*height
  for start,end,target in [(a,b,B),(b,c,A+u*safe)]:self.orient(start,(self.p(end)-self.p(start)).normalized().rotation_difference((target-self.p(start)).normalized())@self.q(start))
  return max(0,L-l1-l2,abs(l1-l2)-L),(self.p(c)-goal).length
 def skinpoint(self,side):
  o,i=self.landmarks[side];e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();p=e.matrix_world@m.vertices[i].co;e.to_mesh_clear();return p
 def bootmin(self,side):
  dg=bpy.context.evaluated_depsgraph_get();objects={}
  for o,i in self.boots[side]:objects.setdefault(o,[]).append(i)
  low=1e6
  for o,ids in objects.items():
   e=o.evaluated_get(dg);m=e.to_mesh();low=min(low,min((e.matrix_world@m.vertices[i].co).z for i in ids));e.to_mesh_clear()
  return low
 def pose(self,amount=1,side=1,stance='Stand',style='Corner',t=0,fire=False):
  shotAge=(t-.14)%.4 if fire else None
  if shotAge is not None and shotAge>.2:shotAge=None
  self.sourcePose(t%2.4,shotAge)
  for b in self.rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
  self.update()
  for key,sn in self.mapping.items():self.orient(key,worldq(self.src,sn)@self.sourceRest[key]['q'].inverted()@self.rest[key]['q'])
  u=max(0,min(1,amount));v=smooth((u-.65)/.35);crouch=stance=='Crouch';low=style in ['Low','BlindOver'];blind=style.startswith('Blind');coverH=.90 if crouch else 1.14
  # Balance comes from deliberate pelvis shift, distributed lumbar/thoracic lean and yaw.
  shift=side*(.065 if style=='BlindCorner'else .12)*u if style in ['Corner','BlindCorner']else 0
  lean=side*19*u if style=='Corner'else side*4*u if style=='BlindCorner'else 0
  yaw=(side*26*u if style=='Corner'else side*35*u if style=='BlindCorner'else 0)
  bodyU=smooth(min(1,u/.65))if style=='Low'else u
  if low:
   hip=(.255 if crouch else .43)+((.045 if crouch else .10)if blind else(.315 if crouch else .43))*bodyU;pitch=((48+12*u)if crouch else(32+28*u))if blind else(48 if crouch else 32)*(1-bodyU)
  else:hip=.57 if crouch else .83;pitch=12 if crouch else 4
  self.orient('Hips',rot(pitch*.30,lean*.30,yaw*.30)@self.q('Hips'));b=self.rig.pose.bones[self.bones['Hips']];M=b.matrix.copy();M.translation=self.rig.matrix_world.inverted()@Vector((shift,.03,hip));b.matrix=M;self.update()
  for key,w in [('Spine',.22),('Spine1',.25),('Spine2',.23)]:self.orient(key,rot(pitch*w,lean*w,yaw*w)@self.q(key))
  # Explicit shoulder participation follows chest; source clavicle micro-motion is retained.
  for key,sgn in [('LeftShoulder',1),('RightShoulder',-1)]:self.orient(key,rot(-2*u if sgn==side else 1*u,0,sgn*2*u)@self.q(key))
  targets={}
  for s,sgn in [('Left',1),('Right',-1)]:targets[s]=self.rest[s+'Foot']['p']+Vector((sgn*.045,-.09 if s=='Left'else .07,0))
  for _ in range(3):
   for s in ['Left','Right']:
    self.solve(s+'UpLeg',s+'Leg',s+'Foot',targets[s],Vector((targets[s].x,-1,.35)));self.orient(s+'Foot',self.rest[s+'Foot']['q']);self.orient(s+'ToeBase',self.rest[s+'ToeBase']['q']);targets[s].z-=self.bootmin(s)-.001
  # Aimed eye line and weapon are coupled; blind fire deliberately keeps the head behind cover.
  aimYaw=side*(24 if side>0 else 10)*u if style=='Corner'else 0
  headLean=lean*.75;headTarget=rot(0,headLean,aimYaw)@self.rest['Head']['q'];self.orient('Head',headTarget)
  headDelta=headTarget@self.rest['Head']['q'].inverted();eye=self.p('Head')+headDelta@Vector((-.030,-.080,.075));Q=rot(0,headLean,aimYaw);sight=Vector((0,.13 if self.kind=='M16A4'else .09,.195 if self.kind=='M16A4'else .125));forward=Q@Vector((0,-1,0));aimP=eye+forward*.075-Q@sight
  center=(self.p('LeftArm')+self.p('RightArm'))/2
  readyQ=rot(28,lean*.5,10+aimYaw);readyP=center+Vector((-.13,-.11,-.13));readyP.z=max(readyP.z,.35)
  if blind:
   self.orient('Head',rot(18*u,0,0)@self.rest['Head']['q']);Q=rot(-5,side*8 if style=='BlindCorner'else 20,side*55 if style=='BlindCorner'else 0)
   exposed=Vector((side*.25,center.y-.15,center.z+.08))if style=='BlindCorner'else Vector((-.035,center.y+.10,coverH+.035));P=readyP.lerp(exposed,v);Q=readyQ.slerp(Q,v)
  else:
   P=readyP.lerp(aimP,smooth((v-.65)/.35));P.z=readyP.z+(aimP.z-readyP.z)*v;Q=readyQ.slerp(Q,v)
  # Reuse actual project FB_Recoil_Shot data, with a controlled two-hand rifle constraint.
  if shotAge is not None:
   rows=self.ref['recoil'];f=min(len(rows)-1,shotAge*60);a=int(f);b=min(len(rows)-1,a+1);mix=f-a;D=Vector(rows[a]['translation']).lerp(Vector(rows[b]['translation']),mix);DQ=Quaternion(rows[a]['quaternion']).slerp(Quaternion(rows[b]['quaternion']),mix);P+=Q@D;Q=Q@DQ
  initialP=P.copy()
  # Project only infeasible wrist targets into both real arm reach intervals.
  # Translation fitting never stretches limbs; endpoint aiming poses already fit.
  for _ in range(12):
   changed=False
   for s,label in [('Left','L'),('Right','R')]:
    goal=P+Q@Vector(self.ref['hands'][label]['wrist']);v=goal-self.p(s+'Arm');d=v.length;l1=(self.rest[s+'ForeArm']['p']-self.rest[s+'Arm']['p']).length;l2=(self.rest[s+'Hand']['p']-self.rest[s+'ForeArm']['p']).length;target=max(abs(l1-l2)+.001,min(d,l1+l2-.001))
    if abs(target-d)>1e-7:P+=v.normalized()*(target-d);changed=True
   if not changed:break
  self.weapon.matrix_world=Matrix.Translation(P)@Q.to_matrix().to_4x4();self.update();errors=[];reach=[]
  for s,label,sgn in [('Left','L',1),('Right','R',-1)]:
   d=self.ref['hands'][label];goal=self.weapon.matrix_world@Vector(d['wrist']);pole=center+rot(0,0,yaw)@Vector((sgn*.40,.04,-.30));r,e=self.solve(s+'Arm',s+'ForeArm',s+'Hand',goal,pole);reach.append(r);errors.append(e);H=Q@Quaternion(d['handFrame']);self.orient(s+'Hand',H@self.handCorrections[s]);normal=H@Vector((0,0,1))
   for di,digit in enumerate(['Thumb','Index','Middle','Ring','Pinky'],1):
    for ph in range(1,4):key=f'{s}Hand{digit}{ph}';self.orient(key,self.frame(Q@Vector(d['fingerDirections'][f'{di}-{ph}']),normal)@self.fingerCorrections[key])
  self.update();return {'armFitCorrectionM':(P-initialP).length,'amount':u,'hips':list(self.p('Hips')),'eye':list(eye),'weaponP':list(P),'wristErrorsM':errors,'armReachExcessM':reach,'bootMinZ':[self.bootmin(s)for s in ['Left','Right']],'headJointZ':self.p('Head').z,'armsMarginM':[((self.rest[s+'ForeArm']['p']-self.rest[s+'Arm']['p']).length+(self.rest[s+'Hand']['p']-self.rest[s+'ForeArm']['p']).length-(self.weapon.matrix_world@Vector(self.ref['hands'][label]['wrist'])-self.p(s+'Arm')).length)for s,label in [('Left','L'),('Right','R')]],'coverH':coverH}
if __name__=='__main__':
 r=CoverRig(os.environ.get('CV_WEAPON','M16A4'));rows=[]
 for stance in ['Stand','Crouch']:
  for style in ['Corner','Low','BlindCorner','BlindOver']:
   for side in([1,-1]if style in ['Corner','BlindCorner']else[1]):
    for u in [0,.5,1]:
     row=r.pose(u,side,stance,style);row.update(stance=stance,style=style,side=side);rows.append(row);print('POSE',row,flush=True)
 (ROOT/'validation/draft-poses.json').write_text(json.dumps(rows,indent=2)+'\n')
