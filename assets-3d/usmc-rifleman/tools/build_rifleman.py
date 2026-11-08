"""Build an actual, meter-scale textured USMC A-pose character and separate rifle.
Run: blender -b --factory-startup -t 4 --python tools/build_rifleman.py
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
SRC=ROOT/'source/third-party';MODELS=ROOT/'models';TEX=ROOT/'textures';PRE=ROOT/'previews'
for p in [MODELS,TEX,PRE]:p.mkdir(exist_ok=True,parents=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
# Deterministic palette, geometry and texture nodes; no simulated/game data.
mat={
 'camo':M.material('Desert digital camouflage · cloth','B4A181',.86,camo=True),
 'coyote':M.material('Coyote woven Cordura','9B835E',.82),
 'trim':M.material('Webbing and seam binding','756144',.90),
 'thread':M.material('Sand stitching','BBA685',.9),
 'skin':M.material('Natural skin','B58B70',.62),
 'sclera':M.material('Natural sclera','C8BBA9',.42),
 'iris':M.material('Dark iris','353B32',.32),
 'glove':M.material('Tan tactical glove leather','8D795B',.78),
 'boot':M.material('Desert suede boot','AA9472',.9),
 'boot_panel':M.material('Reinforced suede panels','8F7B5D',.88),
 'sole':M.material('Desert boot moulded rubber','726C59',.92),
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
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='USMC_Rifleman_Rig';bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
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
outline=[(-.101,1.445),(.101,1.445),(.139,1.39),(.145,1.158),(.131,1.125),(.105,1.112),(-.105,1.112),(-.131,1.125),(-.145,1.158),(-.139,1.39)]
panel('Front curved plate carrier',outline,(-.175,-.135),mat['coyote'],'spine02',.35)
panel('Rear curved plate carrier',outline,(.135,.176),mat['coyote'],'spine02',-.30)
cord('Carrier stitched perimeter',[(x,-.18+.35*x*x,z)for x,z in outline+[outline[0]]],.00115,mat['thread'],'spine02')
for side in [-1,1]:
 ribbon('Carrier shoulder strap',[(side*.112,-.14,1.424),(side*.155,-.07,1.462),(side*.156,.015,1.465),(side*.12,.14,1.425)],.053,.008,mat['coyote'],'spine01')
 box('Quick release shoulder buckle',(side*.123,-.136,1.42),(.045,.018,.035),mat['fastener'],'spine01',.004)
# Cummerbund follows actual ribcage contour; two parallel webbing rows.
for z in [1.145,1.19]:
 points=[(.216*math.cos(t),.153*math.sin(t),z)for t in [i*2*math.pi/56 for i in range(57)]]
 ribbon('Cummerbund perimeter webbing',points,.043,.005,mat['trim'],'spine03',width_axis=(0,0,1))
for z in [1.18,1.22,1.26,1.30,1.34,1.38]:
 for x in [-.12,-.08,-.04,0,.04,.08,.12]:
  box('Front MOLLE loop',(x,-.179+.35*x*x,z),(.034,.005,.012),mat['trim'],'spine02',.001)
# Three double-magazine pouches with flaps, pull tabs and seam binding.
for x in [-.083,0,.083]:
 box('Double magazine pouch',(x,-.205,1.19),(.075,.070,.145),mat['coyote'],'spine02',.012)
 box('Magazine pouch flap',(x,-.245,1.238),(.073,.009,.050),mat['trim'],'spine02',.006)
 box('Magazine pouch pull tab',(x,-.251,1.205),(.015,.007,.032),mat['coyote'],'spine02',.002)
 cord('Pouch sewn binding',[(x-.029,-.242,1.244),(x-.029,-.243,1.129),(x+.029,-.243,1.129),(x+.029,-.242,1.244)],.0009,mat['thread'],'spine02')
 rod('Pouch snap',(x,-.251,1.221),(x,-.253,1.221),.004,mat['fastener'],'spine02',vertices=10)
for side in [-1,1]:
 box('Belt utility pouch',(side*.16,-.052,1.015),(.079,.092,.10),mat['coyote'],'root',.016)
 box('Utility pouch flap',(side*.16,-.101,1.044),(.074,.012,.046),mat['trim'],'root',.008)
 box('Thigh cargo pocket',(side*.209,-.012,.778),(.028,.12,.145),mat['camo'],'upperleg01.L' if side>0 else 'upperleg01.R',.009)
 box('Thigh cargo flap',(side*.225,-.012,.832),(.010,.128,.042),mat['camo'],'upperleg01.L' if side>0 else 'upperleg01.R',.006)
# IFAK/right; radio/left. Asymmetry is modeled, not a mirrored texture.
box('Right IFAK',( .223,.055,1.075),(.078,.095,.125),mat['coyote'],'spine03',.018)
box('IFAK flap',(.264,.055,1.108),(.012,.09,.048),mat['trim'],'spine03',.005)
box('Left radio pouch',(-.214,.047,1.282),(.060,.074,.150),mat['trim'],'spine02',.01)
box('Radio housing',(-.214,.047,1.315),(.047,.058,.155),mat['rubber'],'spine02',.006)
cord('Flexible radio antenna',[(-.214,.058,1.39),(-.22,.063,1.55),(-.23,.075,1.72)],.0035,mat['rubber'],'spine02')
# Assault pack: soft rounded volumes, compression straps and zip tracks.
box('Assault pack main', (0,.245,1.265),(.263,.176,.36),mat['coyote'],'spine02',.036)
box('Pack lower pocket',(0,.352,1.19),(.203,.075,.155),mat['coyote'],'spine02',.022)
box('Pack upper pocket',(0,.343,1.365),(.198,.052,.095),mat['coyote'],'spine02',.018)
for z in [1.13,1.20,1.28,1.35,1.405]:
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
# Helmet dome has physical thickness and an ear/back skirt with a forward brow.
hc=Vector((0,.014,1.705));rx,ry,rz=.113,.139,.12;segments=48;rings=12;verts=[]
for inner in [False,True]:
 for j in range(rings+1):
  u=(j+.06)/(rings+.06)
  for i in range(segments):
   phi=2*math.pi*i/segments;edge=1.53+.35*(1+math.sin(phi))/2;theta=u*edge
   off=.004 if inner else 0
   verts.append((hc.x+(rx-off)*math.sin(theta)*math.cos(phi),hc.y+(ry-off)*math.sin(theta)*math.sin(phi),hc.z+(rz-off)*math.cos(theta)))
f=[];count=(rings+1)*segments
for k in [0,1]:
 for j in range(rings):
  for i in range(segments):
   a=k*count+j*segments+i;b=k*count+j*segments+(i+1)%segments;c=b+segments;d=a+segments
   f.append((a,b,c,d)if not k else(d,c,b,a))
for i in range(segments):a=rings*segments+i;b=rings*segments+(i+1)%segments;f.append((a,a+count,b+count,b))
mesh('Helmet covered shell',verts,f,mat['camo'],'head')
rim=[]
for i in range(segments+1):
 phi=2*math.pi*i/segments;th=1.53+.35*(1+math.sin(phi))/2;rim.append((rx*math.sin(th)*math.cos(phi),hc.y+ry*math.sin(th)*math.sin(phi),hc.z+rz*math.cos(th)))
cord('Helmet bound rim',rim,.0035,mat['trim'],'head')
box('NVG bracket plate',(0,-.121,1.747),(.041,.013,.053),mat['fastener'],'head',.004)
box('NVG dovetail mount',(0,-.133,1.746),(.023,.015,.029),mat['rubber'],'head',.003)
for x in [-.015,.015]:
 for z in [1.728,1.766]:rod('Mount bolt',(x,-.132,z),(x,-.137,z),.003,mat['metal'],'head',vertices=10)
for side in [-1,1]:
 cord('Helmet chin strap',[(side*.102,-.014,1.694),(side*.095,-.035,1.62),(side*.067,-.084,1.565),(side*.025,-.113,1.557)],.005,mat['trim'],'head')
 box('Chin strap adjuster',(side*.095,-.047,1.61),(.013,.012,.024),mat['fastener'],'head',.002)
ribbon('Helmet under-chin cup',[(-.026,-.113,1.557),(-.014,-.107,1.554),(0,-.104,1.553),(.014,-.107,1.554),(.026,-.113,1.557)],.013,.003,mat['trim'],'head',width_axis=(0,0,1))
# Ballistic eyewear, an actual curved lens/frame in front of the anatomical eyes.
for side in [-1,1]:
 o=sphere('Ballistic lens',(side*.043,-.111,1.678),(.039,.014,.022),mat['lens'],'head',segments=20,rings=8)
 cord('Ballistic frame',[(side*.009,-.12,1.698),(side*.045,-.127,1.701),(side*.08,-.105,1.693),(side*.083,-.102,1.667),(side*.045,-.127,1.657),(side*.009,-.12,1.667),(side*.009,-.12,1.698)],.0023,mat['rubber'],'head')
 cord('Glasses temple arm',[(side*.08,-.102,1.686),(side*.089,-.035,1.685),(side*.091,.027,1.67)],.0028,mat['rubber'],'head')
cord('Glasses bridge',[(-.01,-.126,1.685),(0,-.13,1.69),(.01,-.126,1.685)],.003,mat['rubber'],'head')
# Boots are foot-shaped lofts with shafts, laces, soles, toe seams and treads.
for side in [-1,1]:
 bone='foot.L' if side>0 else 'foot.R';ankle=joint(rigdata['bones'][bone]['head']);cx=ankle.x
 ang=side*math.radians(-6)
 def pt(x,y,z):return(cx+x*math.cos(ang)-y*math.sin(ang),ankle.y+x*math.sin(ang)+y*math.cos(ang),z)
 # Shoe upper: varying cross-sections along the foot, not an ellipsoid/cube foot.
 sections=[(.065,.039,.145),(.035,.049,.18),(-.02,.054,.195),(-.09,.058,.12),(-.17,.058,.086),(-.23,.043,.064),(-.246,.012,.05)]
 vv=[];ff=[];n=16
 for y,w,top in sections:
  for i in range(n):
   t=2*math.pi*i/n;vv.append(pt(w*math.cos(t),y,.03+(top-.03)*(.5+.5*math.sin(t))))
 for j in range(len(sections)-1):
  for i in range(n):ff.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 ff += [tuple(range(n-1,-1,-1)),tuple((len(sections)-1)*n+i for i in range(n))]
 mesh('Desert boot shaped upper',vv,ff,mat['boot'],bone)
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
 for sx in [-1,1]:
  vpanel=[pt(sx*.048,.037,.052),pt(sx*.052,.019,.151),pt(sx*.047,-.041,.185),pt(sx*.055,-.106,.096),pt(sx*.056,-.171,.055)]
  mesh('Boot suede side reinforcement',vpanel,[(0,1,2,3,4)],mat['boot_panel'],bone)
  cord('Boot quarter seam',[pt(sx*.050,.039,.060),pt(sx*.055,.021,.152),pt(sx*.050,-.039,.186),pt(sx*.057,-.106,.100),pt(sx*.058,-.171,.058)],.0009,mat['thread'],bone)
 # Twin heel seams continue above the ankle, not a smooth slipper heel.
 for sx in [-1,1]:cord('Boot heel stitching',[pt(sx*.026,.054,.053),pt(sx*.027,.057,.14),pt(sx*.027,.054,.213)],.001,mat['trim'],bone)
 # Sole follows an asymmetric toe/heel footprint.
 outline=[]
 for i in range(32):
  t=2*math.pi*i/32;y=-.085+.164*math.sin(t);w=.06 if y<-.03 else .047;outline.append((w*math.cos(t),y))
 vv=[pt(x,y,z)for z in [.005,.029]for x,y in outline];n=len(outline);ff=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
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
 cord('Boot toe seam',[pt(-.053,-.157,.06),pt(-.038,-.18,.08),pt(0,-.184,.085),pt(.038,-.18,.08),pt(.053,-.157,.06)],.0011,mat['trim'],bone)
 cord('Boot welt stitch',[pt(x,y,.030)for x,y in outline+[outline[0]]],.001,mat['thread'],bone)
# Wrist seam bands and shoulder pocket panels follow the A-pose arm directions.
for side in ['L','R']:
 wrist=joint(rigdata['bones']['wrist.'+side]['head']);elbow=joint(rigdata['bones']['lowerarm01.'+side]['head'])
 direction=(wrist-elbow).normalized();u=direction.cross(Vector((0,-1,0))).normalized();v=direction.cross(u)
 points=[tuple(wrist-direction*.018+(u*math.cos(t)+v*math.sin(t))*.037)for t in [i*2*math.pi/24 for i in range(25)]]
 cord('Sleeve cuff sewn band',points,.003,mat['trim'],'lowerarm02.'+side)
 # Knuckle pad, gloved hand anatomy already has five separate articulated fingers.
 hand=joint(rigdata['bones']['wrist.'+side]['tail']);box('Glove dorsal reinforcement',(hand.x,hand.y+.009,hand.z),(.043,.012,.043),mat['trim'],'wrist.'+side,.008)
# Sewn USMC tape on upper carrier. Actual mesh lettering, not a pasted sprite.
box('Carrier identification tape',(0,-.181,1.402),(.093,.004,.021),mat['trim'],'spine02',.002)
bpy.ops.object.text_add(location=(-.033,-.185,1.395),rotation=(math.pi/2,0,0));text=bpy.context.object;text.data.body='USMC';text.data.size=.016;text.data.extrude=.00015;text.data.align_x='LEFT';bpy.ops.object.convert(target='MESH');M.tag(bpy.context.object,'USMC sewn tape lettering',mat['thread'],'spine02')
# Build one separately named rifle mesh, fixed A2 stock, long quad rail and ACOG-style optic.
w=lambda *args,**kw:box(*args,weapon=True,**kw)
def receiver_profile(name,profile,width):
 n=len(profile);verts=[(x,y,z)for x in [-width/2,width/2]for y,z in profile]
 faces_w=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
 ob=mesh(name,verts,faces_w,mat['metal'],weapon=True);mod=ob.modifiers.new('Forged receiver edge radii','BEVEL');mod.width=.0014;mod.segments=2;M.apply(ob,mod)
 mod=ob.modifiers.new('Receiver hard-surface normals','WEIGHTED_NORMAL');M.apply(ob,mod)
receiver_profile('M16A4 contoured lower receiver',[(.098,.091),(-.097,.091),(-.121,.069),(-.12,.022),(-.061,.012),(-.034,.031),(.029,.027),(.061,.013),(.095,.042)],.043)
receiver_profile('M16A4 forged upper receiver',[(.09,.098),(-.103,.098),(-.103,.128),(-.088,.141),(.073,.141),(.093,.126)],.042)
rod('Receiver buffer extension',(0,.084,.11),(0,.133,.11),.018,mat['metal'],weapon=True,vertices=16)
for side in [-1,1]:
 for yy in [-.015,.071]:rod('Receiver takedown pin',(side*.021,yy,.064),(side*.024,yy,.064),.0035,mat['fastener'],weapon=True,vertices=12)
w('Magazine release button',(.025,-.052,.067),(.006,.017,.008),mat['fastener'],bevel=.001)
rod('Safety selector pivot',(-.021,.043,.065),(-.025,.043,.065),.0045,mat['metal'],weapon=True,vertices=12)
cord('Safety selector lever',[(-.026,.043,.065),(-.028,.056,.061)],.0023,mat['metal'],weapon=True)
w('Bolt catch paddle',(-.025,-.036,.084),(.006,.011,.015),mat['metal'],bevel=.001)
# Fixed stock shaped as a tapered prism rather than a collapsible carbine stock.
profile=[(.087,.132),(.327,.132),(.338,.015),(.31,-.009),(.135,.031),(.102,.070)]
vv=[(x,y,z)for x in [-.025,.025]for y,z in profile];n=len(profile);ff=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
mesh('M16A4 fixed A2 buttstock',vv,ff,mat['polymer'],weapon=True)
w('Butt plate',(0,.338,.063),(.053,.008,.123),mat['rubber'],bevel=.003)
w('Pistol grip',(0,.045,-.040),(.034,.052,.11),mat['polymer'],bevel=.007,rotation=(math.radians(-16),0,0))
cord('Open trigger guard',[(-.015,.045,.025),(-.015,.043,-.015),(-.015,-.007,-.021),(-.015,-.022,.029)],.003,mat['metal'],weapon=True)
rod('Trigger',(-.003,.013,.027),(-.003,.004,-.007),.002,mat['metal'],weapon=True,vertices=8)
# Curved 30-round box magazine silhouette.
profile=[(-.065,.043),(-.115,.043),(-.133,-.061),(-.175,-.153),(-.122,-.17),(-.083,-.076)]
vv=[(x,y,z)for x in [-.014,.014]for y,z in profile];n=len(profile);ff=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
mesh('Curved magazine',vv,ff,mat['metal'],weapon=True)
for x in [-.015,.015]:
 for y in [-.092,-.108]:cord('Magazine stamped rib',[(x,y,.018),(x,y-.012,-.066),(x,y-.051,-.144)],.001,mat['polymer'],weapon=True)
w('Long quad-rail handguard',(0,-.24,.111),(.056,.28,.067),mat['polymer'],bevel=.008)
rod('Exposed 20-inch-profile barrel',(0,-.38,.11),(0,-.635,.11),.008,mat['metal'],weapon=True,vertices=16,r2=.007)
rod('Flash suppressor',(0,-.635,.11),(0,-.67,.11),.011,mat['metal'],weapon=True,vertices=16)
for j in range(12):
 y=-.108-j*.022
 w('Top handguard rail tooth',(0,y,.151),(.044,.008,.007),mat['metal'],bevel=.001)
 w('Bottom handguard rail tooth',(0,y,.071),(.044,.008,.007),mat['metal'],bevel=.001)
 for side in [-1,1]:w('Side handguard rail tooth',(side*.032,y,.111),(.007,.008,.040),mat['metal'],bevel=.001)
for j in range(8):w('Receiver Picatinny tooth',(0,.069-j*.021,.145),(.043,.009,.008),mat['metal'],bevel=.001)
# Front sight tower is open, with two diagonal side supports.
for x in [-.012,.012]:
 rod('Front sight tower',(x,-.387,.11),(x,-.387,.204),.004,mat['metal'],weapon=True,vertices=8)
 rod('Front sight diagonal',(x,-.423,.11),(x,-.387,.188),.0035,mat['metal'],weapon=True,vertices=8)
rod('Front sight post',(0,-.387,.193),(0,-.387,.215),.002,mat['metal'],weapon=True,vertices=8)
rod('Sight guard crossbar',(-.014,-.387,.202),(.014,-.387,.202),.003,mat['metal'],weapon=True,vertices=8)
w('ACOG mount',(0,-.012,.163),(.035,.08,.018),mat['metal'],bevel=.003)
rod('ACOG optic main body',(0,.042,.202),(0,-.079,.202),.024,mat['polymer'],weapon=True,vertices=20)
rod('ACOG front hood',(0,-.079,.202),(0,-.10,.202),.029,mat['metal'],weapon=True,vertices=20,r2=.026)
rod('ACOG objective lens',(0,-.101,.202),(0,-.102,.202),.024,mat['lens'],weapon=True,vertices=24)
rod('Optic rear ocular',(0,.042,.202),(0,.065,.202),.021,mat['rubber'],weapon=True,vertices=20)
cord('Optic fiber tube',[(-.007,.047,.225),(-.007,.024,.234),(-.007,-.057,.234)],.002,mat['trim'],weapon=True)
w('Receiver dust cover',(.024,-.025,.108),(.004,.070,.023),mat['metal'],bevel=.002)
w('Brass deflector',(.026,.021,.118),(.014,.023,.023),mat['metal'],bevel=.002,rotation=(0,0,.28))
rod('Ejection cover hinge',(.027,-.061,.097),(.027,.011,.097),.0022,mat['fastener'],weapon=True,vertices=10)
rod('Optic elevation cap',(0,-.026,.219),(0,-.026,.235),.008,mat['polymer'],weapon=True,vertices=16)
rod('Optic windage cap',(.017,-.025,.202),(.031,-.025,.202),.008,mat['polymer'],weapon=True,vertices=16)
rod('Forward assist',(.023,.060,.118),(.039,.075,.113),.006,mat['metal'],weapon=True,vertices=12)
w('Charging handle',(0,.095,.142),(.068,.016,.008),mat['metal'],bevel=.002)
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
mesh('MARPAT jacket stand collar',vv,ff,mat['camo'],'neck01')
for xx in [-.042,.042]:
 points=[]
 for j in range(27):
  t=-1.45+j*3.15/26;points.append((xx,head_y+.134*math.sin(t),1.705+.112*math.cos(t)))
 cord('Helmet cover stitched panel seam',points,.00085,mat['thread'],'head')
character=M.join(M.CHAR,'USMC_Rifleman_Character');weapon=M.join(M.WEAPON,'M16A4_Separate_Weapon')
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
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'source/USMC_Rifleman_Geometry.blend'))
print('GEOMETRY_SAVED',len(character.data.vertices),'vertices',len(character.data.polygons),'polygons',flush=True)
# Separate pipeline stage: baking, exports and actual preview renders.
sys.path.insert(0,str(ROOT/'tools'))
if not os.environ.get('AW_GEOMETRY_ONLY'):
 import finish_asset
 finish_asset.finish(ROOT,character,weapon,rig)
