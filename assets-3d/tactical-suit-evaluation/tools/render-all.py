from pathlib import Path
import os,subprocess,json,hashlib
ROOT=Path(__file__).resolve().parents[1];CACHE=Path('/workspace/tactical-suit-frames');LOG=Path('/workspace/open-asset-downloads');REPO=ROOT.parents[1];records=[]
for mode,action,N in [('appearance','walk',1),('motion','walk',32),('motion','sprint',16)]:
 for view in ['side','iso']:
  for kind in ['original','suit']:
   name=f'{mode}-{action}-{view}-{kind}';log=LOG/f'suit-render-{name}.log';dest=CACHE/name;marker=CACHE/f'{name}.complete.json';key={'mode':mode,'action':action,'view':view,'kind':kind,'frames':N,'renderer':hashlib.sha256((ROOT/'tools/render-review.py').read_bytes()).hexdigest(),'model':hashlib.sha256((ROOT/'models/TacticalSuit_Quaternius_Rifle.glb').read_bytes()).hexdigest()if kind=='suit'and mode=='motion'else hashlib.sha256((ROOT/'source/TacticalSuit_Normalized.glb').read_bytes()).hexdigest()if kind=='suit'else 'preserved-USMC-112592f71ac7'}
   if not(marker.exists()and json.loads(marker.read_text())==key and(dest/f'{N-1:04d}.png').exists()):
    print('Rendering',name,flush=True);env={**os.environ,'SU_KIND':kind,'SU_MODE':mode,'SU_ACTION':action,'SU_VIEW':view,'SU_FRAMES':str(N),'SU_TIME':'0'}
    with log.open('w')as f:subprocess.run(['blender','-b','-t','4','-P',str(ROOT/'tools/render-review.py')],cwd=REPO,env=env,stdout=f,stderr=subprocess.STDOUT,check=True)
    assert 'Traceback'not in log.read_text(),log.read_text()[-1500:];assert(dest/f'{N-1:04d}.png').exists();marker.write_text(json.dumps(key,indent=2)+'\n')
   records.append(key);(ROOT/'validation/render-capture.json').write_text(json.dumps(records,indent=2)+'\n');print('Ready',name,flush=True)
