"""Fresh-scene import of copied GLB/FBX exports, isolated from source textures.
blender -b --factory-startup -t 4 --python tools/validate_reimports.py
"""
import bpy, json, shutil, tempfile, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
results=[]
for suffix in ['glb','fbx']:
 for stem in ['USMC_Rifleman_Kit','USMC_Rifleman_Apose','M16A4']:
  with tempfile.TemporaryDirectory(prefix='aw-model-import-') as tmp:
   bpy.ops.wm.read_factory_settings(use_empty=True)
   path=Path(tmp)/(stem+'.'+suffix);shutil.copy2(ROOT/'models'/path.name,path)
   if suffix=='glb':bpy.ops.import_scene.gltf(filepath=str(path))
   else:bpy.ops.import_scene.fbx(filepath=str(path),use_image_search=False)
   rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
   # The glTF importer creates its own 42-vertex Icosphere bone display. It is
   # referenced only as a custom bone shape and is not geometry in the GLB.
   bone_displays={b.custom_shape for r in rigs for b in r.pose.bones if b.custom_shape}
   meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in bone_displays]
   assert len(meshes)==(2 if stem.endswith('Kit') else 1), (path.name,'mesh count')
   if stem!='M16A4':
    assert len(rigs)==1 and len(rigs[0].data.bones)>=60, (path.name,'deformation bones')
    char=next(o for o in meshes if 'Character' in o.name)
    assert 1.75<char.dimensions.z<1.9, (path.name,'character metre scale',list(char.dimensions))
    assert char.vertex_groups and any(m.type=='ARMATURE' for m in char.modifiers)
   else:assert not rigs
   images=[i for i in bpy.data.images if i.type=='IMAGE' and i.size[0]>0]
   assert len(images)>=(6 if stem.endswith('Kit') else 3), (path.name,'embedded texture decode',len(images))
   for ob in meshes:
    assert ob.data.uv_layers and ob.data.materials and len(ob.data.vertices)>1000
    ob.data.calc_loop_triangles()
   result={'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mesh_count':len(meshes),'armatures':len(rigs),'importer_bone_display_helpers':len(bone_displays),'decoded_images':[{'name':i.name,'dimensions':list(i.size)}for i in images],
    'meshes':[{'name':o.name,'vertices':len(o.data.vertices),'triangles':len(o.data.loop_triangles),'dimensions_metres':list(o.dimensions),'skinned':any(m.type=='ARMATURE'for m in o.modifiers)}for o in meshes]}
   results.append(result);print('REIMPORT_PASS',path.name,flush=True)
(ROOT/'validation').mkdir(exist_ok=True)
(ROOT/'validation/reimport-validation.json').write_text(json.dumps({'blender':bpy.app.version_string,'isolated_imports':results},indent=2)+'\n')
print('ALL_SIX_REIMPORTS_PASSED',flush=True)
