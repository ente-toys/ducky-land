// Join catalog, safe URL round-trip and native postcard compositing adapted
// from the onboarding session. This module never owns a second world loop.
export const CITIES=['Kochi','Chennai','Bengaluru','London','Mumbai','Delhi','Hyderabad','Pune','Other'];
export const CATALOG={
 cap:{label:'Cap',items:['None',...Array.from({length:13},(_,i)=>'CAP '+(i+1))]},
 shades:{label:'Shades',items:['None','Shades 2','Shades 8','Shades 12']},
 acc:{label:'Accessory',items:['None','Acc 4','Acc 5','Acc 8','Acc 9','Acc 10','Acc 11','Acc 12']},
 shoes:{label:'Shoes',items:['None',...[1,2,5,6,7,8,9,10,11,12].map(i=>'Shoes '+i)]}
};
const cleanName=value=>[...String(value).replace(/[\u0000-\u001f\u007f]/g,'').trim()].slice(0,18).join('');
const $=id=>document.getElementById(id);
const png=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG export failed')),'image/png'));

export async function installUI(game){
 const params=new URLSearchParams(location.search),outfit={cap:8,shades:1,acc:0,shoes:2};
 for(const [key,slot]of Object.entries(CATALOG)){
  const raw=params.get(key)??(key==='acc'?params.get('accessory'):null);
  if(raw!==null&&/^\d+$/.test(raw)&&Number(raw)<slot.items.length)outfit[key]=Number(raw);
 }
 $('name').value=cleanName(params.get('name')||'');
 const urlCity=CITIES.find(c=>c.toLowerCase()===(params.get('city')||'').toLowerCase());
 if(urlCity)$('city').value=urlCity;
 let preview,joined=false,cardRenderers,urls=[],toastTimer,landingStart=null,photoBusy=false;
 game.updateHooks.push((dt,now)=>{if(landingStart===null)return;const t=Math.min(1,(now-landingStart)/1.1);game.player.controls.arrival.value=-1+2*t;game.player.controls.tagVisible.value=t===1?1:0;if(t===1){landingStart=null;game.inputLocked=false;game.player.until=0;}});
 game.profile={name:'you',city:1,...outfit};game.joined=false;
 const toast=message=>{ $('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);};
 game.toast=toast;
 function outfitURL(){const url=new URL(location.href);for(const key of ['name','city',...Object.keys(CATALOG)])url.searchParams.delete(key);for(const [k,v]of Object.entries(outfit))url.searchParams.set(k,v);const name=cleanName($('name').value);if(name)url.searchParams.set('name',name);if($('city').value)url.searchParams.set('city',$('city').value);return url.href;}
 function update(){for(const key of Object.keys(CATALOG)){const value=outfit[key];$('outfit-'+key).value=value;$('count-'+key).textContent=value===0?'Nothing on. Still a look.':value+' of '+(CATALOG[key].items.length-1);if(preview)preview.viewModelInstance.number(key).value=value;}history.replaceState(null,'',outfitURL());}
 for(const [key,slot]of Object.entries(CATALOG)){
  const section=document.createElement('div');section.className='slot';
  const label=document.createElement('label');label.className='slot-label';label.htmlFor='outfit-'+key;label.textContent=slot.label;
  const picker=document.createElement('div');picker.className='slot-picker';const select=document.createElement('select');select.id='outfit-'+key;
  slot.items.forEach((name,i)=>select.add(new Option(name,i)));select.onchange=()=>{outfit[key]=Number(select.value);update();};
  function arrow(delta){const b=document.createElement('button');b.type='button';b.textContent=delta<0?'‹':'›';b.setAttribute('aria-label',(delta<0?'Previous ':'Next ')+slot.label.toLowerCase());b.onclick=()=>{outfit[key]=(outfit[key]+delta+slot.items.length)%slot.items.length;update();};return b;}
  picker.append(arrow(-1),select,arrow(1));const count=document.createElement('span');count.id='count-'+key;count.className='slot-number';section.append(label,picker,count);$(key==='cap'||key==='shades'?'slots-left':'slots-right').append(section);
 }
 $('randomize').onclick=()=>{for(const [k,v]of Object.entries(CATALOG))outfit[k]=Math.floor(Math.random()*v.items.length);update();};
 $('name').onchange=update;$('city').onchange=update;update();
 const bytes=await fetch('ducky-land.riv?v='+Date.now()).then(r=>r.arrayBuffer());
 function load(artboard,canvas,machine){return new Promise((resolve,reject)=>{const r=new rive.Rive({buffer:bytes,canvas,artboard,stateMachines:machine,autoplay:true,autoBind:true,layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),onLoad:()=>resolve(r),onLoadError:reject});});}
 preview=await load('Ducky',$('ducky'),'Ducky');
 preview.viewModelInstance.number('tagVisible').value=0;preview.viewModelInstance.number('turn').value=360;
 const resize=()=>{if(!joined)preview.resizeDrawingSurfaceToCanvas(Math.min(devicePixelRatio||1,1.5));};
 addEventListener('resize',resize);update();resize();
 $('enter').disabled=false;$('enter').textContent='Waddle in ↗';
 function join(profile){
  const name=cleanName(profile.name);if(!name)return false;
  const city=Number(profile.city);if(!Number.isInteger(city)||city<0||city>=CITIES.length)return false;
  for(const key of Object.keys(CATALOG)){const n=Number(profile[key]);if(Number.isInteger(n)&&n>=0&&n<CATALOG[key].items.length)outfit[key]=n;}
  Object.assign(game.player,outfit,{name,city,action:0,until:game.now+1.1,path:[]});
  for(const key of ['cap','shades','acc','shoes','city'])game.player.controls[key].value=game.player[key];
  game.player.vm.string('name').value=' '+name+' ';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;landingStart=reduced?null:game.now;game.player.controls.arrival.value=reduced?1:-1;game.player.controls.tagVisible.value=reduced?1:0;
  game.profile={name,city,...outfit};game.joined=true;joined=true;game.paused=false;game.inputLocked=!reduced;
  $('join').hidden=true;$('world').hidden=false;preview.pause();preview.stopRendering();game.resize();
  $('world-canvas').focus({preventScroll:true});update();game.network?.join(game.profile);
  return true;
 }
 game.join=join;
 $('join-form').onsubmit=e=>{e.preventDefault();if(!$('join-form').reportValidity())return;join({name:$('name').value,city:CITIES.indexOf($('city').value),...outfit});};
 function closeMenu(){if($('menu').open)$('menu').close();game.inputLocked=!!game.activity?.paddleMode;game.keys.clear();}
 game.openMenu=()=>{if(!joined||$('photo-dialog').open||$('menu').open)return;game.keys.clear();game.player.path=[];game.inputLocked=true;document.querySelectorAll('[data-emote]').forEach(b=>b.disabled=!!game.activity?.paddleMode);$('menu').showModal();};
 $('close-menu').onclick=closeMenu;$('menu').addEventListener('close',()=>{game.inputLocked=!!game.activity?.paddleMode;game.keys.clear();});
 $('menu').addEventListener('click',e=>{if(e.target===$('menu'))closeMenu();});
 document.querySelectorAll('[data-emote]').forEach(b=>b.onclick=()=>{closeMenu();game.emote(Number(b.dataset.emote));});
 $('change-outfit').onclick=()=>{closeMenu();game.activity?.stop();joined=false;game.joined=false;game.inputLocked=true;game.player.path=[];$('world').hidden=true;$('join').hidden=false;preview.play();preview.startRendering();resize();};
 $('sound-toggle').onclick=()=>{game.sound.muted=!game.sound.muted;$('sound-toggle').textContent=game.sound.muted?'Sound off':'Sound on';};
 function nativePixels(instance,w,h){const c=instance.canvas,oldW=c.width,oldH=c.height;
  function render(width,height){c.width=width;c.height=height;const renderer=instance.renderer;renderer.clear();renderer.save();renderer.align(instance.layout.runtimeFit(instance.runtime),instance.layout.runtimeAlignment(instance.runtime),{minX:0,minY:0,maxX:width,maxY:height},instance.artboard.bounds);instance.artboard.draw(renderer);renderer.restore();renderer.flush();instance.runtime.resolveAnimationFrame?.();}
  render(w,h);const copy=document.createElement('canvas');copy.width=w;copy.height=h;copy.getContext('2d').drawImage(c,0,0);render(oldW,oldH);return copy;
 }
 async function postcard(snapshot,index){const w=index?1200:1600,h=index?1200:900,ph=index?902:622,pw=w-96,frame=cardRenderers[index];
  frame.viewModelInstance.string('signature').value=game.player.name+' · '+CITIES[game.player.city];frame.advanceAndReportChanges(0);
  const card=nativePixels(frame,w,h),ctx=card.getContext('2d'),scale=Math.max(pw/snapshot.width,ph/snapshot.height),sw=pw/scale,sh=ph/scale;
  ctx.save();ctx.beginPath();ctx.roundRect(48,158,pw,ph,25);ctx.clip();ctx.drawImage(snapshot,(snapshot.width-sw)/2,(snapshot.height-sh)/2,sw,sh,48,158,pw,ph);ctx.restore();
  return {url:URL.createObjectURL(await png(card)),width:w,height:h};
 }
 game.openPhoto=async()=>{if(!joined||landingStart!==null||photoBusy||$('photo-dialog').open)return;photoBusy=true;closeMenu();game.paused=true;game.inputLocked=true;game.keys.clear();
  try{if(!cardRenderers)cardRenderers=await Promise.all(['Photo Wide','Photo Square'].map(async(name,i)=>{const c=document.createElement('canvas');c.width=i?1200:1600;c.height=i?1200:900;const r=await load(name,c,'Card');r.pause();r.stopRendering();return r;}));
   const snapshot=game.captureView(1600,1000,2);
   urls.forEach(URL.revokeObjectURL);const cards=await Promise.all([postcard(snapshot,0),postcard(snapshot,1)]);urls=cards.map(c=>c.url);
   $('photo-preview').src=cards[0].url;$('download-wide').href=cards[0].url;$('download-square').href=cards[1].url;$('photo-status').textContent='Two PNGs, the same little moment.';game.lastPhoto={cards,time:game.now,player:{...game.profile}};$('photo-dialog').showModal();
  }catch(e){console.error(e);game.paused=false;game.inputLocked=false;toast('That photo slipped away. Try once more.');}finally{photoBusy=false;}
 };
 $('open-photo').onclick=game.openPhoto;$('close-photo').onclick=()=>$('photo-dialog').close();
 $('photo-dialog').addEventListener('close',()=>{game.paused=false;game.inputLocked=false;game.keys.clear();$('world-canvas').focus();});
 $('photo-dialog').addEventListener('click',event=>{if(event.target!==$('photo-dialog'))return;const r=$('photo-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('photo-dialog').close();});
 $('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(outfitURL());$('photo-status').textContent='Your drip link is copied.';}catch{const input=document.createElement('input');input.value=outfitURL();$('photo-status').replaceChildren(input);input.select();}};
 addEventListener('keydown',e=>{if(!joined||e.target.closest?.('input,select'))return;if(e.key==='Escape'&&!$('photo-dialog').open&&!$('menu').open){e.preventDefault();game.openMenu();}if(e.key.toLowerCase()==='p'&&!e.repeat&&!game.inputLocked){e.preventDefault();game.openPhoto();}});
 game.outfit=outfit;game.preview=preview;game.outfitURL=outfitURL;
 if(params.get('joined')==='1')join({name:params.get('name')||'you',city:CITIES.indexOf(urlCity||'Chennai'),...outfit});
}
