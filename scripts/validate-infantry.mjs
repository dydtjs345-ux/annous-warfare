import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Battle} from '../src/simulation.js';
import {CombatVisuals} from '../src/combat-visuals.js';
import {MotionPresentation} from '../src/motion-presentation.js';
import {observeInfantry} from '../src/infantry/state.js';
const fields=['id','team','role','x','y','facing','health','ammo','reserve','reload','cooldown','active','dead','state','order','target','route','memory','suppression','patientId','treat','assignment','engagementId','aimAt'];
function run(seed,render){let rng=seed,calls=0;const b=new Battle(()=>{calls++;return(rng=(rng*1664525+1013904223)>>>0)/4294967296;},{map:'expanded',variant:seed%4,spawn:Math.floor(seed/4)%3,grenades:true}),hash=createHash('sha256'),visuals=new CombatVisuals(),motion=new MotionPresentation(),records=b.units.map(()=>({})),seen={},events={},examples={},fallbacks={};let maxSpeed=0,movingShots=0;
for(let step=0;step<2400&&!b.result;step++){
 if(render)motion.beforeStep(b);b.step(.05);
 if(render){const before=JSON.stringify(b.units.map(u=>Object.fromEntries(fields.map(k=>[k,u[k]])))),rngBefore=rng;
 visuals.update(b,.05,1,false);motion.update(b,visuals.models,1,.05,1,false);
 for(const u of b.units){const m=visuals.models[u.id],view=motion.position(u),state=observeInfantry(b,u,m,visuals.effects[u.id],view,visuals.clock,records[u.id]);seen[state.animation]=(seen[state.animation]||0)+1;maxSpeed=Math.max(maxSpeed,state.speed);if(state.fallback)fallbacks[state.fallback]=(fallbacks[state.fallback]||0)+1;if(m.moving&&m.flash)movingShots++;examples[state.animation]??={seed,time:b.time,id:u.id,aiState:u.state,speed:state.speed,brisk:state.brisk};if(state.animation==='Reload')assert.ok(state.phase>=0&&state.phase<1);}
 for(const e of b.events)if(e.time===b.time)events[e.type]=(events[e.type]||0)+1;
 assert.equal(JSON.stringify(b.units.map(u=>Object.fromEntries(fields.map(k=>[k,u[k]])))),before,'adapter changed soldier state');assert.equal(rng,rngBefore,'presentation consumed combat RNG');}
 hash.update(JSON.stringify({time:b.time,result:b.result,units:b.units.map(u=>Object.fromEntries(fields.map(k=>[k,u[k]])))}));
}
return {fingerprint:hash.digest('hex'),calls,rng,result:b.result,time:b.time,seen,events,examples,fallbacks,maxSpeed,movingShots};}
const cases=[];for(const seed of [7,19,42]){const baseline=run(seed,false),observed=run(seed,true);for(const k of ['fingerprint','calls','rng','result','time'])assert.equal(observed[k],baseline[k]);cases.push({seed,...observed});console.log('Parity and real-action coverage passed, seed',seed);}
const coverage=Object.assign({},...cases.map(c=>c.seen));assert.ok(coverage.Sprint&&coverage.Walk&&coverage.Reload&&coverage.Fire);
// This assertion compares moving shot/non-shot frames at identical real stride;
// firing must not change leg phase even though the selected upper take changes.
const m={moving:true,stride:4,renderStride:4,direction:0},u={state:'Aiming',facing:0,team:0,role:'Rifleman',presentation:{direct:true,lastShotAt:1,speed:1,moving:true}},fx={},v={movementHeading:0};
const a=observeInfantry({},u,m,fx,v,1,{});m.flash=true;const c=observeInfantry({},u,m,fx,v,1,{});assert.equal(a.phase,c.phase);assert.equal(a.animation,'AimWalk');assert.equal(c.animation,'MovingFire');
const report={passed:true,adapterParity:'exact combat hashes and RNG counts for three 120-second expanded-map runs',syntheticChecks:['identical gait phase across shot onset'],cases,physicalIPhone:false};writeFileSync('reports/infantry-test/simulation.json',JSON.stringify(report,null,2)+'\n');
