"""Quaternius source-driven body retarget with rifle and contact cleanup.

No gait synthesis. Pelvis/spine/head/clavicle transforms come from the acquired
CC0 GLB or preserved project actions. Only arms/hands and legs/feet receive explicit retarget constraints.
The original game, original models and existing actions are read-only inputs.
"""
import bpy,json,math,re,bmesh,os
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1];FPS=240
SOURCE_KIND=os.environ.get('AW_SUIT_SOURCE')
if SOURCE_KIND not in[None,'project-sprint','project-idle']:raise ValueError('Unknown AW_SUIT_SOURCE: '+SOURCE_KIND)
PROJECT_IDLE=SOURCE_KIND=='project-idle'
LEGACY=os.environ.get('AW_SUIT_SOURCE')in['project-sprint','project-idle']
OUT=ROOT.parent/'infantry-animation-integration'if LEGACY else ROOT
ALIASES={'pelvis':'root','spine_01':'spine05','spine_02':'spine03','spine_03':'spine02','neck_01':'neck01','Head':'head'}
for suffix,side in [('l','L'),('r','R')]:
 for key,value in [('clavicle','clavicle'),('upperarm','upperarm01'),('lowerarm','lowerarm01'),('hand','wrist'),('thigh','upperleg01'),('calf','lowerleg01'),('foot','foot'),('ball','toe1-1')]:ALIASES[key+'_'+suffix]=value+'.'+side
 for digit,name in [('thumb',1),('index',2),('middle',3),('ring',4),('pinky',5)]:
  for n in range(1,4):ALIASES[f'{digit}_0{n}_{suffix}']=f'finger{name}-{n}.{side}'
def sn(name):return ALIASES[name]if LEGACY else name
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source/TacticalSuit_Imported.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.name='TacticalSuitRig';anchor=rig
while anchor.parent:anchor=anchor.parent
model_objects={anchor,*anchor.children_recursive};meshes=[o for o in model_objects if o.type=='MESH'];assert len(meshes)==15
for o in list(bpy.data.objects):
 if o not in model_objects:bpy.data.objects.remove(o,do_unlink=True)
with bpy.data.libraries.load(str(ROOT/'source/M16A4_GripReference.blend'),link=False)as(f,t):t.objects=['Weapon','Magazine']
for o in t.objects:
 if o and o.name not in bpy.context.scene.objects:bpy.context.scene.collection.objects.link(o)
weapon=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine'];model_objects.update([weapon,mag]);weapon.parent=None;weapon.matrix_world=Matrix.Identity(4)
refs=json.loads((ROOT/'validation/rifle-reference.json').read_text())['actions']
before=set(bpy.data.objects);beforeA=set(bpy.data.actions);bpy.context.scene.render.fps=30
if LEGACY:
 with bpy.data.libraries.load(str(ROOT.parent/'tactical-combat/source/USMC_Tactical.blend'),link=False)as(f,t):
  t.objects=['InfantryRig'];t.actions=['Lower_Idle','FB_LowReady_Upper']if PROJECT_IDLE else['SR_Sprint_Lower','SR_Sprint_Upper']
 src=t.objects[0];bpy.context.scene.collection.objects.link(src);source_objects={src};source_actions={ac.name:ac for ac in t.actions}
else:
 bpy.ops.import_scene.gltf(filepath=str(ROOT.parent/'open-asset-evaluation/source/UAL1_Standard_RM.glb'))
 source_objects=set(bpy.data.objects)-before;src=next(o for o in source_objects if o.type=='ARMATURE');src.name='QuaterniusSourceRig'
 source_actions={a.name.split('_Armature')[0]:a for a in set(bpy.data.actions)-beforeA}
for o in source_objects:
 o.hide_render=True
 if o.animation_data:
  o.animation_data.action=None
  for tr in o.animation_data.nla_tracks:tr.mute=True
bpy.context.scene.render.fps=FPS
for r in [rig,src]:
 if r.animation_data:
  r.animation_data.action=None
  for tr in r.animation_data.nla_tracks:tr.mute=True
 for b in r.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
tn={re.sub(r'_\d+$','',b.name.replace('mixamorig:','')):b.name for b in rig.pose.bones}
mapping={'Hips':'pelvis','Spine':'spine_01','Spine1':'spine_02','Spine2':'spine_03','Neck':'neck_01','Head':'Head'}
for side,s in [('Left','l'),('Right','r')]:
 mapping.update({side+'Shoulder':'clavicle_'+s,side+'Arm':'upperarm_'+s,side+'ForeArm':'lowerarm_'+s,side+'Hand':'hand_'+s,side+'UpLeg':'thigh_'+s,side+'Leg':'calf_'+s,side+'Foot':'foot_'+s,side+'ToeBase':'ball_'+s})
 for digit,name in [('Thumb','thumb'),('Index','index'),('Middle','middle'),('Ring','ring'),('Pinky','pinky')]:
  for n in range(1,4):mapping[f'{side}Hand{digit}{n}']=f'{name}_0{n}_{s}'
def pt(r,n):return r.matrix_world@r.pose.bones[n].head
def wq(r,n):return(r.matrix_world@r.pose.bones[n].matrix).to_quaternion().normalized()
def update():bpy.context.view_layer.update()
TR={n:{'p':rig.matrix_world@rig.data.bones[name].head_local,'q':(rig.matrix_world@rig.data.bones[name].matrix_local).to_quaternion().normalized()}for n,name in tn.items()}
SR={n:{'p':src.matrix_world@src.data.bones[sn(n)].head_local,'q':(src.matrix_world@src.data.bones[sn(n)].matrix_local).to_quaternion().normalized()}for n in (ALIASES if LEGACY else [b.name for b in src.data.bones])}
def frame(y,z):
 y=y.normalized();z=(z-y*y.dot(z)).normalized();x=y.cross(z).normalized();z=x.cross(y).normalized();return Matrix((x,y,z)).transposed().to_quaternion()
def orient(name,q):
 b=rig.pose.bones[tn[name]];p=b.head.copy();q=rig.matrix_world.to_quaternion().inverted()@q;b.matrix=Matrix.Translation(p)@q.to_matrix().to_4x4();update()
segments={}
for side,s in [('Left','l'),('Right','r')]:
 for a,b,sb in [('Arm','ForeArm','lowerarm_'),('ForeArm','Hand','hand_'),('UpLeg','Leg','calf_'),('Leg','Foot','foot_')]:segments[side+a]=(side+b,sb+s)
forward=Vector((0,-1,0));correction={n:frame(TR[ch]['p']-TR[n]['p'],forward).inverted()@TR[n]['q']for n,(ch,_)in segments.items()}
source_front={n:SR[s]['q'].inverted()@forward for n,s in mapping.items()}
upperLeg=(TR['LeftLeg']['p']-TR['LeftUpLeg']['p']).length;lowerLeg=(TR['LeftFoot']['p']-TR['LeftLeg']['p']).length
sourceLeg=(SR['calf_l']['p']-SR['thigh_l']['p']).length+(SR['foot_l']['p']-SR['calf_l']['p']).length;scale=(upperLeg+lowerLeg)/sourceLeg
def apply_source(action,time):
 for b in src.pose.bones:b.matrix_basis=Matrix.Identity(4)
 for fc in [fc for ac in(action if isinstance(action,list)else[action])for fc in ac.fcurves]:
  try:src.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(time*30)
  except (ValueError,AttributeError,IndexError):pass
 update()
def solve(a,b,c,goal,pole):
 A=pt(rig,tn[a]);l1=(TR[b]['p']-TR[a]['p']).length;l2=(TR[c]['p']-TR[b]['p']).length;delta=goal-A;d=delta.length;direction=delta.normalized();safe=max(abs(l1-l2)+.00001,min(d,l1+l2-.00001));along=(l1*l1-l2*l2+safe*safe)/(2*safe);height=math.sqrt(max(0,l1*l1-along*along));v=pole-A;v=(v-direction*v.dot(direction)).normalized();B=A+direction*along+v*height;C=A+direction*safe
 # Align each actual joint-to-joint direction. No limb stretching or generated gait.
 for n,end in [(a,B),(b,C)]:
  child=b if n==a else c;current=(pt(rig,tn[child])-pt(rig,tn[n])).normalized();desired=(end-pt(rig,tn[n])).normalized();q=current.rotation_difference(desired)@wq(rig,tn[n]);orient(n,q)
 return max(0,d-(l1+l2)),(pt(rig,tn[c])-goal).length
def hand_frame(side):
 p=TR[side+'Hand']['p'];y=(TR[side+'HandMiddle1']['p']-p).normalized();x=TR[side+'HandIndex1']['p']-TR[side+'HandPinky1']['p'];x=(x-y*y.dot(x)).normalized();z=x.cross(y).normalized();return Matrix((y.cross(z),y,z)).transposed().to_quaternion()
hand_corrections={s:hand_frame(s).inverted()@TR[s+'Hand']['q']for s in ['Left','Right']}
finger_corrections={}
for side in ['Left','Right']:
 normal=hand_frame(side)@Vector((0,0,1))
 for digit in ['Thumb','Index','Middle','Ring','Pinky']:
  for j in range(1,4):
   n=f'{side}Hand{digit}{j}';end=TR.get(f'{side}Hand{digit}{j+1}',None)
   direction=end['p']-TR[n]['p']if end else rig.matrix_world.to_3x3()@(rig.data.bones[tn[n]].tail_local-rig.data.bones[tn[n]].head_local)
   finger_corrections[n]=frame(direction,normal).inverted()@TR[n]['q']
foot_verts={s:[]for s in ['Left','Right']}
for mesh in meshes:
 restpoints=[mesh.matrix_world@v.co for v in mesh.data.vertices]
 isBoot=max(p.z for p in restpoints)<.32
 for v,p in zip(mesh.data.vertices,restpoints):
  if not v.groups:continue
  name=mesh.vertex_groups[max(v.groups,key=lambda x:x.weight).group].name
  for side in ['Left','Right']:
   if(isBoot and ((side=='Left'and p.x>=0)or(side=='Right'and p.x<0)))or any(tn[side+k]==name for k in ['Foot','ToeBase','Toe_End']if side+k in tn):foot_verts[side].append((mesh,v.index))
def foot_min(side):
 dg=bpy.context.evaluated_depsgraph_get();by={}
 for o,i in foot_verts[side]:by.setdefault(o,[]).append(i)
 result=100
 for o,indices in by.items():
  e=o.evaluated_get(dg);m=e.to_mesh();result=min(result,min((e.matrix_world@m.vertices[i].co).z for i in indices));e.to_mesh_clear()
 return result
def retarget(time,action,ref,carry_adjust):
 apply_source(action,time)
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 update()
 for n,s in mapping.items():
  if n in segments:
   _,sc=segments[n];q=frame(pt(src,sn(sc))-pt(src,sn(s)),wq(src,sn(s))@source_front[n])@correction[n]
  else:q=wq(src,sn(s))@SR[s]['q'].inverted()@TR[n]['q']
  orient(n,q)
  if n=='Hips':
   b=rig.pose.bones[tn[n]];M=b.matrix.copy();M.translation=rig.matrix_world.inverted()@(TR[n]['p']+(pt(src,sn(s))-SR[s]['p'])*scale);b.matrix=M;update()
 # Source-derived ankle paths keep planted feet in their source trajectory.
 footData=[];footErrors=[];pelvisCleanup=0
 for side,suffix in [('Left','l'),('Right','r')]:
  footData.append({'side':side,'source':suffix,'goal':TR[side+'Foot']['p']+(pt(src,sn('foot_'+suffix))-SR['foot_'+suffix]['p'])*scale,'pole':TR[side+'Leg']['p']+(pt(src,sn('calf_'+suffix))-SR['calf_'+suffix]['p'])*scale,'footQ':wq(rig,tn[side+'Foot']),'toeQ':wq(rig,tn[side+'ToeBase'])})
 def reach_cleanup():
  nonlocal pelvisCleanup
  down=0
  for item in footData:
   side=item['side'];hip=pt(rig,tn[side+'UpLeg']);goal=item['goal'];L=(TR[side+'Leg']['p']-TR[side+'UpLeg']['p']).length+(TR[side+'Foot']['p']-TR[side+'Leg']['p']).length-.001
   horizontal=(Vector((hip.x,hip.y,0))-Vector((goal.x,goal.y,0))).length
   if horizontal<L:down=max(down,hip.z-goal.z-math.sqrt(L*L-horizontal*horizontal))
  if down>0:
   b=rig.pose.bones[tn['Hips']];M=b.matrix.copy();world=rig.matrix_world@M.translation;world.z-=down;M.translation=rig.matrix_world.inverted()@world;b.matrix=M;update();pelvisCleanup+=down
 reach_cleanup()
 for iteration in range(3):
  for item in footData:
   side=item['side'];solve(side+'UpLeg',side+'Leg',side+'Foot',item['goal'],item['pole']);orient(side+'Foot',item['footQ']);orient(side+'ToeBase',item['toeQ'])
  if iteration<2:
   for item in footData:
    side=item['side'];z=foot_min(side);w=max(0,min(1,(.17-pt(src,sn('foot_'+item['source'])).z)/.04));w=w*w*(3-2*w);dz=-z if z<0 else -z*w;item['goal'].z+=dz
   reach_cleanup()
 for item in footData:footErrors.append((pt(rig,tn[item['side']+'Foot'])-item['goal']).length)
 center=(pt(rig,tn['LeftArm'])+pt(rig,tn['RightArm']))/2;deltaQ=wq(rig,tn['Spine2'])@TR['Spine2']['q'].inverted();f=deltaQ@forward;yaw=math.atan2(f.x,-f.y);Y=Quaternion((0,0,1),yaw)
 q=Y@Quaternion(ref['weaponQuaternion']);p=center+Y@(Vector(ref['weaponOffsetFromShoulder'])+carry_adjust);weapon.matrix_world=Matrix.Translation(p)@q.to_matrix().to_4x4();update();errors=[];reach=[]
 for side,label,sign in [('Left','L',1),('Right','R',-1)]:
  data=ref['hands'][label];goal=weapon.matrix_world@Vector(data['wrist']);pole=center+Y@Vector((sign*.40,-.08,-.45));r,e=solve(side+'Arm',side+'ForeArm',side+'Hand',goal,pole);reach.append(r);errors.append(e);hq=q@Quaternion(data['handFrame']);orient(side+'Hand',hq@hand_corrections[side]);normal=hq@Vector((0,0,1))
  for d,digit in enumerate(['Thumb','Index','Middle','Ring','Pinky'],1):
   for j in range(1,4):
    n=f'{side}Hand{digit}{j}';direction=q@Vector(data['fingerDirections'][f'{d}-{j}']);orient(n,frame(direction,normal)@finger_corrections[n])
 return {'gripErrorsM':errors,'reachExcessM':reach,'footTargetErrorsM':footErrors,'pelvisHeightCleanupM':pelvisCleanup,'soleMinZ':[foot_min('Left'),foot_min('Right')],'weaponMinZ':min((weapon.matrix_world@v.co).z for v in weapon.data.vertices),'pelvisWorldQ':list(wq(rig,tn['Hips'])),'chestWorldQ':list(wq(rig,tn['Spine2']))}
results={'model':'Actual DanlyVostok Tactical Suit, not USMC geometry','source':'Existing USMC Lower_Idle + FB_LowReady_Upper'if PROJECT_IDLE else'Existing USMC SR_Sprint pair'if LEGACY else'Quaternius UAL1 Standard RM','sourceFPS':30,'outputFPS':FPS,'legLengthScale':scale,'boneMap':mapping,'actions':{}};rig.animation_data_create();weapon.animation_data_create()
for action,clip,D in ([('walk','Idle',2.4)]if PROJECT_IDLE else[('sprint','SR_Sprint',2/3)]if LEGACY else[('walk','Walk_Loop',4/3),('sprint','Sprint_Loop',2/3)]):
 source=[source_actions['Lower_Idle'],source_actions['FB_LowReady_Upper']]if PROJECT_IDLE else[source_actions['SR_Sprint_Lower'],source_actions['SR_Sprint_Upper']]if LEGACY else source_actions[clip];ref=refs[action];name='SU_Project_Idle_Rifle'if PROJECT_IDLE else'SU_Project_TacticalSprint_Rifle'if LEGACY else'SU_Quaternius_'+('Walk'if action=='walk'else'Sprint')+'_Rifle';a=bpy.data.actions.new(name);wa=bpy.data.actions.new(name+'_Weapon');a.use_fake_user=True;wa.use_fake_user=True;rows=[];previousQ={}
 # Calibrate a fixed carry offset for this rig's shorter forearms. This changes
 # grip placement, never the imported pelvis/spine curves or playback speed.
 adjust=Vector((0,.065,.035))
 for i in range(round(D*FPS)+1):
  t=i/FPS;rig.animation_data.action=None;weapon.animation_data.action=None;row=retarget(t,source,ref,adjust);row['time']=t;rows.append(row);rig.animation_data.action=a;weapon.animation_data.action=wa
  for b in rig.pose.bones:
   q=b.rotation_quaternion.normalized()
   if b.name in previousQ and q.dot(previousQ[b.name])<0:q.negate()
   b.rotation_quaternion=q;previousQ[b.name]=q.copy()
   b.keyframe_insert('location',frame=i,group=b.name);b.keyframe_insert('rotation_quaternion',frame=i,group=b.name);b.keyframe_insert('scale',frame=i,group=b.name)
  weapon.rotation_mode='QUATERNION'
  for prop in ['location','rotation_quaternion','scale']:weapon.keyframe_insert(prop,frame=i)
  rig.animation_data.action=None;weapon.animation_data.action=None
 for ac in [a,wa]:
  for fc in ac.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
 for obj,ac in [(rig,a),(weapon,wa)]:
  tr=obj.animation_data.nla_tracks.new();tr.name=name;strip=tr.strips.new(name,0,ac);strip.action_frame_start=0;strip.action_frame_end=round(D*FPS);tr.mute=True
 results['actions'][action]={'clip':name,'sourceClip':clip,'duration':D,'carryAdjustmentM':list(adjust),'maxWristErrorM':max(max(r['gripErrorsM'])for r in rows),'maxArmReachExcessM':max(max(r['reachExcessM'])for r in rows),'maxFootTargetErrorM':max(max(r['footTargetErrorsM'])for r in rows),'minimumWeaponZ':min(r['weaponMinZ']for r in rows),'frames':rows}
 print('RETARGETED SUIT',action,{k:v for k,v in results['actions'][action].items()if k!='frames'},flush=True)
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
weapon.matrix_world=Matrix.Identity(4);update();bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=round(4/3*FPS)
if not LEGACY:bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/TacticalSuit_Retargeted.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for o in model_objects:o.select_set(True)
bpy.context.view_layer.objects.active=rig
for o in [weapon,mag]:
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
bpy.ops.export_scene.gltf(filepath=str(OUT/'models/TacticalSuit_ProjectIdle.glb'if PROJECT_IDLE else OUT/'models/TacticalSuit_ProjectSprint.glb'if LEGACY else ROOT/'models/TacticalSuit_Quaternius_Rifle.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=True,export_skins=True,export_tangents=True,export_extras=True)
(OUT/'validation/project-idle-retarget.json'if PROJECT_IDLE else OUT/'validation/project-sprint-retarget.json'if LEGACY else ROOT/'validation/retarget-grips.json').write_text(json.dumps(results,indent=2)+'\n')
