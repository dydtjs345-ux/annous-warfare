"""Anonymous HTTPS asset/protection checks; not browser or physical Safari QA."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
import subprocess,tempfile,hashlib,json,re,time
ROOT=Path(__file__).resolve().parents[1];DIST=Path('/workspace/sites/infantry-tactical-preview/dist');SITE='https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/';PAGE=SITE+'phase2-crouch/'
def sha(b):return hashlib.sha256(b).hexdigest()
before=json.loads((ROOT/'validation/site-baseline.json').read_text())
for name,digest in before.items():assert sha((DIST/name).read_bytes())==digest,'Previous hosted file changed: '+name

def fetch(url):
 p=subprocess.run(['curl','-LfsS','--max-time','45','--retry','1',url],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError(p.stderr.decode()[:200]+' '+url)
 return p.stdout
files=[p for p in DIST.rglob('*')if p.is_file()and p.name!='.nojekyll']
def check(p):
 name=str(p.relative_to(DIST));actual=fetch(SITE+quote(name));assert sha(actual)==sha(p.read_bytes()),name;return {'path':name,'sha256':sha(actual),'bytes':len(actual)}
with ThreadPoolExecutor(max_workers=6)as ex:checks=list(ex.map(check,files))
assert fetch(PAGE)==(DIST/'phase2-crouch/index.html').read_bytes()
manifest=json.loads(fetch(PAGE+'manifest.json'));assert len(manifest['states']['TacticalSuit'])==6;assert manifest['models']['TacticalSuit']['path']==manifest['models']['TacticalSuitBaseline']['path'];assert not manifest['models']['TacticalSuit']['originalUSMCBodyIncluded']
modelUrl=PAGE+manifest['models']['TacticalSuit']['path'];t=time.monotonic();model=fetch(modelUrl);seconds=time.monotonic()-t;assert sha(model)==manifest['models']['TacticalSuit']['sha256']
for route in ['infantry-integration/','tactical-suit-review/','open-asset-review/']:assert fetch(SITE+route)==(DIST/route/'index.html').read_bytes()
protected=[]
for name,url in [('live-game','https://dydtjs345-ux.github.io/annous-warfare/'),('combat-test','https://autonomous-warfare-infantry-combat-test.companionablejellyfish2.chatgpt.site/')]:
 actual=fetch(url);old=Path(f'/workspace/open-asset-downloads/{name}-before.html').read_bytes();assert actual==old,name;protected.append({'url':url,'sha256':sha(actual),'entryHtmlUnchanged':True})
video=DIST/'phase2-crouch/recordings/walk-iso.mp4'
with tempfile.TemporaryDirectory()as tmp:
 head=Path(tmp)/'headers';body=Path(tmp)/'body';subprocess.run(['curl','-LfsS','--max-time','30','--range','0-127','-D',str(head),'-o',str(body),PAGE+'recordings/walk-iso.mp4'],check=True);headers=head.read_text();status=int(re.findall(r'HTTP/[^ ]+ (\d+)',headers)[-1]);assert status in [200,206];assert body.read_bytes()==(video.read_bytes()[:128]if status==206 else video.read_bytes());assert 'video/mp4'in headers.lower();delivery={'status':status,'rangeSupported':status==206,'mime':'video/mp4','fallback':'Fetch selected short MP4 as Blob; static comparison frames also available.'}
report={'preview':PAGE,'anonymousVerifiedFiles':len(checks),'previousHostedFilesUnchanged':len(before),'phase2ModelSha256':sha(model),'modelBytes':len(model),'singleServerCurlTransferSeconds':seconds,'transferCaveat':'One server-side curl sample; not mobile/Safari loading, memory or FPS.','protectedGameBuilds':protected,'videoDelivery':delivery,'browserGpuTested':False,'physicalSafariTested':False,'files':checks};(ROOT/'validation/deployment-http.json').write_text(json.dumps(report,indent=2)+'\n');print({k:v for k,v in report.items()if k!='files'})
