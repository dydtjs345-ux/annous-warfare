"""Author contact-constrained tactical reloads as sampled Blender Actions.
The existing rig, skin, weapon mount and original Actions are loaded read-only;
all deliverables are written to tactical-reload/. No runtime procedural animation.
"""
import bpy,sys,math,json,hashlib,os,bmesh
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion,Euler
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT.parent/'infantry-animation';sys.path.insert(0,str(BASE/'tools'))
from author_motion import Author
from animation_io import pose,parse_glb,write_glb
FPS=30

def ease(x):
 x=max(0,min(1,x));return x*x*x*(x*(x*6-15)+10)
def span(t,a,b):return ease((t-a)/(b-a))
def interp(A,B,u,arc=None):
 p=A.translation.lerp(B.translation,u)
 if arc:p+=Vector(arc)*(4*u*(1-u))
 return Matrix.Translation(p)@A.to_quaternion().slerp(B.to_quaternion(),u).to_matrix().to_4x4()
def fingerprint(action):
 return hashlib.sha256(json.dumps([(f.data_path,f.array_index,[(list(k.co),k.interpolation)for k in f.keyframe_points])for f in action.fcurves],sort_keys=True).encode()).hexdigest()
def matlist(m):return [list(row)for row in m]

def author(faction):
 russian=faction=='Russian';D=4.1 if russian else 3.7;ratio=D/3.7
 bpy.ops.wm.open_mainfile(filepath=str(BASE/'source'/f'{faction}_Animation.blend'))
 original={x.name:fingerprint(x)for x in bpy.data.actions};rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];weapon=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine'];spare=bpy.data.objects['SpareMagazine']
 for ob in [rig,mag,spare]:
  if ob.animation_data:
   ob.animation_data.action=None
   for track in list(ob.animation_data.nla_tracks):ob.animation_data.nla_tracks.remove(track)
 pose(rig,'Lower_AimStance','Upper_Aim',0)
 a=Author.__new__(Author);a.rig=rig;a.char=char;a.weapon=weapon;a.mag=mag;a.faction=faction;a.russian=russian;a.bones=rig.pose.bones;a.rest={b.name:b.matrix_local.copy()for b in rig.data.bones};a.errors=[];a.previous={}
 meta=json.loads((BASE/'validation'/f'{faction}-authoring.json').read_text());a.lower=meta['actions']['Lower_AimStance']['bones'];a.upper=meta['actions']['Reload']['bones']
 initial={p.name:p.matrix_basis.copy()for p in rig.pose.bones};W0=weapon.matrix_world.copy();C=rig.pose.bones['wrist.R'].matrix.inverted()@rig.matrix_world.inverted()@W0;LC=W0.inverted()@rig.matrix_world@rig.pose.bones['wrist.L'].matrix
 rest_elbows={s:rig.pose.bones['lowerarm01.'+s].head.copy()for s in ['L','R']};feet={s:rig.pose.bones['foot.'+s].matrix.copy()for s in ['L','R']};root0=rig.pose.bones['root'].matrix.copy();lowerbase={n:rig.pose.bones[n].matrix_basis.copy()for n in a.lower}
 # Preserve trigger-hand grip exactly through the existing wrist.R weapon mount.
 def solve(side,M,hint):
  goal=M.translation;hip=rig.pose.bones['upperarm01.'+side].head.copy();h0=rig.data.bones['upperarm01.'+side].head_local;k0=rig.data.bones['lowerarm01.'+side].head_local;e0=rig.data.bones['wrist.'+side].head_local
  l1=(k0-h0).length;l2=(e0-k0).length;v=goal-hip;d=v.length
  assert abs(l1-l2)+.001<d<l1+l2-.0003,('Arm unreachable',faction,side,'phase',u,d,l1+l2,list(goal))
  axis=v/d;x=(l1*l1-l2*l2+d*d)/(2*d);h=math.sqrt(max(0,l1*l1-x*x));pole=Vector(hint)-(hip+axis*x);pole=(pole-axis*pole.dot(axis)).normalized();knee=hip+axis*x+pole*h
  a.rigid('upperarm01.'+side,(k0-h0).rotation_difference(knee-hip).to_matrix(),h0,hip);a.rigid('lowerarm01.'+side,(e0-k0).rotation_difference(goal-knee).to_matrix(),k0,knee);rig.pose.bones['wrist.'+side].matrix=M;a.update()
  return (rig.pose.bones['wrist.'+side].head-goal).length
 contact=Vector((.023,-.12,-.075));pouchOld=Vector((.065,-.285,1.12));pouchNew=Vector((-.055,-.330,1.12))
 def palm_matrix(magWorld):
  wrist,anchor,frame=a.hand_frame('L');R=magWorld.to_3x3();f=(R@Vector((0,-.20,-1))).normalized();n=(R@Vector((-1,0,.1))).normalized();n=(n-f*n.dot(f)).normalized();thumb=n.cross(f);desired=Matrix((thumb,f,thumb.cross(f))).transposed();rot=desired@frame.transposed();goal=magWorld@contact-rot@(anchor-wrist)
  return Matrix.Translation(goal)@rot.to_4x4()@a.rest['wrist.L'].to_3x3().to_4x4()
 def pouch_matrix(point):return Matrix.Translation(point)@Euler((0,-.06,-.16),'XYZ').to_matrix().to_4x4()@Matrix.Translation(-contact)
 oldP=pouch_matrix(pouchOld);newP=pouch_matrix(pouchNew);oldHidden=oldP.copy();oldHidden.translation.y+=.22;oldHidden.translation.z-=.055;newHidden=newP.copy();newHidden.translation.y+=.33;newHidden.translation.z-=.055
 upper=bpy.data.actions.new('Reload_Tactical');lower=bpy.data.actions.new('Reload_Tactical_Lower');oldAction=bpy.data.actions.new('Reload_Tactical_Magazine');newAction=bpy.data.actions.new('Reload_Tactical_SpareMagazine')
 for ac in [upper,lower,oldAction,newAction]:ac.use_fake_user=True
 rig.animation_data.action=upper;mag.animation_data_create();spare.animation_data_create();mag.animation_data.action=oldAction;spare.animation_data.action=newAction
 samples=[];previous={};maxerr=0;griplocal=Vector((-.025,.061,-.028)if russian else(-.029,.048,-.036));pivot=Vector((0,-.175,.038));old_hide=1.60;new_show=1.76
 for i in range(round(D*FPS)+1):
  t=i/FPS;u=t/ratio
  for p in rig.pose.bones:p.matrix_basis=initial[p.name]
  # Asymmetric, planted weight transfer. Feet are analytically locked in place.
  env=span(u,.05,.5)*(1-span(u,2.85,3.38));work=span(u,.48,.9)*(1-span(u,2.7,3.12));reach=span(u,1.07,1.40)*(1-span(u,2.07,2.35));breath=math.sin(2*math.pi*u/2.4)*work;shift=.014*env-.006*math.sin(math.pi*min(1,u/3.7))*env+.005*reach
  Rroot=Euler((.006*env,.006*env,0),'XYZ').to_matrix();rig.pose.bones['root'].matrix=Matrix.Translation(Vector((shift,0,-.004*env)))@Matrix.Translation(root0.translation)@Rroot.to_4x4()@Matrix.Translation(-root0.translation)@root0;a.update()
  for side in ['L','R']:
   foot=feet[side];a.chain(side,foot.translation.copy(),(foot@a.rest['foot.'+side].inverted()).to_3x3())
  a.rot('spine03',(math.radians(-2.5*env-.5*breath),0,math.radians(5.5*env+2.5*reach)));a.rot('spine02',(math.radians(1.8*env+1.2*reach+.35*breath),math.radians(-1.0*env),math.radians(3*env+.5*breath)))
  a.rot('clavicle.R',(0,math.radians(-2.5*env),math.radians(-2*env)));a.rot('clavicle.L',(0,math.radians(2*env),math.radians(2*env)))
  glance=span(u,.42,.85)*(1-span(u,2.6,3.14));a.rot('neck01',(math.radians(2.5*glance+1.5*reach),0,math.radians(4*glance-2*reach)));a.rot('head',(math.radians(3.5*glance+2.5*reach+.4*breath),math.radians(-2*env),math.radians(3*glance+3.5*reach)))
  # Rifle motion uses a distinct anticipatory lift, canted working position,
  # alignment pause, insertion response, and rapid recovery. The whole rifle moves.
  lift=span(u,.10,.54)*(1-span(u,2.82,3.26));cant=span(u,.16,.62)*(1-span(u,2.78,3.18));settle=.007*math.sin(2*math.pi*(u-.6)/2.2)*env
  pitch=math.radians(-29*lift+1.2*reach);roll=math.radians(-18*cant+.6*breath);yaw=math.radians(18*cant+2*reach)
  R=W0.to_3x3()@Euler((pitch,roll,yaw),'XYZ').to_matrix();g0=W0@griplocal;g=g0+Vector((.075*lift,.050*lift,(.100 if russian else .135)*lift+settle))
  # A short magazine seating impulse transmits to the supporting right arm.
  seating=.006*math.sin(math.pi*max(0,min(1,(u-2.48)/.13))) if 2.48<u<2.61 else 0;g.z+=seating
  W=Matrix.Translation(g-R@griplocal)@R.to_4x4();maxerr=max(maxerr,solve('R',rig.matrix_world.inverted()@W@C.inverted(),rest_elbows['R'].lerp(Vector((-.36,.01,1.17)),env)))
  actual=weapon.matrix_world.copy();werr=(actual.translation-W.translation).length;assert werr<.0001,(faction,'weapon mount error',werr)
  # Old magazine: M16 straight down; AK pivots around its front catch first.
  if russian:
   rocking=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-23)*span(u,.80,1.00),4,'X')@Matrix.Translation(-pivot)
   pulled=W@Matrix.Translation((0,0,-.115*span(u,1.00,1.12)))@rocking
  else:pulled=W@Matrix.Translation((0,0,-.155*span(u,.80,1.08)))
  if u<1.12:old=pulled
  elif u<1.43:old=interp(pulled,oldP,span(u,1.12,1.43),(.025,-.055,.025))
  else:old=interp(oldP,oldHidden,span(u,1.43,old_hide))
  tilt=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-23),4,'X')@Matrix.Translation(-pivot)if russian else Matrix.Identity(4)
  under=W@Matrix.Translation((0,0,-.115))@tilt
  if u<new_show:new=newHidden
  elif u<1.91:new=interp(newHidden,newP,span(u,new_show,1.91))
  elif u<2.19:new=interp(newP,under,span(u,1.91,2.19),(.035,-.06,.05))
  elif u<2.30:new=under # Brief magwell/front-lug alignment pause.
  elif russian:
   if u<2.46:new=W@Matrix.Translation((0,0,-.115*(1-span(u,2.30,2.46))))@tilt
   else:new=W@Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-23)*(1-span(u,2.46,2.64)),4,'X')@Matrix.Translation(-pivot)
  else:new=W@Matrix.Translation((0,0,-.115*(1-span(u,2.30,2.54))))
  # Verify the lock with a small pull; a retained chambered round needs no bolt cycle.
  if 2.65<u<2.78:new=W@Matrix.Translation((0,0,-.006*math.sin(math.pi*(u-2.65)/.13)))
  if u>=2.78:new=W.copy()
  fore=W@LC
  if u<.46:hand=fore
  elif u<.77:hand=interp(fore,palm_matrix(old),span(u,.46,.77),(.045,-.035,.025))
  elif u<1.43:hand=palm_matrix(old)
  elif u<1.60:hand=palm_matrix(oldP)
  elif u<new_show:hand=interp(palm_matrix(oldP),palm_matrix(newP),span(u,1.60,new_show),(0,-.04,.025))
  elif u<1.91:hand=palm_matrix(newP)
  elif u<2.80:hand=palm_matrix(new)
  elif u<3.06:hand=interp(palm_matrix(new),fore,span(u,2.80,3.06),(.04,-.025,.025))
  else:hand=fore
  maxerr=max(maxerr,solve('L',rig.matrix_world.inverted()@hand,rest_elbows['L'].lerp(Vector((.37,-.085,1.11)),env)))
  # Finger opening during reaches, firm cylindrical magazine grip, safe trigger finger.
  grasp=span(u,.62,.78)*(1-span(u,2.80,3.06));finger_open=(span(u,.46,.58)*(1-span(u,.65,.78)))+(span(u,1.43,1.51)*(1-span(u,1.80,1.91)))
  wrist,anchor,frame=a.hand_frame('L');axis=frame.col[1].cross(-frame.col[2]).normalized()
  for digit in range(1,6):
   for segment in range(1,4):
    name=f'finger{digit}-{segment}.L';q0=initial[name].to_quaternion();angle=((.25,.45,.35)if digit==1 else(.82,1.10,.72))[segment-1]
    target=Quaternion(a.rest[name].to_3x3().inverted()@axis,angle*(1-.8*finger_open));rig.pose.bones[name].rotation_quaternion=q0.slerp(target,grasp)
  # Copy original trigger-finger curl at the boundaries; extend along receiver in work phase.
  for segment in range(1,4):
   name=f'finger2-{segment}.R';rig.pose.bones[name].rotation_quaternion=initial[name].to_quaternion().slerp(Quaternion(),.65*env)
  a.update()
  for names,action in [(a.upper,upper),(a.lower,lower)]:
   rig.animation_data.action=action
   for name in names:
    p=rig.pose.bones[name];q=p.rotation_quaternion
    if name in previous and q.dot(previous[name])<0:p.rotation_quaternion=-q
    previous[name]=p.rotation_quaternion.copy();p.keyframe_insert('location',frame=i,group=name);p.keyframe_insert('rotation_quaternion',frame=i,group=name)
  rig.animation_data.action=None;a.update()
  for ob,M,visible in [(mag,old,u<old_hide),(spare,new,u>=new_show)]:
   ob.rotation_mode='QUATERNION';ob.matrix_basis=weapon.matrix_world.inverted()@M;ob.scale=(1,1,1)if visible else(.001,.001,.001)
   for prop in ['location','rotation_quaternion','scale']:ob.keyframe_insert(prop,frame=i,group=ob.name)
  samples.append({'time':t,'phase':u,'weapon_world':matlist(actual),'old_world':matlist(old),'new_world':matlist(new),'old_visible':u<old_hide,'new_visible':u>=new_show,'left_wrist_world':matlist(rig.matrix_world@rig.pose.bones['wrist.L'].matrix),'right_wrist_world':matlist(rig.matrix_world@rig.pose.bones['wrist.R'].matrix),'left_contact':.77<=u<1.43 or 1.91<=u<2.8,'feet':[list(rig.pose.bones['foot.'+side].head)for side in ['L','R']]})
 for action in [upper,lower,oldAction,newAction]:
  for fc in action.fcurves:
   for k in fc.keyframe_points:k.interpolation='CONSTANT'if fc.data_path=='scale'else'LINEAR'
 # Restore exact seated object transforms during the final source pose: old/new
 # geometry is identical, so returning to the canonical mesh causes no visible jump.
 for ob in [rig,mag,spare]:ob.animation_data.action=None
 for name,ac,ob in [('Reload_Tactical',upper,rig),('Reload_Tactical_Lower',lower,rig),('Reload_Tactical',oldAction,mag),('Reload_Tactical',newAction,spare)]:
  tr=ob.animation_data.nla_tracks.new();tr.name=name;strip=tr.strips.new(name,0,ac);strip.action_frame_start=0;strip.action_frame_end=round(D*FPS)
 bpy.context.scene.render.fps=FPS;bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=round(D*FPS);bpy.context.scene.frame_set(0)
 assert all(fingerprint(bpy.data.actions[name])==digest for name,digest in original.items()),'Original Action data changed'
 bpy.ops.file.pack_all()
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source'/f'{faction}_TacticalReload.blend'))
 bpy.ops.object.select_all(action='DESELECT')
 for ob in [rig,char,weapon,mag,spare,*[o for o in weapon.children if o.type=='EMPTY']]:ob.select_set(True)
 bpy.context.view_layer.objects.active=rig
 # Export-only triangulation: the saved source and original meshes are untouched.
 for ob in [char,weapon,mag,spare]:
  ob.data=ob.data.copy();bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
 out=ROOT/'models'/f'{faction}_TacticalReload.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=True,export_skins=True,export_tangents=True,export_extras=True)
 j,binary=parse_glb(out)
 for anim in j['animations']:
  allowed=set(a.lower if anim['name']=='Reload_Tactical_Lower'else a.upper);anim['channels']=[c for c in anim['channels']if j['nodes'][c['target']['node']]['name']in allowed or j['nodes'][c['target']['node']]['name']in ['Magazine','SpareMagazine']]
  used=sorted({c['sampler']for c in anim['channels']});mapping={k:i for i,k in enumerate(used)};anim['samplers']=[anim['samplers'][i]for i in used]
  for c in anim['channels']:
   c['sampler']=mapping[c['sampler']]
   if c['target']['path']=='scale'and j['nodes'][c['target']['node']]['name']in ['Magazine','SpareMagazine']:anim['samplers'][c['sampler']]['interpolation']='STEP'
 # Match the original export's separate skinned-mesh root convention.
 for idx,node in enumerate(j['nodes']):
  if 'skin'in node:
   for parent in j['nodes']:
    if idx in parent.get('children',[]):parent['children'].remove(idx)
   for scene in j['scenes']:
    if idx not in scene['nodes']:scene['nodes'].append(idx)
 write_glb(out,j,binary)
 report={'faction':faction,'duration':D,'fps':FPS,'mechanism':'front-catch rocking'if russian else'straight-in magwell','reload_type':'retention reload with chambered round; no unnecessary charging cycle','original_actions_unchanged':original,'bones':len(rig.data.bones),'max_ik_error_m':maxerr,'samples':samples,'new_actions':{'Reload_Tactical':{'duration':D,'layer':'upper','bones':a.upper},'Reload_Tactical_Lower':{'duration':D,'layer':'lower','bones':a.lower}},'pouch_visibility_times':{'old_hidden':old_hide*ratio,'replacement_visible':new_show*ratio}}
 (ROOT/'validation'/f'{faction}-authoring.json').write_text(json.dumps(report,indent=2)+'\n');print('TACTICAL_RELOAD_AUTHORED',faction,D,flush=True)

if __name__=='__main__':author(os.environ.get('AW_FACTION','USMC'))
