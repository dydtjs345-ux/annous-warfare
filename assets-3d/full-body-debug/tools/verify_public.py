"""Verify every deployed file and exact versioned asset bytes anonymously."""
from pathlib import Path
import urllib.request,hashlib,json,concurrent.futures
ROOT=Path(__file__).resolve().parents[1];DIST=ROOT.parent.parent/'animation-preview-pages/dist';BASE='https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/';REVIEW=BASE+'?review=body&state=MovingFire&markers=1';UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
def check(p):
 name=p.relative_to(DIST).as_posix();url=BASE+(''if name=='index.html'else name)
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=120)as r:data=r.read();status=r.status;mime=r.headers.get('content-type')
 digest=hashlib.sha256(data).hexdigest();assert status==200 and digest==hashlib.sha256(p.read_bytes()).hexdigest(),name
 return {'file':name,'status':status,'sha256':digest,'matches_build':True,'bytes':len(data),'content_type':mime}
files=sorted(p for p in DIST.rglob('*')if p.is_file()and not p.name.startswith('.'))
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:checks=list(pool.map(check,files))
with urllib.request.urlopen(urllib.request.Request(REVIEW,headers={'User-Agent':UA}),timeout=120)as r:assert r.status==200 and r.read()==(DIST/'index.html').read_bytes()
source=json.loads((DIST/'source.json').read_text());architecture=json.loads((DIST/'architecture.json').read_text());assert source['motion_revision']==architecture['motion_revision']=='full-body-1';assert source['clips_per_faction']==34
for f in ['USMC','Russian']:
 model=architecture['factions'][f]['model'];digest=source['asset_sha256'][f];assert digest[:12]in model;assert hashlib.sha256((DIST/model).read_bytes()).hexdigest()==digest
report={'url':BASE,'review_url':REVIEW,'all_assets_hash_match':True,'anonymous_https':True,'iphone_safari_user_agent':True,'runtime_browser_verification':'See browser-after.json; this file verifies HTTPS and bytes only.','files':checks};(ROOT/'diagnostics/public-https.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'review_url':REVIEW,'verified_files':len(checks),'all_hashes_match':True}))
