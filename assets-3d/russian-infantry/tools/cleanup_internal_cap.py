"""Remove the invisible redundant cap between joined muzzle-brake chambers.
This keeps geometry manifold without changing any exterior surface or UV.
"""
from pathlib import Path
import bpy,bmesh,sys,json
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from finish_infantry import export_assets
for name in ['source/Russian_Infantry_Geometry.blend','source/Russian_Infantry.blend','isometric-evaluation/source/Russian_Infantry_LowReady.blend']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/name));weapon=bpy.data.objects['AK74M_Separate_Weapon']
 bm=bmesh.new();bm.from_mesh(weapon.data)
 faces=[f for f in bm.faces if len(f.verts)>8 and all(abs(v.co.y+.575)<1e-6 for v in f.verts)]
 bmesh.ops.delete(bm,geom=faces,context='FACES_ONLY');bm.to_mesh(weapon.data);bm.free()
 if name=='source/Russian_Infantry.blend':
  export_assets(ROOT,bpy.data.objects['Russian_Infantry_Character'],weapon,bpy.data.objects['Russian_Infantry_Rig'])
  stats=json.loads((ROOT/'geometry-stats.json').read_text())
  for ob in [bpy.data.objects['Russian_Infantry_Character'],weapon,bpy.data.objects['AK74M_Magazine']]:
   ob.data.calc_loop_triangles();stats[ob.name].update(vertices=len(ob.data.vertices),faces=len(ob.data.polygons),triangles=len(ob.data.loop_triangles))
  (ROOT/'geometry-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/name))
print('INTERNAL_CAP_CLEANUP_AND_FINAL_EXPORT_FINISHED')
