"""Isolated glTF reimport compared with the actual source poses, including recoil."""
import bpy,sys,json,gzip,math
from pathlib import Path
from mathutils import Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'));from evaluate import evaluate
source=json.loads(gzip.open(ROOT/'diagnostics/after-source.json.gz','rt').read());report=[]
for faction in ['USMC','Russian']:
 src=next(x for x in source if x['faction']==faction);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/f'{faction}_FullBody.glb'));rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');mag=bpy.data.objects['Magazine'];spare=bpy.data.objects['SpareMagazine'];tracks={t.name:t for t in rig.animation_data.nla_tracks};actions={}
 for name,tr in tracks.items():actions[name]=tr.strips[0].action
 # evaluate.py resolves authored action names. Reimport adds an object suffix;
 # retain a local alias without changing any animation key values.
 for name,action in actions.items():action.name=name
 for ob in [rig,mag,spare]:
  if ob.animation_data:
   for tr in ob.animation_data.nla_tracks:tr.mute=True
 assert len(rig.data.bones)==163;states=[]
 for record in src['states']:
  state=record['state'];samples=record['samples'];D=record['duration'];checks=[];q0={}
  # Action time begins at frame 1 after Blender import. Shift sampled keys once
  # to the same frame-zero convention used by the source evaluation helper.
  for ac in bpy.data.actions:
   if ac.get('diagnostic_shifted'):continue
   if ac.fcurves:
    offset=min(k.co.x for f in ac.fcurves for k in f.keyframe_points)
    for f in ac.fcurves:
     for k in f.keyframe_points:k.co.x-=offset;k.handle_left.x-=offset;k.handle_right.x-=offset
   ac['diagnostic_shifted']=True
  for index in sorted(set([0,len(samples)//8,len(samples)//4,len(samples)//2,3*len(samples)//4,len(samples)-1])):
   s=samples[index];t=s['time'];evaluate(rig,mag,spare,'after',state,t,D);bpy.context.view_layer.update();errors=[]
   rotation_errors=[]
   for name,ref in s['bones'].items():
    errors.append(((rig.matrix_world@rig.pose.bones[name].head)-Vector(ref['p'])).length);q=(rig.matrix_world@rig.pose.bones[name].matrix).to_quaternion()
    if name not in q0:q0[name]=q.copy()
    actual=q@q0[name].inverted();expected=Quaternion(ref['q'])@Quaternion(samples[0]['bones'][name]['q']).inverted();rotation_errors.append(math.degrees(actual.rotation_difference(expected).angle))
   error=max(errors);assert error<.002,(faction,state,t,error);assert max(rotation_errors)<.15,(faction,state,t,'rotation mismatch',max(rotation_errors));checks.append({'time':t,'max_joint_position_error_m':error,'max_world_rotation_delta_error_degrees':max(rotation_errors)})
  states.append({'state':state,'samples':checks,'max_error_m':max(x['max_joint_position_error_m']for x in checks)})
 report.append({'faction':faction,'bone_count':163,'isolated_reimport_passed':True,'states':states});print('FULL_BODY_REIMPORT_PASS',faction,flush=True)
(ROOT/'diagnostics/reimport.json').write_text(json.dumps(report,indent=2)+'\n')
