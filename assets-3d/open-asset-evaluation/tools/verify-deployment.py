"""Anonymous HTTP verification; no browser, credentials, or source mutations."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
import subprocess,tempfile,hashlib,json
ROOT=Path(__file__).resolve().parents[1];DIST=Path('/workspace/sites/infantry-tactical-preview/dist');SITE='https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/'
def sha(b):return hashlib.sha256(b).hexdigest()
before=json.loads(Path('/workspace/open-asset-site-before.json').read_text())
for name,h in before.items():assert sha((DIST/name).read_bytes())==h,'Previous preview file modified: '+name
def fetch(url):
 p=subprocess.run(['curl','-LfsS','--max-time','45','--retry','1',url],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError(p.stderr.decode()[:200]+' '+url)
 return p.stdout
files=[p for p in DIST.rglob('*')if p.is_file()and p.name!='.nojekyll']
def check(p):
 name=str(p.relative_to(DIST));actual=fetch(SITE+quote(name));assert sha(actual)==sha(p.read_bytes()),name;return {'path':name,'sha256':sha(actual),'bytes':len(actual)}
with ThreadPoolExecutor(max_workers=6)as ex:checks=list(ex.map(check,files))
index=(DIST/'open-asset-review/index.html').read_bytes();queries=[]
for q in ['?view=side&faction=USMC&action=walk','?view=iso&faction=Russian&action=sprint','?action=crawl']:
 url=SITE+'open-asset-review/'+q;assert fetch(url)==index;queries.append(url)
protected=[]
for name,url in [('live-game','https://dydtjs345-ux.github.io/annous-warfare/'),('combat-test','https://autonomous-warfare-infantry-combat-test.companionablejellyfish2.chatgpt.site/')]:
 actual=fetch(url);old=Path(f'/workspace/open-asset-downloads/{name}-before.html').read_bytes();assert actual==old,name;protected.append({'url':url,'sha256':sha(actual),'unchanged':True})
video=next(p for p in files if 'open-asset-review/recordings/'in str(p));relative=str(video.relative_to(DIST))
with tempfile.TemporaryDirectory()as tmp:
 head=Path(tmp)/'headers';body=Path(tmp)/'body';subprocess.run(['curl','-LfsS','--max-time','30','--range','0-127','-D',str(head),'-o',str(body),SITE+quote(relative)],check=True);headers=head.read_text();assert '206' in headers;assert body.read_bytes()==video.read_bytes()[:128];assert 'video/mp4'in headers.lower();rangeCheck={'path':relative,'status':206,'bytes':128,'mime':'video/mp4'}
x={'site':SITE,'comparison':SITE+'open-asset-review/','anonymousVerifiedFiles':len(checks),'previousPreviewFilesPreserved':len(before),'queryUrls':queries,'protectedGameBuilds':protected,'videoRangeRequest':rangeCheck,'physicalSafari':False,'browserQA':False,'files':checks};(ROOT/'validation/deployment-http.json').write_text(json.dumps(x,indent=2)+'\n');print({k:v for k,v in x.items()if k!='files'})
