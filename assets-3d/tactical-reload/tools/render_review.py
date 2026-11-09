"""Real 3D evaluation frames using the established fixed 30-degree camera."""
import bpy,sys,os,math,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT.parent/'infantry-animation';sys.path.insert(0,str(BASE/'tools'));from animation_io import pose
faction=os.environ.get('AW_FACTION','USMC');variant=os.environ.get('AW_VARIANT','improved');mode=os.environ.get('AW_RENDER','gate')
source=(ROOT/'source'/f'{faction}_TacticalReload.blend')if variant=='improved'else(BASE/'source'/f'{faction}_Animation.blend')
bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];weapon=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine'];spare=bpy.data.objects['SpareMagazine'];scene=bpy.context.scene
objects=[char,weapon,mag,spare]
for ob in bpy.data.objects:
 if ob.type=='MESH'and ob not in objects:ob.hide_render=True
 if ob.type=='LIGHT':ob.hide_render=True
for ob in objects:ob.hide_render=False
if variant=='original':
 for ob in [rig,mag,spare]:
  ob.animation_data.action=None
  for tr in ob.animation_data.nla_tracks:tr.mute=True
 oldMeta=json.loads((BASE/'validation'/f'{faction}-authoring.json').read_text())
root=bpy.data.objects.new('Reload_Evaluation_Facing',None);bpy.context.collection.objects.link(root);rig.parent=root
if not char.parent:char.parent=root
root.rotation_euler.z=math.pi/2
scene.render.engine=os.environ.get('AW_ENGINE','CYCLES');
if scene.render.engine=='BLENDER_WORKBENCH':
 scene.display.shading.color_type='TEXTURE';scene.display.shading.light='STUDIO';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.show_specular_highlight=True;scene.display.render_aa='8';
 for mat in bpy.data.materials:
  if mat.use_nodes:
   principal=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
   if principal and principal.inputs['Base Color'].links:
    node=principal.inputs['Base Color'].links[0].from_node
    if node.type=='TEX_IMAGE':mat.node_tree.nodes.active=node
scene.cycles.device='CPU';scene.cycles.samples=8 if mode=='video'else 16;scene.cycles.use_denoising=False;scene.render.use_persistent_data=True;scene.cycles.max_bounces=3;scene.cycles.diffuse_bounces=1;scene.cycles.glossy_bounces=1;scene.eevee.taa_render_samples=8;scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.film_transparent=False;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.075,.10,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6;scene.view_settings.view_transform='Standard'if scene.render.engine=='BLENDER_WORKBENCH'else'AgX'
if scene.render.engine=='BLENDER_WORKBENCH':scene.display.shading.studio_light='paint.sl';scene.display.shading.background_type='WORLD';scene.display.shading.shadow_intensity=.35
def aim(ob,target):ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size,color in [('Key',(-3,-4,6),450,4,(.92,.94,1)),('Fill',(4,2,5),330,4,(.82,.89,1)),('Rim',(-2,4,4),300,3,(.95,.90,.82))]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name='Reload_'+name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,1))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));floor=bpy.context.object;mat=bpy.data.materials.new('Reload neutral ground');mat.diffuse_color=(.055,.075,.10,1);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.055,.075,.10,1);mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=1;floor.data.materials.append(mat)
bpy.ops.object.camera_add(location=(6,-6,4.899+.85));camera=bpy.context.object;camera.name='Reload_30deg_Orthographic';aim(camera,(0,0,.85));camera.data.type='ORTHO';camera.data.clip_end=300;scene.camera=camera
spans=json.loads((ROOT.parent.parent/'animation-preview-pages/src/reference-spans.json').read_text());ref=spans[faction]['SE']
def frame(time):
 if variant=='improved':scene.frame_set(int(time*30),subframe=time*30-int(time*30))
 else:
  duration=3.8 if faction=='Russian'else 3.4
  if time>duration:pose(rig,'Lower_AimStance','Upper_Aim',0);mag.matrix_basis=Matrix.Identity(4);spare.matrix_basis=Matrix.Diagonal((.001,.001,.001,1))
  else:
   pose(rig,'Lower_AimStance','Reload',time)
   for name,act in oldMeta['actions']['Reload']['object_actions'].items():
    ob=bpy.data.objects[name];ob.rotation_mode='QUATERNION'
    for fc in bpy.data.actions[act].fcurves:getattr(ob,fc.data_path)[fc.array_index]=fc.evaluate(time*30)
  bpy.context.view_layer.update()
def render(time,height,w,h,path):
 frame(time);scene.render.resolution_x=w;scene.render.resolution_y=h;camera.data.ortho_scale=1;v=camera.data.view_frame(scene=scene);span=max(p.y for p in v)-min(p.y for p in v);camera.data.ortho_scale=ref/span*h/height;scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
if mode=='benchmark':
 render(.54,120,280,280,ROOT/'review/eevee-benchmark.png')
elif mode=='native':
 out=ROOT/'review'/f'{faction}-{variant}';out.mkdir(exist_ok=True)
 for height in [60,80,120]:
  for i,t in enumerate([0,.54,1.05,2.55,3.45]):render(t*(4.1/3.7 if faction=='Russian'else 1),height,200,220,out/f'native-{height}-{i}.png')
elif mode=='video':
 out=Path('/tmp')/f'reload-{faction}-{variant}';out.mkdir(exist_ok=True);D=4.1 if faction=='Russian'else 3.7
 for i in range(round((D+.4)*60)+1):render(min(i/60,D),120,280,280,out/f'{i:04d}.png')
elif mode=='grips':
 out=Path('/tmp')/f'reload-grips-{faction}';out.mkdir(exist_ok=True)
 for heading,degrees in {'N':225,'NE':180,'E':135,'SE':90,'S':45,'SW':0,'W':315,'NW':270}.items():
  root.rotation_euler.z=math.radians(degrees);ref=spans[faction][heading]
  for i,t in enumerate([1.05,2.42]):render(t*(4.1/3.7 if faction=='Russian'else 1),300,380,440,out/f'{heading}-{i}.png')
else:
 times=[0,.54,1.05,1.48,1.95,2.42,2.65,3.08,3.45,3.7]
 if faction=='Russian':times=[x*4.1/3.7 for x in times]
 out=ROOT/'review'/f'{faction}-{variant}';out.mkdir(exist_ok=True)
 for i,t in enumerate(times):render(t,300,380,440,out/f'phase-{i:02d}.png')
print('RELOAD_RENDER_COMPLETE',faction,variant,mode,flush=True)
