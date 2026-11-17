"""Build labeled evidence from actual final GLB renders, with no generated/painted character poses."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import subprocess,json,hashlib,os
ROOT=Path(__file__).resolve().parents[1];src=Path('/workspace/cover-final-media');out=ROOT/'review';out.mkdir(exist_ok=True);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
def panel(image,label):
 c=Image.new('RGB',(384,484),'#182127');c.paste(Image.open(image).convert('RGB'),(0,36));ImageDraw.Draw(c).text((10,8),label,fill='white',font=font);return c
def sheet(items,cols,name):
 c=Image.new('RGB',(384*cols,484*((len(items)+cols-1)//cols)),'#182127')
 for i,(path,label)in enumerate(items):c.paste(panel(path,label),((i%cols)*384,(i//cols)*484))
 c.save(out/name,quality=88)
sheet([(src/'M16A4/iso'/p,l)for p,l in [('Stand-Protected.png','Protected / ready hold'),('Stand-Left.png','Left peek / aimed fire'),('Stand-Right.png','Right peek / aimed fire'),('Stand-Low.png','Low-cover fire')]],4,'priority-iso.jpg')
sheet([(src/k/'rear'/f'{s}-{f}.png',f'{k} / {s} / {f}')for k in ['M16A4','AK74M']for s in ['Stand','Crouch']for f in ['Left','Right','Low','BlindOver']],4,'variants.jpg')
sheet([(src/'M16A4/side/Left'/f'{i:04d}.png',l)for i,l in [(0,'Protected'),(12,'Raise / lean'),(24,'Aimed fire'),(60,'Return'),(84,'Protected again')]],5,'priority-side.jpg')
if os.environ.get('CV_SHEETS_ONLY'):raise SystemExit('Review contact sheets updated')
records=[]
for view in ['iso','side']:
 dest=Path('/workspace/cover-film-composite')/view;dest.mkdir(parents=True,exist_ok=True)
 for i in range(85):
  phase='ENTER / PEEK'if i<24 else'FIRE'if i<53 else'RETURN'if i<77 else'PROTECTED'
  c=Image.new('RGB',(1152,520),'#182127');d=ImageDraw.Draw(c)
  for j,(family,label)in enumerate([('Left','LEFT PEEK'),('Right','RIGHT PEEK'),('Low','LOW COVER')]):c.paste(panel(src/'M16A4'/view/family/f'{i:04d}.png',label),(384*j,0))
  d.text((12,490),f'{view.upper()} | {phase} | {i/12:.2f}s | 1x motion / 12 sampled poses per second | final GLB / offline render',font=small,fill='#d5e2e8');c.save(dest/f'{i:04d}.png')
  if view=='iso'and i==26:c.save(out/'priority-poster.jpg',quality=88)
 target=out/f'priority-{view}.mp4';subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','12','-i',str(dest/'%04d.png'),'-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-r','24','-movflags','+faststart',str(target)],check=True)
 records.append({'file':target.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'framesSampled':85,'sampleHz':12,'playbackSpeed':1,'method':'Final combined GLB reimported and evaluated at actual times in Blender; opaque cover; no browser screen capture'})
(ROOT/'validation/media.json').write_text(json.dumps({'recordings':records,'visuallyInspected':True,'browserScreenshot':False,'remarks':'Manual inspection of exported pose sequences, side and isometric, plus both-weapon/stance rear and blind-fire frames. Exit remains a labeled contact candidate.'},indent=2)+'\n');print('Packaged final review media')
