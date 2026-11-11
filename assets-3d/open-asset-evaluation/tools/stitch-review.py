"""Package actual rendered frames without retiming or pose interpolation."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,hashlib,sys
ROOT=Path(__file__).resolve().parents[1];CACHE=Path('/workspace/open-asset-downloads/render');OUT=ROOT/'review';OUT.mkdir(exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
meta=json.loads((ROOT/'validation/retarget.json').read_text());report=[]
for f in ['USMC','Russian']:
 for action,N in [('walk',32),('sprint',16)]:
  for view in ['side','iso']:
   name=f'{f}-{action}-{view}';dirs=[CACHE/f'{name}-{kind}'for kind in ['original','imported']]
   markers=[CACHE/f'{name}-{kind}.complete.json'for kind in ['original','imported']]
   if not all(p.exists()for p in markers):print('Waiting:',name);continue
   captures=[json.loads(p.read_text())for p in markers]
   if not all(c['sourceModelSha256']==hashlib.sha256((CACHE/f'{f}-{kind}.glb').read_bytes()).hexdigest()and c['rendererSha256']==hashlib.sha256((ROOT/'tools/render-review.py').read_bytes()).hexdigest()and c['frames']>=N for c,kind in zip(captures,['original','imported'])):print('Waiting for current assets:',name);continue
   if not all((d/f'{N-1:04d}.png').exists()for d in dirs):print('Waiting:',name);continue
   dest=CACHE/f'{name}-comparison';dest.mkdir(exist_ok=True);info=meta['factions'][f]['clips'][action]
   for i in range(N):
    c=Image.new('RGB',(960,496),'#172737');draw=ImageDraw.Draw(c)
    for col,d in enumerate(dirs):c.paste(Image.open(d/f'{i:04d}.png').convert('RGB'),(480*col,48))
    draw.text((12,7),f'{f} | ORIGINAL',font=font,fill='#eef6fc');draw.text((492,7),f'{f} | IMPORTED - Quaternius',font=font,fill='#eef6fc');draw.text((12,27),'FB_Walk'if action=='walk'else'Latest SR_Sprint',font=small,fill='#b6cad7');draw.text((492,27),info['sourceClip']+' | raw retarget, no rifle/contact correction',font=small,fill='#f2c78b');
    draw.text((12,476),f'{"Side"if view=="side"else"30-degree isometric"} | 1x native timing | shared ground {info["speedMps"]:.3f} m/s | t = {i/24:.3f} s',font=small,fill='#e0eaf2');c.save(dest/f'{i:04d}.png')
   video=OUT/f'{name}.mp4';subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','24','-i',str(dest/'%04d.png'),'-frames:v',str(N),'-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(video)],check=True)
   indices=[0,round(info['duration']*24/4),round(info['duration']*24/2),round(info['duration']*24*3/4)];sheet=Image.new('RGB',(960,496*4),'#172737')
   for r,i in enumerate(indices):sheet.paste(Image.open(dest/f'{i:04d}.png'),(0,r*496))
   sheet.save(OUT/f'{name}-comparison.jpg',quality=91)
   record=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]));stream=record['streams'][0];assert int(stream['nb_frames'])==N;assert stream['r_frame_rate']=='24/1';assert stream['codec_name']=='h264';assert abs(float(record['format']['duration'])-N/24)<.001
   report.append({'file':video.name,'frames':N,'fps':24,'duration':N/24,'pixelFormat':stream['pix_fmt'],'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'sourceCaptures':captures,'cameraEqual':True,'characterGeometryEqual':True,'nativeTiming':True,'sharedGroundSpeedMps':info['speedMps']});print('Packaged:',name,flush=True)
(ROOT/'validation/recordings.json').write_text(json.dumps(report,indent=2)+'\n')
for action in ['Walk_Loop','Sprint_Loop']:
 paths=sorted(OUT.glob(f'Quaternius-{action}-phase-*.png'))
 if len(paths)==4:
  sheet=Image.new('RGB',(420*4,484),'#172737');draw=ImageDraw.Draw(sheet)
  for i,p in enumerate(paths):sheet.paste(Image.open(p).convert('RGB'),(420*i,44));draw.text((420*i+12,14),f'Quaternius {action} | phase {i}/4',font=small,fill='#eef6fc')
  sheet.save(OUT/f'Quaternius-{action}-source.jpg',quality=92)
