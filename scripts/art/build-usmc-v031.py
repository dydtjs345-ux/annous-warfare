"""Original reference-informed pixel construction; NOT cropped reference poses.
Logical frames 96x112, feet (48,96), crown 16, hips 62. Texture trims retain
logical pivots via Phaser spriteSourceSize/sourceSize metadata.
"""
from PIL import Image,ImageDraw
import math,json,pathlib
OUT=pathlib.Path('public/assets/usmc-rifleman-v031');OUT.mkdir(parents=True,exist_ok=True)
C={'edge':'#262923','shade':'#5c5645','deep':'#454439','cloth':'#a39272','light':'#c8b594','sand':'#b5a181','brown':'#7b6c53','vest':'#897957','web':'#b9a381','metal':'#424b48','skin':'#b29b7e','boot':'#89775c'}
def image():return Image.new('RGBA',(96,112))
def polygon(d,pts,c):d.polygon(pts,fill=C.get(c,c))
def fabric(im,pts,salt=0):
 d=ImageDraw.Draw(im);mask=Image.new('1',im.size);ImageDraw.Draw(mask).polygon(pts,fill=1);polygon(d,pts,'edge');xs=[x for x,y in pts];ys=[y for x,y in pts]
 for y in range(min(ys)+1,max(ys)):
  for x in range(min(xs)+1,max(xs)):
   if mask.getpixel((x,y)) and all(mask.getpixel((x+dx,y+dy)) for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):
    # Coordinate hash: original irregular digital clusters, no simulation RNG.
    h=((x//2)*374761393+(y//2)*668265263+salt*1442695041)&0xffffffff
    h=((h^(h>>13))*1274126177)&0xffffffff
    n=(h^(h>>16))%29
    color='cloth' if n>11 else 'sand' if n>7 else 'brown' if n>3 else 'light' if n>1 else 'shade'
    d.point((x,y),fill=C[color])
 # Broken seam light rather than a smooth/vector gradient.
 for i in range(0,len(pts)-1,2):
  a,b=pts[i],pts[i+1];d.line((a[0]+1,a[1]+1,b[0],b[1]),fill=C['sand'])
def torso(direction):
 im=image();d=ImageDraw.Draw(im);a=direction*math.pi/4;profile=abs(math.cos(a))>.85;back=math.sin(a)<-.2;w=10 if profile else 13
 # Substantial shoulder/chest silhouette, pelvis at 62 (old design 34/64).
 fabric(im,[(48-w,34),(42,30),(53,30),(48+w,35),(48+w-2,51),(57,62),(38,62),(37,49)],direction)
 # Fabric collar/scarf and shoulder reinforcement.
 polygon(d,[(42,29),(53,29),(56,34),(50,37),(41,35)],'shade');d.line((43,31,52,33),fill=C['light'])
 polygon(d,[(39,36),(44,33),(54,33),(58,38),(58,58),(54,62),(39,60)],'deep')
 if back:
  polygon(d,[(39,35),(55,35),(58,41),(56,61),(40,60),(37,45)],'shade')
  d.rectangle((40,38,54,54),fill=C['vest']);d.rectangle((41,56,54,60),fill=C['brown'])
  for x in (41,45,50,54):d.line((x,40,x,53),fill=C['web'])
  for y in (41,46,51):d.line((41,y,53,y),fill=C['brown'])
  d.rectangle((42,37,52,39),fill=C['sand']);d.line((44,39,44,55),fill=C['deep'])
 else:
  d.rectangle((40,37,55,56),fill=C['vest'])
  for x in (40,54):d.rectangle((x,35,x+2,48),fill=C['web']);d.line((x+1,38,x+1,46),fill=C['brown'])
  d.rectangle((44,37,51,40),fill=C['web']);d.line((45,39,50,39),fill=C['shade'])
  for y in (43,46):d.line((41,y,54,y),fill=C['sand']);d.line((41,y+1,54,y+1),fill=C['brown'])
  for x in (40,46,52):
   d.rectangle((x,48,x+4,58),fill=C['deep']);d.rectangle((x+1,49,x+4,57),fill=C['vest']);d.line((x+1,49,x+4,49),fill=C['light']);d.rectangle((x+2,51,x+3,53),fill=C['brown'])
 # Belt, radio/IFAK silhouette and seams; equipment stays within human bulk.
 d.rectangle((38,61,57,63),fill=C['shade']);d.rectangle((45,61,48,63),fill=C['web']);d.rectangle((35,48,39,56),fill=C['brown']);d.line((36,49,38,49),fill=C['light']);d.line((36,49,36,41),fill=C['edge'])
 d.rectangle((57,54,61,60),fill=C['shade']);d.line((58,55,60,55),fill=C['web'])
 # Rounded cloth-covered helmet, small face, NVG bracket, glasses and chin strap.
 faceShift=2 if math.cos(a)>.3 else -2 if math.cos(a)<-.3 else 0
 d.rectangle((45+faceShift,23,51+faceShift,26),fill=C['skin']);d.line((45+faceShift,26,48+faceShift,26),fill=C['shade'])
 fabric(im,[(42,20),(43,17),(46,16),(51,16),(54,18),(55,22),(53,24),(42,24)],direction+15)
 d.line((43,23,54,23),fill=C['shade']);d.line((46,17,50,17),fill=C['light'])
 if not back:
  d.rectangle((46+faceShift,24,51+faceShift,25),fill='#263332');d.point((51+faceShift,26),fill=C['light']);d.line((44+faceShift,24,47+faceShift,26),fill=C['brown']);d.rectangle((50+faceShift,18,52+faceShift,21),fill='#3a403a');d.point((51+faceShift,18),fill='#788078')
 else:d.rectangle((45,21,51,23),fill=C['brown']);d.line((47,22,50,22),fill=C['web'])
 return im

def lower(direction,phase,family):
 im=image();d=ImageDraw.Draw(im);a=direction*math.pi/4;stride=math.sin(phase*math.pi/4);crouch=family=='crouch';run=family=='run';hip=84 if crouch else 62;length=10 if run else 6
 for side in [-1,1]:
  hx=48+side*5;fwd=side*stride;fx=round(hx+fwd*math.cos(a)*length);fy=round(93+fwd*math.sin(a)*length*.45-max(0,fwd)*(4 if run else 2));kx=round((hx+fx)/2+(5 if crouch else 0));ky=89 if crouch else 79
  fabric(im,[(hx-4,hip),(hx+4,hip),(kx+3,ky),(fx+3,fy-2),(fx-3,fy-2),(kx-3,ky)],direction+side+9)
  d.rectangle((kx-2,ky-3,kx+2,ky+1),fill=C['shade']);d.line((kx-1,ky-2,kx+1,ky-2),fill=C['sand']);d.line((hx-2,hip+3,kx-2,ky-4),fill=C['brown'])
  polygon(d,[(fx-3,fy-5),(fx+2,fy-5),(fx+3,fy-1),(fx+6,fy+1),(fx+6,fy+3),(fx-3,fy+3)],'boot');d.line((fx-3,fy+3,fx+6,fy+3),fill=C['deep']);d.line((fx-1,fy-3,fx+2,fy-3),fill=C['light']);d.line((fx-1,fy-1,fx+2,fy-1),fill=C['brown'])
 d.line((38,hip,57,hip),fill=C['shade']);return im

def prone(direction,phase):
 im=image();d=ImageDraw.Draw(im);a=direction*math.pi/4;swing=math.sin(phase*math.pi/4)*2
 def pt(x,y,z=0):return (round(48+math.cos(a)*x-math.sin(a)*y),round(86+(math.sin(a)*x+math.cos(a)*y)*.45-z))
 fabric(im,[pt(-25,-6),pt(-3,-6),pt(2,0),pt(-3,6),pt(-25,6)],direction)
 for side in [-1,1]:
  x,y=pt(-24,side*5+swing);d.rectangle((x-3,y-2,x+3,y+2),fill=C['boot']);d.line((x-2,y+2,x+3,y+2),fill=C['deep'])
 fabric(im,[pt(-6,-8,3),pt(12,-7,3),pt(16,0,3),pt(12,8,3),pt(-6,8,3)],direction+2)
 x,y=pt(3,0,3);d.rectangle((x-6,y-8,x+5,y-1),fill=C['shade']);d.rectangle((x-5,y-7,x+4,y-3),fill=C['vest']);d.line((x-2,y-6,x-2,y-1),fill=C['web'])
 x,y=pt(18,0,3);fabric(im,[(x-6,y-1),(x-5,y-6),(x-2,y-8),(x+3,y-7),(x+6,y-3),(x+5,y+2),(x-3,y+3)],direction+14);d.line((x-4,y-1,x+4,y-1),fill=C['shade']);return im

# Shelf-pack trimmed pixels; every frame retains identical logical source/pivot.
frames={};sources=[]
for direction in range(8):
 sources.append((f'torso-{direction}',torso(direction)))
 for family in ['stand','run','crouch','prone']:
  for phase in range(8):sources.append((f'{family}-{direction}-{phase}',prone(direction,phase) if family=='prone' else lower(direction,phase,family)))
x=y=rowH=0;placements=[]
for name,im in sources:
 box=im.getbbox();crop=im.crop(box);w,h=crop.size
 if x+w+2>1024:x=0;y+=rowH+2;rowH=0
 placements.append((name,crop,box,x,y));x+=w+2;rowH=max(rowH,h)
height=y+rowH;atlas=Image.new('RGBA',(1024,height))
for name,crop,box,x,y in placements:
 atlas.alpha_composite(crop,(x,y));w,h=crop.size;frames[name]={'frame':{'x':x,'y':y,'w':w,'h':h},'rotated':False,'trimmed':True,'spriteSourceSize':{'x':box[0],'y':box[1],'w':w,'h':h},'sourceSize':{'w':96,'h':112}}
atlas.save(OUT/'rifleman.png');(OUT/'rifleman.json').write_text(json.dumps({'frames':frames,'meta':{'image':'rifleman.png','size':{'w':1024,'h':height},'scale':'1','app':'original v031 pixel assets; trimmed source pivots retained'}},indent=2)+'\n')
arm=Image.new('RGBA',(9,20));fabric(arm,[(2,0),(6,0),(7,14),(6,19),(2,19),(1,11)],8);ImageDraw.Draw(arm).line((2,2,2,14),fill=C['sand']);arm.save(OUT/'sleeve.png')
fore=Image.new('RGBA',(9,20));fabric(fore,[(2,0),(6,0),(7,13),(6,17),(2,17),(1,10)],4);d=ImageDraw.Draw(fore);d.rectangle((2,14,6,19),fill=C['shade']);d.line((3,15,5,15),fill=C['web']);fore.save(OUT/'forearm.png')
gun=Image.new('RGBA',(54,18));d=ImageDraw.Draw(gun)
# Fixed M16 stock, receiver, trigger guard/grip, straight magazine, rail handguard,
# exposed barrel, gas block/front-sight post and optic. No baked muzzle flash.
d.polygon([(2,6),(12,6),(16,8),(15,12),(3,13),(2,11)],fill='#272f2f');d.line((3,7,11,7),fill='#6d7771');d.rectangle((15,7,27,11),fill='#35423f');d.line((16,7,27,7),fill='#7f8880');d.polygon([(19,11),(23,11),(22,17),(19,16)],fill='#414b44');d.polygon([(25,11),(29,11),(30,16),(27,17),(25,15)],fill='#657060');d.line((26,12,28,15),fill='#283833');d.rectangle((28,7,40,10),fill='#303e3b');d.line((28,6,40,6),fill='#8b958a');
for x in range(29,40,3):d.line((x,7,x,9),fill='#111f21')
d.rectangle((41,8,49,9),fill='#2c3b3b');d.line((41,8,49,8),fill='#7b8782');d.polygon([(45,8),(46,3),(47,3),(48,8)],fill='#23332f');d.rectangle((49,7,50,10),fill='#1d2d2a');d.rectangle((19,3,25,5),fill='#283b36');d.rectangle((20,2,24,3),fill='#44534b');d.point((24,3),fill='#99b4aa');d.line((17,6,26,6),fill='#1d2d28');gun.save(OUT/'m16a4.png')
meta={'prototypeUnitId':1,'faction':'USMC','role':'rifleman','nativeStandingHeight':80,'nativeHeadHeight':11,'headRatio':80/11,'logicalFrame':[96,112],'footAnchor':[48,96],'hipAnchor':[48,62],'shoulders':[[36,34],[60,34]],'crouchDrop':22,'gripOffset':[3,-44],'upperArmLength':13,'forearmLength':14,'armWidth':9,'weaponSize':[54,18],'weaponGrip':[18,8],'weaponMuzzle':[50,8],'supportGripDistance':16,'sizes':[1,1.3,1.5],'baseDisplayHeight':30,'frameFamilies':['stand','run','crouch','prone'],'atlasFrames':len(frames),'license':'Original project artwork; reference-informed design, no cropped illustrated reference poses','scope':'higher-detail original pixel prototype; artist-quality review remains required'}
(OUT/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n');print('Frames:',len(frames),'packed texture:',atlas.size,'RGBA bytes',atlas.width*atlas.height*4)
