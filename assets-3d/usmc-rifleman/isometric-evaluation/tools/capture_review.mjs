const{chromium}=await import(process.env.AW_PLAYWRIGHT_MODULE||'playwright');
import{mkdir,writeFile}from'node:fs/promises';import{fileURLToPath}from'node:url';import path from'node:path';import assert from'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');await mkdir(path.join(root,'sheets'),{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const errors=[],records=[];
const url='http://127.0.0.1:4256/annous-warfare/assets-3d/usmc-rifleman/isometric-evaluation/';
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 async function ready(p){await p.waitForFunction(()=>window.isometricReviewSnapshot?.().rows.every(r=>r.loaded));await p.waitForTimeout(100);}
 for(const h of[40,60,80,120]){
  await page.goto(url+`?sheet=1&height=${h}`);await ready(page);const s=await page.evaluate(()=>isometricReviewSnapshot());assert.equal(s.rows.length,16);
  for(const r of s.rows){assert.deepEqual(r.naturalSize,r.displaySize,'Native pixels are not resized');assert.ok(Math.abs(r.image.width-r.naturalSize[0])<.0001&&Math.abs(r.image.height-r.naturalSize[1])<.0001,'One bitmap pixel per CSS pixel');assert.ok(Math.abs(r.visibleHeight-h)<=1);assert.ok(r.image.left>=r.stage.left&&r.image.right<=r.stage.right&&r.image.top>=r.stage.top&&r.image.bottom<=r.stage.bottom,'No clipped model');}
  await page.locator('main').screenshot({path:path.join(root,'sheets',`all-directions-${h}px.png`)});records.push({kind:'native-sheet',width:390,height:h,snapshot:s});
 }
 await page.goto(url+'?height=60');await ready(page);await page.getByRole('button',{name:'80px',exact:true}).tap();await ready(page);assert.equal((await page.evaluate(()=>isometricReviewSnapshot())).height,80);
 await page.locator('#context').selectOption('cover');await ready(page);await page.screenshot({path:path.join(root,'sheets','mobile-cover-80px.png'),fullPage:true});records.push({kind:'mobile-controls',snapshot:await page.evaluate(()=>isometricReviewSnapshot())});
 await page.locator('#zoom').uncheck();await ready(page);assert.equal((await page.evaluate(()=>isometricReviewSnapshot())).matched,false);
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(100);const landscape=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,snapshot:isometricReviewSnapshot()}));assert.ok(landscape.scroll<=landscape.width);records.push({kind:'landscape',...landscape});
 const desktop=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});desktop.on('pageerror',e=>errors.push(e.message));
 await desktop.goto(url+'?overview=1&height=120&context=street');await ready(desktop);await desktop.screenshot({path:path.join(root,'sheets','eight-directions-overview-120px.png'),fullPage:true});
 await desktop.goto(url+'?height=120&context=neutral');await ready(desktop);await desktop.locator('details').evaluate(e=>e.open=true);await desktop.locator('#detail-direction').selectOption('SE');await desktop.waitForTimeout(100);await desktop.locator('details').screenshot({path:path.join(root,'sheets','low-ready-kneepad-detail-SE.png')});
 assert.equal(errors.length,0,errors);await writeFile(path.join(root,'validation','browser-review.json'),JSON.stringify({browser:'Chromium',physicalSafariVerified:false,errors,records},null,2)+'\n');
}finally{await browser.close()}
console.log('Native sheets, portrait/landscape and comparison controls passed.');
