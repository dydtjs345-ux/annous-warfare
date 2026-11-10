// Exercise actual Actor transitions, including an active firing layer, without
// the stopAllAction reset used for deterministic baseline frame extraction.
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.AW_PLAYWRIGHT_MODULE||'playwright');
const root=resolve('animation-preview-pages/dist');
const server=createServer(async(req,res)=>{try{
  const path=resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!path.startsWith(root+sep))throw Error('path');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');
  res.end(await readFile(path));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const report={scope:'Actual preview setState(false) and update; sampled 250 ms after transition, beyond the 180 ms crossfade. Does not certify arbitrary-phase biomechanical continuity.',factions:[],errors:[]};
try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?review=tactical`);
  await page.waitForFunction(()=>window.animationPreview?.ready);
  for(const faction of ['USMC','Russian']){
    await page.locator('#faction').selectOption(faction);await page.waitForFunction(()=>animationPreview.ready);
    const checks=await page.evaluate(()=>{
      const p=animationPreview,a=p.actors[0],checks=[];p.pause();
      for(const from of ['Idle','Walk','MovingFire','Reload','SprintNew'])for(const to of ['SprintProne','CrawlForward','CrouchWalk','ProneStand','CoverEnter','CoverExit']){
        p.setState(from,true);p.restart();p.step(.08,false);
        const priorShots=a.shotCount;
        p.setState('Tactical:'+to,false);p.step(.25,false);
        const active=[...a.actions.values(),...a.recoil].filter(x=>x.isRunning()&&x.getEffectiveWeight()>1e-8).map(x=>({clip:x.getClip().name,weight:x.getEffectiveWeight()}));
        let maxPositionErrorM=0,maxQuaternionErrorDeg=0;
        for(const action of [a.lower,a.upper])for(const track of action.getClip().tracks){
          const split=track.name.lastIndexOf('.'),node=a.model.getObjectByName(track.name.slice(0,split)),property=track.name.slice(split+1),v=track.createInterpolant().evaluate(action.time);
          if(property==='position')maxPositionErrorM=Math.max(maxPositionErrorM,Math.hypot(...node.position.toArray().map((x,i)=>x-v[i])));
          if(property==='quaternion')maxQuaternionErrorDeg=Math.max(maxQuaternionErrorDeg,node.quaternion.clone().normalize().angleTo(node.quaternion.clone().fromArray(v).normalize())*180/Math.PI);
        }
        checks.push({from,to,priorShots,active,maxPositionErrorM,maxQuaternionErrorDeg});
      }
      return checks;
    });
    assert.equal(checks.length,30);
    for(const c of checks){assert.equal(c.active.length,2,JSON.stringify(c));assert.ok(c.active.every(a=>a.clip.startsWith('TC_'+c.to+'_')),JSON.stringify(c));assert.ok(c.maxPositionErrorM<1e-6,JSON.stringify(c));assert.ok(c.maxQuaternionErrorDeg<.0001,JSON.stringify(c));if(c.from==='MovingFire')assert.ok(c.priorShots>0);}
    report.factions.push({faction,checks});console.log('Layer transition checks',faction,checks.length);
  }
  assert.deepEqual(report.errors,[]);
  await writeFile(resolve('assets-3d/tactical-rework/validation/layer-transitions.json'),JSON.stringify(report,null,2)+'\n');
}finally{await browser?.close();server.close();}
