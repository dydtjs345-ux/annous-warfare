// Authored sprint review is opt-in. Existing Sprint mapping is intentionally unchanged.
export const sprintStates={SprintNew:['SR_Sprint_Lower','SR_Sprint_Upper',3.6],SprintStartNew:['SR_IdleToSprint_Lower','SR_IdleToSprint_Upper',0],SprintAccelerateNew:['SR_WalkToSprint_Lower','SR_WalkToSprint_Upper',0],SprintDecelerateNew:['SR_SprintToWalk_Lower','SR_SprintToWalk_Upper',0],SprintStopNew:['SR_SprintToStop_Lower','SR_SprintToStop_Upper',0]};
export const sprintExits={SR_IdleToSprint_Lower:sprintStates.SprintNew,SR_WalkToSprint_Lower:sprintStates.SprintNew,SR_SprintToWalk_Lower:['FB_Walk_Lower','FB_Walk_Upper',1.05],SR_SprintToStop_Lower:['Lower_Idle','FB_LowReady_Upper',0]};
export function distanceAt(info,time){const samples=info.travel_samples_m;if(!samples)return time*(info.speed_mps||0);const f=Math.max(0,Math.min(samples.length-1,time*(info.sample_rate||30))),i=Math.min(samples.length-2,Math.floor(f));return samples[i].distance_m+(samples[i+1].distance_m-samples[i].distance_m)*(f-i);}
export const routeDuration=1.2+4/3+1.2,routeLength=9.12;
export function evaluateRoute(actor,time){
 let names,t,d;
 if(time<1.2){names=sprintStates.SprintStartNew;t=time;d=distanceAt(actor.manifest.clips[names[0]],t);}
 else if(time<1.2+4/3){names=sprintStates.SprintNew;t=(time-1.2)%(2/3);d=2.16+(time-1.2)*3.6;}
 else if(time<routeDuration){names=sprintStates.SprintStopNew;t=time-1.2-4/3;d=6.96+distanceAt(actor.manifest.clips[names[0]],t);}
 else{names=['Lower_Idle','FB_LowReady_Upper',0];t=(time-routeDuration)%2.4;d=routeLength;}
 actor.changeLayer('lower',names[0],true);actor.changeLayer('upper',names[1],true);actor.lower.time=t;actor.upper.time=t;actor.mixer.update(0);actor.distance=d;actor.finished.length=0;
 const angle=actor.assembly.rotation.y;actor.assembly.position.set(Math.sin(angle)*(d-routeLength/2),0,Math.cos(angle)*(d-routeLength/2));
}
