import {PixiIsland} from '../src/pixi/engine.js';
const output=document.querySelector('#results'),host=document.querySelector('#host'),checks=[];
const assert=(condition,name)=>{if(!condition)throw new Error(name);};
const descendants=node=>[node,...node.children.flatMap(descendants)];
const island=new PixiIsland({onError:error=>{throw error;}});
const key=value=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent('keyup',{key:value,bubbles:true}));};
const step=(frames=1)=>{for(let i=0;i<frames;i++){island.tick(island.lastFrame+1000/60);cancelAnimationFrame(island.raf);}};
const bubble=index=>descendants(island.rigs[index].root).find(node=>node.label==='Emote bubble');
const screen=(x,y)=>({x:island.width/2+(x-island.camera.x)*island.camera.zoom,y:island.height/2+(y-island.camera.y)*island.camera.zoom});
try{
 await island.mount(host);cancelAnimationFrame(island.raf);assert(island.ready,'island ready');
 for(const duck of island.sim.ducks){duck.path=[];duck.action=0;duck.until=0;duck.wait=Infinity;}
 step();
 assert(island.sim.ducks.length===29,'29 ducks');
 for(const [i,rig]of island.rigs.entries())assert(descendants(rig.root).find(node=>node.label==='Player ring').visible===(i===0),'only the player has a ring');
 checks.push('player marker and 29 ducks');
 const replies=island.sim.ducks.filter(duck=>!duck.player&&Math.hypot(duck.x-island.sim.player.x,duck.y-island.sim.player.y)<650).slice(0,3);
 const seen=new Set();key('q');
 for(let frame=0;frame<100;frame++){step();for(let i=0;i<island.rigs.length;i++)if(bubble(i).visible&&bubble(i).emoteAction===2)seen.add(i);}
 assert(seen.has(0)&&replies.every(duck=>seen.has(duck.id)),'quack feedback for player and nearby replies');
 checks.push('Q quack bubbles and staggered replies');
 for(const [value,action]of [['1',2],['2',4],['3',5],['4',6],['5',7],['6',8],['7',9]]){
  key(value);step(12);assert(island.sim.player.action===action,`key ${value}`);assert(bubble(0).visible&&bubble(0).emoteAction===action,`bubble ${value}`);assert(Math.abs(island.sim.player.turn)<.01,'player emotes face forward');
 }
 checks.push('all seven numbered emotes and icon bubbles');
 key('e');step();assert(island.sim.player.action===3,'E dances');key('e');step();assert(island.sim.player.action===0,'E stops dancing');
 checks.push('dance toggle');
 for(const value of ['w','a','s','d','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']){
  island.sim.player.x=2820;island.sim.player.y=2640;island.sim.player.path=[];
  window.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true}));step(5);window.dispatchEvent(new KeyboardEvent('keyup',{key:value,bubbles:true}));
  assert(Math.hypot(island.sim.player.x-2820,island.sim.player.y-2640)>1,`movement ${value}`);assert(!bubble(0).visible,'movement dismisses bubble');
 }
 checks.push('WASD, arrows, and emote interruption');
 island.sim.player.x=2820;island.sim.player.y=2640;step();
 const actor=island.sim.ducks[1],original={x:actor.x,y:actor.y};[actor.x,actor.y]=island.sim.nav.nearest(3030,2640,200);actor.path=[];step();
 island.tap(screen(actor.x,actor.y-53));step(10);
 assert(actor.action===2&&island.sim.player.action===6,'tap NPC quacks while player waves');Object.assign(actor,original);
 island.lastTap=-Infinity;island.tap(screen(island.sim.player.x,island.sim.player.y-53));step(10);assert(island.sim.player.action===2,'tap player quacks');
 island.tap(screen(island.sim.player.x,island.sim.player.y-53));step();assert(island.sim.player.action===3,'double-tap player dances');
 checks.push('NPC greeting and player single/double taps');
 const destination=island.setDestination({x:3000,y:2700});assert(destination,'click destination reachable');step(18);assert(island.marker.visible&&island.marker.scale.x>1,'destination marker expands');step(85);assert(!island.marker.visible,'destination marker expires after 1.5 seconds');
 checks.push('pathfinding and expanding destination marker');
 key('f');step();key('f');step();assert(island.follow,'F keeps follow enabled');
 key('Home');step();assert(island.fitMode&&!island.follow&&island.target.zoom===island.minZoom,'Home fits');key('+');assert(!island.fitMode&&island.target.zoom>island.minZoom,'plus zoom');key('-');key('0');assert(island.fitMode,'zero fits');
 host.style.height='480px';island.resize();assert(island.camera.zoom===island.minZoom,'fit survives resize');host.style.height='600px';island.resize();
 island.follow=false;island.fitMode=false;Object.assign(island.camera,{x:500,y:500,zoom:.65});Object.assign(island.target,island.camera);
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));step(2);window.dispatchEvent(new KeyboardEvent('keyup',{key:'w',bubbles:true}));assert(island.follow,'walking off screen enables follow');
 checks.push('follow, edge follow, fit, zoom keys, and fitted resize');
 const muted=island.audio.muted;key('m');assert(island.audio.muted!==muted,'M mutes');key('m');assert(island.audio.muted===muted,'M unmutes');
 checks.push('sound toggle');
 island.follow=false;island.fitMode=false;Object.assign(island.camera,{x:2820,y:2410,zoom:.65});Object.assign(island.target,island.camera);island.sim.player.path=[];
 island.canvas.setPointerCapture=()=>{};island.canvas.hasPointerCapture=()=>false;
 const rect=island.canvas.getBoundingClientRect();
 const pointer=(type,id,x,y,button=0)=>island.canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:rect.left+x,clientY:rect.top+y,button,bubbles:true,cancelable:true}));
 pointer('pointerdown',31,300,200,1);pointer('pointermove',31,350,220,1);pointer('pointerup',31,350,220,1);
 assert(island.camera.x<2820&&island.sim.player.path.length===0,'middle drag pans without walking');
 pointer('pointerdown',32,100,100);pointer('pointercancel',32,100,100);assert(island.sim.player.path.length===0,'cancel does not walk');
 const before=island.camera.zoom;pointer('pointerdown',33,100,100);pointer('pointerdown',34,200,100);pointer('pointermove',34,260,100);pointer('pointerup',33,100,100);pointer('pointerup',34,260,100);
 assert(island.camera.zoom>before&&island.sim.player.path.length===0,'pinch zooms without walking');
 island.canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,clientX:rect.left+400,clientY:rect.top+200,bubbles:true,cancelable:true}));assert(!island.follow&&island.target.zoom<=1.8,'wheel zoom');
 checks.push('middle-button drag, cancellation, pinch, and wheel');
 island.keys.add('w');window.dispatchEvent(new Event('blur'));assert(island.keys.size===0&&island.gestures.pointers.size===0,'blur clears input');
 const version=island.sim.player.emoteVersion;window.dispatchEvent(new KeyboardEvent('keydown',{key:'q',ctrlKey:true,bubbles:true}));assert(island.sim.player.emoteVersion===version,'shortcuts ignored');
 assert(island.birds.length===3&&island.butterflies.length===2&&island.splashes.length===2,'original ambient life present');
 checks.push('input cleanup and original ambient life');
 island.dispose();key('q');assert(island.sim.player.emoteVersion===version,'disposed input handlers removed');
 document.body.dataset.result='passed';output.textContent=`PASS: ${checks.length} original-scene behavior groups\n`+checks.map(name=>`✓ ${name}`).join('\n');
}catch(error){cancelAnimationFrame(island.raf);document.body.dataset.result='failed';output.textContent=`FAIL: ${error.message}\n`+checks.join('\n');console.error(error);}
