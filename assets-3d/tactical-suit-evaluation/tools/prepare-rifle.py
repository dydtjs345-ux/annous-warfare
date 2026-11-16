"""Read the preserved game's approved M16 carry/grips; never edit its assets."""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT.parent/'tactical-combat/source/USMC_Tactical.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));rig=bpy.data.objects['InfantryRig'];weapon=bpy.data.objects['Weapon'];mag=bpy.data.objects['Magazine']
for o in bpy.data.objects:
 if o.animation_data:
  o.animation_data.action=None
  for tr in o.animation_data.nla_tracks:tr.mute=True
def pose(names):
 for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.matrix_basis=Matrix.Identity(4)
 for n in names:
  for fc in bpy.data.actions[n].fcurves:
   try:rig.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(0)
   except (ValueError,AttributeError,IndexError):pass
 bpy.context.view_layer.update()
def point(n):return rig.matrix_world@rig.pose.bones[n].head
def handframe(side):
 p=point('wrist.'+side);y=(point('finger3-1.'+side)-p).normalized();x=point('finger2-1.'+side)-point('finger5-1.'+side);x=(x-y*x.dot(y)).normalized();z=x.cross(y).normalized();x=y.cross(z).normalized();M=Matrix((x,y,z)).transposed().to_4x4();M.translation=p;return M
report={'source':str(SOURCE),'sourceClips':{'walk':['FB_Walk_Lower','FB_Walk_Upper'],'sprint':['SR_Sprint_Lower','SR_Sprint_Upper']},'actions':{}}
for action,names in report['sourceClips'].items():
 pose(names);W=weapon.matrix_world.copy();center=(point('upperarm01.L')+point('upperarm01.R'))/2;refs={}
 for side in ['L','R']:
  hf=handframe(side);data={'wrist':list(W.inverted()@point('wrist.'+side)),'handFrame':list((W.inverted()@hf).to_quaternion()),'fingerDirections':{}}
  for d in range(1,6):
   for ph in range(1,4):
    n=f'finger{d}-{ph}.{side}';b=rig.pose.bones[n];end=point(f'finger{d}-{ph+1}.{side}')if ph<3 else rig.matrix_world@b.tail;direction=(end-point(n)).normalized();data['fingerDirections'][f'{d}-{ph}']=list(W.inverted().to_3x3()@direction)
  refs[side]=data
 report['actions'][action]={'weaponOffsetFromShoulder':list(W.translation-center),'weaponQuaternion':list(W.to_quaternion()),'hands':refs};print(action,report['actions'][action]['weaponOffsetFromShoulder'],flush=True)
pose(report['sourceClips']['walk']);W=weapon.matrix_world.copy();relative=W.inverted()@mag.matrix_world
weapon.parent=None;weapon.matrix_world=Matrix.Identity(4);weapon.animation_data_clear();mag.parent=weapon;mag.matrix_parent_inverse=Matrix.Identity(4);mag.matrix_basis=relative;mag.animation_data_clear()
for o in [weapon,mag]:
 for m in o.data.materials:
  if m and m.use_nodes:
   for n in m.node_tree.nodes:
    if n.type=='TEX_IMAGE'and n.image:
     candidate=Path('/workspace/infantry-source/assets-3d/usmc-rifleman/textures')/Path(n.image.filepath).name
     if candidate.exists():n.image.filepath=str(candidate);n.image.reload()
     n.image.pack()
bpy.data.libraries.write(str(ROOT/'source/M16A4_GripReference.blend'),{weapon,mag},fake_user=True)
(ROOT/'validation/rifle-reference.json').write_text(json.dumps(report,indent=2)+'\n')
