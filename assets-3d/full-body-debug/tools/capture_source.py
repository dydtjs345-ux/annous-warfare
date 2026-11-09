"""Capture evaluated source Actions/NLA, not merely the presence of F-curves."""
import bpy,sys,json,os,gzip,math,re
from pathlib import Path
from mathutils import Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT.parent/'infantry-animation';RELOAD=ROOT.parent/'tactical-reload';sys.path.insert(0,str(BASE/'tools'));from animation_io import pose,apply_action
NAMES=['root','pelvis.L','pelvis.R','spine05','spine04','spine03','spine02','spine01','clavicle.L','clavicle.R','shoulder01.L','shoulder01.R','neck01','head']
STATES={'Walk':('Lower_Walk','Upper_LowReady',2.4),'Sprint':('Lower_Sprint','Upper_Sprint',2.4),'AimWalk':('Lower_AimWalk','Upper_Aim',2.4),'MovingFire':('Lower_AimWalk','Upper_Aim',2.4),'Reload':('Reload_Tactical_Lower','Reload_Tactical',None)}
variant=os.environ.get('AW_VARIANT','before');out=[]
for faction in ['USMC','Russian']:
 source=(RELOAD/'source'/f'{faction}_TacticalReload.blend')if variant=='before'else(ROOT/'source'/f'{faction}_FullBody.blend');bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects['InfantryRig'];char=bpy.data.objects[faction+'_Character'];meta=json.loads((BASE/'validation'/f'{faction}-authoring.json').read_text())['actions'];records=[];regions={}
 for region,test in {'lower_torso':lambda p:abs(p.x)<.17 and 1.06<p.z<1.19 and p.y<.12,'chest':lambda p:abs(p.x)<.17 and 1.26<p.z<1.43 and p.y<.12,'shoulder_L':lambda p:.14<p.x<.28 and 1.35<p.z<1.50,'shoulder_R':lambda p:-.28<p.x<-.14 and 1.35<p.z<1.50}.items():
  ids=[v.index for v in char.data.vertices if test(v.co)];chosen=[ids[round(k*(len(ids)-1)/15)]for k in range(16)];weights={}
  for index in ids:
   for g in char.data.vertices[index].groups:weights[char.vertex_groups[g.group].name]=weights.get(char.vertex_groups[g.group].name,0)+g.weight/len(ids)
  regions[region]={'indices':chosen,'rest':[list(char.data.vertices[k].co)for k in chosen],'mean_weights':weights}
 if variant=='after':meta.update(json.loads((ROOT/'diagnostics'/f'{faction}-authored.json').read_text())['actions'])
 for state,(lo,up,D)in STATES.items():
  if variant=='after':
   lo,up={'Walk':('FB_Walk_Lower','FB_Walk_Upper'),'Sprint':('FB_Sprint_Lower','FB_Sprint_Upper'),'AimWalk':('FB_AimWalk_Lower','FB_AimWalk_Upper'),'MovingFire':('FB_AimWalk_Lower','FB_AimWalk_Upper'),'Reload':('FB_Reload_Lower','FB_Reload_Upper')}[state]
  if D is None:D=3.7 if faction=='USMC'else 4.1
  lowerD=(bpy.data.actions[lo].frame_range[1]-bpy.data.actions[lo].frame_range[0])/30;upperD=(bpy.data.actions[up].frame_range[1]-bpy.data.actions[up].frame_range[0])/30
  bones={n:{'parent':rig.data.bones[n].parent.name if rig.data.bones[n].parent else None,'lower_tracks':[f.data_path for f in bpy.data.actions[lo].fcurves if f'"{n}"'in f.data_path],'upper_tracks':[f.data_path for f in bpy.data.actions[up].fcurves if f'"{n}"'in f.data_path]}for n in NAMES};samples=[];fired=[];nextShot=0
  for i in range(round(D*60)+1):
   t=i/60;pose(rig,None,None,0);apply_action(rig,bpy.data.actions[lo],min(t,lowerD)if state=='Reload'else t%lowerD);apply_action(rig,bpy.data.actions[up],min(t,upperD)if state=='Reload'else t%upperD)
   if state=='MovingFire':
    reference='Upper_Aim'if variant=='before'else'FB_AimIdle_Upper';shot='Recoil_Shot'if variant=='before'else'FB_Recoil_Shot'
    if i>0 and t+1e-9>=nextShot:fired.append(t-1/60);nextShot=t+.14
    for fired_at in fired[-2:]:
     age=t-fired_at
     if not 0<=age<.2:continue
     current={b.name:(b.location.copy(),b.rotation_quaternion.copy())for b in rig.pose.bones};apply_action(rig,bpy.data.actions[reference],0);ref={b.name:(b.location.copy(),b.rotation_quaternion.copy())for b in rig.pose.bones};apply_action(rig,bpy.data.actions[shot],age)
     for b in rig.pose.bones:
      p,q=current[b.name];p0,q0=ref[b.name];b.location=p+(b.location-p0);b.rotation_quaternion=q@q0.inverted()@b.rotation_quaternion
   bpy.context.view_layer.update();row={}
   for n in NAMES:
    b=rig.pose.bones[n];m=rig.matrix_world@b.matrix;local=b.matrix_basis;row[n]={'p':list(m.translation),'q':list(m.to_quaternion()),'lp':list(local.translation),'lq':list(local.to_quaternion())}
   ev=char.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();skin={name:[list(char.matrix_world@mesh.vertices[k].co)for k in item['indices']]for name,item in regions.items()};ev.to_mesh_clear()
   samples.append({'time':t,'bones':row,'skin':skin})
  # Confirm authored layer masks also survive actual NLA evaluation at a non-boundary sample.
  test=.37;pose(rig,None,None,0);apply_action(rig,bpy.data.actions[lo],test%lowerD);apply_action(rig,bpy.data.actions[up],test%upperD);bpy.context.view_layer.update();expected={n:rig.pose.bones[n].matrix.copy()for n in NAMES}
  for tr in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(tr)
  for name,D0 in [(lo,lowerD),(up,upperD)]:
   tr=rig.animation_data.nla_tracks.new();tr.name='Diagnostic_'+name;strip=tr.strips.new(name,0,bpy.data.actions[name]);strip.action_frame_start=0;strip.action_frame_end=D0*30;strip.repeat=math.ceil(D/D0)+1;strip.blend_type='REPLACE';strip.extrapolation='NOTHING'
  bpy.context.scene.frame_set(int(test*30),subframe=test*30-int(test*30));bpy.context.view_layer.update();error=max(abs(rig.pose.bones[n].matrix[a][b]-expected[n][a][b])for n in NAMES for a in range(4)for b in range(4))
  assert error<.0001,(faction,state,'NLA mismatch',error)
  records.append({'state':state,'lower':lo,'upper':up,'duration':D,'lower_duration':lowerD,'upper_duration':upperD,'nla_max_matrix_error':error,'tracks':bones,'samples':samples})
 out.append({'faction':faction,'variant':variant,'bones':len(rig.data.bones),'skin_regions':regions,'states':records})
 print('SOURCE_CAPTURE',variant,faction,flush=True)
with gzip.open(ROOT/'diagnostics'/f'{variant}-source.json.gz','wt')as f:json.dump(out,f,separators=(',',':'))
