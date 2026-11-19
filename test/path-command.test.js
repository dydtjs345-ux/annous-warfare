import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/simulation.js';
import { assignRoute, cancelRoute, setFireMode, setProfile, validateRoute, simplify, segmentClear, stepCommand, commandFireBlock } from '../src/path-command.js';
import { obstacles, key, sight, blocked } from '../src/world.js';
import { perceive } from '../src/intelligence.js';
import { firingStatus } from '../src/diagnostics.js';
import { observeInfantry } from '../src/infantry/state.js';
import { visualState } from '../src/combat-visuals.js';
const make=()=>new Battle(()=>.99,{playerCommands:true});
const tick=(b,n)=>{for(let i=0;i<n;i++)b.step(.05);};

test('opt-in mode preserves original autonomous prototype and six command owners',()=>{
  assert.ok(new Battle().units.every(u=>!u.command));
  const b=make();assert.equal(b.units.filter(u=>u.command).length,6);
  tick(b,30);
  assert.deepEqual(b.units.slice(0,6).map(u=>[u.x,u.y]),Array.from({length:6},(_,i)=>[2,8+i*1.5]));
  assert.ok(b.units.slice(6).some(u=>u.x!==27));
});
test('dense route simplification retains a deliberate bend and exact endpoint',()=>{
  const points=Array.from({length:101},(_,i)=>({x:2,y:8+i/100}));
  points.push(...Array.from({length:100},(_,i)=>({x:2+(i+1)/100,y:9})));
  const reduced=simplify(points);assert.equal(reduced.length,3);
  assert.deepEqual(reduced,[{x:2,y:8},{x:2,y:9},{x:3,y:9}]);
});
test('walls, low barriers, building corners, bounds and malformed coordinates reject visibly',()=>{
  const b=make(),u=b.units[0];
  assert.ok(assignRoute(b,u,[{x:2,y:9}]).ok);const prior=structuredClone(u.command.route);
  for(const points of [[{x:8,y:6}],[{x:0,y:8}],[{x:NaN,y:8}],[{x:Infinity,y:8}],[]]){
    const r=assignRoute(b,u,points);assert.equal(r.ok,false);assert.ok(r.reason);assert.deepEqual(u.command.route,prior);
  }
  assert.equal(segmentClear({x:4,y:4},{x:5,y:3}),false);
  assert.equal(segmentClear({x:3,y:11},{x:3,y:13}),false);
});
test('six simultaneous independent routes reach exact fractional endpoints',()=>{
  const b=make(),orig=b.units.slice(0,6).map(u=>({x:u.x,y:u.y}));
  for(const u of b.units.slice(0,6))assert.ok(assignRoute(b,u,[{x:1.25,y:u.y},{x:1.25,y:u.y+.35}]).ok);
  let allMoving=false;
  for(let i=0;i<180;i++){b.step(.05);if(b.units.slice(0,6).every(u=>u.presentation.moving))allMoving=true;}
  assert.ok(allMoving);
  for(let i=0;i<6;i++){
    const u=b.units[i];assert.equal(u.command.route.length,0);assert.equal(u.x,1.25);assert.equal(u.y,orig[i].y+.35);
    assert.ok(!blocked(Math.round(u.x),Math.round(u.y)));assert.equal(u.assignment,undefined);
  }
});
test('replacement and cancellation affect only the addressed soldier',()=>{
  const b=make(),[a,c]=b.units;
  assignRoute(b,a,[{x:2,y:9}]);assignRoute(b,c,[{x:2,y:10}]);const other=structuredClone(c.command);
  assignRoute(b,a,[{x:1.2,y:8}]);assert.deepEqual(c.command,other);
  cancelRoute(a);assert.equal(a.command.route.length,0);assert.deepEqual(c.command,other);
  tick(b,40);assert.ok(c.y>9.5);assert.equal(a.x,2);
});
test('temporary occupancy stops without replanning and resumes the retained route',()=>{
  const b=make(),u=b.units[0],blocker=b.units[1];blocker.x=2;blocker.y=8.7;
  assignRoute(b,u,[{x:2,y:9}]);tick(b,40);
  assert.match(u.command.status,/병사/);assert.ok(u.y<8.2);assert.equal(u.command.route.at(-1).y,9);
  blocker.x=1;blocker.y=10;tick(b,65);assert.equal(u.y,9);assert.equal(u.command.route.length,0);
});
test('new terrain obstruction never creates an alternate route',()=>{
  const b=make(),u=b.units[0];b.units[1].x=1;assignRoute(b,u,[{x:2,y:9}]);obstacles.set(key(2,9),'wall');
  try {tick(b,40);assert.match(u.command.status,/장애물/);assert.ok(u.y>=8&&u.y<8.28);assert.equal(u.command.route[0].y,9);}
  finally {obstacles.delete(key(2,9));}
  tick(b,60);assert.equal(u.y,9);
});
test('suppression, leg injury, reload and incapacitation retain and resume route',()=>{
  for(const kind of ['suppression','legs','reload','incapacitation']){
    const b=make(),u=b.units[0];b.units[1].x=1;assignRoute(b,u,[{x:2,y:9}]);
    if(kind==='suppression')u.suppression=1;
    if(kind==='legs'){u.health['left leg']=30;u.health['right leg']=30;}
    if(kind==='reload'){u.reload=1;u.ammo=0;}
    if(kind==='incapacitation')u.active=false;
    tick(b,5);assert.equal(u.y,8,kind);assert.equal(u.command.route.length,1);assert.ok(u.command.status);
    u.suppression=0;u.health['left leg']=u.health['right leg']=100;u.active=true;
    tick(b,100);assert.equal(u.y,9,kind);assert.equal(u.command.route.length,0);
  }
});
test('hold fire remains absolute under direct contact and incoming pressure',()=>{
  const b=make(),u=b.units[0],e=b.units[6];u.x=12;u.y=13;e.x=16;e.y=13;
  setFireMode(u,'hold');assignRoute(b,u,[{x:14,y:13}]);const ammo=u.ammo;
  tick(b,65);assert.equal(u.ammo,ammo);assert.equal(u.presentation.lastShotAt,null);assert.equal(u.command.fire,'hold');
  assert.ok(u.x>12);assert.equal(firingStatus(b,u,e).permitted,false);
});
test('moving fire uses shared combat events and moving accuracy penalty without stopping path',()=>{
  const b=make(),u=b.units[0],e=b.units[6];u.x=12;u.y=13;e.x=16;e.y=13;
  assignRoute(b,u,[{x:15,y:13}]);perceive(b);u.visibleEnemies=[e];u.aimAt=0;u.engagementId=e.id;
  const fire=b.fireAt.bind(b),scales=[];b.fireAt=(...args)=>{scales.push(args[2]);return fire(...args);};
  for(let i=0;i<20;i++){b.time+=.05;stepCommand(b,u,.05);}
  assert.ok(u.x>13);assert.ok(u.ammo<30);assert.ok(scales.every(a=>a===.55));
  assert.ok(b.events.some(e=>e.type==='shot'&&e.unitId===u.id));assert.equal(u.command.route.at(-1).x,15);
  setFireMode(u,'hold');const ammo=u.ammo;for(let i=0;i<20;i++){b.time+=.05;stepCommand(b,u,.05);}assert.equal(u.ammo,ammo);
});
test('full realtime simulation drives moving-fire presentation while enemy AI reacts',()=>{
  const b=make(),u=b.units[0],e=b.units[6];u.x=12;u.y=13;e.x=16;e.y=13;
  assignRoute(b,u,[{x:15,y:13}]);let simultaneous=false;
  for(let i=0;i<30;i++){
    b.step(.05);
    if(u.presentation.shotThisStep && u.presentation.moving){
      const m=visualState(b,u,{shot:.1,angle:0});
      const observed=observeInfantry(b,u,m,{},u,b.time,{});
      assert.equal(observed.animation,'MovingFire');simultaneous=true;
    }
  }
  assert.ok(simultaneous);assert.ok(e.intel.contacts.has(u.id));
  assert.equal(u.command.route.at(-1).x,15);assert.equal(u.command.revision,1);
});
test('sprint disables fire and modes do not change route or firing permission',()=>{
  const b=make(),u=b.units[0],route=[{x:2,y:9}];assignRoute(b,u,route);setFireMode(u,'hold');
  for(const profile of ['stealth','recon','combat','sprint']){setProfile(u,profile);assert.deepEqual(u.command.route,route);assert.equal(u.command.fire,'hold');}
  setFireMode(u,'free');assert.match(commandFireBlock(u,b.units[6]),/전력질주/);
  assert.equal(setProfile(u,'teleport'),false);assert.equal(setFireMode(u,'automatic-override'),false);
});
test('LOS and range gate friendly fire, enemy knowledge stays observation based',()=>{
  const b=make(),u=b.units[0],e=b.units[6];u.x=4;u.y=6;e.x=8;e.y=6;u.aimAt=0;
  assert.equal(sight(u,e),false);assert.equal(firingStatus(b,u,e).permitted,false);
  const ammo=u.ammo;b.fireAt(u,e);assert.equal(u.ammo,ammo);
  e.x=27;assert.equal(firingStatus(b,u,e).permitted,false);tick(b,3);
  assert.ok(!e.visibleEnemies.some(a=>a.id===u.id));assert.ok(!e.intel.contacts.has(u.id));
});
test('rear contact cannot redirect movement or instantly twist the body',()=>{
  const b=make(),u=b.units[0],e=b.units[6];u.x=14;u.y=13;e.x=10;e.y=13;
  assignRoute(b,u,[{x:16,y:13}]);u.visibleEnemies=[e];u.aimAt=0;
  b.time=.05;stepCommand(b,u,.05);assert.ok(u.x>14);assert.equal(u.facing,0);assert.equal(u.ammo,30);
  cancelRoute(u);stepCommand(b,u,.05);assert.ok(Math.abs(u.bodyHeading)<=.15+1e-9);
});
test('moving-fire atlas gait is not reset by recoil and lower body follows travel',()=>{
  const b=make(),u=b.units[0],record={};u.state='Engaging';u.bodyHeading=0;
  Object.assign(u.presentation,{direct:true,brisk:false,lastShotAt:1});
  const model={moving:true,flash:false,renderStride:1,renderDirection:Math.PI};
  const a=observeInfantry(b,u,model,{},u,1,record);
  const c=observeInfantry(b,u,{...model,flash:true}, {},u,1.01,record);
  assert.equal(a.animation,'AimWalk');assert.equal(c.animation,'MovingFire');assert.equal(c.phase,a.phase);assert.equal(c.heading,0);
});
