import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const pw=await import(process.env.AW_PLAYWRIGHT_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright/index.mjs');
const root=resolve('dist-infantry'),out=resolve('reports/infantry-test');await mkdir(out,{recursive:true});
let server,origin=process.env.AW_TEST_URL;
if(!origin){server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!path.startsWith(root+'/'))throw Error('path');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webp':'image/webp','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}/`;}
const report={origin,physicalIPhone:false,desktopSoftwareRendering:true,cases:[]};
try{
for(const engine of ['chromium','webkit']){
let browser;try{browser=await pw[engine].launch(engine==='chromium'?{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{headless:true});}catch(e){report.cases.push({engine,blocked:e.message});continue;}
try{
const errors=[],requests=[],page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>requests.push({url:r.url(),error:r.failure()}));
const started=Date.now();await page.goto(origin+'?seed=7');await page.waitForFunction(()=>window.awSnapshot?.().infantry?.units.length===12,{timeout:60000});const loadWallMs=Date.now()-started;
await page.locator('#pause').click();
// Map view includes both squads at their genuine spawn positions.
await page.locator('#focus').click();await page.locator('#focus').click();await page.waitForTimeout(200);
const initial=await page.evaluate(()=>awSnapshot());assert.equal(initial.units.length,12);assert.equal(initial.infantry.units.filter(u=>u.visible).length,12);
for(let i=0;i<12;i++)assert.equal(initial.infantry.units[i].faction,i<6?'USMC':'Russian');
await page.screenshot({path:resolve(out,`${engine}-all12.png`)});
await page.locator('#focus').click();await page.screenshot({path:resolve(out,`${engine}-portrait.png`)});
await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);await page.screenshot({path:resolve(out,`${engine}-landscape.png`)});
await page.locator('[data-speed="4"]').click();await page.locator('#pause').click();
const coverage={},fallbacks={},samples=[];let capturedFire=false,capturedReload=false;
for(let i=0;i<100;i++){
await page.waitForTimeout(350);const s=await page.evaluate(()=>awSnapshot());
for(const u of s.infantry.units){coverage[u.animation]=(coverage[u.animation]||0)+1;if(u.fallback)fallbacks[u.fallback]=(fallbacks[u.fallback]||0)+1;}
if(s.time>5)samples.push({time:s.time,fps:s.infantry.fps,p95:s.infantry.p95FrameMs});
if(!capturedFire && s.infantry.units.some(u=>u.visible&&u.shot)){await page.screenshot({path:resolve(out,`${engine}-combat.png`)});capturedFire=true;}
if(!capturedReload && s.infantry.units.some(u=>u.visible&&u.animation==='Reload')){await page.screenshot({path:resolve(out,`${engine}-reload.png`)});capturedReload=true;}
if(s.time>=110)break;
}
assert.ok(coverage.Sprint);assert.ok(coverage.Fire);assert.ok(coverage.Reload);
await page.locator('#pause').click();const paused=await page.evaluate(()=>awSnapshot());await page.waitForTimeout(150);const paused2=await page.evaluate(()=>awSnapshot());assert.equal(paused.time,paused2.time);assert.deepEqual(paused.infantry.units.map(u=>[u.animation,u.phase]),paused2.infantry.units.map(u=>[u.animation,u.phase]));
const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.transferSize,duration:r.duration}))),memory=await page.evaluate(()=>performance.memory?{usedJSHeap:performance.memory.usedJSHeapSize,totalJSHeap:performance.memory.totalJSHeapSize}:null);
// Manual memory fallback reload must avoid ALL infantry texture downloads.
await page.locator('#infantry-quality').selectOption('legacy');await page.waitForFunction(()=>window.awSnapshot?.().infantry?.enabled===false);assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.webp')).length),0);
await page.goto(origin+'infantry-trigger.html');await page.waitForSelector('#animation option',{state:'attached'});for(const faction of ['USMC','Russian']){await page.locator('#faction').selectOption(faction);for(const anim of ['Sprint','MovingFire','Reload'])await page.locator('#animation').selectOption(anim);}
await page.screenshot({path:resolve(out,`${engine}-trigger.png`)});
assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
report.cases.push({engine,passed:true,loadWallMs,initialNewSoldiers:12,coverage,fallbacks,samples,resources,memory,capturedFire,capturedReload,errors,requests});
}finally{await browser.close();}
}
report.passed=report.cases.some(c=>c.passed)&&report.cases.every(c=>c.passed||c.blocked);await writeFile(resolve(out,process.env.AW_TEST_URL?'public-browser.json':'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.cases.map(({engine,passed,blocked,loadWallMs,initialNewSoldiers,coverage})=>({engine,passed,blocked,loadWallMs,initialNewSoldiers,coverage})),null,2));
}finally{server?.close();}
