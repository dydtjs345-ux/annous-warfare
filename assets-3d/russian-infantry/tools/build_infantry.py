"""Build an actual, meter-scale textured Russian infantry A-pose character and separate rifle.
Run: blender -b --factory-startup -t 4 --python tools/build_infantry.py
Original equipment geometry; anatomy/initial weights derive from credited CC0 data.
"""
import bpy, math, json, sys, os, bmesh
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
import modeling as M
from modeling import box,mesh,rod,cord,sphere,panel,ribbon
SRC=ROOT.parent/'usmc-rifleman/source/third-party';MODELS=ROOT/'models';TEX=ROOT/'textures';PRE=ROOT/'previews'
for p in [MODELS,TEX,PRE]:p.mkdir(exist_ok=True,parents=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
# Deterministic palette, geometry and texture nodes; no simulated/game data.
mat={
 'camo':M.material('EMR digital camouflage · cloth','465B32',.86,camo=True),
 'coyote':M.material('6B45 olive woven Cordura','4B5936',.82),
 'trim':M.material('Webbing and seam binding','35412A',.90),
 'thread':M.material('Olive stitching','6A7351',.9),
 'skin':M.material('Natural skin','B58B70',.62),
 'sclera':M.material('Natural sclera','C8BBA9',.42),
 'iris':M.material('Dark iris','353B32',.32),
 'glove':M.material('Olive tactical glove leather','3D4132',.78),
 'boot':M.material('Black leather combat boot','30332C',.9),
 'boot_panel':M.material('Reinforced leather panels','252B24',.88),
 'sole':M.material('Black boot moulded rubber','1C211C',.92),
 'rubber':M.material('Sole rubber and black hardware','48473F',.90),
 'metal':M.material('Parkerized receiver steel','292E30',.48,.85),
 'polymer':M.material('Matte rifle polymer','25282A',.73,.0),
 'lens':M.material('Dark ballistic lens','121C1F',.15,.15),
 'fastener':M.material('Hardware darkened steel','625B4E',.49,.65),
}
# Parse only actual topology; do not export MakeHuman helper/joint geometry.
raw=[];faces={};groups={};uv=[];group=''
for line in (SRC/'base.obj').read_text().splitlines():
 a=line.split()
 if not a:continue
 if a[0]=='v':raw.append(Vector(tuple(map(float,a[1:4]))))
 elif a[0]=='vt':uv.append(tuple(map(float,a[1:3])))
 elif a[0]=='g':group=a[1];faces.setdefault(group,[])
 elif a[0]=='f':faces.setdefault(group,[]).append([int(q.split('/')[0])-1 for q in a[1:]])
for fn,strength in [('male-young.target',1.0),('average-build.target',.8),('athletic-build.target',.2)]:
 for line in (SRC/fn).read_text().splitlines():
  if not line or line.startswith('#'):continue
  a=line.split();raw[int(a[0])]+=Vector(tuple(float(x)*strength for x in a[1:4]))
body_ids=sorted({i for f in faces['body'] for i in f});floor=min(raw[i].y for i in body_ids);height=max(raw[i].y for i in body_ids)-floor;scale=1.78/height
V=[Vector((p.x*scale,-p.z*scale,(p.y-floor)*scale)) for p in raw]
rigdata=json.loads((SRC/'default.mhskel').read_text());weights=json.loads((SRC/'default_weights.mhw').read_text())['weights']
pervertex={i:[] for i in body_ids}
for bone,ws in weights.items():
 for i,w in ws:
  if i in pervertex and w>0:pervertex[i].append((bone,w))
def normweights(ws):
 ws=sorted(ws,key=lambda a:-a[1])[:4];tot=sum(w for _,w in ws)
 return [(n,w/tot)for n,w in ws] if tot else [('root',1)]
pervertex={i:normweights(w)for i,w in pervertex.items()}
def handweight(i):return sum(w for n,w in pervertex[i] if n.startswith(('finger','metacarpal','wrist')))
kd=KDTree(len(body_ids))
for i in body_ids:kd.insert(V[i],i)
kd.balance()
def nearestweights(p):
 accum={}
 for _,i,d in kd.find_n(p,3):
  for n,w in pervertex[i]:accum[n]=accum.get(n,0)+w/(d*d+1e-6)
 return normweights(list(accum.items()))
def create_surface(name,source_faces,weightfn,materialfn,offset):
 ids=sorted({i for f in source_faces for i in f});index={old:k for k,old in enumerate(ids)}
 ob=mesh(name,[V[i] for i in ids],[[index[i]for i in f]for f in source_faces],None)
 ob.data.materials.clear()
 for m in [mat['camo'],mat['skin'],mat['glove']]:ob.data.materials.append(m)
 for p,f in zip(ob.data.polygons,source_faces):p.material_index=materialfn(f)
 if offset:
  for p in ob.data.vertices:p.co+=p.normal*offset
 vg={n:ob.vertex_groups.new(name=n) for n in rigdata['bones']}
 for i,old in enumerate(ids):
  for n,w in weightfn(old):
   if n in vg:vg[n].add([i],w,'REPLACE')
 return ob
# Detailed anatomical head and articulated five-finger gloved hands, not a mannequin.
visible=[f for f in faces['body'] if min(V[i].z for i in f)>1.49 or max(handweight(i)for i in f)>.16]
skin=create_surface('Anatomical head and five-finger gloved hands',visible,lambda i:pervertex[i],lambda f:2 if max(handweight(i)for i in f)>.16 else 1,.001)
# The quad clothing helper is a loose garment shell; transfer the actual body weights.
cloth=[]
for f in faces['helper-tights']:
 c=sum((V[i]for i in f),Vector())/len(f)
 if c.z<.18:continue
 if sum(w for n,w in nearestweights(c) if n.startswith(('finger','metacarpal','wrist')))>.22:continue
 cloth.append(f)
uniform=create_surface('Quad uniform shell with elbow and knee loops',cloth,lambda i:nearestweights(V[i]),lambda f:0,.012)
# Existing symmetric CC0 deformation rig, including fingers. No animation is invented.
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Russian_Infantry_Rig';bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
def joint(name):
 ids=rigdata['joints'][name];return sum((V[i]for i in ids),Vector())/len(ids)
for name,d in rigdata['bones'].items():
 b=rig.data.edit_bones.new(name);b.head=joint(d['head']);b.tail=joint(d['tail'])
 if (b.tail-b.head).length<.0001:b.tail.z+=.001
for name,d in rigdata['bones'].items():
 b=rig.data.edit_bones[name]
 if d['parent']:b.parent=rig.data.edit_bones[d['parent']]
 pole=Vector((0,-1,0))
 if abs((b.tail-b.head).normalized().dot(pole))>.95:pole=Vector((1,0,0))
 b.align_roll(pole)
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True;rig.data.display_type='OCTAHEDRAL'
# Give the garment its own cloth volume and joint folds, rather than painting a nude body.
sub=uniform.modifiers.new('Cloth fold support loops','SUBSURF');sub.subdivision_type='SIMPLE';sub.levels=1;M.apply(uniform,sub)
for v in uniform.data.vertices:
 p=v.co.copy();weights_v={uniform.vertex_groups[g.group].name:g.weight for g in v.groups}
 leg=sum(w for n,w in weights_v.items() if n.startswith(('upperleg','lowerleg')))
 arm=sum(w for n,w in weights_v.items() if n.startswith(('upperarm','lowerarm')))
 if leg>.2:
  centerx=.145 if p.x>0 else -.145
  radial=Vector((p.x-centerx,p.y-.005,0));theta=math.atan2(radial.y,radial.x)
  folds=math.exp(-((p.z-.53)/.11)**2)*math.sin((p.z-.53)*105+theta*1.4)*.0037
  folds+=math.exp(-((p.z-.26)/.06)**2)*math.sin(p.z*123+theta)*.003
  v.co+=v.normal*(.0035*leg+folds)
 if arm>.2:
  folds=.0028*math.sin(p.z*103+p.x*31)*math.exp(-((p.z-1.27)/.12)**2)
  v.co+=v.normal*(.002*arm+folds)
uniform.data.update()
garment_bvh=BVHTree.FromPolygons([v.co for v in uniform.data.vertices],[tuple(f.vertices)for f in uniform.data.polygons])
def garment_ray(origin,direction):
 hit=garment_bvh.ray_cast(Vector(origin),Vector(direction),3)[0]
 assert hit is not None,('No garment support',origin,direction)
 return hit
# Fit armour to this morphed human, not to an assumed world-origin torso.
front_body=garment_ray((0,-1,1.28),(0,1,0)).y;rear_body=garment_ray((0,1,1.28),(0,-1,0)).y
front_shift=front_body-.004+.135;rear_shift=rear_body+.004-.135
pack_shift=rear_body+.004+.041+.004-.157
# Fitted sleeve pockets duplicate the garment's actual curved surface. Never invent a
# fallback projection outside the sleeve: that produces floating corners in an A-pose.
def sleeve_patch(side):
 suffix='L' if side>0 else 'R';bone='upperarm02.'+suffix
 start=joint(rigdata['bones']['upperarm01.'+suffix]['head']);end=joint(rigdata['bones']['lowerarm01.'+suffix]['head']);axis=end-start
 chosen=[]
 for f in uniform.data.polygons:
  c=sum((uniform.data.vertices[i].co for i in f.vertices),Vector())/len(f.vertices);t=(c-start).dot(axis)/axis.length_squared
  if c.x*side>.18 and .22<t<.64 and f.normal.y<-.6:chosen.append(f)
 ids=sorted({i for f in chosen for i in f.vertices});lookup={i:j for j,i in enumerate(ids)}
 coords={i:uniform.data.vertices[i].co+uniform.data.vertices[i].normal*.003 for i in ids}
 mesh('Fitted sleeve cargo pocket',[coords[i]for i in ids],[[lookup[i]for i in f.vertices]for f in chosen],mat['camo'],bone)
 edges={}
 for f in chosen:
  for a,b in zip(f.vertices,list(f.vertices[1:])+[f.vertices[0]]):
   key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
 for (a,b),n in edges.items():
  if n==1:cord('Sleeve pocket bound seam',[coords[a],coords[b]],.0009,mat['thread'],bone)
for side in [-1,1]:sleeve_patch(side)
# Tailored carrier: curved cut-corner plates, not cuboid stand-ins.
outline=[(-.092,1.46),(.092,1.46),(.15,1.405),(.159,1.20),(.142,1.12),(.11,1.10),(-.11,1.10),(-.142,1.12),(-.159,1.20),(-.15,1.405)]
panel('6B45 front armoured vest',outline,(-.183+front_shift,-.135+front_shift),mat['coyote'],'spine02',.35,vertical=.25)
panel('6B45 rear armour panel',outline,(.135+rear_shift,.184+rear_shift),mat['coyote'],'spine02',-.30,vertical=-.09)
panel('6B45 lower abdominal protection',[(-.10,1.12),(.10,1.12),(.09,1.00),(.065,.975),(-.065,.975),(-.09,1.00)],(-.181+front_shift,-.151+front_shift),mat['camo'],'spine03',.4)
for sx in [-1,1]:
 cord('Abdominal protector seam',[(sx*.088,-.185+front_shift,1.10),(sx*.078,-.185+front_shift,1.015),(sx*.060,-.185+front_shift,.994)],.001,mat['thread'],'spine03')
cord('Carrier stitched perimeter',[(x,-.188+front_shift+.35*x*x+.25*max(0,z-1.28),z)for x,z in outline+[outline[0]]],.00115,mat['thread'],'spine02')
for side in [-1,1]:
 stations=[(.105,-.14+front_shift+.25*.144,1.424),(.13,-.11,None),(.145,-.07,None),(.15,-.03,None),(.15,.01,None),(.145,.05,None),(.105,.14+rear_shift-.09*.145,1.425)]
 vertices=[]
 for cx,y,anchor in stations:
  for j in range(5):
   x=side*(cx+(j/4-.5)*.053)
   z=anchor if anchor is not None else garment_ray((x,y,2),(0,0,-1)).z+.006
   vertices.append((x,y,z))
 strap=mesh('Surface fitted carrier shoulder strap',vertices,[(r*5+j,r*5+j+1,(r+1)*5+j+1,(r+1)*5+j)for r in range(len(stations)-1)for j in range(4)],mat['coyote'],'spine01')
 solid=strap.modifiers.new('Actual padded webbing thickness','SOLIDIFY');solid.thickness=.004;solid.offset=0;M.apply(strap,solid)
 for j in [0,4]:cord('Shoulder strap stitched border',[Vector(vertices[r*5+j])+Vector((0,0,.0025))for r in range(len(stations))],.0009,mat['thread'],'spine01')
 box('Quick release shoulder buckle',(side*.123,-.136+front_shift+.25*.14,1.42),(.045,.018,.035),mat['fastener'],'spine01',.004,rotation=(-math.atan(.25),0,0))
# Cummerbund follows actual ribcage contour; two parallel webbing rows.
for z in [1.145,1.19]:
 front=garment_ray((0,-1,z),(0,1,0)).y;back=garment_ray((0,1,z),(0,-1,0)).y;cy=(front+back)/2;points=[]
 for i in range(57):
  t=i*2*math.pi/56;direction=Vector((math.cos(t),math.sin(t),0));hit=garment_ray((0,cy,z),direction);points.append(hit+direction*.008)
 ribbon('Cummerbund perimeter webbing',points,.043,.005,mat['trim'],'spine03',width_axis=(0,0,1))
for z in [1.18,1.22,1.26,1.30,1.34,1.38]:
 for x in [-.12,-.08,-.04,0,.04,.08,.12]:
  box('Front MOLLE loop',(x,-.188+front_shift+.35*x*x+.25*max(0,z-1.28),z),(.034,.005,.012),mat['trim'],'spine02',.001,rotation=(-math.atan(.25)if z>1.28 else 0,0,0))
# Four tall AK magazine pouches with flaps, pull tabs and seam binding.
for x in [-.105,-.035,.035,.105]:
 box('AK magazine pouch',(x,-.206+front_shift,1.196),(.063,.070,.176),mat['coyote'],'spine02',.012)
 box('Magazine pouch flap',(x,-.245+front_shift,1.238),(.061,.009,.058),mat['trim'],'spine02',.006)
 box('Magazine pouch pull tab',(x,-.251+front_shift,1.205),(.015,.007,.032),mat['coyote'],'spine02',.002)
 cord('Pouch sewn binding',[(x-.029,-.242+front_shift,1.244),(x-.029,-.243+front_shift,1.129),(x+.029,-.243+front_shift,1.129),(x+.029,-.242+front_shift,1.244)],.0009,mat['thread'],'spine02')
 rod('Pouch snap',(x,-.251+front_shift,1.221),(x,-.253+front_shift,1.221),.004,mat['fastener'],'spine02',vertices=10)
for side in [-1,1]:
 box('Belt utility pouch',(side*.16,-.052,1.015),(.079,.092,.10),mat['coyote'],'root',.016)
 box('Utility pouch flap',(side*.16,-.101,1.044),(.074,.012,.046),mat['trim'],'root',.008)
 box('Thigh cargo pocket',(side*.209,-.012,.778),(.028,.12,.145),mat['camo'],'upperleg01.L' if side>0 else 'upperleg01.R',.009)
 box('Thigh cargo flap',(side*.225,-.012,.832),(.010,.128,.042),mat['camo'],'upperleg01.L' if side>0 else 'upperleg01.R',.006)
# IFAK/right; radio/left. Asymmetry is modeled, not a mirrored texture.
box('Right IFAK',(  .211,.085,1.055),(.078,.095,.125),mat['coyote'],'spine03',.018)
box('IFAK flap',(.252,.085,1.088),(.012,.09,.048),mat['trim'],'spine03',.005)
box('Left radio pouch',(-.194,.075,1.28),(.060,.074,.150),mat['trim'],'spine02',.01)
box('Radio housing',(-.194,.075,1.315),(.047,.058,.155),mat['rubber'],'spine02',.006)
cord('Flexible radio antenna',[(-.194,.086,1.39),(-.20,.092,1.49),(-.205,.10,1.58)],.0035,mat['rubber'],'spine02')
# Assault pack: soft rounded volumes, compression straps and zip tracks.
pack_start=len(M.CHAR)
box('Assault pack main', (0,.245,1.265),(.235,.162,.39),mat['coyote'],'spine02',.036)
box('Pack lower pocket',(0,.352,1.19),(.185,.065,.145),mat['coyote'],'spine02',.022)
box('Pack upper pocket',(0,.343,1.365),(.183,.052,.095),mat['coyote'],'spine02',.018)
for z in [1.15,1.23,1.34]:
 box('Backpack webbing',(0,.393 if z<1.28 else .375,z),(.173,.005,.013),mat['trim'],'spine02',.001)
for x in [-.09,.09]:
 ribbon('Pack vertical compression',[(x,.322,1.433),(x,.385,1.31),(x,.395,1.12)],.018,.003,mat['trim'],'spine02')
 box('Pack compression buckle',(x,.398,1.24),(.022,.011,.029),mat['fastener'],'spine02',.002)
cord('Pack zipper', [(-.112,.295,1.42),(-.10,.331,1.445),(0,.339,1.45),(.10,.331,1.445),(.112,.295,1.42)],.002,mat['rubber'],'spine02')
for sx in [-1,1]:
 cord('Pack panel stitched side seam',[(sx*.102,.337,1.412),(sx*.116,.341,1.36),(sx*.118,.341,1.17),(sx*.09,.335,1.107)],.0011,mat['thread'],'spine02')
 cord('Pack zipper pull',[(sx*.108,.326,1.437),(sx*.111,.344,1.412),(sx*.119,.345,1.424),(sx*.108,.326,1.437)],.0015,mat['trim'],'spine02')
 cord('Pack pocket stitched outline',[(sx*.084,.387,1.256),(sx*.092,.39,1.245),(sx*.092,.39,1.133),(sx*.08,.388,1.121)],.001,mat['thread'],'spine02')
ribbon('Pack lift handle',[(-.043,.288,1.442),(-.033,.279,1.475),(.033,.279,1.475),(.043,.288,1.442)],.014,.004,mat['trim'],'spine02',width_axis=(0,1,0))
for sx in [-1,1]:
 box('Patrol pack side pocket',(sx*.13,.252,1.23),(.057,.115,.205),mat['camo'],'spine02',.017)
 box('Side pocket lid',(sx*.13,.255,1.33),(.06,.12,.033),mat['trim'],'spine02',.006)
for ob in M.CHAR[pack_start:]:ob.location.y+=pack_shift
for x in [-.09,.09]:
 for z in [1.18,1.37]:
  plate_y=.176+rear_shift-.30*x*x-.09*max(0,z-1.28);pack_y=.157+pack_shift
  ribbon('Pack MOLLE attachment tab',[(x,plate_y-.002,z+.014),(x,pack_y+.003,z+.014),(x,pack_y+.003,z-.014),(x,plate_y-.002,z-.014)],.024,.003,mat['trim'],'spine02')
# Helmet dome has physical thickness and an ear/back skirt with a forward brow.
hc=Vector((0,.014,1.705));rx,ry,rz=.119,.143,.114;segments=48;rings=12;verts=[]
for inner in [False,True]:
 for j in range(rings+1):
  u=(j+.06)/(rings+.06)
  for i in range(segments):
   phi=2*math.pi*i/segments;edge=1.60+.38*(1+math.sin(phi))/2;theta=u*edge
   off=.004 if inner else 0
   verts.append((hc.x+(rx-off)*math.sin(theta)*math.cos(phi),hc.y+(ry-off)*math.sin(theta)*math.sin(phi),hc.z+(rz-off)*math.cos(theta)))
f=[];count=(rings+1)*segments
for k in [0,1]:
 for j in range(rings):
  for i in range(segments):
   a=k*count+j*segments+i;b=k*count+j*segments+(i+1)%segments;c=b+segments;d=a+segments
   f.append((a,b,c,d)if not k else(d,c,b,a))
for i in range(segments):a=rings*segments+i;b=rings*segments+(i+1)%segments;f.append((a,a+count,b+count,b))
# Close the small pole rings as well as the lower rim; no pinhole through the cap.
f.append(tuple(range(segments-1,-1,-1)));f.append(tuple(count+i for i in range(segments)))
mesh('Helmet covered shell',verts,f,mat['camo'],'head')
rim=[]
for i in range(segments+1):
 phi=2*math.pi*i/segments;th=1.60+.38*(1+math.sin(phi))/2;rim.append((rx*math.sin(th)*math.cos(phi),hc.y+ry*math.sin(th)*math.sin(phi),hc.z+rz*math.cos(th)))
cord('Helmet bound rim',rim,.0035,mat['trim'],'head')
# 6B47 cover retention band and fabric foliage loops, all under head bone.
for sx in [-1,1]:
 for (yy,zz),phi in zip([(-.075,1.76),(.015,1.79),(.087,1.758)],[-.65,0,.65]):
  ob=box('6B47 cover foliage loop',(sx*.102,yy,zz),(.010,.026,.008),mat['trim'],'head',.002)
  from fit_helmet_loops import fitted
  for v in ob.data.vertices:v.co=fitted(sx,phi,v.co,0)-ob.location
cord('Helmet cover retention band',[(.116*math.cos(t),.014+.142*math.sin(t),1.713+.01*math.sin(t)) for t in [i*2*math.pi/64 for i in range(65)]],.0035,mat['trim'],'head')
# Stowed protective goggles give a functional silhouette at the front of helmet.
box('Goggle padded frame',(0,-.127,1.749),(.148,.022,.046),mat['rubber'],'head',.012)
box('Goggle dark protective lens',(0,-.141,1.749),(.130,.006,.030),mat['lens'],'head',.008)
for side in [-1,1]:
 cord('Helmet chin strap',[(side*.102,-.014,1.694),(side*.095,-.035,1.62),(side*.067,-.084,1.565),(side*.025,-.113,1.557)],.005,mat['trim'],'head')
 box('Chin strap adjuster',(side*.095,-.047,1.61),(.013,.012,.024),mat['fastener'],'head',.002)
ribbon('Helmet under-chin cup',[(-.026,-.113,1.557),(-.014,-.107,1.554),(0,-.104,1.553),(.014,-.107,1.554),(.026,-.113,1.557)],.013,.003,mat['trim'],'head',width_axis=(0,0,1))
# Boots are foot-shaped lofts with shafts, laces, soles, toe seams and treads.
for side in [-1,1]:
 bone='foot.L' if side>0 else 'foot.R';ankle=joint(rigdata['bones'][bone]['head']);cx=ankle.x
 ang=side*math.radians(-6)
 def pt(x,y,z):return(cx+x*math.cos(ang)-y*math.sin(ang),ankle.y+x*math.sin(ang)+y*math.cos(ang),z)
 # Shoe upper: varying cross-sections along the foot, not an ellipsoid/cube foot.
 sections=[(.065,.039,.145),(.035,.049,.18),(-.02,.054,.195),(-.09,.058,.12),(-.17,.058,.086),(-.23,.043,.064),(-.246,.012,.05)]
 def foot_section(y):
  for (ya,wa,ta),(yb,wb,tb) in zip(sections,sections[1:]):
   if yb<=y<=ya:
    t=(ya-y)/(ya-yb);return wa+(wb-wa)*t,ta+(tb-ta)*t
  return (sections[0][1],sections[0][2])if y>sections[0][0]else(sections[-1][1],sections[-1][2])
 vv=[];ff=[];n=9
 for y,w,top in sections:
  for i in range(n):
   # A D-shaped upper meets a flat footbed. An oval cross-section touches only
   # along its centre and visibly floats above the sole at both sides.
   t=math.pi*i/(n-1);vv.append(pt(w*math.cos(t),y,.031+(top-.031)*max(0,math.sin(t))))
 for j in range(len(sections)-1):
  for i in range(n):ff.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 ff += [tuple(range(n-1,-1,-1)),tuple((len(sections)-1)*n+i for i in range(n))]
 mesh('Combat boot shaped upper',vv,ff,mat['boot'],bone)
 # Shaft rings. Top of trouser overlaps the collar naturally.
 vv=[];ff=[]
 for j,z in enumerate([.10,.14,.185,.228]):
  for i in range(20):t=2*math.pi*i/20;vv.append(pt((.05-j*.001)*math.cos(t),.002+.055*math.sin(t),z))
 for j in range(3):
  for i in range(20):ff.append((j*20+i,j*20+(i+1)%20,(j+1)*20+(i+1)%20,(j+1)*20+i))
 mesh('Boot ankle shaft',vv,ff,mat['boot'],bone)
 # Padded collar, shaped tongue and overlaid quarters give a real boot silhouette.
 cord('Padded boot collar',[pt(.051*math.cos(t),.002+.055*math.sin(t),.225)for t in [i*2*math.pi/32 for i in range(33)]],.004,mat['boot_panel'],bone)
 tongue=[]
 for j in range(9):
  z=.122+j*.013;y=-.100+j*.005
  tongue.extend([pt(-.026,y+.003,z),pt(.026,y+.003,z)])
 mesh('Boot articulated tongue',tongue,[(j*2,j*2+1,j*2+3,j*2+2)for j in range(8)],mat['boot_panel'],bone)
 def outer_x(y,z):
  w,top=foot_section(y);h=(z-.031)/(top-.031);x=w*math.sqrt(max(0,1-h*h))if 0<=h<=1 else 0
  u=(y-.002)/.055
  if .10<=z<=.228 and abs(u)<=1:
   shaftx=(.05-.003*(z-.1)/.128)*math.sqrt(max(0,1-u*u));x=max(x,shaftx)
  assert x>0,('Boot panel has no supporting surface',y,z)
  return x
 for sx in [-1,1]:
  # Sample the actual upper/shaft union, instead of floating planar triangles.
  ys=[-.17,-.13,-.10,-.075,-.052,-.03,-.005,.02,.038,.05];vpanel=[]
  for y in ys:
   _,top=foot_section(y);high=.21 if -.049<y<.049 else .031+.60*(top-.031)
   for k in range(5):
    z=.044+(high-.044)*k/4;vpanel.append(pt(sx*(outer_x(y,z)+.0012),y,z))
  fp=[(j*5+k,(j+1)*5+k,(j+1)*5+k+1,j*5+k+1)for j in range(len(ys)-1)for k in range(4)]
  mesh('Fitted suede boot quarter',vpanel,fp,mat['boot_panel'],bone)
  for k in [0,4]:cord('Boot quarter stitched edge',[vpanel[j*5+k]for j in range(len(ys))],.0009,mat['thread'],bone)
  # Eyelet stays join the laced throat to the actual ankle shell on both sides.
  stay=[]
  for j in range(8):
   z=.126+j*.013;y=-.103+j*.005
   stay.extend([pt(sx*.035,y+.001,z),pt(sx*(outer_x(.002,z)+.0012),.002,z)])
  mesh('Boot lace eyelet stay',stay,[(j*2,j*2+1,j*2+3,j*2+2)for j in range(7)],mat['boot_panel'],bone)
 # Twin heel seams continue above the ankle, not a smooth slipper heel.
 for sx in [-1,1]:cord('Boot heel stitching',[pt(sx*(outer_x(.045,z)+.0014),.045,z)for z in [.053,.14,.213]],.001,mat['trim'],bone)
 # Sole follows an asymmetric toe/heel footprint.
 right=[(0,.077),(.043,.072),(.055,.035),(.060,-.02),(.064,-.09),(.063,-.17),(.049,-.23),(.021,-.247),(0,-.256)]
 outline=right+[(-x,y)for x,y in reversed(right[1:-1])]
 vv=[pt(x,y,z)for z in [.005,.033]for x,y in outline];n=len(outline);ff=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
 ff +=[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
 mesh('Rubber outsole',vv,ff,mat['sole'],bone)
 for j in range(8):
  z=.126+j*.013;y=-.103+j*.005
  for x in [-.035,.035]:sphere('Boot eyelet',pt(x,y,z),(.003,.002,.003),mat['fastener'],bone,segments=8,rings=4)
  if j<7:
   cord('Crossed boot lace',[pt(-.033,y-.004,z),pt(.033,y+.001,z+.013)],.0013,mat['trim'],bone)
   cord('Crossed boot lace',[pt(.033,y-.004,z),pt(-.033,y+.001,z+.013)],.0013,mat['trim'],bone)
 for j in range(7):
  for x in [-.032,.032]:box('Outsole tread lug',pt(x,-.20+j*.039,.007),(.029,.022,.010),mat['sole'],bone,.002,rotation=(0,0,ang))
 seam=[]
 for f in [-.9,-.6,0,.6,.9]:
  y=-.17-.012*(1-abs(f));w,top=foot_section(y);seam.append(pt(f*w,y,.032+(top-.031)*math.sqrt(1-f*f)))
 cord('Boot toe seam',seam,.0011,mat['trim'],bone)
 cord('Boot welt stitch',[pt(x,y,.034)for x,y in outline+[outline[0]]],.001,mat['thread'],bone)
# Separate visible practical tactical belt, following the hip outline.
cord('Tactical belt body',[(.183*math.cos(t),.015+.123*math.sin(t),1.024) for t in [i*2*math.pi/64 for i in range(65)]],.012,mat['trim'],'root')
box('Tactical belt buckle',(0,-.112,1.024),(.047,.010,.032),mat['fastener'],'root',.003)
# Wrist seam bands and shoulder pocket panels follow the A-pose arm directions.
for side in ['L','R']:
 wrist=joint(rigdata['bones']['wrist.'+side]['head']);elbow=joint(rigdata['bones']['lowerarm01.'+side]['head'])
 direction=(wrist-elbow).normalized();u=direction.cross(Vector((0,-1,0))).normalized();v=direction.cross(u)
 points=[tuple(wrist-direction*.018+(u*math.cos(t)+v*math.sin(t))*.037)for t in [i*2*math.pi/24 for i in range(25)]]
 cord('Sleeve cuff sewn band',points,.003,mat['trim'],'lowerarm02.'+side)
 # Knuckle pad, gloved hand anatomy already has five separate articulated fingers.
 hand=joint(rigdata['bones']['wrist.'+side]['tail']);box('Glove dorsal reinforcement',(hand.x,hand.y+.009,hand.z),(.043,.012,.043),mat['trim'],'wrist.'+side,.008)
# No role-specific torso meshes: role changes use the weapon socket.
# AK-74M, real 0.943 m overall length. Local grip origin, muzzle -Y, Z up.
w=lambda *args,**kw:box(*args,weapon=True,**kw)
def profile(name,outline,width,material):
 n=len(outline);v=[(x,y,z)for x in [-width/2,width/2]for y,z in outline]
 f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
 ob=mesh(name,v,f,material,weapon=True);be=ob.modifiers.new('Machined edge','BEVEL');be.width=.001;be.segments=2;M.apply(ob,be)
 return ob
profile('AK stamped receiver',[(.095,.045),(.095,.103),(-.142,.103),(-.155,.075),(-.13,.039),(.045,.035)],.035,mat['metal'])
# Rounded removable stamped dust cover.
rod('AK receiver dust cover',(0,.085,.103),(0,-.121,.103),.019,mat['metal'],weapon=True,vertices=16)
profile('AK74M solid side folding polymer stock',[(.09,.10),(.346,.09),(.346,-.016),(.319,-.031),(.182,.007),(.112,.035)],.035,mat['polymer'])
w('Textured stock buttplate',(0,.346,.03),(.040,.009,.118),mat['rubber'],bevel=.003)
w('Stock hinge',(0,.094,.072),(.045,.021,.062),mat['metal'],bevel=.002)
profile('AK polymer pistol grip',[(.042,.04),(.070,.028),(.102,-.074),(.064,-.086),(.021,.014)],.031,mat['polymer'])
for sx in [-1,1]:
 for z in [-.025,-.037,-.049,-.061]:
  cord('Grip moulded checkering',[(sx*.016,.046-z*.4,z),(sx*.016,.074-z*.30,z+.003)],.0007,mat['rubber'],weapon=True)
cord('AK trigger guard',[(-.012,.024,.036),(-.012,.022,-.014),(-.012,-.030,-.015),(-.012,-.052,.034)],.0025,mat['metal'],weapon=True)
cord('AK curved trigger',[(0,-.005,.031),(0,-.013,.012),(0,-.005,.002)],.002,mat['metal'],weapon=True)
profile('AK74 30 round curved polymer magazine',[(-.063,.047),(-.125,.047),(-.137,-.025),(-.154,-.101),(-.188,-.176),(-.135,-.194),(-.095,-.116),(-.074,-.029)],.026,mat['polymer'])
for sx in [-1,1]:
 for y in [-.086,-.101,-.116]:
  cord('Magazine reinforcement rib',[(sx*.014,y,.02),(sx*.014,y-.012,-.058),(sx*.014,y-.048,-.16)],.0013,mat['rubber'],weapon=True)
profile('AK lower handguard',[(-.14,.043),(-.296,.047),(-.306,.082),(-.15,.095)],.043,mat['polymer'])
rod('AK gas tube',(0,-.151,.117),(0,-.317,.117),.011,mat['metal'],weapon=True,vertices=12)
w('AK upper handguard',(0,-.222,.119),(.034,.126,.026),mat['polymer'],bevel=.008)
for sx in [-1,1]:
 for y in [-.175,-.201,-.227,-.253,-.279]:
  w('Handguard cooling recess',(sx*.022,y,.074),(.002,.014,.008),mat['rubber'],bevel=.001)
rod('AK barrel',(0,-.30,.081),(0,-.552,.081),.007,mat['metal'],weapon=True,vertices=16)
rod('AK74 muzzle brake rear chamber',(0,-.552,.081),(0,-.575,.081),.012,mat['metal'],weapon=True,vertices=16)
rod('AK74 muzzle brake front chamber',(0,-.575,.081),(0,-.593,.081),.012,mat['metal'],weapon=True,vertices=16)
for sx in [-1,1]:
 for y in [-.562,-.581]:w('Muzzle brake lateral port',(sx*.012,y,.081),(.0015,.009,.008),mat['rubber'],bevel=.0003)
# Characteristic angled gas block, cleaning rod and hooded front sight.
rod('Angled gas block',(0,-.322,.081),(0,-.305,.123),.011,mat['metal'],weapon=True,vertices=10)
rod('Cleaning rod',(0,-.29,.060),(0,-.536,.060),.002,mat['metal'],weapon=True,vertices=8)
profile('AK front sight tower',[(-.494,.081),(-.516,.081),(-.511,.151),(-.499,.151)],.016,mat['metal'])
for sx in [-1,1]:rod('Front sight protective ear',(sx*.008,-.505,.139),(sx*.009,-.505,.166),.0025,mat['metal'],weapon=True,vertices=10)
rod('Front sight blade',(0,-.505,.144),(0,-.505,.163),.0015,mat['metal'],weapon=True,vertices=8)
w('Rear sight block',(0,-.137,.129),(.029,.051,.023),mat['metal'],bevel=.002)
w('Tangent rear sight leaf',(0,-.13,.143),(.017,.052,.005),mat['metal'],bevel=.001)
for sx in [-1,1]:
 for yy in [.069,-.08,-.12]:rod('Receiver rivet',(sx*.0175,yy,.061),(sx*.020,yy,.061),.0023,mat['fastener'],weapon=True,vertices=8)
w('Ejection port',( .020,-.038,.102),(.003,.074,.017),mat['rubber'],bevel=.001)
cord('Charging handle',[(.018,-.008,.103),(.039,-.008,.104),(.045,-.003,.104)],.0035,mat['metal'],weapon=True)
cord('AK right selector lever',[(.021,.06,.077),(.022,-.053,.061),(.023,-.062,.065)],.0022,mat['metal'],weapon=True)
w('AK left optic dovetail',(-.021,.0,.070),(.007,.105,.013),mat['metal'],bevel=.001)
for yy in [-.29,.115]:
 cord('Sling swivel',[(.021,yy,.069),(.029,yy,.064),(.029,yy-.015,.064),(.021,yy-.015,.069)],.0016,mat['metal'],weapon=True)
# Anatomical fit: the head leans forward relative to the torso's world origin.
head_y=joint(rigdata['bones']['head']['head']).y
for ob in M.CHAR:
 if ob not in [skin,uniform] and ob.vertex_groups.get('head'):
  ob.location.y+=head_y-.014
for side in ['L','R']:
 eye=joint(rigdata['bones']['eye.'+side]['head'])
 sphere('Anatomical eyeball',eye,(.0118,.0118,.0118),mat['sclera'],'eye.'+side,segments=20,rings=12)
 sphere('Iris',(eye.x,eye.y-.0114,eye.z),(.0048,.001,.0048),mat['iris'],'eye.'+side,segments=16,rings=8)
# Raised collar and helmet cover stitching follow the actual neck/head.
vv=[];ff=[];nn=28
for z in [1.505,1.548]:
 for i in range(nn):
  t=-math.pi/2+.16+i*(2*math.pi-.32)/(nn-1);vv.append((.063*math.cos(t),-.023+.065*math.sin(t),z))
for i in range(nn-1):ff.append((i,i+1,nn+i+1,nn+i))
mesh('EMR jacket stand collar',vv,ff,mat['camo'],'neck01')
for xx in [-.042,.042]:
 points=[]
 for j in range(27):
  t=-1.45+j*3.15/26;points.append((xx,head_y+.134*math.sin(t),1.705+.112*math.cos(t)))
 cord('Helmet cover stitched panel seam',points,.00085,mat['thread'],'head')
# Tag the magazine before baking so it can be detached without losing UVs/PBR.
for ob in M.WEAPON:
 if ob.name.startswith(('AK74 30 round','Magazine reinforcement')):
  g=ob.vertex_groups.new(name='part_magazine');g.add(range(len(ob.data.vertices)),1,'REPLACE')
character=M.join(M.CHAR,'Russian_Infantry_Character');weapon=M.join(M.WEAPON,'AK74M_Separate_Weapon')
# Blender curve end caps are coincident, disconnected rings after conversion.
# Weld those shared endpoints on the rigid weapon, preserving the real surfaces.
bm=bmesh.new();bm.from_mesh(weapon.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bmesh.ops.delete(bm,geom=[f for f in bm.faces if len(f.verts)>8 and all(abs(v.co.y+.575)<1e-6 for v in f.verts)],context='FACES_ONLY');bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(weapon.data);bm.free()
# Limit every deform vertex to four normalized influences.
for vert in character.data.vertices:
 weights_v=sorted([(g.group,g.weight)for g in vert.groups],key=lambda a:-a[1])[:4];tot=sum(w for _,w in weights_v)
 if not tot:
  g=character.vertex_groups.get('root')or character.vertex_groups.new(name='root');g.add([vert.index],1,'REPLACE')
 else:
  for g in list(vert.groups):character.vertex_groups[g.group].remove([vert.index])
  for i,w in weights_v:character.vertex_groups[i].add([vert.index],w/tot,'REPLACE')
mod=character.modifiers.new('Initial CC0-derived deformation skin','ARMATURE');mod.object=rig;character.parent=rig
character['units']='metres';character['pose']='neutral A-pose';character['anatomy_source']='MakeHuman CC0 hm08 + male/athletic targets; provenance included';character['rig_status']='initial reference skin; not a final animation rig'
weapon['asset_role']='independent weapon mesh, origin at grip, muzzle points -Y';weapon['weapon_balance']='visual asset only; no combat data'
# Park weapon beside the character only in the kit scene; individual export resets it.
weapon.location=(.94,0,.92)
# Save geometry before bakes so an interrupted render cannot lose the actual model.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/Russian_Infantry_Geometry.blend'))
print('GEOMETRY_SAVED',len(character.data.vertices),'vertices',len(character.data.polygons),'polygons',flush=True)
# Separate pipeline stage: baking, exports and actual preview renders.
sys.path.insert(0,str(ROOT/'tools'))
if not os.environ.get('AW_GEOMETRY_ONLY'):
 import finish_infantry
 finish_infantry.finish(ROOT,character,weapon,rig)
