"""Actual 9.12m world-space route; fixed orthographic 30 degree camera."""
import bpy,sys,os,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT.parent/'infantry-animation/tools'));from animation_io import pose
faction=os.environ.get('AW_FACTION','USMC');gate=os.environ.get('AW_GATE')=='1';bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{faction}_SprintReview.blend'));r=bpy.data.objects['InfantryRig'];ch=bpy.data.objects[faction+'_Character'];scene=bpy.context.scene;meta=json.loads((ROOT/'diagnostics'/f'{faction}-authored.json').read_text())['all_export_actions']
for o in bpy.data.objects:
 if o.type in ['MESH','LIGHT']:o.hide_render=o.name not in [faction+'_Character','Weapon','Magazine','SpareMagazine']
group=bpy.data.objects.new('RouteAssembly',None);bpy.context.collection.objects.link(group);r.parent=group
if ch.parent!=r:ch.parent=group
group.rotation_euler.z=math.radians(-135);fwd=Vector((-.5**.5,.5**.5,0))
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='TEXTURE';scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.background_type='WORLD';scene.display.render_aa='FXAA';scene.world.color=(.055,.075,.10);scene.view_settings.view_transform='Standard';scene.render.resolution_x=400;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.threads_mode='FIXED';scene.render.threads=4
for m in bpy.data.materials:
 if m.use_nodes:
  p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if p and p.inputs['Base Color'].links:
   n=p.inputs['Base Color'].links[0].from_node
   if n.type=='TEX_IMAGE':m.node_tree.nodes.active=n
mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.11,.15,.18,1);bpy.ops.mesh.primitive_plane_add(size=30,location=(0,0,-.012));bpy.context.object.data.materials.append(mat)
for i in range(10):
 bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.dimensions=(.12,1.1,.006);o.rotation_euler.z=math.radians(45);o.location=fwd*(i-4.56);o.location.z=.001;col=bpy.data.materials.new('Meter_'+str(i));col.diffuse_color=(.5,.7,.4,1)if i==0 else(.8,.5,.3,1)if i==9 else(.28,.36,.4,1);o.data.materials.append(col)
bpy.ops.object.camera_add(location=(6,-6,4.899+.85));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';scene.camera=cam;ref=json.loads((ROOT.parent.parent/'animation-preview-pages/src/reference-spans.json').read_text())[faction]['SE'];cam.data.ortho_scale=1;frame=cam.data.view_frame(scene=scene);span=max(p.y for p in frame)-min(p.y for p in frame);cam.data.ortho_scale=ref/span*600/120
out=Path('/tmp')/f'sprint-{faction}-travel';out.mkdir(exist_ok=True)
def dist(name,t):
 samples=meta[name]['travel_samples_m'];f=max(0,min(len(samples)-1,t*60));i=min(len(samples)-2,int(f));return samples[i]['distance_m']+(samples[i+1]['distance_m']-samples[i]['distance_m'])*(f-i)
times=[i*.4 for i in range(13)]if gate else[i/30 for i in range(144)]
for i,t in enumerate(times):
 if t<1.2:lo,up='SR_IdleToSprint_Lower','SR_IdleToSprint_Upper';age=t;distance=dist(lo,age)
 elif t<1.2+4/3:lo,up='SR_Sprint_Lower','SR_Sprint_Upper';age=(t-1.2)%(2/3);distance=2.16+(t-1.2)*3.6
 elif t<1.2+4/3+1.2:lo,up='SR_SprintToStop_Lower','SR_SprintToStop_Upper';age=t-1.2-4/3;distance=6.96+dist(lo,age)
 else:lo,up='Lower_Idle','FB_LowReady_Upper';age=t-(1.2+4/3+1.2);distance=9.12
 pose(r,lo,up,age);group.location=fwd*(distance-4.56);bpy.context.view_layer.update();scene.render.filepath=str(out/(f'gate-{i:02d}.png'if gate else f'{i:04d}.png'));bpy.ops.render.render(write_still=True)
print('TRAVEL_RENDERED',faction,len(times),flush=True)
