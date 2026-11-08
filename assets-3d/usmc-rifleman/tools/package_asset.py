"""Package actual model files only after their saved validation hashes match.
python tools/package_asset.py /workspace/USMC_Rifleman_3D.zip
"""
import sys, hashlib, json, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
validation=json.loads((ROOT/'validation/glb-validation.json').read_text())
for result in validation['files']:
 assert result['khronos']['numErrors']==0 and result['khronos']['numWarnings']==0
 assert digest(ROOT/'models'/result['file'])==result['sha256'], 'Export changed after validation'
reimports=json.loads((ROOT/'validation/reimport-validation.json').read_text())
assert len(reimports['isolated_imports'])==6
for result in reimports['isolated_imports']:
 assert digest(ROOT/'models'/result['file'])==result['sha256'], 'Export changed after its isolated reimport'
def include(p):
 return p.is_file() and not any(s in {'node_modules','__pycache__','.git'} for s in p.parts) and not p.name.endswith(('.blend1','.zip','.pyc')) and p.name!='SHA256SUMS'
files=sorted(p for p in ROOT.rglob('*')if include(p))
(ROOT/'SHA256SUMS').write_text(''.join(f'{digest(p)}  {p.relative_to(ROOT).as_posix()}\n'for p in files))
files.append(ROOT/'SHA256SUMS')
out=Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/USMC_Rifleman_3D.zip')
assert ROOT not in out.parents, 'Keep the delivery archive outside the source asset tree'
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for p in files:z.write(p,Path('USMC_Rifleman_3D')/p.relative_to(ROOT))
with zipfile.ZipFile(out)as z:assert z.testzip()is None
print(json.dumps({'archive':str(out),'files':len(files),'bytes':out.stat().st_size,'sha256':digest(out)},indent=2))
