"""Author coordinated, phase-matched full-body layers on copies of the 163-bone rigs."""
import bpy,sys,math,json,os,hashlib,bmesh
from pathlib import Path
from mathutils import Matrix,Vector,Euler,Quaternion
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT.parent/'infantry-animation';OLD=ROOT.parent/'tactical-reload';sys.path.insert(0,str(BASE/'tools'))
from author_motion import Author
from animation_io import pose,apply_action,parse_glb,write_glb
FPS=30;TAU=math.tau

def ease(x):x=max(0,min(1,x));return x*x*x*(x*(x*6-15)+10)
def span(t,a,b):return ease((t-a)/(b-a))
def fingerprint(ac):return hashlib.sha256(json.dumps([(f.data_path,f.array_index,[(list(k.co),k.interpolation)for k in f.keyframe_points])for f in ac.fcurves],sort_keys=True).encode()).hexdigest()
def author(faction):
 russian=faction=='Russian';bpy.ops.wm.open_mainfile(filepath=str(OLD/'source'/f'{faction}_TacticalReload.blend'));rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];weapon=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine'];spare=bpy.data.objects['SpareMagazine'];scene=bpy.context.scene
 originals={a.name:fingerprint(a)for a in bpy.data.actions};oldmeta=json.loads((BASE/'validation'/f'{faction}-authoring.json').read_text())['actions'];reloadmeta=json.loads((OLD/'validation'/f'{faction}-authoring.json').read_text());info=dict(oldmeta);info.update(reloadmeta['new_actions']);info['Reload_Tactical']['object_actions']={'Magazine':'Reload_Tactical_Magazine','SpareMagazine':'Reload_Tactical_SpareMagazine'}
 for ob in [rig,mag,spare]:
  ob.animation_data.action=None
  for tr in list(ob.animation_data.nla_tracks):ob.animation_data.nla_tracks.remove(tr)
 a=Author.__new__(Author);a.rig=rig;a.char=char;a.weapon=weapon;a.mag=mag;a.russian=russian;a.faction=faction;a.rest={b.name:b.matrix_local.copy()for b in rig.data.bones};a.bones=rig.pose.bones;a.lower=oldmeta['Lower_Walk']['bones'];a.upper=oldmeta['Upper_Aim']['bones'];a.previous={};a.errors=[];a.boots={}
 for side in ['L','R']:
  group=char.vertex_groups['foot.'+side].index;a.boots[side]=[v.co.copy()-rig.data.bones['foot.'+side].head_local for v in char.data.vertices if v.co.z<.25 and any(g.group==group and g.weight>.99 for g in v.groups)]
 pose(rig,'Lower_AimStance','Upper_Aim',0);aimR=weapon.matrix_world.to_quaternion();headAim=rig.pose.bones['head'].matrix.to_quaternion();C=rig.pose.bones['wrist.R'].matrix.inverted()@rig.matrix_world.inverted()@weapon.matrix_world;pose(rig,'Lower_Idle','Upper_LowReady',0);headLow=rig.pose.bones['head'].matrix.to_quaternion();actions={};maxErrors=[];footErrors=[];phaseMeta={}
 def new(name,duration,layer,loop=True,bones=None):
  ac=bpy.data.actions.new(name);ac.use_fake_user=True;actions[name]=ac;info[name]={'duration':duration,'layer':layer,'loop':loop,'bones':bones or(a.lower if layer=='lower'else a.upper),'speed_mps':0};return ac
 def keys(ac,names,frame):
  rig.animation_data.action=ac
  for name in names:
   b=rig.pose.bones[name];b.keyframe_insert('location',frame=frame,group=name);b.keyframe_insert('rotation_quaternion',frame=frame,group=name)
  rig.animation_data.action=None
 def solve(side,M,pole):
  h=rig.pose.bones['upperarm01.'+side].head.copy();h0=rig.data.bones['upperarm01.'+side].head_local;k0=rig.data.bones['lowerarm01.'+side].head_local;e0=rig.data.bones['wrist.'+side].head_local;l1=(k0-h0).length;l2=(e0-k0).length;v=M.translation-h;d=v.length
  assert abs(l1-l2)+.001<d<l1+l2-.0001,('Arm unreachable',faction,kind,i,side,d,l1+l2,list(M.translation))
  axis=v/d;x=(l1*l1-l2*l2+d*d)/(2*d);height=math.sqrt(max(0,l1*l1-x*x));p=Vector(pole)-(h+axis*x);p=(p-axis*p.dot(axis)).normalized();knee=h+axis*x+p*height
  a.rigid('upperarm01.'+side,(k0-h0).rotation_difference(knee-h).to_matrix(),h0,h);a.rigid('lowerarm01.'+side,(e0-k0).rotation_difference(M.translation-knee).to_matrix(),k0,knee);rig.pose.bones['wrist.'+side].matrix=M;a.update();maxErrors.append((rig.pose.bones['wrist.'+side].head-M.translation).length)
 def body_root(extra_pitch,dx,dz,pelvis_yaw,feet):
  root=rig.pose.bones['root'];m=root.matrix.copy();center=m.translation.copy();root.matrix=Matrix.Translation(center+Vector((dx,0,dz)))@Matrix.Rotation(extra_pitch,4,'X')@Matrix.Translation(-center)@m;a.update()
  for side in ['L','R']:a.rot('pelvis.'+side,(0,0,pelvis_yaw))
  for side,M in feet.items():a.chain(side,M.translation.copy(),(M@a.rest['foot.'+side].inverted()).to_3x3());footErrors.append((rig.pose.bones['foot.'+side].head-M.translation).length)
 def rot(n,x=0,y=0,z=0):a.rot(n,tuple(math.radians(v)for v in(x,y,z)))
 for kind,D,lo,up in [('Walk',1.2,'Lower_Walk','Upper_LowReady'),('Sprint',.8,'Lower_Sprint','Upper_Sprint'),('AimWalk',1.2,'Lower_AimWalk','Upper_Aim'),('AimIdle',2.4,'Lower_AimStance','Upper_Aim'),('LowReady',2.4,'Lower_Idle','Upper_LowReady')]:
  moving=kind in ['Walk','Sprint','AimWalk'];aim=kind in ['AimWalk','AimIdle'];sprint=kind=='Sprint';lower=new('FB_'+kind+'_Lower',D,'lower')if moving else None;upper=new('FB_'+kind+'_Upper',D,'upper');info[upper.name]['phase_sync_lower']=lower.name if lower else None
  if lower:info[lower.name]['speed_mps']={'Walk':1.05,'Sprint':3,'AimWalk':.62}[kind]
  for i in range(round(D*FPS)+1):
   t=i/FPS;p=TAU*t/D;s=math.sin(p);c=math.cos(p);s2=math.sin(2*p);c2=math.cos(2*p);pose(rig,None,None,0);apply_action(rig,bpy.data.actions[lo],t);apply_action(rig,bpy.data.actions[up],t);a.update();W0=weapon.matrix_world.copy();LC=W0.inverted()@rig.pose.bones['wrist.L'].matrix;chest0=rig.pose.bones['spine01'].matrix.copy();feet={side:rig.pose.bones['foot.'+side].matrix.copy()for side in ['L','R']}
   if moving:
    pitch=math.radians(9+1.6*c2)if sprint else math.radians(1.2)if aim else math.radians(.5*c2)
    body_root(pitch,(-.008*s if kind=='Walk'else .003*s),(-.035 if aim else .004*c2 if sprint else .010+.003*c2),math.radians((6.5 if sprint else 2 if aim else 3.8)*s),feet)
    if sprint:
     rot('spine05',2+.8*c2,.3*s,-2.2*s);rot('spine04',.7*c2,.35*s,-1.8*s);rot('spine03',1.0*s2,.6*s,-2.1*s);rot('spine02',.8*s2,.4*s,-1.1*s);rot('spine01',.6*s2,.4*s,-.7*s)
    elif aim:
     rot('spine05',.7+.35*c2,.15*s,-.65*s);rot('spine04',.4+.25*c2,.15*s,-.5*s);rot('spine03',.35*s2,.2*s,-.6*s);rot('spine02',.4*s2,.2*s,-.4*s);rot('spine01',.35*s2,.15*s,-.3*s)
    else:
     rot('spine05',.4*c2,.25*s,-1.2*s);rot('spine04',.5*c2,.3*s,-1*s);rot('spine03',.55*s2,.4*s,-1.4*s);rot('spine02',.5*s2,.3*s,-.8*s);rot('spine01',.5*s2,.25*s,-.5*s)
    amp=1.2 if sprint else .8 if not aim else .55
    for side,sign in [('L',1),('R',-1)]:rot('clavicle.'+side,.45*s2,sign*amp*s,sign*.65*s);rot('shoulder01.'+side,.35*s2,sign*.45*s,sign*.35*s)
    rot('neck01',(-6.5 if sprint else -.8 if aim else 0)+.4*c2,.2*s,(2.2 if sprint else 1.0)*s)
   else:
    rot('spine04',.35*s,0,.25*s);rot('spine03',.4*s,0,.3*s);rot('spine02',.4*s,0,.2*s);rot('spine01',.35*s,0,.2*s)
    for side,sign in [('L',1),('R',-1)]:rot('clavicle.'+side,.25*s,sign*.3*s,sign*.2*s)
   delta=rig.pose.bones['spine01'].matrix@chest0.inverted();follow=delta@W0
   if aim:
    R=Euler((math.radians(.35*s2),0,math.radians(.45*s)),'XYZ').to_quaternion()@aimR;anchor=follow@Vector((0,.346,.03)if russian else(0,.338,.063));stock=Vector((0,.346,.03)if russian else(0,.338,.063));W=Matrix.Translation(anchor-R@stock)@R.to_matrix().to_4x4()
   else:
    R=follow.to_quaternion();W=Matrix.Translation(follow.translation+Vector((0,.015 if sprint else 0,.018 if sprint else 0)))@R.to_matrix().to_4x4()
   solve('R',W@C.inverted(),(-.38,.05+.012*s,1.12+.015*c2));solve('L',W@LC,(.37,-.16+.015*s,1.14+.012*c2))
   if moving:
    head=rig.pose.bones['head'];qbase=headAim if aim else headLow;q=Euler((math.radians((4 if sprint else 0)+.4*c2),0,math.radians(.4*s)),'XYZ').to_quaternion()@qbase;head.matrix=Matrix.Translation(head.head)@q.to_matrix().to_4x4();a.update()
   if lower:keys(lower,a.lower,i)
   keys(upper,a.upper,i)
 # Recoil is an authored upper-spine/chest impulse; both gripping arms inherit
 # the same cluster transform, so additive recoil cannot pull a hand off the gun.
 kind='Recoil';recoilBones=['spine02','spine01','neck01','head'];shot=new('FB_Recoil_Shot',.2,'recoil',False,recoilBones)
 for i,kick in enumerate([0,1,.45,.14,.025,0,0]):
  pose(rig,'Lower_AimStance','FB_AimIdle_Upper',0);rot('spine02',-1.0*kick);rot('spine01',-.7*kick);rot('neck01',.35*kick);rot('head',.25*kick);keys(shot,recoilBones,i)
 # Preserve the previous full rifle/magazine trajectory while articulating the
 # lower back, chest and shoulder girdle. Both hands retain the exact IK targets.
 pose(rig,'Lower_AimStance','FB_AimIdle_Upper',0);firing_reference={b.name:b.matrix_basis.copy()for b in rig.pose.bones}
 kind='Reload';D=3.7 if not russian else 4.1;lower=new('FB_Reload_Lower',D,'lower',False);upper=new('FB_Reload_Upper',D,'upper',False);info[upper.name]['object_actions']={'Magazine':'Reload_Tactical_Magazine','SpareMagazine':'Reload_Tactical_SpareMagazine'}
 for i in range(round(D*FPS)+1):
  t=i/FPS;u=t*3.7/D;pose(rig,'Reload_Tactical_Lower','Reload_Tactical',t);a.update();hands={s:rig.pose.bones['wrist.'+s].matrix.copy()for s in ['L','R']};feet={s:rig.pose.bones['foot.'+s].matrix.copy()for s in ['L','R']};initial={b.name:b.matrix_basis.copy()for b in rig.pose.bones};env=span(u,.08,.55)*(1-span(u,2.85,3.4));reach=span(u,1.05,1.4)*(1-span(u,1.93,2.25));align=span(u,1.96,2.2)*(1-span(u,2.68,2.9))
  body_root(0,.003*reach,-.004*env,math.radians(2.1*env+1.8*reach),feet);rot('spine05',1.2*env+.7*reach,0,-1.5*reach);rot('spine04',.8*env,.25*reach,-1.0*env);rot('spine01',1.2*env+.9*reach-.5*align,.4*reach,1.5*reach-1.0*align)
  for side,sign in [('L',1),('R',-1)]:rot('shoulder01.'+side,.5*align,sign*.9*reach,sign*.8*env)
  solve('R',hands['R'],Vector((-.38,.05,1.135)).lerp(Vector((-.36,.035,1.16)),env));solve('L',hands['L'],Vector((.37,-.16,1.152)).lerp(Vector((.36,-.10,1.12)),env))
  if i in [0,round(D*FPS)]:
   for b in rig.pose.bones:b.matrix_basis=firing_reference[b.name]
  a.update();keys(lower,a.lower,i);keys(upper,a.upper,i)
 # Give Blender an honest NLA demonstration of synchronized walk layers.
 for ac in actions.values():
  for fc in ac.fcurves:
   prev=None
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  # Quaternion signs are normalized together below for shortest interpolation.
  groups={}
  for fc in ac.fcurves:
   if fc.data_path.endswith('rotation_quaternion'):groups.setdefault(fc.data_path,{})[fc.array_index]=fc
  for rows in groups.values():
   prev=None
   for index in range(len(rows[0].keyframe_points)):
    q=Quaternion([rows[j].keyframe_points[index].co.y for j in range(4)]).normalized()
    if prev and q.dot(prev)<0:q=-q
    for j in range(4):rows[j].keyframe_points[index].co.y=q[j]
    prev=q
 pose(rig,'FB_Walk_Lower','FB_Walk_Upper',0)
 for name in ['FB_Walk_Lower','FB_Walk_Upper']:
  tr=rig.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,actions[name]);st.action_frame_start=0;st.action_frame_end=36;st.repeat=4;st.blend_type='REPLACE'
 scene.render.fps=30;scene.frame_start=0;scene.frame_end=144;scene.frame_set(0);bpy.ops.file.pack_all()
 assert all(fingerprint(bpy.data.actions[n])==h for n,h in originals.items()),'Original Actions mutated'
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source'/f'{faction}_FullBody.blend'),compress=True)
 # Export copied meshes and all original/new reusable clips, pruning identity
 # channels outside their explicit masks before any browser mixer sees them.
 for ob in [rig,mag,spare]:
  ob.animation_data.action=None
  for tr in list(ob.animation_data.nla_tracks):ob.animation_data.nla_tracks.remove(tr)
 for name,item in info.items():
  tr=rig.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,bpy.data.actions[name]);st.action_frame_start=0;st.action_frame_end=round(item['duration']*30);tr.mute=True
  for obname,acname in item.get('object_actions',{}).items():
   ob=bpy.data.objects[obname];tr=ob.animation_data.nla_tracks.new();tr.name=name;tr.strips.new(name,0,bpy.data.actions[acname]);tr.mute=True
 bpy.ops.object.select_all(action='DESELECT')
 for ob in [rig,char,weapon,mag,spare,*[o for o in weapon.children if o.type=='EMPTY']]:ob.select_set(True)
 bpy.context.view_layer.objects.active=rig
 for ob in [char,weapon,mag,spare]:
  ob.data=ob.data.copy();bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
 out=ROOT/'models'/f'{faction}_FullBody.glb';bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=True,export_skins=True,export_tangents=True,export_extras=True)
 j,bin=parse_glb(out)
 for anim in j['animations']:
  allowed=set(info[anim['name']]['bones']);anim['channels']=[c for c in anim['channels']if j['nodes'][c['target']['node']]['name']in allowed or j['nodes'][c['target']['node']]['name']in ['Magazine','SpareMagazine']];used=sorted({c['sampler']for c in anim['channels']});mp={old:i for i,old in enumerate(used)};anim['samplers']=[anim['samplers'][k]for k in used]
  for c in anim['channels']:
   c['sampler']=mp[c['sampler']]
   if c['target']['path']=='scale'and j['nodes'][c['target']['node']]['name']in ['Magazine','SpareMagazine']:anim['samplers'][c['sampler']]['interpolation']='STEP'
 for idx,node in enumerate(j['nodes']):
  if 'skin'in node:
   for parent in j['nodes']:
    if idx in parent.get('children',[]):parent['children'].remove(idx)
   for sc in j['scenes']:
    if idx not in sc['nodes']:sc['nodes'].append(idx)
 j.setdefault('extras',{})['motion_revision']='full-body-1';write_glb(out,j,bin)
 report={'faction':faction,'bones':len(rig.data.bones),'actions':{n:info[n]for n in actions},'all_export_actions':info,'original_action_fingerprints':originals,'max_ik_wrist_error_m':max(maxErrors),'max_foot_target_error_m':max(footErrors),'geometry_or_weights_modified':False,'new_gait_clips_phase_matched':True};(ROOT/'diagnostics'/f'{faction}-authored.json').write_text(json.dumps(report,indent=2)+'\n');print('FULL_BODY_AUTHORED',faction,len(info),max(maxErrors),flush=True)
if __name__=='__main__':author(os.environ.get('AW_FACTION','USMC'))
