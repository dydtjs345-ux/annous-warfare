async function initialize(){
const root=import.meta.env.BASE_URL+'assets/infantry-test/',meta=await(await fetch(root+'manifest.json')).json(),$=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
const labels={Idle:'대기',Walk:'보행',Sprint:'SR 전술 질주',OldSprint:'이전 FB · 결함 비교용',Aim:'조준',AimWalk:'조준 보행',MovingFire:'이동 사격',Fire:'정지 사격',Reload:'재장전',Raise:'견착',Start:'출발',Stop:'정지',TurnLeft:'좌회전',TurnRight:'우회전'};function choices(){const before=$('animation').value;$('animation').replaceChildren();for(const name of Object.keys(meta.factions[$('faction').value].sequences))$('animation').add(new Option(labels[name]||name,name));if(meta.factions[$('faction').value].sequences[before])$('animation').value=before;}choices();
const images=new Map();let clock=0,previous=performance.now(),playing=true;
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'일시정지':'재생';};
for(const id of ['faction','animation','heading'])$(id).onchange=()=>{clock=0;if(id==='faction')choices();};
function frame(now){const dt=Math.min(.1,(now-previous)/1000);previous=now;if(playing)clock+=dt;
const faction=$('faction').value,heading=Number($('heading').value),m=meta.factions[faction],name=$('animation').value,s=m.sequences[name],path=root+m.sheets[heading];
let image=images.get(path);if(!image){image=new Image();image.src=path;images.set(path,image);}
ctx.clearRect(0,0,canvas.width,canvas.height);const phase=clock/s.duration%1,idx=s.offset+Math.min(s.count-1,Math.floor(phase*s.count));
if(image.complete&&image.naturalWidth){for(const [x,standing] of [[170,39],[450,80],[730,120]]){const scale=standing/m.standingHeight;ctx.drawImage(image,idx%m.cols*m.width,Math.floor(idx/m.cols)*m.height,m.width,m.height,x-m.anchor[0]*scale,280-m.anchor[1]*scale,m.width*scale,m.height*scale);ctx.fillStyle='#bccdd5';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText(`${standing}px standing reference`,x,320);}}
$('status').textContent=`${faction} · ${m.weapon} · ${name}\n${s.lower}${s.upper?' + '+s.upper:''}\n출처: ${faction==='TacticalSuit'?'cc66fec / 실제 수트':meta.sourceCommit} · ${s.count} samples / ${s.duration.toFixed(2)}s · eight baked headings`;
requestAnimationFrame(frame);}
requestAnimationFrame(frame);

}
initialize().catch(error=>{document.getElementById("status").textContent="보병 자산 로드 실패: "+error.message;});
