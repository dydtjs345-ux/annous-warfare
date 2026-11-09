import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import * as T from '../../../animation-preview-pages/node_modules/three/build/three.module.js';import {GLTFLoader} from '../../../animation-preview-pages/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const root=path.resolve(import.meta.dirname,'..');
function textureless(bytes){const len=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+len));for(const m of j.meshes)for(const p of m.primitives)delete p.material;delete j.materials;delete j.textures;delete j.images;delete j.samplers;let text=Buffer.from(JSON.stringify(j));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);const binOffset=20+len,bin=bytes.subarray(binOffset+8,binOffset+8+bytes.readUInt32LE(binOffset)),out=Buffer.alloc(28+text.length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(text.length,12);out.writeUInt32LE(0x4e4f534a,16);text.copy(out,20);out.writeUInt32LE(bin.length,20+text.length);out.writeUInt32LE(0x004e4942,24+text.length);bin.copy(out,28+text.length);return out.buffer.slice(out.byteOffset,out.byteOffset+out.length);}
const reports=[];
for(const faction of ['USMC','Russian']){
 const base=await fs.readFile(path.join(root,'../infantry-animation/models',`${faction}_Animated.glb`));const gltf=await new GLTFLoader().parseAsync(textureless(base),'');const data=JSON.parse(await fs.readFile(path.join(root,'curves',`${faction}-reload.json`),'utf8'));const meta=JSON.parse(await fs.readFile(path.join(root,'validation',`${faction}-authoring.json`),'utf8'));const mixer=new T.AnimationMixer(gltf.scene),active=[];
 for(const raw of data.clips){const clip=T.AnimationClip.parse(raw),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();active.push(action);}
 const positions={Weapon:'weapon_world',Magazine:'old_world',SpareMagazine:'new_world',wristL:'left_wrist_world',wristR:'right_wrist_world'};const errors=[];
 for(const s of meta.samples){mixer.setTime(s.time);gltf.scene.updateMatrixWorld(true);const diffs={};for(const [node,key]of Object.entries(positions)){const m=s[key],wanted=new T.Vector3(m[0][3],m[2][3],-m[1][3]),actual=gltf.scene.getObjectByName(node).getWorldPosition(new T.Vector3());diffs[node]=actual.distanceTo(wanted);}errors.push({time:s.time,diffs});}
 const maxima={};for(const node of Object.keys(positions))maxima[node]=Math.max(...errors.map(e=>e.diffs[node]));console.log(faction,maxima,errors.sort((a,b)=>b.diffs.wristL-a.diffs.wristL).slice(0,3));

 const seek=t=>{for(const a of active)a.reset().play();mixer.setTime(t);gltf.scene.updateMatrixWorld(true);};
 const worldPoint=(m,p)=>{const M=new T.Matrix4().set(...m.flat()),q=p.clone().applyMatrix4(M);return new T.Vector3(q.x,q.z,-q.y);};
 const contact=new T.Vector3(.023,-.12,-.075),cal=meta.samples.find(s=>s.phase>=.8&&s.phase<1.4);seek(cal.time);
 const wrist=gltf.scene.getObjectByName('wristL'),old=gltf.scene.getObjectByName('Magazine'),spare=gltf.scene.getObjectByName('SpareMagazine');
 const palmLocal=worldPoint(cal.old_world,contact).applyMatrix4(wrist.matrixWorld.clone().invert()),oldLocal=worldPoint(cal.old_world,contact).applyMatrix4(old.matrixWorld.clone().invert());
 const fresh=meta.samples.find(s=>s.phase>=1.95&&s.phase<2.2);seek(fresh.time);const newLocal=worldPoint(fresh.new_world,contact).applyMatrix4(spare.matrixWorld.clone().invert());
 let continuousContactError=0;
 for(const [start,end,node,local]of [[.8,1.42,old,oldLocal],[1.95,2.79,spare,newLocal]])for(let phase=start;phase<end;phase+=1/120){seek(phase*meta.duration/3.7);const palm=palmLocal.clone().applyMatrix4(wrist.matrixWorld),grip=local.clone().applyMatrix4(node.matrixWorld);continuousContactError=Math.max(continuousContactError,palm.distanceTo(grip));}
 assert(continuousContactError<.005,'Inter-keyframe palm contact drift exceeds 5mm');

 reports.push({faction,max_continuous_palm_contact_error_m:continuousContactError,max_error_m:maxima,source_clip_count:gltf.animations.length,all_original_clips_loaded:gltf.animations.length===21,errors});
}
await fs.writeFile(path.join(root,'validation','runtime-retarget.json'),JSON.stringify(reports,null,2)+'\n');
assert(reports.every(r=>Object.values(r.max_error_m).every(e=>e<.002)),'Retarget error exceeds 2mm');

export {textureless};
