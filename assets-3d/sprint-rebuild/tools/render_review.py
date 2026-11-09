"""Real geometry, two independent rigs, fixed orthographic isometric/side cameras."""
import bpy,sys,os,math,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT.parent/'infantry-animation/tools'));from animation_io import pose
faction=os.environ.get('AW_FACTION','USMC');view=os.environ.get('AW_VIEW','iso');gate=os.environ.get('AW_GATE')=='1';bpy.ops.wm.open_mainfile(filepath=os.environ.get('AW_SOURCE')or str(ROOT/'source'/f'{faction}_SprintReview.blend'));scene=bpy.context.scene
rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];weapon=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine'];spare=bpy.data.objects['SpareMagazine'];original=[rig,char,weapon,mag,spare]
for ob in bpy.data.objects:
 if ob.type in ['MESH','LIGHT']:ob.hide_render=True
copies=[]
for ob in original:
 cp=ob.copy();bpy.context.collection.objects.link(cp);cp.animation_data_clear();cp.animation_data_create();copies.append(cp)
rig2,char2,weap2,mag2,spare2=copies;weap2.parent=rig2;mag2.parent=weap2;spare2.parent=weap2
if char.parent==rig:char2.parent=rig2
for mod in char2.modifiers:
 if mod.type=='ARMATURE':mod.object=rig2
for ob in original+copies:ob.hide_render=False
for ob in [rig,mag,spare,rig2,mag2,spare2]:
 ob.animation_data_create();ob.animation_data.action=None
 for tr in list(ob.animation_data.nla_tracks):ob.animation_data.nla_tracks.remove(tr)
ref=json.loads((ROOT.parent.parent/'animation-preview-pages/src/reference-spans.json').read_text())[faction]['SE']if view=='iso'else 1.73
width,height,standing=560,280,(120 if view=='iso'else 180);horizontal=ref*width/standing;right=Vector((1,1,0)).normalized()if view=='iso'else Vector((0,1,0))if view=='side'else Vector((1,0,0));actors=[];markers=[]
for index,obs in enumerate([original,copies]):
 r,ch,w,m,s=obs;group=bpy.data.objects.new('Review_'+str(index),None);bpy.context.collection.objects.link(group);r.parent=group
 if ch.parent!=r:ch.parent=group
 group.rotation_euler.z=math.pi/2 if view=='iso'else 0;group.location=right*((index-.5)*horizontal/2);actors.append((r,m,s))
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='TEXTURE';scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.background_type='WORLD';scene.display.shading.shadow_intensity=.35;scene.display.render_aa='FXAA'
for mat in bpy.data.materials:
 if mat.use_nodes:
  p=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if p and p.inputs['Base Color'].links:
   n=p.inputs['Base Color'].links[0].from_node
   if n.type=='TEX_IMAGE':mat.node_tree.nodes.active=n
scene.world.color=(.055,.075,.10);scene.view_settings.view_transform='Standard';scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.film_transparent=False;scene.render.use_persistent_data=True;scene.render.threads_mode='FIXED';scene.render.threads=4
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));floor=bpy.context.object;mat=bpy.data.materials.new('Review_ground');mat.diffuse_color=(.055,.075,.10,1);floor.data.materials.append(mat)
if view=='side':
 bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,-.015));o=bpy.context.object;o.dimensions=(.012,20,.012);o.data.materials.append(mat)
bpy.ops.object.camera_add(location=(6,-6,4.899+.85)if view=='iso'else(8,0,.85));cam=bpy.context.object
if view=='front':cam.location=Vector((0,-8,.85))
cam.rotation_euler=(Vector((0,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';scene.camera=cam;cam.data.ortho_scale=1;frame=cam.data.view_frame(scene=scene);span=max(p.y for p in frame)-min(p.y for p in frame);cam.data.ortho_scale=ref/span*height/standing
for state in ['Sprint']:
 duration=2.0;fps=30;out=Path('/tmp')/f'sprint-{faction}-{view}';out.mkdir(exist_ok=True)
 times=[i/15 for i in range(10)]if gate else[i/fps for i in range(round(duration*fps))]
 for i,t in enumerate(times):
  for names,(r,m,s)in zip([('FB_Sprint_Lower','FB_Sprint_Upper'),('SR_Sprint_Lower','SR_Sprint_Upper')],actors):
   D=.8 if names[0].startswith('FB')else 2/3;pose(r,*names,t%D)
  bpy.context.view_layer.update();scene.render.filepath=str(out/(f'gate-{i:02d}.png'if gate else f'{i:04d}.png'));bpy.ops.render.render(write_still=True)
 print('SPRINT_RENDERED',faction,view,len(times),flush=True)
