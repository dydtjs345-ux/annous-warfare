"""Read-only use of the approved asset: authored low-ready pose and knee-pad study.
blender -b --python-exit-code 1 ../source/USMC_Rifleman.blend --python tools/render_evaluation.py
AW_EVAL_STAGE=pose renders only the initial pose quality gate.
"""
import bpy,math,sys,os,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];ASSET=ROOT.parent;sys.path.insert(0,str(ASSET/'tools'))
import modeling as M
from finish_asset import aim
for name in ['large','native','source','validation']:(ROOT/name).mkdir(parents=True,exist_ok=True)
char=bpy.data.objects['USMC_Rifleman_Character'];rig=bpy.data.objects['USMC_Rifleman_Rig'];weapon=bpy.data.objects['M16A4_Separate_Weapon']
rest=[v.co.copy()for v in char.data.vertices]
rest_hash=hashlib.sha256(b''.join(__import__('struct').pack('<3f',*p)for p in rest)).hexdigest()
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
weapon_rotation=Matrix.Rotation(math.radians(25),4,'Z')@Matrix.Rotation(math.radians(30),4,'X')
weapon.matrix_world=Matrix.Translation(Vector((-.11,-.315,1.21)))@weapon_rotation
records={}
def hand_frame(side):
 w=rig.data.bones['wrist.'+side].head_local
 mcp=[rig.data.bones[f'finger{i}-1.{side}'].head_local for i in range(2,6)]
 forward=(sum(mcp,Vector())/4-w).normalized();thumb=mcp[0]-mcp[-1];thumb=(thumb-forward*thumb.dot(forward)).normalized()
 return w,w+(sum(mcp,Vector())/4-w)*.58,Matrix((thumb,forward,thumb.cross(forward))).transposed()
def rigid_bone(name,rotation,rest_origin,new_origin):
 rig.pose.bones[name].matrix=Matrix.Translation(new_origin)@rotation.to_4x4()@Matrix.Translation(-rest_origin)@rig.data.bones[name].matrix_local
 bpy.context.view_layer.update()
def pose_arm(side,palm_local,forward_local,normal_local,hint):
 wrist,anchor,frame=hand_frame(side)
 f=(weapon_rotation.to_3x3()@Vector(forward_local)).normalized();n=(weapon_rotation.to_3x3()@Vector(normal_local)).normalized();n=(n-f*n.dot(f)).normalized()
 thumb=f.cross(n)if side=='R'else n.cross(f);desired=Matrix((thumb,f,thumb.cross(f))).transposed();rotation=desired@frame.transposed()
 palm=weapon.matrix_world@Vector(palm_local);goal=palm-rotation@(anchor-wrist)
 shoulder=rig.data.bones['upperarm01.'+side].head_local;elbow=rig.data.bones['lowerarm01.'+side].head_local
 lu=(elbow-shoulder).length;lf=(wrist-elbow).length;v=goal-shoulder;d=v.length
 assert abs(lu-lf)+.001<d<lu+lf-.001,('Unreachable wrist',side,d,lu+lf)
 axis=v.normalized();a=(lu*lu-lf*lf+d*d)/(2*d);h=math.sqrt(lu*lu-a*a)
 pole=Vector(hint)-(shoulder+axis*a);pole=(pole-axis*pole.dot(axis)).normalized();new_elbow=shoulder+axis*a+pole*h
 qu=(elbow-shoulder).rotation_difference(new_elbow-shoulder).to_matrix();qf=(wrist-elbow).rotation_difference(goal-new_elbow).to_matrix()
 rigid_bone('upperarm01.'+side,qu,shoulder,shoulder)
 rigid_bone('lowerarm01.'+side,qf,elbow,new_elbow)
 rigid_bone('wrist.'+side,rotation,wrist,goal)
 # Close the actual finger bones around the grip; the rifle is never animated
 # independently of a static hand. Index remains near straight for low-ready.
 palm_rest=frame.col[2] if side=='R'else -frame.col[2];axis_rest=frame.col[1].cross(palm_rest).normalized()
 for digit in range(2,6):
  angles=(.12,.22,.12)if side=='R'and digit==2 else((.85,1.12,.6)if side=='R'else(.75,1.0,.6))
  for segment,angle in enumerate(angles,1):
   name=f'finger{digit}-{segment}.{side}';bone=rig.data.bones[name];p=rig.pose.bones[name];p.rotation_mode='QUATERNION'
   local=bone.matrix_local.to_3x3().inverted()@axis_rest;p.rotation_quaternion=Quaternion(local,angle)
 for segment,angle in enumerate((.24,.38,.4),1):
  name=f'finger1-{segment}.{side}';p=rig.pose.bones[name];p.rotation_mode='QUATERNION';p.rotation_quaternion=Quaternion(rig.data.bones[name].matrix_local.to_3x3().inverted()@axis_rest,angle)
 bpy.context.view_layer.update()
 actual=rig.pose.bones['wrist.'+side].head;error=(actual-goal).length;assert error<.0001,(side,error)
 records[side]={'wrist_target_metres':list(goal),'wrist_error_metres':error,'palm_anchor_metres':list(palm),'elbow_metres':list(new_elbow),'upper_arm_length':lu,'forearm_length':lf,'reach':d}
pose_arm('R',(-.029,.048,-.036),(0,-.8,.2),(1,0,0),(-.34,.04,1.17))
pose_arm('L',(.005,-.155,.055),(-1,-.10,0),(0,0,1),(.30,-.20,1.18))
deps=bpy.context.evaluated_depsgraph_get();evaluated=char.evaluated_get(deps);ev=evaluated.to_mesh()
boot_delta=max((ev.vertices[i].co-rest[i]).length for i,p in enumerate(rest)if p.z<.24);assert boot_delta<.000001,boot_delta
assert hashlib.sha256(b''.join(__import__('struct').pack('<3f',*v.co)for v in char.data.vertices)).hexdigest()==rest_hash
# New evaluation-only knee pads; original body/boots/UVs/materials are untouched.
body_bvh=BVHTree.FromPolygons([v.co for v in ev.vertices],[tuple(p.vertices)for p in ev.polygons]);evaluated.to_mesh_clear()
pad_mat=M.material('Evaluation only · matte tan knee shell','AA9673',.78)
back_mat=M.material('Evaluation only · tan fabric backing','867456',.9)
strap_mat=M.material('Evaluation only · elastic nylon straps','796C55',.9)
def front(x,z):
 hit=body_bvh.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)[0]
 assert hit is not None,('Unsupported knee-pad point',x,z)
 return hit.y
def knee_surface(name,cx,cz,rx,rz,depth,mat,bone):
 # A low-profile rounded rectangular shell, fitted to the real garment.
 count=32;rings=[.25,.55,.82,1.0];verts=[(cx,front(cx,cz)-depth-.004,cz)]
 for r in rings:
  for j in range(count):
   t=j*2*math.pi/count;u=math.copysign(abs(math.cos(t))**.68,math.cos(t));v=math.copysign(abs(math.sin(t))**.68,math.sin(t));x=cx+rx*r*u;z=cz+rz*r*v
   verts.append((x,front(x,z)-depth-.004*(1-r*r),z))
 faces=[(0,1+j,1+(j+1)%count)for j in range(count)]
 for r in range(len(rings)-1):
  for j in range(count):a=1+r*count+j;b=1+r*count+(j+1)%count;faces.append((a,a+count,b+count,b))
 ob=M.mesh(name,verts,faces,mat,bone);solid=ob.modifiers.new('Physical pad thickness','SOLIDIFY');solid.thickness=.003;solid.offset=0;M.apply(ob,solid)
for side in ['L','R']:
 k=rig.data.bones['lowerleg01.'+side].head_local;bone='lowerleg01.'+side
 knee_surface('Knee fabric backing '+side,k.x,k.z,.054,.075,.004,back_mat,bone)
 knee_surface('Tan curved protective shell '+side,k.x,k.z,.046,.059,.014,pad_mat,bone)
 for z in [k.z-.052,k.z+.051]:
  origin=Vector((k.x,k.y,z));points=[]
  for j in range(49):
   t=j*2*math.pi/48;d=Vector((math.cos(t),math.sin(t),0));hit=body_bvh.ray_cast(origin,d,1)[0];assert hit is not None
   points.append(hit+d*.004)
  M.ribbon('Knee elastic securing strap '+side,points,.018,.003,strap_mat,bone,width_axis=(0,0,1))
pads=M.join(M.CHAR,'Evaluation_Tan_Kneepads');pads.parent=rig;mod=pads.modifiers.new('Follow unchanged knee bones','ARMATURE');mod.object=rig;pads['evaluation_only']=True
root=bpy.data.objects.new('Evaluation_Facing_Assembly',None);bpy.context.collection.objects.link(root)
rig.parent=root;weapon.parent=root
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=96;scene.cycles.use_denoising=False;scene.cycles.seed=0
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.075,.10,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6;scene.view_settings.view_transform='AgX'
for name,pos,power,size,color in [('Key',(-3,-4,6),450,4,(.92,.94,1)),('Fill',(4,2,5),330,4,(.82,.89,1)),('Rim',(-2,4,4),300,3,(.95,.90,.82))]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name='Evaluation_'+name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,1))
bpy.ops.object.camera_add(location=(6,-6,6*math.sqrt(2/3)));cam=bpy.context.object;cam.name='Evaluation_2to1_Isometric_Camera';aim(cam,(0,0,0));scene.camera=cam;cam.data.type='ORTHO';cam.data.clip_end=100
rot=cam.rotation_euler.to_matrix();right=rot@Vector((1,0,0));up=rot@Vector((0,1,0));out=rot@Vector((0,0,1))
directions={'N':225,'NE':180,'E':135,'SE':90,'S':45,'SW':0,'W':315,'NW':270}
# Game Y points down its 2D map; Blender Y is the opposite ground axis.
basis=[[right.dot(v),-up.dot(v)]for v in [Vector((1,0,0)),Vector((0,-1,0))]]
scale=20/basis[0][0];basis=[[a*scale,b*scale]for a,b in basis]
assert max(abs(a-b)for row,expected in zip(basis,[[20,10],[-20,10]])for a,b in zip(row,expected))<.0001,basis
manifest={'source_model_commit':'bd5c3210d0f37a2057780eca4f0aa6bd33eab2a4','projection':{'elevation_degrees':30,'on_screen_axis_degrees':math.degrees(math.atan(.5)),'azimuth_degrees':-45,'game_to_blender_ground_axes':[[1,0,0],[0,-1,0]],'measured_game_basis_pixels':basis},'pose':records,'boot_max_pose_delta_metres':boot_delta,'original_mesh_vertex_sha256':rest_hash,'native':[],'large':[]}
def positions():
 bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();all_positions=[]
 for ob in [char,weapon]:
  evaluated=ob.evaluated_get(dg);me=evaluated.to_mesh();all_positions.extend(ob.matrix_world@v.co for v in me.vertices);evaluated.to_mesh_clear()
 return all_positions
def frame(direction,height,padding):
 root.rotation_euler.z=math.radians(directions[direction]);p=positions();xr=[v.dot(right)for v in p];yr=[v.dot(up)for v in p];zr=[v.dot(out)for v in p]
 span=max(yr)-min(yr);ratio=(max(xr)-min(xr))/span
 w=math.ceil(height*ratio)+padding*2;h=height+padding*2
 scene.render.resolution_x=w;scene.render.resolution_y=h;cam.data.ortho_scale=1
 f=cam.data.view_frame(scene=scene);frame_height=max(v.y for v in f)-min(v.y for v in f)
 cam.data.ortho_scale=span/frame_height*h/height
 center=right*((min(xr)+max(xr))/2)+up*((min(yr)+max(yr))/2)+out*((min(zr)+max(zr))/2)
 cam.location=center+out*6
 # Image foot anchor, shared by both variants, for honest battlefield overlays.
 from bpy_extras.object_utils import world_to_camera_view
 anchor=world_to_camera_view(scene,cam,Vector((0,0,0)))
 return {'width':w,'height':h,'nominal_figure_height':height,'pivot':[anchor.x*w,(1-anchor.y)*h]}
def image_metrics(path):
 im=bpy.data.images.load(str(path),check_existing=False);w,h=im.size;pixels=list(im.pixels);points=[(i%w,i//w)for i in range(w*h)if pixels[i*4+3]>=.5]
 assert points;xs,ys=zip(*points);r={'opaque_height':max(ys)-min(ys)+1,'opaque_width':max(xs)-min(xs)+1};bpy.data.images.remove(im);return r
def render(path):
 scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
stage=os.environ.get('AW_EVAL_STAGE','all')
large_directions=['S','SE','E']if stage=='pose'else list(directions)
for d in large_directions:
 for variant in (['current','pads']if d=='SE'or stage!='pose'else['current']):
  pads.hide_render=variant=='current';info=frame(d,512,24);scene.render.film_transparent=False
  path=ROOT/'large'/f'{variant}-{d}.png';render(path);manifest['large'].append({'direction':d,'variant':variant,'file':str(path.relative_to(ROOT)),**info})
root.rotation_euler.z=math.radians(90);pads.hide_render=False;frame('SE',512,24)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/LowReady_Kneepad_Evaluation.blend'))
if stage!='pose':
 scene.render.film_transparent=True
 for d in directions:
  for height in [40,60,80,120]:
   info=frame(d,height,5)
   for variant in ['current','pads']:
    pads.hide_render=variant=='current';path=ROOT/'native'/f'{variant}-{d}-{height}.png';render(path)
    manifest['native'].append({'direction':d,'variant':variant,'file':str(path.relative_to(ROOT)),**info,**image_metrics(path)})
(ROOT/'validation/render-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('EVALUATION_RENDERS_FINISHED',stage,flush=True)
