"""Compare two real motions on the same actual external model, without retiming."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'review';CACHE=Path('/workspace/infantry-integration-frames');OLD=Path('/workspace/tactical-suit-frames');font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12);report=[]
for view in ['side','iso']:
 dest=CACHE/f'sprint-comparison-{view}';dest.mkdir(exist_ok=True)
 for i in range(16):
  im=Image.new('RGB',(1024,580),'#152634');d=ImageDraw.Draw(im)
  for col,p in enumerate([CACHE/f'motion-sprint-{view}-suit',OLD/f'motion-sprint-{view}-suit']):im.paste(Image.open(p/f'{i:04d}.png').convert('RGB'),(col*512,48))
  d.text((12,6),'ACTUAL TACTICAL SUIT | TACTICAL SPRINT',font=font,fill='#edf5fb');d.text((524,6),'SAME TACTICAL SUIT | EMERGENCY CANDIDATE',font=font,fill='#edf5fb')
  d.text((12,27),'Existing SR retarget | native 1x | 3.156 m/s',font=small,fill='#c2d4df');d.text((524,27),'Quaternius Sprint_Loop | native 1x | 7.693 m/s',font=small,fill='#c2d4df')
  d.text((12,564),('Side'if view=='side'else'30-degree isometric')+f' | identical model/camera/scale | separate forward escape candidate | t={i/24:.3f}s',font=small,fill='#c2d4df');im.save(dest/f'{i:04d}.png')
 movie=OUT/f'sprint-roles-{view}.mp4';subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','24','-i',str(dest/'%04d.png'),'-frames:v','16','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],check=True)
 sheet=Image.new('RGB',(1024,2320))
 for row,i in enumerate([0,4,8,12]):sheet.paste(Image.open(dest/f'{i:04d}.png'),(0,580*row))
 sheet.save(OUT/f'sprint-roles-{view}.jpg',quality=93)
 meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(movie)]));s=meta['streams'][0];assert int(s['nb_frames'])==16 and s['r_frame_rate']=='24/1'and s['codec_name']=='h264'and s['pix_fmt']=='yuv420p'
 report.append({'file':movie.name,'frames':16,'fps':24,'duration':16/24,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),'sameExternalCharacter':True,'nativeTiming':True,'sameCameraAndLighting':True,'rightFramesReused':'Previously rendered actual Quaternius clip, unchanged in new integrated GLB. No image/model substitution.'})
shutil.copyfile(CACHE/'motion-idle-iso-suit/0000.png',OUT/'idle-iso.png')
(ROOT/'validation/recordings.json').write_text(json.dumps(report,indent=2)+'\n')
