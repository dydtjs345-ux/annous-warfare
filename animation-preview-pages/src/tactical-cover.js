import * as T from 'three';
export function updateTacticalCover(actor,state,offset=0,shape='wall'){
 const active=state.includes('Cover');if(!active){if(actor.coverProp)actor.coverProp.visible=false;return;}
 if(state.includes('Left'))actor.coverSide='left';else if(state.includes('Right'))actor.coverSide='right';else if(state.includes('Above')||state.includes('Rise')||state.includes('Lower'))actor.coverSide='center';
 const side=actor.coverSide||'center',key=shape+side;
 if(actor.coverKey!==key){if(actor.coverProp){actor.coverProp.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});actor.coverProp.removeFromParent();}
 const g=new T.Group(),width=side==='center'?2.4:1.7,center=side==='left'?.12-width/2:side==='right'?-.12+width/2:0,depth=shape==='vehicle'?.75:.22;
 const body=new T.Mesh(new T.BoxGeometry(width,1.3,depth),new T.MeshStandardMaterial({color:shape==='vehicle'?0x4b5e4d:shape==='block'?0x7b837d:0x646e75,roughness:.95}));body.position.set(center,.65,1.3+depth/2);body.castShadow=true;body.receiveShadow=true;g.add(body);
 if(shape==='vehicle')for(const x of [center-width*.32,center+width*.32]){const wheel=new T.Mesh(new T.CylinderGeometry(.22,.22,.12,12),new T.MeshStandardMaterial({color:0x18211d}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.22,1.25);g.add(wheel);}
 actor.scene.add(g);actor.coverProp=g;actor.coverKey=key;
 }
 actor.coverProp.visible=true;actor.coverProp.rotation.y=actor.assembly.rotation.y;actor.coverProp.position.set(Math.sin(actor.assembly.rotation.y)*offset,0,Math.cos(actor.assembly.rotation.y)*offset);
}
