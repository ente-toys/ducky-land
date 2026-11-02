// Floating drag joystick, pointer capture, tap routing and visibility resets
// adapted from codex-mobile. Nothing remains on screen after release.
export function installControls(game){
 const canvas=document.getElementById('world-canvas');
 const stick={id:null,x:0,y:0,dx:0,dy:0,strength:1,dragged:false,began:0};
 let hold,lastTap=0;
 const mobileKeys=['a','d','w','s'];
 const clear=()=>{for(const k of mobileKeys)game.keys.delete(k);stick.id=null;stick.dx=stick.dy=0;stick.strength=1;clearTimeout(hold);};
 function release(event,cancelled){if(event.pointerId!==stick.id)return;clearTimeout(hold);const tap=!cancelled&&!stick.dragged&&performance.now()-stick.began<500;clear();if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(!tap||(game.inputLocked&&!game.activity?.paddleMode&&!game.activity?.resultMode))return;
  if(game.activity?.handleTap?.(event.clientX,event.clientY))return;
  if(game.activity?.paddleMode){game.activity.paddle();return;}
  const p=game.toScreen(game.player.x,game.player.y-60),near=Math.hypot(event.clientX-p[0],event.clientY-p[1])<95;
  if(near&&performance.now()-lastTap<420){lastTap=0;game.openMenu?.();return;}
  lastTap=near?performance.now():0;
  canvas.dispatchEvent(new CustomEvent('worldtap',{detail:{x:event.clientX,y:event.clientY}}));
 }
 canvas.addEventListener('pointerdown',event=>{if(!game.joined||(game.inputLocked&&!game.activity?.paddleMode&&!game.activity?.resultMode)||stick.id!==null||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);
  Object.assign(stick,{id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0,dragged:false,began:performance.now()});game.player.path=[];
  hold=setTimeout(()=>{if(stick.id!==null&&!stick.dragged){clear();game.openMenu?.();}},650);
 });
 canvas.addEventListener('pointermove',event=>{if(event.pointerId!==stick.id||game.inputLocked)return;const dx=event.clientX-stick.x,dy=event.clientY-stick.y,length=Math.hypot(dx,dy);if(length>7){stick.dragged=true;clearTimeout(hold);}if(!stick.dragged)return;
  const travel=Math.min(36,length);stick.dx=dx/(length||1)*travel;stick.dy=dy/(length||1)*travel;stick.strength=Math.max(0,Math.min(1,(length-6)/30));
  for(const k of mobileKeys)game.keys.delete(k);
  if(Math.abs(dx)>length*.32)game.keys.add(dx<0?'a':'d');if(Math.abs(dy)>length*.32)game.keys.add(dy<0?'w':'s');
 });
 canvas.addEventListener('pointerup',e=>release(e,false));canvas.addEventListener('pointercancel',e=>release(e,true));canvas.addEventListener('lostpointercapture',clear);
 addEventListener('blur',()=>{clear();game.keys.clear();game.player.path=[];});
 addEventListener('resize',()=>{clear();game.keys.clear();game.player.path=[];});
 document.addEventListener('visibilitychange',()=>{clear();game.keys.clear();game.player.path=[];});
 const base=game.file.artboardByName('Joystick Base'),knob=game.file.artboardByName('Joystick Thumb'),matrix=new game.runtime.Mat2D();
 if(base)base.frameOrigin=false;if(knob)knob.frameOrigin=false;
 game.overlayHooks.push(renderer=>{if(stick.id===null||!stick.dragged||game.inputLocked||!base||!knob)return;const dpr=game.view.dpr;Object.assign(matrix,{xx:dpr,xy:0,yx:0,yy:dpr,tx:stick.x*dpr,ty:stick.y*dpr});renderer.save();renderer.transform(matrix);base.draw(renderer);renderer.translate(stick.dx,stick.dy);knob.draw(renderer);renderer.restore();});
 const requested=new URLSearchParams(location.search).get('quality'),constrained=navigator.connection?.saveData||navigator.deviceMemory&&navigator.deviceMemory<=2||navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4;
 let samples=[],slow=0,quality=requested==='low'||requested!=='high'&&constrained?'low':'high';
 game.updateHooks.push(dt=>{if(!dt)return;samples.push(dt);if(samples.length<120)return;const average=samples.reduce((a,b)=>a+b,0)/samples.length;samples=[];slow=average>.03?slow+1:0;if(slow>=3&&quality==='high'){quality='low';const url=new URL(location.href);url.searchParams.set('quality','low');history.replaceState(null,'',url);game.resize();}});
 game.controls={stick,stop:clear,get quality(){return quality;},get strength(){return stick.id!==null&&stick.dragged?stick.strength:1;}};
}
