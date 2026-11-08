"""Package actual WebGL frames without resizing or synthesizing figure motion."""
from pathlib import Path
import subprocess,json
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'review';dirs=['N','NE','E','SE','S','SW','W','NW'];font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
canvas=Image.new('RGB',(8*184,500),'#28333f');draw=ImageDraw.Draw(canvas);draw.text((12,12),'120px standing reference · actual 3D headings · USMC above / Russian below',font=font,fill='white')
for i,direction in enumerate(dirs):
 im=Image.open(OUT/'directions'/f'{direction}.png').convert('RGB');half=(im.width-16)//2;draw.text((i*184+74,40),direction,font=font,fill='white')
 for row,cx in [(0,half//2),(1,half+16+half//2)]:
  crop=im.crop((cx-85,128,cx+85,328));canvas.paste(crop,(i*184+7,64+row*215))
canvas.save(OUT/'eight-directions-120px.png')
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-framerate','30','-i','/tmp/aw-moving-fire-frames/frame-%04d.png','-frames:v','144','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'moving-fire-120px.mp4')],check=True)
# Side-by-side pose phases are also supplied as a useful motion contact sheet.
for state in ['Walk','Sprint','Raise','Fire','AimWalk','MovingFire','Reload']:
 frames=sorted(OUT.glob(f'detail-{state}-*.png'));thumbs=[]
 for p in frames:
  # Keep all pixels; crop only a shared central inspection region per faction.
  im=Image.open(p).convert('RGB');half=(im.width-16)//2
  tile=Image.new('RGB',(480,394),'#28333f');d=ImageDraw.Draw(tile);d.text((12,8),p.stem,font=font,fill='white')
  for j,cx in enumerate([half//2,half+16+half//2]):tile.paste(im.crop((cx-120,44,cx+120,414)),(j*240,24))
  thumbs.append(tile)
 sheet=Image.new('RGB',(480*len(thumbs),394),'#28333f')
 for i,tile in enumerate(thumbs):sheet.paste(tile,(i*480,0))
 sheet.save(OUT/f'{state}-phases.png')
print('REVIEW_SHEETS_AND_MOVING_FIRE_VIDEO_PACKAGED')
