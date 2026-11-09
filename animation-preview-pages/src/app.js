import {MotionProbe} from './motion-probe.js';
import {correctedStates,aimingUpper,makeRecoilActions,synchronizeGait} from './motion-system.js';
import {prepareReloadObjectActions} from './reload-layers.js';
import {t,clipLabel,setLanguage,translateDocument} from './i18n.js';
import * as T from 'three';
import {clone as cloneSkeleton} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id),actors=[],headings={N:225,NE:180,E:135,SE:90,S:45,SW:0,W:315,NW:270};
const states={Idle:['Lower_Idle','Upper_LowReady',0],Walk:['Lower_Walk','Upper_LowReady',1.05],Sprint:['Lower_Sprint','Upper_Sprint',3],Aim:['Lower_AimStance','Upper_Aim',0],AimWalk:['Lower_AimWalk','Upper_Aim',.62],MovingFire:['Lower_AimWalk','Upper_Aim',.62],Fire:['Lower_AimStance','Upper_Aim',0],Raise:['Lower_AimStance','Weapon_Raise',0],Lower:['Lower_AimStance','Weapon_Lower',0],Reload:['Lower_AimStance','Reload',0],Start:['Start_Walk','Upper_LowReady',0],Stop:['Stop_Walk','Upper_LowReady',0],Accelerate:['Walk_To_Sprint','Upper_Sprint',0],Decelerate:['Sprint_To_Walk','Upper_LowReady',0],SprintStop:['Sprint_Stop','Upper_LowReady',0],TurnLeft:['Turn_Left','Upper_Turn_Left',0],TurnRight:['Turn_Right','Upper_Turn_Right',0]};
const isReloadCompare=()=>$('comparison').value==='reload';
const isBodyCompare=()=>$('comparison').value==='body';
const isSquad=()=>['squad','mixed'].includes($('comparison').value);
const oneShots=new Set(['FB_Reload_Lower','FB_Reload_Upper','Reload_Tactical','Reload_Tactical_Lower','Weapon_Raise','Weapon_Lower','Reload','Start_Walk','Stop_Walk','Walk_To_Sprint','Sprint_To_Walk','Sprint_Stop','Turn_Left','Turn_Right','Upper_Turn_Left','Upper_Turn_Right']);
let manual=false,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,firing=true,state='MovingFire',clock=0,ready=false,architecture=null,needsRender=true,generation=0,requestController=null;

function resolveMotion(value,version='improved',motionVersion='before',manifest=null){
 if(motionVersion==='corrected'&&correctedStates[value]&&!(value==='Reload'&&version==='original'))return correctedStates[value];
 if(value==='Reload'&&version==='improved')return ['Reload_Tactical_Lower','Reload_Tactical',0];
 if(states[value])return states[value];
 const name=value.slice(5),info=(manifest||architecture.factions[$('faction').value]).clips[name];
 if(!info)throw new Error('Unknown animation clip: '+name);
 if(info.layer==='lower')return [name,name.includes('Sprint')?'Upper_Sprint':name==='Lower_AimWalk'||name==='Lower_AimStance'?'Upper_Aim':name==='Turn_Left'?'Upper_Turn_Left':name==='Turn_Right'?'Upper_Turn_Right':'Upper_LowReady',info.speed_mps||0];
 if(name==='FB_Recoil_Shot')return ['Lower_AimStance','FB_AimIdle_Upper',0];
 const correctedPair=Object.values(correctedStates).find(pair=>pair[0]===name||pair[1]===name);if(name.startsWith('FB_')&&correctedPair)return correctedPair;
 if(name==='Recoil_Shot')return ['Lower_AimStance','Upper_Aim',0];
 return [name==='Upper_Sprint'?'Lower_Sprint':name==='Upper_LowReady'||name.startsWith('Upper_Turn')?'Lower_Idle':'Lower_AimStance',name,name==='Upper_Sprint'?3:0];
}
export class Actor{
 constructor(faction,gltf,manifest,host=null,version='improved',motionVersion='corrected'){
  this.host=host;this.reloadVersion=version;this.motionVersion=motionVersion;
  this.manifest=manifest;this.faction=faction;this.model=gltf.scene;this.clips=new Map(gltf.animations.map(c=>[c.name,c]));this.mixer=new T.AnimationMixer(this.model);this.reloadObjectActions=prepareReloadObjectActions(this.clips,this.mixer);this.actions=new Map();this.nextShot=0;this.distance=0;this.shotCount=0;
  if(host){this.panel=host.panel;this.viewport=host.viewport;this.readout={textContent:''};this.scene=host.scene;this.ground=host.ground;this.camera=host.camera;this.renderer=host.renderer;this.controls=host.controls;this.assembly=new T.Group();this.assembly.add(this.model);this.scene.add(this.assembly);this.model.traverse(o=>{if(o.isMesh)o.castShadow=true;});}
  else{
  const panel=document.createElement('section');panel.className='panel';panel.dataset.faction=faction;panel.innerHTML=`<h2>${t('{faction} · {weapon}',{faction:t(faction),weapon:faction==='Russian'?'AK-74M':'M16A4'})}</h2><div class="viewport"></div><div class="readout"></div>`;$('panels').append(panel);this.panel=panel;this.viewport=panel.querySelector('.viewport');this.readout=panel.querySelector('.readout');
  this.scene=new T.Scene();this.scene.background=new T.Color('#28333f');this.assembly=new T.Group();this.assembly.add(this.model);this.scene.add(this.assembly);
  this.scene.add(new T.HemisphereLight(0xc4d8ee,0x434232,1.2));for(const [pos,power,color]of [[[-3,6,4],2.4,0xebefff],[[4,5,-2],1.5,0xd1e3ff],[[-2,4,-4],1.6,0xf2e5d1]]){const l=new T.DirectionalLight(color,power);l.position.set(...pos);this.scene.add(l);}
  this.model.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  this.ground=new T.Group();this.scene.add(this.ground);const grid=new T.GridHelper(20,80,0x71808a,0x465765);grid.material.transparent=true;grid.material.opacity=.32;this.ground.add(grid);const floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:0x28333f,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;this.ground.add(floor);grid.material.vertexColors=false;grid.material.color.setHex(0x526270);
  this.camera=new T.OrthographicCamera(-1,1,1,-1,.01,100);this.camera.position.set(6,4.899+ .85,6);this.camera.lookAt(0,.85,0);
  this.renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:false,powerPreference:'low-power'});this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;const key=this.scene.children.find(o=>o.isDirectionalLight);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-2.2,right:2.2,top:2.2,bottom:-2.2,near:.1,far:20});key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=.015;key.shadow.bias=-.00015;this.viewport.append(this.renderer.domElement);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,.85,0);this.controls.enablePan=false;this.controls.minZoom=.4;this.controls.maxZoom=5;this.controls.minPolarAngle=.15;this.controls.maxPolarAngle=Math.PI/2;this.controls.addEventListener('change',()=>{needsRender=true;});this.renderer.domElement.setAttribute('aria-label',t('{faction} animated infantry',{faction:t(faction)}));this.renderer.domElement.addEventListener('webglcontextlost',event=>{if(this.disposing)return;event.preventDefault();playing=false;showError('Graphics paused by the browser. Tap Retry loading to resume.');});
  }
  this.recoil=makeRecoilActions(this.mixer,this.clips,this.motionVersion==='corrected');
  this.finished=[];this.mixer.addEventListener('finished',e=>this.finished.push(e.action));
  if(!host){this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.viewport);this.resize();this.setView();}this.setDirection();this.setState(state,true);this.probe=new MotionProbe(this.model);this.probe.setVisible($('body-markers').checked);
 }
 action(name){if(!this.clips.has(name))return null;if(!this.actions.has(name)){const a=this.mixer.clipAction(this.clips.get(name));if(oneShots.has(name)){a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;}this.actions.set(name,a);}return this.actions.get(name);}
 changeLayer(which,name,immediate=false){const action=this.action(name);if(!action){this.missing=name;return;}const old=this[which];if(old===action)return;const phase=which==='lower'&&old&&!oneShots.has(name)&&!oneShots.has(old.getClip().name)?old.time/old.getClip().duration:0;action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();if(which==='lower')action.time=phase*action.getClip().duration;if(old){if(immediate)old.stop();else{old.fadeOut(.18);action.fadeIn(.18);}}this[which]=action;}
 setState(next,immediate=false){const [lower,upper,speed]=resolveMotion(next,this.reloadVersion,this.motionVersion,this.manifest);this.state=next;this.probe?.reset();this.speed=speed;this.missing=null;if(this.reloadObjects)this.reloadObjects.stop();this.reloadObjects=this.reloadObjectActions.get(upper);if(this.reloadObjects)this.reloadObjects.reset().setEffectiveWeight(1).play();this.changeLayer('lower',lower,immediate);let chosen=upper;this.pendingUpper=null;if(!immediate&&!next.startsWith('clip:')&&aimingUpper(upper)&&['Upper_LowReady','Upper_Sprint','FB_Walk_Upper','FB_Sprint_Upper','FB_LowReady_Upper'].includes(this.upper?.getClip().name)){chosen='Weapon_Raise';this.pendingUpper=upper;}else if(!immediate&&!next.startsWith('clip:')&&['Upper_LowReady','Upper_Sprint','FB_Walk_Upper','FB_Sprint_Upper','FB_LowReady_Upper'].includes(upper)&&aimingUpper(this.upper?.getClip().name)){chosen='Weapon_Lower';this.pendingUpper=upper;}this.changeLayer('upper',chosen,immediate);synchronizeGait(this);this.mixer.update(0);if(['clip:Recoil_Shot','clip:FB_Recoil_Shot'].includes(next))this.triggerShot(next==='clip:Recoil_Shot',next==='clip:FB_Recoil_Shot');}
 finishTransition(name){if(name==='Reload'||name==='Reload_Tactical'||name==='FB_Reload_Upper')this.reloadObjects?.stop();const target={FB_Reload_Upper:['upper','FB_AimIdle_Upper'],FB_Reload_Lower:['lower','Lower_AimStance'],Reload_Tactical:['upper','Upper_Aim'],Reload_Tactical_Lower:['lower','Lower_AimStance'],Weapon_Raise:['upper','Upper_Aim'],Weapon_Lower:['upper','Upper_LowReady'],Reload:['upper','Upper_Aim'],Start_Walk:['lower','Lower_Walk'],Stop_Walk:['lower','Lower_Idle'],Walk_To_Sprint:['lower','Lower_Sprint'],Sprint_To_Walk:['lower','Lower_Walk'],Sprint_Stop:['lower','Lower_Idle'],Turn_Left:['lower','Lower_Idle'],Turn_Right:['lower','Lower_Idle']}[name];if(target){if(this.motionVersion==='corrected'){const remap={Lower_Walk:'FB_Walk_Lower',Lower_Sprint:'FB_Sprint_Lower',Upper_Aim:'FB_AimIdle_Upper',Upper_LowReady:'FB_LowReady_Upper'};target[1]=remap[target[1]]||target[1];}if((name==='Weapon_Raise'||name==='Weapon_Lower')&&this.pendingUpper){target[1]=this.pendingUpper;this.pendingUpper=null;}if(name==='Turn_Left'||name==='Turn_Right'){this.assembly.rotation.y+=(name==='Turn_Left'?1:-1)*Math.PI/4;this.changeLayer(...target,true);}else this.changeLayer(...target);const speeds={Lower_Walk:1.05,Lower_Sprint:3,Lower_AimWalk:.62,FB_Walk_Lower:1.05,FB_Sprint_Lower:3,FB_AimWalk_Lower:.62};if(target[0]==='lower')this.speed=speeds[target[1]]??0;if(target[0]==='lower'&&this.motionVersion==='corrected'){const upperForLower={FB_Walk_Lower:'FB_Walk_Upper',FB_Sprint_Lower:'FB_Sprint_Upper',Lower_Idle:'FB_LowReady_Upper'};if(upperForLower[target[1]])this.changeLayer('upper',upperForLower[target[1]]);}synchronizeGait(this);if(target[0]==='lower')this.lower.time={Start_Walk:0,Stop_Walk:0,Walk_To_Sprint:0,Sprint_To_Walk:0,Sprint_Stop:0}[name]??0;}if(name==='Upper_Turn_Left'||name==='Upper_Turn_Right')this.changeLayer('upper','Upper_LowReady',true);}
 calibrate(){
  this.referenceSpans=this.manifest.reference_spans;
  if(!this.referenceSpans)throw new Error('Camera calibration is missing');
  this.mixer.stopAllAction();this.lower=null;this.upper=null;this.setState(state,true);this.setDirection();
 }
 dispose(){
  this.disposing=true;this.observer?.disconnect();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);
  if(this.host){this.assembly.removeFromParent();return;}
  const geometries=new Set(),materials=new Set(),textures=new Set();
  this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures){t.dispose();t.image?.close?.();}
  this.controls.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.panel.remove();this.scene.clear();
 }
 triggerShot(original=false,corrected=false){const pool=original?(this.originalRecoil??=makeRecoilActions(this.mixer,this.clips,false)):corrected?(this.correctedRecoil??=makeRecoilActions(this.mixer,this.clips,true)):this.recoil;if(!pool.length)return;const a=pool[this.shotCount%pool.length];a.stop().reset().setEffectiveWeight(1).play();this.shotCount++;}
 setView(){
  this.probe?.reset();if(this.host)return;
  const mode=$('view').value;this.controls.enabled=mode==='free';this.camera.zoom=1;
  if(mode==='side'){const offset=new T.Vector3(9,0,0).applyAxisAngle(new T.Vector3(0,1,0),this.assembly.rotation.y);this.camera.position.copy(offset).add(this.controls.target);}
  else this.camera.position.set(6,4.899+.85,6);
  this.camera.lookAt(this.controls.target);this.controls.update();this.bodyPlaced=false;this.resize();
 }
 setDirection(){this.probe?.reset();this.assembly.rotation.y=T.MathUtils.degToRad(headings[$('direction').value]);if($('view').value==='side')this.setView();else this.resize();}
 resize(){if(this.host)return;const w=this.viewport.clientWidth,h=this.viewport.clientHeight;if(w<1||h<1)return;this.renderer.setSize(w,h,false);const worldSpan=($('view').value==='side'?1.73:(this.referenceSpans?.[$('direction').value]??1.73))*h/Number($('height').value);this.camera.left=-worldSpan*w/h/2;this.camera.right=worldSpan*w/h/2;this.camera.top=worldSpan/2;this.camera.bottom=-worldSpan/2;this.camera.updateProjectionMatrix();if(this.bodyReviewActors)placeBodyComparison(this);needsRender=true;}
 update(dt,frameTime=clock,fireEnabled=firing){
  if(dt>0&&fireEnabled&&aimingUpper(this.upper?.getClip().name)&&(this.state==='MovingFire'||this.state==='Fire')&&frameTime+1e-9>=this.nextShot&&this.recoil.length){this.triggerShot();this.nextShot=frameTime+.14;}
  if(!fireEnabled)this.nextShot=frameTime;synchronizeGait(this);const oldLower=this.lower,oldTime=oldLower?.time??0,info=this.manifest?.clips?.[oldLower?.getClip().name];this.mixer.update(dt);if(this.finished.length){const events=this.finished.splice(0);for(const action of events){if(this.recoil.includes(action)||this.originalRecoil?.includes(action)||this.correctedRecoil?.includes(action))action.stop();else if(action===this.upper||action===this.lower)this.finishTransition(action.getClip().name);}this.mixer.update(0);}if(this.pendingSingleShot&&aimingUpper(this.upper?.getClip().name)){this.pendingSingleShot=false;this.triggerShot();}if(info?.travel_samples_m){const samples=info.travel_samples_m;const at=t=>{const f=Math.max(0,Math.min(samples.length-1,t*30)),i=Math.min(samples.length-2,Math.floor(f));return samples[i].distance_m+(samples[i+1].distance_m-samples[i].distance_m)*(f-i);};this.distance+=at(Math.min(info.duration,oldTime+dt))-at(oldTime);if(oldLower!==this.lower){const tail=Math.max(0,oldTime+dt-info.duration);this.lower.time=tail;this.distance+=this.speed*tail;this.mixer.update(0);}}else this.distance+=this.speed*dt;const fwd=new T.Vector3(0,0,-1).applyAxisAngle(new T.Vector3(0,1,0),this.assembly.rotation.y);if(!this.host)this.ground.position.copy(fwd.multiplyScalar(this.distance% .25));
  this.refreshReadout();
 }
 refreshReadout(){this.readout.textContent=this.missing?t('Unavailable: {clip}',{clip:clipLabel(this.missing)}):t('{lower} + {upper} · gait {time}s · shots {shots}',{lower:clipLabel(this.lower?.getClip().name||''),upper:clipLabel(this.upper?.getClip().name||''),time:this.lower?.time.toFixed(2)??'0',shots:this.shotCount});}
 refreshLabels(){if(this.host)return;this.panel.querySelector('h2').textContent=this.squadPositions?($('comparison').value==='mixed'?t('Squad preview · 3 USMC + 3 Russian'):t('Squad preview · 6 {faction}',{faction:t(this.faction)})):t('{faction} · {weapon}',{faction:t(this.faction),weapon:this.faction==='Russian'?'AK-74M':'M16A4'});if(isReloadCompare())this.panel.querySelector('h2').textContent=t(this.reloadVersion==='original'?'Original reload · {faction}':'Improved reload · {faction}',{faction:t(this.faction)});if(isBodyCompare())this.panel.querySelector('h2').textContent=t(this.motionVersion==='before'?'Before · {faction}':'Corrected · {faction}',{faction:t(this.faction)});if(this.bodyReviewActors){this.panel.querySelector('h2').innerHTML='<span>'+t('Before · {faction}',{faction:t(this.faction)})+'</span><span>'+t('Corrected · {faction}',{faction:t(this.faction)})+'</span>';}this.renderer.domElement.setAttribute('aria-label',this.panel.querySelector('h2').textContent);this.refreshReadout();}
 render(){if(this.panel.hidden)return;if(!this.host)this.renderer.render(this.scene,this.camera);this.probe?.sample(clock);}
}


function setupBodyComparison(){const host=actors[0],container=host.readout;container.classList.add('paired-readout');container.innerHTML='<div></div><div></div>';actors.forEach((a,i)=>{a.readout=container.children[i];a.refreshReadout();});host.bodyReviewActors=[...actors];host.refreshLabels();host.resize();}
function placeBodyComparison(host){if($('view').value==='free'&&host.bodyPlaced)return;host.camera.updateMatrixWorld(true);const right=new T.Vector3().setFromMatrixColumn(host.camera.matrixWorld,0),offset=Math.min((host.camera.right-host.camera.left)/4,(host.camera.top-host.camera.bottom)*140/host.viewport.clientHeight);host.bodyReviewActors.forEach((a,i)=>a.assembly.position.copy(right).multiplyScalar((i?1:-1)*offset));const light=host.scene.children.find(o=>o.isDirectionalLight);if(light){const extent=Math.max(2.2,offset+1.2);Object.assign(light.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});light.shadow.camera.updateProjectionMatrix();}host.bodyPlaced=true;}

function sizeSquad(){const host=actors[0];if(!host)return;host.viewport.style.height=Math.max(360,Number($('height').value)*3.7+60)+'px';host.resize();}
function setupSquad(){
 const host=actors[0],r=Math.SQRT1_2;
 const positions=[];
 for(let i=0;i<6;i++){const side=(i%2?1:-1)*1.2,depth=(Math.floor(i/2)-1)*4;const p=new T.Vector3((side+depth)*r,0,(depth-side)*r);actors[i].assembly.position.copy(p);positions.push(p);}
 host.squadPositions=positions;const city=new T.Group();city.name='Readability_Urban_Test';host.scene.add(city);
 const box=(name,side,depth,w,h,l,color)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,l),new T.MeshStandardMaterial({color,roughness:1}));o.name=name;o.position.set((side+depth)*r,h/2-.01,(depth-side)*r);o.rotation.y=Math.PI/4;o.castShadow=true;o.receiveShadow=true;city.add(o);return o;};
 box('Road',0,0,4.8,.025,20,0x3d454b);
 for(const side of [-1,1]){box('Sidewalk',side*2.7,0,.6,.12,20,0x7b7b72);for(const depth of [-6,6]){box('Building_corner',side*2.85,depth,1.6,1.6,3,0x899083);box('Window',side*2.04,depth,.025,.38,.8,0x374b53);}}
 for(const depth of [-7,-3,1,5,9])box('Road_marking',0,depth,.06,.03,1.1,0xaaa68b);
 for(const depth of [-2,2]){box('Cover_barrier',0,depth,.7,.65,.45,0x7f8275);box('Cover_crate',2.65,depth,.55,.55,.6,0x636c4d);}
 const key=host.scene.children.find(o=>o.isDirectionalLight);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,far:30});key.shadow.camera.updateProjectionMatrix();
 host.refreshLabels();sizeSquad();
}

function updateButtons(){
 $('play').textContent=t(playing?'Pause':'Play');$('play').setAttribute('aria-pressed',String(playing));
 $('fire').textContent=t(firing?'Fire on':'Fire off');$('fire').setAttribute('aria-pressed',String(firing));
 const canFire=state==='MovingFire'||state==='Fire';$('fire').disabled=!canFire;
}
function setState(next,immediate=false){
 state=next;$('animation').value=next;firing=next==='MovingFire'||next==='Fire';
 for(const a of actors){a.setDirection();a.setState(next,immediate);}
 updateButtons();needsRender=true;
}
function restart(){
 clock=0;for(const a of actors){a.mixer.stopAllAction();a.finished=[];a.lower=null;a.upper=null;a.nextShot=0;a.shotCount=0;a.distance=0;a.pendingSingleShot=false;a.setDirection();a.setState(state,true);}needsRender=true;
}
function showError(message,params={}){setStatus(message,params);$('progress').hidden=true;$('retry').hidden=false;$('recording').open=true;}
async function fetchModel(url,signal,label){
 const response=await fetch(url,{signal});if(!response.ok)throw Object.assign(new Error('Model download returned HTTP '+response.status),{status:response.status});
 const total=Number(response.headers.get('content-length'));let loaded=0;const chunks=[];
 if(!response.body)return response.arrayBuffer();
 const reader=response.body.getReader();while(true){const {value,done}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;setStatus('Downloading {faction} · {mb} MB',{factionId:label,mb:(loaded/1048576).toFixed(1)});if(total){$('progress').value=Math.min(.95,loaded/total);}}
 const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes.buffer;
}
async function loadFaction(){
 const ticket=++generation;requestController?.abort();requestController=new AbortController();ready=false;for(const actor of actors)actor.dispose();actors.length=0;
 $('retry').hidden=true;$('progress').hidden=false;$('progress').removeAttribute('value');setStatus('Loading {faction}…',{factionId:$('faction').value});
 try{
  const factions=(isReloadCompare()||isBodyCompare())?[$('faction').value,$('faction').value]:isSquad()?Array.from({length:6},(_,i)=>$('comparison').value==='mixed'?(i%2?'Russian':'USMC'):$('faction').value):$('comparison').value==='both'?['USMC','Russian']:[$('faction').value];
  const sources=new Map();
  for(const faction of factions){const info=architecture.factions[faction],url=new URL('./'+info.model,document.baseURI);
   if(!sources.has(faction)){const buffer=await fetchModel(url.href,requestController.signal,faction);const loadedHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');if(loadedHash!==info.asset_sha256)throw Object.assign(new Error('Animation asset version mismatch'),{code:'ASSET_VERSION_MISMATCH'});if(ticket!==generation)return;setStatus('Preparing animated 3D model…');await new Promise(requestAnimationFrame);sources.set(faction,await new GLTFLoader().parseAsync(buffer,new URL('.',url).href));if(ticket!==generation)return;}
   const source=sources.get(faction),extra={actions:{}},version=isReloadCompare()?(actors.length===0?'original':'improved'):$('reload-version').value;const actor=new Actor(faction,{scene:cloneSkeleton(source.scene),animations:source.animations},{...info,clips:{...info.clips,...extra.actions}},(isSquad()||isBodyCompare())?actors[0]:null,version,isBodyCompare()&&actors.length===0?'before':'corrected');actor.calibrate();actor.refreshLabels();actors.push(actor);
  }
  if(isSquad())setupSquad();if(isBodyCompare())setupBodyComparison();for(const a of actors)a.loadedAsset={url:new URL('./'+architecture.factions[a.faction].model,document.baseURI).href,sha256:architecture.factions[a.faction].asset_sha256,revision:architecture.motion_revision};
  restart();ready=true;needsRender=true;last=performance.now();setStatus('Ready · full-body revision verified · {count} soldiers',{count:actors.length});$('progress').hidden=true;
 }catch(error){if(error.name==='AbortError'||ticket!==generation)return;console.error(error);if(error.code==='ASSET_VERSION_MISMATCH'){showError('Animation asset version mismatch. Refresh and retry.');return;}showError('Could not load the 3D preview. Check your connection and tap Retry loading. {detail}',{detail:error.status?'HTTP '+error.status:''});}
}
$('comparison').onchange=()=>{
 const squad=isSquad();$('animation').disabled=isReloadCompare();$('reload-version').disabled=isReloadCompare();if(isReloadCompare()){state='Reload';$('animation').value='Reload';firing=false;updateButtons();}
 $('faction').disabled=['both','mixed'].includes($('comparison').value);$('view').disabled=squad;
 $('panels').classList.toggle('comparison',($('comparison').value==='both'||isReloadCompare()));$('panels').classList.toggle('reload-comparison',isReloadCompare());$('panels').classList.toggle('body-stage',isBodyCompare());$('panels').classList.toggle('squad',squad);
 if(squad){$('view').value='gameplay';$('inspection-tools').hidden=true;updateViewTip();}
 else updateViewTip();
 loadFaction();
};
for(const [id,factor]of [['zoom-in',1.25],['zoom-out',.8]])$(id).onclick=()=>{for(const a of actors){a.camera.zoom=T.MathUtils.clamp(a.camera.zoom*factor,.4,5);a.camera.updateProjectionMatrix();}needsRender=true;};
$('view').onchange=()=>{$('inspection-tools').hidden=$('view').value!=='free';actors.forEach(a=>a.setView());updateViewTip();needsRender=true;};
$('faction').onchange=()=>loadFaction();$('animation').onchange=()=>setState($('animation').value);
$('play').onclick=()=>{manual=false;playing=!playing;last=performance.now();updateButtons();needsRender=true;};
$('restart').onclick=restart;$('fire').onclick=()=>{firing=!firing;updateButtons();needsRender=true;};
$('shot').onclick=()=>{if(!['MovingFire','AimWalk','Aim','Fire'].includes(state))setState('Aim');firing=false;updateButtons();for(const actor of actors){if(aimingUpper(actor.upper?.getClip().name))actor.triggerShot();else actor.pendingSingleShot=true;}needsRender=true;};
$('direction').onchange=()=>{actors.forEach(a=>a.setDirection());needsRender=true;};$('height').onchange=()=>{if(isSquad())sizeSquad();actors.forEach(a=>{a.resize();a.probe?.reset();});needsRender=true;};$('retry').onclick=loadFaction;
addEventListener('resize',()=>{actors.forEach(a=>{a.resize();a.probe?.reset();});needsRender=true;});document.addEventListener('visibilitychange',()=>{last=performance.now();needsRender=true;});
let last=performance.now();function tick(now){const dt=playing?Math.min((now-last)/1000,.1)*Number($('speed').value):0;last=now;if(ready&&!manual&&!document.hidden&&(playing||needsRender)){clock+=dt;for(const actor of actors)actor.update(dt);for(const actor of actors)actor.render();needsRender=false;if(playing&&state==='Reload'&&$('reload-repeat').checked&&actors.every(a=>aimingUpper(a.upper?.getClip().name))&&clock>Math.max(...actors.map(a=>a.clips.get(a.reloadVersion==='original'?'Reload':a.motionVersion==='corrected'?'FB_Reload_Upper':'Reload_Tactical').duration))+.6)restart();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
async function init(){
 try{
  const response=await fetch('./architecture.json',{cache:'no-store'});if(!response.ok)throw Object.assign(new Error('Animation manifest returned HTTP '+response.status),{status:response.status});architecture=await response.json();
  for(const name of Object.keys(architecture.factions.USMC.clips))$('clip-options').append(new Option(clipLabel(name),'clip:'+name));

  applyReloadReviewLink();applyLanguage();await loadFaction();
  window.animationPreview={actors,setState,restart,loadFaction,get ready(){return ready;},get time(){return clock;},get firing(){return firing;},pause(){playing=false;manual=true;updateButtons();},step(dt,render=true){clock+=dt;for(const actor of actors)actor.update(dt);if(render)for(const actor of actors)actor.render();},diagnosticReport(){return clientDiagnosticReport();},snapshot(){return actors.map(a=>({faction:a.faction,lower:a.lower?.getClip().name,upper:a.upper?.getClip().name,gaitTime:a.lower?.time,shots:a.shotCount,distance:a.distance,clips:[...a.clips.keys()],webgl:a.renderer.getContext().getParameter(a.renderer.getContext().VERSION)}));}};
 }catch(error){console.error(error);showError('Unable to initialize preview. Refresh the page and check your connection. {detail}',{detail:error.status?'HTTP '+error.status:''});}
}
export function applyReloadReviewLink(search=globalThis.location?.search||''){
 const query=new URLSearchParams(search);if(!['reload','body'].includes(query.get('review')))return false;
 if(query.get('review')==='body'){$('comparison').value='body';state=Object.hasOwn(states,query.get('state'))?query.get('state'):'Walk';$('animation').value=state;firing=state==='MovingFire'||state==='Fire';$('animation').disabled=false;$('reload-version').disabled=false;$('panels').classList.add('body-stage');const f=query.get('faction');if(['USMC','Russian'].includes(f))$('faction').value=f;if(['side','gameplay','free'].includes(query.get('view')))$('view').value=query.get('view');if(query.get('markers')==='1')$('body-markers').checked=true;return true;}
 $('comparison').value='reload';$('animation').value='Reload';state='Reload';firing=false;
 $('animation').disabled=true;$('reload-version').disabled=true;$('panels').classList.add('comparison','reload-comparison');
 $('view').value='gameplay';$('view').disabled=false;$('faction').disabled=false;$('inspection-tools').hidden=true;
 const faction=query.get('faction');if(['USMC','Russian'].includes(faction))$('faction').value=faction;
 const speed=query.get('speed');if(['0.25','0.5','1','1.5','2'].includes(speed))$('speed').value=speed;
 return true;
}
let statusKey='Loading animation data…',statusParams={};
function setStatus(key,params={}){statusKey=key;statusParams=params;$('status').textContent=t(key,{...params,faction:params.factionId?t(params.factionId):params.faction});}
function updateViewTip(){$('view-tip').textContent=t(isSquad()?'Fixed 30° squad view · in-place gait review · road and cover provide scale. Scroll the page to see the whole scene.':$('view').value==='free'?'Drag to rotate. Pinch or scroll to zoom.':'Orthographic gameplay camera · fixed gameplay framing. Side view follows the selected facing.');}
function applyLanguage(){setLanguage($('language').value);translateDocument();for(const option of $('clip-options').options||$('clip-options').children)option.textContent=clipLabel(option.value.slice(5));updateButtons();setStatus(statusKey,statusParams);updateViewTip();for(const a of actors)a.refreshLabels();updateRecordingStatus();needsRender=true;}
let recordingNameKey='',recordingError=false;
function updateRecordingStatus(){$('reload-video-status').textContent=recordingError?t('Tap the video play button if playback does not start.'):recordingNameKey?t('Selected recording: {name}',{name:t(recordingNameKey)}):'';}
for(const button of document.querySelectorAll('[data-reload-video]'))button.onclick=()=>{recordingNameKey=button.getAttribute('data-i18n');recordingError=false;const video=$('reload-video');video.src=new URL('./reload/'+button.getAttribute('data-reload-video'),document.baseURI).href;video.load();video.play().catch(()=>{recordingError=true;updateRecordingStatus();});updateRecordingStatus();};
$('language').onchange=applyLanguage;
$('reload-version').onchange=()=>{for(const a of actors)a.reloadVersion=$('reload-version').value;setState('Reload',true);restart();};
for(const [id,speed]of [['reload-normal','1'],['reload-slow','0.5']])$(id).onclick=()=>{$('speed').value=speed;setState('Reload',true);restart();manual=false;playing=true;updateButtons();};
applyLanguage();init();

$('body-markers').onchange=()=>{for(const a of actors)a.probe?.setVisible($('body-markers').checked);needsRender=true;};
function clientDiagnosticReport(){return {revision:architecture?.motion_revision,url:globalThis.location?.href,state,view:$('view').value,direction:$('direction').value,height:Number($('height').value),playing,sampled_in_browser:true,visual_quality_automatically_verified:false,actors:actors.map(a=>({faction:a.faction,profile:a.motionVersion,asset:a.loadedAsset,camera:{orthographic:a.camera.isOrthographicCamera,position:a.camera.position.toArray(),zoom:a.camera.zoom},lower:a.lower?.getClip().name,upper:a.upper?.getClip().name,gait_phase:a.lower?.time/a.lower?.getClip().duration,shots:a.shotCount,webgl_error:a.renderer.getContext().getError(),probe:a.probe?.summary(),tracks:probeTrackInventory(a)}))};}
function probeTrackInventory(a){const names=['root','pelvis.L','pelvis.R','spine05','spine04','spine03','spine02','spine01','clavicle.L','clavicle.R','shoulder01.L','shoulder01.R','neck01','head'];return Object.fromEntries(names.map(n=>[n,{lower:a.lower?.getClip().tracks.filter(x=>x.name.startsWith(T.PropertyBinding.sanitizeNodeName(n)+'.')).map(x=>x.name),upper:a.upper?.getClip().tracks.filter(x=>x.name.startsWith(T.PropertyBinding.sanitizeNodeName(n)+'.')).map(x=>x.name)}]));}
$('download-body-report').onclick=()=>{const report=clientDiagnosticReport();const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='infantry-body-diagnostic.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('body-live-status').textContent=t('Client diagnostic saved · {frames} rendered samples',{frames:actors.reduce((n,a)=>n+(a.probe?.renderedFrames||0),0)});};
$('body-recording-select').onchange=()=>{const video=$('body-recording-video');video.src=new URL('./body-review/'+$('body-recording-select').value+'.mp4',document.baseURI).href;video.poster=new URL('./body-review/'+$('body-recording-select').value+'.png',document.baseURI).href;video.load();video.play().catch(()=>{$('body-video-status').textContent=t('Tap the video play button if playback does not start.');});};
$('body-recording-video').onerror=()=>{$('body-video-status').textContent=t('The comparison video could not load. Check your connection and retry.');};
