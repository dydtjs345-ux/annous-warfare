const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);let manifest,ticket=0,blobURL;
for(const k of ['mode','view','action'])if([...$(k).options].some(o=>o.value===query.get(k)))$(k).value=query.get(k);
async function show(){const current=++ticket,mode=$('mode').value,view=$('view').value,action=$('action').value,crawl=mode==='motion'&&action==='crawl';$('action-control').hidden=mode!=='motion';$('speed-control').hidden=mode!=='motion'||crawl;$('movie').pause();$('movie').removeAttribute('src');$('movie').load();if(blobURL){URL.revokeObjectURL(blobURL);blobURL=null;}$('appearance').hidden=mode!=='appearance';$('movie').hidden=mode!=='motion'||crawl;$('crawl-message').hidden=!crawl;$('frames-link').hidden=mode!=='motion'||crawl;
 $('explanation').textContent=mode==='appearance'?'외형 비교: 원본 USMC와 실제 Tactical Suit를 중립 자세에서 비교합니다.':'동작 비교: 기존 USMC 동작과 실제 Tactical Suit에 적용한 Quaternius 동작을 비교합니다. 양쪽 1× 재생입니다.';
 if(mode==='appearance'){$('appearance').src=`images/appearance-${view}.jpg`;$('status').textContent='캐릭터 기하·재질 비교 · 같은 카메라·표시 높이';return;}
 if(crawl){$('status').textContent='포복 소스 파일 대기 · 가져온 포복 없음';return;}
 $('frames-link').href=`images/${action}-${view}-comparison.jpg`;$('status').textContent='최종 GLB 비교 영상 불러오는 중…';
 try{const r=await fetch(`recordings/${action}-${view}.mp4`);if(!r.ok)throw Error('HTTP '+r.status);const blob=await r.blob();if(current!==ticket)return;blobURL=URL.createObjectURL(new Blob([blob],{type:'video/mp4'}));$('movie').src=blobURL;$('movie').playbackRate=Number($('speed').value);$('movie').load();$('movie').play().catch(()=>{});$('status').textContent='왼쪽: 원본 USMC · 오른쪽: 실제 Sketchfab Tactical Suit + Quaternius · 같은 재생 속도';}catch(e){$('status').textContent='영상 불러오기 실패: '+e.message+' · 정지 프레임 비교를 이용하세요.';}}
for(const id of ['mode','view','action'])$(id).onchange=show;fetch('manifest.json').then(r=>{if(!r.ok)throw Error('Manifest HTTP '+r.status);return r.json();}).then(m=>{manifest=m;$('model-link').href=m.actualModel.path;return show();}).catch(e=>{$('status').textContent=e.message;});

$('speed').onchange=()=>{$('movie').playbackRate=Number($('speed').value);};
