// This panel only reads copies of renderer state. Its viewer owns separate models.
export function attachInspector(scene){
 const $=id=>document.getElementById(id),select=$('animation-soldier'),panel=$('animation-inspector');
 for(const u of scene.battle.units)select.add(new Option(`${u.team?'러시아':'미 해병'} #${u.id} · ${u.role}`,u.id));
 let view=null,loading=null,generation=0;
 const update=()=>{if(!panel.open)return;const s=scene.infantry.states[Number(select.value)];if(!s)return;const suit=s.model?.startsWith('Military tactical suit');const meta=scene.infantry.manifest?.factions[suit?'TacticalSuit':s.faction|| (Number(select.value)<6?'USMC':'Russian')]?.sequences[s.animation];
 $('animation-current').textContent=`현재 모델: ${s.model}\n실제 상태: ${s.aiState} / ${s.trigger}\n요청 동작: ${s.requestedAnimation}\n실제 표시: ${s.fallback?'기존 2D · '+s.fallback:s.animation}\n클립: ${meta&&!s.fallback?meta.lower+(meta.upper?' + '+meta.upper:''):'해당 3D 클립 없음'}\n출처: ${s.fallback?'src/combat-visuals.js · drawUnit / main b381e60':suit?'실제 외부 수트 cc66fec; 보행 Quaternius UAL1 CC0; SR 리타기팅 420a055':'Sprint: 66d3892; 기타: 5481fc8 / a93cbae'}\n검토: ${s.visualStatus}\n수동 검사: 별도 복제 모델 · 전투 미변경`;
 if(view)$('animation-manual-status').textContent='수동 전용 · '+view.describe();
 };
 scene.time.addEvent({delay:250,loop:true,callback:update});select.onchange=update;panel.ontoggle=()=>{update();if(!panel.open)close();};
 async function init(){if(!loading)loading=import('./manual-viewer.js');return loading;}
 function close(){generation++;view?.dispose();view=null;$('animation-viewport').hidden=true;$('animation-manual-status').textContent='정상 전투 보기 · 수동 검사 해제 · 전투 상태 변경 없음';}
 $('animation-return').onclick=close;
 $('animation-load').onclick=async()=>{const token=++generation;$('animation-manual-status').textContent='검사 자산 로드 중…';try{view?.dispose();view=null;const mod=await init();if(token!==generation)return;const created=await mod.openViewer($('animation-viewport'),$('animation-profile').value);if(token!==generation){created.dispose();return;}view=created;$('animation-viewport').hidden=false;view.resize();$('animation-manual-status').textContent='수동 전용 · 후보는 자동 전투에 연결되지 않음';view.select($('animation-clip').value);}catch(e){close();$('animation-manual-status').textContent='검사 로드 실패: '+e.message;}};
 async function options(){close();const mod=await init();$('animation-clip').replaceChildren();for(const [key,label]of mod.options($('animation-profile').value))$('animation-clip').add(new Option(label,key));}
 $('animation-profile').onchange=options;$('animation-clip').onchange=()=>{if(view){const ok=view.select($('animation-clip').value);$('animation-manual-status').textContent=ok?'수동 전용 · '+$('animation-clip').selectedOptions[0].text:'누락/호환되지 않는 클립 · 재생 안 함';}};
 // Even Three.js is deferred until the user opens the developer panel.
 panel.addEventListener('toggle',()=>{if(panel.open&&!$('animation-clip').options.length)options().catch(e=>$('animation-manual-status').textContent=e.message);});
}
