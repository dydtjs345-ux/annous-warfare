// Read-only presentation cues. No simulation writes or random calls.
export function readability(u) {
  return { state: !u.active ? u.dead ? 'dead' : 'incapacitated' : u.grenadePrep ? 'grenade' : u.state === 'Treating' ? 'treating' : u.reload > 0 ? 'reload' : u.posture?.mode === 'full' ? 'full' : u.mount?.state === 'mounted' ? 'mounted' : u.presentation?.moving ? u.presentation.brisk ? 'running' : 'walking' : u.posture?.mode === 'peek' ? 'peek' : u.suppression > .5 ? 'suppressed' : 'observing', wounded: Object.values(u.health).some(h=>h<100) };
}
export function drawReadability(g,u,p,iso) {
 const r=readability(u);
 if(!u.active) { g.lineStyle(1,u.dead?0x85888b:0xf1bd75,.9);g.strokeCircle(p.x,p.y-3,5);if(u.dead){g.lineBetween(p.x-3,p.y-6,p.x+3,p.y);}return; }
 // Travel footprint and observation ray are deliberately separate.
 if(u.presentation?.moving && u.movementHeading!=null){const q=iso(u.x+Math.cos(u.movementHeading)*.45,u.y+Math.sin(u.movementHeading)*.45);g.lineStyle(2,0x95b7c5,.65);g.lineBetween(p.x,p.y+3,q.x,q.y+3);}
 if(u.observationHeading!=null){const q=iso(u.x+Math.cos(u.observationHeading)*.65,u.y+Math.sin(u.observationHeading)*.65);g.lineStyle(1,0xe2d59b,.65);g.lineBetween(p.x,p.y-13,q.x,q.y-13);}
 const colors={full:0x74bca0,peek:0xf1d17d,mounted:0xaaa7ed,reload:0x88c9e2,treating:0x91e8af,grenade:0xffb76e,suppressed:0xe48f82};
 if(colors[r.state]){g.lineStyle(r.state==='full'?2:1,colors[r.state],.95);g.strokeEllipse(p.x,p.y+2, r.state==='mounted'?20:14,6);}
 if(r.wounded){g.fillStyle(0xe7a37c,.95);g.fillRect(p.x-9,p.y-15,2,4);}
}
