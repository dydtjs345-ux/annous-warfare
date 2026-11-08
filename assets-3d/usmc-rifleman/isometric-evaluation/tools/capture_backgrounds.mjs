const { chromium } = await import(process.env.AW_PLAYWRIGHT_MODULE || 'playwright');
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { configureWorld, blocked } from '../../../../src/world.js';
configureWorld('expanded',0);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'context'),{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],records=[];
try{
 const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4256/annous-warfare/?seed=2049&layout=0&spawn=0&debug=1');
 await page.waitForFunction(()=>window.awSnapshot);
 await page.locator('#pause').click();
 async function focus(x,y){
  const b=await page.locator('canvas').boundingBox(),cx=b.x+b.width/2,cy=b.y+b.height/2;
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+12,cy,{steps:2});await page.mouse.up();
  for(let i=0;i<24;i++){
   const s=await page.evaluate(()=>awSnapshot());if(Math.abs(s.view.zoom-1)<.045)break;
   await page.mouse.wheel(0,s.view.zoom<1?-100:100);await page.waitForTimeout(40);
  }
  for(let i=0;i<20;i++){
   const s=await page.evaluate(()=>awSnapshot()),px=s.height*20+180+(x-y)*20,py=55+(x+y)*10;
   const dx=(s.view.x+s.view.width/2-px)*s.view.zoom,dy=(s.view.y+s.view.height/2-py)*s.view.zoom;
   if(Math.abs(dx)+Math.abs(dy)<3)break;
   await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+Math.max(-550,Math.min(550,dx)),cy+Math.max(-350,Math.min(350,dy)),{steps:4});await page.mouse.up();await page.waitForTimeout(50);
  }
 }
 for(const[name,x,y]of[['street',14,14],['cover',33,28]]){
  await focus(x,y);await page.waitForTimeout(250);const s=await page.evaluate(()=>awSnapshot());assert.ok(s.paused);
  const b=await page.locator('canvas').boundingBox(),px=s.height*20+180+(x-y)*20,py=55+(x+y)*10;
  const fx=b.x+(px-s.view.x)*s.view.zoom,fy=b.y+(py-s.view.y)*s.view.zoom;
  const clip={x:Math.round(fx-260),y:Math.round(fy-200),width:520,height:360};
  assert.ok(clip.x>=0&&clip.y>=120&&clip.x+520<=1200&&clip.y+360<820,{clip});
  await page.screenshot({path:path.join(root,'context',name+'.png'),clip});
  const overlay=name==='cover'?[32,26]:[x,y];assert.equal(blocked(...overlay),false,'Place the review figure on a walkable tile');
  const ox=s.height*20+180+(overlay[0]-overlay[1])*20,oy=55+(overlay[0]+overlay[1])*10;
  records.push({name,seed:s.seed,layout:0,spawn:0,cameraTarget:[x,y],overlayWorldTarget:overlay,walkableOverlay:true,camera:s.view,paused:s.paused,battleTime:s.time,clip,footAnchor:[b.x+(ox-s.view.x)*s.view.zoom-clip.x,b.y+(oy-s.view.y)*s.view.zoom-clip.y]});
 }
 assert.equal(errors.length,0,errors);
 await writeFile(path.join(root,'validation','background-capture.json'),JSON.stringify({records,browserErrors:errors,method:'Existing game, existing pause and mouse camera controls only; no source edits or simulation command injection.'},null,2)+'\n');
}finally{await browser.close();}
console.log('Two actual battlefield crops captured.');
