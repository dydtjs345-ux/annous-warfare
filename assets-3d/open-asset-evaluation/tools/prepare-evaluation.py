"""Pin archives, retain exact licence bytes, inventory real GLBs, prepare review copies."""
from pathlib import Path
import hashlib,json,struct,shutil
ROOT=Path(__file__).resolve().parents[1];CACHE=Path('/workspace/open-asset-downloads')
def read(p):
 b=p.read_bytes();j=None;bin=None;o=12
 while o<len(b):
  n,k=struct.unpack_from('<II',b,o)
  if k==0x4e4f534a:j=json.loads(b[o+8:o+8+n])
  if k==0x004e4942:bin=b[o+8:o+8+n]
  o+=8+n
 return j,bin
def write(p,j,b):
 a=json.dumps(j,separators=(',',':')).encode();a+=b' '*(-len(a)%4);b+=b'\0'*(-len(b)%4)
 p.write_bytes(struct.pack('<IIIII',0x46546c67,2,28+len(a)+len(b),len(a),0x4e4f534a)+a+struct.pack('<II',len(b),0x004e4942)+b)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
inventory=[]
for n in [1,2]:
 d=next((CACHE/f'ual{n}').iterdir());shutil.copyfile(d/'License.txt',ROOT/'licenses'/f'Quaternius-UAL{n}-License.txt');shutil.copyfile(d/'README.txt',ROOT/'licenses'/f'Quaternius-UAL{n}-README.txt')
 for p in sorted(d.rglob('UAL*.glb')):
  j,b=read(p);inventory.append({'file':p.name,'archive':f'ual{n}-standard.zip','sha256':sha(p),'bytes':p.stat().st_size,'bones':[j['nodes'][i]['name']for i in j['skins'][0]['joints']],'clips':[{'name':a['name'],'channels':len(a['channels']),'duration':max(j['accessors'][s['input']]['max'][0]for s in a['samplers'])}for a in j['animations']]})
(ROOT/'validation'/'downloaded-inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
archives={p.name:{'sha256':sha(p),'bytes':p.stat().st_size}for p in CACHE.glob('*.zip')}
(ROOT/'validation'/'archive-hashes.json').write_text(json.dumps(archives,indent=2)+'\n')
for name in ['bamen','redveil','danly']:
 x=json.loads((CACHE/f'{name}-api.json').read_text());safe={k:x.get(k)for k in ['uid','name','license','description','isDownloadable','animationCount','faceCount','vertexCount','viewerUrl','publishedAt']};safe['author']={k:x['user'].get(k)for k in ['username','displayName','profileUrl']};safe['retrieved']='2026-11-11';(ROOT/'licenses'/f'Sketchfab-{name}.json').write_text(json.dumps(safe,indent=2)+'\n')
(ROOT/'licenses'/'Sketchfab-download-status.json').write_text((CACHE/'bamen-download.json').read_text())
scratch=CACHE/'render';scratch.mkdir(exist_ok=True)
for faction in ['USMC','Russian']:
 base,bb=read(ROOT.parent/'tactical-combat'/'models'/f'{faction}_Tactical.glb');patch,pb=read(ROOT/'models'/f'{faction}_QuaterniusSamples.animation.glb')
 original=json.loads(json.dumps(base));original['animations']=[a for a in base['animations']if a['name']in ['FB_Walk_Lower','FB_Walk_Upper','FB_Sprint_Lower','FB_Sprint_Upper','SR_Sprint_Lower','SR_Sprint_Upper','TC_CrawlForward_Lower','TC_CrawlForward_Upper']];write(scratch/f'{faction}-original.glb',original,bb)
 j=json.loads(json.dumps(base));vo=len(j['bufferViews']);ao=len(j['accessors']);offset=len(bb);j['bufferViews'] += [{**v,'byteOffset':v.get('byteOffset',0)+offset}for v in patch['bufferViews']];j['accessors'] += [{**a,'bufferView':a['bufferView']+vo}for a in patch['accessors']];j['animations']=patch['animations']
 for a in j['animations']:
  for s in a['samplers']:s['input']+=ao;s['output']+=ao
 j['buffers'][0]['byteLength']=len(bb)+len(pb);write(scratch/f'{faction}-imported.glb',j,bb+pb)
print('Inventoried',len(inventory),'actual GLBs; exact licenses retained; render copies prepared.')
