import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=30;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=False;s.render.resolution_x=480;s.render.resolution_y=560;s.render.resolution_percentage=100;s.world=bpy.data.worlds.new('World');s.world.color=(.18,.22,.26)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'source/TacticalSuit_Normalized.glb'));objects=[o for o in bpy.data.objects if not(o.type=='MESH'and any(c.name=='glTF_not_exported'for c in o.users_collection))];rig=next(o for o in objects if o.type=='ARMATURE')
def bounds():
 points=[];dg=bpy.context.evaluated_depsgraph_get()
 for o in objects:
  if o.type=='MESH':
   e=o.evaluated_get(dg);m=e.to_mesh();points.extend(e.matrix_world@v.co for v in m.vertices);e.to_mesh_clear()
 return Vector(tuple(min(p[k]for p in points)for k in range(3))),Vector(tuple(max(p[k]for p in points)for k in range(3)))
low,high=bounds();print('DEFAULT BOUNDS',list(low),list(high),'BONES',len(rig.data.bones),'RIG',rig.name,flush=True)
anchor=bpy.data.objects.new('SuitInspectionDisplay',None);s.collection.objects.link(anchor)
for o in objects:
 if o.parent not in objects:o.parent=anchor
k=1.74/(high.z-low.z);anchor.scale=(k,)*3;anchor.location=(-k*(high.x+low.x)/2,-k*(high.y+low.y)/2,-k*low.z);bpy.context.view_layer.update()
bpy.ops.mesh.primitive_plane_add(size=100);bpy.context.object.location.z=-.006
for pos,power in [((3,-4,6),1100),((-3,2,4),900)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=4;o.rotation_euler=(Vector((0,0,.85))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.25;target=Vector((0,0,.85));cam.location=target+Vector((6,-6,4.898979));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();s.camera=cam;s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.filepath=str(ROOT/'review/TacticalSuit-actual-default.png');bpy.ops.render.render(write_still=True)
default={b.name:{'p':list(rig.matrix_world@b.head),'q':list((rig.matrix_world@b.matrix).to_quaternion()),'basis':list(b.rotation_quaternion)}for b in rig.pose.bones}
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();lo,hi=bounds();print('BIND BOUNDS',list(lo),list(hi),flush=True);s.render.filepath=str(ROOT/'review/TacticalSuit-actual-bind.png');bpy.ops.render.render(write_still=True)
report={'meshSource':'DanlyVostok actual Military tactical suit (LowPolyGameReady), licensed mirror','model':'TacticalSuit_Normalized.glb','bones':len(rig.data.bones),'displayScale':k,'defaultBounds':[list(low),list(high)],'bindBounds':[list(lo),list(hi)],'hierarchy':{b.name:{'parent':b.parent.name if b.parent else None,'head':list(rig.matrix_world@b.head_local),'tail':list(rig.matrix_world@b.tail_local),'matrix':list(v for row in (rig.matrix_world@b.matrix_local)for v in row)}for b in rig.data.bones},'defaultPose':default};(ROOT/'validation/model-import.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/TacticalSuit_Imported.blend'))
