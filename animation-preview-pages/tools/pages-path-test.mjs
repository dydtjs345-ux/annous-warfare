// Focused integration check: the already validated preview is mounted inside Pages.
import {webkit,chromium,devices} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url='http://127.0.0.1:8772/annous-warfare/animation-preview/';
const output=new URL('../validation/pages-path.json',import.meta.url);
const results=[];
for(const engine of ['webkit','chromium']){
 const browser=await(engine==='webkit'?webkit:chromium).launch(engine==='webkit'?{headless:true}:{headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({...devices['iPhone 13'],reducedMotion:'no-preference'}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  const response=await page.goto(url);
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.animationPreview?.ready,{timeout:120000});
  assert.equal(await page.locator('#clip-options option').count(),21);
  await page.selectOption('#faction','Russian');
  await page.waitForFunction(()=>animationPreview.ready&&animationPreview.actors[0].faction==='Russian',{timeout:120000});
  await page.selectOption('#comparison','mixed');
  await page.waitForFunction(()=>animationPreview.ready&&animationPreview.actors.length===6,{timeout:120000});
  const squad=await page.evaluate(()=>{animationPreview.pause();animationPreview.setState('MovingFire',true);animationPreview.restart();for(let i=0;i<8;i++)animationPreview.step(.1);return {actors:animationPreview.snapshot(),camera:animationPreview.actors[0].camera.isOrthographicCamera};});
  assert(squad.camera&&squad.actors.every(a=>a.shots>=4&&a.distance>0));
  assert.equal(await page.locator('canvas').count(),1);
  const controls=await page.locator('#height option').allTextContents();assert.deepEqual(controls,['60 px','80 px','120 px']);
  assert(requests.every(r=>r.startsWith(url)||r.startsWith('blob:')||r.startsWith('data:')),'All static requests must use the nested preview prefix');
  assert.deepEqual(errors,[]);
  results.push({engine,version:browser.version(),mount:new URL(url).pathname,clips:21,squad:squad.actors,all_requests_within_prefix:true,errors,public_pages_deployment_verified:false});
 }finally{await browser.close();}
}
await fs.writeFile(output,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({passed:true,browsers:results.map(r=>r.engine),mount:new URL(url).pathname}));
