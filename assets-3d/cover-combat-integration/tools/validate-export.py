"""Inspect actual final base+patch GLB playback, including between-key contacts and obstacles."""
import bpy,json,math,sys,os,numpy as np,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'));from fixtures import boxes
kind=os.environ.get('CV_WEAPON','M16A4');HZ=int(os.environ.get('CV_HZ','120'));bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.render.fps=HZ;bpy.ops.import_scene.gltf(filepath=f'/workspace/cover-{kind}-Combined.glb');objects=list(bpy.data.objects);rig=next(o for o in objects if o.type=='ARMATURE');weapon=bpy.data.objects['Weapon'if kind=='M16A4'else'Weapon_AK74M'];mag=bpy.data.objects['Magazine'if kind=='M16A4'else'Magazine_AK74M'];refs=json.loads((ROOT/'validation/project-rifle-source.json').read_text())['factions'][kind];bake=json.loads((ROOT/'validation'/f'{kind}-bake.json').read_text());exitPath=ROOT/'validation'/f'{kind}-exit-bake.json';bake['clips'].update(json.loads(exitPath.read_text())['clips']if exitPath.exists()else{});land=json.loads((ROOT/'validation/contact-reference.json').read_text());cleanup=json.loads((ROOT/'validation'/f'{kind}-contact-cleanup.json').read_text());tracks={}
for o in objects:
 if o.animation_data:
  o.animation_data.action=None
  for tr in o.animation_data.nla_tracks:
   tr.mute=True
   for st in tr.strips:tracks.setdefault(tr.name,[]).append((o,st.action))
rest={o:o.matrix_basis.copy()for o in objects};meshes=[o for o in objects if o.type=='MESH'and o.vertex_groups];bones={s:next(b for b in rig.pose.bones if s+'Hand_'in b.name)for s in ['Left','Right']};landmarks={}
for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
for side,info in land.items():
 p=Vector(info['restWorldZUp']);best=(1e6,None,None)
 for o in meshes:
  for v in o.data.vertices:
   e=(o.matrix_world@v.co-p).length
   if e<best[0]:best=(e,o,v.index)
 assert best[0]<.0001,(side,best[0]);landmarks[side]=best[1:]
front=min(v.co.y for v in weapon.data.vertices);muzzle=sum((v.co for v in weapon.data.vertices if v.co.y<front+.002),Vector())/sum(v.co.y<front+.002 for v in weapon.data.vertices)
def pose(name,t):
 for o in objects:o.matrix_basis=rest[o]
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 for o,a in [(o,a)for n,ps in tracks.items()if n==name or n.startswith(name+'_')for o,a in ps]:
  for fc in a.fcurves:
   try:o.path_resolve(fc.data_path)[fc.array_index]=fc.evaluate(t*HZ)
   except(ValueError,AttributeError,IndexError):pass
 for b in rig.pose.bones:b.rotation_quaternion.normalize()
 weapon.rotation_quaternion.normalize()
 bpy.context.view_layer.update()
def rayhit(p,d,b):
 lo,hi=0,20
 for k in range(3):
  if abs(d[k])<1e-9:
   if p[k]<b['min'][k]or p[k]>b['max'][k]:return False
  else:
   a=(b['min'][k]-p[k])/d[k];c=(b['max'][k]-p[k])/d[k];lo=max(lo,min(a,c));hi=min(hi,max(a,c))
 return hi>=lo
report={'weapon':kind,'method':'Final merged base and selective motion patch GLB, reimported into Blender and sampled between keys. Actual deformed mesh bounds/vertices checked against parametric obstacles.','sampleHz':HZ,'clips':{},'maxWristErrorM':0,'maxSourcePointMismatchM':0,'minimumBodyZ':100,'obstacleIntersectionSamples':0,'blockedFireSamples':0}
for sourceName,info in bake['clips'].items():
 if os.environ.get('CV_FILTER')and os.environ['CV_FILTER']not in sourceName:continue
 name=sourceName.replace('CV_','CV_'+kind+'_',1);D=cleanup['durations'][name];pairs=[p for n,ps in tracks.items()if n==name or n.startswith(name+'_')for p in ps];assert pairs,name;maxWrist=0;sourceError=0;minZ=100;hits=[];blocked=0;headMax=-100;clearance=100
 for i in range(round(D*HZ)+1):
  t=i/HZ;pose(name,t);dg=bpy.context.evaluated_depsgraph_get();maxWrist=max(maxWrist,max((rig.matrix_world@bones[s].head-weapon.matrix_world@Vector(refs['hands'][label]['wrist'])).length for s,label in [('Left','L'),('Right','R')]))
  for o in [*meshes,weapon,mag]:
   e=o.evaluated_get(dg);corners=[e.matrix_world@Vector(v)for v in e.bound_box];low=np.array([min(v[k]for v in corners)for k in range(3)]);high=np.array([max(v[k]for v in corners)for k in range(3)]);groundLow=float(low[2]);
   if groundLow<-.001:
    mesh=e.to_mesh();coords=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',coords);coords=coords.reshape((-1,3));W=np.array(e.matrix_world);groundLow=float((coords@W[:3,:3].T+W[:3,3])[:,2].min());e.to_mesh_clear()
   minZ=min(minZ,groundLow);overlap=[b for b in boxes(info['style'],info['stance'],info['side'])if np.all(high>np.array(b['min'])+1e-5)and np.all(low<np.array(b['max'])-1e-5)]
   if overlap:
    mesh=e.to_mesh();a=np.empty(len(mesh.vertices)*3,dtype=np.float32);mesh.vertices.foreach_get('co',a);a=a.reshape((-1,3));W=np.array(e.matrix_world);a=a@W[:3,:3].T+W[:3,3];e.to_mesh_clear()
    for b in overlap:
     inside=np.all((a>np.array(b['min'])+1e-5)&(a<np.array(b['max'])-1e-5),axis=1)
     if inside.any():hits.append({'time':t,'mesh':o.name,'box':b['name'],'vertices':int(inside.sum())})
  if i%(HZ//120)==0:
   source=cleanup['frames'][name][min(len(cleanup['frames'][name])-1,round(t*120))]
   for s,(o,vi)in landmarks.items():
    e=o.evaluated_get(dg);m=e.to_mesh();p=e.matrix_world@m.vertices[vi].co;e.to_mesh_clear();sourceError=max(sourceError,(p-Vector((source['feet'][s][0],-source['feet'][s][2],source['feet'][s][1]))).length)
   for s in ['Left','Right']:sourceError=max(sourceError,(rig.matrix_world@bones[s].head-Vector((source['hands'][s][0],-source['hands'][s][2],source['hands'][s][1]))).length)
  p=weapon.matrix_world@muzzle;d=weapon.matrix_world.to_quaternion()@Vector((0,-1,0))
  if info['phase'] in ['aim','fire']and any(rayhit(p,d,b)for b in boxes(info['style'],info['stance'],info['side'])):blocked+=1
 report['clips'][name]={'duration':D,'samples':round(D*HZ)+1,'maxWristErrorM':maxWrist,'maxSourcePointMismatchM':sourceError,'minimumBodyZ':minZ,'obstacleIntersections':hits,'blockedFireOrAimSamples':blocked};report['maxWristErrorM']=max(report['maxWristErrorM'],maxWrist);report['maxSourcePointMismatchM']=max(report['maxSourcePointMismatchM'],sourceError);report['minimumBodyZ']=min(report['minimumBodyZ'],minZ);report['obstacleIntersectionSamples']+=len(hits);report['blockedFireSamples']+=blocked
 print('CHECKED',name,'wrist',maxWrist,'source',sourceError,'floor',minZ,'hits',len(hits),'blocked',blocked,flush=True);(ROOT/'validation'/f'{kind}-export-partial.json').write_text(json.dumps(report,indent=2)+'\n')
assert report['maxWristErrorM']<.004,report['maxWristErrorM'];assert report['maxSourcePointMismatchM']<.0005,report['maxSourcePointMismatchM'];assert report['minimumBodyZ']>-.003,report['minimumBodyZ'];assert not report['obstacleIntersectionSamples'],report['obstacleIntersectionSamples'];assert not report['blockedFireSamples'],report['blockedFireSamples'];(ROOT/'validation'/(f'{kind}-export-'+str(HZ)+'-'+os.environ.get('CV_FILTER','all')+'.json')).write_text(json.dumps(report,indent=2)+'\n');print('FINAL EXPORT VERIFIED',kind,flush=True)
