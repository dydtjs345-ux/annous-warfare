"""Check the saved study against the immutable original mesh, including boots."""
import bpy,json,hashlib,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'validation/render-manifest.json').read_text())
char=bpy.data.objects['USMC_Rifleman_Character'];rig=bpy.data.objects['USMC_Rifleman_Rig']
digest=hashlib.sha256(b''.join(struct.pack('<3f',*v.co)for v in char.data.vertices)).hexdigest();assert digest==data['original_mesh_vertex_sha256']
ev=char.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
delta=max((mesh.vertices[v.index].co-v.co).length for v in char.data.vertices if v.co.z<.24);ev.to_mesh_clear();assert delta<1e-6
errors={s:(rig.pose.bones['wrist.'+s].head-__import__('mathutils').Vector(data['pose'][s]['wrist_target_metres'])).length for s in ['L','R']};assert max(errors.values())<.0001
assert len(data['native'])==64 and len(data['large'])==16
for f in data['native']:
 assert abs(f['opaque_height']-f['nominal_figure_height'])<=1
 assert (ROOT/f['file']).stat().st_size>100
for d in ['N','NE','E','SE','S','SW','W','NW']:
 for h in [40,60,80,120]:
  pair=[r for r in data['native']if r['direction']==d and r['nominal_figure_height']==h];assert len(pair)==2
  assert pair[0]['pivot']==pair[1]['pivot'] and pair[0]['width']==pair[1]['width'] and pair[0]['height']==pair[1]['height']
  assert pair[0]['opaque_height']==pair[1]['opaque_height']
result={'blender':bpy.app.version_string,'original_mesh_preserved':True,'boot_max_delta_metres':delta,'wrist_errors_metres':errors,'native_pairs':32,'native_images':64,'large_images':16}
(ROOT/'validation/saved-scene-check.json').write_text(json.dumps(result,indent=2)+'\n')
print('SAVED_SCENE_VALIDATED',result,flush=True)
