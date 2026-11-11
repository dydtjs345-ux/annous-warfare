// CPU-only Three.js playback of the actual exported tracks. This is not a
// browser/WebGL test. Images and meshes are omitted; joint transforms are intact.
import fs from'node:fs';import assert from'node:assert/strict';import * as T from'three';import{GLTFLoader}from'three/examples/jsm/loaders/GLTFLoader.js';
const root='assets-3d/open-asset-evaluation',report={engine:'Three.js 0.170 AnimationMixer in Node; no browser or GPU',factions:[]},data=JSON.parse(fs.readFileSync(root+'/validation/retarget.json'));
function skeletonBytes(path){const b=fs.readFileSync(path),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n));j.nodes.forEach(o=>{delete o.mesh;});for(const key of['meshes','materials','textures','images','animations'])delete j[key];let text=Buffer.from(JSON.stringify(j));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);const binary=b.subarray(20+n+8),h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+text.length+binary.length,8);h.writeUInt32LE(text.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,text,bh,binary]);}
async function load(b){return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
for(const f of['USMC','Russian']){
 const base=await load(skeletonBytes(`assets-3d/tactical-combat/models/${f}_Tactical.glb`)),patch=await load(fs.readFileSync(`${root}/models/${f}_QuaterniusSamples.animation.glb`)),mixer=new T.AnimationMixer(base.scene),item={faction:f,clips:[]};
 for(const action of['walk','sprint']){const expected=data.factions[f].clips[action],clip=patch.animations.find(a=>a.name===expected.name),playing=mixer.clipAction(clip).setLoop(T.LoopOnce,1);playing.clampWhenFinished=true;playing.play();let positionError=0,angleError=0;assert.equal(playing.timeScale,1);assert.equal(playing.getEffectiveWeight(),1);
  for(const sample of expected.samples){playing.time=sample.time;mixer.update(0);base.scene.updateMatrixWorld(true);for(const[n,s]of Object.entries(sample.bones)){const o=base.scene.getObjectByName(T.PropertyBinding.sanitizeNodeName(n));assert.ok(o,n);positionError=Math.max(positionError,o.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3().fromArray(s.p)));angleError=Math.max(angleError,o.getWorldQuaternion(new T.Quaternion()).normalize().angleTo(new T.Quaternion().fromArray(s.q).normalize()));}}
  assert.ok(positionError<.00005,positionError);assert.ok(angleError<.001,angleError);item.clips.push({action,duration:clip.duration,fullBodyTracks:clip.tracks.length,timeScale:playing.timeScale,weight:playing.getEffectiveWeight(),maxPositionErrorM:positionError,maxOrientationErrorDeg:T.MathUtils.radToDeg(angleError),upperBodyOverlay:false});mixer.stopAllAction();
 }
 report.factions.push(item);
}
fs.writeFileSync(root+'/validation/three-mixer.json',JSON.stringify(report,null,2)+'\n');console.log(report);
