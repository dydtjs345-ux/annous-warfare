from pathlib import Path
from PIL import Image,ImageDraw
import subprocess
ROOT=Path(__file__).resolve().parents[1]
indices=[0,7,14,22,29,36,43,50]
for faction in ['USMC','Russian']:
 for view in ['side','rear']:
  tmp=Path('/tmp')/f'aw-final-torso-phases-{faction}-{view}';tmp.mkdir(exist_ok=True)
  expression='+'.join(f'eq(n,{i})'for i in indices).replace(',',r'\,')
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(ROOT/'review'/f'{faction}-{view}.mp4'),'-vf','select='+expression,'-fps_mode','vfr',str(tmp/'%02d.png')],check=True)
  first=Image.open(sorted(tmp.glob('*.png'))[0]);frame_h=round(first.height*800/first.width);card_h=frame_h+26
  sheet=Image.new('RGB',(1600,4*card_h+36),'#172737');draw=ImageDraw.Draw(sheet);draw.text((12,12),f'{faction} | {view} | ORIGINAL / PREVIOUS / NEW FULL BODY | actual rendered frames across one full crawl cycle',fill='white')
  for i,p in enumerate(sorted(tmp.glob('*.png'))):
   im=Image.open(p).convert('RGB');im.thumbnail((800,frame_h));x=(i%2)*800;y=(i//2)*card_h+36;sheet.paste(im,(x,y));draw.text((x+12,y+frame_h+6),f't = {indices[i]/24:.3f} s | {indices[i]/24/2.4:.0%} cycle',fill='#c0d9ed')
  sheet.save(ROOT/'review'/f'{faction}-{view}-comparison.jpg',quality=94)
print('Extracted and assembled final before/after phase sheets.')
