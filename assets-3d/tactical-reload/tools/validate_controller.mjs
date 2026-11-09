// Exercise the real preview Actor animation methods without a WebGL renderer.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import * as T from '../../../animation-preview-pages/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../../../animation-preview-pages/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from '../../../animation-preview-pages/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
const {parseHTML}=await import(process.env.DOM_MODULE||'/tmp/preview-localization-tests/node_modules/linkedom/esm/index.js');
const root=path.resolve(import.meta.dirname,'..');const {window}=parseHTML(await fs.readFile(path.join(root,'../../animation-preview-pages/src/index.html'),'utf8'));
globalThis.window=window;globalThis.document=window.document;globalThis.matchMedia=()=>({matches:false});globalThis.requestAnimationFrame=()=>1;globalThis.addEventListener=()=>{};globalThis.fetch=()=>new Promise(()=>{});
for(const select of document.querySelectorAll('select'))if(!select.querySelector('option[selected]'))select.querySelector('option').setAttribute('selected','');
const {Actor}=await import('../../../animation-preview-pages/src/app.js');const {prepareReloadObjectActions}=await import('../../../animation-preview-pages/src/reload-layers.js');const {textureless}=await import('./validate_runtime.mjs');
const manifest=JSON.parse(await fs.readFile(path.join(root,'../../animation-preview-pages/dist/architecture.json'),'utf8')),results=[];
for(const faction of ['USMC','Russian']){
 const base=await new GLTFLoader().parseAsync(textureless(await fs.readFile(path.join(root,'../infantry-animation/models',`${faction}_Animated.glb`))),'');const extra=JSON.parse(await fs.readFile(path.join(root,'curves',`${faction}-reload.json`),'utf8'));
 for(const version of ['original','improved']){
  const a=Object.create(Actor.prototype),model=clone(base.scene),mixer=new T.AnimationMixer(model),clips=new Map([...base.animations,...extra.clips.map(c=>T.AnimationClip.parse(c))].map(c=>[c.name,c]));
  Object.assign(a,{faction,model,mixer,clips,reloadVersion:version,manifest:{...manifest.factions[faction],clips:{...manifest.factions[faction].clips,...extra.actions}},actions:new Map(),finished:[],recoil:[],shotCount:0,nextShot:0,distance:0,ground:new T.Group(),assembly:new T.Group(),readout:{textContent:''}});a.assembly.add(model);a.reloadObjectActions=prepareReloadObjectActions(clips,mixer);mixer.addEventListener('finished',e=>a.finished.push(e.action));
  a.setState('Reload',true);assert.equal(a.upper.getClip().name,version==='original'?'Reload':'Reload_Tactical');const D=a.upper.getClip().duration;
  let weaponStart,weaponRaised,handOff;
  for(let i=0;i<Math.floor(D*30);i++){a.update(1/30);a.assembly.updateMatrixWorld(true);const pos=model.getObjectByName('Weapon').getWorldPosition(new T.Vector3());if(i===0)weaponStart=pos;if(i===20)weaponRaised=pos;}
  // Complete the one-shot, including deferred mixer events and canonical mag restore.
  for(let i=0;i<16;i++)a.update(1/30);a.assembly.updateMatrixWorld(true);assert.equal(a.upper.getClip().name,'Upper_Aim');assert.equal(a.lower.getClip().name,'Lower_AimStance');
  const mag=model.getObjectByName('Magazine'),spare=model.getObjectByName('SpareMagazine');assert(Math.abs(mag.scale.x-1)<1e-6&&Math.abs(spare.scale.x-.001)<1e-6);
  const separation=mag.getWorldPosition(new T.Vector3()).distanceTo(model.getObjectByName('Weapon').getWorldPosition(new T.Vector3()));assert(separation<.001,'Canonical mag is seated in the weapon');
  if(version==='improved')assert(weaponRaised.y-weaponStart.y>.10,'Reload must raise the actual weapon');
  // Other authored movement stays available; starting fire must retain the gait action.
  a.setState('AimWalk',true);a.update(.37);const gait=a.lower,phase=gait.time;a.setState('MovingFire',true);assert.equal(a.lower,gait);assert.equal(a.lower.time,phase);
  const fullBodyStates=['Idle','Walk','Sprint','Aim','Raise','Lower','Fire','AimWalk','MovingFire','Start','Stop','Accelerate','Decelerate','SprintStop','TurnLeft','TurnRight'];
  for(const state of fullBodyStates){a.setState(state,true);a.update(.05);assert(!a.missing);}
  results.push({faction,version,duration:D,returned_to_shouldered_stance:true,canonical_magazine_restore_passed:true,moving_fire_gait_phase_preserved:true,other_states_available:fullBodyStates.length,weapon_raise_sample_m:weaponRaised.y-weaponStart.y});
 }
}
await fs.writeFile(path.join(root,'validation/controller.json'),JSON.stringify({renderer_tested:false,actual_actor_methods:true,results},null,2)+'\n');console.log('ACTOR_RELOAD_CONTROLLER_PASS',results);
