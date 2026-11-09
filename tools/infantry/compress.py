from pathlib import Path
from PIL import Image, ImageChops
import json,hashlib
root=Path('public/assets/infantry-test');manifest=json.loads((root/'manifest.json').read_text());findings=[]
for variant,meta in manifest['factions'].items():
    for n,name in enumerate(meta['sheets']):
        p=root/Path(name).with_suffix('.png');im=Image.open(p).convert('RGBA');bad=[]
        for seq in meta['sequences'].values():
            for frame in range(seq['count']):
                i=seq['offset']+frame;w,h=meta['width'],meta['height'];cell=im.crop((i%meta['cols']*w,i//meta['cols']*h,(i%meta['cols']+1)*w,(i//meta['cols']+1)*h));b=cell.getbbox()
                if not b: raise ValueError(f'empty soldier {p}:{i}')
                if b[0]<1 or b[1]<1 or b[2]>w-1 or b[3]>h-1:bad.append((i,b))
        if bad:raise ValueError(f'clipped {p}: {bad[:8]}')
        target=p.with_suffix('.webp');im.save(target,lossless=True,method=6)
        decoded=Image.open(target).convert('RGBA')
        # Lossless WebP may canonicalize RGB underneath fully transparent pixels.
        assert ImageChops.difference(im,decoded).getbbox() is None
        meta['sheets'][n]=target.name
        findings.append({'file':target.name,'bytes':target.stat().st_size,'width':im.width,'height':im.height,'clippedFrames':len(bad),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
report={'passed':True,'transferBytes':sum(x['bytes'] for x in findings),'decodedTextureBytes':sum(x['width']*x['height']*4 for x in findings),'sheets':findings}
Path('reports/infantry-test/assets.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='sheets'}))
