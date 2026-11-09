"""Source contact, full-weapon motion, foot plants, mechanisms and pouch occlusion."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT.parent/'infantry-animation';sys.path.insert(0,str(BASE/'tools'));from author_motion import Author
reports=[]
for faction in ['USMC','Russian']:
 meta=json.loads((ROOT/'validation'/f'{faction}-authoring.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{faction}_TacticalReload.blend'));rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];weapon=bpy.data.objects['Weapon'];helper=Author.__new__(Author);helper.rig=rig
 wrist,anchor,frame=helper.hand_frame('L');anchorLocal=rig.data.bones['wrist.L'].matrix_local.inverted()@anchor;contact=Vector((.023,-.12,-.075));contactErrors=[]
 for sample in meta['samples']:
  if not sample['left_contact']:continue
  t=sample['time']*30;bpy.context.scene.frame_set(int(t),subframe=t-int(t));palm=rig.matrix_world@rig.pose.bones['wrist.L'].matrix@anchorLocal;ob=bpy.data.objects['Magazine'if sample['phase']<1.43 else'SpareMagazine'];contactErrors.append((palm-ob.matrix_world@contact).length)
 assert max(contactErrors)<.0001,(faction,max(contactErrors))
 samples=meta['samples'];W0=Matrix(samples[0]['weapon_world']);originRange=max((Matrix(s['weapon_world']).translation-W0.translation).length for s in samples);lift=max(Matrix(s['weapon_world']).translation.z-W0.translation.z for s in samples);angle=max(W0.to_quaternion().rotation_difference(Matrix(s['weapon_world']).to_quaternion()).angle for s in samples);footSlip=max((Vector(s['feet'][i])-Vector(samples[0]['feet'][i])).length for s in samples for i in [0,1]);assert originRange>.15 and lift>.10 and angle>math.radians(25);assert footSlip<.0001
 relative=[(s['phase'],Matrix(s['weapon_world']).inverted()@Matrix(s['new_world']))for s in samples]
 # Entry/exit must reproduce every bone in the existing shouldered stance.
 endpoints=[]
 for frame_index in [0,round(meta['duration']*30)]:
  bpy.context.scene.frame_set(frame_index);bpy.context.view_layer.update()
  error=max(abs(rig.pose.bones[name].matrix[i][j]-value[i][j])for name,value in meta['aim_reference_matrices'].items()for i in range(4)for j in range(4))
  assert error<.00002,(faction,'shouldered boundary mismatch',frame_index,error)
  endpoints.append({'frame':frame_index,'max_bone_matrix_error':error})
 # Stage-specific counter-motion must continue after the initial rifle lift.
 stages=[]
 for begin,end in [(.8,1.38),(1.38,2.16),(2.16,2.68)]:
  A=Matrix(min(samples,key=lambda s:abs(s['phase']-begin))['weapon_world']);B=Matrix(min(samples,key=lambda s:abs(s['phase']-end))['weapon_world'])
  distance=(A.translation-B.translation).length;beat_angle=math.degrees(A.to_quaternion().rotation_difference(B.to_quaternion()).angle)
  assert distance>.003 or beat_angle>.5,(faction,'frozen handling beat',begin,end)
  stages.append({'phase_interval':[begin,end],'weapon_translation_m':distance,'weapon_rotation_degrees':beat_angle})
 if faction=='USMC':
  insertion=[m for u,m in relative if 2.30<=u<=2.54];sideMotion=max(math.hypot(m.translation.x,m.translation.y)for m in insertion);assert sideMotion<.0001;mechanism={'straight_in_lateral_error_m':sideMotion}
 else:
  rock=[m for u,m in relative if 2.46<=u<=2.64];pivot=Vector((0,-.175,.038));err=max((m@pivot-pivot).length for m in rock);rotation=max(m.to_quaternion().angle for m in rock)-min(m.to_quaternion().angle for m in rock);assert err<.0001 and rotation>math.radians(18);mechanism={'rock_in_front_lug_error_m':err,'rock_in_rotation_degrees':math.degrees(rotation)}
 # Visibility keys occur at the closed pouch's occluded storage position.
 occlusion=[]
 for event,obname in [('old_hidden','Magazine'),('replacement_visible','SpareMagazine')]:
  t=meta['pouch_visibility_times'][event]*30;bpy.context.scene.frame_set(int(t),subframe=t-int(t));bpy.context.view_layer.update();ev=char.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();bvh=BVHTree.FromPolygons([char.matrix_world@v.co for v in me.vertices],[list(p.vertices)for p in me.polygons]);ob=bpy.data.objects[obname];p,q,scale=ob.matrix_world.decompose();M=Matrix.Translation(p)@q.to_matrix().to_4x4();points=[M@v.co for v in ob.data.vertices];directions=[]
  for degrees in [225,180,135,90,45,0,315,270]:
   camera=Matrix.Rotation(math.radians(-degrees),3,'Z')@Vector((6,-6,0))+Vector((0,0,5.749));visible=0
   for point in points:
    delta=point-camera;hit=bvh.ray_cast(camera,delta.normalized(),delta.length-.001)[0]
    if hit is None:visible+=1
   directions.append({'heading_degrees':degrees,'potentially_visible_vertices':visible,'sample_vertices':len(points)})
  ev.to_mesh_clear();occlusion.append({'event':event,'directions':directions})
 assert all(d['potentially_visible_vertices']==0 for event in occlusion for d in event['directions']),(faction,'visible magazine visibility switch')
 reports.append({'faction':faction,'max_left_palm_magazine_contact_error_m':max(contactErrors),'weapon_origin_travel_m':originRange,'weapon_raise_m':lift,'weapon_orientation_change_degrees':math.degrees(angle),'max_foot_slide_m':footSlip,'shouldered_endpoint_matches':endpoints,'handling_beat_motion':stages,'magazine_mechanism':mechanism,'pouch_visibility_occlusion':occlusion});print('CONTACT_AND_MECHANISM_PASS',faction,originRange,lift,max(contactErrors),flush=True)
(ROOT/'validation/contacts.json').write_text(json.dumps(reports,indent=2)+'\n')
