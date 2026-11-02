/* Local screenshot and functional review harness. Only loaded by ?capture=1. */
(async()=>{
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),g=window.game,c=document.querySelector('canvas');
const post=(name,data)=>fetch('/__report/'+name,{method:'POST',body:JSON.stringify(data,null,2)});
async function shot(name){g.render();const blob=await new Promise(r=>c.toBlob(r,'image/png'));await fetch('/__capture/'+name+'.png',{method:'POST',body:blob});}
await sleep(100);
g.paused=true;
await shot('plaza');
const results={ready:true,frames:g.frames,ducks:g.ducks.length,props:g.props.length,bounds:g.player.art.bounds,frameOrigin:g.player.art.frameOrigin,propBounds:g.props[0].art.bounds,propFrameOrigin:g.props[0].art.frameOrigin,routes:[],zoneWalkable:{},depth:g.renderOrder.every((e,i,a)=>!i||e.y>=a[i-1].y),viewport:[innerWidth,innerHeight],fps:g.fps};
for(const [name,z]of Object.entries(g.world.zones)){
 results.zoneWalkable[name]=g.walkable(...z.spawn);
 const path=g.route(2820,2640,...z.spawn);
 results.routes.push({zone:name,nodes:path.length,last:path.at(-1),allClear:path.every(p=>g.walkable(...p))});
 g.reviewZone(name);g.paused=true;await shot(name);
}
g.overview();await shot('overview');
// Exercise actual host handlers and the same simulation path at fixed 60Hz.
g.reviewZone('plaza');g.follow();g.paused=true;
let px=g.player.x,py=g.player.y,cx=g.camera.x;
dispatchEvent(new KeyboardEvent('keydown',{key:'d'}));
for(let i=0;i<60;i++)g.simulate(1/60);
dispatchEvent(new KeyboardEvent('keyup',{key:'d'}));
results.wasd={distance:g.player.x-px,cameraDistance:g.camera.x-cx,walking:g.player.action===1};
px=g.player.x;dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft'}));
for(let i=0;i<60;i++)g.simulate(1/60);
dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowLeft'}));
results.arrows={distance:g.player.x-px};
let target=g.toScreen(g.player.x+180,g.player.y+100);
c.dispatchEvent(new PointerEvent('pointerdown',{clientX:target[0],clientY:target[1],bubbles:true}));
const tapNodes=g.player.path.length;
for(let i=0;i<160;i++)g.simulate(1/60);
results.tap={nodes:tapNodes,remaining:g.player.path.length,error:Math.hypot(g.player.x-(px-245+180),g.player.y-(py+100))};
results.traversals=[];
for(const name of Object.keys(g.world.zones)){
 const accepted=g.goTo(name);let steps=0;
 while(g.player.path.length&&steps++<3000)g.simulate(1/60);
 const z=g.world.zones[name];results.traversals.push({zone:name,accepted,steps,error:Math.hypot(g.player.x-z.spawn[0],g.player.y-z.spawn[1]),position:[g.player.x,g.player.y],remaining:g.player.path});
}
results.isletRoutes=g.world.islets.map(a=>({target:a.slice(0,2),nodes:g.route(2820,2640,a[0],a[1]).length}));
results.isletTraversals=[];
for(const a of g.world.islets){
 g.player.path=g.route(g.player.x,g.player.y,a[0],a[1]);const accepted=g.player.path.length>0;let steps=0;
 while(g.player.path.length&&steps++<3000)g.simulate(1/60);
 results.isletTraversals.push({target:a.slice(0,2),accepted,steps,error:Math.hypot(g.player.x-a[0],g.player.y-a[1])});
}
results.bridgeRoute=g.route(1180,2630,2100,2630);
results.waterBlocked=!g.walkable(1640,2490)&&!g.walkable(4140,1520);
results.visited=[...g.visited];
results.pass=results.depth&&results.waterBlocked&&results.routes.every(r=>r.nodes&&r.allClear)&&results.traversals.every(t=>t.error<1)&&results.isletTraversals.every(t=>t.accepted&&t.error<1)&&results.wasd.distance>240&&results.wasd.cameraDistance>200&&results.arrows.distance< -240&&results.tap.nodes>0&&results.tap.error<1;
await post('browser-review.json',results);document.title='Ducky Land world verified';
g.reviewZone('plaza');g.follow();g.paused=false;
})().catch(e=>fetch('/__report/review-error.json',{method:'POST',body:JSON.stringify({error:String(e),stack:e.stack})}));
