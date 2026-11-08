import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..'),repo=path.dirname(root),out=path.join(root,'dist');
const commit='a1d280461f94456c905b677b213a6ee31245b1d0',prefix='assets-3d/infantry-animation';
function source(file){return execFileSync('git',['show',`${commit}:${prefix}/${file}`],{cwd:repo,maxBuffer:128*1024*1024});}
function hash(data){return createHash('sha256').update(data).digest('hex');}
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(path.join(out,'models'),{recursive:true});
const architecture=JSON.parse(source('architecture.json')),expected=JSON.parse(source('validation/browser-review.json')).assetHashes,spans=JSON.parse(await fs.readFile(path.join(root,'src/reference-spans.json'),'utf8'));const hashes={};
for(const faction of ['USMC','Russian']){const filename=`${faction}_Animated.glb`,data=source(`models/${filename}`);hashes[faction]=hash(data);if(hashes[faction]!==expected[faction])throw new Error('Source asset hash mismatch');await fs.writeFile(path.join(out,'models',filename),data);architecture.factions[faction].reference_spans=spans[faction];delete architecture.factions[faction].source;}
await fs.writeFile(path.join(out,'architecture.json'),JSON.stringify(architecture));
for(const file of ['index.html','style.css'])await fs.copyFile(path.join(root,'src',file),path.join(out,file));
await fs.writeFile(path.join(out,'moving-fire.mp4'),source('review/moving-fire-120px.mp4'));await fs.writeFile(path.join(out,'poster.png'),source('review/eight-directions-120px.png'));
await fs.copyFile(path.join(root,'node_modules/three/LICENSE'),path.join(out,'LICENSE-three.txt'));await fs.writeFile(path.join(out,'.nojekyll'),'');
await build({entryPoints:[path.join(root,'src/app.js')],bundle:true,outfile:path.join(out,'app.js'),format:'esm',platform:'browser',target:['safari15.4','chrome100'],minify:true,legalComments:'eof',sourcemap:false});
await fs.writeFile(path.join(out,'source.json'),JSON.stringify({repository:'dydtjs345-ux/annous-warfare',commit,asset_sha256:hashes,clips_per_faction:21,animation_type:'skeletal GLB with independent locomotion, aiming and recoil layers',built_at:new Date().toISOString()},null,2)+'\n');
console.log(JSON.stringify({output:out,source_commit:commit,asset_sha256:hashes},null,2));
