from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1];font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',16);report=[]
for faction,label in [('USMC','미 해병대 · M16A4'),('Russian','러시아군 · AK-74M')]:
 for height in [60,80,120]:
  sheet=Image.new('RGB',(1000,500),'#28333f');draw=ImageDraw.Draw(sheet);draw.text((12,8),f'{label} · {height}px · 위: 원본 / 아래: 개선 · 실제 3D 렌더',font=font,fill='white')
  for i in range(5):
   for row,variant in enumerate(['original','improved']):sheet.paste(Image.open(root/'review'/f'{faction}-{variant}'/f'native-{height}-{i}.png').convert('RGB'),(i*200,40+row*220))
  path=root/'review'/f'{faction}-native-{height}.png';sheet.save(path);report.append({'file':str(path.relative_to(root)),'standing_reference_px':height,'camera':'orthographic 30 degrees, SE','pose_images_resized':False,'render_engine':'Blender Workbench textured studio lighting'})
(root/'validation/native-readability.json').write_text(json.dumps(report,indent=2)+'\n');print('SIX_NATIVE_COMPARISON_SHEETS_PACKAGED')
grips=[]
for faction,label in [('USMC','미 해병대 · M16A4'),('Russian','러시아군 · AK-74M')]:
 frames=Path('/tmp')/f'reload-grips-{faction}'
 if not frames.exists():continue
 headings=['N','NE','E','SE','S','SW','W','NW'];sheet=Image.new('RGB',(8*380,940),'#28333f');draw=ImageDraw.Draw(sheet)
 draw.text((12,5),label+' · 8방향 접촉 검토 · 위: 탄창 분리 / 아래: 새 탄창 삽입',font=font,fill='white')
 for column,heading in enumerate(headings):
  draw.text((column*380+12,30),heading,font=font,fill='white')
  for row in range(2):sheet.paste(Image.open(frames/f'{heading}-{row}.png').convert('RGB'),(column*380,60+row*440))
 target=root/'review'/f'{faction}-grip-directions.png';sheet.save(target);grips.append({'file':str(target.relative_to(root)),'headings':headings,'actual_3d_rotations':True,'camera_elevation_degrees':30,'standing_reference_px':300,'phases':[1.05,2.42],'camera_scale_calibrated_per_heading':True})
(root/'validation/grip-inspection.json').write_text(json.dumps(grips,indent=2)+'\n')
