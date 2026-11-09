import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {makeRecoilActions} from './motion-system.js';
// The lower and upper masks are composed in 3D before baking. Shot frames sample
// additive recoil at the SAME gait phase; switching them never resets the feet.
const sequences={
 Idle:['Lower_Idle','FB_LowReady_Upper',4],
 Aim:['Lower_AimStance','FB_AimIdle_Upper',4],
 Walk:['FB_Walk_Lower','FB_Walk_Upper',16],
 Sprint:['SR_Sprint_Lower','SR_Sprint_Upper',16],
 OldSprint:['FB_Sprint_Lower','FB_Sprint_Upper',16],
 AimWalk:['FB_AimWalk_Lower','FB_AimWalk_Upper',16],
 MovingFire:['FB_AimWalk_Lower','FB_AimWalk_Upper',16,'recoil'],
 Fire:['Lower_AimStance','FB_AimIdle_Upper',4,'recoil'],
 Reload:['FB_Reload_Lower','FB_Reload_Upper',32,'once'],
 Raise:['Lower_AimStance','Weapon_Raise',8,'once'],
 Stop:['Stop_Walk','FB_LowReady_Upper',8,'once'],
 TurnLeft:['Turn_Left','Upper_Turn_Left',8,'once'],
 TurnRight:['Turn_Right','Upper_Turn_Right',8,'once'],
};
const width=80,height=96,cols=16;
window.bakeFaction=async (faction,lmg=false,anchorsOnly=false)=>{
 const gltf=await new GLTFLoader().loadAsync(`/assets-3d/sprint-rebuild/models/${faction}_SprintReview.glb`);
 const model=gltf.scene,scene=new T.Scene();scene.add(model);
 if(lmg)for(const name of ["Weapon","Magazine","SpareMagazine"])model.getObjectByName(name).visible=false;
 scene.add(new T.HemisphereLight(0xc4d8ee,0x434232,1.2));
 for(const [pos,power,color] of [[[-3,6,4],2.4,0xebefff],[[4,5,-2],1.5,0xd1e3ff],[[-2,4,-4],1.6,0xf2e5d1]]){const l=new T.DirectionalLight(color,power);l.position.set(...pos);scene.add(l);}
 const camera=new T.OrthographicCamera(-4/3,4/3,1.6,-1.6,.01,100);
 camera.position.set(6,4.899+1.05,6);camera.lookAt(0,1.05,0);camera.updateMatrixWorld();
 const frameCount=Object.values(sequences).reduce((n,s)=>n+(lmg?Math.max(4,s[2]/2):s[2]),0),rows=Math.ceil(frameCount/cols);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(cols*width,rows*height);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.setClearColor(0,0);
 const mixer=new T.AnimationMixer(model),clips=new Map(gltf.animations.map(c=>[c.name,c]));
 const recoil=makeRecoilActions(mixer,clips,true)[0];
 const anchor=new T.Vector3(0,0,0).project(camera);
 const manifest={faction,weapon:faction==='USMC'?'M16A4':'AK-74M',width,height,cols,rows,standingHeight:1.8*Math.cos(Math.PI/6)/3.2*height,anchor:[(anchor.x+1)*width/2,(1-anchor.y)*height/2],sequences:{},sheets:[],muzzles:[],grips:[]};
 const sheets=[];
 for(let heading=0;heading<8;heading++){
  model.rotation.y=Math.PI/2-heading*Math.PI/4;
  const muzzleFrames=[],gripFrames=[];
  const canvas=document.createElement('canvas');canvas.width=cols*width;canvas.height=rows*height;const ctx=canvas.getContext('2d');let offset=0;
  renderer.autoClear=false;renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
  for(const [name,[lo,up,originalCount,kind]] of Object.entries(sequences)){
   const count=lmg?Math.max(4,originalCount/2):originalCount;
   mixer.stopAllAction();
   const lower=mixer.clipAction(clips.get(lo)).reset().play(),upper=mixer.clipAction(clips.get(up)).reset().play();
   const duration=kind==='once'?clips.get(up==='FB_LowReady_Upper'?lo:up).duration:clips.get(lo).duration;
   if(kind==='recoil')recoil.reset().play();
   manifest.sequences[name]={offset,count,duration,lower:lo,upper:up,loop:kind!=='once'};
   for(let frame=0;frame<count;frame++){
    const t=duration*frame/(kind==='once'?count-1:count);
    lower.time=Math.min(t,clips.get(lo).duration-.0001);upper.time=kind==='once'?Math.min(t,clips.get(up).duration-.0001):t/clips.get(lo).duration*clips.get(up).duration;
    if(kind==='recoil')recoil.time=.055;
    model.rotation.y=Math.PI/2-heading*Math.PI/4;
    if(name==='TurnLeft'||name==='TurnRight')model.rotation.y-=(name==='TurnLeft'?1:-1)*Math.PI/4*t/duration;
    mixer.update(0);model.updateMatrixWorld(true);
    if(anchorsOnly){
      const weapon=model.getObjectByName('Weapon'),positions=weapon.geometry.attributes.position;
      const forward=new T.Vector3(Math.sin(model.rotation.y),0,Math.cos(model.rotation.y));
      let max=-Infinity,tip=new T.Vector3();
      for(let v=0;v<positions.count;v++){const point=new T.Vector3().fromBufferAttribute(positions,v).applyMatrix4(weapon.matrixWorld),d=point.dot(forward);if(d>max){max=d;tip.copy(point);}}
      tip.project(camera);const grip=weapon.getWorldPosition(new T.Vector3()).project(camera);
      muzzleFrames.push([(tip.x+1)*width/2,(1-tip.y)*height/2]);gripFrames.push([(grip.x+1)*width/2,(1-grip.y)*height/2]);
    }else {
      const index=offset+frame,x=index%cols*width,y=(rows-1-Math.floor(index/cols))*height;
      renderer.setViewport(x,y,width,height);renderer.setScissor(x,y,width,height);renderer.clear();renderer.render(scene,camera);
    }
   }
   offset+=count;
  }
  if(!anchorsOnly){ctx.drawImage(renderer.domElement,0,0);sheets.push(canvas.toDataURL('image/png').split(',')[1]);}
  manifest.muzzles.push(muzzleFrames);manifest.grips.push(gripFrames);
  manifest.sheets.push(`${faction}${lmg?"-LMG":""}-${heading}.png`);
 }
 renderer.dispose();return {manifest,sheets};
};
window.bakerReady=true;
