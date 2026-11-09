import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.AW_PLAYWRIGHT_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright/index.mjs');
const lmg=process.env.AW_BAKE_LMG==='1',anchorsOnly=process.env.AW_BAKE_ANCHORS==='1';
const root=resolve('.'),output=resolve('public/assets/infantry-test');await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!path.startsWith(root+'/'))throw Error('path');const body=await readFile(path);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.glb':'model/gltf-binary'})[extname(path)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage();page.on('pageerror',e=>console.error(e));await page.goto(`http://127.0.0.1:${server.address().port}/tools/infantry/bake.html`);await page.waitForFunction(()=>window.bakerReady);
let meta={version:1,sourceCommit:'66d3892',sourceHashes:{},factions:{},method:'orthographic 30 degree GLB bake; 8 headings; lower/upper composition and additive shot samples',sprintApproval:'candidate, awaiting visual approval'};
if(lmg||anchorsOnly)meta=JSON.parse(await readFile(resolve(output,'manifest.json'),'utf8'));
for(const faction of ['USMC','Russian']){console.log('Baking',faction);const data=await page.evaluate(({faction,lmg,anchorsOnly})=>window.bakeFaction(faction,lmg,anchorsOnly),{faction,lmg,anchorsOnly});if(anchorsOnly){meta.factions[faction].muzzles=data.manifest.muzzles;meta.factions[faction].grips=data.manifest.grips;}else meta.factions[faction+(lmg?'-LMG':'')]=data.manifest;for(let i=0;i<data.sheets.length;i++)await writeFile(resolve(output,`${faction}${lmg?'-LMG':''}-${i}.png`),Buffer.from(data.sheets[i],'base64'));const source=await readFile(`assets-3d/sprint-rebuild/models/${faction}_SprintReview.glb`);meta.sourceHashes[faction]=createHash('sha256').update(source).digest('hex');console.log(faction,'complete',data.manifest.rows);}
await writeFile(resolve(output,'manifest.json'),JSON.stringify(meta,null,2)+'\n');
}finally{await browser.close();server.close();}
