"""Inspect acquired source tracks only; do not redistribute restricted Kevin files."""
import bpy,json,hashlib,re
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1];CACHE=Path('/workspace/animation-recovery-downloads');report={'retrieved':'2026-11-16','assets':[]}
for file in sorted(CACHE.glob('Zen-*.fbx'))+list((CACHE/'kevin/BlenderFiles').glob('HumanM_*.blend')):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 try:
  if file.suffix=='.fbx':bpy.ops.import_scene.fbx(filepath=str(file),use_anim=True)
  else:bpy.ops.wm.open_mainfile(filepath=str(file))
 except RuntimeError as e:
  report['assets'].append({'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size,'imported':False,'error':str(e)});continue
 rigs=[o for o in bpy.data.objects if o.type=='ARMATURE'];item={'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size,'fps':bpy.context.scene.render.fps,'rigs':[],'actions':[]}
 for r in rigs:item['rigs'].append({'name':r.name,'bones':len(r.data.bones),'names':[b.name for b in r.data.bones]})
 for ac in bpy.data.actions:
  keys={fc.data_path for fc in ac.fcurves};body=sorted(k for k in keys if any(x in k.lower()for x in ['pelvis','hips','spine','chest','clav','shoulder']))
  moving=[]
  for fc in ac.fcurves:
   if fc.data_path not in body:continue
   vals=[k.co.y for k in fc.keyframe_points]
   if vals and max(vals)-min(vals)>.0001:moving.append(fc.data_path)
  item['actions'].append({'name':ac.name,'range':list(ac.frame_range),'channels':len(ac.fcurves),'bodyTracks':body,'varyingBodyTracks':sorted(set(moving))})
 report['assets'].append(item);print('INSPECTED',file.name,len(rigs),len(item['actions']),flush=True)
(ROOT/'validation/free-source-inspection.json').write_text(json.dumps(report,indent=2)+'\n')
