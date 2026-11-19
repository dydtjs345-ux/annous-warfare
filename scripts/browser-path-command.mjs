const { chromium, webkit } = await import(process.env.AW_PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const out='reports/path-command';await mkdir(out,{recursive:true});
const origin=process.env.AW_TEST_URL||'http://localhost:5173/annous-warfare/path-command.html';
const report={url:origin,physicalIPhone:false,cases:[]};
for(const [engine,api] of [['chromium',chromium],['webkit',webkit]]){
  let browser;
  try{browser=await api.launch(engine==='chromium'?{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{headless:true});}
  catch(e){report.cases.push({engine,unavailable:e.message});continue;}
  const errors=[],failed=[],page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
  try{
    await page.goto(origin+'?seed=7');await page.waitForFunction(()=>window.awSnapshot?.().time>0.3);
    let s=await page.evaluate(()=>awSnapshot());assert.equal(s.units.length,12);assert.equal(s.units.filter(u=>u.command).length,6);
    assert.equal(await page.locator('#pause').isVisible(),false);
    await page.locator('[data-soldier="5"]').tap();assert.equal((await page.evaluate(()=>awSnapshot())).selected,5);
    await page.locator('#fire-mode').tap();await page.locator('#movement-mode').selectOption('recon');
    s=await page.evaluate(()=>awSnapshot());assert.equal(s.units[5].command.fire,'hold');assert.equal(s.units[0].command.fire,'free');assert.equal(s.units[5].command.profile,'recon');
    // Generous 44px tap region in the actual battlefield, independent of roster.
    await page.locator('#pan-map').tap();s=await page.evaluate(()=>awSnapshot());const box=await page.locator('canvas').first().boundingBox();
    await page.touchscreen.tap(box.x+s.units[0].screenX-12,box.y+s.units[0].screenY);await page.waitForTimeout(80);
    assert.equal((await page.evaluate(()=>awSnapshot())).selected,0);
    await page.screenshot({path:`${out}/${engine}-portrait.png`});
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);
    assert.ok((await page.locator('#movement-mode').boundingBox()).width>=90,'landscape movement selector remains usable');
    await page.locator('#movement-mode').selectOption('sprint');
    assert.equal((await page.evaluate(()=>awSnapshot())).units[0].command.profile,'sprint');
    await page.locator('#movement-mode').selectOption('combat');
    const cdp=engine==='chromium'?await page.context().newCDPSession(page):null;
    const stroke=async(points)=>{
      const b=await page.locator('canvas').first().boundingBox(),state=await page.evaluate(()=>awSnapshot());
      const screen=p=>({x:b.x+(state.height*20+180+(p.x-p.y)*20-state.view.x)*state.view.zoom,y:b.y+(55+(p.x+p.y)*10-state.view.y)*state.view.zoom});
      const route=points.map(screen);
      if(cdp){
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...route[0],id:1}]});
        for(const p of route.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await page.waitForTimeout(25);}
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }else{
        await page.mouse.move(route[0].x,route[0].y);await page.mouse.down();for(const p of route.slice(1))await page.mouse.move(p.x,p.y,{steps:4});await page.mouse.up();
      }
      await page.waitForTimeout(50);
    };
    const startTime=s.time;
    for(let i=0;i<6;i++){
      await page.locator(`[data-soldier="${i}"]`).tap();await page.locator('#draw-route').tap();
      s=await page.evaluate(()=>awSnapshot());const u=s.units[i];
      await stroke([{x:u.x,y:u.y},{x:u.x,y:1.1},{x:u.x+4,y:1.1}]);
      s=await page.evaluate(()=>awSnapshot());assert.equal(s.units[i].command.revision,1,`route ${i+1} committed by touch`);
    }
    s=await page.evaluate(()=>awSnapshot());assert.equal(s.speed,1);assert.equal(s.paused,false);assert.ok(s.time>startTime);
    assert.equal(s.units.slice(0,6).filter(u=>u.command.route.length).length,6);
    const assigned=s.units.slice(0,6).map(u=>({x:u.x,y:u.y,route:u.command.route}));
    await page.screenshot({path:`${out}/${engine}-six-routes.png`});
    // Invalid route through the original building must retain the old path.
    await page.locator('[data-soldier="0"]').tap();await page.locator('#draw-route').tap();
    s=await page.evaluate(()=>awSnapshot());await stroke([{x:s.units[0].x,y:s.units[0].y},{x:8,y:6}]);
    const invalid=await page.locator('#command-status').textContent();assert.match(invalid,/기존 경로 유지/);
    assert.equal((await page.evaluate(()=>awSnapshot())).units[0].command.revision,1);
    await page.locator('#pan-map').tap();await page.locator('#cancel-route').tap();
    s=await page.evaluate(()=>awSnapshot());assert.equal(s.units[0].command.route.length,0);assert.equal(s.units[1].command.revision,1);
    // Cancelled touch gestures and two-finger zoom must never issue a route.
    if(cdp){
      await page.locator('#draw-route').tap();const b=await page.locator('canvas').first().boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+200,y:b.y+80,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal((await page.evaluate(()=>awSnapshot())).units[0].command.revision,2);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+180,y:b.y+80,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+180,y:b.y+80,id:1},{x:b.x+240,y:b.y+80,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+160,y:b.y+80,id:1},{x:b.x+260,y:b.y+80,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal((await page.evaluate(()=>awSnapshot())).units[0].command.revision,2);
    }
    await page.locator('#pan-map').tap();
    // Map camera frames every genuine unit, including off-screen enemy squad.
    await page.locator('#focus').evaluate(el=>el.click());await page.waitForTimeout(300);
    s=await page.evaluate(()=>awSnapshot());assert.equal(s.infantry.units.filter(u=>u.visible).length,12);
    await page.screenshot({path:`${out}/${engine}-all12.png`});
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    report.cases.push({engine,passed:true,touchDrawing:!!cdp,sixIndependentRoutes:true,assigned,invalidFeedback:invalid,twelveRendered:12,simulationTime:s.time,fps:s.infantry.fps,p95FrameMs:s.infantry.p95FrameMs,errors,failed});
  }catch(e){report.cases.push({engine,passed:false,error:e.stack,errors,failed});await page.screenshot({path:`${out}/${engine}-failure.png`});}
  finally{await browser.close();}
}
await writeFile(`${out}/browser.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.cases.some(c=>c.passed)||report.cases.some(c=>c.passed===false))process.exitCode=1;
