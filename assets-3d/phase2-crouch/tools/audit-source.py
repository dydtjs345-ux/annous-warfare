"""Inspect actual authored source pelvis, torso and foot trajectories."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT.parent/'open-asset-evaluation/source/UAL1_Standard_RM.glb'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(SOURCE));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');actions={}
for o in bpy.data.objects:
 if o.animation_data:
  o.animation_data.action=None
  for tr in o.animation_data.nla_tracks:
   tr.mute=True
   for st in tr.strips:actions[tr.name]=st.action
report={'source':str(SOURCE),'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'fps':30,'clips':{}}
for name,D in [('Crouch_Idle_Loop',88/30),('Crouch_Fwd_Loop',2)]:
 ac=next(a for n,a in actions.items()if n==name or n.startswith(name+'_'));rows=[]
 for i in range(round(D*60)+1):
  t=i/60
  for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
  for fc in ac.fcurves:
   try:rig.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*30)
   except (ValueError,AttributeError,IndexError):pass
  bpy.context.view_layer.update();row={'time':t,'bones':{}}
  for n in ['pelvis','spine_01','spine_02','spine_03','clavicle_l','clavicle_r','foot_l','foot_r','ball_l','ball_r']:
   M=rig.matrix_world@rig.pose.bones[n].matrix;row['bones'][n]={'position':list(M.translation),'quaternion':list(M.to_quaternion().normalized())}
  rows.append(row)
 report['clips'][name]={'duration':D,'frames':rows};print(name,'feet ranges',[(n,min(r['bones'][n]['position'][2]for r in rows),max(r['bones'][n]['position'][2]for r in rows))for n in ['foot_l','foot_r']],'pelvis',rows[0]['bones']['pelvis']['position'],rows[-1]['bones']['pelvis']['position'],flush=True)
(ROOT/'validation/source-motion.json').write_text(json.dumps(report,indent=2)+'\n')
