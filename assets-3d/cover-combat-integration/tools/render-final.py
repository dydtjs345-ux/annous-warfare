"""Render final exported motion patches, with opaque parametric cover. Not a browser capture."""
import bpy,sys,os,json,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'));from fixtures import create
kind=os.environ.get('CV_WEAPON','M16A4');view=os.environ.get('CV_VIEW','iso');bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=120;bpy.ops.import_scene.gltf(filepath=f'/workspace/cover-{kind}-Combined.glb');objects=list(bpy.data.objects);rig=next(o for o in objects if o.type=='ARMATURE');tracks={}
for o in objects:
 if o.animation_data:
  o.animation_data.action=None
  for tr in o.animation_data.nla_tracks:
   tr.mute=True
   for st in tr.strips:tracks.setdefault(tr.name,[]).append((o,st.action))
rest={o:o.matrix_basis.copy()for o in objects}
for weapon in ['Weapon','Weapon_AK74M']:bpy.data.objects[weapon].hide_render=weapon!=('Weapon'if kind=='M16A4'else'Weapon_AK74M')
for name in ['Magazine','Magazine_AK74M']:bpy.data.objects[name].hide_render=name!=('Magazine'if kind=='M16A4'else'Magazine_AK74M')
def pose(state,t):
 for o in objects:o.matrix_basis=rest[o]
 for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
 name='CV_'+kind+'_'+state
 for o,a in [p for n,ps in tracks.items()if n==name or n.startswith(name+'_')for p in ps]:
  for fc in a.fcurves:
   try:o.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*120)
   except(ValueError,AttributeError,IndexError):pass
 for b in rig.pose.bones:b.rotation_quaternion.normalize()
 for n in ['Weapon','Weapon_AK74M']:bpy.data.objects[n].rotation_quaternion.normalize()
 bpy.context.view_layer.update()
s.render.engine='CYCLES';s.cycles.samples=4;s.cycles.use_denoising=False;s.cycles.max_bounces=2;s.render.use_persistent_data=True;s.render.resolution_x=384;s.render.resolution_y=448;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.world=bpy.data.worlds.new('World');s.world.color=(.22,.25,.28);s.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=100);floor=bpy.context.object;floor.location.z=-.001;m=bpy.data.materials.new('Floor');m.diffuse_color=(.12,.16,.19,1);floor.data.materials.append(m)
for p in [(3,-3,6),(-3,3,5)]:
 bpy.ops.object.light_add(type='AREA',location=p);l=bpy.context.object;l.data.energy=1000;l.data.size=4;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.7;s.camera=cam;dest=Path('/workspace/cover-final-media')/kind/view;dest.mkdir(parents=True,exist_ok=True);props=[]
def setup(stance,family):
 global props
 for p in props:bpy.data.objects.remove(p,do_unlink=True)
 style='Low'if family=='Low'else'BlindOver'if family=='BlindOver'else'BlindCorner'if family.startswith('Blind')else'Corner';side=-1 if 'Right'in family else 1;props=create(style,stance,side);center=Vector((side*.14,-.35,.94));offset=Vector((side*6,0,0))if view=='side'else Vector((side*6,6,4.898979))if view=='rear'else Vector((side*6,-6,4.898979));cam.location=center+offset;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
def render(name,state,t):
 pose(state,t);s.render.filepath=str(dest/(name+'.png'));bpy.ops.render.render(write_still=True)
if os.environ.get('CV_EXIT'):
 stance=os.environ.get('CV_STANCE','Stand');setup(stance,'Left');cam.data.ortho_scale=3.6;center=Vector((.45,-.3,.9));cam.location=center+Vector((6,6,4.898979));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();d=dest/'Exit';d.mkdir(exist_ok=True)
 for i in range(53):render('Exit/'+f'{i:04d}',stance+'_Exit',min(4+1/3,i/12))
elif os.environ.get('CV_STILLS'):
 for stance in ['Stand','Crouch']:
  for family in ['Left','Right','Low','BlindOver','BlindLeft','BlindRight']:
   setup(stance,family);render(stance+'-'+family,stance+'_'+family+'Fire',.19)
  setup(stance,'Left');render(stance+'-Protected',stance+'_ProtectedCorner',.2)
else:
 for family in ['Left','Right','Low']:
  setup('Stand',family);d=dest/family;d.mkdir(exist_ok=True)
  for i in range(85):
   t=i/12
   state,local=(family+'Enter',t)if t<2 else(family+'Fire',t-2)if t<4.4 else(family+'Return',t-4.4)if t<6.4 else('ProtectedLow'if family=='Low'else'ProtectedCorner',t-6.4)
   render(family+f'/{i:04d}','Stand_'+state,local)
print('FINAL MEDIA',kind,view,flush=True)
