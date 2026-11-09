"""Anonymous HTTPS byte verification, not a browser/device interaction test."""
import urllib.request,hashlib,json,concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT.parent.parent/'animation-preview-pages/dist'
BASE='https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
def check(path):
 name=path.relative_to(DIST).as_posix();url=BASE+(''if name=='index.html'else name)
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=90)as r:
  content=r.read();status=r.status;resolved=r.geturl();mime=r.headers.get('content-type')
 digest=hashlib.sha256(content).hexdigest()
 assert status==200 and resolved.startswith(BASE) and digest==hashlib.sha256(path.read_bytes()).hexdigest(),name
 if name=='index.html':
  text=content.decode();assert '<html lang="ko">'in text
  for label in ['재장전 원본 / 개선 비교','게임 쿼터뷰','6명 분대 보기','재장전 · 보통 속도','재장전 · 느리게']:assert label in text,label
 if name.endswith('-reload.json'):
  data=json.loads(content);assert {c['name']for c in data['clips']}=={'Reload_Tactical','Reload_Tactical_Lower'}
  assert len({c['uuid']for c in data['clips']})==2
 return {'file':name,'status':status,'url':resolved,'content_type':mime,'bytes':len(content),'sha256':digest,'matches_bundle':True}
files=sorted(p for p in DIST.rglob('*')if p.is_file()and not p.name.startswith('.'))
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:results=list(pool.map(check,files))
assert len(results)==18,len(results)
report={'url':BASE,'anonymous_https':True,'iphone_user_agent':True,'all_assets_match_bundle':True,'browser_device_tested':False,'limitation':'Managed Sites browser tool and physical iPhone unavailable; HTTPS checks do not verify WebGL interaction or device layout.','assets':results}
(ROOT/'validation/public-https.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'url':BASE,'verified_files':len(results),'all_hashes_match':True}))
