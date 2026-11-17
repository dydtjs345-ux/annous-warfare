import bpy,json,sys,importlib.util,numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'));s=importlib.util.spec_from_file_location('cover_rig',ROOT/'tools/cover-rig.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);from fixtures import boxes
rows=[]
for weapon in ['M16A4','AK74M']:
 r=m.CoverRig(weapon)
 for stance in ['Stand','Crouch']:
  for style in ['Corner','Low','BlindCorner','BlindOver']:
   for side in ([1,-1]if style in ['Corner','BlindCorner']else[1]):
    for u in [0,.25,.5,.75,.85,1]:
     info=r.pose(u,side,stance,style);dg=bpy.context.evaluated_depsgraph_get();hits=[];headTop=-1;bodyMax=-1;minZ=100
     for o in [*r.meshes,r.weapon,r.mag]:
      e=o.evaluated_get(dg);mesh=e.to_mesh();a=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',a);a=a.reshape((-1,3));W=np.array(e.matrix_world);a=a@W[:3,:3].T+W[:3,3];e.to_mesh_clear();minZ=min(minZ,float(a[:,2].min()))
      if o in r.meshes:
       bodyMax=max(bodyMax,float(a[:,2].max()))
       if 'Head'in ''.join(x.name for x in o.data.materials if x):headTop=max(headTop,float(a[:,2].max()))
      for b in boxes(style,stance,side):
       lo=np.array(b['min']);hi=np.array(b['max']);inside=np.all((a>lo+1e-5)&(a<hi-1e-5),axis=1)
       if inside.any():hits.append({'mesh':o.name,'box':b['name'],'vertices':int(inside.sum()),'depthM':float(np.min(np.minimum(a[inside]-lo,hi-a[inside]),axis=1).max())})
     row={'weapon':weapon,'stance':stance,'style':style,'side':side,'u':u,'hits':hits,'bodyTopZ':bodyMax,'headTopZ':headTop,'minZ':minZ,**info};rows.append(row)
 (ROOT/'validation/draft-geometry-partial.json').write_text(json.dumps(rows,indent=2)+'\n')
(ROOT/'validation/draft-geometry.json').write_text(json.dumps(rows,indent=2)+'\n');print('POSES',len(rows),'collision samples',sum(bool(x['hits'])for x in rows),'reachFailures',sum(max(x['armReachExcessM'])>.0001 or max(x['wristErrorsM'])>.0001 for x in rows),'protected head',[(x['weapon'],x['stance'],x['style'],round(x['headTopZ'],3))for x in rows if x['u']==0],flush=True)
