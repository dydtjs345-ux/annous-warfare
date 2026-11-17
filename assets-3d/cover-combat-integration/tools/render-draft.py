import bpy,sys,os,math,json,importlib.util
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'));spec=importlib.util.spec_from_file_location('cover_rig',ROOT/'tools/cover-rig.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);from fixtures import create
r=mod.CoverRig(os.environ.get('CV_WEAPON','M16A4'));s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=False;s.cycles.max_bounces=2;s.render.use_persistent_data=True;s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.world=bpy.data.worlds.new('World');s.world.color=(.18,.22,.26);s.view_settings.view_transform='AgX';bpy.ops.mesh.primitive_plane_add(size=100);floor=bpy.context.object;floor.location.z=-.001;m=bpy.data.materials.new('Floor');m.diffuse_color=(.15,.19,.22,1);floor.data.materials.append(m)
for p in [(3,-3,6),(-3,3,4)]:
 bpy.ops.object.light_add(type='AREA',location=p);l=bpy.context.object;l.data.energy=1000;l.data.size=4;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=3;s.camera=cam;dest=Path('/workspace/cover-review-draft');dest.mkdir(exist_ok=True);props=[]
for stance in ['Stand','Crouch']:
 for mode,style,side,u in [('Left','Corner',1,1),('Right','Corner',-1,1),('Low','Low',1,1),('Protected','Corner',1,0),('BlindOver','BlindOver',1,1),('BlindLeft','BlindCorner',1,1),('BlindRight','BlindCorner',-1,1)]:
  r.pose(u,side,stance,style)
  for p in props:bpy.data.objects.remove(p,do_unlink=True)
  props=create(style,stance,side)
  center=Vector((side*.10,-.35,1.0 if style in ['Corner','BlindCorner']else .7))
  for view in ['iso','rear']:
   offset=Vector((side*6,-6 if view=='iso'else 6,4.898979));cam.location=center+offset;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(dest/f'{r.kind}-{stance}-{mode}-{view}.png');bpy.ops.render.render(write_still=True)
print('Draft poses rendered',flush=True)
