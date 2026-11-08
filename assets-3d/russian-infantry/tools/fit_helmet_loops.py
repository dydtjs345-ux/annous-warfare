"""Conform the six helmet cover tabs to the actual ellipsoid shell.
Apply to existing packed checkpoints without changing their UVs or materials.
"""
from pathlib import Path
import bpy,sys,math,bmesh
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from finish_infantry import export_assets

def fitted(side,phi,offset,head_shift):
 theta=.95+offset.y/.12;az=phi+offset.x/.10
 p=Vector((side*.119*math.sin(theta)*math.cos(az),.014+.143*math.sin(theta)*math.sin(az),1.705+.114*math.cos(theta)))
 n=Vector((p.x/.119**2,(p.y-.014)/.143**2,(p.z-1.705)/.114**2)).normalized()
 p+=n*(.0025+offset.z*.25);p.y+=head_shift;return p

if __name__=='__main__':
 for name in ['source/Russian_Infantry_Geometry.blend','source/Russian_Infantry.blend','isometric-evaluation/source/Russian_Infantry_LowReady.blend']:
  bpy.ops.wm.open_mainfile(filepath=str(ROOT/name));char=bpy.data.objects['Russian_Infantry_Character'];rig=bpy.data.objects['Russian_Infantry_Rig'];shift=rig.data.bones['head'].head_local.y-.014
  # Connected components prevent accidentally moving nearby helmet-cover vertices.
  adjacent=[set()for v in char.data.vertices]
  for e in char.data.edges:
   a,b=e.vertices;adjacent[a].add(b);adjacent[b].add(a)
  seen=set();components=[]
  for i in range(len(adjacent)):
   if i in seen:continue
   todo=[i];seen.add(i);ids=[]
   while todo:
    k=todo.pop();ids.append(k)
    for j in adjacent[k]:
     if j not in seen:seen.add(j);todo.append(j)
   if len(ids)<100:components.append(ids)
  changed=0
  for side in [-1,1]:
   for (yy,zz),phi in zip([(-.075,1.76),(.015,1.79),(.087,1.758)],[-.65,0,.65]):
    center=Vector((side*.102,yy+shift,zz));matches=[ids for ids in components if all(abs(char.data.vertices[k].co.x-center.x)<=.0051 and abs(char.data.vertices[k].co.y-center.y)<=.0131 and abs(char.data.vertices[k].co.z-center.z)<=.0041 for k in ids)]
    assert len(matches)==1,(name,side,yy,len(matches))
    for k in matches[0]:char.data.vertices[k].co=fitted(side,phi,char.data.vertices[k].co-center,shift)
    changed+=len(matches[0])
  bm=bmesh.new();bm.from_mesh(char.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(char.data);bm.free()
  if name=='source/Russian_Infantry.blend':export_assets(ROOT,char,bpy.data.objects['AK74M_Separate_Weapon'],rig)
  bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/name));print('FITTED_HELMET_TAB_VERTICES',changed,name,flush=True)
