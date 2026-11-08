"""Render real 3D closeups and the editable mesh topology from the studio file."""
import bpy,sys,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from finish_asset import aim
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=False
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
cam=scene.camera;cam.data.type='ORTHO'
char=bpy.data.objects['USMC_Rifleman_Character']
views=[('head-and-carrier',(.8,-2.1,1.9),(0,-.035,1.485),.88,1200,1200),
 ('boots',(.72,-1.5,.56),(0,-.08,.20),.67,1000,1000),
 ('weapon',(1.48,-1.8,1.26),(1.106,0,1.0),1.20,1600,900)]
if os.environ.get('AW_DETAIL_VIEW')=='topology':views=[]
elif os.environ.get('AW_DETAIL_VIEW'):
 views=[v for v in views if v[0]==os.environ['AW_DETAIL_VIEW']];assert views,'Unknown detail view'
for name,pos,target,scale,w,h in views:
 char.hide_render=name=='weapon'
 cam.location=pos;aim(cam,target);cam.data.ortho_scale=scale;scene.render.resolution_x=w;scene.render.resolution_y=h
 scene.render.filepath=str(ROOT/'previews'/f'{name}.png');print('DETAIL_RENDER',name,flush=True);bpy.ops.render.render(write_still=True)
char.hide_render=False
if not os.environ.get('AW_DETAIL_VIEW') or os.environ['AW_DETAIL_VIEW']=='topology':
 # Show actual source edges, including quad clothing loops, as geometry.
 weapon=bpy.data.objects['M16A4_Separate_Weapon'];weapon.hide_render=True
 surface=bpy.data.materials.new('Topology surface');surface.diffuse_color=(.40,.49,.53,1)
 lines=bpy.data.materials.new('Topology lines');lines.diffuse_color=(.015,.022,.026,1)
 char.data.materials.clear();char.data.materials.append(surface);char.data.materials.append(lines)
 for f in char.data.polygons:f.material_index=0
 wire=char.modifiers.new('Actual polygon edge display','WIREFRAME');wire.thickness=.0006;wire.use_replace=False;wire.material_offset=1;wire.use_even_offset=False
 cam.location=(2.8,-5,2.4);aim(cam,(0,0,.96));cam.data.ortho_scale=2.15
 scene.render.resolution_x=1200;scene.render.resolution_y=1400;scene.render.filepath=str(ROOT/'previews/topology.png')
 print('DETAIL_RENDER topology',flush=True);bpy.ops.render.render(write_still=True)
print('DETAIL_RENDERS_FINISHED',flush=True)
