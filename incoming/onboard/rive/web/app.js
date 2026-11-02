'use strict';

// All scene/character/card artwork is native Rive. The host owns accessible
// form controls, movement, and lossless PNG compositing of native Rive pixels.
const $ = id => document.getElementById(id);
const W = 1600, H = 1000, SLOTS = 16;
const {CITIES,CATALOG,parseOutfit,cleanName,dripURL,photoCrop}=DuckyJoinCore;
// URL values are zero-based Rive slot indexes, not the numbers in SVG names.
// Index 0 = none. Acc 6 is absent from this catalog and the .riv entirely.
const params = new URL(location.href).searchParams;
const qaEnabled=params.has('qa');
const qaReport={started:new Date().toISOString(),steps:[],errors:[]};
function qaLog(step,data={}){if(!qaEnabled)return;qaReport.steps.push({step,...data});return fetch('/__qa/report',{method:'POST',body:JSON.stringify(qaReport)}).catch(()=>{});}
if(qaEnabled){addEventListener('error',event=>{qaReport.errors.push(event.message);qaLog('error');});addEventListener('unhandledrejection',event=>{qaReport.errors.push(String(event.reason));qaLog('rejection');});}
qaLog('boot');
const outfit=parseOutfit(params);
$('name').value = cleanName(params.get('name') || '');
const urlCity = CITIES.find(city=>city.toLowerCase()===(params.get('city')||'').toLowerCase());
if(urlCity) $('city').value=urlCity;
let preview, world, worldVM, slots=[], cache=[], now=0, last=0, joined=false, frozen=false, landingUntil=0;
let cardRenderers, photoURLs=[], photoBusy=false, toastTimer, qaDriving=false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const keys=new Set();
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=items=>items[Math.floor(Math.random()*items.length)];

function toast(message) {
  $('toast').textContent=message; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3600);
}
function outfitURL() {
  return dripURL(location.href,outfit,$('name').value,$('city').value);
}
function updateURL() { const url=new URL(outfitURL());if(qaEnabled)url.searchParams.set('qa',params.get('qa'));history.replaceState(null,'',url); }
function updatePreview() {
  for(const key of Object.keys(CATALOG)) {
    $('outfit-'+key).value=outfit[key];
    $('count-'+key).textContent=outfit[key]===0 ? 'Nothing on. Still a look.' : outfit[key]+' of '+(CATALOG[key].items.length-1);
    if(preview) preview.viewModelInstance.number(key).value=outfit[key];
  }
  updateURL();
}
for(const [key,slot] of Object.entries(CATALOG)) {
  const section=document.createElement('div');section.className='slot';
  const label=document.createElement('label');label.className='slot-label';label.htmlFor='outfit-'+key;label.textContent=slot.label;
  const picker=document.createElement('div');picker.className='slot-picker';
  const select=document.createElement('select');select.id='outfit-'+key;
  slot.items.forEach((name,i)=>select.add(new Option(name,i)));
  select.addEventListener('change',()=>{outfit[key]=Number(select.value);updatePreview();});
  function arrow(delta) {
    const button=document.createElement('button');button.type='button';button.textContent=delta<0?'‹':'›';button.setAttribute('aria-label',(delta<0?'Previous ':'Next ')+slot.label.toLowerCase());
    button.addEventListener('click',()=>{outfit[key]=(outfit[key]+delta+slot.items.length)%slot.items.length;updatePreview();});return button;
  }
  picker.append(arrow(-1),select,arrow(1));
  const counter=document.createElement('span');counter.id='count-'+key;counter.className='slot-number';
  section.append(label,picker,counter);$(key==='cap'||key==='shades'?'slots-left':'slots-right').append(section);
}
$('randomize').addEventListener('click',()=>{
  const before=JSON.stringify(outfit);
  do {for(const [key,slot] of Object.entries(CATALOG)) outfit[key]=Math.floor(Math.random()*slot.items.length);} while(JSON.stringify(outfit)===before);
  updatePreview();
});
$('name').addEventListener('change',updateURL);$('city').addEventListener('change',updateURL);
updatePreview();

function walkable(x,y) {return ((x-800)/560)**2+((y-640)/290)**2<=1 && ((x-800)/250)**2+((y-575)/120)**2>=1;}
function personalSpace(x,y,px,py){return ((x-px)/115)**2+((y-py)/185)**2<1;}
function randomSpot(exclude=[800,820]) {for(;;){const x=rnd(240,1360),y=rnd(350,930);if(walkable(x,y)&&!personalSpace(x,y,...exclude))return[x,y];}}
const NAMES=['quackers','mo','aya_22','bread_boy','pip','lulu','nori','miso','toto','sunny','peep','boba'];
function makeDuck(i,player=false) {
  const [x,y]=player?[800,820]:randomSpot();
  return {x,y,tx:x,ty:y,player,action:0,facing:1,until:0,wait:rnd(.8,3),name:player?'you':NAMES[i],city:Math.floor(Math.random()*CITIES.length),cap:Math.floor(rnd(0,14)),shades:Math.floor(rnd(0,4)),acc:Math.floor(rnd(0,8)),shoes:Math.floor(rnd(0,11))};
}
const player=makeDuck(0,true), ducks=[player,...Array.from({length:12},(_,i)=>makeDuck(i))];
// A small welcome flock makes the first photo social before anyone has wandered.
[[650,790],[955,805],[1100,720]].forEach(([x,y],i)=>Object.assign(ducks[i+1],{x,y,tx:x,ty:y,wait:4+i}));
function quack(d){d.action=2;d.until=now+1.25;}
function step(d,dt) {
  if(d.player) {
    if(now<landingUntil)return;
    if(d.action===4)d.action=0;
    let vx=0,vy=0;
    if(keys.has('a')||keys.has('arrowleft'))vx--;
    if(keys.has('d')||keys.has('arrowright'))vx++;
    if(keys.has('w')||keys.has('arrowup'))vy--;
    if(keys.has('s')||keys.has('arrowdown'))vy++;
    if(vx||vy){d.tapping=false;d.tx=d.x;d.ty=d.y;}
    if(!vx&&!vy&&d.tapping){const dx=d.tx-d.x,dy=d.ty-d.y,l=Math.hypot(dx,dy);if(l>4){vx=dx/l;vy=dy/l;}else d.tapping=false;}
    const length=Math.hypot(vx,vy);
    if(length){const nx=d.x+vx/length*150*dt,ny=d.y+vy/length*150*dt;if(walkable(nx,ny)){d.x=nx;d.y=ny;}else if(walkable(nx,d.y))d.x=nx;else if(walkable(d.x,ny))d.y=ny;if(vx)d.facing=vx<0?-1:1;if(d.action!==2)d.action=1;}
    else if(d.action===1)d.action=0;
    if((d.action===2||d.action===3)&&now>d.until)d.action=0;
    return;
  }
  if((d.action===2||d.action===3)&&now<d.until)return;
  if(d.action===2||d.action===3)d.action=0;
  const dx=d.tx-d.x,dy=d.ty-d.y,l=Math.hypot(dx,dy);
  if(l>4){const nx=d.x+dx/l*112*dt,ny=d.y+dy/l*112*dt;if(walkable(nx,ny)&&!personalSpace(nx,ny,player.x,player.y)){d.x=nx;d.y=ny;d.action=1;if(Math.abs(dx)>2)d.facing=dx<0?-1:1;}else {d.tx=d.x;d.ty=d.y;d.action=0;d.wait=.7;}return;}
  d.action=0;d.wait-=dt;
  if(d.wait>0)return;
  const roll=Math.random();
  if(roll<.15){d.action=3;d.until=now+rnd(2.5,5);}else if(roll<.3)quack(d);else [d.tx,d.ty]=randomSpot([player.x,player.y]);d.wait=rnd(1,4);
}
function write(i,key,value,string=false){if(cache[i][key]===value)return;cache[i][key]=value;const prop=string?slots[i].string(key):slots[i].number(key);if(prop)prop.value=value;}
function sync(){
  const order=[...ducks].sort((a,b)=>a.y-b.y);
  for(let i=0;i<SLOTS;i++){
    const d=order[i];if(!d){write(i,'x',-2000);continue;}
    for(const key of ['x','y','action','facing','cap','shades','acc','shoes','city'])write(i,key,d[key]);
    write(i,'tagVisible',d.player&&d.action===4?0:1);write(i,'isPlayer',d.player?1:0);write(i,'name',' '+d.name+' ',true);
    const progress=d.player&&d.action===4?Math.max(0,Math.min(1,(now-(landingUntil-1.2))/1.1)):1;
    write(i,'arrival',progress*2-1);
  }
}
function advanceWorld(dt){now+=dt;for(const d of ducks)step(d,dt);sync();$('photo').disabled=now<landingUntil;}
function loop(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;if(joined&&!frozen&&!qaDriving)advanceWorld(dt);requestAnimationFrame(loop);}
requestAnimationFrame(loop);

addEventListener('keydown',event=>{
  if(!joined||frozen||now<landingUntil||event.target.closest('button,input,select,a,dialog'))return;
  const key=event.key.toLowerCase();keys.add(key);
  if(key==='q'&&!event.repeat)quack(player);
  if(key==='e'&&!event.repeat){player.action=player.action===3?0:3;player.until=now+6;}
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))event.preventDefault();
});
addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{keys.clear();last=0;});
$('plaza').addEventListener('pointerdown',event=>{
  if(!joined||frozen||now<landingUntil)return;
  $('plaza').focus({preventScroll:true});
  const rect=$('plaza').getBoundingClientRect(),s=Math.min(rect.width/W,rect.height/H);
  const x=(event.clientX-rect.left-(rect.width-W*s)/2)/s,y=(event.clientY-rect.top-(rect.height-H*s)/2)/s;
  if(walkable(x,y)){player.tx=x;player.ty=y;player.tapping=true;if(player.action===3)player.action=0;}
});

function loadRive(bytes,artboard,canvas,machine){
  // Keep the browser's last rendered pixels available for a user-triggered
  // snapshot. Context attributes are fixed by the first getContext call.
  canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,depth:true,stencil:true,antialias:false,powerPreference:'high-performance'});
  return new Promise((resolve,reject)=>{
    const instance=new rive.Rive({buffer:bytes,canvas,artboard,stateMachines:machine,autoplay:true,autoBind:true,layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),onLoad:()=>resolve(instance),onLoadError:reject});
  });
}
const dpr=()=>Math.min(devicePixelRatio||1,2);
function resize(){if(preview&&!joined)preview.resizeDrawingSurfaceToCanvas(dpr());if(world&&joined)world.resizeDrawingSurfaceToCanvas(dpr());}
addEventListener('resize',resize);
rive.RuntimeLoader.setWasmUrl(new URL('rive.wasm',location.href).href);
rive.RuntimeLoader.setWasmFallbackUrl?.(new URL('rive_fallback.wasm',location.href).href);
const ready=(async()=>{
  const response=await fetch('ducky-land.riv');if(!response.ok)throw new Error('Missing Rive build');const bytes=await response.arrayBuffer();
  qaLog('asset-loaded',{bytes:bytes.byteLength});
  preview=await loadRive(bytes,'Wardrobe',$('ducky'),'Wardrobe');qaLog('preview-loaded');preview.viewModelInstance.number('tagVisible').value=0;updatePreview();resize();
  world=await loadRive(bytes,'Plaza',$('plaza'),'Plaza');qaLog('plaza-loaded');worldVM=world.viewModelInstance;
  slots=Array.from({length:SLOTS},(_,i)=>worldVM.viewModel('slot'+i));cache=Array.from({length:SLOTS},()=>({}));sync();world.pause();world.stopRendering();
  // Two static native Rive card templates stay off-screen, and never animate.
  cardRenderers=await Promise.all(['Photo Wide','Photo Square'].map(async(name,i)=>{
    const canvas=document.createElement('canvas');canvas.width=i?1200:1600;canvas.height=i?1200:900;
    const instance=await loadRive(bytes,name,canvas,'Card');instance.pause();instance.stopRendering();return instance;
  }));
  $('enter').disabled=false;$('enter').textContent='Waddle in ↗';
  window.game={world,preview,ducks,player,slots,outfit,CATALOG,CITIES,get frozen(){return frozen;},get joined(){return joined;},get now(){return now;},get landingUntil(){return landingUntil;}};
  qaLog('ready',{outfit:{...outfit},viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth});
  if(params.get('qa')==='auto')setTimeout(runBrowserQA,500);
})().catch(error=>{console.error(error);qaReport.errors.push(String(error));qaLog('load-failed');$('load-error').hidden=false;$('enter').textContent='Refresh to try again';});

$('join-form').addEventListener('submit',async event=>{
  event.preventDefault();await ready;
  const name=cleanName($('name').value);if(!name){$('name').value='';$('name').reportValidity();return;}
  if(!world||!CITIES.includes($('city').value))return;
  $('name').value=name;Object.assign(player,outfit,{name,city:CITIES.indexOf($('city').value),action:reducedMotion.matches?0:4,tapping:false});
  updateURL();keys.clear();joined=true;frozen=false;landingUntil=now+(reducedMotion.matches?0:1.2);sync();
  $('join').hidden=true;$('world').hidden=false;document.body.style.overflow='hidden';resize();preview.pause();preview.stopRendering();world.play();world.startRendering();
  $('plaza').focus({preventScroll:true});toast('Tap to waddle · Q to quack · E to dance');
});
$('change-outfit').addEventListener('click',()=>{
  if(frozen)return;joined=false;keys.clear();world.pause();world.stopRendering();$('world').hidden=true;$('join').hidden=false;document.body.style.overflow='';
  preview.play();preview.startRendering();resize();$('toast').classList.remove('visible');$('randomize').focus({preventScroll:true});
});

// Draw the paused native artboard synchronously and immediately copy its pixels.
// This avoids WebGL's preserveDrawingBuffer=false losing a frame before toBlob.
function nativePixels(instance,width,height){
  const canvas=instance.canvas,oldW=canvas.width,oldH=canvas.height;
  const render=(w,h)=>{
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
    const renderer=instance.renderer;renderer.clear();renderer.save();
    renderer.align(instance.layout.runtimeFit(instance.runtime),instance.layout.runtimeAlignment(instance.runtime),{minX:0,minY:0,maxX:w,maxY:h},instance.artboard.bounds);
    instance.artboard.draw(renderer);renderer.restore();renderer.flush();instance.runtime.resolveAnimationFrame?.();
    const gl=canvas.getContext('webgl2');if(gl){gl.flush();gl.finish();}
  };
  render(width,height);
  const copy=document.createElement('canvas');copy.width=width;copy.height=height;const ctx=copy.getContext('2d');ctx.drawImage(canvas,0,0);
  if(!ctx.getImageData(Math.floor(width/2),Math.floor(height/2),1,1).data[3]){
    render(width,height);ctx.clearRect(0,0,width,height);ctx.drawImage(canvas,0,0);
  }
  if(!ctx.getImageData(Math.floor(width/2),Math.floor(height/2),1,1).data[3]){render(oldW,oldH);throw new Error('The native Rive snapshot was empty');}
  render(oldW,oldH);return copy;
}
function cropFor(aspect){
  return photoCrop(ducks,player,aspect);
}
function pngBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG export failed')),'image/png'));}
async function postcard(snapshot,index){
  const width=index?1200:1600,height=index?1200:900,photoHeight=index?902:622,photoWidth=width-96;
  const frame=cardRenderers[index];frame.viewModelInstance.string('signature').value=player.name+' · '+CITIES[player.city];
  // Paused state machines do not apply data binds. Apply at dt=0, then pause
  // again before drawing, so the native signature is up to date in every PNG.
  frame.play();frame.advanceAndReportChanges(0);frame.pause();frame.stopRendering();
  const canvas=nativePixels(frame,width,height),ctx=canvas.getContext('2d'),crop=cropFor(photoWidth/photoHeight);
  ctx.save();ctx.beginPath();ctx.roundRect(48,158,photoWidth,photoHeight,25);ctx.clip();
  ctx.drawImage(snapshot,crop.x*2,crop.y*2,crop.width*2,crop.height*2,48,158,photoWidth,photoHeight);ctx.restore();
  const blob=await pngBlob(canvas);return {url:URL.createObjectURL(blob),width,height,crop};
}
$('photo').addEventListener('click',async()=>{
  if(!joined||frozen||photoBusy||now<landingUntil)return;
  photoBusy=true;frozen=true;keys.clear();world.pause();world.stopRendering();$('photo').disabled=true;
  try {
    // One shared frozen image for both aspect ratios. No outfit/crowd reroll.
    const snapshot=nativePixels(world,W*2,H*2);
    for(const url of photoURLs)URL.revokeObjectURL(url);
    const cards=await Promise.all([postcard(snapshot,0),postcard(snapshot,1)]);photoURLs=cards.map(card=>card.url);
    $('photo-preview').src=cards[0].url;$('download-wide').href=cards[0].url;$('download-square').href=cards[1].url;
    $('photo-status').textContent='Two PNGs, the same little moment.';
    window.game.lastPhoto={cards,player:{...player},ducks:ducks.map(d=>({...d})),time:now};
    $('photo-dialog').showModal();$('download-wide').focus();
  } catch(error){console.error(error);frozen=false;world.play();world.startRendering();toast('That photo slipped away. Try once more.');}
  finally{photoBusy=false;$('photo').disabled=false;}
});
function resume(){if(!frozen)return;frozen=false;keys.clear();last=0;world.play();world.startRendering();$('plaza').focus({preventScroll:true});}
function closePhoto(){ $('photo-dialog').close();resume(); }
$('close-photo').addEventListener('click',closePhoto);
$('photo-dialog').addEventListener('close',resume);
$('photo-dialog').addEventListener('cancel',event=>{event.preventDefault();closePhoto();});
$('photo-dialog').addEventListener('click',event=>{if(event.target===$('photo-dialog')){const rect=$('photo-dialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closePhoto();}});
$('copy-link').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(outfitURL());$('photo-status').textContent='Drip link copied. Your outfit, name and city are in it.';}
  catch{const input=document.createElement('input');input.value=outfitURL();$('photo-status').replaceChildren(input);input.select();$('photo-status').append(' Copy this link.');}
});
$('download-wide').addEventListener('click',()=>{$('photo-status').textContent='Your X PNG is ready. The square is here too.';});
$('download-square').addEventListener('click',()=>{$('photo-status').textContent='Your square PNG is ready. See you in the plaza.';});

// Opt-in local browser regression run. No production path calls this.
// Capture the live page's computed DOM and its actual Rive canvas pixels with
// Chromium's SVG foreignObject rasterizer. This avoids shared-window capture
// losing the page when another local review session changes Chrome tabs.
async function browserDOMCapture(){
  const width=innerWidth,height=Math.max(innerHeight,joined?innerHeight:document.documentElement.scrollHeight);
  const ns='http://www.w3.org/1999/xhtml';
  const wrapper=document.createElementNS(ns,'div');wrapper.style.cssText='position:relative;width:'+width+'px;height:'+height+'px;background:#fff4c5;overflow:hidden';
  const asDataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  const fonts=await Promise.all(['Gilroy-Medium.ttf','Gilroy-Black.ttf'].map(async name=>asDataURL(await(await fetch('fonts/'+name)).blob())));
  const images=new Map();await Promise.all(Array.from(document.images).filter(img=>img.src).map(async img=>images.set(img,await asDataURL(await(await fetch(img.src)).blob()))));
  const style=document.createElementNS(ns,'style');style.textContent=fonts.map((url,i)=>'@font-face{font-family:Gilroy;src:url('+url+');font-weight:'+(i?900:500)+'}').join('');wrapper.append(style);
  function clone(node){
    if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent);
    if(node.nodeType!==Node.ELEMENT_NODE||['SCRIPT','LINK'].includes(node.tagName))return null;
    const copy=node.tagName==='CANVAS'?document.createElementNS(ns,'img'):node.cloneNode(false);
    const computed=getComputedStyle(node);copy.style.cssText=Array.from(computed).map(key=>key+':'+computed.getPropertyValue(key)).join(';');
    if(computed.display==='none')return copy;
    if(node.tagName==='CANVAS'){
      const instance=node.id==='ducky'?preview:world;
      if(node.id==='ducky')preview.advanceAndReportChanges(0);
      copy.src=nativePixels(instance,node.width,node.height).toDataURL('image/png');return copy;
    }
    if(node.tagName==='IMG')copy.src=images.get(node)||node.src;
    if(node.tagName==='INPUT')copy.setAttribute('value',node.value);
    if(node.tagName==='OPTION'){if(node.selected)copy.setAttribute('selected','');else copy.removeAttribute('selected');}
    if(node.tagName==='DIALOG'&&node.open){const rect=node.getBoundingClientRect();Object.assign(copy.style,{position:'absolute',left:rect.left+'px',top:rect.top+'px',margin:'0',inset:'auto',width:rect.width+'px',height:rect.height+'px'});copy.style.left=rect.left+'px';copy.style.top=rect.top+'px';}
    for(const child of node.childNodes){const next=clone(child);if(next)copy.append(next);}
    return copy;
  }
  for(const child of document.body.children){
    if(child.tagName==='DIALOG'&&child.open){const shade=document.createElementNS(ns,'div');shade.style.cssText='position:absolute;inset:0;background:'+getComputedStyle(child,'::backdrop').backgroundColor;wrapper.append(shade);}
    const next=clone(child);if(next)wrapper.append(next);
  }
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width',width);svg.setAttribute('height',height);
  const foreign=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');foreign.setAttribute('width','100%');foreign.setAttribute('height','100%');foreign.append(wrapper);svg.append(foreign);
  const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await img.decode();
  const output=document.createElement('canvas');output.width=width;output.height=height;output.getContext('2d').drawImage(img,0,0);return output;
}
async function runBrowserQA(){
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const until=async predicate=>{const end=performance.now()+25000;while(!predicate()){if(performance.now()>end)throw new Error('Browser QA timed out; keep the test tab visible.');await delay(50);}};
  const upload=async(name,canvas)=>fetch('/__qa/'+name,{method:'POST',body:await pngBlob(canvas)});
  try{
    await upload('01-join-browser',await browserDOMCapture());
    for(const [key,slot] of Object.entries(CATALOG)){
      for(let value=0;value<slot.items.length;value++){
        $('outfit-'+key).value=value;$('outfit-'+key).dispatchEvent(new Event('change'));
        assert(preview.viewModelInstance.number(key).value===value,'Wardrobe binding: '+key+' '+value);
      }
    }
    await qaLog('all-wardrobe-options',{permittedItems:33,excluded:'Acc 6'});
    const old=JSON.stringify(outfit);$('randomize').click();assert(JSON.stringify(outfit)!==old,'Randomize must change the outfit');
    await delay(100);await upload('02-randomized-browser',await browserDOMCapture());
    Object.assign(outfit,{cap:3,shades:1,acc:7,shoes:10});updatePreview();await delay(150);
    preview.advanceAndReportChanges(0);preview.pause();preview.stopRendering();await upload('wardrobe',nativePixels(preview,680,690));preview.play();preview.startRendering();
    qaDriving=true;$('name').value='pragi';$('city').value='Kochi';$('join-form').requestSubmit();
    await until(()=>joined);assert(player.action===4||reducedMotion.matches,'Native landing should be active');
    world.stopRendering();
    const advanceFrames=count=>{for(let frame=0;frame<count;frame++){advanceWorld(1/60);world.advanceAndReportChanges(1/60);}};
    await qaLog('entered',{name:player.name,city:CITIES[player.city],outfit:{...outfit},nativeAction:player.action});
    advanceFrames(18);await upload('03-landing-browser',await browserDOMCapture());await upload('landing',nativePixels(world,1600,1000));await qaLog('landing-in-progress',{time:now,action:player.action});
    advanceFrames(62);assert(now>=landingUntil&&player.action!==4&&!$('photo').disabled,'Photo mode should unlock after landing');
    await qaLog('landed',{time:now});
    await upload('04-plaza-browser',await browserDOMCapture());
    $('photo').click();await until(()=>$('photo-dialog').open);
    assert(frozen,'The plaza should freeze');const time=now,positions=JSON.stringify(ducks);await delay(350);
    assert(now===time&&JSON.stringify(ducks)===positions,'Every Ducky and game timer must remain frozen');
    await upload('05-photo-mode-browser',await browserDOMCapture());
    for(const [i,key] of ['wide','square'].entries()){
      const card=window.game.lastPhoto.cards[i],blob=await (await fetch(card.url)).blob(),image=await createImageBitmap(blob);
      assert(image.width===(i?1200:1600)&&image.height===(i?1200:900),'PNG dimensions: '+key);
      const probe=document.createElement('canvas');probe.width=image.width;probe.height=image.height;const ctx=probe.getContext('2d');ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,image.width,image.height).data;let opaque=0;const colors=new Set();
      for(let p=0;p<pixels.length;p+=160){if(pixels[p+3]>250)opaque++;colors.add(pixels[p]+','+pixels[p+1]+','+pixels[p+2]);}
      assert(opaque>image.width*image.height/40*.9&&colors.size>30,'The PNG must contain rendered artwork: '+key);
      await fetch('/__qa/'+key,{method:'POST',body:blob});image.close();
    }
    await qaLog('photo-exports',{wide:[1600,900],square:[1200,1200],frozen:true,sameSnapshot:true,subjects:window.game.lastPhoto.cards.map(card=>card.crop.subjects)});
    await upload('plaza',nativePixels(world,1600,1000));
    $('close-photo').click();assert(!frozen,'Close should resume immediately');assert(joined,'Closing photo should return to the plaza');
    $('change-outfit').click();assert(!joined&&!$('join').hidden,'Your drip should return to the wardrobe');
    assert($('name').value==='pragi'&&$('city').value==='Kochi','Identity should survive a wardrobe visit');
    qaDriving=false;await qaLog('pass',{checks:'wardrobe, randomize, join, native landing at deterministic 60 Hz, frozen frame, PNG pixels/dimensions, resume, return',errors:qaReport.errors.length});
  }catch(error){qaDriving=false;qaReport.errors.push(String(error));await qaLog('qa-failed');console.error(error);}
}
