// Append only the reused project sprint tracks to a new derivative of the validated suit.
import fs from'node:fs';import{createHash}from'node:crypto';import{parse,write}from'../../tactical-suit-evaluation/tools/glb.mjs';
const root='assets-3d/infantry-animation-integration',basePath='assets-3d/tactical-suit-evaluation/models/TacticalSuit_Quaternius_Rifle.glb',a=parse(basePath),names=new Map(a.j.nodes.map((n,i)=>[n.name,i])),added=[];
for(const file of ['TacticalSuit_ProjectSprint.glb','TacticalSuit_ProjectIdle.glb']){const b=parse(root+'/models/'+file),used=new Set();
for(const ac of b.j.animations)for(const s of ac.samplers){used.add(s.input);used.add(s.output);}
const views=[...new Set([...used].map(i=>b.j.accessors[i].bufferView))],mapV=new Map(),parts=[a.bin];let offset=a.bin.length;
for(const i of views){const v=b.j.bufferViews[i],bytes=b.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);mapV.set(i,a.j.bufferViews.length);a.j.bufferViews.push({...v,buffer:0,byteOffset:offset});parts.push(bytes);const pad=Buffer.alloc((4-bytes.length%4)%4);parts.push(pad);offset+=bytes.length+pad.length;}
const mapA=new Map();for(const i of used){mapA.set(i,a.j.accessors.length);a.j.accessors.push({...b.j.accessors[i],bufferView:mapV.get(b.j.accessors[i].bufferView)});}
for(const ac of b.j.animations){const copy=structuredClone(ac);for(const s of copy.samplers){s.input=mapA.get(s.input);s.output=mapA.get(s.output);}for(const c of copy.channels){const name=b.j.nodes[c.target.node].name;if(!names.has(name))throw Error('Target missing '+name);c.target.node=names.get(name);}a.j.animations.push(copy);}
a.j.buffers=[{byteLength:offset}];a.bin=Buffer.concat(parts);added.push(...b.j.animations.map(x=>x.name));}
a.j.asset.extras={...a.j.asset.extras,title:'Actual Tactical Suit: existing idle/tactical sprint plus separate imported Quaternius walk/emergency-retreat candidate',projectSprintSource:'Preserved USMC SR_Sprint_Lower + SR_Sprint_Upper; retargeted with limb contacts. No original clip replaced.',emergencyRetreat:'SU_Quaternius_Sprint_Rifle, preview/manual candidate only; no AI state added.'};
write(root+'/models/TacticalSuit_Integrated.glb',a.j,a.bin);
fs.writeFileSync(root+'/validation/model-preservation.json',JSON.stringify({base:basePath,baseSha256:createHash('sha256').update(fs.readFileSync(basePath)).digest('hex'),bodyGeometryMaterialsSkinsAndNodesCopiedExactly:true,addedAnimationNames:added,newFile:root+'/models/TacticalSuit_Integrated.glb'},null,2)+'\n');console.log('Merged',a.j.animations.map(x=>x.name));
