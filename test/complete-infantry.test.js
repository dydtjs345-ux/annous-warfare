import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {observeInfantry} from '../src/infantry/state.js';
const unit=()=>({active:true,dead:false,state:'Aiming',team:0,role:'Rifleman',facing:0,presentation:{direct:true,lastShotAt:1,speed:1.7,brisk:true,reloading:true,reloadProgress:.3}}),model={moving:true,flash:true,stride:4,renderStride:4,pose:'running'};
for(const [dead,active,expected]of [[true,false,'dead'],[false,false,'incapacitated']]){const u={...unit(),dead,active},record={base:'Walk',transition:'Raise',started:0};for(const time of [1,2,3]){const s=observeInfantry({},u,model,{}, {},time,record);assert.equal(s.animation,expected);assert.equal(s.fallback,expected);assert.equal(s.moving,false);assert.equal(s.shot,false);}}
const hurt=observeInfantry({},unit(),{...model,pose:'limping',limp:true},{},{},1,{});assert.equal(hurt.fallback,'injury movement');assert.notEqual(hurt.animation,'Sprint');
const u=unit();Object.assign(u.presentation,{reloading:false,direct:false,brisk:false});u.state='Moving';const record={};const m={...model,pose:'idle',moving:false,flash:false};observeInfantry({},u,m,{},{},0,record);m.moving=true;m.pose='walking';assert.equal(observeInfantry({},u,m,{},{},.1,record).animation,'Start');const mid=observeInfantry({},u,m,{},{},.3,record);assert.equal(mid.animation,'Start');assert.ok(mid.phase>.3);assert.equal(observeInfantry({},u,m,{},{},.8,record).animation,'Walk');
console.log('Terminal priority, injury fallback, stable start transition passed');
// The smaller external rig must complete one gait cycle per native stride,
// independently of render frame count and of the original faction stride.
const suitUnit=unit();suitUnit.state='Moving';Object.assign(suitUnit.presentation,{direct:false,reloading:false,brisk:false});
const suitRecord={},suitModel={pose:'walking',moving:true,renderStride:0,flash:false};const stride=1.212252646141;
observeInfantry({},suitUnit,suitModel,{}, {},0,suitRecord,'new',{Walk:stride});suitModel.renderStride=stride*.25*Math.PI*2;
assert.ok(Math.abs(observeInfantry({},suitUnit,suitModel,{}, {},.1,suitRecord,'new',{Walk:stride}).phase-.25)<1e-8);
console.log('External rig distance-to-native-stride synchronization passed');

const atlas=JSON.parse(readFileSync(new URL('../public/assets/infantry-test/manifest.json',import.meta.url)));
for(const name of ['USMC','Russian','USMC-LMG','Russian-LMG'])assert.ok(Math.abs(atlas.factions[name].sequences.Start.duration-.6)<1e-6,'Start must not hold its lower pose for an extra walking-upper cycle');
console.log('All faction Start atlas timings match the preserved 0.6-second source');

const movingReload=observeInfantry({},unit(),{...model,renderReloadProgress:.37},{},{},1,{});assert.equal(movingReload.animation,'Reload');assert.equal(movingReload.phase,.37,'A moving soldier must use actual reload progress, not stride phase');
console.log('Moving reload remains synchronized to the actual reload counter');
