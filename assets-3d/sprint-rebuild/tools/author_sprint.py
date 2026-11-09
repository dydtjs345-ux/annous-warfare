"""New contact-first running cycle. Independent source copies; never edits prior Actions.
Forward -Y, Z up. World travel belongs to manifest, authored joints remain in place.
"""
import bpy,sys,os,math,json,hashlib,bmesh
from pathlib import Path
from mathutils import Vector,Matrix,Euler,Quaternion
ROOT=Path(__file__).resolve().parents[1];OLD=ROOT.parent/'full-body-debug';BASE=ROOT.parent/'infantry-animation';sys.path.insert(0,str(BASE/'tools'))
from author_motion import Author
from animation_io import pose,apply_action,parse_glb,write_glb
D=2/3;V=3.6;DUTY=.36;TAU=math.tau

def smooth(x):x=max(0,min(1,x));return x*x*x*(10+x*(-15+6*x))
def lerp(a,b,x):return a+(b-a)*x
def curve(u,points):
 for (t,a,da),(t1,b,db) in zip(points,points[1:]):
  if t<=u<=t1:
   h=t1-t;s=(u-t)/h;return(2*s**3-3*s*s+1)*a+(s**3-2*s*s+s)*h*da+(-2*s**3+3*s*s)*b+(s**3-s*s)*h*db
 return points[0][1]if u<points[0][0]else points[-1][1]
def fingerprint(ac):return hashlib.sha256(json.dumps([(f.data_path,f.array_index,[(list(k.co),k.interpolation)for k in f.keyframe_points])for f in ac.fcurves],sort_keys=True).encode()).hexdigest()

def author(faction):
 bpy.ops.wm.open_mainfile(filepath=str(OLD/'source'/f'{faction}_FullBody.blend'));r=bpy.data.objects['InfantryRig'];ch=bpy.data.objects[faction+'_Character'];w=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine'];spare=bpy.data.objects['SpareMagazine'];meta=json.loads((OLD/'diagnostics'/f'{faction}-authored.json').read_text())['all_export_actions'];originals={a.name:fingerprint(a)for a in bpy.data.actions}
 for ob in [r,mag,spare]:
  ob.animation_data.action=None
  for tr in list(ob.animation_data.nla_tracks):ob.animation_data.nla_tracks.remove(tr)
 a=Author.__new__(Author);a.rig=r;a.char=ch;a.weapon=w;a.mag=mag;a.russian=faction=='Russian';a.faction=faction;a.rest={b.name:b.matrix_local.copy()for b in r.data.bones};a.bones=r.pose.bones;a.errors=[];a.previous={};a.boots={}
 lower=meta['FB_Sprint_Lower']['bones'];upper=meta['FB_Sprint_Upper']['bones'];allnames=lower+upper;new={};frames={};maxgrip=[];maxleg=[]
 for s in ['L','R']:
  g=ch.vertex_groups['foot.'+s].index;a.boots[s]=[v.co.copy()-r.data.bones['foot.'+s].head_local for v in ch.data.vertices if v.co.z<.25 and any(x.group==g and x.weight>.99 for x in v.groups)]
 # A fresh running carry uses the existing authored grip frames and attachment,
 # not the old sprint's leg/torso trajectories.
 pose(r,'Lower_Idle','Upper_LowReady',0);carryW=w.matrix_world.copy();carryRoot=r.pose.bones['root'].head.copy();handR=carryW.inverted()@r.pose.bones['wrist.R'].matrix;handL=carryW.inverted()@r.pose.bones['wrist.L'].matrix;carryHead=r.pose.bones['head'].matrix.to_quaternion();carryChest=r.pose.bones['spine01'].matrix.copy();finger={n:r.pose.bones[n].matrix_basis.copy()for n in upper if n.startswith('finger')};restroot=a.rest['root'].translation.copy()
 def rot(n,x=0,y=0,z=0):a.rot(n,tuple(math.radians(v)for v in(x,y,z)))
 def solve_arm(s,target,hint):
  hip=r.pose.bones['upperarm01.'+s].head.copy();h0=a.rest['upperarm01.'+s].translation;k0=a.rest['lowerarm01.'+s].translation;e0=a.rest['wrist.'+s].translation;la=(k0-h0).length;lb=(e0-k0).length;v=target.translation-hip;d=v.length
  assert abs(la-lb)+.001<d<la+lb-.0001,('ARM',faction,s,d,la+lb)
  axis=v/d;x=(la*la-lb*lb+d*d)/(2*d);height=math.sqrt(max(0,la*la-x*x));pole=Vector(hint)-(hip+axis*x);pole=(pole-axis*pole.dot(axis)).normalized();elbow=hip+axis*x+pole*height
  a.rigid('upperarm01.'+s,(k0-h0).rotation_difference(elbow-hip).to_matrix(),h0,hip);a.rigid('lowerarm01.'+s,(e0-k0).rotation_difference(target.translation-elbow).to_matrix(),k0,elbow);r.pose.bones['wrist.'+s].matrix=target;a.update();maxgrip.append((r.pose.bones['wrist.'+s].head-target.translation).length)
 def rolling(s,R0,R1):
  q0=R0.to_quaternion();q1=R1.to_quaternion();angle=min(q0.rotation_difference(q1).angle,math.tau-q0.rotation_difference(q1).angle);N=max(1,math.ceil(math.degrees(angle)*4));offset=Vector();previous=R0
  for k in range(N):
   mid=q0.slerp(q1,(k+.5)/N).to_matrix();after=q0.slerp(q1,(k+1)/N).to_matrix();p=min(a.boots[s],key=lambda p:(mid@p).z);offset+=previous@p-after@p;previous=after
  return offset
 # Cache the integrated rolling curve so solving an anatomical ankle angle
 # does not repeatedly search every boot vertex at every trial orientation.
 rolltables={}
 for side in ['L','R']:
  table=[];last=Matrix.Rotation(math.radians(-20),3,'X');acc=Vector()
  for j in range(561):
   theta=-20+j*.25;R=Matrix.Rotation(math.radians(theta),3,'X')
   if j:mid=Matrix.Rotation(math.radians(theta-.125),3,'X');p=min(a.boots[side],key=lambda p:(mid@p).z);acc+=last@p-R@p
   table.append(acc.copy());last=R
  zero=table[96];rolltables[side]=[p-zero for p in table]
 def rollangle(side,theta):
  f=max(0,min(560,(theta+20)*4));j=min(559,int(f));return rolltables[side][j].lerp(rolltables[side][j+1],f-j)
 def shin_angle(side,goal):
  hip=r.pose.bones['upperleg01.'+side].head;h0=a.rest['upperleg01.'+side].translation;k0=a.rest['lowerleg01.'+side].translation;e0=a.rest['foot.'+side].translation;l1=(k0-h0).length;l2=(e0-k0).length;v=goal-hip;dist=v.length
  if dist>=l1+l2-.0002:return None
  axis=v/dist;x=(l1*l1-l2*l2+dist*dist)/(2*dist);height=math.sqrt(max(0,l1*l1-x*x));pole=Vector((0,-1,0));pole=(pole-axis*pole.dot(axis)).normalized();knee=hip+axis*x+pole*height;shin=goal-knee;rest=e0-k0
  return math.degrees(math.atan2(shin.y,-shin.z)-math.atan2(rest.y,-rest.z))
 def stance(u,side):
  front=-.39;R0=Matrix.Rotation(math.radians(4),3,'X');p0=a.support_point(side,R0);base=front-(R0@p0).y;wanted=curve(u,[(0,4,0),(.10,-15,0),(.20,-18,0),(.30,5,150),(DUTY,20,0)])
  def candidate(theta):
   R=Matrix.Rotation(math.radians(theta),3,'X');goal=Vector((.105 if side=='L'else-.105,base+V*D*u+rollangle(side,theta).y,.003-min((R@p).z for p in a.boots[side])));shin=shin_angle(side,goal);return(theta-shin-wanted if shin is not None else None,goal,R)
  previous=None;brackets=[]
  for theta in range(-15,111,5):
   value,goal,R=candidate(theta)
   if value is not None:
    if previous is not None and previous[1]*value<=0:brackets.append((previous[0],theta))
    previous=(theta,value)
   else:previous=None
  assert brackets,('No anatomical stance solution',side,u,wanted)
  lo,hi=brackets[0]
  for _ in range(16):
   mid=(lo+hi)/2;value,goal,R=candidate(mid);low=candidate(lo)[0]
   if low*value<=0:hi=mid
   else:lo=mid
  return candidate((lo+hi)/2)[1:]
 def foot(u,side):
  if u<=DUTY:return stance(u,side)
  start,R0=stance(DUTY,side);end,R1=stance(0,side)
  y=curve(u,[(DUTY,start.y,V*D),(.47,.55,0),(.61,.32,-3.6),(.78,-.25,-2.0),(.91,-.35,0),(1,end.y,V*D)])
  z=curve(u,[(DUTY,start.z,1.7),(.54,.58,0),(.67,.35,-1.9),(.83,.20,-.8),(1,end.z,-.55)])
  goal=Vector((.105 if side=='L'else-.105,y,z));hip=r.pose.bones['upperleg01.'+side].head;l1=(a.rest['lowerleg01.'+side].translation-a.rest['upperleg01.'+side].translation).length;l2=(a.rest['foot.'+side].translation-a.rest['lowerleg01.'+side].translation).length;maxreach=math.sqrt(l1*l1+l2*l2+2*l1*l2*math.cos(math.radians(15)));horizontal=(goal.x-hip.x)**2+(goal.y-hip.y)**2
  assert horizontal<maxreach*maxreach
  goal.z=max(goal.z,hip.z-math.sqrt(maxreach*maxreach-horizontal));shin=shin_angle(side,goal);ankle=curve(u,[(DUTY,20,0),(.52,12,-70),(.70,0,-40),(.85,-5,0),(1,4,0)]);R=Matrix.Rotation(math.radians(shin+ankle),3,'X')
  floor=.003-min((R@p).z for p in a.boots[side]);assert goal.z>=floor-.002,('Swing floor',u,goal.z,floor)
  return goal,R
 def running(t):
  p=(t/D)%1;s=math.sin(TAU*p);c=math.cos(TAU*p);step=p%.5
  # Contact -> compression -> propulsion -> short ballistic flight.
  z=curve(step,[(0,.92,-.46),(.105,.90,0),(.28,.918,.2),(DUTY,.92,.46),(.43,.9307,0),(.5,.92,-.46)])
  a.reset();rootR=Euler((math.radians(11.5+1.0*math.cos(2*TAU*p)),math.radians(1.2*s),math.radians(2.2*s)),'XYZ').to_matrix();a.rigid('root',rootR,restroot,Vector((.008*s,restroot.y,z)))
  for side in ['L','R']:rot('pelvis.'+side,0,0,3.5*s)
  for side,offset in [('L',0),('R',.5)]:
   goal,R=foot((p+offset)%1,side);
   try:a.chain(side,goal,R)
   except AssertionError as ex:raise AssertionError((t,p,side,list(goal),str(ex)))
   maxleg.append((r.pose.bones['foot.'+side].head-goal).length)
  # Distributed counter-rotation and impact absorption, not a rigid root lean.
  impact=math.cos(2*TAU*(p-.1));rot('spine05',2.4+.9*impact,.7*s,-2.8*s);rot('spine04',1.6+.7*impact,.5*s,-2.2*s);rot('spine03',1.2+.55*impact,.5*s,-1.7*s);rot('spine02',.8+.4*impact,.4*s,-1.0*s);rot('spine01',.6+.35*impact,.3*s,-.8*s)
  for side,sign in [('L',1),('R',-1)]:rot('clavicle.'+side,.65*math.sin(2*TAU*p),sign*1.1*s,sign*.7*s);rot('shoulder01.'+side,.5*impact,sign*.6*s,sign*.4*s)
  rot('neck01',-7.0+.4*impact,0,2.0*s)
  # The gun is carried across the chest, slightly muzzle-down; its complete
  # transform, both wrists and elbows travel as one coordinated running carry.
  bodyDelta=r.pose.bones['spine01'].matrix@carryChest.inverted();follow=bodyDelta@carryW;R=follow.to_quaternion()@Euler((math.radians(-3+.8*impact),math.radians(.5*s),math.radians(1.2*s)),'XYZ').to_quaternion();W=Matrix.Translation(follow.translation+Vector((.006*s,.035,.035+.008*impact)))@R.to_matrix().to_4x4()
  for n,M in finger.items():r.pose.bones[n].matrix_basis=M
  solve_arm('R',W@handR,(-.34,.02+.02*s,1.06));solve_arm('L',W@handL,(.32,-.12-.015*s,1.08))
  head=r.pose.bones['head'];q=Euler((math.radians(2+.35*impact),0,math.radians(.45*s)),'XYZ').to_quaternion()@carryHead;head.matrix=Matrix.Translation(head.head)@q.to_matrix().to_4x4();a.update()
 def record(name,duration,layer,loop,bones,poses,extra=None):
  ac=bpy.data.actions.new(name);ac.use_fake_user=True;new[name]=ac;meta[name]={'duration':duration,'layer':layer,'loop':loop,'bones':bones,'speed_mps':V if loop else 0,**(extra or{})};r.animation_data.action=ac;prev={}
  for frame,matrices in poses:
   for n in bones:
    b=r.pose.bones[n];l,q,sc=matrices[n].decompose()
    if n in prev and q.dot(prev[n])<0:q=-q
    prev[n]=q.copy();b.location=l;b.rotation_quaternion=q;b.keyframe_insert('location',frame=frame,group=n);b.keyframe_insert('rotation_quaternion',frame=frame,group=n)
  r.animation_data.action=None
  for fc in ac.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
 poses=[]
 for i in range(81):
  running(i/120);poses.append((i/4,{n:r.pose.bones[n].matrix_basis.copy()for n in allnames}))
 for layer,bones in [('Lower',lower),('Upper',upper)]:record('SR_Sprint_'+layer,D,layer.lower(),True,bones,poses,{'phase_sync_lower':'SR_Sprint_Lower'}if layer=='Upper'else{'cadence_steps_min':180,'stride_m':V*D,'contact_duty':DUTY})
 if os.environ.get('AW_DRAFT')=='1':
  pose(r,'SR_Sprint_Lower','SR_Sprint_Upper',0);bpy.ops.wm.save_as_mainfile(filepath='/tmp/'+faction+'_SprintDraft.blend',compress=True);print('SPRINT_DRAFT_SAVED',flush=True);return
 # Transitions are contact-constrained full-body blends; anchors are expressed in
 # world travel space and held through each existing or new stance segment.
 # Only transition Actions are new: original walk, idle and sprint stay intact.
 specs=[('IdleToSprint','Idle','New',1.2,0,V),('WalkToSprint','Walk','New',1.2,1.05,V),('SprintToWalk','New','Walk',1.2,V,1.05),('SprintToStop','New','Idle',1.2,V,0)]
 def sample(kind,t):
  if kind=='New':running(t)
  elif kind=='Walk':pose(r,'FB_Walk_Lower','FB_Walk_Upper',t%1.2)
  else:pose(r,'Lower_Idle','FB_LowReady_Upper',t%2.4)
  return {n:r.pose.bones[n].matrix_basis.copy()for n in allnames},{s:r.pose.bones['foot.'+s].matrix.copy()for s in ['L','R']}
 transition_reports=[]
 for name,fromkind,tokind,duration,v0,v1 in specs:
  # Integrate a smooth velocity envelope explicitly; no gameplay changes.
  N=round(duration*60);travel=[0.0];vel=[lerp(v0,v1,smooth(i/N))for i in range(N+1)]
  for i in range(N):travel.append(travel[-1]+(vel[i]+vel[i+1])/120)
  targetTime=D if tokind=='New'else 1.2 if tokind=='Walk'else 0
  sourceTime=D if fromkind=='New'else 1.2 if fromkind=='Walk'else 0
  target_poses=[];feet_cache=[]
  for i in range(N+1):
   t=i/60;u=i/N;k=smooth(u);A,FA=sample(fromkind,t if fromkind!='Idle'else 0);B,FB=sample(tokind,t-duration+targetTime);a.reset()
   for n in allnames:
    l,q,_=A[n].decompose();l2,q2,_=B[n].decompose();r.pose.bones[n].location=l.lerp(l2,k);r.pose.bones[n].rotation_quaternion=q.slerp(q2,k)
   a.update();target_poses.append({n:r.pose.bones[n].matrix_basis.copy()for n in allnames});feet_cache.append({s:FA[s].lerp(FB[s],k)for s in ['L','R']})
  # Explicit accelerating/decelerating contacts, not a blend of two foot paths.
  # Each plant locks a material sole point in world space. The swing folds the
  # heel early and extends the shin late before the next strike.
  plans={
   'IdleToSprint':{'L':[(0,.26),(.60,.84),(1.2,1.2)],'R':[(0,.06),(.30,.53),(.8666667,1.1066667)]},
   'WalkToSprint':{'L':[(0,.26),(.60,.84),(1.2,1.2)],'R':[(0,.10),(.30,.53),(.8666667,1.1066667)]},
   'SprintToWalk':{'L':[(0,.24),(.65,.89),(1.2,1.2)],'R':[(.3333333,.5733333),(.95,1.2)]},
   'SprintToStop':{'L':[(0,.24),(.72,1.2)],'R':[(.3333333,.5733333),(1.0,1.2)]}}
  contacts=plans[name];planned={};rootdrops=[]
  def footR(M):return(M@a.rest['foot.'+side].inverted()).to_3x3()
  def support(R):
   low=min((R@p).z for p in a.boots[side]);return min((p for p in a.boots[side]if(R@p).z<low+1e-5),key=lambda p:p.y)
  def travel_at(t):
   f=max(0,min(N,t*60));j=min(N-1,int(f));return travel[j]+(travel[j+1]-travel[j])*(f-j)
  for side in ['L','R']:
   initial=feet_cache[0][side];final=feet_cache[-1][side];intervals=[]
   for begin,end in contacts[side]:
    startR=footR(initial)if begin==0 else Matrix.Rotation(math.radians(4),3,'X');endR=footR(final)if end==duration else Matrix.Rotation(math.radians(15+55*vel[min(N,round(end*60))]/V),3,'X')
    if begin==0:anchor=initial.translation+startR@support(startR)
    elif end==duration:anchor=final.translation+endR@support(endR)+Vector((0,-travel[-1],0))
    else:
     v=vel[min(N,round(begin*60))];anchor=Vector((.105 if side=='L'else-.105,-.18-(.21/3.6)*v-travel_at(begin),.003))
    if begin==end:startR=endR
    intervals.append((begin,end,anchor,startR,endR))
   def planted(item,t):
    begin,end,anchor,R0,R1=item;u=max(0,min(1,(t-begin)/max(1e-6,end-begin)));R=R0.to_quaternion().slerp(R1.to_quaternion(),smooth(u)).to_matrix()
    if end==duration:seed=final.translation.copy()+Vector((0,-travel[-1],0));goal=seed+rolling(side,R1,R)
    elif begin==0:goal=initial.translation.copy()+rolling(side,R0,R)
    else:goal=anchor-R0@support(R0)+rolling(side,R0,R)
    floor=.003-min((R@p).z for p in a.boots[side]);gap0=initial.translation.z-(.003-min((footR(initial)@p).z for p in a.boots[side]));gap1=final.translation.z-(.003-min((footR(final)@p).z for p in a.boots[side]));goal.z=floor+(gap0*(1-smooth(t/.10))if begin==0 else 0)+(gap1*smooth((t-duration+.10)/.10)if end==duration else 0);return goal,R
   targets=[]
   for i in range(N+1):
    t=i/60;hit=next((item for item in intervals if item[0]-1e-6<=t<=item[1]+1e-6),None)
    if hit:goal,R=planted(hit,t)
    else:
     prev=next((item for item in reversed(intervals)if item[1]<t),None);nxt=next((item for item in intervals if item[0]>t),None)
     if prev:g0,R0=planted(prev,prev[1]);t0=prev[1]
     else:g0=initial.translation.copy();R0=footR(initial);t0=0
     if nxt:g1,R1=planted(nxt,nxt[0]);t1=nxt[0]
     else:g1=final.translation.copy()+Vector((0,-travel[-1],0));R1=footR(final);t1=duration
     u=max(0,min(1,(t-t0)/(t1-t0)));k=smooth(u);goal=g0.lerp(g1,k);R=R0.to_quaternion().slerp(R1.to_quaternion(),k).to_matrix()
     # Early heel recovery; by mid/late swing the ankle is already lowering.
     arch=curve(u,[(0,0,1.5),(.28,.29,0),(.60,.16,-.6),(1,0,-.2)])
     goal.z+=max(0,arch)
    goal.y+=travel[i];targets.append((goal,R))
   planned[side]=targets
  trans=[];clamp=0
  for i in range(N+1):
   for n,M in target_poses[i].items():r.pose.bones[n].matrix_basis=M
   a.update();drop=0
   for side in ['L','R']:
    goal,R=planned[side][i];hip=r.pose.bones['upperleg01.'+side].head;length=(a.rest['lowerleg01.'+side].translation-a.rest['upperleg01.'+side].translation).length+(a.rest['foot.'+side].translation-a.rest['lowerleg01.'+side].translation).length;horizontal=(hip.x-goal.x)**2+(hip.y-goal.y)**2
    assert horizontal<(length-.003)**2,('TRANSITION_HORIZONTAL',name,side,i,horizontal)
    maxz=goal.z+math.sqrt((length-.003)**2-horizontal);drop=min(drop,maxz-hip.z)
   if drop<0:
    root=r.pose.bones['root'];M=root.matrix.copy();M.translation.z+=drop;root.matrix=M;a.update();clamp+=1
   rootdrops.append(drop)
   for side in ['L','R']:
    goal,R=planned[side][i];goal=goal.copy();planted=any(begin-1e-6<=i/60<=end+1e-6 for begin,end in contacts[side])
    if not planted and i not in [0,N]:
     # The free foot follows the shin with an anatomical ankle angle. Lifting
     # the toe-clearance target is permitted in swing; planted points stay locked.
     for _ in range(4):
      shin=shin_angle(side,goal);theta=math.degrees(math.atan2(R[2][1],R[1][1]));relative=max(-20,min(25,theta-shin));R=Matrix.Rotation(math.radians(shin+relative),3,'X');floor=.003-min((R@p).z for p in a.boots[side]);goal.z=max(goal.z,floor)
    a.chain(side,goal,R)
   a.update();trans.append((i/2,{n:r.pose.bones[n].matrix_basis.copy()for n in allnames}))
  samples=[{'time':i/60,'distance_m':travel[i],'speed_mps':vel[i]}for i in range(N+1)]
  for layer,bones in [('Lower',lower),('Upper',upper)]:record('SR_'+name+'_'+layer,duration,layer.lower(),False,bones,trans,{'travel_samples_m':samples,'sample_rate':60,'entry':fromkind,'exit':tokind,'entry_speed_mps':v0,'exit_speed_mps':v1,'exit_phase':0,'phase_sync_lower':'SR_'+name+'_Lower'}if layer=='Upper'else{'travel_samples_m':samples,'sample_rate':60,'exit_speed_mps':v1,'entry':fromkind,'exit':tokind,'exit_phase':0})
  transition_reports.append({'name':name,'duration':duration,'distance_m':travel[-1],'contacts_seconds':contacts,'root_reach_adjusted_frames':clamp,'max_root_reach_drop_m':abs(min(rootdrops))})
 assert all(fingerprint(bpy.data.actions[n])==h for n,h in originals.items()),'Prior Action changed'
 scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=0;scene.frame_end=80
 for name in ['SR_Sprint_Lower','SR_Sprint_Upper']:
  tr=r.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,new[name]);st.action_frame_start=0;st.action_frame_end=20;st.repeat=4
 pose(r,'SR_Sprint_Lower','SR_Sprint_Upper',0)
 for tr in r.animation_data.nla_tracks:tr.mute=False
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source'/f'{faction}_SprintReview.blend'),compress=True)
 # Export all preserved actions plus the new disjoint masks.
 for ob in [r,mag,spare]:
  ob.animation_data.action=None
  for tr in list(ob.animation_data.nla_tracks):ob.animation_data.nla_tracks.remove(tr)
 scene.render.fps=120
 for ac in bpy.data.actions:
  for fc in ac.fcurves:
   for k in fc.keyframe_points:k.co.x*=4;k.handle_left.x*=4;k.handle_right.x*=4
 for name,item in meta.items():
  if name not in new:continue
  tr=r.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,bpy.data.actions[name]);st.action_frame_start=0;st.action_frame_end=item['duration']*120;tr.mute=True
  for obname,acname in item.get('object_actions',{}).items():
   ob=bpy.data.objects[obname];tr=ob.animation_data.nla_tracks.new();tr.name=name;tr.strips.new(name,0,bpy.data.actions[acname]);tr.mute=True
 bpy.ops.object.select_all(action='DESELECT')
 for ob in [r,ch,w,mag,spare,*[o for o in w.children if o.type=='EMPTY']]:ob.select_set(True)
 bpy.context.view_layer.objects.active=r
 for ob in [ch,w,mag,spare]:
  ob.data=ob.data.copy();bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
 path=ROOT/'models'/f'{faction}_SprintReview.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=True,export_skins=True,export_tangents=True,export_extras=True)
 j,bin=parse_glb(path)
 for anim in j['animations']:
  allowed=set(meta[anim['name']]['bones']);anim['channels']=[c for c in anim['channels']if j['nodes'][c['target']['node']]['name']in allowed or j['nodes'][c['target']['node']]['name']in ['Magazine','SpareMagazine']];used=sorted({c['sampler']for c in anim['channels']});mp={old:i for i,old in enumerate(used)};anim['samplers']=[anim['samplers'][k]for k in used]
  for c in anim['channels']:
   c['sampler']=mp[c['sampler']]
   if c['target']['path']=='scale'and j['nodes'][c['target']['node']]['name']in ['Magazine','SpareMagazine']:anim['samplers'][c['sampler']]['interpolation']='STEP'
 for idx,node in enumerate(j['nodes']):
  if 'skin'in node:
   for parent in j['nodes']:
    if idx in parent.get('children',[]):parent['children'].remove(idx)
   for sc in j['scenes']:
    if idx not in sc['nodes']:sc['nodes'].append(idx)
 # Append only new animation accessors to the validated prior GLB. Preserve
 # all original meshes, textures, nodes, skins and 34 old clips byte-for-byte.
 base,oldbin=parse_glb(OLD/'models'/f'{faction}_FullBody.glb');merged=bytearray(oldbin);accessors={};views={};nodeids={n['name']:i for i,n in enumerate(base['nodes'])if'name'in n}
 def accessor(index):
  if index in accessors:return accessors[index]
  ac=dict(j['accessors'][index]);vi=ac['bufferView']
  if vi not in views:
   view=dict(j['bufferViews'][vi]);start=view.get('byteOffset',0);merged.extend(b'\0'*((-len(merged))%4));view['byteOffset']=len(merged);view['buffer']=0;merged.extend(bin[start:start+view['byteLength']]);views[vi]=len(base['bufferViews']);base['bufferViews'].append(view)
  ac['bufferView']=views[vi];accessors[index]=len(base['accessors']);base['accessors'].append(ac);return accessors[index]
 for anim in j['animations']:
  for sampler in anim['samplers']:sampler['input']=accessor(sampler['input']);sampler['output']=accessor(sampler['output'])
  for channel in anim['channels']:channel['target']['node']=nodeids[j['nodes'][channel['target']['node']]['name']]
  base['animations'].append(anim)
 base['buffers'][0]['byteLength']=len(merged);base.setdefault('extras',{})['motion_revision']='sprint-review-2';write_glb(path,base,bytes(merged))
 report={'faction':faction,'bones':len(r.data.bones),'all_export_actions':meta,'new_actions':list(new),'preserved_action_fingerprints':originals,'max_grip_error_m':max(maxgrip),'max_leg_target_error_m':max(maxleg),'duration':D,'speed_mps':V,'cadence_steps_min':180,'stride_m':V*D,'contact_duty':DUTY,'transition_plan':transition_reports,'default_sprint_replaced':False};(ROOT/'diagnostics'/f'{faction}-authored.json').write_text(json.dumps(report,indent=2));print('SPRINT_AUTHORED',faction,report['max_grip_error_m'],report['transition_plan'],flush=True)
if __name__=='__main__':author(os.environ.get('AW_FACTION','USMC'))
