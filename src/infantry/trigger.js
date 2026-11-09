async function initialize(){
const root=import.meta.env.BASE_URL+'assets/infantry-test/',meta=await(await fetch(root+'manifest.json')).json(),$=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
for(const name of Object.keys(meta.factions.USMC.sequences))$('animation').add(new Option(name==='Sprint'?'Sprint · rebuilt candidate':name==='OldSprint'?'Sprint · previous':name,name));
const images=new Map();let clock=0,previous=performance.now(),playing=true;
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';};
for(const id of ['faction','animation','heading'])$(id).onchange=()=>{clock=0;};
function frame(now){const dt=Math.min(.1,(now-previous)/1000);previous=now;if(playing)clock+=dt;
const faction=$('faction').value,heading=Number($('heading').value),m=meta.factions[faction],name=$('animation').value,s=m.sequences[name],path=root+m.sheets[heading];
let image=images.get(path);if(!image){image=new Image();image.src=path;images.set(path,image);}
ctx.clearRect(0,0,canvas.width,canvas.height);const phase=clock/s.duration%1,idx=s.offset+Math.min(s.count-1,Math.floor(phase*s.count));
if(image.complete&&image.naturalWidth){for(const [x,standing] of [[170,39],[450,80],[730,120]]){const scale=standing/m.standingHeight;ctx.drawImage(image,idx%m.cols*m.width,Math.floor(idx/m.cols)*m.height,m.width,m.height,x-m.anchor[0]*scale,280-m.anchor[1]*scale,m.width*scale,m.height*scale);ctx.fillStyle='#bccdd5';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText(`${standing}px standing reference`,x,320);}}
$('status').textContent=`${faction} · ${m.weapon} · ${name}\n${s.lower} + ${s.upper}\nSource: ${meta.sourceCommit} · ${s.count} samples / ${s.duration.toFixed(2)}s · eight baked headings`;
requestAnimationFrame(frame);}
requestAnimationFrame(frame);

}
initialize().catch(error=>{document.getElementById("status").textContent="Unable to load infantry assets: "+error.message;});
