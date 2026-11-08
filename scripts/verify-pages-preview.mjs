// Run against the artifact's matching checkout after deployment; any mismatch fails.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL(process.argv[2]||'https://dydtjs345-ux.github.io/annous-warfare/');
assert.equal(base.protocol,'https:');assert(base.pathname.endsWith('/'),'The base URL must end with /');
const root=path.resolve(process.argv[3]||'dist');
await fs.access(path.join(root,'animation-preview/index.html'));
const files=[];
async function scan(prefix=''){
 for(const item of await fs.readdir(path.join(root,prefix),{withFileTypes:true})){
  const name=path.posix.join(prefix,item.name);
  if(item.isDirectory())await scan(name);else if(item.isFile()&&!item.name.startsWith('.'))files.push(name);
 }
}
await scan();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<files.length){
  const file=files[cursor++],url=new URL(file==='index.html'?'./':file==='animation-preview/index.html'?'animation-preview/':file,base);
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
  assert.equal(response.status,200,`${url}: HTTP ${response.status}`);
  assert.equal(response.url,url.href,'Unexpected redirect for '+file);
  const actual=hash(Buffer.from(await response.arrayBuffer())),expected=hash(await fs.readFile(path.join(root,file)));
  assert.equal(actual,expected,'Published bytes differ for '+file);
  results.push({file,status:response.status,sha256:actual});
 }
}));
console.log(JSON.stringify({base:base.href,preview_url:new URL('animation-preview/',base).href,all_files_match:true,files:results.sort((a,b)=>a.file.localeCompare(b.file))},null,2));
