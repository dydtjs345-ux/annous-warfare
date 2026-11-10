import{readFile,writeFile}from'node:fs/promises';import{createRequire}from'node:module';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const require=createRequire(import.meta.url),validator=require(process.env.AW_GLTF_VALIDATOR||'../../tactical-combat/tools/node_modules/gltf-validator');
function parse(b){let j,binary;for(let p=12;p<b.length;){const n=b.readUInt32LE(p),type=b.readUInt32LE(p+4),d=b.subarray(p+8,p+8+n);if(type===0x4e4f534a)j=JSON.parse(d);else if(type===0x004e4942)binary=d;p+=8+n;}return{j,binary};}
const report={changedClips:['TC_CrawlForward_Lower','TC_CrawlForward_Upper'],factions:[]};
for(const faction of ['USMC','Russian']){
 const old=await readFile(`assets-3d/tactical-combat/models/${faction}_Tactical.glb`),full=await readFile(`assets-3d/crawl-rework/models/${faction}_CrawlRework.glb`),patch=await readFile(`assets-3d/crawl-rework/models/${faction}_CrawlForward.animation.glb`),a=parse(old),b=parse(full),p=parse(patch);
 for(const key of ['nodes','meshes','skins','materials','images','textures','scenes'])assert.deepEqual(b.j[key],a.j[key],key);
 assert.ok(b.binary.subarray(0,a.binary.length).equals(a.binary),'Original binary prefix');assert.equal(b.j.animations.length,110);assert.equal(p.j.animations.length,2);
 const unchanged=[];for(let i=0;i<a.j.animations.length;i++){const name=a.j.animations[i].name;if(report.changedClips.includes(name))assert.notDeepEqual(b.j.animations[i],a.j.animations[i]);else{assert.deepEqual(b.j.animations[i],a.j.animations[i]);unchanged.push(name);}}
 const result={faction,unchangedClipCount:unchanged.length,fullModelBytes:full.length,animationPatchBytes:patch.length,sha256:createHash('sha256').update(full).digest('hex'),patchSha256:createHash('sha256').update(patch).digest('hex'),validation:[]};
 for(const[name,bytes]of[['full',full],['animation',patch]]){const v=await validator.validateBytes(new Uint8Array(bytes),{uri:faction+'-'+name+'.glb',maxIssues:50});result.validation.push({asset:name,issues:v.issues});assert.equal(v.issues.numErrors,0,JSON.stringify(v.issues));assert.equal(v.issues.numWarnings,0,JSON.stringify(v.issues));}
 report.factions.push(result);console.log('Preserved 108 other clips and geometry; validated',faction);
}
await writeFile('assets-3d/crawl-rework/validation/assets.json',JSON.stringify(report,null,2)+'\n');
