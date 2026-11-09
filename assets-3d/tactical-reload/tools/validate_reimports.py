"""Compare source and isolated GLB playback, including weapon and magazine motion."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];reports=[]
def capture(rig):
 bpy.context.view_layer.update();positions={b.name:list(rig.matrix_world@b.head)for b in rig.pose.bones}
 for name in ['Weapon','Magazine','SpareMagazine']:positions[name]=list(bpy.data.objects[name].matrix_world.translation)
 char=next(o for o in bpy.data.objects if o.type=='MESH'and 'Character'in o.name);ev=char.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();points=[char.matrix_world@v.co for v in me.vertices];positions['mesh_min']=[min(p[i]for p in points)for i in range(3)];positions['mesh_max']=[max(p[i]for p in points)for i in range(3)];ev.to_mesh_clear();return positions
for faction in ['USMC','Russian']:
 meta=json.loads((ROOT/'validation'/f'{faction}-authoring.json').read_text());D=meta['duration'];times=[0,16/30,17/30,.54,1.05,1.48,1.95,2.42,2.65,3.08,3.45,3.7];times=[t*D/3.7 for t in times]
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{faction}_TacticalReload.blend'));rig=bpy.data.objects['InfantryRig'];hierarchy={b.name:b.parent.name if b.parent else None for b in rig.data.bones};expected=[];source_errors=[]
 for t in times:
  frame=t*30;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));reference=capture(rig);expected.append(reference)
  sample=min(meta['samples'],key=lambda s:abs(s['time']-t));
  if abs(sample['time']-t)<1e-6:source_errors.append((Vector(reference['Weapon'])-Vector([sample['weapon_world'][i][3]for i in range(3)])).length)
 assert max(source_errors)<.0001,('Saved NLA differs from authored path',faction,max(source_errors))
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30;bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/f'{faction}_TacticalReload.glb'))
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');assert len(rig.data.bones)==163;assert {b.name:b.parent.name if b.parent else None for b in rig.data.bones}==hierarchy
 for ob in bpy.data.objects:
  if ob.animation_data:
   ob.animation_data.action=None
   for tr in ob.animation_data.nla_tracks:tr.mute=False
 offset=min(tr.strips[0].frame_start for tr in rig.animation_data.nla_tracks);print('IMPORT_FRAME_OFFSET',offset,flush=True)
 actual=[]
 for t,reference in zip(times,expected):
  frame=t*30+offset;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));result=capture(rig);diffs=sorted([(k,(Vector(result[k])-Vector(p)).length)for k,p in reference.items()],key=lambda x:-x[1]);error=diffs[0][1];print('REIMPORT_DIAGNOSTIC',faction,t,diffs[:5],{k:round((Vector(result[k])-Vector(reference[k])).length,6)for k in ['wrist.L','wrist.R','head','Weapon','Magazine','SpareMagazine','mesh_min','mesh_max']},flush=True);actual.append({'time':t,'max_joint_weapon_magazine_and_bounds_error_m':error});assert error<.002,(faction,t,error)
 reports.append({'faction':faction,'bone_count':163,'hierarchy_matches_source':True,'source_nla_matches_authored_trajectory':True,'isolated_glb_reimport_passed':True,'samples':actual,'max_error_m':max(x['max_joint_weapon_magazine_and_bounds_error_m']for x in actual)});print('RELOAD_REIMPORT_PASS',faction,flush=True)
(ROOT/'validation/reimports.json').write_text(json.dumps(reports,indent=2)+'\n')
