// Player routes never enter BFS, cover selection, squad assignments or evasion.
import { blocked, traceRay, sight } from './world.js';
import { selectEnemy } from './intelligence.js';

export const profiles = Object.freeze({
  stealth: { label: '은닉', speed: .72, accuracy: .7 },
  recon: { label: '정찰', speed: 1.05, accuracy: .65 },
  combat: { label: '전투', speed: 1.45, accuracy: .55 },
  sprint: { label: '전력질주', speed: 2.8, accuracy: 0 },
});
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const angleDelta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
const turn = (a,b,dt) => a + Math.max(-3*dt,Math.min(3*dt,angleDelta(a,b)));
const point = p => ({x:p.x,y:p.y});
const RADIUS = .22;
export function segmentClear(a,b) {
  // Conservative square body sweep; includes corner-touching cells and bounds.
  return [[0,0],[-RADIUS,-RADIUS],[-RADIUS,RADIUS],[RADIUS,-RADIUS],[RADIUS,RADIUS]]
    .every(([x,y]) => traceRay({x:a.x+x,y:a.y+y},{x:b.x+x,y:b.y+y},(cx,cy)=>!blocked(cx,cy)));
}
function lineDistance(p,a,b) {
  const d=(b.x-a.x)**2+(b.y-a.y)**2;
  const t=d?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d)):0;
  return distance(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});
}
export function simplify(points,tolerance=.08) {
  // Iterative RDP avoids recursion overflow on long touch strokes.
  if(points.length<3)return points.map(point);
  const keep=new Set([0,points.length-1]), stack=[[0,points.length-1]];
  while(stack.length){
    const [a,b]=stack.pop();let worst=tolerance,index=-1;
    for(let i=a+1;i<b;i++){const d=lineDistance(points[i],points[a],points[b]);if(d>worst){worst=d;index=i;}}
    if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}
  }
  return [...keep].sort((a,b)=>a-b).map(i=>point(points[i]));
}
export function validateRoute(origin,stroke) {
  if(!Array.isArray(stroke)||stroke.length>2048||!stroke.length)return {ok:false,reason:'경로를 그려 주세요 (최대 2048점)'};
  if(stroke.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return {ok:false,reason:'잘못된 경로 좌표'};
  const raw=[point(origin),...stroke.map(point)];
  for(let i=1;i<raw.length;i++)if(!segmentClear(raw[i-1],raw[i]))return {ok:false,reason:'장애물 또는 지도 경계 — 경로를 다시 그려 주세요',segment:i-1,points:raw};
  const reduced=simplify(raw);
  // Never turn a valid corner into an obstacle-cutting shortcut.
  const safe=reduced.every((p,i)=>!i||segmentClear(reduced[i-1],p))?reduced:raw;
  const route=safe.slice(1).filter((p,i)=>distance(p,safe[i])>1e-6);
  if(!route.length)return {ok:false,reason:'이동할 경로가 없습니다'};
  return {ok:true,points:safe,route};
}
export function initializeCommands(b) {
  if(!b.playerCommands)return;
  for(const u of b.units.filter(u=>u.team===0)) {
    u.command={route:[],fire:'free',profile:'combat',status:'명령 대기',revision:0};
    u.bodyHeading=u.facing;u.observationHeading=u.facing;u.movementHeading=u.facing;
  }
}
export function assignRoute(b,u,stroke) {
  if(!u?.command||!u.active||b.result)return {ok:false,reason:'이동 명령 불가'};
  const checked=validateRoute(u,stroke);
  if(!checked.ok)return checked; // Invalid replacement leaves the prior order intact.
  u.command.route=checked.route.map(point);u.command.revision++;
  u.command.status='경로 이동';
  u.route=u.command.route.map(p=>[p.x,p.y]);
  return checked;
}
export function cancelRoute(u) {
  if(!u?.command)return;
  u.command.route=[];u.route=[];u.target=null;
  u.command.revision++;u.command.status='경로 취소 · 대기';
}
export function setFireMode(u,mode) {
  if(!u?.command||!['hold','free'].includes(mode))return false;
  u.command.fire=mode;return true;
}
export function setProfile(u,mode) {
  if(!u?.command||!profiles[mode])return false;
  u.command.profile=mode;return true;
}
export function commandFireBlock(u,enemy) {
  if(!u.command)return null;
  if(u.command.fire==='hold')return '사격 금지';
  if(u.command.profile==='sprint')return '전력질주 중 사격 제한';
  const moving=!!u.command.moved;
  if(enemy){
    const aim=Math.atan2(enemy.y-u.y,enemy.x-u.x);
    // Existing baked moving-fire clips are forward-only. No sideways sliding,
    // atlas rotation, or invented independent torso animation.
    if(Math.abs(angleDelta(u.bodyHeading,aim))>(moving?Math.PI/8:.12))return '조준 방향 전환 중';
    if(moving&&((Math.round(u.bodyHeading/(Math.PI/4))%8)+8)%8!==((Math.round(aim/(Math.PI/4))%8)+8)%8&&
      Math.abs(angleDelta(u.bodyHeading,aim))>.08)return '이동 방향 밖의 표적';
  }
  return null;
}
export function stepCommand(b,u,dt) {
  const c=u.command,profile=profiles[c.profile];
  c.moved=false;u.cooldown-=dt;u.target=null;u.order='Player path';
  u.decisionSource='player';u.movementBlocker=null;
  const stop=reason=>{c.status=reason;u.navigation=reason;u.movementBlocker=reason;};
  if(!u.active){stop(u.dead?'전사':'전투 불능');return;}
  const enemies=u.visibleEnemies.filter(e=>e.active&&sight(u,e));
  const enemy=selectEnemy(b,u,enemies);
  u.state='Commanded';
  let reloading=u.reload>0;
  if(reloading){
    u.reload=Math.max(0,u.reload-dt);
    if(u.reload===0){const n=Math.min(u.mag,u.reserve);u.ammo=n;u.reserve-=n;}
  }else if(u.ammo===0&&u.reserve>0){u.reload=u.role==='LMG'?4.5:2.6;reloading=true;}
  const legs=u.health['left leg']+u.health['right leg'];
  if(u.suppression>.8){u.state='Pinned';stop('심한 제압 · 회복 대기');}
  else if(legs<70)stop('다리 부상 · 이동 불가');
  else if(reloading){u.state='Reloading';stop('재장전 · 경로 유지');}
  else if(c.route.length){
    const next=c.route[0],d=distance(u,next),heading=d>1e-8?Math.atan2(next.y-u.y,next.x-u.x):u.bodyHeading;
    u.movementHeading=heading;u.bodyHeading=turn(u.bodyHeading,heading,dt);
    u.target=point(c.route[c.route.length-1]);
    if(Math.abs(angleDelta(u.bodyHeading,heading))>.3)stop('이동 방향 전환 중');
    else {
      const step=Math.min(d,profile.speed*(.25+.75*legs/200)*dt);
      const p=d?{x:u.x+(next.x-u.x)/d*step,y:u.y+(next.y-u.y)/d*step}:point(u);
      // Swept occupancy, no congestion replans or hidden tactical destinations.
      let free=true;
      for(let i=1;i<=5;i++)if(!b.spaceFree(u,{x:u.x+(p.x-u.x)*i/5,y:u.y+(p.y-u.y)*i/5}))free=false;
      if(!segmentClear(u,p))stop('장애물로 경로 차단 · 재지정 필요');
      else if(!free)stop('병사에 의해 차단 · 통로 대기');
      else {u.x=p.x;u.y=p.y;c.moved=step>1e-8;c.status='경로 이동';u.navigation='Moving';if(distance(u,next)<1e-6)c.route.shift();}
    }
  }else {c.status=c.revision?'목적지 도착 · 명령 대기':'명령 대기';u.navigation='Arrived';}
  u.route=c.route.map(p=>[p.x,p.y]);
  if(!c.moved&&!c.route.length&&enemy&&c.fire==='free'&&c.profile!=='sprint')
    u.bodyHeading=turn(u.bodyHeading,Math.atan2(enemy.y-u.y,enemy.x-u.x),dt);
  u.facing=u.bodyHeading;
  if(enemy&&c.fire==='free'&&!commandFireBlock(u,enemy)&&!reloading){
    u.state=b.time<u.aimAt?'Aiming':'Engaging';
    const aim=Math.atan2(enemy.y-u.y,enemy.x-u.x);
    // Shared authoritative weapon, LOS, cover, suppression, injury and hit code.
    b.fireAt(u,enemy,c.moved?profile.accuracy:1,aim);
  }
}
