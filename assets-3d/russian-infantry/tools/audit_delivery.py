"""Verify reference preservation, deliverable presence and repository binary limits."""
import subprocess,json,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1];BASE='e4a100891fb353ad0afaa72e3b08f6b3713acd05'
def git(*args):return subprocess.check_output(['git',*args],cwd=REPO).decode().strip()
assert git('branch','--show-current')=='feat/russian-infantry-base'
assert git('rev-parse','main')=='b381e6017d01fa34f14e889ff639347db9e5feae'
assert not git('diff','--name-only',BASE,'--','.',':(exclude)assets-3d/russian-infantry')
refs=git('ls-tree','-r',BASE,'--','assets-3d/usmc-rifleman').splitlines();mismatches=[]
for line in refs:
 meta,path=line.split('\t',1);expected=meta.split()[2]
 if git('hash-object',path)!=expected:mismatches.append(path)
assert not mismatches
required=['source/Russian_Infantry.blend','source/Russian_Infantry_Geometry.blend','models/Russian_Infantry_Apose.glb','models/Russian_Infantry_Apose.fbx','models/Russian_Infantry_Kit.glb','models/Russian_Infantry_Kit.fbx','models/AK74M.glb','models/AK74M.fbx','isometric-evaluation/source/Russian_Infantry_LowReady.blend','README.md','TECHNICAL_REPORT.md','validation/glb-validation.json','validation/reimport-validation.json','validation/source-validation.json']
for f in ['quarter','AK74M','low-ready-hands','glb-roundtrip']:required.append(f'previews/{f}.png')
for prefix in ['Russian_Infantry','AK74M']:
 for kind in ['BaseColor','Roughness','Metallic','Normal']:required.append(f'textures/{prefix}_{kind}.png')
for h in [40,60,80,120]:required.append(f'isometric-evaluation/sheets/usmc-vs-russian-{h}px.png')
for d in ['N','NE','E','SE','S','SW','W','NW']:
 required.append(f'isometric-evaluation/large/russian-{d}.png')
 for f in ['quarter','AK74M','low-ready-hands','glb-roundtrip']:required.append(f'previews/{f}.png')
for prefix in ['Russian_Infantry','AK74M']:
 for kind in ['BaseColor','Roughness','Metallic','Normal']:required.append(f'textures/{prefix}_{kind}.png')
for h in [40,60,80,120]:required.append(f'isometric-evaluation/native/russian-{d}-{h}.png')
official=json.loads((ROOT/'validation/glb-validation.json').read_text())
assert len(official['files'])==3
for r in official['files']:
 assert r['khronos']['numErrors']==0 and r['khronos']['numWarnings']==0
 assert r['sha256']==hashlib.sha256((ROOT/'models'/r['file']).read_bytes()).hexdigest()
imports=json.loads((ROOT/'validation/reimport-validation.json').read_text())['isolated_imports'];assert len(imports)==6
for r in imports:assert r['sha256']==hashlib.sha256((ROOT/'models'/r['file']).read_bytes()).hexdigest()
for size in json.loads((ROOT/'isometric-evaluation/validation/comparison-manifest.json').read_text())['sizes']:
 for row in size['figures']:
  for variant in ['usmc','russian']:
   r=row[variant];assert r['sha256']==hashlib.sha256((ROOT.parent/r['source']).read_bytes()).hexdigest()
missing=[f for f in required if not (ROOT/f).is_file()];assert not missing,missing
files=[p for p in ROOT.rglob('*')if p.is_file()and not any(s in p.parts for s in ['node_modules','__pycache__'])and p.suffix not in ['.blend1','.blend2']]
assert max(p.stat().st_size for p in files)<100*1024*1024
result={'base_commit':BASE,'feature_branch':git('branch','--show-current'),'main_commit_unchanged':git('rev-parse','main'),'existing_usmc_files_verified_against_git_blobs':len(refs),'modified_existing_usmc_files':mismatches,'tracked_changes_outside_new_asset_directory':[],'required_files_present':len(required),'missing':missing,'largest_file':str(max(files,key=lambda p:p.stat().st_size).relative_to(ROOT)),'largest_file_bytes':max(p.stat().st_size for p in files),'delivered_bytes_before_audit_and_checksums':sum(p.stat().st_size for p in files),'per_file_github_100MiB_limit_pass':True}
(ROOT/'validation/preservation-and-delivery.json').write_text(json.dumps(result,indent=2)+'\n')
files=[p for p in ROOT.rglob('*')if p.is_file()and not any(s in p.parts for s in ['node_modules','__pycache__'])and p.suffix not in ['.blend1','.blend2']and p.name!='SHA256SUMS']
(ROOT/'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(ROOT)}\n'for p in sorted(files)))
print(json.dumps(result,indent=2))
