"""Measure evaluated sprint geometry at 240 Hz, including actual boot support points."""
import bpy,sys,math,json,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT.parent/'infantry-animation/tools'))
from animation_io import pose
out=[]
variant=os.environ.get('AW_VARIANT','before')
for faction in ['USMC','Russian']:
 bpy.ops.wm.open_mainfile(filepath=str((ROOT.parent/'full-body-debug/source'/f'{faction}_FullBody.blend')if variant=='before'else(ROOT/'source'/f'{faction}_SprintReview.blend')));r=bpy.data.objects['InfantryRig'];ch=bpy.data.objects[faction+'_Character'];boots={}
 for s in ['L','R']:
  g=ch.vertex_groups['foot.'+s].index;boots[s]=[v.co.copy() for v in ch.data.vertices if v.co.z<.25 and any(x.group==g and x.weight>.99 for x in v.groups)]
 rows=[]
 D=.8 if variant=='before'else 2/3;V=3 if variant=='before'else 3.6
 for i in range(round(D*240)+1):
  t=i/240;pose(r,*(['FB_Sprint_Lower','FB_Sprint_Upper']if variant=='before'else['SR_Sprint_Lower','SR_Sprint_Upper']),t);bones={n:list(r.pose.bones[n].head)for n in ['root','upperleg01.L','lowerleg01.L','foot.L','upperleg01.R','lowerleg01.R','foot.R','spine05','spine01','head']};row={'t':t,'bones':bones,'feet':{}}
  for s in ['L','R']:
   M=r.pose.bones['foot.'+s].matrix@r.data.bones['foot.'+s].matrix_local.inverted();pts=[M@v for v in boots[s]];low=min(p.z for p in pts);p=min(pts,key=lambda p:p.z);hip=r.pose.bones['upperleg01.'+s].head;knee=r.pose.bones['lowerleg01.'+s].head;ankle=r.pose.bones['foot.'+s].head
   row['feet'][s]={'min_z':low,'support':list(p),'index':min(range(len(pts)),key=lambda k:pts[k].z),'knee_flex_deg':180-math.degrees((hip-knee).angle(ankle-knee)),'thigh_forward_deg':math.degrees(math.atan2(-(knee-hip).y,-(knee-hip).z)),'shin_pitch_deg':math.degrees(math.atan2(-(ankle-knee).y,-(ankle-knee).z)),'ankle_relative_deg':math.degrees(math.atan2(M[2][1],M[1][1])-math.atan2((ankle-knee).y,-(ankle-knee).z)+math.atan2((r.data.bones['foot.'+s].head_local-r.data.bones['lowerleg01.'+s].head_local).y,-(r.data.bones['foot.'+s].head_local-r.data.bones['lowerleg01.'+s].head_local).z))}
  rows.append(row)
 contact=lambda x:x<.008
 stats={}
 for s in ['L','R']:
  feet=[x['feet'][s]for x in rows];stance=[(a,b)for a,b in zip(rows,rows[1:])if contact(a['feet'][s]['min_z'])and contact(b['feet'][s]['min_z'])];slip=[math.hypot((b['feet'][s]['support'][0]-a['feet'][s]['support'][0])*240,(b['feet'][s]['support'][1]-a['feet'][s]['support'][1])*240-V)for a,b in stance]
  material=[math.hypot((b['feet'][s]['support'][0]-a['feet'][s]['support'][0])*240,(b['feet'][s]['support'][1]-a['feet'][s]['support'][1])*240-V)for a,b in stance if a['feet'][s]['index']==b['feet'][s]['index']]
  steady=[];drift=0;anchor=None;previous=None
  for A,B in zip(rows,rows[1:]):
   u=(A['t']/D+(0 if s=='L'else .5))%1;duty=.32 if variant=='before'else .36;a=A['feet'][s];b=B['feet'][s];valid=.025<u<duty-.025 and a['index']==b['index']
   if valid:
    steady.append(math.hypot((b['support'][0]-a['support'][0])*240,(b['support'][1]-a['support'][1])*240-V));p=(b['support'][0],b['support'][1]-V*B['t'])
    if anchor is None or previous!=a['index']:anchor=(a['support'][0],a['support'][1]-V*A['t'])
    drift=max(drift,math.hypot(p[0]-anchor[0],p[1]-anchor[1]));previous=a['index']
   else:anchor=None;previous=None
  stats[s]={'ankle_relative_deg':[min(f['ankle_relative_deg']for f in feet),max(f['ankle_relative_deg']for f in feet)],'midstance_material_slip_rms_mps':math.sqrt(sum(v*v for v in steady)/len(steady)), 'max_midstance_material_drift_m':drift,'same_material_contact_slip_rms_mps':math.sqrt(sum(v*v for v in material)/len(material))if material else None,'knee_flex_range_deg':[min(f['knee_flex_deg']for f in feet),max(f['knee_flex_deg']for f in feet)],'thigh_range_deg':[min(f['thigh_forward_deg']for f in feet),max(f['thigh_forward_deg']for f in feet)],'sole_z_range_m':[min(f['min_z']for f in feet),max(f['min_z']for f in feet)],'actual_contact_fraction':sum(contact(f['min_z'])for f in feet)/len(feet),'support_point_jump_including_vertex_changes_rms_mps':math.sqrt(sum(v*v for v in slip)/len(slip))if slip else None}
 stats['both_feet_off_fraction']=sum(not contact(x['feet']['L']['min_z'])and not contact(x['feet']['R']['min_z'])for x in rows)/len(rows);stats['root_z_range_m']=[min(x['bones']['root'][2]for x in rows),max(x['bones']['root'][2]for x in rows)];out.append({'faction':faction,'duration':D,'speed_mps':V,'steps_per_minute':120/D,'stride_m':V*D,'stats':stats,'samples':rows})
 print(variant.upper(),faction,json.dumps(stats),flush=True)
(ROOT/'diagnostics'/f'{variant}-source.json').write_text(json.dumps(out,separators=(',',':')))
