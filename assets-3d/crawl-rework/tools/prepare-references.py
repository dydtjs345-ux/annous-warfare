"""Extract selected native frames from the user attachments; never copy MOVs."""
import subprocess,json,hashlib,html,os
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'review/reference';OUT.mkdir(parents=True,exist_ok=True)
attachment=Path(os.environ.get('AW_CRAWL_REFERENCES','/tmp/codex-remote-attachments/01a1c25b-3836-762d-bc32-bcd26f754062/E9406360-1DDD-491F-92DC-C1B6C7FE1B83'))
records=[]
for num,(file,times,crop,label)in enumerate([
 ('2-crawl_reference_small.mov',[.833,1.167,1.5,1.833,2.167,2.833],(0,140,430,820),'실제 훈련 · 사용자 제공'),
 ('1-crawl_reference_second_small.mov',[9,9.667,10.333,11],(0,600,420,815),'Arma Reforger 하단 화면 · 사용자 제공')],1):
 path=attachment/file;probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',str(path)]));pts=[float(f['best_effort_timestamp_time'])for f in probe['frames']];selected=sorted({min(range(len(pts)),key=lambda n:abs(pts[n]-t))for t in times});tmp=Path('/tmp')/f'aw-reference-native-{num}';tmp.mkdir(exist_ok=True)
 expression='+'.join(f'eq(n,{i})'for i in selected);subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(path),'-vf',f'select={expression.replace(",",chr(92)+",")}','-fps_mode','vfr',str(tmp/'%03d.png')],check=True)
 record={'file':file,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'nativeFrameCount':len(pts),'label':label,'selectedFrames':[]}
 for index,p in zip(selected,sorted(tmp.glob('*.png'))):
  name=f'ref-{num}-frame-{index:03d}.jpg';im=Image.open(p).crop(crop);im.save(OUT/name,quality=91)
  record['selectedFrames'].append({'nativeFrameIndex':index,'presentationTimeSeconds':pts[index],'nativeFramePngSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cropXYXY':crop,'file':name})
 records.append(record)
(ROOT/'validation/reference-frames.json').write_text(json.dumps({'actualFilesDecoded':2,'initialInspection':'Complete 6 Hz decoded sequences and chronological detail sheets; selected native frames below have exact PTS.','sources':records},indent=2)+'\n')
body=''
for record in records:
 body+=f'<h2>{html.escape(record["label"])}</h2><p>{html.escape(record["file"])}</p><div class="frames">'
 for f in record['selectedFrames']:body+=f'<figure><img src="reference/{f["file"]}" alt="참고 영상 프레임 {f["nativeFrameIndex"]}"><figcaption>{f["presentationTimeSeconds"]:.3f} s · native frame {f["nativeFrameIndex"]}</figcaption></figure>'
 body+='</div>'
page='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>포복 참고 프레임 분석</title><style>body{background:#152431;color:#e4eef7;font:16px/1.6 system-ui;margin:auto;padding:20px;max-width:1200px}.frames{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:250px}img{width:100%;display:block}a{color:#a9dcff}h2{font-size:1.2rem}</style><h1>실제로 검토한 포복 참고 프레임</h1><p>사용자 첨부 영상을 FFmpeg로 디코딩했습니다. 아래 시각은 원본 파일의 프레젠테이션 타임스탬프입니다. 전체 영상을 재배포하지 않고 검토에 사용한 일부 크롭만 표시합니다.</p><p>관찰: 바깥으로 회수하는 무릎에 따라 골반이 회전하고, 전완 지지 위로 몸통이 이동하며, 가슴·어깨와 골반이 약간 다른 시점에 움직입니다. 압축과 가려짐 때문에 정확한 관절 각도·접촉력·속도는 측정하지 않았습니다. 이 프레임은 우리 모델의 동작을 평가하기 위한 참고이며, 원본 게임 애니메이션 데이터를 복사하지 않았습니다.</p><p>실제 훈련 화면 출처 표시: @rok_army. 게임 비교 화면 출처 표시: @ZeroAccuracy2026. 파일은 사용자가 제공했습니다.</p><a href="index.html">원본 / 수정 포복 비교로 돌아가기</a>'''+body+'</html>'
(ROOT/'review/reference-study.html').write_text(page)
print('Extracted native reference frames:',sum(len(r['selectedFrames'])for r in records))
