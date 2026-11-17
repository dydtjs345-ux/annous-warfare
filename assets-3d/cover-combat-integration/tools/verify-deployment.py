"""Anonymous public HTTPS bytes and preservation checks; no browser/device QA claim."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
import subprocess,tempfile,hashlib,json,re,time
ROOT=Path(__file__).resolve().parents[1];DIST=Path('/workspace/sites/infantry-tactical-preview/dist');SITE='https://autonomous-warfare-infantry-preview.companionablejellyfish2.chatgpt.site/';PAGE=SITE+'cover-combat/'
def sha(b):return hashlib.sha256(b).hexdigest()
before=json.loads(Path('/workspace/cover-sites-baseline.json').read_text())
for name,digest in before.items():assert sha((DIST/name).read_bytes())==digest,'Previous hosted file changed: '+name
def fetch(url):
 p=subprocess.run(['curl','-LfsS','--max-time','45','--retry','1',url],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError(p.stderr.decode()[:200]+' '+url)
 return p.stdout
def check(p):
 name=str(p.relative_to(DIST));b=fetch(SITE+quote(name));assert sha(b)==sha(p.read_bytes()),name;return{'path':name,'sha256':sha(b),'bytes':len(b)}
files=[p for p in DIST.rglob('*')if p.is_file()and p.name!='.nojekyll']
with ThreadPoolExecutor(max_workers=6)as ex:checks=list(ex.map(check,files))
assert fetch(PAGE)==(DIST/'cover-combat/index.html').read_bytes()
m=json.loads(fetch(PAGE+'manifest.json'));assert len(m['catalog'])==104;assert all(s['status']=='implemented'for s in m['catalog'].values());assert not m['aiConnected'];assert not m['physicalSafariTested']
for kind in ['M16A4','AK74M']:
 for stance in ['Stand','Crouch']:
  for action in ['LeftAim','LeftFire','RightAim','RightFire','LowAim','LowFire','BlindOverFire','BlindLeftFire','BlindRightFire','LeftReturn','Exit']:
   assert m['catalog'][f'{kind}_{stance}_{action}']['clip'].startswith(f'CV_{kind}_{stance}_')
times=[]
for asset in [m['model'],m['patches']['M16A4']]:
 t=time.monotonic();b=fetch(PAGE+asset['path']);elapsed=time.monotonic()-t;assert sha(b)==asset['sha256'];times.append({'path':asset['path'],'bytes':len(b),'singleServerCurlSeconds':elapsed})
protected=[]
for name,url in [('live-game','https://dydtjs345-ux.github.io/annous-warfare/'),('combat-test','https://autonomous-warfare-infantry-combat-test.companionablejellyfish2.chatgpt.site/')]:
 b=fetch(url);assert b==Path(f'/workspace/open-asset-downloads/{name}-before.html').read_bytes(),name;protected.append({'url':url,'sha256':sha(b),'entryHtmlUnchanged':True})
with tempfile.TemporaryDirectory()as tmp:
 head=Path(tmp)/'headers';body=Path(tmp)/'body';subprocess.run(['curl','-LfsS','--max-time','30','--range','0-127','-D',str(head),'-o',str(body),PAGE+'recordings/priority-iso.mp4'],check=True);headers=head.read_text();status=int(re.findall(r'HTTP/[^ ]+ (\d+)',headers)[-1]);video=(DIST/'cover-combat/recordings/priority-iso.mp4').read_bytes();assert status in[200,206];assert body.read_bytes()==(video[:128]if status==206 else video);assert'video/mp4'in headers.lower()
report={'preview':PAGE,'anonymousVerifiedFiles':len(checks),'previousHostedFilesUnchanged':len(before),'coverFiles':sum(f['path'].startswith('cover-combat/')for f in checks),'transfers':times,'transferCaveat':'Server curl sample only; not browser/mobile loading time, FPS or memory','protectedGameBuilds':protected,'videoDelivery':{'status':status,'rangeSupported':status==206,'fallback':'Fetch selected short MP4 as Blob; still frames remain available'},'browserGpuTested':False,'physicalSafariTested':False,'files':checks}
(ROOT/'validation/deployment-http.json').write_text(json.dumps(report,indent=2)+'\n');print({k:v for k,v in report.items()if k!='files'})
