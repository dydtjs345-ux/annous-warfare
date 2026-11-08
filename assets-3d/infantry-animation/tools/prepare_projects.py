"""Set a useful material-preview viewport on new projects; verify shared lower Actions."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];hashes={}
for faction in ['USMC','Russian']:
 path=ROOT/'source'/f'{faction}_Animation.blend';bpy.ops.wm.open_mainfile(filepath=str(path));rig=bpy.data.objects['InfantryRig'];rig.show_in_front=False
 target=Vector((0,0,.9))
 for screen in bpy.data.screens:
  for area in screen.areas:
   if area.type=='VIEW_3D':
    space=area.spaces.active;space.shading.type='MATERIAL';space.region_3d.view_location=target;space.region_3d.view_distance=3.2;space.region_3d.view_rotation=(Vector((3,-5,2.8))-target).to_track_quat('Z','Y');space.region_3d.view_perspective='ORTHO'
 bpy.ops.object.select_all(action='DESELECT');bpy.data.objects[faction+'_Character'].select_set(True);bpy.context.view_layer.objects.active=bpy.data.objects[faction+'_Character']
 meta=json.loads((ROOT/'validation'/f'{faction}-authoring.json').read_text());checks={}
 for name,info in meta['actions'].items():
  if info['layer']!='lower':continue
  action=bpy.data.actions[name];data=[(fc.data_path,fc.array_index,[(float(k.co.x),float(k.co.y))for k in fc.keyframe_points])for fc in action.fcurves];checks[name]=hashlib.sha256(json.dumps(data).encode()).hexdigest()
 hashes[faction]=checks;bpy.ops.wm.save_as_mainfile(filepath=str(path))
assert hashes['USMC']==hashes['Russian'],'Faction lower-body Actions differ'
(ROOT/'validation/shared-motion.json').write_text(json.dumps({'shared_lower_action_hashes':hashes['USMC'],'exactly_equal_between_factions':True},indent=2)+'\n');print('SHARED_LOWER_MOTION_AND_PROJECTS_PASS')
