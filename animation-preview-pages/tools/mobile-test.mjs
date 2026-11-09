import {webkit, chromium, devices} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const url=process.env.PREVIEW_URL||'http://127.0.0.1:8770/annous-warfare-animation-preview/';
const output=path.resolve(process.env.REVIEW_OUTPUT||path.join(import.meta.dirname,'../validation/local'));
await fs.mkdir(output,{recursive:true});
const engines=(process.env.TEST_ENGINES||'webkit,chromium').split(',');
const report={url,source_commit:'a1d280461f94456c905b677b213a6ee31245b1d0',tested_at:new Date().toISOString(),physical_iPhone_tested:false,browsers:[]};
if(process.env.APPEND_REVIEW==='1')report.browsers=JSON.parse(await fs.readFile(path.join(output,'mobile-validation.json'),'utf8')).browsers.filter(b=>!engines.includes(b.engine));
for(const engine of engines){
 const options={headless:true};
 if(engine==='chromium'){options.executablePath='/usr/bin/chromium';options.args=['--no-sandbox','--enable-unsafe-swiftshader'];}
 if(url.startsWith('https:')&&process.env.HTTPS_PROXY)options.proxy={server:process.env.HTTPS_PROXY};
 const browser=await (engine==='webkit'?webkit:chromium).launch(options);
 try{
  const context=await browser.newContext({...devices['iPhone 13'],reducedMotion:'no-preference'});
  const page=await context.newPage(),errors=[],networkErrors=[],hashes={},downloads=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&errors.length<12)errors.push(message.text());});
  page.on('response',response=>{
   if(response.status()>=400)networkErrors.push({url:response.url(),status:response.status()});
   if(response.url().endsWith('.glb'))downloads.push(response.body().then(bytes=>{hashes[response.url().includes('Russian')?'Russian':'USMC']=createHash('sha256').update(bytes).digest('hex');}).catch(()=>null));
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.animationPreview?.ready,{timeout:120000});
  // Existing animation regression assertions use English labels explicitly.
  if(await page.locator('#language').count())await page.selectOption('#language','en');
  await page.locator('#panels').scrollIntoViewIfNeeded();
  const frames=await page.evaluate(async()=>{
   const start=animationPreview.snapshot()[0];await new Promise(resolve=>setTimeout(resolve,1500));
   return {start,end:animationPreview.snapshot()[0]};
  });
  assert(frames.end.distance>frames.start.distance,'Actual RAF playback must advance locomotion');
  assert(frames.end.shots>frames.start.shots,'Actual RAF playback must repeat recoil');
  assert.equal(await page.locator('canvas').count(),1);
  assert.equal(await page.locator('#clip-options option').count(),21);
  assert.deepEqual(Object.keys(hashes),['USMC'],'Russian must load only on selection');
  const manifest=await page.evaluate(async()=>fetch('./source.json').then(r=>r.json()));
  assert.equal(manifest.commit,report.source_commit);
  const gameplayCamera=await page.evaluate(()=>{const a=animationPreview.actors[0],d=a.camera.position.clone().sub(a.controls.target);return {orthographic:a.camera.isOrthographicCamera,position:a.camera.position.toArray(),elevation:Math.atan2(d.y,Math.hypot(d.x,d.z))*180/Math.PI,controls:a.controls.enabled};});
  assert(gameplayCamera.orthographic&&!gameplayCamera.controls);assert(Math.abs(gameplayCamera.elevation-30)<.01);
  const checks={};
  for(const faction of ['USMC','Russian']){
   if(faction==='Russian'){
    await page.selectOption('#faction',faction);
    await page.waitForFunction(()=>animationPreview.ready&&animationPreview.actors[0]?.faction==='Russian',{timeout:120000});
   }
   await page.evaluate(()=>animationPreview.pause());
   const motions=await page.locator('#animation option').evaluateAll(options=>options.map(o=>o.value));
   const evaluated=await page.evaluate(values=>{
    const api=animationPreview,a=api.actors[0],result=[];
    for(const value of values){
     api.setState(value,true);api.restart();
     for(let i=0;i<12;i++)a.update(1/30);
     a.render();
     let finite=true;a.model.traverse(o=>{if(![...o.position,...o.quaternion,...o.scale].every(Number.isFinite))finite=false;});
     result.push({motion:value,missing:a.missing,finite});
    }
    return result;
   },motions);
   assert.equal(evaluated.length,38);
   assert(evaluated.every(r=>!r.missing&&r.finite),'All 17 motions and 21 source clips must play');
   const moving=await page.evaluate(()=>{
    const api=animationPreview,a=api.actors[0];api.setState('AimWalk',true);api.restart();api.step(.37);
    const lower=a.lower,before=a.lower.time;api.setState('MovingFire');const after=a.lower.time;
    const pose=()=>{const values=[];a.model.traverse(o=>{if(o.isBone)values.push(...o.quaternion);});return values;};
    const p0=pose();for(let i=0;i<24;i++)api.step(1/30);const p1=pose(),shots=a.shotCount;
    const firing={...api.snapshot()[0]},sameAction=lower===a.lower;
    document.getElementById('fire').click();for(let i=0;i<12;i++)api.step(1/30);
    return {before,after,sameAction,shots,firing,stopped:api.snapshot()[0],bonesChanged:p0.some((v,i)=>Math.abs(v-p1[i])>1e-4)};
   });
   assert.equal(moving.before,moving.after,'Enabling fire must preserve gait phase');
   assert(moving.sameAction&&moving.bonesChanged&&moving.shots>=4);
   assert.equal(moving.stopped.shots,moving.shots,'Fire off must stop new recoil');
   assert(moving.stopped.distance>moving.firing.distance,'Walking must continue after burst');
   const headings=[];
   for(const direction of ['N','NE','E','SE','S','SW','W','NW']){
    await page.selectOption('#direction',direction);
    headings.push(await page.evaluate(()=>animationPreview.actors[0].assembly.rotation.y));
   }
   assert.deepEqual(await page.evaluate(()=>animationPreview.actors[0].camera.position.toArray()),gameplayCamera.position,'Gameplay camera stays fixed across headings');
   assert.equal(new Set(headings).size,8,'Directions must rotate the 3D model');
   const scales=[];
   for(const height of ['60','80','120']){
    await page.selectOption('#height',height);
    scales.push(await page.evaluate(()=>{const a=animationPreview.actors[0];return a.camera.top-a.camera.bottom;}));
   }
   assert(Math.abs(scales[0]/scales[2]-2)<1e-6&&Math.abs(scales[1]/scales[2]-1.5)<1e-6);
   await page.selectOption('#animation','Reload');
   const reload=await page.evaluate(()=>{animationPreview.restart();const a=animationPreview.actors[0];for(let i=0;i<180;i++)a.update(1/30);a.render();return animationPreview.snapshot()[0];});
   assert.equal(reload.upper,'Upper_Aim','Reload must return to shouldered stance');
   assert.equal(await page.locator('canvas').count(),1,'Faction switch must release the old renderer');
   checks[faction]={motions:evaluated.length,raw_clips:21,moving_fire:moving,heading_rotations:headings,projection_spans:scales,reload_completed:true};
  }
  await page.selectOption('#view','side');
  assert(Math.abs(await page.evaluate(()=>animationPreview.actors[0].camera.position.y)-.85)<1e-8);
  await page.selectOption('#view','free');await page.locator('canvas').scrollIntoViewIfNeeded();
  const canvas=await page.locator('canvas').boundingBox();
  await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width/2+45,canvas.y+canvas.height/2+10,{steps:5});await page.mouse.up();await page.locator('#zoom-in').tap();
  const inspection=await page.evaluate(()=>{const a=animationPreview.actors[0];return {position:a.camera.position.toArray(),zoom:a.camera.zoom,orthographic:a.camera.isOrthographicCamera,touches:a.controls.touches};});
  assert(inspection.orthographic&&inspection.zoom!==1);assert.notDeepEqual(inspection.position,gameplayCamera.position);
  await page.selectOption('#view','gameplay');
  await page.selectOption('#comparison','both');await page.waitForFunction(()=>animationPreview.ready&&animationPreview.actors.length===2,{timeout:120000});
  await page.evaluate(()=>{animationPreview.pause();animationPreview.setState('MovingFire',true);animationPreview.restart();for(let i=0;i<24;i++)animationPreview.step(1/30);});
  const comparison=await page.evaluate(()=>animationPreview.actors.map(a=>({...animationPreview.snapshot().find(s=>s.faction===a.faction),shadowEnabled:a.renderer.shadowMap.enabled,receivers:a.ground.children.filter(o=>o.receiveShadow).length,camera:a.camera.position.toArray()})));
  assert.equal(comparison.length,2);assert.equal(comparison[0].gaitTime,comparison[1].gaitTime);assert.equal(comparison[0].shots,comparison[1].shots);assert(comparison.every(a=>a.distance>0&&a.shots>=4&&a.shadowEnabled&&a.receivers===1));
  await page.evaluate(()=>animationPreview.step(0));
  await page.screenshot({path:path.join(output,`${engine}-isometric-comparison.png`),fullPage:true});
  await page.selectOption('#animation','MovingFire');await page.selectOption('#direction','SE');await page.selectOption('#height','120');
  await page.locator('#panels').scrollIntoViewIfNeeded();
  await page.locator('#play').tap();
  await page.waitForFunction(()=>document.getElementById('play').textContent==='Pause');
  await page.waitForTimeout(300);
  await page.locator('#play').tap();
  const speeds=await page.locator('#speed option').evaluateAll(options=>options.map(o=>o.value));
  for(const speed of speeds)await page.selectOption('#speed',speed);
  await page.selectOption('#speed','1');
  await page.screenshot({path:path.join(output,`${engine}-iphone-portrait.png`),fullPage:true});
  const portrait=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));
  assert(portrait.content<=portrait.width,'Portrait must not overflow horizontally');
  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(100);
  const landscape=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));
  assert(landscape.content<=landscape.width,'Landscape must not overflow horizontally');
  await page.screenshot({path:path.join(output,`${engine}-iphone-landscape.png`),fullPage:true});
  const squads=[];
  await page.setViewportSize({width:390,height:844});
  for(const configuration of ['USMC','Russian','mixed']){
   if(configuration==='mixed')await page.selectOption('#comparison','mixed');
   else{if(await page.locator('#faction').isDisabled())await page.selectOption('#comparison','single');await page.selectOption('#faction',configuration);await page.selectOption('#comparison','squad');}
   await page.waitForFunction(()=>animationPreview.ready&&animationPreview.actors.length===6,{timeout:120000});
   assert.equal(await page.locator('canvas').count(),1,'Squad must share one WebGL canvas');assert(await page.locator('#view').isDisabled());
   const structure=await page.evaluate(()=>{const a=animationPreview.actors,firstMesh=o=>{let m;o.traverse(x=>{if(x.isSkinnedMesh&&!m)m=x;});return m;};let spacing=Infinity;for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)spacing=Math.min(spacing,a[i].assembly.position.distanceTo(a[j].assembly.position));return {factions:a.map(x=>x.faction),renderers:new Set(a.map(x=>x.renderer)).size,scenes:new Set(a.map(x=>x.scene)).size,skeletons:new Set(a.map(x=>firstMesh(x.model).skeleton)).size,sharedGeometry:a.every(x=>firstMesh(x.model).geometry===firstMesh(a.find(y=>y.faction===x.faction).model).geometry),spacing,urban:a[0].scene.getObjectByName('Readability_Urban_Test').children.map(x=>x.name)};});
   assert.equal(structure.renderers,1);assert.equal(structure.scenes,1);assert.equal(structure.skeletons,6);assert(structure.sharedGeometry&&structure.spacing>=2.39);assert(structure.urban.includes('Road')&&structure.urban.includes('Building_corner')&&structure.urban.includes('Cover_barrier'));
   assert.equal(structure.factions.filter(x=>x==='USMC').length,configuration==='mixed'?3:configuration==='USMC'?6:0);
   const motions={};
   for(const motion of ['Walk','Sprint','Aim','MovingFire']){
    motions[motion]=await page.evaluate(motion=>{const api=animationPreview;api.pause();api.setState(motion,true);api.restart();for(let i=0;i<8;i++)api.step(.1);return api.snapshot();},motion);
    assert(motions[motion].every(a=>a.lower&&a.upper));
   }
   assert(motions.MovingFire.every(a=>a.distance>0&&a.shots>=4&&a.lower==='Lower_AimWalk'&&a.upper==='Upper_Aim'));
   for(const size of ['60','80','120']){
    await page.selectOption('#height',size);
    const visible=await page.evaluate(()=>{const a=animationPreview.actors,cam=a[0].camera;return a.every(x=>[0,1.8].every(y=>{const p=x.assembly.position.clone();p.y+=y;p.project(cam);return Math.abs(p.x)<.99&&Math.abs(p.y)<.99;}));});
    assert(visible,'All six soldier positions and heads must fit at the selected native scale');
   }
   await page.evaluate(()=>animationPreview.step(0));
   await page.locator('#panels').screenshot({path:path.join(output,`${engine}-squad-${configuration}.png`)});
   squads.push({configuration,structure,motions});
  }
  // Exercise real playback for six actors, rather than only stepping static samples.
  await page.locator('#play').tap();const liveStart=await page.evaluate(()=>animationPreview.snapshot());await page.waitForTimeout(1200);const liveEnd=await page.evaluate(()=>animationPreview.snapshot());await page.locator('#play').tap();
  assert(liveEnd.every((a,i)=>a.distance>liveStart[i].distance&&a.shots>liveStart[i].shots));
  await page.selectOption('#comparison','single');await page.waitForFunction(()=>animationPreview.ready&&animationPreview.actors.length===1,{timeout:120000});assert.equal(await page.locator('canvas').count(),1);
  await Promise.all(downloads);
  assert.deepEqual(hashes,manifest.asset_sha256,'Published GLBs must match a1d2804 byte for byte');
  assert.deepEqual(errors,[],'No browser JavaScript or graphics errors');
  assert.deepEqual(networkErrors,[],'No failed asset responses');
  const result={squads,gameplayCamera,inspection,comparison,engine,version:browser.version(),device:'iPhone 13 emulation',checks,hashes,portrait,landscape,play_pause_touch:true,speed_options:speeds,errors,networkErrors};
  report.browsers.push(result);
  await fs.writeFile(path.join(output,'mobile-validation.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({engine,passed:true,source:manifest.commit,hashes,checks:['38 motions per faction','continuous moving fire','8 3D directions','60/80/120px','touch play/pause','portrait/landscape','asset hashes']}));
 }finally{await browser.close();}
}
