// Offline, source-driven retarget. No gait generation, oscillators, pose overlay,
// IK/contact correction, time warp, or copied third-party repository code.
import fs from 'node:fs';
import * as T from 'three';
import {createHash} from 'node:crypto';
const out='assets-3d/open-asset-evaluation';
const sourcePath='/workspace/open-asset-downloads/ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard_RM.glb';
export function parse(path){const bytes=fs.readFileSync(path);let j,bin;for(let p=12;p<bytes.length;){const n=bytes.readUInt32LE(p),k=bytes.readUInt32LE(p+4);if(k===0x4e4f534a)j=JSON.parse(bytes.subarray(p+8,p+8+n));if(k===0x004e4942)bin=bytes.subarray(p+8,p+8+n);p+=8+n;}return {j,bin,bytes};}
export function write(path,j,bin){let a=Buffer.from(JSON.stringify(j));a=Buffer.concat([a,Buffer.alloc((4-a.length%4)%4,32)]);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+a.length+bin.length,8);h.writeUInt32LE(a.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(path,Buffer.concat([h,a,bh,bin]));}
export function values(g,i){const a=g.j.accessors[i],v=g.j.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5126:4,5123:2,5125:4,5121:1}[a.componentType],r=[];for(let x=0;x<a.count;x++)for(let k=0;k<n;k++){const p=(v.byteOffset||0)+(a.byteOffset||0)+x*(v.byteStride||n*size)+k*size;r.push(a.componentType===5126?g.bin.readFloatLE(p):a.componentType===5123?g.bin.readUInt16LE(p):a.componentType===5125?g.bin.readUInt32LE(p):g.bin.readUInt8(p));}return r;}
export function rig(g){const objects=g.j.nodes.map((n)=>{const o=new T.Object3D();o.name=n.name||'';if(n.matrix)o.applyMatrix4(new T.Matrix4().fromArray(n.matrix));else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});g.j.nodes.forEach((n,i)=>n.children?.forEach(c=>objects[i].add(objects[c])));const scene=new T.Group();g.j.scenes[g.j.scene||0].nodes.forEach(i=>scene.add(objects[i]));scene.updateMatrixWorld(true);const names=Object.fromEntries(objects.map(o=>[o.name,o])),rest=objects.map(o=>({p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),wp:o.getWorldPosition(new T.Vector3()),wq:o.getWorldQuaternion(new T.Quaternion())}));return{scene,objects,names,rest,reset(){objects.forEach((o,i)=>{o.position.copy(rest[i].p);o.quaternion.copy(rest[i].q);o.scale.copy(rest[i].s);});scene.updateMatrixWorld(true);}};}
export function clip(g,r,a){const tracks=a.channels.map(c=>{const s=a.samplers[c.sampler],t=values(g,s.input),v=values(g,s.output),o=r.objects[c.target.node],prop={translation:'position',rotation:'quaternion',scale:'scale'}[c.target.path],f=c.target.path==='rotation'?new T.QuaternionLinearInterpolant(new Float32Array(t),new Float32Array(v),4):new T.LinearInterpolant(new Float32Array(t),new Float32Array(v),3);if(s.interpolation&&s.interpolation!=='LINEAR')throw Error('Unsupported interpolation '+s.interpolation);return{f,o,prop};});return{duration:Math.max(...a.samplers.map(s=>values(g,s.input).at(-1))),at(t){r.reset();for(const {f,o,prop}of tracks)o[prop].fromArray(f.evaluate(t));r.scene.updateMatrixWorld(true);}};}
const wp=o=>o.getWorldPosition(new T.Vector3()),wq=o=>o.getWorldQuaternion(new T.Quaternion());
function frame(y,front){y=y.clone().normalize();const z=front.clone().addScaledVector(y,-front.dot(y)).normalize(),x=new T.Vector3().crossVectors(y,z).normalize();z.crossVectors(x,y);return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
const source=parse(sourcePath),sr=rig(source),sourceHash=createHash('sha256').update(source.bytes).digest('hex');
const map={root:'pelvis',spine05:'spine_01',spine03:'spine_02',spine02:'spine_03',neck01:'neck_01',head:'Head'};
const segment={};
for(const [s,l]of [['L','l'],['R','r']]){
 Object.assign(map,{['clavicle.'+s]:'clavicle_'+l,['upperarm01.'+s]:'upperarm_'+l,['lowerarm01.'+s]:'lowerarm_'+l,['wrist.'+s]:'hand_'+l,['upperleg01.'+s]:'thigh_'+l,['lowerleg01.'+s]:'calf_'+l,['foot.'+s]:'foot_'+l});
 for(const [target,tn,sn]of [['upperarm01','lowerarm01','lowerarm'],['lowerarm01','wrist','hand'],['upperleg01','lowerleg01','calf'],['lowerleg01','foot','foot']])segment[target+'.'+s]=[tn+'.'+s,sn+'_'+l];
}
// Transfer authored toe roll and finger curls as well as the body. No hand pose is invented.
for(const [side,suffix]of [['L','l'],['R','r']]){
 for(let toe=1;toe<=5;toe++)map[`toe${toe}-1.${side}`]=`ball_${suffix}`;
 for(const [digit,name]of [[1,'thumb'],[2,'index'],[3,'middle'],[4,'ring'],[5,'pinky']])for(let joint=1;joint<=3;joint++)map[`finger${digit}-${joint}.${side}`]=`${name}_0${joint}_${suffix}`;
}
const report={method:'Sample original GLB LINEAR/slerp keyframes at native 30 Hz. Semantic joint direction plus source quaternion twist for limbs; bind-space global rotation deltas for pelvis/spine/clavicles/head/hands/feet. Fixed target bone lengths. Source root/pelvis translation scaled by bind pelvis height. No procedural motion or upper-body overlay.',sourcePath,sourceSha256:sourceHash,boneMap:map,segmentMap:segment,factions:{}};
for(const faction of ['USMC','Russian']){
 const target=parse(`assets-3d/tactical-combat/models/${faction}_Tactical.glb`),tr=rig(target),indices=Object.fromEntries(target.j.nodes.map((n,i)=>[n.name,i]));
 const targetRoot=tr.names.root,sourcePelvis=sr.names.pelvis,sourceRest=sr.rest[sr.objects.indexOf(sourcePelvis)],targetRest=tr.rest[indices.root],scale=targetRest.wp.y/sourceRest.wp.y;
 const j={asset:{version:'2.0',generator:'Autonomous Warfare source-driven asset evaluation'},scene:0,scenes:target.j.scenes.map(s=>({nodes:s.nodes.filter(i=>!('mesh'in target.j.nodes[i]))})),nodes:target.j.nodes.map(n=>{const c=structuredClone(n);delete c.mesh;delete c.skin;return c;}),buffers:[{byteLength:0}],bufferViews:[],accessors:[],animations:[],extras:{source:'Quaternius Universal Animation Library 1 Standard',license:'CC0-1.0',sourceSha256:sourceHash,rawRetarget:true,proceduralMotion:false}};
 let parts=[],length=0;const add=(v,type)=>{const b=Buffer.from(new Float32Array(v).buffer),index=j.accessors.length;parts.push(b);j.bufferViews.push({buffer:0,byteOffset:length,byteLength:b.length});length+=b.length;const a={bufferView:j.bufferViews.length-1,componentType:5126,count:v.length/({SCALAR:1,VEC3:3,VEC4:4}[type]),type};if(type==='SCALAR'){a.min=[Math.min(...v)];a.max=[Math.max(...v)];}j.accessors.push(a);return index;};
 report.factions[faction]={scale,clips:{},targetSha256:createHash('sha256').update(target.bytes).digest('hex')};
 for(const [action,name]of [['walk','Walk_Loop'],['sprint','Sprint_Loop']]){
  const sc=clip(source,sr,source.j.animations.find(a=>a.name===name)),times=Array.from({length:Math.round(sc.duration*30)+1},(_,i)=>i/30),qtracks=Object.fromEntries(target.j.skins[0].joints.map(i=>[i,[]])),positions=[],samples=[];
  const restFrames={};sr.reset();tr.reset();for(const [tn,[tc,scn]]of Object.entries(segment)){const so=sr.names[map[tn]],to=tr.names[tn];restFrames[tn]={sourceLocalFront:new T.Vector3(0,0,1).applyQuaternion(wq(so).invert()),targetCorrection:frame(wp(tr.names[tc]).sub(wp(to)),new T.Vector3(0,0,1)).invert().multiply(wq(to))};}
  for(const time of times){
   sc.at(time);tr.reset();
   // Parent-before-child order follows the actual hierarchy, including helpers.
   const ordered=[];tr.scene.traverse(o=>{if(o.name in map)ordered.push(o);});
   for(const to of ordered){const tn=to.name,so=sr.names[map[tn]],sRest=sr.rest[sr.objects.indexOf(so)],tRest=tr.rest[indices[tn]];let desired;
    if(segment[tn]){const scn=segment[tn][1],f=restFrames[tn];desired=frame(wp(sr.names[scn]).sub(wp(so)),f.sourceLocalFront.clone().applyQuaternion(wq(so))).multiply(f.targetCorrection);}else desired=wq(so).multiply(sRest.wq.clone().invert()).multiply(tRest.wq);
    to.quaternion.copy(wq(to.parent).invert().multiply(desired));
    if(tn==='root'){const p=wp(sourcePelvis).multiplyScalar(scale);targetRoot.position.copy(targetRoot.parent.worldToLocal(p));}
    tr.scene.updateMatrixWorld(true);
   }
   for(const key of Object.keys(qtracks)){const o=tr.objects[+key],q=o.quaternion.clone(),arr=qtracks[key];if(arr.length&&new T.Quaternion().fromArray(arr,arr.length-4).dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);arr.push(...q.toArray());}
   positions.push(...targetRoot.position.toArray());
   samples.push({time,bones:Object.fromEntries(Object.keys(map).map(n=>[n,{p:wp(tr.names[n]).toArray(),q:wq(tr.names[n]).toArray(),localQ:tr.names[n].quaternion.toArray()}])),sourceBones:Object.fromEntries(['root','pelvis','spine_01','spine_02','spine_03','clavicle_l','clavicle_r'].map(n=>[n,{p:wp(sr.names[n]).toArray(),q:wq(sr.names[n]).toArray(),localQ:sr.names[n].quaternion.toArray()}]))});
  }
  const anim={name:'OA_Quaternius_'+(action==='walk'?'Walk':'Sprint'),samplers:[],channels:[],extras:{sourceClip:name,sourceSha256:sourceHash,license:'CC0-1.0',nativeDuration:sc.duration,scale,rawRetarget:true}};const ti=add(times,'SCALAR');const track=(node,path,v,type)=>{anim.channels.push({sampler:anim.samplers.length,target:{node,path}});anim.samplers.push({input:ti,output:add(v,type),interpolation:'LINEAR'});};for(const [i,qs]of Object.entries(qtracks))track(+i,'rotation',qs,'VEC4');track(indices.root,'translation',positions,'VEC3');j.animations.push(anim);
  const travel=new T.Vector3().fromArray(samples.at(-1).bones.root.p).sub(new T.Vector3().fromArray(samples[0].bones.root.p));report.factions[faction].clips[action]={name:anim.name,sourceClip:name,duration:sc.duration,sourceFrameCount:times.length,travel:travel.toArray(),speedMps:Math.hypot(travel.x,travel.z)/sc.duration,samples};
 }
 j.buffers[0].byteLength=length;write(`${out}/models/${faction}_QuaterniusSamples.animation.glb`,j,Buffer.concat(parts));
 console.log('RETARGETED',faction,Object.fromEntries(Object.entries(report.factions[faction].clips).map(([k,v])=>[k,{duration:v.duration,speed:v.speedMps,travel:v.travel}])));
}
fs.writeFileSync(`${out}/validation/retarget.json`,JSON.stringify(report,null,2)+'\n');
// Original CC0 source kept intact, including its native root-motion tracks.
fs.copyFileSync(sourcePath,`${out}/source/UAL1_Standard_RM.glb`);
