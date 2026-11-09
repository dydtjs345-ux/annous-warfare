"""Package actual 60Hz 3D poses as 1x/0.5x recordings; never synthesize motion."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'review';font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',16);small=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',13);reports=[]
for faction,label,D in [('USMC','미 해병대 · M16A4',3.7),('Russian','러시아군 · AK-74M',4.1)]:
 frames=Path('/tmp')/f'reload-{faction}-comparison';frames.mkdir(exist_ok=True);count=round((D+.4)*60)+1;hashes=set()
 for i in range(count):
  canvas=Image.new('RGB',(560,328),'#28333f');draw=ImageDraw.Draw(canvas);draw.text((12,3),'원본 재장전 · '+label,font=font,fill='#e6eaf0');draw.text((292,3),'개선 재장전 · '+label,font=font,fill='#c4dba8')
  for column,version in enumerate(['original','improved']):canvas.paste(Image.open(Path('/tmp')/f'reload-{faction}-{version}'/f'{i:04d}.png').convert('RGB'),(280*column,28))
  draw.text((12,309),f'동작 시간 {min(i/60,D):.2f}초 · 고정 30° 직교 카메라',font=small,fill='#d5dfe8');target=frames/f'{i:04d}.png';canvas.save(target);hashes.add(hashlib.sha256(canvas.tobytes()).hexdigest())
 Image.open(frames/f'{round(.54*D/3.7*60):04d}.png').save(OUT/f'{faction}-poster.png')
 for mode,fps,duration in [('normal',60,D+.4),('slow',30,2*(D+.4))]:
  target=OUT/f'{faction}-{mode}.mp4';subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-framerate',str(fps),'-i',str(frames/'%04d.png'),'-vf','fps=30','-t',str(duration),'-c:v','libx264','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],check=True)
  metadata=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height,nb_frames,r_frame_rate:format=duration','-of','json',str(target)]));assert abs(float(metadata['format']['duration'])-duration)<.05;reports.append({'file':str(target.relative_to(ROOT)),'source_3d_pose_samples':count,'unique_frames':len(hashes),'source_pose_fps':60,'playback_multiplier':1 if mode=='normal'else .5,'native_character_reference_px':120,'camera_elevation_degrees':30,'render_engine':'Blender Workbench textured studio lighting','video':metadata})
 assert len(hashes)>120
 # Two detail sheets, each with original above improved; original pixel data retained.
 for part in range(2):
  sheet=Image.new('RGB',(380*5,440*2+60),'#28333f');d=ImageDraw.Draw(sheet);d.text((12,8),label+' · 위: 원본 / 아래: 개선 · 30° 직교 카메라',font=font,fill='white')
  for column,i in enumerate(range(part*5,part*5+5)):
   for row,version in enumerate(['original','improved']):sheet.paste(Image.open(OUT/f'{faction}-{version}'/f'phase-{i:02d}.png'),(column*380,40+row*440))
  sheet.save(OUT/f'{faction}-phases-{part+1}.png')
(ROOT/'validation/video-validation.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False)+'\n');print('FOUR_REAL_3D_RELOAD_VIDEOS_PACKAGED')
