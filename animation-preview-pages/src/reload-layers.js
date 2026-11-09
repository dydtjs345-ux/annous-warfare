import * as T from 'three';
// Keep object visibility/attachment tracks independent of upper-body crossfades.
export function prepareReloadObjectActions(clips,mixer){
 const actions=new Map();
 for(const name of ['Reload','Reload_Tactical']){
  const reload=clips.get(name);if(!reload)continue;
  const objectTracks=reload.tracks.filter(t=>/^(Magazine|SpareMagazine)\./.test(t.name));
  clips.set(name,new T.AnimationClip(name,reload.duration,reload.tracks.filter(t=>!/^(Magazine|SpareMagazine)\./.test(t.name))));
  const action=mixer.clipAction(new T.AnimationClip(name+'_Objects',reload.duration,objectTracks));
  action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;actions.set(name,action);
 }
 return actions;
}
