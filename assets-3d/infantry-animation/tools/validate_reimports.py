"""Isolated GLB/FBX playback compared with actual source bone/weapon motion."""
import bpy,sys,os,json,tempfile,shutil,hashlib,math,numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from animation_io import pose
NAMES=['root','lowerleg01.L','lowerleg01.R','foot.L','foot.R','wrist.L','wrist.R','head']
def capture(rig):
 bpy.context.view_layer.update();d={n:list(rig.matrix_world@rig.pose.bones[n].head)for n in NAMES};d['Weapon']=list(bpy.data.objects['Weapon'].matrix_world.translation)
 char=next(o for o in bpy.context.scene.objects if o.type=='MESH'and 'Character'in o.name);ev=char.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh();xyz=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',xyz);xyz=xyz.reshape((-1,3));M=np.array(char.matrix_world);xyz=xyz@M[:3,:3].T+M[:3,3];d['surface_bounds_min']=xyz.min(axis=0).tolist();d['surface_bounds_max']=xyz.max(axis=0).tolist();ev.to_mesh_clear();return d
reports=[]
for faction in ['USMC','Russian']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'source'/f'{faction}_Animation.blend'));r=bpy.data.objects['InfantryRig'];expected_nla={}
 for frame in [0,15,30,72,144,216]:bpy.context.scene.frame_set(frame);expected_nla[frame]=capture(r)
 expected=[]
 for lower,upper,time,recoil,rt in [('Lower_Walk','Upper_LowReady',.2,None,0),('Lower_Sprint','Upper_Sprint',.3,None,0),('Lower_AimWalk','Upper_Aim',.4,None,0),('Lower_AimWalk','Upper_Aim',.4,'Recoil_Shot',1/30)]:
  pose(r,lower,upper,time,recoil,rt);expected.append({'lower':lower,'upper':upper,'time':time,'recoil':recoil,'rt':rt,'positions':capture(r)})
 bones=set(r.data.bones.keys());parents={b.name:b.parent.name if b.parent else None for b in r.data.bones}
 for suffix in ['glb','fbx']:
  filename=f'{faction}_Animated.glb'if suffix=='glb'else f'{faction}_MovingFire.fbx'
  with tempfile.TemporaryDirectory(prefix='aw-anim-reimport-')as tmp:
   path=Path(tmp)/filename;shutil.copy2(ROOT/'models'/filename,path);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=30
   if suffix=='glb':bpy.ops.import_scene.gltf(filepath=str(path))
   else:bpy.ops.import_scene.fbx(filepath=str(path),use_image_search=False,anim_offset=0)
   rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];assert len(rigs)==1;rig=rigs[0];assert set(rig.data.bones.keys())==bones
   assert {b.name:b.parent.name if b.parent else None for b in rig.data.bones}==parents
   displays={p.custom_shape for p in rig.pose.bones if p.custom_shape};meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'and o not in displays];assert len(meshes)==4,(filename,len(meshes))
   assert any('Character'in o.name and any(m.type=='ARMATURE'for m in o.modifiers)for o in meshes)
   assert not any(m.type=='ARMATURE'for m in bpy.data.objects['Weapon'].modifiers)
   images=[im for im in bpy.data.images if im.type=='IMAGE'and im.size[0]>0];assert len(images)>=6
   diffs=[];clips=[]
   if suffix=='glb':
    tracks={t.name:t for t in rig.animation_data.nla_tracks};assert len(tracks)==21
    for name,t in tracks.items():t.strips[0].action.name=name;clips.append({'name':name,'duration_seconds':float(t.strips[0].action.frame_range[1]-t.strips[0].action.frame_range[0])/30})
    for sample in expected:
     pose(rig,sample['lower'],sample['upper'],sample['time'],sample['recoil'],sample['rt']);actual=capture(rig);diff=max((Vector(actual[n])-Vector(p)).length for n,p in sample['positions'].items());diffs.append(diff);print('GLB_PLAYBACK_ERROR',filename,sample['lower'],sample['recoil'],diff,flush=True)
     assert diff<.001,(filename,'source/import motion mismatch',diff)
   else:
    action=rig.animation_data.action;assert action;start,end=action.frame_range;duration=(end-start)/30;assert abs(duration-7.2)<.04,(filename,duration)
    for frame,reference in expected_nla.items():
     bpy.context.scene.frame_set(int(start+frame),subframe=(start+frame)%1);actual=capture(rig);diff=max((Vector(actual[n])-Vector(p)).length for n,p in reference.items());diffs.append(diff);print('FBX_PLAYBACK_ERROR',filename,frame,diff,flush=True);assert diff<.002,(filename,'source/import motion mismatch',frame,diff)
    clips=[{'name':action.name,'duration_seconds':duration}]
   reports.append({'file':filename,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bones':len(rig.data.bones),'meshes':len(meshes),'decoded_images':len(images),'clips':clips,'max_source_joint_and_weapon_position_error_m':max(diffs),'passed':True});print('ANIMATION_REIMPORT_PASS',filename,flush=True)
(ROOT/'validation/reimport-validation.json').write_text(json.dumps({'blender':bpy.app.version_string,'isolated_imports':reports},indent=2)+'\n');print('ALL_FOUR_ANIMATED_REIMPORTS_PASS',flush=True)
