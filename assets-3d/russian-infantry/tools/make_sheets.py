"""Compose untouched, actual 3D renders at 1:1 native size. Requires Pillow."""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];EVAL=ROOT/'isometric-evaluation';REF=ROOT.parent/'usmc-rifleman/isometric-evaluation'
OUT=EVAL/'sheets';OUT.mkdir(exist_ok=True,parents=True)
DIRS=['N','NE','E','SE','S','SW','W','NW'];BG=(40,51,62,255)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',9)
report={'method':'Actual 3D rotations; unscaled RGBA renders, shared opaque sheet background; native figure height from geometric projection.','sizes':[]}
def paste(im,src,cx,top):
 src=Image.open(src).convert('RGBA');im.alpha_composite(src,(cx-src.width//2,top));return src
for height in [40,60,80,120]:
 rowh=height+42;im=Image.new('RGBA',(390,70+8*rowh),BG);d=ImageDraw.Draw(im)
 d.text((12,10),f'USMC / Russian infantry — {height}px',font=font,fill='white')
 d.text((12,29),'Eight 3D headings · view at 100% for native scale',font=small,fill='#bdc9d2')
 d.text((100,49),'USMC',font=font,fill='#d5c2a0');d.text((246,49),'Russian',font=font,fill='#b4c393')
 records=[]
 for i,direction in enumerate(DIRS):
  y=70+i*rowh;d.line((8,y,382,y),fill='#46515c');d.text((12,y+9),direction,font=font,fill='white')
  rec={'direction':direction}
  for variant,cx,folder,stem in [('usmc',126,REF,'current'),('russian',279,EVAL,'russian')]:
   path=folder/'native'/f'{stem}-{direction}-{height}.png';src=paste(im,path,cx,y+8)
   alpha=src.getchannel('A').point(lambda v:255 if v>=128 else 0);bounds=alpha.getbbox();actual=bounds[3]-bounds[1]
   assert abs(actual-height)<=1,(path,actual,height)
   d.text((cx-24,y+height+23),f'{actual}px',font=small,fill='#b8c3cc')
   rec[variant]={'source':str(path.relative_to(ROOT.parent)),'opaque_height':actual,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
  records.append(rec)
 path=OUT/f'usmc-vs-russian-{height}px.png';im.convert('RGB').save(path)
 report['sizes'].append({'height':height,'sheet':str(path.relative_to(ROOT)), 'figures':records})
# Detail comparison: both use the exact same reference pipeline, 512px figure.
for direction in ['SE','E']:
 left=Image.open(REF/'large'/f'current-{direction}.png').convert('RGBA');right=Image.open(EVAL/'large'/f'russian-{direction}.png').convert('RGBA')
 im=Image.new('RGBA',(left.width+right.width+36,max(left.height,right.height)+52),BG);d=ImageDraw.Draw(im)
 d.text((18,12),f'USMC — {direction}',font=font,fill='white');d.text((left.width+30,12),f'Russian infantry — {direction}',font=font,fill='white')
 im.alpha_composite(left,(12,40));im.alpha_composite(right,(left.width+24,40));im.convert('RGB').save(OUT/f'usmc-vs-russian-detail-{direction}.png')
# A readable overview with native 120px figures, never enlarged.
im=Image.new('RGBA',(8*148,358),BG);d=ImageDraw.Draw(im);d.text((12,10),'USMC / Russian infantry — all eight headings, 120px',font=font,fill='white')
for i,direction in enumerate(DIRS):
 d.text((i*148+64,34),direction,font=font,fill='white')
 for row,folder,stem in [(0,REF,'current'),(1,EVAL,'russian')]:paste(im,folder/'native'/f'{stem}-{direction}-120.png',i*148+74,54+row*150)
d.text((8,187),'USMC above · Russian below',font=small,fill='#bdc9d2');im.convert('RGB').save(OUT/'eight-directions-120px.png')
(EVAL/'validation/comparison-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print('FOUR_NATIVE_COMPARISON_SHEETS_AND_DETAILS_FINISHED')
