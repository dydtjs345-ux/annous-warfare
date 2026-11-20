import * as T from 'three';
export const correctedStates={Idle:['Lower_Idle','FB_LowReady_Upper',0],Walk:['FB_Walk_Lower','FB_Walk_Upper',1.05],Sprint:['FB_Sprint_Lower','FB_Sprint_Upper',3],Aim:['Lower_AimStance','FB_AimIdle_Upper',0],Fire:['Lower_AimStance','FB_AimIdle_Upper',0],AimWalk:['FB_AimWalk_Lower','FB_AimWalk_Upper',.62],MovingFire:['FB_AimWalk_Lower','FB_AimWalk_Upper',.62],Reload:['FB_Reload_Lower','FB_Reload_Upper',0]};
export const aimingUpper=name=>['Upper_Aim','FB_AimIdle_Upper','FB_AimWalk_Upper'].includes(name);
export function makeRecoilActions(mixer,clips,corrected){
 const reference=clips.get(corrected?'FB_AimIdle_Upper':'Upper_Aim'),shot=clips.get(corrected?'FB_Recoil_Shot':'Recoil_Shot'),result=[];
 if(reference&&shot)for(let i=0;i<4;i++){const c=shot.clone();c.name='shot_'+i;T.AnimationUtils.makeClipAdditive(c,0,reference,30);const a=mixer.clipAction(c);a.setLoop(T.LoopOnce,1);a.clampWhenFinished=false;a.blendMode=T.AdditiveAnimationBlendMode;result.push(a);}return result;
}
export function synchronizeGait(actor){const name=actor.upper?.getClip().name,lower=actor.lower;if(name&&actor.manifest.clips[name]?.phase_sync_lower===lower?.getClip().name)actor.upper.time=lower.time/lower.getClip().duration*actor.upper.getClip().duration;}
