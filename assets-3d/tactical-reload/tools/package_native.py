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
