import fs from 'node:fs';import assert from'node:assert/strict';import{createRequire}from'node:module';import{createHash}from'node:crypto';
const require=createRequire(import.meta.url),validator=require('/workspace/tactical-tools/node_modules/gltf-validator');
const root='assets-3d/open-asset-evaluation',report={baseCommit:'cfded5ca6e77bd508dbf175287a988776092362a',assets:[],preserved:[]};
function parse(bytes){let j,bin;for(let p=12;p<bytes.length;){const n=bytes.readUInt32LE(p),k=bytes.readUInt32LE(p+4);if(k===0x4e4f534a)j=JSON.parse(bytes.subarray(p+8,p+8+n));if(k===0x004e4942)bin=bytes.subarray(p+8,p+8+n);p+=8+n;}return{j,bin};}
for(const f of ['USMC','Russian']){
 const p=`${root}/models/${f}_QuaterniusSamples.animation.glb`,bytes=fs.readFileSync(p),{j}=parse(bytes),base=fs.readFileSync(`assets-3d/tactical-combat/models/${f}_Tactical.glb`),old=parse(base).j;
 assert.equal(old.skins[0].joints.length,163);assert.equal(j.animations.length,2);assert.deepEqual(j.animations.map(a=>a.name),['OA_Quaternius_Walk','OA_Quaternius_Sprint']);
 for(const key of ['nodes'])old[key].forEach((n,i)=>{const expected=structuredClone(n);delete expected.mesh;delete expected.skin;assert.deepEqual(j[key][i],expected,'Same bind hierarchy and weapon parents');});
 for(const a of j.animations){assert.equal(a.extras.rawRetarget,true);assert.equal(a.channels.length,164);assert.ok(a.channels.some(c=>j.nodes[c.target.node].name==='root'&&c.target.path==='translation'));for(const s of a.samplers)assert.equal(s.interpolation,'LINEAR');}
 const v=await validator.validateBytes(new Uint8Array(bytes),{uri:p,maxIssues:100});assert.equal(v.issues.numErrors,0,JSON.stringify(v.issues));assert.equal(v.issues.numWarnings,0,JSON.stringify(v.issues));report.assets.push({path:p,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),issues:v.issues});
}
const preservation=JSON.parse(fs.readFileSync(root+'/validation/preservation.json','utf8'));assert.equal(preservation.baseCommit,report.baseCommit);assert.equal(preservation.changedFiles.length,0);report.preservedFileCount=preservation.fileCount;delete report.preserved;report.scope='Only new evaluation files added; every previously tracked file byte-identical.';fs.writeFileSync(`${root}/validation/assets.json`,JSON.stringify(report,null,2)+'\n');console.log(report);
