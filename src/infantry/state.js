// Read-only adapter. All action evidence comes from the current simulation and
// presentation observers. No RNG, orders, simulation counters, or unit writes.
export const TAU = Math.PI * 2;
const delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const fallbackPoses=new Set(['dead','incapacitated','treating','fullCover','crawling','grenadePrep','grenadeThrow','deploying','unmounting','mounted','mountedFiring']);
export function observeInfantry(b,u,m,fx,view,clock,record={},sprint='new'){
 const p=u.presentation;
 const fallback=m.tucked?"fullCover":m.crawl?"crawling":fallbackPoses.has(m.pose)?m.pose:null;
 const shot=m.flash && p.lastShotAt!=null;
 const aimed=shot || ['Aiming','Engaging'].includes(u.state) && p.direct;
 const moving=!!m.moving;
 let animation=p.reloading?'Reload':moving?(aimed?(shot?'MovingFire':'AimWalk'):p.brisk?(sprint==='old'?'OldSprint':'Sprint'):'Walk'):shot?'Fire':aimed?'Aim':'Idle';
 const heading=moving&&!aimed?(view.movementHeading??u.movementHeading??u.facing):(m.renderDirection??u.facing);
 const old=record.base,now=clock;
 if(old!==animation){
  const locomotion=new Set(['Walk','Sprint','OldSprint','AimWalk','MovingFire']);
  if(!moving && animation==='Idle' && locomotion.has(old)){record.transition='Stop';record.started=now;}
  else if(!moving && ['Aim','Fire'].includes(animation) && old==='Idle'){record.transition='Raise';record.started=now;}
  else {record.transition=null;record.started=now;}
  record.base=animation;
 }
 record.turnHeading ??= heading;
 if(!moving && animation==='Idle' && !record.transition && Math.abs(delta(record.turnHeading,heading))>.35){record.transition=delta(record.turnHeading,heading)>0?'TurnRight':'TurnLeft';record.started=now;record.turnHeading=heading;}
 if(moving)record.turnHeading=heading;
 record.heading=heading;
 if(record.transition){const duration={Stop:.6,Raise:.8,TurnLeft:.9,TurnRight:.9}[record.transition];if(now-record.started<duration)animation=record.transition;else record.transition=null;}
 // Fire/AimWalk share the exact same stride phase. No shot can reset this.
 const distance=(m.renderStride??m.stride??0)/TAU;
 const stride=animation==='Sprint'?2.4:animation==='OldSprint'?2.4:(animation==='AimWalk'||animation==='MovingFire') ? 0.744 : 1.26;
 const traveled=record.lastDistance==null?distance:Math.max(0,distance-record.lastDistance);
 record.lastDistance=distance;record.gaitPhase=((record.gaitPhase??0)+traveled/stride)%1;
 const phase=moving?record.gaitPhase:animation==='Reload'?(m.renderReloadProgress??p.reloadProgress):record.transition?(now-record.started)/({Stop:.6,Raise:.8,TurnLeft:.9,TurnRight:.9}[record.transition]):now/2.4%1;
 return {animation,base:record.base,heading,direction:((Math.round(heading/(Math.PI/4))%8)+8)%8,phase:Math.max(0,Math.min(.999999,phase)),moving,shot,fallback,aiState:u.state,speed:p.speed,brisk:!!p.brisk,reloadProgress:p.reloadProgress,weapon:u.role==='LMG'?'legacy LMG':u.team?'AK-74M':'M16A4',sprintApproval:'candidate; awaiting visual approval'};
}
