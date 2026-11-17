import bpy,os,sys,json,importlib.util,bmesh
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('exit_motion',ROOT/'tools/exit-motion.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);kind=os.environ.get('CV_WEAPON','M16A4');r=m.ExitRig(kind);FPS=30;bpy.context.scene.render.fps=FPS;D=r.D;result={'weapon':kind,'fps':FPS,'classification':'Derived existing project Turn_Left/Right + Upper_Turn_Left/Right and approved SU_Quaternius_Walk_Rifle, with contact retarget, settle and braking adaptations','clips':{}};r.rig.animation_data_create();r.weapon.animation_data_create()
for stance in ['Stand','Crouch']:
 for state,style,side in [('Exit','Corner',1),('ExitRight','Corner',-1),('ExitLow','Low',1)]:
  name='CV_'+stance+'_'+state;a=bpy.data.actions.new(name);wa=bpy.data.actions.new(name+'_Weapon');rows=[];previous={}
  for i in range(round(D*FPS)+1):
   r.rig.animation_data.action=None;r.weapon.animation_data.action=None;t=i/FPS;row=r.exitPose(t,stance,style,side);rows.append(row);r.rig.animation_data.action=a;r.weapon.animation_data.action=wa
   for b in r.rig.pose.bones:
    q=b.rotation_quaternion.normalized()
    if b.name in previous and q.dot(previous[b.name])<0:q.negate()
    b.rotation_quaternion=q;previous[b.name]=q.copy()
    for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=i,group=b.name)
   r.weapon.rotation_mode='QUATERNION'
   for prop in ['location','rotation_quaternion','scale']:r.weapon.keyframe_insert(prop,frame=i)
  for o,ac in [(r.rig,a),(r.weapon,wa)]:
   o.animation_data.action=None
   for fc in ac.fcurves:
    for k in fc.keyframe_points:k.interpolation='LINEAR'
   tr=o.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,0,ac);st.action_frame_start=0;st.action_frame_end=round(D*FPS);tr.mute=True
  result['clips'][name]={'state':state,'stance':stance,'style':style,'side':side,'phase':'exit','duration':D,'loop':False,'clip':name,'frames':rows};print('EXIT BAKED',kind,name,flush=True)
for b in r.rig.pose.bones:b.matrix_basis=m.Matrix.Identity(4)
r.weapon.matrix_world=m.Matrix.Identity(4);r.update()
for o in [r.weapon,r.mag]:
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
bpy.ops.object.select_all(action='DESELECT')
for o in r.objects:o.select_set(True)
bpy.context.view_layer.objects.active=r.rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'models'/f'{kind}_Exit_Baked.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_optimize_animation_size=True,export_optimize_animation_keep_anim_armature=True,export_optimize_animation_keep_anim_object=True,export_skins=True,export_tangents=True)
(ROOT/'validation'/f'{kind}-exit-bake.json').write_text(json.dumps(result,indent=2)+'\n');print('EXIT EXPORTED',kind,flush=True)
