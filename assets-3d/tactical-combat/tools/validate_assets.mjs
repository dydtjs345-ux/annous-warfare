import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),validator=require(process.env.AW_GLTF_VALIDATOR||'gltf-validator');
function glb(buffer){const n=buffer.readUInt32LE(12),j=JSON.parse(buffer.subarray(20,20+n).toString());return{j,bin:buffer.subarray(28+n)};}
function hash(value){return createHash('sha256').update(value).digest('hex');}
const results=[];
for(const faction of ['USMC','Russian']){
 const source=await readFile(`assets-3d/sprint-rebuild/models/${faction}_SprintReview.glb`),output=await readFile(`assets-3d/tactical-combat/models/${faction}_Tactical.glb`),a=glb(source),b=glb(output),report=JSON.parse(await readFile(`assets-3d/tactical-combat/validation/${faction}-authored.json`));
 const check=(condition,message)=>{if(!condition)throw Error(faction+': '+message);};
 for(const key of ['nodes','meshes','skins','materials','textures','images','samplers','scenes','scene'])check(JSON.stringify(a.j[key])===JSON.stringify(b.j[key]),key+' changed');
 check(a.bin.equals(b.bin.subarray(0,a.bin.length)),'original binary changed');for(const clip of a.j.animations)check(JSON.stringify(clip)===JSON.stringify(b.j.animations.find(c=>c.name===clip.name)),'old clip changed '+clip.name);
 const names=Object.keys(report.actions);check(names.every(n=>b.j.animations.some(c=>c.name===n)),'new clip missing');check(new Set(b.j.animations.map(c=>c.name)).size===b.j.animations.length,'duplicate names');
 for(const name of names){const clip=b.j.animations.find(c=>c.name===name),allowed=new Set(report.actions[name].bones);check(clip.channels.every(c=>allowed.has(b.j.nodes[c.target.node].name)),'layer collision '+name);}
 const validation=await validator.validateBytes(new Uint8Array(output),{uri:faction+'_Tactical.glb',maxIssues:100});check(validation.issues.numErrors===0,'glTF validation errors');
 results.push({faction,passed:true,sourceHash:hash(source),assetHash:hash(output),oldClipsPreserved:a.j.animations.length,newClips:names.length,skinJoints:b.j.skins[0].joints.length,sourceGeometryRestNodesSkinsAndOldBinary:'identical',validator:validation.issues});
}
await writeFile('assets-3d/tactical-combat/validation/export-integrity.json',JSON.stringify({passed:true,results},null,2)+'\n');console.log(results.map(({faction,oldClipsPreserved,newClips,skinJoints,validator})=>({faction,oldClipsPreserved,newClips,skinJoints,errors:validator.numErrors,warnings:validator.numWarnings})));
