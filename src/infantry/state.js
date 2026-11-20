// Read-only adapter. All action evidence comes from the current simulation and
// presentation observers. No RNG, orders, simulation counters, or unit writes.
export const TAU = Math.PI * 2;
const delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const fallbackPoses=new Set(['dead','incapacitated','treating','fullCover','crawling','grenadePrep','grenadeThrow','deploying','unmounting','mounted','mountedFiring']);
export function observeInfantry(b,u,m,fx,view,clock,record={},sprint='new',strides={}){
 const p=u.presentation;
 const terminal=u.dead||m.pose==='dead'?'dead':u.active===false||m.pose==='incapacitated'?'incapacitated':null;
 const fallback=terminal||((m.limp||m.crawl)?'injury movement':m.pose==='suppressed'?'suppression reaction':null)||(m.tucked?"fullCover":m.crawl?"crawling":fallbackPoses.has(m.pose)?m.pose:null);
 const shot=!terminal && m.flash && p.lastShotAt!=null;
 const aimed=shot || ['Aiming','Engaging'].includes(u.state) && p.direct;
 const moving=!terminal && !!m.moving;
 let animation=p.reloading?'Reload':moving?(aimed?(shot?'MovingFire':'AimWalk'):p.brisk?(sprint==='old'?'OldSprint':'Sprint'):'Walk'):shot?'Fire':aimed?'Aim':'Idle';
 const heading=moving&&!aimed?(view.movementHeading??u.movementHeading??u.facing):(m.renderDirection??u.facing);
 const old=record.base,now=clock;
 if(old!==animation){
  const locomotion=new Set(['Walk','Sprint','OldSprint','AimWalk','MovingFire']);
  if(moving && animation==='Walk' && old==='Idle'){record.transition='Start';record.started=now;}
  else if(!moving && animation==='Idle' && locomotion.has(old)){record.transition='Stop';record.started=now;}
  else if(!moving && ['Aim','Fire'].includes(animation) && old==='Idle'){record.transition='Raise';record.started=now;}
  else {record.transition=null;record.started=now;}
  record.base=animation;
 }
 record.turnHeading ??= heading;
 if(!moving && animation==='Idle' && !record.transition && Math.abs(delta(record.turnHeading,heading))>.35){record.transition=delta(record.turnHeading,heading)>0?'TurnRight':'TurnLeft';record.started=now;record.turnHeading=heading;}
 if(moving)record.turnHeading=heading;
 record.heading=heading;
 if(terminal||fallback){record.transition=null;animation=terminal||m.pose;}
 if(record.transition){const duration={Start:.6,Stop:.6,Raise:.8,TurnLeft:.9,TurnRight:.9}[record.transition];if(now-record.started<duration)animation=record.transition;else record.transition=null;}
 // Fire/AimWalk share the exact same stride phase. No shot can reset this.
 const distance=(m.renderStride??m.stride??0)/TAU;
 const stride=strides[animation]??(animation==='Sprint'?2.4:animation==='OldSprint'?2.4:(animation==='AimWalk'||animation==='MovingFire') ? 0.744 : 1.26);
 const traveled=record.lastDistance==null?distance:Math.max(0,distance-record.lastDistance);
 record.lastDistance=distance;record.gaitPhase=((record.gaitPhase??0)+traveled/stride)%1;
 const phase=record.transition?(now-record.started)/({Start:.6,Stop:.6,Raise:.8,TurnLeft:.9,TurnRight:.9}[record.transition]):animation==='Reload'?(m.renderReloadProgress??p.reloadProgress):moving?record.gaitPhase:now/2.4%1;
 return {animation,base:record.base,heading,direction:((Math.round(heading/(Math.PI/4))%8)+8)%8,phase:Math.max(0,Math.min(.999999,phase)),moving,shot,fallback,aiState:u.state,speed:p.speed,brisk:!!p.brisk,reloadProgress:p.reloadProgress,weapon:u.role==='LMG'?'legacy LMG':u.team?'AK-74M':'M16A4',requestedAnimation:terminal||animation,model:u.team?'Russian shared-rig / AK-74M':'USMC shared-rig / M16A4',sprintApproval:'SR preserved; external retarget approved in 420a055; original SR user sign-off not recorded',trigger:terminal||m.pose||u.state,visualStatus:fallback?'기존 렌더러 대체 · 해당 3D 클립 없음':animation==='Sprint'?'보존 SR 검증본 · 원본 사용자 승인 기록 없음':'기존 검증 클립'};
}
