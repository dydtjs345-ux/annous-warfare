"""Check shared rest skeleton, initial weights, hierarchy and actual low-ready contact."""
import bpy,json,sys,math,hashlib,subprocess
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source/Russian_Infantry.blend'))
rig=bpy.data.objects['Russian_Infantry_Rig'];char=bpy.data.objects['Russian_Infantry_Character'];weapon=bpy.data.objects['AK74M_Separate_Weapon']
with bpy.data.libraries.load(str(ROOT.parent/'usmc-rifleman/source/USMC_Rifleman.blend'),link=False) as (src,dst):
 dst.objects=['USMC_Rifleman_Rig']
ref=dst.objects[0]
assert set(rig.data.bones.keys())==set(ref.data.bones.keys())
err=max(max(abs(a-b)for row1,row2 in zip(b.matrix_local,ref.data.bones[b.name].matrix_local)for a,b in zip(row1,row2)) for b in rig.data.bones)
assert err<1e-6
assert all((b.parent.name if b.parent else None)==(ref.data.bones[b.name].parent.name if ref.data.bones[b.name].parent else None) for b in rig.data.bones)
weight_error=max(abs(sum(g.weight for g in v.groups)-1)for v in char.data.vertices)
assert weight_error<1e-5 and max(len(v.groups)for v in char.data.vertices)<=4
assert char.parent==rig and any(m.type=='ARMATURE' and m.object==rig for m in char.modifiers)
assert weapon.parent is None and not weapon.vertex_groups and not any(m.type=='ARMATURE'for m in weapon.modifiers)
sockets={o.name:list(o.location)for o in weapon.children if o.type=='EMPTY'}
assert len(sockets)==6
assert bpy.data.objects['AK74M_Magazine'].parent==weapon
assert len(rig.animation_data.nla_tracks)==0 if rig.animation_data else True
result={'blender':bpy.app.version_string,'shared_skeleton':{'reference':'usmc-rifleman/source/USMC_Rifleman.blend','bones':len(rig.data.bones),'same_bone_names':True,'same_parents':True,'max_rest_matrix_difference':err},'weights':{'max_sum_error':weight_error,'max_influences':max(len(v.groups)for v in char.data.vertices)},'weapon':{'separate_mesh':True,'skinned':False,'sockets_local_metres':sockets},'a_pose':{'all_pose_basis_identity':all(all(abs(v-(1 if i==j else 0))<1e-6 for i,row in enumerate(b.matrix_basis)for j,v in enumerate(row)) for b in rig.pose.bones)},'geometry':{}}
import bmesh
for ob in [char,weapon,bpy.data.objects['AK74M_Magazine']]:
 bm=bmesh.new();bm.from_mesh(ob.data)
 result['geometry'][ob.name]={'loose_vertices':sum(not v.link_edges for v in bm.verts),'boundary_edges':sum(e.is_boundary for e in bm.edges),'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges),'finite_coordinates':all(math.isfinite(c)for v in bm.verts for c in v.co),'zero_area_faces':sum(f.calc_area()<1e-12 for f in bm.faces)}
 assert result['geometry'][ob.name]['loose_vertices']==0 and result['geometry'][ob.name]['finite_coordinates'] and result['geometry'][ob.name]['zero_area_faces']==0
 if ob!=char:assert all(e.is_manifold for e in bm.edges),('Open weapon surface',ob.name)
 bm.free()
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'isometric-evaluation/source/Russian_Infantry_LowReady.blend'))
char=bpy.data.objects['Russian_Infantry_Character'];weapon=bpy.data.objects['AK74M_Separate_Weapon'];rig=bpy.data.objects['Russian_Infantry_Rig']
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();ev=weapon.evaluated_get(dg);me=ev.to_mesh()
bvh=BVHTree.FromPolygons([weapon.matrix_world@v.co for v in me.vertices],[tuple(p.vertices)for p in me.polygons]);ev.to_mesh_clear()
ev=char.evaluated_get(dg);me=ev.to_mesh();contacts={}
for side in ['R','L']:
 ids={g.index for g in char.vertex_groups if (g.name.startswith('finger')or g.name.startswith('wrist'))and g.name.endswith('.'+side)}
 distances=[]
 for v in char.data.vertices:
  if sum(g.weight for g in v.groups if g.group in ids)>.5:
   p=char.matrix_world@me.vertices[v.index].co;hit=bvh.find_nearest(p)
   if hit[0] is not None:distances.append(hit[3])
 contacts[side]={'hand_vertices':len(distances),'min_surface_gap_m':min(distances),'vertices_within_5mm':sum(d<.005 for d in distances),'vertices_within_10mm':sum(d<.01 for d in distances)}
 assert min(distances)<.006 and sum(d<.005 for d in distances)>=3,('Hand lacks weapon contact',side,contacts[side])
ev.to_mesh_clear();result['low_ready_hand_contacts']=contacts
result['limits']=['Initial skin only; full movement and extreme-pose deformation not validated.','Character has open cloth, boot shafts, surface seams and anatomical cut boundaries; it is not watertight. Weapon and detachable magazine are closed.','Nearest-surface contact checks are not a full hand penetration or dynamic grip solve.','Weapon and magazine are separately addressable rigid meshes; internal bolt and trigger are not articulated.']
(ROOT/'validation/source-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
