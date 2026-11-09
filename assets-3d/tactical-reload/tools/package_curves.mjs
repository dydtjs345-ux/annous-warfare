// Read exported glTF keyframes, retaining actual bone and object animation channels.
import fs from 'node:fs/promises';import path from 'node:path';import * as T from '../../../animation-preview-pages/node_modules/three/build/three.module.js';
const root=path.resolve(import.meta.dirname,'..');
function parse(bytes){let j,b;for(let o=12;o<bytes.length;){const n=bytes.readUInt32LE(o),kind=bytes.readUInt32LE(o+4);if(kind===0x4e4f534a)j=JSON.parse(bytes.subarray(o+8,o+8+n));else if(kind===0x004e4942)b=bytes.subarray(o+8,o+8+n);o+=8+n;}return {j,b};}
const sizes={SCALAR:1,VEC3:3,VEC4:4};
for(const faction of ['USMC','Russian']){
 const {j,b}=parse(await fs.readFile(path.join(root,'models',`${faction}_TacticalReload.glb`))),meta=JSON.parse(await fs.readFile(path.join(root,'validation',`${faction}-authoring.json`),'utf8'));
 const values=index=>{const a=j.accessors[index],v=j.bufferViews[a.bufferView],n=sizes[a.type];if(a.componentType!==5126)throw Error('Animation accessor must be float');const result=[];for(let i=0;i<a.count;i++)for(let k=0;k<n;k++)result.push(b.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||n*4)+k*4));return result;};
 const clips=j.animations.map(animation=>{
  const tracks=animation.channels.map(c=>{const sampler=animation.samplers[c.sampler],name=T.PropertyBinding.sanitizeNodeName(j.nodes[c.target.node].name),property={translation:'position',rotation:'quaternion',scale:'scale'}[c.target.path];const interpolation=sampler.interpolation==='STEP'||c.target.path==='scale'?T.InterpolateDiscrete:T.InterpolateLinear;const Track=c.target.path==='rotation'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;return new Track(name+'.'+property,values(sampler.input),values(sampler.output),interpolation);});
  const clip=new T.AnimationClip(animation.name,-1,tracks);const json=T.AnimationClip.toJSON(clip);return json;
 });
 await fs.writeFile(path.join(root,'curves',`${faction}-reload.json`),JSON.stringify({faction,fps:30,duration:meta.duration,mechanism:meta.mechanism,clips,actions:meta.new_actions})+'\n');
 console.log(faction,clips.map(c=>({name:c.name,tracks:c.tracks.length,duration:c.duration})));
}
