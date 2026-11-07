"""Original offline pixel assets. Pillow is build-time only; no game RNG/assets copied.
Coordinate design: upright crown y=8, boot sole y=64, head/helmet=8px,
56/8=7 heads. Hip y=34, shoulders y=19; footprint anchor (32,64).
"""
from PIL import Image, ImageDraw
import math,json,pathlib
OUT=pathlib.Path('public/assets/usmc-rifleman');OUT.mkdir(parents=True,exist_ok=True)
PAL={'edge':'#222a2b','shadow':'#665a46','cloth':'#b1a17a','light':'#d0c49d','tan':'#998762','dark':'#6c634d','vest':'#8b805d','web':'#b3a780','skin':'#b59c7e','boot':'#887455','sole':'#4c493b'}
def poly(d,pts,c): d.polygon(pts,fill=PAL.get(c,c))
def cloth(im,pts,base='cloth',salt=0):
 mask=Image.new('1',im.size);ImageDraw.Draw(mask).polygon(pts,fill=1);d=ImageDraw.Draw(im);poly(d,pts,'edge')
 # Coordinate-derived digital clusters, light consistently above-left.
 for y in range(min(p[1] for p in pts)+1,max(p[1] for p in pts)):
  for x in range(min(p[0] for p in pts)+1,max(p[0] for p in pts)):
   if mask.getpixel((x,y)):
    n=((x//2)*13+(y//2)*29+salt*7)%23;c=base if n>7 else ('shadow' if n<2 else 'light' if n<4 else 'tan');d.point((x,y),fill=PAL[c])
def torso(direction,low=False):
 im=Image.new('RGBA',(64,72));d=ImageDraw.Draw(im);a=direction*math.pi/4;side=math.cos(a);back=math.sin(a)<-.2
 # Broad shoulders taper toward pelvis; head stays small, equipment not inflated.
 dx=round(side*1)
 poly(d,[(24-dx,20),(29-dx,17),(35-dx,18),(38-dx,25),(36-dx,34),(26-dx,34)],'edge')
 poly(d,[(25-dx,21),(29-dx,18),(34-dx,19),(36-dx,25),(35-dx,33),(27-dx,33)],'shadow')
 cloth(im,[(25,19),(29,17),(35,18),(39,21),(37,33),(27,34),(25,27)],salt=direction)
 # Interceptor-style vest, central closure, shoulder webbing and magazine pouches.
 poly(d,[(27,20),(36,20),(37,31),(34,35),(27,33)],'vest')
 d.line([(28,20),(28,31)],fill=PAL['web']);d.line([(35,21),(35,33)],fill=PAL['shadow'])
 if back:
  poly(d,[(28,21),(34,21),(36,25),(35,34),(28,33),(27,26)],'shadow');d.rectangle((29,22,33,30),fill=PAL['tan']);d.line([(30,23),(30,29)],fill=PAL['web'])
 else:
  for x in (28,31,34):d.rectangle((x,27,x+1,32),fill=PAL['shadow']);d.line((x,27,x+1,27),fill=PAL['light'])
  d.rectangle((30,22,33,24),fill=PAL['web']);d.point((31,23),fill=PAL['shadow'])
 d.line((27,34,35,34),fill=PAL['edge']);d.rectangle((24,30,26,34),fill=PAL['shadow'])
 # Neck, chin, helmet shell/rim with restrained fabric cover and side strap.
 d.rectangle((30,15,33,18),fill=PAL['skin']);poly(d,[(29,10),(34,10),(35,12),(34,16),(31,17),(28,14)],'shadow')
 poly(d,[(29+dx,10),(33+dx,10),(34+dx,13),(33+dx,16),(30+dx,15)],'skin')
 cloth(im,[(28,10),(29,8),(33,8),(35,10),(35,12),(28,12)],salt=7+direction)
 d.line((28,12,35,12),fill=PAL['shadow']);d.line((30,9,33,9),fill=PAL['light'])
 if not back:d.line((30+dx,13,33+dx,13),fill=PAL['shadow']);d.point((33+dx,14),fill=PAL['light'])
 return im

def legs(direction,phase,crouch=False):
 im=Image.new('RGBA',(64,72));d=ImageDraw.Draw(im);a=direction*math.pi/4;stride=math.sin(phase*math.pi/4);sx,sy=math.cos(a),math.sin(a)*.45
 hip=48 if crouch else 34
 for side in [-1,1]:
  hx=32+side*3;footx=round(hx+side*stride*sx*5);footy=round(61+side*stride*sy*4);kx=round((hx+footx)/2+(3 if crouch else 0));ky=54 if crouch else 48
  cloth(im,[(hx-2,hip),(hx+2,hip),(kx+2,ky),(footx+2,footy),(footx-2,footy),(kx-2,ky)],salt=direction+side+5)
  d.rectangle((kx-1,ky-2,kx+1,ky),fill=PAL['shadow'])
  poly(d,[(footx-2,footy-3),(footx+1,footy-3),(footx+3,footy),(footx+3,footy+2),(footx-2,footy+2)],'boot');d.line((footx-2,footy+2,footx+3,footy+2),fill=PAL['sole']);d.point((footx,footy-1),fill=PAL['light'])
 d.line((27,hip,36,hip),fill=PAL['edge']);return im

def prone(direction):
 im=Image.new('RGBA',(64,72));d=ImageDraw.Draw(im);a=direction*math.pi/4
 def pt(x,y):return (round(32+math.cos(a)*x-math.sin(a)*y),round(57+(math.sin(a)*x+math.cos(a)*y)*.45))
 def shape(pts,c):poly(d,[pt(*p) for p in pts],c)
 shape([(-18,-4),(-5,-4),(0,-2),(0,3),(-18,3)],'shadow');shape([(-18,-4),(-5,-4),(-5,-1),(-18,-1)],'cloth');shape([(-18,1),(-5,1),(-5,4),(-18,4)],'tan')
 shape([(-6,-5),(7,-5),(10,-2),(7,5),(-6,5)],'vest');shape([(-3,-4),(5,-4),(6,3),(-3,3)],'tan')
 shape([(8,-4),(14,-4),(16,-1),(14,3),(8,3)],'cloth');shape([(9,-4),(14,-4),(14,-2),(9,-2)],'light');return im
frames={};sheet=Image.new('RGBA',(64*8,72*25))
for direction in range(8):
 sheet.alpha_composite(torso(direction),(direction*64,0));frames[f'torso-{direction}']={'frame':{'x':direction*64,'y':0,'w':64,'h':72}}
 for family in ['stand','crouch']:
  for gait in range(8):
   row=1+gait+(8 if family=='crouch' else 0);sheet.alpha_composite(legs(direction,gait,family=='crouch'),(direction*64,row*72));frames[f'{family}-{direction}-{gait}']={'frame':{'x':direction*64,'y':row*72,'w':64,'h':72}}
 row=17;sheet.alpha_composite(prone(direction),(direction*64,row*72));frames[f'prone-{direction}']={'frame':{'x':direction*64,'y':row*72,'w':64,'h':72}}
sheet=sheet.crop((0,0,512,72*18));sheet.save(OUT/'rifleman.png');(OUT/'rifleman.json').write_text(json.dumps({'frames':frames,'meta':{'image':'rifleman.png','size':{'w':512,'h':1296},'scale':'1','app':'original offline pixel asset builder'}},indent=2)+'\n')
# Independent arm pieces allow exact two-handed placement on the continuous gun axis.
arm=Image.new('RGBA',(7,14));cloth(arm,[(2,0),(4,0),(5,10),(4,13),(2,13),(1,8)],salt=3);arm.save(OUT/'sleeve.png')
fore=Image.new('RGBA',(7,14));cloth(fore,[(2,0),(4,0),(5,8),(4,11),(2,11),(1,7)],salt=5);d=ImageDraw.Draw(fore);d.rectangle((2,10,4,13),fill='#786e53');d.line((2,11,4,11),fill='#b7ab83');fore.save(OUT/'forearm.png')
weapon=Image.new('RGBA',(38,12));d=ImageDraw.Draw(weapon)
# Fixed buttstock, receiver/pistol grip/magazine, long rail handguard, exposed barrel.
d.polygon([(1,4),(8,4),(10,5),(10,8),(2,9),(1,8)],fill='#303938');d.line((2,5,7,5),fill='#697472');d.rectangle((9,5,17,7),fill='#273335');d.polygon([(12,7),(15,7),(14,11),(12,11)],fill='#414c49');d.rectangle((16,5,26,7),fill='#3c4948');d.line((17,4,26,4),fill='#74817c');d.rectangle((27,5,35,6),fill='#27373a');d.rectangle((34,4,35,7),fill='#1b2b31');d.line((29,5,33,5),fill='#87908a');d.rectangle((11,2,15,3),fill='#273536');d.point((14,2),fill='#8fa4a2');d.rectangle((31,3,31,5),fill='#1f3034')
for x in (18,21,24):d.line((x,5,x,6),fill='#151f24')
weapon.save(OUT/'m16a4.png');(OUT/'metadata.json').write_text(json.dumps({'prototypeUnitId':1,'faction':'USMC','role':'rifleman','nativeStandingHeight':56,'nativeHeadHeight':8,'headRatio':7,'footAnchor':[32,64],'hipAnchor':[32,34],'shoulders':[[25,20],[38,20]],'weaponGrip':[12,6],'weaponMuzzle':[36,6],'sizes':[1,1.3,1.5],'baseDisplayHeight':30,'license':'Original project artwork; no external assets','scope':'visual prototype; original desert digital camouflage inspired by period equipment, not a reproduction of issued MARPAT fabric'},indent=2)+'\n')
