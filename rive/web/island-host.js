import { installAssets } from './assets.js';
import { installLife } from './life.js';
import { clamp, fitZoom, zoomAt, easeCamera } from './island-camera.mjs';

async function start() {
  const game = window.game;
  await installAssets(game);
  game.joined = true;
  installLife(game);
  const canvas = document.getElementById('world-canvas');
  const atmosphere = document.getElementById('atmosphere');
  const ctx = atmosphere.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let follow = false, fit = true;
  const target = { ...game.camera };
  const pointers = new Map();
  let gesture = null, tap = null, marker = null, lastEmote = 0;
  const timers = new Set();
  const minimumZoom = () => fitZoom(innerWidth, innerHeight, game.world.width, game.world.height);
  function fitIsland() {
    target.x = game.world.width / 2;
    target.y = game.world.height / 2;
    target.zoom = minimumZoom();
    follow = false; fit = true;
  }
  fitIsland();
  Object.assign(game.camera, target);
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    atmosphere.width = Math.round(innerWidth * dpr);
    atmosphere.height = Math.round(innerHeight * dpr);
    // The base engine refits on resize. Preserve an explored camera when appropriate.
    if (fit) fitIsland();
    Object.assign(game.camera, target);
  }
  resize();
  addEventListener('resize', resize);
  const distance = () => { const [a,b] = [...pointers.values()]; return Math.hypot(a.x-b.x,a.y-b.y); };
  const midpoint = () => { const [a,b] = [...pointers.values()]; return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}; };
  function constrain() {
    target.x = clamp(target.x, 250, game.world.width - 250);
    target.y = clamp(target.y, 200, game.world.height - 200);
  }
  canvas.addEventListener('wheel', event => {
    event.preventDefault(); follow = false; fit = false;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    const next = clamp(target.zoom * Math.exp(-delta * .0018), minimumZoom() * .8, 1.8);
    zoomAt(target, next, event.clientX, event.clientY, innerWidth, innerHeight);
    constrain();
  }, {passive:false});
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.button !== 1) return;
    canvas.focus({preventScroll:true});
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
    Object.assign(target, game.camera);
    follow = false;
    if (pointers.size === 1) {
      tap = {x:event.clientX,y:event.clientY,at:performance.now(),moved:false};
      gesture = {x:event.clientX,y:event.clientY,camera:{...target}};
    } else if(pointers.size === 2) {
      tap = null;
      gesture = {distance:distance(),mid:midpoint(),camera:{...target}};
    }
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
    if (pointers.size === 2 && gesture?.distance) {
      fit = false;
      const mid = midpoint(), next = clamp(gesture.camera.zoom * distance() / Math.max(gesture.distance,1),minimumZoom()*.8,1.8);
      Object.assign(target, gesture.camera);
      zoomAt(target,next,gesture.mid.x,gesture.mid.y,innerWidth,innerHeight);
      target.x -= (mid.x-gesture.mid.x)/next;
      target.y -= (mid.y-gesture.mid.y)/next;
      constrain();
    } else if(pointers.size === 1 && gesture?.camera && tap) {
      const dx=event.clientX-tap.x,dy=event.clientY-tap.y;
      if(Math.hypot(dx,dy)>6)tap.moved=true;
      if(tap.moved){fit=false;canvas.classList.add('dragging');target.x=gesture.camera.x-dx/target.zoom;target.y=gesture.camera.y-dy/target.zoom;constrain();}
    }
  });
  function finish(event, cancelled=false) {
    if(!pointers.has(event.pointerId))return;
    const single = pointers.size===1;
    pointers.delete(event.pointerId);
    if(single && tap && !tap.moved && !cancelled){
      const [x,y]=game.toWorld(event.clientX,event.clientY);
      // Tapping any duck elicits a little greeting; tapping your duck twice dances.
      const hit=game.ducks.find(d=>Math.hypot(d.x-x,d.y-50-y)<Math.max(65,20/game.camera.zoom));
      if(hit){
        if(hit.player){const now=performance.now();game.emote(now-lastEmote<450?3:2);lastEmote=now;}
        else {game.quack(hit);hit.targetTurn=Math.atan2(game.player.x-hit.x,game.player.y-hit.y)*180/Math.PI;game.emote(6);}
      } else {
        canvas.dispatchEvent(new CustomEvent('worldtap',{detail:{x:event.clientX,y:event.clientY}}));
        const destination=game.player.path.at(-1);
        if(destination)marker={x:destination[0],y:destination[1],at:game.now};
      }
    }
    tap=null;gesture=null;canvas.classList.remove('dragging');
  }
  canvas.addEventListener('pointerup',e=>finish(e));
  canvas.addEventListener('pointercancel',e=>finish(e,true));
  canvas.addEventListener('lostpointercapture',e=>finish(e,true));
  const clear=()=>{pointers.clear();tap=null;gesture=null;canvas.classList.remove('dragging');};
  addEventListener('blur',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  addEventListener('keydown',event=>{
    if(event.key==='Home'||event.key==='0'){event.preventDefault();fitIsland();}
    if(event.key==='+'||event.key==='='||event.key==='-'){
      event.preventDefault();fit=false;follow=false;
      zoomAt(target,clamp(target.zoom*(event.key==='-'?.8:1.25),minimumZoom()*.8,1.8),innerWidth/2,innerHeight/2,innerWidth,innerHeight);
    }
    if(event.key.toLowerCase()==='f'){
      follow=true;fit=false;target.zoom=Math.max(target.zoom,.65);
    }
  });

  const vegetation=/tree|reeds|cattails|flower|leaf|bush/i;
  const boats=/sailboat|rowboat/i;
  game.environment={
    transform(entity,matrix,time){
      if(reduced.matches)return;
      const name=entity.asset||entity.name;
      const phase=entity.x*.004+entity.y*.002;
      const gust=.35+.65*(.5+.5*Math.sin(time*.38));
      if(vegetation.test(name))matrix.yx+=Math.sin(time*1.5+phase)*.016*gust*(entity.scale||1);
      if(/flag|bunting|umbrella/i.test(name))matrix.yx+=Math.sin(time*3+phase)*.024*gust*(entity.scale||1);
      if(boats.test(name)){matrix.ty+=Math.sin(time*1.4+phase)*3;matrix.xy=Math.sin(time*.9+phase)*.012*(entity.scale||1);}
    },
  };
  // Pause between steps, gently face nearby ducks, and return the player's greeting.
  let lastAction=0, elapsed=0;
  game.updateHooks.push((dt,time)=>{
    if(follow){target.x=game.player.x;target.y=game.player.y-90;}
    if(game.player.action===1 && !fit && !pointers.size){
      const [sx,sy]=game.toScreen(game.player.x,game.player.y);
      if(sx<80||sx>innerWidth-80||sy<70||sy>innerHeight-70){follow=true;fit=false;}
    }
    easeCamera(game.camera,target,dt,reduced.matches);
    if(game.player.action===2&&lastAction!==2){
      game.ducks.filter(d=>!d.player&&Math.hypot(d.x-game.player.x,d.y-game.player.y)<650).slice(0,3).forEach((d,i)=>{
        const timer=setTimeout(()=>{timers.delete(timer);game.quack(d);d.targetTurn=Math.atan2(game.player.x-d.x,game.player.y-d.y)*180/Math.PI;},350+i*260);timers.add(timer);
      });
    }
    lastAction=game.player.action;
    elapsed+=dt;
    if(elapsed>2){elapsed=0;for(const d of game.ducks){if(d.player||d.action!==0)continue;const friend=game.ducks.find(other=>other!==d&&Math.hypot(other.x-d.x,other.y-d.y)<220);if(friend)d.targetTurn=Math.atan2(friend.x-d.x,friend.y-d.y)*180/Math.PI;}}
  });
  // Small, bounded overlay: water rings, windblown leaves, and the walk destination.
  game.overlayHooks.push(()=>{
    const dpr=atmosphere.width/innerWidth;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
    if(!reduced.matches){
      const time=game.now;
      ctx.lineWidth=1.1;
      for(let i=0;i<26;i++){
        const lake=game.world.water[i%2],phase=(time*.11+i*.173)%1;
        const x=lake.x+Math.sin(i*13.1)*lake.rx*.72,y=lake.y+Math.cos(i*7.3)*lake.ry*.72;
        const [sx,sy]=game.toScreen(x,y),r=(12+phase*48)*game.camera.zoom;
        ctx.strokeStyle=`rgba(236,253,255,${Math.sin(phase*Math.PI)*.25})`;
        ctx.beginPath();ctx.ellipse(sx,sy,r,r*.35,0,0,Math.PI*2);ctx.stroke();
      }
      for(let i=0;i<16;i++){
        const phase=(time*.045+i*.137)%1,x=900+(i*319)%3800+phase*260,y=1000+(i*467)%1900+Math.sin(phase*6+i)*45;
        const [sx,sy]=game.toScreen(x,y);
        ctx.save();ctx.translate(sx,sy);ctx.rotate(phase*5+i);ctx.fillStyle=`rgba(238,220,131,${Math.sin(phase*Math.PI)*.7})`;ctx.beginPath();ctx.ellipse(0,0,7*game.camera.zoom,3*game.camera.zoom,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
    if(marker){const age=game.now-marker.at;if(age>1.5)marker=null;else{const [x,y]=game.toScreen(marker.x,marker.y);ctx.strokeStyle=`rgba(255,255,240,${1-age/1.5})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,(20+age*18)*game.camera.zoom,(9+age*8)*game.camera.zoom,0,0,Math.PI*2);ctx.stroke();}}
  });
  addEventListener('pagehide',()=>{for(const timer of timers)clearTimeout(timer);timers.clear();});
  canvas.focus({preventScroll:true});
  game.sceneReady=true;
  // DOM status supports accessibility and automated smoke checks without visible UI.
  canvas.dataset.ready='true';
}
function boot(){start().catch(error=>{console.error(error);const el=document.getElementById('error');el.hidden=false;el.textContent='The island could not load. Please refresh to try again.';});}
if(window.game?.ready)boot();else addEventListener('ducky-ready',boot,{once:true});
