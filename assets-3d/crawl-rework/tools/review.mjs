import{createServer}from'node:http';import{readFile,writeFile,mkdir}from'node:fs/promises';import{resolve,extname,sep}from'node:path';import{execFileSync}from'node:child_process';import assert from'node:assert/strict';
const{chromium}=await import(process.env.AW_PLAYWRIGHT_MODULE||'../../tactical-combat/tools/node_modules/playwright/index.mjs');const root=resolve(process.env.AW_CRAWL_DIST||'/workspace/crawl-review-dist'),base=resolve('animation-preview-pages/dist'),out=resolve('assets-3d/crawl-rework'),frames=resolve('/tmp/aw-crawl-comparison');await mkdir(resolve(out,'review'),{recursive:true});
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(req.url.split('?')[0]),dir=name.startsWith('/models/')&&!name.includes('CrawlForward')?base:root,p=resolve(dir,'.'+(name==='/'?'/index.html':name));if(!p.startsWith(dir+sep))throw Error('path');res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary'})[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const report={browser:'Chromium with software WebGL',physicalIPhone:false,errors:[],factions:[],recordingFps:24};let browser;
try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1200,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.crawlReview?.ready,null,{timeout:120000});await page.evaluate(()=>crawlReview.pause());
for(const faction of ['USMC','Russian']){
 await page.locator('#faction').selectOption(faction);await page.waitForFunction(()=>crawlReview.ready,null,{timeout:120000});await page.evaluate(()=>crawlReview.pause());
 const authored=JSON.parse(await readFile(resolve(out,'validation',faction+'-authored.json'),'utf8'));
 const checks=await page.evaluate(authored=>{const r=crawlReview,a=r.actors[1],results=[];for(const sample of authored.samples.CrawlForward){r.setTime(sample.time);a.assembly.updateMatrixWorld(true);let max=0;for(const[bone,expected]of Object.entries(sample.bones)){const node=a.model.getObjectByName(bone.replace(/[\[\]\.:/]/g,'')),v=node.position.clone();node.getWorldPosition(v);a.assembly.worldToLocal(v);const p=[v.x,-v.z,v.y];max=Math.max(max,Math.hypot(...p.map((x,i)=>x-expected[i])));}results.push({time:sample.time,maxJointErrorM:max});}return results;},authored);
 for(const c of checks)assert.ok(c.maxJointErrorM<.0001,JSON.stringify(c));
 const item={faction,sourceMatch:checks,views:[]};
 for(const view of ['side','iso']){await page.locator('#view').selectOption(view);const dir=resolve(frames,faction,view);await mkdir(dir,{recursive:true});
  const count=process.env.AW_DRAFT==='1'?8:116;
  for(let i=0;i<count;i++){
   const time=process.env.AW_DRAFT==='1'?i*2.4/8:i/24;
   const result=await page.evaluate(({time,faction,view})=>{crawlReview.setTime(time);const a=crawlReview.actors[1],source=crawlReview.canvas,c=document.createElement('canvas');c.width=source.width;c.height=source.height+64;const ctx=c.getContext('2d');ctx.fillStyle='#172737';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,0,40);ctx.fillStyle='#e6eff8';ctx.font='18px sans-serif';ctx.fillText(faction+' · ORIGINAL',16,27);ctx.fillText(faction+' · REVISED FORWARD CRAWL',c.width/2+16,27);ctx.font='14px sans-serif';ctx.fillText(`${view==='side'?'Side view':'Fixed 30° isometric'} · t=${time.toFixed(2)} s · same 2.4 s cycle / 0.23 m/s · actual skeletal playback`,16,c.height-7);return{png:c.toDataURL('image/png').split(',')[1],distance:a.assembly.position.z,camera:a.camera.position.toArray()};},{time,faction,view});
   await writeFile(resolve(dir,String(i).padStart(4,'0')+'.png'),Buffer.from(result.png,'base64'));
   if(process.env.AW_DRAFT==='1'||i===0||i===29||i===58||i===87)await writeFile(resolve(out,'review',`${faction}-${view}-phase-${process.env.AW_DRAFT==='1'?i:Math.floor(i/29)}.png`),Buffer.from(result.png,'base64'));
  }
  if(process.env.AW_DRAFT!=='1')execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',resolve(dir,'%04d.png'),'-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',resolve(out,'review',`${faction}-${view}.mp4`)]);
  item.views.push(view);console.log('Actual skeletal comparison',faction,view);
 }
 report.factions.push(item);
}
assert.deepEqual(report.errors,[]);await writeFile(resolve(out,'validation',process.env.AW_DRAFT==='1'?'browser-draft.json':'browser.json'),JSON.stringify(report,null,2)+'\n');
}finally{await browser?.close();server.close();}
