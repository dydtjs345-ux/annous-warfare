import bpy,sys,math,json
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'));from evaluate import evaluate,pose
sys.path.insert(0,str(ROOT.parent/'infantry-animation/tools'));from author_motion import Author
report=[]
for faction in ['USMC','Russian']:
 meta=json.loads((ROOT.parent/'tactical-reload/validation'/f'{faction}-authoring.json').read_text());D=meta['duration'];bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{faction}_FullBody.blend'));r=bpy.data.objects['InfantryRig'];ch=bpy.data.objects[faction+'_Character'];m=bpy.data.objects['Magazine'];s=bpy.data.objects['SpareMagazine'];w=bpy.data.objects['Weapon'];h=Author.__new__(Author);h.rig=r;_,anchor,_=h.hand_frame('L');local=r.data.bones['wrist.L'].matrix_local.inverted()@anchor;contact=Vector((.023,-.12,-.075));errors=[];weapons=[]
 pose(r,'Lower_AimStance','FB_AimIdle_Upper',0);reference={b.name:b.matrix.copy()for b in r.pose.bones};ends=[]
 for t in [0,D]:
  evaluate(r,m,s,'after','Reload',t,D);ends.append(max(abs(r.pose.bones[n].matrix[i][j]-M[i][j])for n,M in reference.items()for i in range(4)for j in range(4)))
 assert max(ends)<.00002,(faction,'Reload boundary',ends)
 for sample in meta['samples']:
  evaluate(r,m,s,'after','Reload',sample['time'],D);weapons.append((w.matrix_world.translation-Matrix(sample['weapon_world']).translation).length)
  if sample['left_contact']:
   ob=m if sample['phase']<1.43 else s;errors.append(((r.matrix_world@r.pose.bones['wrist.L'].matrix)@local-ob.matrix_world@contact).length)
 assert max(errors)<.0001 and max(weapons)<.0001,(faction,errors,weapons)
 events=[]
 for event,ob in [('old_hidden',m),('replacement_visible',s)]:
  evaluate(r,m,s,'after','Reload',meta['pouch_visibility_times'][event],D);ev=ch.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();bvh=BVHTree.FromPolygons([ch.matrix_world@v.co for v in mesh.vertices],[list(p.vertices)for p in mesh.polygons]);p,q,_=ob.matrix_world.decompose();M=Matrix.Translation(p)@q.to_matrix().to_4x4();points=[M@v.co for v in ob.data.vertices];counts=[]
  for angle in [225,180,135,90,45,0,315,270]:
   camera=Matrix.Rotation(math.radians(-angle),3,'Z')@Vector((6,-6,0))+Vector((0,0,5.749));count=0
   for point in points:
    v=point-camera
    if bvh.ray_cast(camera,v.normalized(),v.length-.001)[0]is None:count+=1
   counts.append(count)
  ev.to_mesh_clear();assert not any(counts),(faction,event,counts);events.append({'event':event,'visible_vertices_in_eight_directions':counts})
 report.append({'faction':faction,'max_source_magazine_contact_error_m':max(errors),'rifle_trajectory_preserved_error_m':max(weapons),'all_163_bones_match_aim_entry_exit_matrix_error':ends,'pouch_visibility_events':events});print('FULL_BODY_RELOAD_CONTACT_PASS',faction,flush=True)
(ROOT/'diagnostics/reload-contact.json').write_text(json.dumps(report,indent=2)+'\n')
