import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import validator from '../../infantry-animation/tools/node_modules/gltf-validator/index.js';
const root=path.resolve(import.meta.dirname,'..'),reports=[];
for(const faction of ['USMC','Russian']){
 const file=path.join(root,'models',`${faction}_TacticalReload.glb`),data=await fs.readFile(file),official=await validator.validateBytes(new Uint8Array(data),{uri:path.basename(file),maxIssues:1000});
 console.log(faction,official.issues.numErrors,'errors',official.issues.numWarnings,'warnings',official.issues.messages.filter(m=>m.severity<=1).slice(0,5));
 assert.equal(official.issues.numErrors,0);assert.equal(official.issues.numWarnings,0);
 const n=data.readUInt32LE(12),g=JSON.parse(data.subarray(20,20+n));assert.equal(g.skins[0].joints.length,163);assert.deepEqual(g.animations.map(a=>a.name).sort(),['Reload_Tactical','Reload_Tactical_Lower']);
 const curves=JSON.parse(await fs.readFile(path.join(root,'curves',`${faction}-reload.json`)));assert.equal(curves.clips.length,2);assert(curves.clips.every(c=>typeof c.uuid==='string'));assert.equal(new Set(curves.clips.map(c=>c.uuid)).size,2,'Each layer needs a distinct runtime clip ID');assert(curves.clips.every(c=>Math.abs(c.duration-curves.duration)<1e-5));
 const right=g.nodes.findIndex(n=>n.name==='wrist.R'),weapon=g.nodes.findIndex(n=>n.name==='Weapon');assert(g.nodes[right].children.includes(weapon));
 reports.push({faction,bytes:data.length,bones:163,clips:curves.clips.map(c=>({name:c.name,tracks:c.tracks.length,duration:c.duration})),khronos:official.issues});
}
await fs.writeFile(path.join(root,'validation','glb-validation.json'),JSON.stringify(reports,null,2)+'\n');
