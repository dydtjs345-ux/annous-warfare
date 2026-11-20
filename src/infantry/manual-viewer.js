import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Phase2Animator} from '../../assets-3d/phase2-crouch/preview/controller.js';
import {catalog,labels} from '../../assets-3d/phase2-crouch/preview/catalog.js';
import {CoverAnimator} from '../../assets-3d/cover-combat-integration/preview/controller.js';
import coverCatalog from '../../assets-3d/cover-combat-integration/validation/catalog.json';
import contact from '../../assets-3d/phase2-crouch/validation/skin-bindings.json';
const root=import.meta.env.BASE_URL+'inspection/';
const additions={Start:{clips:['Start_Walk','FB_Walk_Upper'],oneShot:['Start_Walk','FB_Walk_Upper'],next:'Walk',grip:false},Stop:{clips:['Stop_Walk','FB_LowReady_Upper'],oneShot:['Stop_Walk','FB_LowReady_Upper'],next:'Idle',grip:false},TurnLeft:{clips:['Turn_Left','Upper_Turn_Left'],oneShot:['Turn_Left','Upper_Turn_Left'],next:'Idle',grip:false},TurnRight:{clips:['Turn_Right','Upper_Turn_Right'],oneShot:['Turn_Right','Upper_Turn_Right'],next:'Idle',grip:false}};
for(const profile of ['USMC','Russian']){Object.assign(catalog[profile],additions);for(const [name,next]of Object.entries({IdleToSprint:'TacticalSprint',WalkToSprint:'TacticalSprint',SprintToWalk:'Walk',SprintToStop:'Idle'}))catalog[profile][name]={clips:['SR_'+name+'_Lower','SR_'+name+'_Upper'],oneShot:['SR_'+name+'_Lower','SR_'+name+'_Upper'],next,grip:false,quality:'보존 SR 전환 · 검토 후보 · 수동 전용'};}
export function options(profile){if(profile.startsWith('Cover'))return Object.entries(coverCatalog).filter(([k,v])=>v.weapon===(profile==='CoverAK'?'AK74M':'M16A4')&&!/Blind/.test(k)).map(([k,v])=>[k,`${v.stance} ${v.state} · 후보 · 수동 전용`]);return Object.keys(catalog[profile]).map(k=>[k,`${labels[k]||k} · ${catalog[profile][k].quality||'기존 검증 클립'}`]);}
export async function openViewer(host,profile){
 const loader=new GLTFLoader(),cover=profile.startsWith('Cover'),kind=profile==='CoverAK'?'AK74M':'M16A4',paths=cover?['TacticalSuit_Cover.glb',kind+'_Cover.animation.glb']:profile==='TacticalSuit'?['TacticalSuit_Phase2.glb']:[profile+'_Tactical.glb',profile+'_CrawlForward.animation.glb'];
 const loaded=await Promise.all(paths.map(p=>loader.loadAsync(root+p)));if(!cover&&profile!=='TacticalSuit')for(const c of loaded[1].animations)c.name=c.name.replace('TC_','REC_');
 const model=loaded[0].scene,clips=loaded.flatMap(g=>g.animations),scene=new T.Scene();scene.background=new T.Color('#34444f');scene.add(model);
 scene.add(new T.HemisphereLight(0xd9efff,0x4d493d,2));for(const xyz of [[-3,6,4],[4,5,-2]]){const l=new T.DirectionalLight(0xf1f1e4,2);l.position.set(...xyz);scene.add(l);}
 const grid=new T.GridHelper(12,12);scene.add(grid);const props=new T.Group();scene.add(props);function fixtures(spec){props.clear();if(!cover)return;const boxes=spec.style==='Corner'?[[-.82,1.05,1.01,1.64,2.1,.22]]:[[0,(spec.stance==='Crouch'?.9:1.14)/2,1.01,2.4,spec.stance==='Crouch'?.9:1.14,.22]];for(const [x,y,z,w,h,d]of boxes){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:0x697b82}));m.position.set(x,y,z);props.add(m);}}
 const anim=cover?new CoverAnimator(model,clips,coverCatalog,contact):new Phase2Animator(model,clips,profile,contact);if(cover)anim.configure(kind,'Stand');
 const camera=new T.OrthographicCamera(-2,2,1.6,-1.6,.01,100);camera.position.set(4,3.9,4);camera.lookAt(0,1,0);
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;host.replaceChildren(renderer.domElement);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,0);
 host.dataset.profile=profile;host.dataset.renderedFrames='0';let stopped=false,last=performance.now(),raf,paint=0;
 const resize=()=>{const w=host.clientWidth||340,h=host.clientHeight||260;renderer.setSize(w,h,false);camera.left=-1.6*w/h;camera.right=1.6*w/h;camera.updateProjectionMatrix();};resize();
 function frame(now){if(stopped)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(!document.hidden){anim.update(dt);controls.update();if(now-paint>33){renderer.render(scene,camera);host.dataset.renderedFrames=String(Number(host.dataset.renderedFrames)+1);paint=now;}}raf=requestAnimationFrame(frame);}raf=requestAnimationFrame(frame);
 const observer=new ResizeObserver(resize);observer.observe(host);
 return {resize,select(key){host.dataset.state=key;if(cover){const spec=coverCatalog[key];if(!spec||/Blind/.test(key)||spec.weapon!==kind)return false;props.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});fixtures(spec);anim.configure(kind,spec.stance);return anim.setState(spec.state,true);}return anim.setState(key);},snapshot:()=>anim.snapshot(),dispose(){if(stopped)return;stopped=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();anim.mixer.stopAllAction();anim.mixer.uncacheRoot(model);scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){for(const x of Object.values(m))if(x?.isTexture)x.dispose();m.dispose();}});renderer.dispose();renderer.forceContextLoss();host.replaceChildren();}};
}
