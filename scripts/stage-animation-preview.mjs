// Append the reviewed static preview to the normal game build. Never write a game file.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const game=path.resolve(process.argv[2]||'dist');
const source=path.resolve('animation-preview-pages/dist');
const target=path.join(game,'animation-preview');
const sourceCommit='a1d280461f94456c905b677b213a6ee31245b1d0';
const expected={USMC:'137fbabb13432b913a937e349393cbbc2c34de202558b83cf89ee952a622b094',Russian:'d36e4148f89572190c8c3437c30ed2b938d5c52edf8476067808218d79fd82e0'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function inventory(root,prefix=''){
 const result={};
 for(const item of (await fs.readdir(path.join(root,prefix),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const relative=path.posix.join(prefix,item.name);
  if(item.isDirectory())Object.assign(result,await inventory(root,relative));
  else {assert(item.isFile(),'Only regular files are allowed: '+relative);result[relative]=hash(await fs.readFile(path.join(root,relative)));}
 }
 return result;
}
await fs.access(path.join(game,'index.html'));
try {await fs.lstat(target);throw new Error('Refusing to overwrite an existing animation-preview route');}
catch(error){if(error.code!=='ENOENT')throw error;}
const provenance=JSON.parse(await fs.readFile(path.join(source,'source.json'),'utf8'));
assert.equal(provenance.commit,sourceCommit);
assert.deepEqual(provenance.asset_sha256,expected);
for(const [faction,digest]of Object.entries(expected))assert.equal(hash(await fs.readFile(path.join(source,'models',faction+'_Animated.glb'))),digest);
const before=await inventory(game),preview=await inventory(source);
for(const file of ['index.html','app.js','style.css','architecture.json','source.json','moving-fire.mp4','poster.png'])assert(file in preview,'Missing preview file: '+file);
await fs.cp(source,target,{recursive:true,force:false,errorOnExist:true});
const after=await inventory(game);
for(const [file,digest]of Object.entries(before))assert.equal(after[file],digest,'Game file changed: '+file);
assert.deepEqual(await inventory(target),preview);
assert.equal(Object.keys(after).length,Object.keys(before).length+Object.keys(preview).length);
console.log(JSON.stringify({mount:'/annous-warfare/animation-preview/',source_commit:sourceCommit,existing_game_files:Object.keys(before).length,game_files_unchanged:true,preview_files:Object.keys(preview).length,preview_sha256:preview},null,2));
