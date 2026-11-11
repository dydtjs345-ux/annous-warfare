import bpy,sys,json,math
from pathlib import Path
sys.path.insert(0,'/workspace/infantry-source/assets-3d/infantry-animation/tools')
from animation_io import pose
out=Path('/workspace/annous-warfare/assets-3d/crawl-torso/validation')
names=['root','pelvis.L','pelvis.R','spine05','spine04','spine03','spine02','spine01','clavicle.L','clavicle.R','shoulder01.L','shoulder01.R','upperarm01.L','upperarm01.R']
for faction in ['USMC','Russian']:
 bpy.ops.wm.open_mainfile(filepath=f'/workspace/annous-warfare/assets-3d/crawl-rework/source/{faction}_CrawlRework.blend');r=bpy.data.objects['InfantryRig'];ch=bpy.data.objects[faction+'_Character'];samples=[]
 for i in range(73):
  t=i/30;pose(r,'TC_CrawlForward_Lower','TC_CrawlForward_Upper',t);samples.append({'time':t,'bones':{n:{'localQuaternion':list(r.pose.bones[n].rotation_quaternion),'worldQuaternion':list(r.pose.bones[n].matrix.to_quaternion()),'worldPosition':list(r.pose.bones[n].head)}for n in names}})
 metrics={}
 for n in names:
  from mathutils import Quaternion
  local=[Quaternion(s['bones'][n]['localQuaternion']).normalized()for s in samples];world=[Quaternion(s['bones'][n]['worldQuaternion']).normalized()for s in samples]
  metrics[n]={'localAngleRangeDeg':max(math.degrees(2*math.acos(min(1,abs(a.dot(b)))))for a in local for b in local),'worldAngleRangeDeg':max(math.degrees(2*math.acos(min(1,abs(a.dot(b)))))for a in world for b in world),'positionRangeM':[max(s['bones'][n]['worldPosition'][k]for s in samples)-min(s['bones'][n]['worldPosition'][k]for s in samples)for k in range(3)]}
 regions={}
 for region,zlo,zhi in [('pelvis',.80,1.02),('waist',1.02,1.15),('ribcage',1.15,1.38),('shoulders',1.38,1.50)]:
  verts=[v for v in ch.data.vertices if abs(v.co.x)<.25 and zlo<v.co.z<zhi];weights={}
  for v in verts:
   for g in v.groups:weights[ch.vertex_groups[g.group].name]=weights.get(ch.vertex_groups[g.group].name,0)+g.weight
  total=sum(weights.values());regions[region]={'vertices':len(verts),'weightFractions':dict(sorted(((n,v/total)for n,v in weights.items()),key=lambda x:-x[1])[:12])}
 hierarchy={n:{'parent':r.data.bones[n].parent.name if r.data.bones[n].parent else None,'restHead':list(r.data.bones[n].head_local),'restTail':list(r.data.bones[n].tail_local),'deform':r.data.bones[n].use_deform}for n in names}
 x={'faction':faction,'scope':'Prior revised crawl; actual source Actions, hierarchy and dominant torso skin weights. Quaternion components are Blender wxyz.','hierarchy':hierarchy,'metrics':metrics,'skinRegions':regions,'samples':samples};(out/f'{faction}-before-source.json').write_text(json.dumps(x,indent=2)+'\n');print(faction,'METRICS',json.dumps(metrics));print('SKIN',json.dumps(regions))
