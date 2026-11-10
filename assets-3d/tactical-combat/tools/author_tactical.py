"""Contact-target tactical authoring on preserved shared infantry rigs.
Source is metres, Z-up, forward -Y. Output is keyed TRS, never runtime pose tricks.
"""
import bpy,sys,os,math,json,hashlib,struct,copy
from pathlib import Path
from mathutils import Vector,Matrix,Euler,Quaternion
ROOT=Path(__file__).resolve().parents[1]
CACHE=Path(os.environ.get('AW_SOURCE_CACHE',str(ROOT.parents[1]/'.cache/tactical-source/assets-3d')))
sys.path[:0]=[str(CACHE/'infantry-animation/tools')]
from author_motion import Author
from animation_io import pose,parse_glb,write_glb
FPS=30;TAU=math.tau

def smooth(x):x=max(0,min(1,x));return x*x*x*(10+x*(-15+6*x))
def lerp(a,b,u):return a+(b-a)*u
def ramp(t,a,b):return smooth((t-a)/(b-a))
def fingerprint(ac):return hashlib.sha256(json.dumps([(f.data_path,f.array_index,[(list(k.co),k.interpolation)for k in f.keyframe_points])for f in ac.fcurves],sort_keys=True).encode()).hexdigest()
def hermite(a,b,va,vb,t):return (2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*va+(-2*t**3+3*t*t)*b+(t**3-t*t)*vb

class Tactical:
 def __init__(self,faction):
  bpy.ops.wm.open_mainfile(filepath=str(CACHE/'sprint-rebuild/source'/f'{faction}_SprintReview.blend'))
  self.faction=faction;self.rig=bpy.data.objects['InfantryRig'];self.char=bpy.data.objects[faction+'_Character'];self.weapon=bpy.data.objects['Weapon'];self.mag=bpy.data.objects['Magazine'];self.spare=bpy.data.objects['SpareMagazine']
  for ob in [self.rig,self.mag,self.spare]:
   ob.animation_data.action=None
   for tr in list(ob.animation_data.nla_tracks):ob.animation_data.nla_tracks.remove(tr)
  self.char.hide_viewport=True
  a=Author.__new__(Author);a.rig=self.rig;a.char=self.char;a.weapon=self.weapon;a.mag=self.mag;a.rest={b.name:b.matrix_local.copy()for b in self.rig.data.bones};a.bones=self.rig.pose.bones;a.errors=[];a.faction=faction;a.russian=faction=='Russian';self.a=a
  meta=json.loads((CACHE/'sprint-rebuild/diagnostics'/f'{faction}-authored.json').read_text())['all_export_actions'];self.lower=meta['FB_Walk_Lower']['bones'];self.upperBones=meta['FB_Walk_Upper']['bones'];self.names=self.lower+self.upperBones
  self.old={ac.name:fingerprint(ac)for ac in bpy.data.actions};self.actions={};self.info={};self.metrics={'max_wrist_error_m':0,'unreachable_targets':[],'samples':{}}
  pose(self.rig,'Lower_AimStance','FB_AimIdle_Upper',0);W=self.weapon.matrix_world.copy();self.hand={s:W.inverted()@a.bones['wrist.'+s].matrix for s in ['L','R']};self.aimR=W.to_quaternion();self.headQ=a.bones['head'].matrix.to_quaternion();self.fingers={n:a.bones[n].matrix_basis.copy()for n in self.upperBones if n.startswith(('finger','metacarpal'))};self.root=a.rest['root'].translation.copy()
  self.carryHands={}
  for kind,names in {'stand':('Lower_Idle','FB_LowReady_Upper'),'walk':('FB_Walk_Lower','FB_Walk_Upper'),'sprint':('SR_Sprint_Lower','SR_Sprint_Upper')}.items():
   pose(self.rig,*names,0);weapon=self.weapon.matrix_world.copy();self.carryHands[kind]=weapon.inverted()@a.bones['wrist.L'].matrix
  self.boots={}
  for side in ['L','R']:
   g=self.char.vertex_groups['foot.'+side].index;self.boots[side]=[v.co.copy()-a.rest['foot.'+side].translation for v in self.char.data.vertices if v.co.z<.25 and any(x.group==g and x.weight>.99 for x in v.groups)]
 def rot(self,n,x=0,y=0,z=0):self.a.rot(n,tuple(math.radians(v)for v in (x,y,z)))
 def solve(self,start,mid,end,goal,hint,orientation=None):
  a=self.a;h=a.bones[start].head.copy();h0=a.rest[start].translation;k0=a.rest[mid].translation;e0=a.rest[end].translation;l1=(k0-h0).length;l2=(e0-k0).length;v=goal-h;d=v.length
  if not abs(l1-l2)+.001<d<l1+l2-.0002:raise ValueError(('IK unreachable',self.faction,start,d,l1+l2,list(goal),list(h)))
  axis=v/d;x=(l1*l1-l2*l2+d*d)/(2*d);height=math.sqrt(max(0,l1*l1-x*x));pole=Vector(hint)-(h+axis*x);pole=(pole-axis*pole.dot(axis)).normalized()
  if start.startswith('upperleg') and h.z+axis.z*x+pole.z*height<.085:
   up=Vector((0,0,1));up=(up-axis*up.dot(axis)).normalized();side=axis.cross(up).normalized();c=max(-1,min(1,(.085-h.z-axis.z*x)/max(1e-8,height*up.z)));sign=1 if pole.dot(side)>=0 else-1;pole=up*c+side*sign*math.sqrt(max(0,1-c*c))
  knee=h+axis*x+pole*height
  a.rigid(start,(k0-h0).rotation_difference(knee-h).to_matrix(),h0,h);a.rigid(mid,(e0-k0).rotation_difference(goal-knee).to_matrix(),k0,knee)
  if orientation is not None:a.rigid(end,orientation,e0,goal)
  return knee
 def foot(self,side,goal,R,prone=False):
  floor=.004-min((R@p).z for p in self.boots[side]);goal=goal.copy();goal.z=max(goal.z,floor)
  hint=Vector(((.85 if side=='L'else-.85),.45,-.15))if prone else Vector((goal.x,-1,.35))
  return self.solve('upperleg01.'+side,'lowerleg01.'+side,'foot.'+side,goal,hint,R)
 def setup(self,height,pitch,t=0,sway=0,roll=0,yaw=0,rooty=0):
  a=self.a;a.reset();R=Euler((math.radians(pitch),math.radians(roll),math.radians(yaw)),'XYZ').to_matrix();a.rigid('root',R,self.root,Vector((sway,rooty,height)))
  return a
 def upper(self,t,prone=0,aim=1,lean=0,crawl=0,recoil=0):
  a=self.a;b=math.sin(TAU*t/2.4);p=math.sin(TAU*t/2.4);c=math.cos(TAU*t/2.4)
  for n,k in [('spine05',1),('spine04',.85),('spine03',.7),('spine02',.6),('spine01',.5)]:self.rot(n,(-3*prone+.22*b)*k,lean*4*k,(1.4*p*crawl)*k)
  self.rot('spine02',-.8*recoil);self.rot('spine01',-.5*recoil)
  self.rot('clavicle.L',.4*b,0,.7*p*crawl);self.rot('clavicle.R',-.4*b,0,-.7*p*crawl)
  for n in ['neck01','neck02','neck03']:self.rot(n,-12*prone,0,0)
  shoulder=a.bones['upperarm01.R'].head.copy();R=(Euler((math.radians(22*(1-aim)+1.5*recoil),0,math.radians(-18 if lean<0 else -4*lean)),'XYZ').to_quaternion()@self.aimR).to_matrix()
  stock=Vector((0,.346,.03)if self.faction=='Russian'else(0,.338,.063));anchor=shoulder+Vector((.08+.06*max(0,lean),-.08,-.02+.001*b));W=Matrix.Translation(anchor-R@stock+Vector((.002*p*crawl,.008*recoil,.001*b)))@R.to_4x4()
  for _ in range(8):
   changed=False
   for side in ['L','R']:
    sh=a.bones['upperarm01.'+side].head;target=(W@self.hand[side]).translation;limit=(a.rest['lowerarm01.'+side].translation-a.rest['upperarm01.'+side].translation).length+(a.rest['wrist.'+side].translation-a.rest['lowerarm01.'+side].translation).length-.006;v=target-sh
    if v.length>limit:W.translation-=v.normalized()*(v.length-limit);changed=True
   if not changed:break
  for n,M in self.fingers.items():a.bones[n].matrix_basis=M
  elbows={}
  for s,sign in [('R',-1),('L',1)]:
   target=W@self.hand[s];hint=Vector((sign*(.36+.05*c*crawl),shoulder.y+.03+.03*p*crawl,.075 if prone>.8 else shoulder.z-.20));elbows[s]=self.solve('upperarm01.'+s,'lowerarm01.'+s,'wrist.'+s,target.translation,hint)
   a.bones['wrist.'+s].matrix=target;a.update();self.metrics['max_wrist_error_m']=max(self.metrics['max_wrist_error_m'],(a.bones['wrist.'+s].head-target.translation).length)
  head=a.bones['head'];q=Euler((math.radians(12*prone),0,math.radians(.4*b+(-18 if lean<0 else 0))),'XYZ').to_quaternion()@self.headQ;head.matrix=Matrix.Translation(head.head)@q.to_matrix().to_4x4();a.update()
  return elbows
 def prone(self,t=0,kind='idle',direction=1):
  crawl=kind=='crawl';aim=1 if kind in ['aim','fire']else .85;p=0 if kind=='fire'else t/2.4%1;s=math.sin(TAU*p);speed=.23 if direction>0 else-.17
  self.setup(.302+(.007*math.cos(2*TAU*p)if crawl else .0015*s),82,t,.022*s if crawl else 0,1.2*s if crawl else .25*s,1.7*s if crawl else 0)
  knees={};feet={}
  for side,off,sign in [('L',0,1),('R',.5,-1)]:
   u=(p+off)%1;duty=.62;R=Matrix.Rotation(math.radians(120),3,'X');z=.004-min((R@v).z for v in self.boots[side]);x=sign*.18
   if crawl:
    front=.40 if direction>0 else .72;rear=front+speed*2.4*duty
    if u<=duty:y=front+speed*2.4*u
    else:q=(u-duty)/(1-duty);y=hermite(rear,front,speed*2.4*(1-duty),speed*2.4*(1-duty),q);z+=.04*math.sin(math.pi*q)**2;x+=sign*.08*math.sin(math.pi*q)**2
   else:y=.74 if side=='R'else .70
   goal=Vector((x,y,z));knees[side]=self.foot(side,goal,R,True);feet[side]=goal
  recoil=max(0,math.sin(math.pi*(t%.6)/.18))if kind=='fire'and t%.6<.18 else 0
  elbows=self.upper(0 if kind=='fire'else t,1,aim,crawl=1 if crawl else 0,recoil=recoil)
  return {'knees':knees,'feet':feet,'elbows':elbows}
 def crouch(self,t=0,kind='idle',lean=0,cover=False):
  walk=kind=='walk';p=t/1.6%1;s=math.sin(TAU*p);height=.42 if cover else .58
  self.setup(height+(.008*math.cos(2*TAU*p)if walk else .0015*math.sin(TAU*(0 if kind=='fire'else t)/2.4)),20 if cover else 16,t,(.018*s if walk else .02*lean),roll=lean*6,yaw=lean*-6,rooty=.03)
  knees={};feet={}
  for side,off,sign in [('L',0,1),('R',.5,-1)]:
   u=(p+off)%1;duty=.65;y=(-.06 if side=='L'else .06);pitch=0;lift=0
   if walk:
    front=-.55*1.6*duty/2;rear=-front
    if u<=duty:y+=front+.55*1.6*u
    else:q=(u-duty)/(1-duty);y+=hermite(rear,front,.55*1.6*(1-duty),.55*1.6*(1-duty),q);lift=.075*math.sin(math.pi*q)**2
   R=Matrix.Rotation(math.radians(pitch),3,'X');goal=Vector((sign*.18,y,.004-min((R@v).z for v in self.boots[side])+lift));knees[side]=self.foot(side,goal,R);feet[side]=goal
  recoil=max(0,math.sin(math.pi*(t%.6)/.18))if kind=='fire'and t%.6<.18 else 0
  elbows=self.upper(t*1.5 if walk else 0 if kind=='fire'else t,0,1 if kind in ['aim','fire']else .1 if cover else .65,lean=lean,recoil=recoil)
  return {'knees':knees,'feet':feet,'elbows':elbows}
 def capture(self):return {n:self.a.bones[n].matrix_basis.copy()for n in self.names}
 def apply(self,P):
  for n,M in P.items():self.a.bones[n].matrix_basis=M
  self.a.update()
 def source(self,kind,t=0):
  names={'stand':('Lower_Idle','FB_LowReady_Upper'),'walk':('FB_Walk_Lower','FB_Walk_Upper'),'sprint':('SR_Sprint_Lower','SR_Sprint_Upper')}
  pose(self.rig,*names[kind],t);return self.capture()
 def between(self,A,B,k):
  for n in self.names:
   l,q,_=A[n].decompose();l2,q2,_=B[n].decompose();self.a.bones[n].location=l.lerp(l2,k);self.a.bones[n].rotation_quaternion=q.slerp(q2,k)
  self.a.update()
 def feasible_weapon(self,W,leftRef):
  for _ in range(10):
   changed=False
   for side,reference in [('R',self.hand['R']),('L',leftRef)]:
    shoulder=self.a.bones['upperarm01.'+side].head;target=(W@reference).translation;limit=(self.a.rest['lowerarm01.'+side].translation-self.a.rest['upperarm01.'+side].translation).length+(self.a.rest['wrist.'+side].translation-self.a.rest['lowerarm01.'+side].translation).length-.006;v=target-shoulder
    if v.length>limit:W.translation-=v.normalized()*(v.length-limit);changed=True
   if not changed:break
  return W
 def left_reference(self,kind,u):
  aimed=self.hand['L'];stand=self.carryHands['stand']
  if kind in ['StandProne','WalkProne','SprintProne']:
   source=self.carryHands[{'StandProne':'stand','WalkProne':'walk','SprintProne':'sprint'}[kind]];return source.lerp(aimed,smooth(u/.34))
  if kind=='StandCrouch':return stand.lerp(aimed,smooth(u))
  if kind=='CrouchStand':return aimed.lerp(stand,smooth(u))
  if kind=='ProneStand':return aimed.lerp(stand,ramp(u,.68,1))
  if kind=='CoverEnter':return self.carryHands['walk'].lerp(aimed,smooth(u))
  if kind=='CoverExit':return aimed.lerp(stand,smooth(u))
  return aimed
 def transition(self,t,D,kind):
  u=t/D
  if kind in ['StandProne','WalkProne','SprintProne']:
   A=self.source({'StandProne':'stand','WalkProne':'walk','SprintProne':'sprint'}[kind]);self.crouch(0);B=self.capture();self.prone(0);C=self.capture()
   # Knees absorb the initial descent, then the pelvis, chest and shoulders
   # rotate through a controlled low position. Hands remain solved on the rifle.
   if u<.34:self.between(A,B,smooth(u/.34))
   else:self.between(B,C,smooth((u-.34)/.66))
  elif kind in ['ProneCrouch','ProneStand']:
   self.prone(0);A=self.capture();self.crouch(0);B=self.capture();C=self.source('stand')
   if kind=='ProneCrouch':self.between(A,B,smooth(u))
   elif u<.68:self.between(A,B,smooth(u/.68))
   else:self.between(B,C,smooth((u-.68)/.32))
  elif kind in ['StandCrouch','CrouchStand']:
   A=self.source('stand');self.crouch(0);B=self.capture();
   if kind=='CrouchStand':A,B=B,A
   self.between(A,B,smooth(u));self.blend_feet(A,B,u)
  if 1e-7<u<1-1e-7:
   dropping=kind.endswith('Prone');rising=kind in ['ProneCrouch','ProneStand'];crouching=kind in ['StandCrouch','CrouchStand']
   if dropping or rising:
    sourcekind={'StandProne':'stand','WalkProne':'walk','SprintProne':'sprint'}.get(kind,'stand')
    current=self.capture();self.crouch(0)if kind=='ProneCrouch'else self.source(sourcekind);standing={side:self.a.bones['foot.'+side].matrix.copy()for side in ['L','R']};self.prone(0);pronefeet={side:self.a.bones['foot.'+side].matrix.copy()for side in ['L','R']};self.apply(current)
    for side,begin,end in [('L',.05,.40),('R',.45,.85)]:
     q=max(0,min(1,(u-begin)/(end-begin)));k=smooth(q)
     if rising:k=1-k
     start=standing[side];finish=pronefeet[side];R0=(start@self.a.rest['foot.'+side].inverted()).to_quaternion();R1=(finish@self.a.rest['foot.'+side].inverted()).to_quaternion();R=R0.slerp(R1,k).to_matrix();goal=start.translation.lerp(finish.translation,k);goal.z=.004-min((R@v).z for v in self.boots[side])+.065*math.sin(math.pi*q)**2
     self.foot(side,goal,R,prone=(dropping and u>.55)or(rising and u<.5))
  # Re-solve the gripping arms after interpolated spine/root poses. This avoids
  # separate joint interpolation pulling a hand away from the attached weapon.
  if 1e-7<u<1-1e-7:
   W=self.feasible_weapon(self.weapon.matrix_world.copy(),self.left_reference(kind,u))
   for s,sign in [('R',-1),('L',1)]:
    target=W@(self.left_reference(kind,u)if s=='L'else self.hand[s]);h=self.a.bones['upperarm01.'+s].head;self.solve('upperarm01.'+s,'lowerarm01.'+s,'wrist.'+s,target.translation,(sign*.38,h.y+.05,h.z-.2));self.a.bones['wrist.'+s].matrix=target;self.a.update()
  if kind in ['ProneCrouch','ProneStand'] and .05<u<.34:
   # A deliberate support-hand release: the right wrist continuously controls
   # the rifle while the open left palm braces the early rise, then regrips.
   weight=ramp(u,.05,.12)*(1-ramp(u,.20,.34));a=self.a;current=a.bones['wrist.L'].matrix.copy();wrist,anchor,frame=a.hand_frame('L');desired=Matrix((Vector((1,0,0)),Vector((0,-1,0)),Vector((0,0,-1)))).transposed();rotation=desired@frame.transposed();ground=rotation.to_4x4()@a.rest['wrist.L'];ground.translation=Vector((.27,-.47,.055));loc=current.translation.lerp(ground.translation,weight);q=current.to_quaternion().slerp(ground.to_quaternion(),weight);target=Matrix.Translation(loc)@q.to_matrix().to_4x4();shoulder=a.bones['upperarm01.L'].head
   self.solve('upperarm01.L','lowerarm01.L','wrist.L',target.translation,(.40,shoulder.y+.03,.14));a.bones['wrist.L'].matrix=target
   for n in self.upperBones:
    if n.endswith('.L')and n.startswith(('finger','metacarpal')):a.bones[n].rotation_quaternion=a.bones[n].rotation_quaternion.slerp(Quaternion(),weight)
   a.update()
 def blend_feet(self,A,B,u):
  current=self.capture();self.apply(A);FA={s:self.a.bones['foot.'+s].matrix.copy()for s in ['L','R']};self.apply(B);FB={s:self.a.bones['foot.'+s].matrix.copy()for s in ['L','R']};self.apply(current)
  for side,begin,end in [('L',.08,.58),('R',.35,.90)]:
   q=max(0,min(1,(u-begin)/(end-begin)));k=smooth(q);M0=FA[side];M1=FB[side];R0=(M0@self.a.rest['foot.'+side].inverted()).to_quaternion();R1=(M1@self.a.rest['foot.'+side].inverted()).to_quaternion();R=R0.slerp(R1,k).to_matrix();g=M0.translation.lerp(M1.translation,k)
   floor=.004-min((R@v).z for v in self.boots[side]);gap0=max(0,M0.translation.z-(.004-min((R0.to_matrix()@v).z for v in self.boots[side])));gap1=max(0,M1.translation.z-(.004-min((R1.to_matrix()@v).z for v in self.boots[side])));g.z=floor+gap0*(1-ramp(u,0,.35))+gap1*ramp(u,.65,1)+.045*math.sin(math.pi*q)**2
   self.foot(side,g,R)
 def crawl_transition(self,t,D,to_crawl):
  self.prone(0,'idle'if to_crawl else'crawl');A=self.capture();self.prone(0,'crawl'if to_crawl else'aim');B=self.capture();u=t/D;self.between(A,B,smooth(u));self.blend_feet(A,B,u)
  W=self.weapon.matrix_world.copy();target=W@self.hand['L'];h=self.a.bones['upperarm01.L'].head;self.solve('upperarm01.L','lowerarm01.L','wrist.L',target.translation,(.4,h.y,h.z-.16));self.a.bones['wrist.L'].matrix=target;self.a.update()
 def cover(self,t=0,lean=0,aim=False,fire=False,above=False):
  if above:
   pose(self.rig,'Lower_AimStance','FB_AimIdle_Upper',0 if fire else t%2.4)
   for side,sign in [('L',1),('R',-1)]:
    R=Matrix.Identity(3);goal=Vector((sign*.18,-.06 if side=='L'else .06,.004-min(v.z for v in self.boots[side])));self.foot(side,goal,R)
   if fire:self.rot('spine01',-1.5*max(0,math.sin(math.pi*(t%.6)/.18))if t%.6<.18 else 0)
  else:self.crouch(t,'fire'if fire else'aim'if aim else'idle',lean=lean,cover=True)
 def cover_transition(self,t,D,kind):
  u=t/D
  if kind=='CoverEnter':A=self.source('walk');self.cover(0);B=self.capture()
  elif kind=='CoverExit':self.cover(0);A=self.capture();B=self.source('stand')
  elif kind=='CoverRise':self.cover(0);A=self.capture();self.cover(0,above=True);B=self.capture()
  elif kind=='CoverLower':self.cover(0,above=True);A=self.capture();self.cover(0);B=self.capture()
  else:
   sign=1 if 'Left'in kind else-1
   self.cover(0);A=self.capture();self.cover(0,lean=sign,aim=True);B=self.capture()
   if kind.startswith('CoverReturn'):A,B=B,A
  self.between(A,B,smooth(u))
  if kind in ['CoverEnter','CoverExit']:self.blend_feet(A,B,u)
  # Footprints stay fixed throughout cover lean/rise/return; the pelvis and
  # spine carry the weight shift, not a translated static character.
  if kind not in ['CoverEnter','CoverExit']:
   for side,sign in [('L',1),('R',-1)]:
    R=Matrix.Identity(3);goal=Vector((sign*.18,-.06 if side=='L'else .06,.004-min(v.z for v in self.boots[side])));self.foot(side,goal,R)
  # The weapon is bone-parented to the dominant wrist; re-solve the support
  # wrist against that same weapon transform after torso interpolation.
  if 0<u<1:
   W=self.feasible_weapon(self.weapon.matrix_world.copy(),self.left_reference(kind,u))
   for side,sign in [('R',-1),('L',1)]:
    target=W@(self.left_reference(kind,u)if side=='L'else self.hand[side]);h=self.a.bones['upperarm01.'+side].head;self.solve('upperarm01.'+side,'lowerarm01.'+side,'wrist.'+side,target.translation,(sign*.4,h.y-.08,h.z-.20));self.a.bones['wrist.'+side].matrix=target;self.a.update()
 def record(self,name,D,loop,fn,extra=None):
  frames=[];samples=[]
  for i in range(round(D*FPS)+1):
   t=i/FPS;fn(t);frames.append((i,self.capture()))
   if i%3==0 or i==round(D*FPS):samples.append({'time':t,'bones':{n:list(self.a.bones[n].head)for n in ['root','head','foot.L','foot.R','lowerleg01.L','lowerleg01.R','lowerarm01.L','lowerarm01.R','wrist.L','wrist.R']}})
  for layer,bones in [('Lower',self.lower),('Upper',self.upperBones)]:
   key='TC_'+name+'_'+layer;ac=bpy.data.actions.new(key);ac.use_fake_user=True;self.rig.animation_data.action=ac;prev={}
   for frame,P in frames:
    for n in bones:
     l,q,_=P[n].decompose();b=self.a.bones[n]
     if n in prev and q.dot(prev[n])<0:q=-q
     prev[n]=q.copy();b.location=l;b.rotation_quaternion=q;b.keyframe_insert('location',frame=frame,group=n);b.keyframe_insert('rotation_quaternion',frame=frame,group=n)
   self.rig.animation_data.action=None
   for fc in ac.fcurves:
    for k in fc.keyframe_points:k.interpolation='LINEAR'
   self.actions[key]=ac;self.info[key]={'duration':D,'loop':loop,'layer':layer.lower(),'bones':bones,**(extra or{})}
   if layer=='Upper':self.info[key]['phase_sync_lower']='TC_'+name+'_Lower'
  self.metrics['samples'][name]=samples;print('AUTHORED',self.faction,name,flush=True)
 def build(self):
  for name,kind in [('ProneIdle','idle'),('ProneAim','aim'),('ProneFire','fire')]:self.record(name,2.4 if kind!='fire'else .6,True,lambda t,k=kind:self.prone(t,k))
  for name,direction in [('CrawlForward',1),('CrawlBackward',-1)]:self.record(name,2.4,True,lambda t,d=direction:self.prone(t,'crawl',d),{'speed_mps':.23 if direction>0 else-.17})
  for name,to_crawl in [('ProneToCrawl',True),('CrawlToProneAim',False)]:self.record(name,.8,False,lambda t,d=to_crawl:self.crawl_transition(t,.8,d),{'requires_entry_phase':0})
  for name,kind in [('CrouchIdle','idle'),('CrouchWalk','walk'),('CrouchAim','aim'),('CrouchFire','fire')]:self.record(name,1.6 if kind=='walk'else .6 if kind=='fire'else 2.4,True,lambda t,k=kind:self.crouch(t,k),{'speed_mps':.55 if kind=='walk'else 0})
  for kind,D in [('StandProne',1.45),('WalkProne',1.35),('SprintProne',1.2),('ProneCrouch',1.8),('ProneStand',2.6),('StandCrouch',.9),('CrouchStand',1.0)]:
   D=round(D*30)/30;v={'WalkProne':1.05,'SprintProne':3.6}.get(kind,0);stop=.65 if kind=='SprintProne'else .45
   travel=[{'time':i/30,'distance_m':v*stop*(min(i/30/stop,1)-min(i/30/stop,1)**2+min(i/30/stop,1)**3/3)}for i in range(round(D*30)+1)]
   self.record(kind,D,False,lambda t,D=D,k=kind:self.transition(t,D,k),{'travel_samples_m':travel,'entry':kind,'requires_entry_phase':0,'sample_rate':30,'support_hand_plant':{'left_release_phase':[.05,.12],'left_plant_phase':[.12,.20],'left_return_phase':[.20,.34],'right_grip':'continuous'}if kind in ['ProneCrouch','ProneStand']else None})
  for name,lean,above,fire in [('CoverIdle',0,False,False),('CoverAimLeft',1,False,False),('CoverAimRight',-1,False,False),('CoverFireLeft',1,False,True),('CoverFireRight',-1,False,True),('CoverAboveAim',0,True,False),('CoverAboveFire',0,True,True)]:
   self.record(name,.6 if fire else 2.4,True,lambda t,l=lean,a=above,f=fire:self.cover(t,l,aim=bool(l),above=a,fire=f),{'cover_anchor':{'forward_m':1.3,'height_m':1.3,'corner_edge_x_m':.12}})
  for kind in ['CoverEnter','CoverExit','CoverLeanLeft','CoverLeanRight','CoverReturnLeft','CoverReturnRight','CoverRise','CoverLower']:
   self.record(kind,1.2,False,lambda t,k=kind:self.cover_transition(t,1.2,k),{'requires_entry_phase':0})
  self.save()
 def save(self):
  assert all(fingerprint(bpy.data.actions[n])==h for n,h in self.old.items()),'Preserved action modified'
  self.char.hide_viewport=False;self.prone(0);bpy.context.scene.render.fps=30;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source'/f'{self.faction}_Tactical.blend'),compress=True)
  self.export();self.metrics['preserved_action_fingerprints']=self.old;self.metrics['actions']=self.info;(ROOT/'validation'/f'{self.faction}-authored.json').write_text(json.dumps(self.metrics,indent=2)+'\n')
 def export(self):
  # Export only new masks, then append their binary/accessors to the intact
  # validated source GLB. Geometry, skins, rest nodes and old clips stay exact.
  for ob in [self.rig,self.mag,self.spare]:
   ob.animation_data.action=None
   for tr in list(ob.animation_data.nla_tracks):ob.animation_data.nla_tracks.remove(tr)
  for name,info in self.info.items():
   tr=self.rig.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,self.actions[name]);st.action_frame_start=0;st.action_frame_end=round(info['duration']*30);tr.mute=True
  bpy.ops.object.select_all(action='DESELECT')
  for ob in [self.rig,self.char,self.weapon,self.mag,self.spare,*[o for o in self.weapon.children if o.type=='EMPTY']]:ob.select_set(True)
  bpy.context.view_layer.objects.active=self.rig
  path=ROOT/'models'/f'{self.faction}_Tactical.glb'
  bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=True,export_skins=True,export_tangents=False,export_extras=True)
  j,binary=parse_glb(path);base,oldbin=parse_glb(CACHE/'sprint-rebuild/models'/f'{self.faction}_SprintReview.glb');merged=bytearray(oldbin);accessors={};views={};nodeids={n['name']:i for i,n in enumerate(base['nodes'])if'name'in n}
  def accessor(index):
   if index in accessors:return accessors[index]
   ac=dict(j['accessors'][index]);vi=ac['bufferView']
   if vi not in views:
    view=dict(j['bufferViews'][vi]);start=view.get('byteOffset',0);merged.extend(b'\0'*((-len(merged))%4));view['byteOffset']=len(merged);view['buffer']=0;merged.extend(binary[start:start+view['byteLength']]);views[vi]=len(base['bufferViews']);base['bufferViews'].append(view)
   ac['bufferView']=views[vi];accessors[index]=len(base['accessors']);base['accessors'].append(ac);return accessors[index]
  for anim in j['animations']:
   allowed=set(self.info[anim['name']]['bones']);anim['channels']=[c for c in anim['channels']if j['nodes'][c['target']['node']]['name']in allowed];used=sorted({c['sampler']for c in anim['channels']});mp={old:i for i,old in enumerate(used)};anim['samplers']=[anim['samplers'][i]for i in used]
   for s in anim['samplers']:s['input']=accessor(s['input']);s['output']=accessor(s['output'])
   for c in anim['channels']:c['sampler']=mp[c['sampler']];c['target']['node']=nodeids[j['nodes'][c['target']['node']]['name']]
   base['animations'].append(anim)
  base['buffers'][0]['byteLength']=len(merged);base.setdefault('extras',{})['tactical_revision']='tactical-review-1';write_glb(path,base,bytes(merged));print('TACTICAL_EXPORTED',self.faction,len(self.info),path,flush=True)

if __name__=='__main__':
 t=Tactical(os.environ.get('AW_FACTION','USMC'))
 if os.environ.get('AW_DRAFT')=='1':
  for kind in ['ProneIdle','CrouchIdle']:
   t.record(kind,2.4,True,lambda time,k=kind:t.prone(time)if k=='ProneIdle'else t.crouch(time))
  t.save()
 else:t.build()
