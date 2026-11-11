"""Resumable offline visual capture. Redirect output to a persistent log."""
from pathlib import Path
import os,subprocess,json,hashlib
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1];CACHE=Path('/workspace/open-asset-downloads');rows=[]
rendererHash=hashlib.sha256((ROOT/'tools/render-review.py').read_bytes()).hexdigest()
for faction in ['USMC','Russian']:
 for action,N in [('walk',32),('sprint',16)]:
  for view in ['side','iso']:
   name=f'{faction}-{action}-{view}';dirs=[CACHE/'render'/f'{name}-{kind}'for kind in ['original','imported']]
   for kind,d in zip(['original','imported'],dirs):
    marker=CACHE/'render'/f'{name}-{kind}.complete.json';model=CACHE/'render'/f'{faction}-{kind}.glb';modelHash=hashlib.sha256(model.read_bytes()).hexdigest();expected={'sourceModelSha256':modelHash,'rendererSha256':rendererHash,'frames':N,'unusedSpareMagazineHidden':True}
    framesExist=all((d/f'{i:04d}.png').is_file()for i in range(N));complete=marker.exists()and all(json.loads(marker.read_text()).get(k)==v for k,v in expected.items()if k!='frames')and json.loads(marker.read_text()).get('frames',0)>=N and framesExist
    # Reuse original-side captures already completed and visually checked before
    # adding source toe/finger mapping; their file and camera did not change.
    oldLog=CACHE/f'render-{name}.log'
    if not marker.exists()and kind=='original'and framesExist and oldLog.exists()and f'RENDERED {d}'in oldLog.read_text():complete=True
    if kind=='original'and framesExist and all((d/f'{i:04d}.png').stat().st_mtime>=(ROOT/'tools/render-review.py').stat().st_mtime for i in range(N)):complete=True
    if not complete:
     env={**os.environ,'AW_FACTION':faction,'AW_ACTION':action,'AW_VIEW':view,'AW_FRAMES':str(N),'AW_KINDS':kind};print('Rendering',name,kind,flush=True);log=CACHE/f'render-{name}-{kind}.log'
     with log.open('w')as f:subprocess.run(['blender','-b','-t','4','-P',str(ROOT/'tools/render-review.py')],cwd=REPO,env=env,stdout=f,stderr=subprocess.STDOUT,check=True)
     assert 'Traceback'not in log.read_text(),log.read_text()[-1000:]
    assert (d/f'{N-1:04d}.png').is_file();marker.write_text(json.dumps(expected,indent=2)+'\n')
   rows.append({'faction':faction,'action':action,'view':view,'framesPerActor':N,'nativePlaybackSpeed':1,'sampleTime':'frameIndex / 24 seconds','sceneFpsAtGLBImport':30,'imageSize':[480,420],'orthographicVerticalSpanM':2.15,'cameraOffset':[6,0,0]if view=='side'else[6,-6,4.898979485566356],'cameraAndGroundShared':True,'rendererSha256':rendererHash,'modelSha256':{k:hashlib.sha256((CACHE/'render'/f'{faction}-{k}.glb').read_bytes()).hexdigest()for k in ['original','imported']},'unusedSpareMagazineHidden':True,'completed':True});(ROOT/'validation/render-capture.json').write_text(json.dumps(rows,indent=2)+'\n');print('Ready',name,flush=True)
