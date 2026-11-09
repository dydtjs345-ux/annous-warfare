import {observeInfantry} from './state.js';
const base=(import.meta.env.BASE_URL||'/')+'assets/infantry-test/';
export function preloadInfantry(scene){
 scene.load.json('infantry-manifest',base+'manifest.json');
 for(const faction of ['USMC','Russian','USMC-LMG','Russian-LMG'])for(let h=0;h<8;h++)scene.load.spritesheet(`infantry-${faction}-${h}`,base+`${faction}-${h}.webp`,{frameWidth:80,frameHeight:96});
}
export class InfantryRenderer{
 constructor(scene){this.scene=scene;this.manifest=scene.cache.json.get('infantry-manifest');this.records=[];this.states=[];this.images=[];this.ghosts=[];this.previous=[];this.anchors=new Map();this.enabled=true;this.sprint='new';this.frames=[];this.loadMs=performance.now();}
 update(b,models,effects,motion,clock,delta){
  if(this.battle!==b){this.battle=b;this.records=b.units.map(()=>({}));this.anchors.clear();this.previous=[];}
  this.frames.push(delta);if(this.frames.length>240)this.frames.shift();
  this.states=b.units.map(u=>observeInfantry(b,u,models[u.id],effects[u.id],motion.position(u),clock,this.records[u.id],this.sprint));
  this.images.forEach(i=>i?.setVisible(false));this.ghosts.forEach(i=>i?.setVisible(false));
 }
 draw(g,b,u,m,fx,p,view,selected){
  const state=this.states[u.id];if(!state)return false;
  if(!this.enabled){state.visible=false;state.fallback='manual low-memory renderer';return false;}
  if(state.fallback || u.role==='LMG' && state.animation==='Reload'){state.visible=false;if(u.role==='LMG')state.fallback='LMG reload source unavailable';return false;}
  const faction=u.team?'Russian':'USMC',variant=faction+(u.role==='LMG'?'-LMG':''),meta=this.manifest?.factions[variant],seq=meta?.sequences[state.animation],key=`infantry-${variant}-${state.direction}`;
  if(!seq||!this.scene.textures.exists(key)){state.fallback='asset load failed';return false;}
  const frame=seq.offset+Math.min(seq.count-1,Math.floor(state.phase*seq.count));
  let image=this.images[u.id];if(!image)image=this.images[u.id]=this.scene.add.image(0,0,key).setOrigin(meta.anchor[0]/80,meta.anchor[1]/96);
  g.setDepth((view.x+view.y)*100+.04);
  const scale=39/meta.standingHeight;
  const previous=this.previous[u.id],clock=this.scene.visuals.clock;
  const group=state.animation==='MovingFire'?'AimWalk':state.animation==='Fire'?'Aim':state.animation;
  if(previous && (previous.group!==group || previous.key!==key)){
    let ghost=this.ghosts[u.id];if(!ghost)ghost=this.ghosts[u.id]=this.scene.add.image(0,0,previous.key).setOrigin(meta.anchor[0]/80,meta.anchor[1]/96);
    ghost.setTexture(previous.key,previous.frame);previous.until=clock+.1;
  }
  const ghost=this.ghosts[u.id],until=previous?.until??0,blend=Math.max(0,Math.min(1,1-(until-clock)/.1));
  if(ghost&&blend<1)ghost.setPosition(p.x,p.y).setScale(scale).setDepth((view.x+view.y)*100+.02).setAlpha(1-blend).setVisible(true);
  this.previous[u.id]={key,group,frame,until};
  image.setTexture(key,frame).setScale(scale).setPosition(p.x,p.y).setDepth((view.x+view.y)*100+.03).setAlpha(blend).setVisible(true);
  if(state.shot && ['Fire','MovingFire'].includes(state.animation)){
    // The two baked compositions have identical lower-body phase. Blend only
    // their recoil difference using the REAL event's decaying effect timer.
    const baseline=meta.sequences[state.animation==='MovingFire'?'AimWalk':'Aim'];
    const baseFrame=baseline.offset+Math.min(baseline.count-1,Math.floor(state.phase*baseline.count));
    let baseImage=this.ghosts[u.id];if(!baseImage)baseImage=this.ghosts[u.id]=this.scene.add.image(0,0,key).setOrigin(meta.anchor[0]/80,meta.anchor[1]/96);
    const kick=Math.min(1,fx.shot/Math.max(.035,.1/this.scene.speed));
    baseImage.setTexture(key,baseFrame).setScale(scale).setPosition(p.x,p.y).setDepth((view.x+view.y)*100+.02).setAlpha(1-kick).setVisible(true);
    image.setAlpha(kick);
  }
  // Do not change the ground anchor when headings, clips or posture change.
  g.fillStyle(0x000000,.3);g.fillEllipse(p.x+2,p.y+2,20,7);
  if(selected){g.lineStyle(1,0xf2dba0);g.strokeEllipse(p.x,p.y+1,25,11);}
  const dx=(Math.cos(state.heading)-Math.sin(state.heading))*11,dy=(Math.cos(state.heading)+Math.sin(state.heading))*5.5;
  const point=meta.muzzles?.[state.direction]?.[frame],hand=meta.grips?.[state.direction]?.[frame];
  const muzzle=point?{x:p.x+(point[0]-meta.anchor[0])*scale,y:p.y+(point[1]-meta.anchor[1])*scale}:{x:p.x+dx,y:p.y-23+dy};
  const grip=hand?{x:p.x+(hand[0]-meta.anchor[0])*scale,y:p.y+(hand[1]-meta.anchor[1])*scale}:{x:p.x+dx*.25,y:p.y-23+dy*.25};
  if(u.role==='LMG'){
    // Retain the game's existing generic LMG silhouette on the new weaponless
    // faction body. No unsupported M249/PKM model or reload is claimed.
    const dx=(Math.cos(state.heading)-Math.sin(state.heading)),dy=(Math.cos(state.heading)+Math.sin(state.heading))*.5;
    const handY=p.y-23;
    muzzle.x=p.x+dx*17;muzzle.y=handY+dy*17;
    g.lineStyle(4,0x15212c);g.lineBetween(p.x,handY,p.x+dx*17,handY+dy*17);
    g.lineStyle(1,0xa5ada4);g.lineBetween(p.x+dx*5,handY+dy*5,p.x+dx*15,handY+dy*15);
    g.fillStyle(u.team?0x495749:0x384e59);g.fillRect(p.x+dx*6-2,handY+dy*6+1,5,5);
    state.weapon='existing generic LMG overlay';
  }
  if(state.shot){g.fillStyle(0xffe4a3,.95);g.fillCircle(muzzle.x,muzzle.y,1.8);for(const e of b.events)if(e.type==='shot'&&e.unitId===u.id&&!this.anchors.has(e.id))this.anchors.set(e.id,{muzzle:{...muzzle},grip:{...grip}});}
  while(this.anchors.size>96)this.anchors.delete(this.anchors.keys().next().value);
  if(u.suppression>.1){g.lineStyle(1,0xf3c875,.3+.6*u.suppression);g.strokeEllipse(p.x,p.y+2,25,12);}
  if(fx.hit>0)image.setTint(0xffb3a0);else image.clearTint();
  Object.assign(state,{visible:true,faction,frame,texture:key,scale,muzzle,grip});return true;
 }
 shotAnchor(id){return this.anchors.get(id)??null;}
 snapshot(){const sorted=this.frames.slice().sort((a,b)=>a-b),sum=this.frames.reduce((a,b)=>a+b,0);return {method:'pre-rendered isometric GLB atlases',enabled:this.enabled,sprint:this.sprint,loadMs:this.loadMs,fps:sum?1000*this.frames.length/sum:0,p95FrameMs:sorted[Math.floor(sorted.length*.95)]??0,units:this.states.map(s=>({...s})),sourceHashes:this.manifest?.sourceHashes};}
}
