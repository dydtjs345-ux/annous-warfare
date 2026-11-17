import bpy,json,sys,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];s=importlib.util.spec_from_file_location('cover_rig',ROOT/'tools/cover-rig.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);r=m.CoverRig();points={}
for side,(o,i)in r.landmarks.items():points[side]={'mesh':o.name,'sourceVertex':i,'restWorldZUp':list(o.matrix_world@o.data.vertices[i].co)}
(ROOT/'validation/contact-reference.json').write_text(json.dumps(points,indent=2)+'\n');print(points)
