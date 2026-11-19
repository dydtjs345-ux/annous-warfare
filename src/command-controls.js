import { assignRoute, cancelRoute, setFireMode, setProfile, validateRoute, profiles } from './path-command.js';
import './command-controls.css';

export class CommandControls {
  constructor(scene) {
    this.scene=scene;this.mode='pan';this.draft=null;this.message='';
    this.lines=scene.add.graphics().setDepth(999998);
    this.labels=Array.from({length:6},(_,i)=>scene.add.text(0,0,String(i+1),{fontSize:'13px',fontFamily:'system-ui',color:'#fff0bd',backgroundColor:'#172833dd',padding:{x:4,y:2}}).setOrigin(.5,1).setDepth(999999));
    this.buttons=Array.from({length:6},(_,i)=>{
      const b=document.createElement('button');b.dataset.soldier=String(i);
      b.onclick=()=>this.select(scene.battle.units[i]);
      document.querySelector('#soldier-strip').append(b);return b;
    });
    document.querySelector('#draw-route').onclick=()=>{this.abort();this.error=false;this.mode='draw';this.message='병사에서 시작하는 경로를 그리세요 · 놓으면 확정';this.refresh();};
    document.querySelector('#pan-map').onclick=()=>{this.abort();this.error=false;this.mode='pan';this.message='드래그: 지도 이동 · 탭: 병사 선택 · 두 손가락: 확대';this.refresh();};
    document.querySelector('#cancel-route').onclick=()=>{this.abort();cancelRoute(scene.selected);this.message='이동 경로를 취소했습니다';this.refresh();};
    document.querySelector('#fire-mode').onclick=()=>{const u=scene.selected;setFireMode(u,u.command.fire==='hold'?'free':'hold');this.message='';this.refresh();};
    document.querySelector('#movement-mode').onchange=e=>{setProfile(scene.selected,e.target.value);this.message='';this.refresh();};
    document.querySelector('#center-unit').onclick=()=>{scene.viewMode='Free';const p=scene.iso(scene.selected.x,scene.selected.y);scene.cameras.main.centerOn(p.x,p.y);};
    document.querySelector('#command-restart').onclick=()=>{scene.seed=(scene.seed+1)>>>0;scene.newMatch();this.reset();};
    this.onCancel=()=>{if(this.draft){this.abort();this.message='그리기 취소 · 기존 경로 유지';this.refresh();}};
    scene.game.canvas.addEventListener('touchcancel',this.onCancel,true);
    window.addEventListener('blur',this.onCancel);
    document.addEventListener('visibilitychange',this.onCancel);
    scene.input.on('pointerupoutside',this.onCancel);
    scene.events.once('shutdown',()=>{
      window.removeEventListener('blur',this.onCancel);
      document.removeEventListener('visibilitychange',this.onCancel);
      scene.game.canvas.removeEventListener('touchcancel',this.onCancel,true);
    });
    this.reset();
  }
  reset(){this.abort();this.error=false;this.mode='pan';this.message='';this.scene.selected=this.scene.battle.units[0];this.refresh();}
  abort(){this.draft=null;this.scene.down=null;}
  select(u){if(u.team!==0)return;this.abort();this.scene.selected=u;this.message='';this.refresh();}
  grid(p){const s=this.scene,w=s.cameras.main.getWorldPoint(p.x,p.y);return s.geometry.inverse(w.x,w.y);}
  down(p){
    if(this.scene.input.manager.pointers.filter(p=>p.isDown).length>1){
      this.abort();this.error=false;this.mode='pan';this.message='확대 조작 · 기존 경로 유지';this.refresh();return false;
    }
    if(this.mode!=='draw')return false;
    this.scene.viewMode='Free';this.draft={id:p.id,unit:this.scene.selected,points:[this.grid(p)]};return true;
  }
  move(p){
    if(this.mode!=='draw')return false;
    if(this.draft&&p.id===this.draft.id&&p.isDown){
      const next=this.grid(p),points=this.draft.points,last=points[points.length-1];
      if(Math.hypot(next.x-last.x,next.y-last.y)>.025){
        if(points.length<2048)points.push(next);else this.draft.overflow=true;
      }
    }
    return true;
  }
  up(p){
    if(this.mode!=='draw')return false;
    if(!this.draft||this.draft.id!==p.id)return true;
    const d=this.draft,points=[...d.points,this.grid(p)];
    const result=d.overflow?{ok:false,reason:'경로가 너무 깁니다 · 나누어 그려 주세요'}:assignRoute(this.scene.battle,d.unit,points);
    this.message=result.ok?'경로 확정 · 실시간 이동 중':`${result.reason} · 기존 경로 유지`;
    this.error=!result.ok;this.messageUntil=result.ok?this.scene.time.now+2500:Infinity;this.draft=null;this.scene.down=null;
    if(result.ok)this.mode='pan';this.refresh();return true;
  }
  refresh(){
    const s=this.scene,u=s.selected??s.battle.units[0],c=u.command;
    for(let i=0;i<6;i++){
      const a=s.battle.units[i],button=this.buttons[i];
      button.textContent=`${i+1} ${['분대장','소총','소총','소총','기관총','의무'][i]}`;
      button.classList.toggle('active',a===u);button.classList.toggle('unavailable',!a.active);
      button.setAttribute('aria-pressed',String(a===u));
      button.title=`${i+1}번 · ${a.command.status} · ${a.command.fire==='hold'?'사격 금지':'자율 사격'}`;
      button.dataset.fire=a.command.fire;
    }
    document.querySelector('#draw-route').setAttribute('aria-pressed',String(this.mode==='draw'));
    document.querySelector('#pan-map').setAttribute('aria-pressed',String(this.mode==='pan'));
    const fire=document.querySelector('#fire-mode');
    fire.textContent=c.fire==='hold'?'사격 금지':'자율 사격';
    fire.setAttribute('aria-pressed',String(c.fire==='free'));fire.classList.toggle('hold-fire',c.fire==='hold');
    document.querySelector('#movement-mode').value=c.profile;
    document.querySelector('#draw-route').disabled=!u.active||!!s.battle.result;
    const status=document.querySelector('#command-status');
    if(!this.draft && this.messageUntil && s.time.now>this.messageUntil)this.message='';
    const detail=`${u.command.status} · 탄 ${u.ammo}/${u.reserve}${u.visibleEnemies?.length?' · 적 발견 '+u.visibleEnemies.length:''}${this.message?' · '+this.message:''}`;
    const value=`${u.id+1}번 · ${profiles[c.profile].label} · ${detail}`;
    if(status.textContent!==value)status.textContent=value;
    status.classList.toggle('invalid',!!this.message&&this.error);
  }
  draw(){
    const s=this.scene,g=this.lines,zoom=s.cameras.main.zoom;g.clear();
    const line=(origin,points,color,alpha,width)=>{
      if(!points.length)return;
      g.lineStyle(width/zoom,color,alpha);let p=s.iso(origin.x,origin.y);g.beginPath();g.moveTo(p.x,p.y);
      for(const n of points){p=s.iso(n.x,n.y);g.lineTo(p.x,p.y);}g.strokePath();
      g.strokeCircle(p.x,p.y,6/zoom);g.fillStyle(color,alpha);g.fillCircle(p.x,p.y,2/zoom);
    };
    for(const u of s.battle.units.filter(u=>u.command)){
      const selected=u===s.selected;
      line(u,u.command.route,selected?0xffdd8e:0x72cbbd,selected?.95:.35,selected?3:1.5);
      const p=s.iso(u.x,u.y),label=this.labels[u.id];
      label.setPosition(p.x,p.y-42).setScale(1/Math.max(.65,zoom)).setAlpha(u.active?1:.45);
      if(selected){g.lineStyle(2/zoom,0xffdd8e,1);g.strokeEllipse(p.x,p.y,32,16);}
    }
    if(this.draft){const d=this.draft,valid=!d.overflow&&validateRoute(d.unit,d.points).ok;
      line(d.unit,d.points,valid?0x8ceac5:0xff817b,.95,3);
      this.message=valid?'놓으면 경로 확정 · 전투는 계속 진행 중':'장애물 또는 경계 — 놓으면 거절 · 기존 경로 유지';this.error=!valid;
    }
    if(s.time.now>(this.nextUI??0)){this.nextUI=s.time.now+100;this.refresh();}
  }
}
