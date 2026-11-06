// Bounded effects consume authoritative events only; no simulated projectiles.
import {inView} from './view.js';
export class CombatAtmosphere {
 constructor(){this.battle=null;this.serial=0;this.clock=0;this.effects=[];}
 update(b,dt,speed=1,paused=false){if(this.battle!==b){this.battle=b;this.serial=0;this.clock=0;this.effects.length=0;}if(!paused)this.clock+=Math.min(dt,.1)*Math.sqrt(speed);
 for(let i=this.effects.length-1;i>=0;i--)if(this.clock-this.effects[i].at>.65)this.effects.splice(i,1);
 for(const e of b.events){if(e.id<=this.serial)continue;this.serial=e.id;if(!['shot','damage'].includes(e.type))continue;const u=b.units[e.unitId];if(!u)continue;if(this.effects.length>=64)this.effects.shift();this.effects.push({kind:e.type,x:e.x??u.x,y:e.y??u.y,angle:e.angle??u.facing,at:this.clock,id:e.id});}}
 draw(g,iso,view){for(const e of this.effects){const p=iso(e.x,e.y),age=this.clock-e.at;if(view&&!inView(p,view,55))continue;const fade=Math.max(0,1-age/.65);
 if(e.kind==='shot'){const q=iso(e.x+Math.cos(e.angle),e.y+Math.sin(e.angle)),l=Math.hypot(q.x-p.x,q.y-p.y)||1,dx=(q.x-p.x)/l,dy=(q.y-p.y)/l;
 // Smoke drifts only from a real shot; casing is a tiny warm pixel.
 g.fillStyle(0xa4b1b5,.13*fade);g.fillEllipse(p.x+dx*16-age*5,p.y-14+dy*16-age*8,4+age*12,3+age*7);
 if(age<.22){g.fillStyle(0xd6b57c,fade*.8);g.fillRect(p.x-dy*(4+age*22),p.y-11+dx*4+age*9,2,1);}
 }else{g.fillStyle(0xc0ae94,.25*fade);g.fillEllipse(p.x,p.y-8-age*9,5+age*14,4+age*7);if(age<.12){g.fillStyle(0xe7c29c,.6*fade);g.fillRect(p.x-1,p.y-10,2,2);}}
 }}
}
