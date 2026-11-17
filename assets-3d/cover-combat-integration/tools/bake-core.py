"""Bake explicitly derived cover motions; approved files are read-only inputs."""
import bpy,os,sys,json,math,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'));spec=importlib.util.spec_from_file_location('cover_rig',ROOT/'tools/cover-rig.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
FPS=30;kind=os.environ.get('CV_WEAPON','M16A4');r=mod.CoverRig(kind);bpy.context.scene.render.fps=FPS;specs=[]
for stance in ['Stand','Crouch']:
 for key,style in [('ProtectedCorner','Corner'),('ProtectedLow','Low')]:specs.append({'state':key,'stance':stance,'style':style,'side':1,'phase':'protected','duration':2.4,'loop':True})
 for prefix,style,side in [('Left','Corner',1),('Right','Corner',-1),('Low','Low',1),('BlindOver','BlindOver',1),('BlindLeft','BlindCorner',1),('BlindRight','BlindCorner',-1)]:
  for phase,D in [('Enter',1.2),('Fire',2.4),('Return',1.2)]+([('Aim',2.4)]if not prefix.startswith('Blind')else[]):
   specs.append({'state':prefix+phase,'stance':stance,'style':style,'side':side,'phase':phase.lower(),'duration':D,'loop':phase in ['Aim','Fire']})
results={'weapon':kind,'classification':'Derived project rifle aim/recoil, skeletal cover adaptation and limb constraints; not untouched external cover motion','sourceClips':['Lower_AimStance','FB_AimIdle_Upper','FB_Recoil_Shot'],'fps':FPS,'clips':{},'jointCount':len(r.rig.pose.bones)}
r.rig.animation_data_create();r.weapon.animation_data_create()
for sp in specs:
 name='CV_'+sp['stance']+'_'+sp['state'];a=bpy.data.actions.new(name);wa=bpy.data.actions.new(name+'_Weapon');rows=[];previous={};D=sp['duration'];N=round(D*FPS)
 for i in range(N+1):
  r.rig.animation_data.action=None;r.weapon.animation_data.action=None;t=i/FPS;phase=sp['phase'];u=mod.smooth(t/D)if phase=='enter'else 1-mod.smooth(t/D)if phase=='return'else 0 if phase=='protected'else 1
  row=r.pose(u,sp['side'],sp['stance'],sp['style'],t if sp['loop']else 0,phase=='fire');assert max(row['armReachExcessM'])<.0001,(name,t,row['armReachExcessM']);assert max(row['wristErrorsM'])<.0001,(name,t,row['wristErrorsM'])
  row.update(time=t,wrists={s:list(r.p(s+'Hand'))for s in ['Left','Right']},feet={s:list(r.skinpoint(s))for s in ['Left','Right']},head=list(r.p('Head')),pelvisQ=list(r.q('Hips')),chestQ=list(r.q('Spine2')));rows.append(row)
  r.rig.animation_data.action=a;r.weapon.animation_data.action=wa
  for b in r.rig.pose.bones:
   q=b.rotation_quaternion.normalized()
   if b.name in previous and q.dot(previous[b.name])<0:q.negate()
   b.rotation_quaternion=q;previous[b.name]=q.copy()
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=i,group=b.name)
  r.weapon.rotation_mode='QUATERNION'
  for prop in ['location','rotation_quaternion','scale']:r.weapon.keyframe_insert(prop,frame=i)
 for obj,ac in [(r.rig,a),(r.weapon,wa)]:
  obj.animation_data.action=None
  for fc in ac.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  tr=obj.animation_data.nla_tracks.new();tr.name=name;strip=tr.strips.new(name,0,ac);strip.action_frame_start=0;strip.action_frame_end=N;tr.mute=True
 sp['clip']=name;results['clips'][name]={**sp,'maxWristErrorM':max(max(x['wristErrorsM'])for x in rows),'maxArmReachExcessM':max(max(x['armReachExcessM'])for x in rows),'frames':rows}
 print('BAKED',kind,name,D,'s',flush=True)
 (ROOT/'validation'/f'{kind}-bake-partial.json').write_text(json.dumps(results,indent=2)+'\n')
for b in r.rig.pose.bones:b.matrix_basis=mod.Matrix.Identity(4)
r.weapon.matrix_world=mod.Matrix.Identity(4);r.update();bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=72
bpy.ops.object.select_all(action='DESELECT')
for o in r.objects:o.select_set(True)
bpy.context.view_layer.objects.active=r.rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'models'/f'{kind}_Baked.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=True,export_optimize_animation_keep_anim_object=True,export_skins=True,export_tangents=True,export_extras=True)
(ROOT/'validation'/f'{kind}-bake.json').write_text(json.dumps(results,indent=2)+'\n');print('COVER CORE EXPORTED',kind,len(specs),flush=True)
