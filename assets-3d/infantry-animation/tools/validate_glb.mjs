import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import validator from 'gltf-validator';
const root=path.resolve(import.meta.dirname,'..');const reports=[];
for(const faction of ['USMC','Russian']){
 const file=`${faction}_Animated.glb`,data=await fs.readFile(path.join(root,'models',file));const official=await validator.validateBytes(new Uint8Array(data),{uri:file,maxIssues:1000});
 const len=data.readUInt32LE(12),g=JSON.parse(data.subarray(20,20+len));const meta=JSON.parse(await fs.readFile(path.join(root,'validation',`${faction}-authoring.json`),'utf8'));
 assert.equal(g.skins.length,1);assert.equal(g.skins[0].joints.length,163);assert.equal(g.animations.length,21);
 const names=g.skins[0].joints.map(i=>g.nodes[i].name);assert.deepEqual(new Set(names),new Set(Object.keys(meta.rest_bones)));
 const animations=[];
 for(const a of g.animations){const expected=meta.actions[a.name];assert.ok(expected);let first=Infinity,last=0;
  for(const c of a.channels){const node=g.nodes[c.target.node];assert.ok(expected.bones.includes(node.name)||['Magazine','SpareMagazine'].includes(node.name),'Layer mask leak');const accessor=g.accessors[a.samplers[c.sampler].input];first=Math.min(first,...accessor.min);last=Math.max(last,...accessor.max);}
  assert.ok(Math.abs(last-first-expected.duration)<1/30+.0001,`${a.name} duration`);animations.push({name:a.name,layer:expected.layer,channels:a.channels.length,duration:last-first,loop:expected.loop});
 }
 const weapon=g.nodes.findIndex(n=>n.name==='Weapon');const right=g.nodes.findIndex(n=>n.name==='wrist.R');
 assert.ok(g.nodes[right].children.includes(weapon),'Rifle is attached to wrist.R');
 assert.ok(g.nodes[weapon].children.some(i=>g.nodes[i].name==='Magazine'));assert.ok(g.nodes[weapon].children.some(i=>g.nodes[i].name==='SpareMagazine'));
 const warningSummary=official.issues.messages.filter(m=>m.severity<=1);console.log(file,official.issues.numErrors,'errors',official.issues.numWarnings,'warnings',warningSummary.slice(0,4));
 assert.equal(official.issues.numErrors,0);assert.equal(official.issues.numWarnings,0);
 reports.push({file,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),bones:163,meshes:g.meshes.length,animations,khronos:official.issues});
}
await fs.writeFile(path.join(root,'validation','glb-validation.json'),JSON.stringify({files:reports},null,2)+'\n');
