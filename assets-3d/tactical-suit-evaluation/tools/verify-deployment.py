"""Anonymous HTTP hashes; does not assert browser or physical Safari playback."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
import subprocess,tempfile,hashlib,json,re
ROOT=Path(__file__).resolve().parents[1];DIST=Path('/workspace/sites/infantry-tactical-preview/dist');SITE='https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/'
def sha(b):return hashlib.sha256(b).hexdigest()
before=json.loads(Path('/workspace/tactical-suit-site-before.json').read_text());allowed='open-asset-review/index.html'
for name,h in before.items():
 if name!=allowed:assert sha((DIST/name).read_bytes())==h,'Previous file changed: '+name
oldPage=(DIST/allowed).read_text();assert '/tactical-suit-review/'in oldPage and '동작만 평가'in oldPage
newPage=(DIST/'tactical-suit-review/index.html').read_text();assert 'DanlyVostok'in newPage and '원본 USMC 모델에 새 동작만'in newPage

def fetch(url):
 p=subprocess.run(['curl','-LfsS','--max-time','45','--retry','1',url],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError(p.stderr.decode()[:200]+' '+url)
 return p.stdout
files=[p for p in DIST.rglob('*')if p.is_file()and p.name!='.nojekyll']
def check(p):
 name=str(p.relative_to(DIST));actual=fetch(SITE+quote(name));assert sha(actual)==sha(p.read_bytes()),name;return {'path':name,'sha256':sha(actual),'bytes':len(actual)}
with ThreadPoolExecutor(max_workers=6)as ex:checks=list(ex.map(check,files))
index=(DIST/'tactical-suit-review/index.html').read_bytes();queries=[]
for q in ['?mode=appearance&view=side','?mode=motion&view=iso&action=walk','?mode=motion&view=side&action=sprint','?mode=motion&action=crawl']:
 url=SITE+'tactical-suit-review/'+q;assert fetch(url)==index;queries.append(url)
protected=[]
for name,url in [('live-game','https://dydtjs345-ux.github.io/annous-warfare/'),('combat-test','https://autonomous-warfare-infantry-combat-test.companionablejellyfish2.chatgpt.site/')]:
 actual=fetch(url);old=Path(f'/workspace/open-asset-downloads/{name}-before.html').read_bytes();assert actual==old,name;protected.append({'url':url,'sha256':sha(actual),'unchanged':True})
video=DIST/'tactical-suit-review/recordings/walk-iso.mp4';relative=str(video.relative_to(DIST))
with tempfile.TemporaryDirectory()as tmp:
 head=Path(tmp)/'headers';body=Path(tmp)/'body';subprocess.run(['curl','-LfsS','--max-time','30','--range','0-127','-D',str(head),'-o',str(body),SITE+quote(relative)],check=True);headers=head.read_text();status=int(re.findall(r'HTTP/[^ ]+ (\d+)',headers)[-1]);assert status in [200,206];assert body.read_bytes()==(video.read_bytes()[:128]if status==206 else video.read_bytes());assert 'video/mp4'in headers.lower();delivery={'path':relative,'status':status,'rangeSupported':status==206,'bytes':len(body.read_bytes()),'mime':'video/mp4','fallback':'Fetch selected short MP4 into local Blob; static images provided.'}
manifest=json.loads((DIST/'tactical-suit-review/manifest.json').read_text());assert not manifest['actualModel']['originalUSMCBodyIncluded'];model=fetch(SITE+'tactical-suit-review/'+manifest['actualModel']['path']);assert sha(model)==manifest['actualModel']['sha256']
x={'site':SITE,'comparison':SITE+'tactical-suit-review/','anonymousVerifiedFiles':len(checks),'previousFilesPreserved':len(before)-1,'previousTextLabelCorrection':allowed,'queryUrls':queries,'actualModelSha256':sha(model),'protectedGameBuilds':protected,'videoDelivery':delivery,'physicalSafari':False,'browserQA':False,'files':checks};(ROOT/'validation/deployment-http.json').write_text(json.dumps(x,indent=2)+'\n');print({k:v for k,v in x.items()if k!='files'})
