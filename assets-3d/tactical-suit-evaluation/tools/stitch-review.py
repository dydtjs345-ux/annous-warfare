"""Label actual rendered model comparisons; preserve 1x native clip timing."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1];CACHE=Path('/workspace/tactical-suit-frames');OUT=ROOT/'review';OUT.mkdir(exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
records=[]
def composite(mode,action,view,i):
 c=Image.new('RGB',(1024,580),'#152634');d=ImageDraw.Draw(c)
 for col,kind in enumerate(['original','suit']):c.paste(Image.open(CACHE/f'{mode}-{action}-{view}-{kind}'/f'{i:04d}.png').convert('RGB'),(512*col,48))
 d.text((12,6),'ORIGINAL USMC MODEL',font=font,fill='#eef6fc');d.text((524,6),'ACTUAL SKETCHFAB TACTICAL SUIT',font=font,fill='#eef6fc')
 d.text((12,27),'Neutral appearance'if mode=='appearance'else'Existing '+('FB_Walk'if action=='walk'else'SR_Sprint'),font=small,fill='#c2d4df')
 d.text((524,27),'DanlyVostok | CC BY 4.0'if mode=='appearance'else'Quaternius '+('Walk_Loop'if action=='walk'else'Sprint_Loop')+' | corrected M16 grip',font=small,fill='#c2d4df')
 note=('Side'if view=='side'else'30-degree isometric')+' | same camera / 1.74m display height / lighting'
 if mode=='motion':note+=f' | 1x native timing | t={i/24:.3f}s'
 d.text((12,564),note,font=small,fill='#e0eaf2');return c
for view in ['side','iso']:composite('appearance','walk',view,0).save(OUT/f'appearance-{view}.jpg',quality=94)
for action,N in [('walk',32),('sprint',16)]:
 for view in ['side','iso']:
  name=f'{action}-{view}';dest=CACHE/f'{name}-composite';dest.mkdir(exist_ok=True)
  captures=[]
  for kind in ['original','suit']:
   marker=json.loads((CACHE/f'motion-{action}-{view}-{kind}.complete.json').read_text());assert marker['frames']==N
   if kind=='suit':assert marker['model']==hashlib.sha256((ROOT/'models/TacticalSuit_Quaternius_Rifle.glb').read_bytes()).hexdigest()
   assert marker['renderer']==hashlib.sha256((ROOT/'tools/render-review.py').read_bytes()).hexdigest();captures.append(marker)
  for i in range(N):composite('motion',action,view,i).save(dest/f'{i:04d}.png')
  movie=OUT/f'{name}.mp4';subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','24','-i',str(dest/'%04d.png'),'-frames:v',str(N),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],check=True)
  sheet=Image.new('RGB',(1024,580*4))
  for row,i in enumerate([0,N//4,N//2,3*N//4]):sheet.paste(Image.open(dest/f'{i:04d}.png'),(0,row*580))
  sheet.save(OUT/f'{name}-comparison.jpg',quality=93)
  meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(movie)]));s=meta['streams'][0]
  assert int(s['nb_frames'])==N and s['r_frame_rate']=='24/1'and s['codec_name']=='h264'and s['pix_fmt']=='yuv420p';assert abs(float(meta['format']['duration'])-N/24)<.001
  records.append({'file':movie.name,'frames':N,'fps':24,'duration':N/24,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),'captures':captures,'sameCamera':True,'sameDisplayHeightM':1.74,'nativePlaybackSpeed':1,'rootTranslation':'Native imported trajectory; original retains existing game movement speed. No gait retiming.'});print('Packaged',name,flush=True)
for view,label in [('hands','left'),('hands-right','right')]:shutil.copyfile(CACHE/f'motion-walk-{view}-suit/0000.png',OUT/f'grip-{label}.png')
(ROOT/'validation/recordings.json').write_text(json.dumps(records,indent=2)+'\n')
