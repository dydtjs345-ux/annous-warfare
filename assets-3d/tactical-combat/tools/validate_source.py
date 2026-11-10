import bpy,sys,os,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];CACHE=Path(os.environ.get('AW_SOURCE_CACHE',str(ROOT.parents[1]/'.cache/tactical-source/assets-3d')));sys.path.insert(0,str(CACHE/'infantry-animation/tools'));from animation_io import pose
faction=os.environ.get('AW_FACTION','USMC');report=json.loads((ROOT/'validation'/f'{faction}-authored.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{faction}_Tactical.blend'));r=bpy.data.objects['InfantryRig'];ch=bpy.data.objects[faction+'_Character'];w=bpy.data.objects['Weapon']
pose(r,'Lower_AimStance','FB_AimIdle_Upper',0);reference={side:w.matrix_world.inverted()@r.pose.bones['wrist.'+side].matrix for side in ['L','R']};grips=[];coverRays=[];coverIntersections=[]
carry={}
for kind,pair in {'stand':('Lower_Idle','FB_LowReady_Upper'),'walk':('FB_Walk_Lower','FB_Walk_Upper'),'sprint':('SR_Sprint_Lower','SR_Sprint_Upper')}.items():
 pose(r,*pair,0);carry[kind]=w.matrix_world.inverted()@r.pose.bones['wrist.L'].matrix
def smooth(x):
 x=max(0,min(1,x));return x*x*x*(10+x*(-15+6*x))
def left_reference(name,u):
 aim=reference['L'];stand=carry['stand']
 if name in ['StandProne','WalkProne','SprintProne']:return carry[{'StandProne':'stand','WalkProne':'walk','SprintProne':'sprint'}[name]].lerp(aim,smooth(u/.34))
 if name=='StandCrouch':return stand.lerp(aim,smooth(u))
 if name=='CrouchStand':return aim.lerp(stand,smooth(u))
 if name=='ProneStand':return aim.lerp(stand,smooth((u-.68)/.32))
 if name=='CoverEnter':return carry['walk'].lerp(aim,smooth(u))
 if name=='CoverExit':return aim.lerp(stand,smooth(u))
 return aim
names=[k[3:-6]for k in report['actions']if k.endswith('_Lower')];results=[]
for name in names:
 lo='TC_'+name+'_Lower';up='TC_'+name+'_Upper';D=report['actions'][lo]['duration'];frames=[]
 for i in range(0,round(D*30)+1,3):
  time=i/30;pose(r,lo,up,time);ev=ch.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();low=min(v.co.z for v in mesh.vertices);ev.to_mesh_clear()
  u=time/D;weaponMin=min((w.matrix_world@v.co).z for v in w.data.vertices)
  right=(r.pose.bones['wrist.R'].head-(w.matrix_world@reference['R']).translation).length;left=(r.pose.bones['wrist.L'].head-(w.matrix_world@left_reference(name,u)).translation).length;leftPlanted=name in ['ProneCrouch','ProneStand']and .05<u<.34;grips.append({'clip':name,'time':time,'rightErrorM':right,'leftErrorM':left,'leftPlannedRelease':leftPlanted,'weaponMinZ':weaponMin})
  if name.startswith('Cover'):
   x0,x1=(-1.58,.12)if 'Left'in name else(-.12,1.58)if 'Right'in name else(-1.2,1.2);inside=[list(point)for point in (w.matrix_world@v.co for v in w.data.vertices)if x0<point.x<x1 and -1.52<point.y<-1.3 and .01<point.z<1.3]
   if inside:coverIntersections.append({'clip':name,'time':time,'vertices':len(inside)})
  if name in ['CoverAimLeft','CoverAimRight','CoverFireLeft','CoverFireRight','CoverAboveAim','CoverAboveFire']:
   tip=min((w.matrix_world@v.co for v in w.data.vertices),key=lambda v:v.y);direction=(w.matrix_world.to_3x3()@Vector((0,-1,0))).normalized();hit=tip+direction*((-1.3-tip.y)/direction.y);clearance=hit.x-.12 if 'Left'in name else -.12-hit.x if 'Right'in name else hit.z-1.3;coverRays.append({'clip':name,'time':time,'atCoverFace':list(hit),'clearanceM':clearance})
  frames.append({'time':time,'meshMinZ':low,'kneesZ':[r.pose.bones['lowerleg01.'+s].head.z for s in ['L','R']],'elbowsZ':[r.pose.bones['lowerarm01.'+s].head.z for s in ['L','R']]})
 results.append({'name':name,'minMeshZ':min(x['meshMinZ']for x in frames),'frames':frames})
# Reimport the delivered file into a new scene and count its actual rig/actions.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/f'{faction}_Tactical.glb'));rigs=[o for o in bpy.data.objects if o.type=='ARMATURE'];reimport={'armatures':len(rigs),'bones':[len(o.data.bones)for o in rigs],'actions':len(bpy.data.actions),'meshes':len([o for o in bpy.data.objects if o.type=='MESH'])}
assert reimport['armatures']==1 and reimport['bones']==[163],reimport
out={'faction':faction,'reimport':reimport,'ground':results,'groundFailures':[x['name']for x in results if x['minMeshZ']<-.008],'grips':grips,'coverRays':coverRays,'coverWeaponIntersections':coverIntersections,'minimumCornerOrTopAimClearanceM':min(x['clearanceM']for x in coverRays),'maxRightGripErrorM':max(x['rightErrorM']for x in grips),'maxLeftGripErrorMWhenHeld':max(x['leftErrorM']for x in grips if not x['leftPlannedRelease']),'weaponGroundFailures':[x for x in grips if x['weaponMinZ']<-.008]};(ROOT/'validation'/f'{faction}-source-check.json').write_text(json.dumps(out,indent=2)+'\n');assert not out['coverWeaponIntersections'],out['coverWeaponIntersections'];assert out['minimumCornerOrTopAimClearanceM']>.015,out['minimumCornerOrTopAimClearanceM'];assert not out['groundFailures'],out['groundFailures'];assert not out['weaponGroundFailures'],out['weaponGroundFailures'];assert out['maxRightGripErrorM']<.001 and out['maxLeftGripErrorMWhenHeld']<.001,(out['maxRightGripErrorM'],out['maxLeftGripErrorMWhenHeld']);print('SOURCE_CHECK',faction,'groundFailures',out['groundFailures'],'reimport',reimport,flush=True)
