"""Review sheets from actual game screenshots, with integer nearest scaling only."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
records=json.loads(Path('reports/v031-comparison.json').read_text())['records']
out=Image.new('RGB',(672,640),'#172430');d=ImageDraw.Draw(out)
for i,r in enumerate(records):
 u=next(u for u in r['snapshot']['units'] if u['id']==1);x,y=u['screenX']+r['canvas']['x'],u['screenY']+r['canvas']['y']
 im=Image.open(f"reports/v031-{r['art']}-scale-{r['size']}.png")
 tile=im.crop((round(x)-28,round(y)-65,round(x)+28,round(y)+7)).resize((224,288),Image.Resampling.NEAREST)
 col,row=i%3,i//3;out.paste(tile,(col*224,row*320+24));d.text((col*224+4,row*320+6),f"{r['art']} {r['size']}x · 4x pixel inspection",fill='white')
out.save('reports/v031-comparison-detail.png')
for mode in ['reload','full','peek']:
 out=Image.new('RGB',(840,300),'#172430');d=ImageDraw.Draw(out)
 for i in range(6):
  im=Image.open(f'/tmp/aw-v031-actions/{mode}-{i}.png')
  # The real-Battle fixture has a fixed camera. No new pose is synthesized here.
  tile=im.crop((380,155,450,235)).resize((140,160),Image.Resampling.NEAREST)
  out.paste(tile,(i*140,40));d.text((i*140+4,10),f'{mode} frame {i}',fill='white')
 d.text((8,215),'Actual simulation fixture · production PNG adapter · 2x nearest inspection',fill='white')
 out.save(f'reports/v031-{mode}-frames.png')
# CDP timestamps pair the real shooting samples to the recorded JPEG frames.
anim=json.loads(Path('reports/v031-animation.json').read_text())
if anim.get('recordedFrames'):
 picks=[];seen=set()
 for run in anim['runs']:
  for sample in run['samples']:
   state=sample['prototype']['state']
   if not state or not state.get('visible') or not state.get('flash'):continue
   stamp=(anim['timeOrigin']+sample['wall'])/1000
   frame=min(anim['recordedFrames'],key=lambda f:abs(f['time']-stamp))
   if frame['file'] in seen:continue
   if picks and sample['time']-picks[-1][0]['time']<.2:continue
   seen.add(frame['file']);picks.append((sample,frame))
 picks=picks[:4]
 out=Image.new('RGB',(210*len(picks),310),'#172430');d=ImageDraw.Draw(out)
 for i,(sample,frame) in enumerate(picks):
  u=sample['unit'];x,y=round(u['screenX']),round(u['screenY'])+72
  tile=Image.open(frame['file']).crop((x-35,y-75,x+35,y+15)).resize((210,270),Image.Resampling.NEAREST)
  out.paste(tile,(i*210,30));d.text((i*210+4,8),f"Real fire t={sample['time']:.2f}s",fill='white')
 out.save('reports/v031-firing-frames.png')
