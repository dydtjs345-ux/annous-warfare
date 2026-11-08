"""Sample authored motion before extending the clip set; no source assets changed."""
import bpy,sys,json,math,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from animation_io import pose
faction=os.environ.get('AW_FACTION','Russian');rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];weapon=bpy.data.objects['Weapon']
rest=[v.co.copy()for v in char.data.vertices];edges=[tuple(e.vertices)for e in char.data.edges];base=[(rest[a]-rest[b]).length for a,b in edges]
def anchor(side):
 w=rig.data.bones['wrist.'+side].head_local;m=[rig.data.bones[f'finger{i}-1.{side}'].head_local for i in range(2,6)]
 return w+(sum(m,Vector())/4-w)*.58
records=[]
for lower,upper,duration in [('Lower_Walk','Upper_LowReady',1.2),('Lower_Sprint','Upper_Sprint',.8),('Lower_AimWalk','Upper_Aim',1.2)]:
 for index in range(8):
  t=duration*index/8;pose(rig,lower,upper,t);dg=bpy.context.evaluated_depsgraph_get();obj=char.evaluated_get(dg);me=obj.to_mesh();ratios=sorted((me.vertices[a].co-me.vertices[b].co).length/l for (a,b),l in zip(edges,base)if l>.001)
  gripR=Vector((-.025,.061,-.028)if faction=='Russian'else(-.029,.048,-.036));palm=rig.pose.bones['wrist.R'].matrix@rig.data.bones['wrist.R'].matrix_local.inverted()@anchor('R');error=(palm-weapon.matrix_world@gripR).length
  record={'lower':lower,'upper':upper,'time':t,'edge_stretch_p99':ratios[int(len(ratios)*.99)],'max_edge_stretch':max(ratios),'right_palm_weapon_error_m':error,'minimum_vertex_z':min(v.co.z for v in me.vertices)}
  print('GATE',record,flush=True);records.append(record);obj.to_mesh_clear()
  assert error<.001,('Weapon is not seated in right palm',record)
  assert record['edge_stretch_p99']<1.85,('Broad deformation failure',record)
  assert record['minimum_vertex_z']>-.006,('Ground penetration',record)
report={'faction':faction,'blender':bpy.app.version_string,'samples':records,'max_right_palm_error_m':max(r['right_palm_weapon_error_m']for r in records),'max_p99_stretch':max(r['edge_stretch_p99']for r in records),'limitations':['Edge stretch detects broad failures; narrow cloth folds can open strongly. It is not a full collision or muscle-volume test.','Contact and deformation review covers authored Phase 1 ranges, not every possible retargeted pose.']}
(ROOT/'validation'/f'{faction}-deformation-gate.json').write_text(json.dumps(report,indent=2)+'\n')
print('DEFORMATION_GATE_PASS',faction,flush=True)
