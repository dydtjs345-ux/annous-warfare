// Read-only audit of the existing tactical GLBs through the actual preview mixer.
// No models, clips, authoring files, preview source, game or AI are modified.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const {chromium}=await import(process.env.AW_PLAYWRIGHT_MODULE||'playwright');
const root=resolve('animation-preview-pages/dist');
const output=resolve('assets-3d/tactical-rework');
const frames=resolve(process.env.AW_REWORK_FRAMES||'/tmp/aw-tactical-baseline');
const cases=['SprintProne','CrawlForward','CrouchWalk','ProneStand','CoverEnter','CoverExit'];
const report={baselineCommit:'aa650ce1b74390a70a46df76439a5420191a3898',
  status:'Reference footage unavailable; original motion audited, no revised animation authored.',
  method:'Actual GLB tracks evaluated in the existing Korean preview AnimationMixer; deterministic 12 Hz recordings, not a hardware frame-rate test.',
  metricsScope:'Local joint rotation ranges and mesh contacts are diagnostics, not a realism or balance verdict.',
  referencesActuallyViewed:[],factions:[],pageErrors:[]};
await mkdir(resolve(output,'validation'),{recursive:true});
await mkdir(resolve(output,'review'),{recursive:true});
const server=createServer(async(req,res)=>{
  try{
    const p=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
    if(!p.startsWith(root+sep))throw Error('path');
    res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.glb':'model/gltf-binary'})[extname(p)]||'application/octet-stream');
    res.end(await readFile(p));
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
  const source=JSON.parse(await readFile(resolve(root,'tactical-source.json'),'utf8'));
  assert.equal(source.commit,report.baselineCommit,'Build the preserved baseline before auditing.');
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1000,height:1100}});
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?review=tactical`);
  await page.waitForFunction(()=>window.animationPreview?.ready,null,{timeout:120000});
  await page.evaluate(()=>animationPreview.pause());
  for(const faction of ['USMC','Russian']){
    const sha=createHash('sha256').update(await readFile(resolve(root,source.models[faction].model))).digest('hex');
    assert.equal(sha,source.models[faction].sha256);
    await page.locator('#faction').selectOption(faction);
    await page.waitForFunction(()=>animationPreview.ready);
    const inventory=await page.evaluate(()=>{
      const a=animationPreview.actors[0],pairs=[];
      for(const [name,clip] of a.clips){
        if(!name.startsWith('TC_')||!name.endsWith('_Lower'))continue;
        const upper=a.clips.get(name.replace(/_Lower$/,'_Upper'));
        const lowerPaths=new Set(clip.tracks.map(t=>t.name));
        pairs.push({name:name.slice(3,-6),overlappingBindings:upper.tracks.filter(t=>lowerPaths.has(t.name)).map(t=>t.name),
          pelvisInUpper:upper.tracks.filter(t=>/^pelvis[LR]\./.test(t.name)).map(t=>t.name),
          spineInLower:clip.tracks.filter(t=>/^spine/.test(t.name)).map(t=>t.name)});
      }
      return {clipCount:a.clips.size,boneCount:a.model.getObjectsByProperty('isBone',true).length,pairs};
    });
    assert.equal(inventory.clipCount,110);assert.equal(inventory.boneCount,163);
    assert.equal(inventory.pairs.length,33);
    assert.ok(inventory.pairs.every(p=>!p.overlappingBindings.length&&!p.pelvisInUpper.length&&!p.spineInLower.length));
    const entry={faction,modelSha256:sha,...inventory,actions:[]};
    let index=0;
    for(const name of cases){
      const result=await page.evaluate(({name,faction})=>{
        const p=animationPreview,a=p.actors[0];p.pause();p.setState('Tactical:'+name,true);p.restart();
        a.mixer.stopAllAction();a.lower=null;a.upper=null;a.setState('Tactical:'+name,true);
        const lower=a.lower.getClip(),upper=a.upper.getClip(),info=a.manifest.clips[lower.name],D=lower.duration;
        const count=Math.ceil(D*12),images=[],samples=[];
        const sanitize=n=>n.replace(/[\[\]\.:/]/g,'');
        const names=['root','pelvis.L','pelvis.R','spine05','spine04','spine03','spine02','spine01','clavicle.L','clavicle.R','upperleg01.L','upperleg01.R','lowerarm01.L','lowerarm01.R','wrist.L','wrist.R'];
        const nodeByName=new Map(names.map(n=>[n,a.model.getObjectByName(sanitize(n))]));
        const unit=a.camera.position.clone().set(0,1,0);
        function travel(time){
          const s=info.travel_samples_m;
          if(!s)return (info.speed_mps||0)*time;
          for(let i=1;i<s.length;i++)if((s[i].time??s[i].t)>=time){const t0=s[i-1].time??s[i-1].t,t1=s[i].time??s[i].t,k=(time-t0)/(t1-t0);return s[i-1].distance_m+(s[i].distance_m-s[i-1].distance_m)*k;}
          return s.at(-1).distance_m;
        }
        const endDistance=travel(D),yaw=a.assembly.rotation.y;
        const target=unit.clone().set(Math.sin(yaw)*endDistance/2,.85,Math.cos(yaw)*endDistance/2);
        a.controls.enabled=false;a.renderer.setSize(640,400,false);a.camera.zoom=1;
        Object.assign(a.camera,{left:-2.16,right:2.16,top:1.35,bottom:-1.35});a.camera.updateProjectionMatrix();
        a.ground.position.set(0,0,0);if(a.coverProp)a.coverProp.visible=false;
        const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;const ctx=canvas.getContext('2d');
        let maxBindingPositionErrorM=0,maxBindingQuaternionErrorDeg=0;
        for(let frame=0;frame<count;frame++){
          const time=frame/12;a.lower.time=time;a.upper.time=time;a.lower.paused=false;a.upper.paused=false;a.mixer.update(0);
          a.assembly.position.set(Math.sin(yaw)*travel(time),0,Math.cos(yaw)*travel(time));a.assembly.updateMatrixWorld(true);
          const joints={};
          for(const [bone,node]of nodeByName){const v=node.position.clone();node.getWorldPosition(v);a.assembly.worldToLocal(v);joints[bone]={localQuaternion:node.quaternion.toArray(),localPosition:node.position.toArray(),actorLocalPosition:v.toArray()};}
          samples.push({time,travelM:travel(time),joints});
          for(const clip of [lower,upper])for(const track of clip.tracks){
            const dot=track.name.lastIndexOf('.'),node=a.model.getObjectByName(track.name.slice(0,dot)),prop=track.name.slice(dot+1),value=track.createInterpolant().evaluate(time);
            if(prop==='position')maxBindingPositionErrorM=Math.max(maxBindingPositionErrorM,Math.hypot(...node.position.toArray().map((x,i)=>x-value[i])));
            if(prop==='quaternion'){
              const q=node.quaternion.clone().fromArray(value).normalize(),actual=node.quaternion.clone().normalize();
              maxBindingQuaternionErrorDeg=Math.max(maxBindingQuaternionErrorDeg,actual.angleTo(q)*180/Math.PI);
            }
          }
          const frameImages={};
          for(const view of ['side','iso30']){
            const offset=unit.clone().set(view==='side'?9:6,view==='side'?0:Math.sqrt(72)*Math.tan(Math.PI/6),view==='side'?0:6);
            if(view==='side')offset.applyAxisAngle(unit,yaw);
            a.camera.position.copy(target).add(offset);a.camera.lookAt(target);a.camera.updateMatrixWorld(true);
            a.renderer.render(a.scene,a.camera);ctx.drawImage(a.renderer.domElement,0,0);
            ctx.fillStyle='#12202de8';ctx.fillRect(0,0,640,28);ctx.fillRect(0,374,640,26);
            ctx.font='16px sans-serif';ctx.fillStyle='#e7edf5';ctx.fillText(`${faction} · ORIGINAL · ${name} · ${view==='side'?'Side':'Fixed 30° isometric'}`,10,20);
            ctx.fillText(`${time.toFixed(2)} / ${D.toFixed(2)} s · translation ${travel(time).toFixed(2)} m · cover prop hidden to inspect body`,10,392);
            frameImages[view]=canvas.toDataURL('image/png').split(',')[1];
          }
          images.push(frameImages);
        }
        const range={};
        for(const bone of names){
          let angle=0;for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++){
            const q=nodeByName.get(bone).quaternion.clone().fromArray(samples[i].joints[bone].localQuaternion).normalize();
            const r=q.clone().fromArray(samples[j].joints[bone].localQuaternion).normalize();angle=Math.max(angle,q.angleTo(r)*180/Math.PI);
          }
          range[bone]={localRotationPairwiseRangeDeg:angle,actorLocalPositionRangeM:[0,1,2].map(k=>Math.max(...samples.map(s=>s.joints[bone].actorLocalPosition[k]))-Math.min(...samples.map(s=>s.joints[bone].actorLocalPosition[k])))};
        }
        const active=[...a.actions.values(),...a.recoil].filter(x=>x.isRunning()&&x.getEffectiveWeight()>1e-8).map(x=>({clip:x.getClip().name,weight:x.getEffectiveWeight()}));
        return {name,duration:D,frameCount:count,endDistance,range,maxBindingPositionErrorM,maxBindingQuaternionErrorDeg,active,samples,images};
      },{name,faction});
      assert.ok(result.maxBindingPositionErrorM<1e-6);
      assert.ok(result.maxBindingQuaternionErrorDeg<.0001);
      assert.equal(result.active.length,2);
      assert.ok(result.active.every(a=>a.clip.startsWith('TC_'+name+'_')));
      for(const view of ['side','iso30']){
        const dir=resolve(frames,faction,view);await mkdir(dir,{recursive:true});
        for(let i=0;i<result.images.length;i++)await writeFile(resolve(dir,String(index+i).padStart(5,'0')+'.png'),Buffer.from(result.images[i][view],'base64'));
        const phases=resolve(frames,'phases');await mkdir(phases,{recursive:true});
        for(let k=0;k<8;k++){const i=Math.round(k*(result.images.length-1)/7);await writeFile(resolve(phases,`${faction}-${name}-${view}-${k}.png`),Buffer.from(result.images[i][view],'base64'));}
      }
      index+=result.images.length;delete result.images;entry.actions.push(result);console.log('Audited and rendered original',faction,name);
    }
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','12','-i',resolve(frames,faction,'side','%05d.png'),'-framerate','12','-i',resolve(frames,faction,'iso30','%05d.png'),'-filter_complex','hstack=inputs=2','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',resolve(output,'review',faction+'-original-side-iso.mp4')]);
    report.factions.push(entry);
  }
  assert.deepEqual(report.pageErrors,[]);
  await writeFile(resolve(output,'validation/baseline.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Read-only baseline audit complete; reference-based rework remains blocked.');
}finally{await browser?.close();server.close();}
