"""Package actual 3D rendered sequences; no generated or interpolated body motion."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,hashlib,math
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'review';FONT=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',15);SMALL=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',12);report=[]
labels={'Walk':'전술 보행','Sprint':'전력 질주','AimWalk':'조준 이동','MovingFire':'이동 사격','Reload':'재장전'}
for faction,label in [('USMC','미 해병대 · M16A4'),('Russian','러시아군 · AK-74M')]:
 for state,title in labels.items():
  D=(3.7 if faction=='USMC'else 4.1)if state=='Reload'else 2.4;fps=30 if state in ['MovingFire','Reload']else 15;duration=D+.3 if state=='Reload'else D;count=math.ceil(duration*fps);frames=Path('/tmp')/f'body-comparison-{faction}-{state}';frames.mkdir(exist_ok=True);unique=set()
  for i in range(count):
   canvas=Image.new('RGB',(560,640),'#28333f');draw=ImageDraw.Draw(canvas);draw.text((10,4),label+' · '+title,font=FONT,fill='#e8edf2');draw.text((10,27),'왼쪽: 수정 전  /  오른쪽: 수정 후',font=SMALL,fill='#d7e4c7');draw.text((10,47),'게임 쿼터뷰 · 30° 직교 · 병사 기준 120px',font=SMALL,fill='white')
   for view,y in [('iso',68),('side',368)]:canvas.paste(Image.open(Path('/tmp')/f'body-{faction}-{state}-{view}'/f'{i:04d}.png').convert('RGB'),(0,y))
   draw.text((10,348),'측면 · 수평 직교 · 상세 기준 180px',font=SMALL,fill='white');draw.text((10,619),f'실제 3D 본 표시 · 원본 동작 {min(i/fps,D):.2f}초 · {fps}fps 평가',font=SMALL,fill='white');canvas=canvas.crop((0,0,560,640));canvas.save(frames/f'{i:04d}.png');unique.add(hashlib.sha256(canvas.crop((0,68,560,348)).tobytes()).hexdigest())
  assert len(unique)>=12,(faction,state,len(unique))
  poster=OUT/f'{faction}-{state}.png';Image.open(frames/f'{min(count-1,round(.23*fps)):04d}.png').save(poster);target=OUT/f'{faction}-{state}.mp4';subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-framerate',str(fps),'-i',str(frames/'%04d.png'),'-vf','fps=30','-c:v','libx264','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],check=True);info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration','-of','json',str(target)]));assert abs(float(info['format']['duration'])-count/fps)<.05
  report.append({'faction':faction,'state':state,'file':target.name,'poster':poster.name,'source_fps':fps,'source_actual_3d_samples':count,'unique_isometric_frames':len(unique),'render_engine':'Blender Workbench studio lighting, FXAA','iso_orthographic_elevation_degrees':30,'iso_standing_reference_px':120,'side_elevation_degrees':0,'side_standing_reference_px':180,'actual_bone_markers':True,'before_profile':'a93cbae','after_profile':'full-body-1','video':info})
(ROOT/'diagnostics/video-validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print('TEN_CONTINUOUS_3D_COMPARISONS_PACKAGED',flush=True)
