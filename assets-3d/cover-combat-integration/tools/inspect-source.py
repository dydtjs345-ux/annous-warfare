"""Read actual local inventories and prepare existing project rifle references."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1];report={'factions':{}}
for faction,weaponName in [('USMC','M16A4'),('Russian','AK74M')]:
 path=ROOT.parent/'tactical-combat/source'/f'{faction}_Tactical.blend';bpy.ops.wm.open_mainfile(filepath=str(path));rig=bpy.data.objects['InfantryRig'];weapon=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine']
 for o in list(bpy.data.objects):
  if o.animation_data:
   o.animation_data.action=None
   for tr in o.animation_data.nla_tracks:tr.mute=True
 def pose(names,t):
  for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
  for n in names:
   for fc in bpy.data.actions[n].fcurves:
    try:rig.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*30)
    except(ValueError,AttributeError,IndexError):pass
  bpy.context.view_layer.update()
 def point(n):return rig.matrix_world@rig.pose.bones[n].head
 def handframe(side):
  p=point('wrist.'+side);y=(point('finger3-1.'+side)-p).normalized();x=point('finger2-1.'+side)-point('finger5-1.'+side);x=(x-y*x.dot(y)).normalized();z=x.cross(y).normalized();M=Matrix((y.cross(z),y,z)).transposed().to_4x4();M.translation=p;return M
 pose(['Lower_AimStance','FB_AimIdle_Upper'],0);W=weapon.matrix_world.copy();hands={}
 for side in ['L','R']:
  H=handframe(side);data={'wrist':list(W.inverted()@point('wrist.'+side)),'handFrame':list((W.inverted()@H).to_quaternion()),'fingerDirections':{}}
  for d in range(1,6):
   for ph in range(1,4):
    n=f'finger{d}-{ph}.{side}';end=point(f'finger{d}-{ph+1}.{side}')if ph<3 else rig.matrix_world@rig.pose.bones[n].tail;data['fingerDirections'][f'{d}-{ph}']=list(W.inverted().to_3x3()@(end-point(n)).normalized())
  hands[side]=data
 recoil=[]
 for i in range(13):
  t=i/60;pose(['Lower_AimStance','FB_AimIdle_Upper'],0)
  for fc in bpy.data.actions['FB_Recoil_Shot'].fcurves:
   try:rig.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*30)
   except(ValueError,AttributeError,IndexError):pass
  bpy.context.view_layer.update();D=W.inverted()@weapon.matrix_world;recoil.append({'time':t,'translation':list(D.translation),'quaternion':list(D.to_quaternion())})
 pose(['Lower_AimStance','FB_AimIdle_Upper'],0);relative=W.inverted()@mag.matrix_world
 info={'source':str(path),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'joints':len(rig.data.bones),'clips':{a.name:list(a.frame_range)for a in bpy.data.actions},'hands':hands,'aimWeaponMatrix':[list(r)for r in W],'weaponBounds':[[min(v.co[k]for v in weapon.data.vertices),max(v.co[k]for v in weapon.data.vertices)]for k in range(3)],'recoil':recoil,'headRest':list(point('head')),'aimEyeEstimateProjectWorld':list(point('head')+Vector((-.03,-.10,.09)))}
 print('RIFLE',weaponName,info['weaponBounds'],'HANDS',hands['R']['wrist'],hands['L']['wrist'],'aimQ',list(W.to_quaternion()),'head',info['headRest'],flush=True)
 weapon.parent=None;weapon.matrix_world=Matrix.Identity(4);weapon.animation_data_clear();mag.parent=weapon;mag.matrix_parent_inverse=Matrix.Identity(4);mag.matrix_basis=relative;mag.animation_data_clear()
 bpy.data.libraries.write(str(ROOT/'source'/f'{weaponName}_AimReference.blend'),{weapon,mag},fake_user=True)
 report['factions'][weaponName]=info
(ROOT/'validation/project-rifle-source.json').write_text(json.dumps(report,indent=2)+'\n')
