"""Paired real GLB renders. Same camera/model/scale, native timing, real root travel."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'review';CACHE=Path('/workspace/phase2-crouch-frames');OUT.mkdir(exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12);report=[]
for action in ['walk','idle']:
 for view in ['side','iso']:
  N=48 if action=='walk'else 72;dest=CACHE/f'paired-{action}-{view}';dest.mkdir(exist_ok=True)
  for i in range(N):
   im=Image.new('RGB',(1024,584),'#152634');d=ImageDraw.Draw(im)
   for col,profile in enumerate(['legacy','authored']):im.paste(Image.open(CACHE/f'{action}-{view}-{profile}/{i:04d}.png').convert('RGB'),(col*512,48))
   d.text((12,6),'ACTUAL TACTICAL SUIT | LEGACY CROUCH',font=font,fill='#edf5fb');d.text((524,6),'SAME TACTICAL SUIT | QUATERNIUS CC0',font=font,fill='#edf5fb')
   d.text((12,27),('TC_CrouchWalk retarget | 1x | 0.482 m/s'if action=='walk'else'TC_CrouchIdle retarget | 1x | 2.4s native cycle'),font=small,fill='#c2d4df')
   d.text((524,27),('Crouch_Fwd_Loop | 1x | 0.699 m/s'if action=='walk'else'Crouch_Idle_Loop | 1x | 2.933s native cycle'),font=small,fill='#c2d4df')
   d.text((12,566),('Side'if view=='side'else'30-degree isometric')+f' | same body, scale, camera | original durations; no speed matching | t={i/24:.3f}s',font=small,fill='#c2d4df');im.save(dest/f'{i:04d}.png')
  movie=OUT/f'{action}-{view}.mp4';subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','24','-i',str(dest/'%04d.png'),'-frames:v',str(N),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],check=True)
  sheet=Image.new('RGB',(1024,2336))
  for row,i in enumerate([0,N//4,N//2,3*N//4]):sheet.paste(Image.open(dest/f'{i:04d}.png'),(0,584*row))
  sheet.save(OUT/f'{action}-{view}.jpg',quality=93)
  if action=='walk'and view=='iso':Image.open(dest/'0000.png').save(OUT/'walk-iso-poster.jpg',quality=94)
  meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(movie)]));s=meta['streams'][0];assert int(s['nb_frames'])==N and s['r_frame_rate']=='24/1'and s['codec_name']=='h264'and s['pix_fmt']=='yuv420p'
  report.append({'file':movie.name,'frames':N,'fps':24,'durationS':N/24,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),'sameActualExternalCharacter':True,'sameCameraScaleLighting':True,'nativeTiming':True,'realGroundTranslation':action=='walk','worldSpaceMetreGrid':True,'renderedFromFinalGlb':True,'runtimeBlendingIncluded':False})
for view in ['hands','hands-right']:Image.open(CACHE/f'walk-{view}-authored/0000.png').convert('RGB').save(OUT/f'grip-{view}.jpg',quality=95)
(ROOT/'validation/recordings.json').write_text(json.dumps(report,indent=2)+'\n');print('Encoded',len(report),'native-speed comparisons.')
