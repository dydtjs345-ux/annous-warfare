"""Offline keyframe authoring: contact paths -> IK -> real reusable Blender Actions.
No runtime procedural joint rotations. Units metres, forward -Y, 30fps.
"""
import bpy,math,json,sys,os,bmesh
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[1];FPS=30
sys.path.insert(0,str(ROOT.parent/'russian-infantry/tools'));sys.path.insert(0,str(ROOT/'tools'))
from finish_infantry import select
TAU=2*math.pi

def smooth(x):return max(0,min(1,x))**2*(3-2*max(0,min(1,x)))
def mix(a,b,t):return a*(1-t)+b*t

def split_m16_mag(weapon):
 part=weapon.copy();part.data=weapon.data.copy();bpy.context.collection.objects.link(part);part.name='M16A4_Magazine'
 adj=[set()for v in weapon.data.vertices]
 for e in weapon.data.edges:
  a,b=e.vertices;adj[a].add(b);adj[b].add(a)
 seen=set();ids=set()
 for i in range(len(adj)):
  if i in seen:continue
  todo=[i];seen.add(i);component=[]
  while todo:
   k=todo.pop();component.append(k)
   for j in adj[k]:
    if j not in seen:seen.add(j);todo.append(j)
  points=[weapon.data.vertices[k].co for k in component]
  if all(abs(v.x)<.018 and -.178<v.y<-.063 and -.175<v.z<.044 for v in points):ids.update(component)
 assert len(ids)>10,('M16 magazine selection',len(ids))
 for ob,keep in [(part,True),(weapon,False)]:
  bm=bmesh.new();bm.from_mesh(ob.data);bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[v for v in bm.verts if (v.index in ids)!=keep],context='VERTS');bm.to_mesh(ob.data);bm.free()
 part.parent=weapon;part.matrix_basis=Matrix.Identity(4)
 return part

class Author:
 def __init__(self,faction):
  self.faction=faction;self.russian=faction=='Russian'
  prefix='russian-infantry'if self.russian else'usmc-rifleman';stem='Russian_Infantry'if self.russian else'USMC_Rifleman'
  bpy.ops.wm.open_mainfile(filepath=str(ROOT.parent/prefix/'source'/f'{stem}.blend'))
  self.rig=bpy.data.objects[stem+'_Rig'];self.char=bpy.data.objects[stem+'_Character'];self.weapon=bpy.data.objects['AK74M_Separate_Weapon'if self.russian else'M16A4_Separate_Weapon']
  self.mag=bpy.data.objects['AK74M_Magazine']if self.russian else split_m16_mag(self.weapon)
  self.weapon.parent=None;self.weapon.matrix_world=Matrix.Identity(4);self.mag.matrix_basis=Matrix.Identity(4)
  self.rig.name='InfantryRig';self.char.name=faction+'_Character';self.weapon.name='Weapon';self.mag.name='Magazine'
  from skin_weights import repair_garment
  self.skin_repair=repair_garment(self.char)
  self.rig.animation_data_clear();self.weapon.animation_data_clear();self.mag.animation_data_clear()
  self.rest={b.name:b.matrix_local.copy()for b in self.rig.data.bones};self.actions={};self.meta={};self.errors=[]
  self.lower=[n for n in self.rest if n.startswith(('root','pelvis','upperleg','lowerleg','foot','toe'))]
  self.upper=[n for n in self.rest if n not in self.lower and not n.startswith(('breast','jaw','special','oris','tongue','levator','eye','orbicularis','temporalis','oculi','risorius'))]
  # Include every upper-body deform bone in a common reference pose; facial bones inherit.
  self.gripR=Vector((-.025,.061,-.028)if self.russian else(-.029,.048,-.036))
  self.gripL=Vector((.005,-.195,.037)if self.russian else(.005,-.155,.055))
  self.stock=Vector((0,.346,.03)if self.russian else(0,.338,.063))
  self.bones=self.rig.pose.bones;self.reset()
  self.boots={}
  for side in ['L','R']:
   g=self.char.vertex_groups['foot.'+side].index
   self.boots[side]=[v.co.copy()-self.rig.data.bones['foot.'+side].head_local for v in self.char.data.vertices if v.co.z<.25 and any(x.group==g and x.weight>.99 for x in v.groups)]
   assert self.boots[side]
  self.weapon_mount=None
 def update(self):bpy.context.view_layer.update()
 def reset(self):
  for p in self.rig.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
  self.update()
 def rigid(self,name,rotation,origin,target):
  self.bones[name].matrix=Matrix.Translation(target)@rotation.to_4x4()@Matrix.Translation(-origin)@self.rest[name];self.update()
 def rot(self,name,xyz):
  # World-space rotation around the bone's current head, preserving inherited pose.
  from mathutils import Euler
  p=self.bones[name];R=Euler(xyz,'XYZ').to_matrix();p.matrix=Matrix.Translation(p.head)@R.to_4x4()@Matrix.Translation(-p.head)@p.matrix;self.update()
 def support_point(self,side,R):
  minimum=min((R@p).z for p in self.boots[side]);candidates=[p for p in self.boots[side]if (R@p).z<minimum+1e-7]
  return min(candidates,key=lambda p:p.y)if math.atan2(R[2][1],R[1][1])>=0 else max(candidates,key=lambda p:p.y)
 def chain(self,side,goal,footR=None,free=False,control=False,facing=0):
  hipname='upperleg01.'+side;kneename='lowerleg01.'+side;endname='foot.'+side
  hip=self.bones[hipname].head.copy();h0=self.rig.data.bones[hipname].head_local;k0=self.rig.data.bones[kneename].head_local;e0=self.rig.data.bones[endname].head_local
  l1=(k0-h0).length;l2=(e0-k0).length;wanted=math.atan2(footR[2][1],footR[1][1]) if footR else 0
  support=self.support_point(side,footR)if control else None;baseY=goal.y-support.y+(footR@support).y if control else goal.y
  for iteration in range(10):
   v=goal-hip;d=v.length;assert d<l1+l2-.0002,('Leg unreachable',self.faction,side,d,l1+l2)
   axis=v.normalized();a=(l1*l1-l2*l2+d*d)/(2*d);h=math.sqrt(max(0,l1*l1-a*a));basis=Matrix.Rotation(facing,3,'Z');pole=basis@Vector((0,-1,0));pole=(pole-axis*pole.dot(axis)).normalized();knee=hip+axis*a+pole*h
   q1=basis@(k0-h0).rotation_difference(basis.transposed()@(knee-hip)).to_matrix();q2=basis@(e0-k0).rotation_difference(basis.transposed()@(goal-knee)).to_matrix()
   if control:
    shin=math.atan2(q2[2][1],q2[1][1]);relative=max(math.radians(-26),min(math.radians(37),wanted-shin));candidate=Matrix.Rotation(shin+relative,3,'X');floor=.003-min((candidate@p).z for p in self.boots[side]);changed=False
    if not free:
     contact=self.support_point(side,candidate);y=baseY+contact.y-(candidate@contact).y
     if abs(goal.z-floor)>1e-7 or abs(goal.y-y)>1e-7:goal.z=floor;goal.y=y;changed=True
    elif goal.z<floor-1e-7:goal.z=floor;changed=True
    footR=candidate
    if changed and iteration<9:continue
   break
  self.rigid(hipname,q1,h0,hip);self.rigid(kneename,q2,k0,knee);self.rigid(endname,footR or Matrix.Identity(3),e0,goal)
 def lower_pose(self,kind,t,duration):
  phase=(t/duration)%1 if kind not in ['Idle','AimStance']else(t/2.4)%1
  if kind in ['Idle','AimStance']:
   rootz=-.045;rootx=.003*math.sin(TAU*phase);lean=.02;roll=.003*math.sin(TAU*phase);yaw=0
  else:
   cfg=GAITS[kind];rootz=cfg['crouch']+cfg['bob']*math.cos(4*math.pi*phase);rootx=cfg['sway']*math.sin(TAU*phase);lean=cfg['lean'];roll=cfg['roll']*math.sin(TAU*phase);yaw=cfg['yaw']*math.sin(TAU*phase)
  from mathutils import Euler
  root=self.rig.data.bones['root'].head_local;rot=Euler((lean,roll,yaw),'XYZ').to_matrix()
  self.rigid('root',rot,root,root+Vector((rootx,0,rootz)))
  self.plants={}
  for i,side in enumerate(['L','R']):
   if kind in ['Idle','AimStance']:
    u=0;pitch=0;dy=(-.055 if side=='L'else .055)if kind=='AimStance'else 0;lift=0;stance=True
   else:
    u=(phase+i*.5)%1;cfg=GAITS[kind];duty=cfg['duty'];travel=cfg['speed']*duration*duty;front=-travel/2;rear=travel/2;stance=u<=duty
    if stance:
     dy=front+cfg['speed']*duration*u;lift=0
     heel=1-smooth(u/min(.12,duty*.2));toe=smooth((u-(duty-.12))/.12);pitch=math.radians(-10*heel+20*toe)
     if kind=='AimWalk':pitch*=.55
    else:
     s=(u-duty)/(1-duty);m=cfg['speed']*duration*(1-duty);dy=(2*s**3-3*s*s+1)*rear+(s**3-2*s*s+s)*m+(-2*s**3+3*s*s)*front+(s**3-s*s)*m
     lift=cfg['lift']*math.sin(math.pi*s)**1.35;pitch=math.radians(20*(1-s)-10*s)
   R=Matrix.Rotation(pitch,3,'X');restankle=self.rig.data.bones['foot.'+side].head_local
   low=min((R@v).z for v in self.boots[side]);z=.003-low+lift
   x=(1 if side=='L'else-1)*(.13 if kind!='Sprint'else .115)
   # Heel/toe roll about a contact pivot, rather than sliding the ankle.
   pivot=self.support_point(side,R);y=restankle.y+dy+pivot.y-(R@pivot).y
   goal=Vector((x,y,z));self.chain(side,goal,R,free=not stance,control=True);self.plants[side]={'stance':stance,'phase':u,'ankle':list(goal),'pitch':pitch}
 def hand_frame(self,side):
  w=self.rig.data.bones['wrist.'+side].head_local;mcp=[self.rig.data.bones[f'finger{i}-1.{side}'].head_local for i in range(2,6)]
  f=(sum(mcp,Vector())/4-w).normalized();thumb=mcp[0]-mcp[-1];thumb=(thumb-f*thumb.dot(f)).normalized()
  return w,w+(sum(mcp,Vector())/4-w)*.58,Matrix((thumb,f,thumb.cross(f))).transposed()
 def arm(self,side,palm,Rw,forward,normal,hint,grip=True,aim=0):
  wrist,anchor,frame=self.hand_frame(side);f=(Rw@Vector(forward)).normalized();n=(Rw@Vector(normal)).normalized();n=(n-f*n.dot(f)).normalized();thumb=f.cross(n)if side=='R'else n.cross(f)
  desired=Matrix((thumb,f,thumb.cross(f))).transposed();rot=desired@frame.transposed();goal=palm-rot@(anchor-wrist)
  shoulder=self.bones['upperarm01.'+side].head.copy();s0=self.rig.data.bones['upperarm01.'+side].head_local;e0=self.rig.data.bones['lowerarm01.'+side].head_local
  lu=(e0-s0).length;lf=(wrist-e0).length;v=goal-shoulder;d=v.length
  assert abs(lu-lf)+.001<d<lu+lf-.0003,('Arm unreachable',self.faction,side,d,lu+lf,list(palm))
  axis=v.normalized();a=(lu*lu-lf*lf+d*d)/(2*d);h=math.sqrt(max(0,lu*lu-a*a));pole=Vector(hint)-(shoulder+axis*a);pole=(pole-axis*pole.dot(axis)).normalized();elbow=shoulder+axis*a+pole*h
  self.rigid('upperarm01.'+side,(e0-s0).rotation_difference(elbow-shoulder).to_matrix(),s0,shoulder)
  self.rigid('lowerarm01.'+side,(wrist-e0).rotation_difference(goal-elbow).to_matrix(),e0,elbow);self.rigid('wrist.'+side,rot,wrist,goal)
  axisrest=frame.col[1].cross(frame.col[2]if side=='R'else-frame.col[2]).normalized()
  for digit in range(1,6):
   angles=(.24,.38,.4)if digit==1 else((mix(.12,.55,aim),mix(.22,.7,aim),mix(.12,.35,aim))if side=='R'and digit==2 else(.85,1.12,.6)if side=='R'else(.75,1.0,.6))
   if not grip:angles=(.12,.15,.08)
   for segment,angle in enumerate(angles,1):
    name=f'finger{digit}-{segment}.{side}';self.bones[name].rotation_quaternion=Quaternion(self.rest[name].to_3x3().inverted()@axisrest,angle)
  self.update();error=(self.bones['wrist.'+side].head-goal).length;self.errors.append(error)
 def upper_pose(self,aim,t=0,recoil=0,sprint=0,left_target=None,left_grip=True):
  breathe=math.sin(TAU*t/2.4)
  self.rot('spine04',(math.radians(1.5)*aim,0,0));self.rot('spine03',(0,0,math.radians(-8)*aim));self.rot('spine02',(math.radians(-.3)*breathe+math.radians(.5)*recoil,0,math.radians(-7)*aim))
  self.rot('neck01',(math.radians(9)*aim,math.radians(-9)*aim,math.radians(15)*aim));self.rot('head',(math.radians(7)*aim,math.radians(-4)*aim,math.radians(9)*aim))
  loR=Matrix.Rotation(math.radians(25),3,'Z')@Matrix.Rotation(math.radians(30),3,'X')
  aimR=Matrix.Rotation(math.radians(10),3,'Z')@Matrix.Rotation(math.radians(-1+1.6*recoil),3,'X')
  R=loR.to_quaternion().slerp(aimR.to_quaternion(),aim).to_matrix()
  low=Vector((-.11,-.29,1.21));butt=self.bones['upperarm01.R'].head+Vector((.025,-.070,.045));high=butt-aimR@self.stock
  pos=low.lerp(high,aim)+Vector((0,.009*recoil,.0015*breathe))
  if sprint:pos+=Vector((0,.028*sprint,.045*sprint));R=R@Matrix.Rotation(math.radians(12*sprint),3,'X')
  self.W=Matrix.Translation(pos)@R.to_4x4()
  self.arm('R',self.W@self.gripR,R,(0,-.8,.2),(1,0,0),(-.38,.04,1.12),aim=aim)
  lp=self.gripL.copy();lp.y=mix(lp.y,-.148 if self.russian else-.12,aim);lp.z=mix(lp.z,.043 if self.russian else.055,aim)
  f=Vector((-1,-.10,0)).lerp(Vector((-.6,-.8,0)),aim)
  self.arm('L',left_target if left_target is not None else self.W@lp,R,f,(0,0,1),(.36,-.20,1.13),grip=left_grip,aim=aim)
  # Weapon stays bone-parented; this invariant is also checked during authoring.
  if self.weapon_mount is None:self.weapon.matrix_world=self.W
  else:self.update()
 def mount_weapon(self):
  self.reset();self.upper_pose(0)
  self.weapon.parent=self.rig;self.weapon.parent_type='BONE';self.weapon.parent_bone='wrist.R';self.weapon.matrix_world=self.W;self.update()
  self.weapon_mount=self.weapon.matrix_basis.copy()
  self.mag.matrix_basis=Matrix.Identity(4)
 def begin(self,name):
  self.rig.animation_data_create();a=bpy.data.actions.new(name);a.use_fake_user=True;self.rig.animation_data.action=a
  return a
 def key(self,names,frame):
  for name in names:
   p=self.bones[name];q=p.rotation_quaternion
   if hasattr(self,'previous')and name in self.previous and q.dot(self.previous[name])<0:p.rotation_quaternion=-q
   self.previous[name]=p.rotation_quaternion.copy()
   p.keyframe_insert('location',frame=frame,group=name);p.keyframe_insert('rotation_quaternion',frame=frame,group=name)
 def finish_action(self,a,name,duration,layer,loop,extra=None):
  for fc in a.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  self.rig.animation_data.action=None;self.actions[name]=a;self.meta[name]={'duration':duration,'layer':layer,'loop':loop,'bones':self.lower if layer=='lower'else self.upper,**(extra or{})}
 def make_lower(self,name,kind,duration,loop=True,transition=None):
  if transition:
   from contact_transitions import author_contact_transition
   return author_contact_transition(self,name,*transition,duration)
  a=self.begin(name);self.previous={};samples=[]
  for i in range(round(duration*FPS)+1):
   t=i/FPS;self.reset()
   if transition:
    before,after=transition;u=smooth(t/duration)
    self.lower_pose(before,t,GAITS.get(before,{}).get('period',2.4));A={n:self.bones[n].matrix_basis.copy()for n in self.lower}
    self.reset();self.lower_pose(after,t,GAITS.get(after,{}).get('period',2.4))
    for n in self.lower:
     p=self.bones[n];l1,q1,s1=A[n].decompose();l2,q2,s2=p.matrix_basis.decompose();p.location=l1.lerp(l2,u);p.rotation_quaternion=q1.slerp(q2,u)
    self.update()
   else:self.lower_pose(kind,t,duration)
   self.key(self.lower,i);samples.append({'t':t,'feet':self.plants})
  speed=GAITS.get(kind,{}).get('speed',0)if not transition else 0
  self.finish_action(a,name,duration,'lower',loop,{'speed_mps':speed,'plant_samples':samples})
 def make_upper(self,name,duration,mode,loop=False):
  a=self.begin(name);self.previous={}
  for i in range(round(duration*FPS)+1):
   t=i/FPS;u=t/duration;self.reset()
   amount=0 if mode in ['low','sprint']else 1 if mode=='aim'else smooth(u)if mode=='raise'else 1-smooth(u)
   self.upper_pose(amount,t*2.4/duration if loop else 0,sprint=1 if mode=='sprint'else 0);self.key(self.upper,i)
  self.finish_action(a,name,duration,'upper',loop)
 def recoil(self):
  duration=.2;a=self.begin('Recoil_Shot');self.previous={}
  # An authored impulse and recovery. Reference pose is the first Aim frame.
  for i,value in enumerate([0,1,.42,.15,.04,0,0]):
   self.reset();self.upper_pose(1,0,recoil=value);self.key(self.upper,i)
  self.finish_action(a,'Recoil_Shot',duration,'recoil',False,{'reference':'Upper_Aim','kick_metres':.009,'kick_degrees':1.6,'additive_conversion':'subtract first Upper_Aim frame in preview AnimationUtils.makeClipAdditive'})
 def turn(self,name,sign):
  duration=.9;self.reset();self.lower_pose('Idle',0,2.4);idle_root=self.bones['root'].matrix.copy();idle_feet={side:self.bones['foot.'+side].matrix.copy()for side in ['L','R']}
  a=self.begin(name);self.previous={}
  for i in range(28):
   t=i/30;u=t/duration;self.reset();yaw=sign*math.radians(45)*smooth(u);Rbody=Matrix.Rotation(yaw,4,'Z');root_matrix=Rbody@idle_root;root_matrix.translation.z-=.02*math.sin(math.pi*u)**2;self.bones['root'].matrix=root_matrix;self.update()
   for side,start,end in [('L',.05,.48),('R',.48,.95)]:
    phase=max(0,min(1,(u-start)/(end-start)));s=smooth(phase);theta=sign*math.radians(45)*s;R=Matrix.Rotation(theta,3,'Z');goal=R@idle_feet[side].translation;goal.z+=.055*math.sin(math.pi*phase)
    footR=R@(idle_feet[side]@self.rest['foot.'+side].inverted()).to_3x3();self.chain(side,goal,footR,facing=yaw)
   self.key(self.lower,i)
  self.finish_action(a,name,duration,'lower',False,{'turn_radians':sign*math.pi/4,'entry_phase':0,'exit_phase':0,'orientation_commit':'rotate actor assembly by turn_radians and switch to Lower_Idle at the same instant'})
 def turn_upper(self,name,sign):
  duration=.9;a=self.begin(name);self.previous={}
  for i in range(28):
   t=i/30;u=t/duration;self.reset();self.upper_pose(0)
   self.rot('spine02',(0,0,sign*math.radians(5)*math.sin(math.pi*u)));self.rot('head',(0,0,sign*math.radians(8)*math.sin(math.pi*u)));self.key(self.upper,i)
  self.finish_action(a,name,duration,'upper',False)
 def make_reload(self):
  duration=3.8 if self.russian else 3.4;a=self.begin('Reload');self.previous={}
  spare=self.mag.copy();spare.data=self.mag.data;spare.name='SpareMagazine';bpy.context.collection.objects.link(spare);spare.animation_data_clear();spare.parent=self.weapon;spare.matrix_basis=Matrix.Diagonal((.001,.001,.001,1))
  self.mag.animation_data_create();spare.animation_data_create()
  old_action=bpy.data.actions.new('Reload_Magazine');new_action=bpy.data.actions.new('Reload_SpareMagazine');old_action.use_fake_user=True;new_action.use_fake_user=True;self.mag.animation_data.action=old_action;spare.animation_data.action=new_action
  contact=Vector((.024,-.12,-.075));pouch=Vector((.205,-.12,1.035));transfer={}
  for i in range(round(duration*FPS)+1):
   t=i/FPS;u=t/duration;self.reset()
   aim=1-.7*smooth(u/.14) if u<.18 else .3 if u<.88 else .3+.7*smooth((u-.88)/.12)
   self.upper_pose(aim,0);W=self.W.copy();R=W.to_3x3();seated=W.copy();pouchM=Matrix.Translation(pouch)@R.to_4x4()@Matrix.Translation(-contact)
   # Rock an AK magazine out of its front catch; the M16 magazine pulls straight.
   rock=math.radians(13)*smooth((u-.25)/.07)if self.russian else 0
   pulled=W@Matrix.Translation(Vector((0,.018 if self.russian else 0,-.12)))@Matrix.Rotation(rock,4,'X')
   if u<.25:old=seated
   elif u<.38:
    k=smooth((u-.25)/.13);old=Matrix.Translation(seated.translation.lerp(pulled.translation,k))@seated.to_quaternion().slerp(pulled.to_quaternion(),k).to_matrix().to_4x4()
   elif u<.48:
    k=smooth((u-.38)/.10);old=Matrix.Translation(pulled.translation.lerp(pouchM.translation,k))@pulled.to_quaternion().slerp(pouchM.to_quaternion(),k).to_matrix().to_4x4()
   else:old=pouchM
   under=W@Matrix.Translation(Vector((0,.012 if self.russian else 0,-.10)))@Matrix.Rotation(math.radians(10)if self.russian else 0,4,'X')
   if u<.57:new=pouchM
   elif u<.73:
    k=smooth((u-.57)/.16);new=Matrix.Translation(pouchM.translation.lerp(under.translation,k))@pouchM.to_quaternion().slerp(under.to_quaternion(),k).to_matrix().to_4x4()
   elif u<.84:
    k=smooth((u-.73)/.11);new=Matrix.Translation(under.translation.lerp(seated.translation,k))@under.to_quaternion().slerp(seated.to_quaternion(),k).to_matrix().to_4x4()
   else:new=seated
   if .14<u<.94:
    # Reach for the magazine, carry it to the pouch, then seat the fresh magazine.
    held=old if u<.53 else new;target=held@contact
    if u<.24:
     k=smooth((u-.14)/.10);lp=self.gripL.copy();lp.y=mix(lp.y,-.148 if self.russian else-.12,aim);lp.z=mix(lp.z,.043 if self.russian else.055,aim);target=(W@lp).lerp(target,k)
    elif u>.84:
     k=smooth((u-.84)/.10);lp=self.gripL.copy();lp.y=mix(lp.y,-.148 if self.russian else-.12,aim);lp.z=mix(lp.z,.043 if self.russian else.055,aim);target=target.lerp(W@lp,k)
    blend=smooth((u-.14)/.10)*(1-smooth((u-.84)/.10));f=Vector((-.8,-.3,0)).lerp(Vector((0,-.3,-1)),blend);n=Vector((0,0,1)).lerp(Vector((-1,0,0)),blend)
    self.arm('L',target,R,f,n,(.34,-.08,1.10),aim=aim)
   self.key(self.upper,i);self.update()
   for ob,M,show in [(self.mag,old,1 if u<.52 else .001),(spare,new,1 if u>=.52 else .001)]:
    ob.rotation_mode='QUATERNION';ob.matrix_basis=self.weapon.matrix_world.inverted()@M;ob.scale=(show,show,show)
    for prop in ['location','rotation_quaternion','scale']:ob.keyframe_insert(prop,frame=i,group=ob.name)
   transfer[str(i)]={'u':u,'old_visible':u<.52,'new_visible':u>=.52}
  for action in [old_action,new_action]:
   for fc in action.fcurves:
    for key in fc.keyframe_points:key.interpolation='CONSTANT'if fc.data_path=='scale'else'LINEAR'
  self.mag.animation_data.action=None;spare.animation_data.action=None;self.mag.matrix_basis=Matrix.Identity(4);spare.matrix_basis=Matrix.Diagonal((.001,.001,.001,1))
  self.finish_action(a,'Reload',duration,'upper',False,{'weapon':'AK-74M'if self.russian else'M16A4','object_actions':{'Magazine':old_action.name,'SpareMagazine':new_action.name},'magazine_exchange_hidden_at_pouch':.52,'mechanism':'front-catch rocking'if self.russian else'straight magwell insertion','duration_note':'tactical magazine exchange; internal bolt is not articulated'})
 def source_preview(self):
  # An inspectable Blender NLA demonstration with continuous locomotion and recoil.
  reference=bpy.data.actions['Upper_Aim'];kick=bpy.data.actions['Recoil_Shot'];add=bpy.data.actions.new('Recoil_Additive');add.use_fake_user=True
  for fc in kick.fcurves:
   ref=next(f for f in reference.fcurves if f.data_path==fc.data_path and f.array_index==fc.array_index)
   if fc.data_path.endswith('location'):
    out=add.fcurves.new(fc.data_path,index=fc.array_index,action_group=fc.group.name if fc.group else'Combat')
    for key in fc.keyframe_points:out.keyframe_points.insert(key.co.x,key.co.y-ref.evaluate(0)).interpolation='LINEAR'
  for name in self.upper:
   curves=[next(fc for fc in kick.fcurves if fc.data_path==f'pose.bones["{name}"].rotation_quaternion'and fc.array_index==k)for k in range(4)]
   refs=[next(fc for fc in reference.fcurves if fc.data_path==f'pose.bones["{name}"].rotation_quaternion'and fc.array_index==k)for k in range(4)]
   qref=Quaternion([fc.evaluate(0)for fc in refs]);qref.normalize()
   outs=[add.fcurves.new(f'pose.bones["{name}"].rotation_quaternion',index=k,action_group=name)for k in range(4)]
   for frame in range(7):
    q=Quaternion([fc.evaluate(frame)for fc in curves]);q.normalize();d=qref.inverted()@q
    for k in range(4):outs[k].keyframe_points.insert(frame,d[k]).interpolation='LINEAR'
  self.rig.animation_data.action=None
  for name,action,repeat,blend,scale in [('01 Locomotion',self.actions['Lower_AimWalk'],6,'REPLACE',1),('02 Aiming',self.actions['Upper_Aim'],3,'REPLACE',1),('03 Additive recoil',add,48,'COMBINE',.75)]:
   track=self.rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.repeat=repeat;strip.blend_type=blend;strip.scale=scale
  bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=216;bpy.context.scene.frame_set(20)
 def setup(self):
  self.mount_weapon();self.reset()
  self.char['rig_status']='Phase 1 authored animation skin; see deformation validation and limitations'
  self.weapon['architecture']='Independent replaceable weapon, bone-parented to wrist.R; detachable magazine'
  self.rig['shared_bones']=163
  bpy.context.scene.render.fps=FPS;bpy.context.scene.frame_start=0

GAITS={'Walk':{'period':1.2,'speed':1.05,'duty':.62,'lift':.10,'crouch':-.11,'bob':.008,'sway':.035,'lean':.035,'roll':.018,'yaw':.025},'Sprint':{'period':.8,'speed':3.0,'duty':.32,'lift':.22,'crouch':-.16,'bob':.035,'sway':.018,'lean':.14,'roll':.025,'yaw':.045},'AimWalk':{'period':1.2,'speed':.62,'duty':.70,'lift':.055,'crouch':-.085,'bob':.005,'sway':.026,'lean':.035,'roll':.009,'yaw':.009}}

if __name__=='__main__':
 faction=os.environ.get('AW_FACTION','Russian');a=Author(faction);a.setup()
 if os.environ.get('AW_GATE'):
  a.make_lower('Lower_Walk','Walk',1.2);a.make_lower('Lower_Sprint','Sprint',.8);a.make_lower('Lower_AimWalk','AimWalk',1.2)
  a.make_upper('Upper_LowReady',2.4,'low',True);a.make_upper('Upper_Aim',2.4,'aim',True);a.make_upper('Weapon_Raise',.8,'raise');a.recoil()
 else:
  a.make_lower('Lower_Idle','Idle',2.4);a.make_lower('Lower_AimStance','AimStance',2.4)
  for kind,cfg in GAITS.items():a.make_lower('Lower_'+kind,kind,cfg['period'])
  for name,before,after,duration in [('Start_Walk','Idle','Walk',.6),('Stop_Walk','Walk','Idle',.6),('Walk_To_Sprint','Walk','Sprint',.8),('Sprint_To_Walk','Sprint','Walk',.8),('Sprint_Stop','Sprint','Idle',.8)]:a.make_lower(name,after,duration,False,(before,after))
  a.turn('Turn_Left',1);a.turn('Turn_Right',-1);a.turn_upper('Upper_Turn_Left',1);a.turn_upper('Upper_Turn_Right',-1)
  for name,duration,mode,loop in [('Upper_LowReady',2.4,'low',True),('Upper_Sprint',.8,'sprint',True),('Weapon_Raise',.8,'raise',False),('Weapon_Lower',.8,'lower',False),('Upper_Aim',2.4,'aim',True)]:a.make_upper(name,duration,mode,loop)
  a.recoil();a.make_reload()
 a.reset();a.rig.animation_data.action=a.actions['Lower_AimWalk'];a.rig.animation_data.action=None
 # Actions are retained separately and layered in a source NLA demonstration.
 if not os.environ.get('AW_GATE'):a.source_preview()
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source'/f'{faction}_Animation.blend'))
 meta={'faction':faction,'fps':FPS,'actions':a.meta,'max_ik_wrist_error_m':max(a.errors),'skin_repair':a.skin_repair,'rest_bones':{b.name:{'parent':b.parent.name if b.parent else None,'matrix':[list(row)for row in b.matrix_local]}for b in a.rig.data.bones}}
 (ROOT/'validation'/f'{faction}-authoring.json').write_text(json.dumps(meta,indent=2)+'\n')
 print('AUTHORED_ACTIONS',faction,len(a.actions),flush=True)
