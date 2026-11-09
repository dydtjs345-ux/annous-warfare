import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];report=[]
for faction in ['USMC','Russian']:
 for variant,path in [('original',ROOT.parent/'infantry-animation/source'/f'{faction}_Animation.blend'),('previous_reload',ROOT.parent/'tactical-reload/source'/f'{faction}_TacticalReload.blend'),('corrected',ROOT/'source'/f'{faction}_FullBody.blend')]:
  bpy.ops.wm.open_mainfile(filepath=str(path));rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];geometry=hashlib.sha256();weights=hashlib.sha256()
  for v in char.data.vertices:
   geometry.update(json.dumps(list(v.co)).encode());weights.update(json.dumps([(char.vertex_groups[g.group].name,g.weight)for g in v.groups]).encode())
  rest=hashlib.sha256(json.dumps({b.name:{'parent':b.parent.name if b.parent else None,'rest':[list(row)for row in b.matrix_local]}for b in rig.data.bones},sort_keys=True).encode()).hexdigest();tracks=[]
  for tr in rig.animation_data.nla_tracks:tracks.append({'name':tr.name,'mute':tr.mute,'strips':[{'action':st.action.name,'blend_type':st.blend_type,'scale':st.scale,'repeat':st.repeat,'influence':st.influence,'frame_start':st.frame_start,'frame_end':st.frame_end}for st in tr.strips]})
  report.append({'faction':faction,'variant':variant,'source':str(path.relative_to(ROOT.parent.parent)),'bone_count':len(rig.data.bones),'rest_hierarchy_hash':rest,'character_vertex_hash':geometry.hexdigest(),'character_weight_hash':weights.hexdigest(),'nla_tracks':tracks,'weapon_parent_bone':bpy.data.objects['Weapon'].parent_bone})
 for field in ['rest_hierarchy_hash','character_vertex_hash','character_weight_hash']:
  vals={x[field]for x in report if x['faction']==faction};assert len(vals)==1,(faction,'Source preservation failed',field)
(ROOT/'diagnostics/source-inventory.json').write_text(json.dumps(report,indent=2)+'\n');print('ALL_SKELETON_GEOMETRY_WEIGHTS_PRESERVED',flush=True)
