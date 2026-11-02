import {BreadHunt} from './rules/bread-hunt.js';
import {DuckRace} from './rules/duck-race.js';
import {CITIES} from './ui.js';

export function installActivities(game){
 const ui=document.getElementById('activity-ui'),message=document.getElementById('activity-message'),accept=document.getElementById('activity-accept'),close=document.getElementById('activity-close');
 const banner=game.file.artboardByName('Activity Banner'),vm=game.file.viewModelByName('ActivityVM').instance(),machine=new game.runtime.StateMachineInstance(banner.stateMachineByName('Bindings'),banner);
 banner.bindViewModelInstance(vm);machine.bindViewModelInstance(vm);banner.frameOrigin=false;
 const phoneBanner=game.file.artboardByName('Activity Banner Phone'),phoneMachine=phoneBanner?new game.runtime.StateMachineInstance(phoneBanner.stateMachineByName('Bindings'),phoneBanner):null;
 if(phoneBanner){phoneBanner.frameOrigin=false;phoneBanner.bindViewModelInstance(vm);phoneMachine.bindViewModelInstance(vm);}
 const matrix=new game.runtime.Mat2D();
 const breadArt=game.file.artboardByName('Golden Slice');breadArt.frameOrigin=false;breadArt.advance(0);
 let active=null,offer=null,dismissed=null,resultUntil=0,pops=[],raceDucks=[],floats=[];
 const detailModel=game.file.viewModelByName('Activity Detail VM'),detailVM=detailModel?.defaultInstance();
 const detailed=detailVM?Object.fromEntries(['Race Cards','Hunt Cards','Collection Pops'].map(name=>{const art=game.file.artboardByName(name);art.frameOrigin=false;art.bindViewModelInstance(detailVM);const sm=new game.runtime.StateMachineInstance(art.stateMachineByName('Bindings'),art);sm.bindViewModelInstance(detailVM);return[name,{art,sm,animations:[]}];})):null;
 const dnum=(key,value)=>{const p=detailVM?.number(key);if(p)p.value=value;},dstr=(key,value)=>{const p=detailVM?.string(key);if(p)p.value=value;};
 const play=(card,name)=>{if(!detailed)return;const item=detailed[card],source=item.art.animationByName(name),anim=new game.runtime.LinearAnimationInstance(source,item.art);anim.remaining=source.duration/source.fps+.1;item.animations.push(anim);};
 dnum('intro',0);dnum('result',0);dnum('counter',0);
 function detailResult(){dnum('result',1);const city=CITIES[game.profile.city];
  if(active==='bread'){dstr('resultTitle','Lovely haul!');dstr('resultSub','+120 for '+city);dstr('progress','12 / 12 slices');dstr('total',city+'  '+hunt.total);play('Hunt Cards','Results');}
  else{const place=race.finishOrder.findIndex(d=>d.id===0)+1;dstr('resultTitle',place===1?'First to float!':'You came '+place+'!');dstr('resultSub','Eight Duckies, one lovely lap.');race.finishOrder.forEach((d,i)=>{dstr('row'+i,`${i+1}.  ${d.id===0?game.profile.name:d.name} / ${CITIES[d.city]}`);dstr('time'+i,`${Math.floor(d.finishTime/60)}:${(d.finishTime%60).toFixed(2).padStart(5,'0')}`);});play('Race Cards','Results');}
 }
 let totals={};try{totals=JSON.parse(localStorage.getItem('duckyLand.cityBread.v1')||'{}');}catch{}
 const show=(text,button='Start')=>{ui.hidden=false;message.textContent=text;accept.textContent=button;vm.string('message').value=text;vm.string('button').value=button;};
 const hide=()=>{ui.hidden=true;offer=null;};
 function pop(x,y){const art=game.file.artboardByName('Crumb Burst'),sm=new game.runtime.StateMachineInstance(art.stateMachineByName('Burst'),art);art.frameOrigin=false;pops.push({x,y,art,effectSM:sm,scale:1,life:.62,name:'Bread crumbs',advance(dt){sm.advanceAndApply(dt);art.advance(dt);}});game.sound?.play('pop',.1);}
 const hunt=new BreadHunt({onCollect({bread,total}){if(detailed){dnum(`b${bread.id}px`,bread.x);dnum(`b${bread.id}py`,bread.y);play('Collection Pops','Pop '+bread.id);game.sound?.play('pop',.1);}else pop(bread.x,bread.y);totals[game.profile.city]=total;try{localStorage.setItem('duckyLand.cityBread.v1',JSON.stringify(totals));}catch{}game.network?.collect(bread.id);},onFinish(){resultUntil=game.now+60;game.emote(3);detailResult();}});
 const race=new DuckRace({count:8,onCountdown(){play('Race Cards','Countdown');},onFinish(){resultUntil=game.now+60;game.emote(3);detailResult();}});
 function disposeRace(){for(const d of raceDucks){d.sm.delete();d.vm.delete();d.art.delete();}for(const f of floats){f.effectSM.delete();f.vm.delete();f.art.delete();}raceDucks=[];floats=[];}
 function stop(){if(active==='race'){disposeRace();game.player.scale=.24;const spawn=game.world.zones['race-lake'].spawn;[game.player.x,game.player.y]=spawn;game.player.action=0;game.player.path=[];game.network?.endActivity();}game.network?.endActivity();active=null;game.inputLocked=false;resultUntil=0;hide();}
 function start(kind){active=kind;offer=null;game.player.path=[];game.player.action=0;resultUntil=0;dnum('result',0);
  if(kind==='bread'){
   hunt.city=String(game.profile.city);hunt.total=Number(totals[game.profile.city])||0;hunt.start();
   const z=game.world.zones['bread-forest'];
   hunt.bread.forEach((b,i)=>{const angle=i*Math.PI/6,tx=z.x+Math.cos(angle)*330,ty=z.y+120+Math.sin(angle)*230,path=game.route(...z.spawn,tx,ty);const point=path.at(-1)||z.spawn;[b.x,b.y]=point;});
   game.network?.startActivity('bread');
  }else{
   race.city=game.profile.city;race.start();game.inputLocked=true;game.network?.startActivity('race');
   game.player.scale=.18;disposeRace();for(let i=1;i<race.count;i++){const d=game.createDuck(i,'race-lake');d.scale=.18;d.name=race.racers[i].name;d.vm.string('name').value=' '+d.name+' ';raceDucks.push(d);}
   for(let i=0;i<race.count;i++){const art=game.file.artboardByName('Race Float');if(!art)break;art.frameOrigin=false;const vm=game.file.viewModelByName('Float VM').instance(),sm=new game.runtime.StateMachineInstance(art.stateMachineByName('Float'),art);art.bindViewModelInstance(vm);sm.bindViewModelInstance(vm);vm.number('city').value=race.racers[i].city%4;floats.push({art,vm,effectSM:sm,name:'Racing float',scale:.8,x:0,y:0,advance(dt){sm.advanceAndApply(dt);art.advance(dt);}});}
  }
 }
 accept.onclick=()=>{if(active&&resultUntil){start(active);return;}if(active==='race'){race.paddle();return;}if(active==='bread'){const b=hunt.bread.find(b=>b.active);if(b)game.player.path=game.route(game.player.x,game.player.y,b.x,b.y);return;}if(offer)start(offer);};
 close.onclick=()=>{dismissed=active||offer;stop();};
 addEventListener('keydown',e=>{if(game.joined&&active==='race'&&e.code==='Space'&&!e.repeat){e.preventDefault();race.paddle();}});
 function cardLayout(){const {width,height,dpr}=game.view,scale=Math.min((width-24)/700,(height-70)/760,1);return{width,height,dpr,scale,x:width/2-800*scale,y:height/2-500*scale};}
 const activity={hunt,race,start,stop,paddle:()=>race.paddle(),get active(){return active;},get paddleMode(){return active==='race'&&!resultUntil;},get resultMode(){return !!resultUntil;},get pops(){return pops;},handleTap(x,y){if(!resultUntil)return false;const t=cardLayout(),px=(x-t.x)/t.scale,py=(y-t.y)/t.scale,by=active==='bread'?660:770;if(px>590&&px<1010&&py>by-45&&py<by+40)start(active);else if(px>590&&px<1010&&py>by+43&&py<by+105){dismissed=active;stop();}return true;}};
 game.activity=activity;
 game.updateHooks.push(dt=>{
  if(detailed){for(const item of Object.values(detailed)){item.sm.advanceAndApply(dt);for(const anim of item.animations){anim.advance(dt);anim.apply(1);anim.remaining-=dt;}item.art.advance(dt);item.animations=item.animations.filter(anim=>{if(anim.remaining>0)return true;anim.delete();return false;});}}
  for(const p of pops){p.life-=dt;if(p.life<=0){p.effectSM.delete();p.art.delete();}}pops=pops.filter(p=>p.life>0);
  if(!game.joined)return;
  const inBread=Math.hypot(game.player.x-1390,game.player.y-1780)<550,inRace=Math.hypot(game.player.x-4155,game.player.y-2070)<220;
  if(!inBread&&!inRace)dismissed=null;
  if(!active){const kind=inBread?'bread':inRace?'race':null;if(kind&&kind!==dismissed){offer=kind;show(kind==='bread'?'Bread Hunt · 12 golden slices':'Duck Race · one lovely lap');}else hide();return;}
  if(active==='bread'){
   hunt.player.x=game.player.x;hunt.player.y=game.player.y;hunt.update(dt);
   show(resultUntil?'+120 bread for your flock!':`Bread Hunt · ${hunt.collected} / 12`,resultUntil?'Again':'Waddle');
  }else{
   race.update(dt);
   const racers=[game.player,...raceDucks];for(let i=0;i<racers.length;i++){const d=racers[i],r=race.racers[i],a=r.progress*Math.PI*2;d.x=r.x+3340;d.y=r.y+960;d.action=r.action;d.targetTurn=Math.atan2(Math.cos(a),-Math.sin(a))*180/Math.PI;if(floats[i]){floats[i].x=d.x;floats[i].y=d.y+.5;}}
   if(race.phase==='countdown')show('Duck Race · '+Math.max(1,Math.ceil(race.countdown)),'Paddle');
   else if(resultUntil){const place=race.finishOrder.findIndex(d=>d.id===0)+1;show(`Finished · place ${place} of ${race.count}`,'Again');}
   else show('Duck Race · tap or press Space','Paddle');
  }
  if(resultUntil&&game.now>resultUntil){dismissed=active;stop();}
 });
 game.drawHooks.push(()=>[...(active==='bread'?hunt.bread.filter(b=>b.active).map(b=>({...b,art:breadArt,scale:1,name:'Golden slice'})):[]),...pops,...raceDucks,...floats]);
 game.overlayHooks.push((renderer,dt)=>{
  if(detailed){
   const pop=detailed['Collection Pops'];if(pop.animations.length){const {width,height,dpr}=game.view,s=game.camera.zoom*dpr;Object.assign(matrix,{xx:s,xy:0,yx:0,yy:s,tx:width*dpr/2-game.camera.x*s,ty:height*dpr/2-game.camera.y*s});renderer.save();renderer.transform(matrix);pop.art.draw(renderer);renderer.restore();}
   if(active&&(resultUntil||active==='race'&&(race.phase==='countdown'||race.phase==='racing'&&race.elapsed<1))){const t=cardLayout();Object.assign(matrix,{xx:t.scale*t.dpr,xy:0,yx:0,yy:t.scale*t.dpr,tx:t.x*t.dpr,ty:t.y*t.dpr});renderer.save();renderer.transform(matrix);detailed[active==='bread'?'Hunt Cards':'Race Cards'].art.draw(renderer);renderer.restore();}
  }
  if(resultUntil&&detailed){const t=cardLayout(),by=active==='bread'?660:770;ui.style.cssText=`position:fixed;left:0;bottom:0;transform:none;width:${t.width}px;height:${t.height}px`;accept.style.cssText=`position:absolute;left:${t.x+610*t.scale}px;top:${t.y+(by-36)*t.scale}px;width:${380*t.scale}px;height:${72*t.scale}px;min-height:44px`;close.style.cssText=`position:absolute;left:${t.x+610*t.scale}px;top:${t.y+(by+43)*t.scale}px;width:${380*t.scale}px;height:${49*t.scale}px;min-height:44px`;return;}
  ui.style.left='50%';ui.style.transform='translateX(-50%)';
  if(ui.hidden)return;const {width,height,dpr}=game.view,phone=width<700&&phoneBanner,scale=Math.min(1,(width-24)/(phone?340:680)),y=height-(phone?74:58)-Math.max(0,Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom'))||0);
  if(phone){phoneMachine.advanceAndApply(0);phoneBanner.advance(0);}else{machine.advanceAndApply(0);banner.advance(0);}Object.assign(matrix,{xx:dpr*scale,xy:0,yx:0,yy:dpr*scale,tx:width*dpr/2,ty:y*dpr});renderer.save();renderer.transform(matrix);(phone?phoneBanner:banner).draw(renderer);renderer.restore();
  if(phone){ui.style.width=(340*scale)+'px';ui.style.height=(104*scale)+'px';ui.style.bottom=(height-y-52*scale)+'px';accept.style.cssText=`position:absolute;left:${49*scale}px;top:${55*scale}px;width:${112*scale}px;height:${44*scale}px`;close.style.cssText=`position:absolute;left:${179*scale}px;top:${55*scale}px;width:${112*scale}px;height:${44*scale}px`;return;}
  ui.style.width=(670*scale)+'px';ui.style.height=(76*scale)+'px';ui.style.bottom=(height-y-38*scale)+'px';
  accept.style.cssText=`position:absolute;left:${(335+155)*scale}px;top:${15*scale}px;width:${85*scale}px;height:${46*scale}px`;close.style.cssText=`position:absolute;left:${(335+246)*scale}px;top:${15*scale}px;width:${74*scale}px;height:${46*scale}px`;
 });
}
