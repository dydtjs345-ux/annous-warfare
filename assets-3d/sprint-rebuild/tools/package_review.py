"""Encode real 30Hz 3D evaluations; slow versions repeat frames without motion synthesis."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,hashlib
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'review';font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',16);small=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',13);records=[]
def encode(frames,path,rate):
 subprocess.run(['ffmpeg','-y','-v','error','-framerate',str(rate),'-i',str(frames/'%04d.png'),'-vf','fps=30','-c:v','libx264','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(path)],check=True)
for faction in ['USMC','Russian']:
 label='미 해병대'if faction=='USMC'else'러시아군';frames=Path('/tmp')/f'sprint-montage-{faction}';frames.mkdir(exist_ok=True)
 for i in range(60):
  im=Image.new('RGB',(560,960),'#28333f');d=ImageDraw.Draw(im);d.text((12,8),label+' · 질주 전체 재제작 · 왼쪽 OLD / 오른쪽 NEW',font=font,fill='white')
  for view,y,title in [('iso',65,'30° 직교 게임 쿼터뷰 · 120px 기준'),('side',365,'측면 · 발의 접지와 다리 회복 · 180px 상세'),('front',665,'정면 · 좌우 체중 이동 · 180px 상세')]:
   d.text((12,y-22),title,font=small,fill='#d5e7c5');im.paste(Image.open(Path('/tmp')/f'sprint-{faction}-{view}'/f'{i:04d}.png'),(0,y))
  im.save(frames/f'{i:04d}.png')
 Image.open(frames/'0004.png').save(out/f'{faction}-sprint.png')
 for speed,rate in [('normal',30),('slow',15)]:encode(frames,out/f'{faction}-sprint-{speed}.mp4',rate)
 records.append({'faction':faction,'type':'OLD_NEW','normal':f'{faction}-sprint-normal.mp4','slow':f'{faction}-sprint-slow.mp4','real_3d_evaluations':60,'source_fps':30,'views':['30_degree_orthographic','side','front'],'native_gameplay_reference_px':120,'old_profile':'full-body-1','new_profile':'sprint-review-2'})
 # Actual-travel renders are optional until their pass finishes, never manufacture a movie.
 src=Path('/tmp')/f'sprint-{faction}-travel'
 if len(list(src.glob('[0-9][0-9][0-9][0-9].png')))==144:
  frames2=Path('/tmp')/f'sprint-travel-encode-{faction}';frames2.mkdir(exist_ok=True)
  for i in range(144):
   im=Image.new('RGB',(400,680),'#28333f');d=ImageDraw.Draw(im);d.text((12,7),label+' · 실제 9.12m 이동',font=font,fill='white');d.text((12,31),'가속 → 질주 → 감속 → 정지 · 30° 고정 카메라',font=small,fill='#d5e7c5');im.paste(Image.open(src/f'{i:04d}.png'),(0,60));im.save(frames2/f'{i:04d}.png')
  Image.open(frames2/'0040.png').save(out/f'{faction}-travel.png');encode(frames2,out/f'{faction}-travel.mp4',30);records.append({'faction':faction,'type':'WORLD_TRAVEL','file':f'{faction}-travel.mp4','route_m':9.12,'actual_3d_samples':144,'fixed_camera':True})
(ROOT/'diagnostics/video-validation.json').write_text(json.dumps(records,indent=2,ensure_ascii=False));print('CONTINUOUS_SPRINT_VIDEOS',len(records))
