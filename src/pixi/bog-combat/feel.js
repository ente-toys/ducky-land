import {ColorMatrixFilter} from 'pixi.js';
import {PAINT,RULES} from './rules.js';

export const HIT_SHAKE_MS=150,HIT_STOP_MS=40,HIT_VIGNETTE_MS=240;

// Only authoritative snapshot events cause a hit or a tag. Seeding the first
// snapshot prevents old kill-feed entries replaying on entry or reconnect.
export function createCombatFeedback({onHit=()=>{},onTag=()=>{},onGhost=()=>{},onRespawn=()=>{},onPickup=()=>{}}={}){
  let previous=null,identity=null,lastEvent=0,alive;
  return {observe(snapshot,self){
    if(snapshot===previous)return;
    const id=self?.id??null;
    if(!previous||id!==identity||snapshot.tick<previous.tick){
      lastEvent=0;for(const e of snapshot.events??[])lastEvent=Math.max(lastEvent,e.id);
      alive=self?.alive;identity=id;previous=snapshot;return;
    }
    for(const event of snapshot.events??[]){
      if(event.id<=lastEvent)continue;lastEvent=event.id;
      if(snapshot.time-event.time>.5)continue;
      const splat=snapshot.splats?.find(s=>s.kind==='tag'&&s.victim===event.victimId&&Math.abs(s.born-event.time)<.2);
      const palette=PAINT[splat?.team??event.team]??PAINT.privacy;
      const colour=palette[(splat?.colour??0)%palette.length];
      if(id&&event.victimId===id)onHit(colour,event);
      if(id&&event.actorId===id)onTag(event);
      onGhost(event,snapshot);
    }
    // Authority identifies the collector, so nearby ducks and predicted motion
    // cannot trigger a local pickup chime. Seeded snapshots never replay it.
    if(id)for(const spot of snapshot.pickups??[]){
      const before=previous.pickups?.find(p=>p.id===spot.id);
      const age=snapshot.time-(spot.readyAt-RULES.pickupRespawn);
      if(before&&spot.readyAt>before.readyAt&&spot.collectedBy===id&&age>=-1e-6&&age<.5)onPickup(spot);
    }
    if(id&&alive===false&&self.alive===true)onRespawn();
    alive=self?.alive;previous=snapshot;
  }};
}

// Reusable output, no random numbers, objects or timers on the render path.
export function createHitFeelState(){
  let hitAt=-Infinity,stopUntil=0,presentTag=false;
  return {colour:PAINT.privacy[0],
    hit(now,colour){hitAt=now;this.colour=colour;},
    tag(){presentTag=true;},
    shouldHold(now,reducedMotion){
      if(presentTag){presentTag=false;stopUntil=reducedMotion?0:now+HIT_STOP_MS;return false;}
      return !reducedMotion&&now<stopUntil;
    },
    sample(now,reducedMotion,out){
      const age=now-hitAt,shake=Math.max(0,1-age/HIT_SHAKE_MS);
      out.x=reducedMotion||!shake?0:Math.sin(age*.16)*5*shake;
      out.y=reducedMotion||!shake?0:Math.cos(age*.19)*4*shake;
      out.alpha=Math.max(0,1-age/HIT_VIGNETTE_MS)*.6;
      return out;
    },
  };
}

// Flat, ink-edged corner splats leave the centre and HUD readable. Inline SVG
// avoids textures, requests and raster art, and the overlay never takes input.
function paintEdge(canvas){
  const document=canvas?.ownerDocument;if(!document?.body)return null;
  const node=document.createElement('div');node.setAttribute('aria-hidden','true');
  node.className='bog-hit-paint';
  node.style.cssText='position:fixed;inset:0;z-index:70;pointer-events:none;opacity:0;color:#08c225;contain:strict';
  const corner='<path d="M-8-8H175C172 5 153 13 134 12C124 33 108 24 100 35C110 56 91 64 76 47C66 42 57 55 48 44C35 67 14 60 19 38C3 40-5 24-8 20Z"/><ellipse cx="47" cy="81" rx="9" ry="12"/><circle cx="111" cy="51" r="6"/>';
  node.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1000 700" preserveAspectRatio="none" fill="currentColor" stroke="#232323" stroke-width="3" stroke-linejoin="round"><g>'+corner+'</g><g transform="translate(1000 0) scale(-1 1)">'+corner+'</g><g transform="translate(0 700) scale(1 -1)">'+corner+'</g><g transform="translate(1000 700) scale(-1 -1)">'+corner+'</g></svg>';
  document.body.appendChild(node);return node;
}

export function createBogFeel(engine,{playSound=()=>{},now=()=>performance.now()}={}){
  const state=createHitFeelState(),output={x:0,y:0,alpha:0},edge=paintEdge(engine.canvas);
  const white=new ColorMatrixFilter();
  white.matrix=[0,0,0,0,1, 0,0,0,0,1, 0,0,0,0,1, 0,0,0,1,0];
  const whiteFilters=[white],pending=new Map(),flashes=Array.from({length:32},()=>({root:null,filters:null}));
  let flashed=0,reduced=false,disposed=false,frameTime=0,edgeAnimation=null;
  const expire=(until,id)=>{if(frameTime>until)pending.delete(id);};
  const feedback=createCombatFeedback({
    onHit(colour){
      state.hit(now(),colour);
      if(edge){
        edge.style.color='#'+colour.toString(16).padStart(6,'0');edge.style.opacity='.6';
        edgeAnimation?.cancel();
        edgeAnimation=edge.animate?.([{opacity:.6},{opacity:0}],{duration:HIT_VIGNETTE_MS,easing:'linear',fill:'forwards'})??null;
      }
      playSound('splat');
    },
    onTag(event){state.tag();pending.set(event.victimId,now()+200);playSound('splat');playSound('tag');},
    onGhost(event,snapshot){const p=snapshot.players.find(p=>p.id===event.victimId);if(p&&(!engine.camera||Math.hypot(p.x-engine.camera.x,p.y-engine.camera.y)<900))playSound('ghost');},
    onRespawn(){playSound('respawn');},
    onPickup(){playSound('pickup');},
  });
  const app=engine.app,render=app?.render;
  // Holding presentation never pauses the room, input, simulation or network.
  function present(){
    const time=now();if(state.shouldHold(time,reduced))return;
    state.sample(time,reduced,output);
    const scene=engine.scene;
    if(!scene)return render.call(this);
    const x=scene.x,y=scene.y;scene.position.set(x+output.x,y+output.y);
    try{return render.call(this);}finally{scene.position.set(x,y);}
  }
  if(render)app.render=present;
  function restore(){
    for(let i=0;i<flashed;i++){const entry=flashes[i];if(!entry.root.destroyed&&entry.root.filters?.length===1&&entry.root.filters[0]===white)entry.root.filters=entry.filters;entry.root=entry.filters=null;}
    flashed=0;
  }
  return {
    observe:feedback.observe,
    beginFrame(reducedMotion){
      restore();reduced=!!reducedMotion;frameTime=now();
      // WAAPI handles opacity off the render loop. A non-animated fallback for
      // older browsers clears at the same deadline, with no per-frame strings.
      if(edge&&!edgeAnimation&&edge.style.opacity!=="0"){state.sample(frameTime,reduced,output);if(!output.alpha)edge.style.opacity='0';}
      pending.forEach(expire);
    },
    flashTarget(id,rig,knockout){
      if(!pending.has(id)||flashed===flashes.length)return;
      const root=rig.root.visible?rig.root:knockout.root;
      if(!root.visible)return;
      const entry=flashes[flashed++];entry.root=root;entry.filters=root.filters;
      root.filters=whiteFilters;pending.delete(id);
    },
    dispose(){if(disposed)return;disposed=true;restore();pending.clear();edgeAnimation?.cancel();edge?.remove();if(app?.render===present)app.render=render;white.destroy();},
  };
}
