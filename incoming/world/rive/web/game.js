/* Every visible element is native Rive. One shared renderer draws the ground,
   then native prop artboards and native Drip rigs in exact foot-y order.
   This host owns input, navigation, camera transforms and the simulation only. */
'use strict';
(async()=>{
const canvas=document.querySelector('canvas'), query=new URLSearchParams(location.search);
rive.RuntimeLoader.setWasmUrl('rive.wasm');
const [runtime,world,buffer]=await Promise.all([rive.RuntimeLoader.awaitInstance(),fetch('world.json').then(r=>r.json()),fetch('ducky-land.riv?v=island-final').then(r=>r.arrayBuffer())]);
const file=await runtime.load(new Uint8Array(buffer),undefined,false);
const renderer=runtime.makeRenderer(canvas,true), ground=file.artboardByName('Island Ground');
const cameraMatrix=new runtime.Mat2D();
function matrix(m,s,x,y){m.xx=s;m.xy=0;m.yx=0;m.yy=s;m.tx=x;m.ty=y;return m;}
ground.advance(0);
const props=world.props.map(p=>{const art=file.artboardByName(p.artboard);art.frameOrigin=false;art.advance(0);return {...p,art};});
let seed=8612;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const rnd=(a,b)=>a+(b-a)*random(), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const names=['miso','pip','bread_boy','nori','lulu','boba','aya_22','sunny','mo','peep','kai','bea','toast','waddles','mango','quackers','coco','poppy','toto','kiki','bao','peach','olive','momo','pico','crumb','biscuit','basil'];
let now=0,last=0,frames=0,paused=false,overview=query.get('view')==='overview';
const keys=new Set(), visited=new Set();
function inPoly(x,y){let inside=false,p=world.coast;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!=(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;}return inside;}
function ellipse(x,y,o,pad=0){return ((x-o.x)/(o.rx+pad))**2+((y-o.y)/(o.ry+pad))**2<1;}
function walkable(x,y){
 const onBoard=world.walkways.some(b=>{
 const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],t=clamp(((x-b.a[0])*dx+(y-b.a[1])*dy)/(dx*dx+dy*dy),0,1);
 return Math.hypot(x-b.a[0]-dx*t,y-b.a[1]-dy*t)<b.w/2-10;
 });
 const onIsle=world.islets.some(a=>((x-a[0])/(a[2]-20))**2+((y-a[1])/(a[3]-20))**2<1);
 if(!inPoly(x,y)&&!onBoard&&!onIsle)return false;
 const bridge=world.bridges.some(b=>Math.abs(x-b.x)<b.w/2-8&&Math.abs(y-b.y)<b.h/2-12);
 if(!bridge&&world.water.some(o=>ellipse(x,y,o,20)))return false;
 if(world.obstacles.some(o=>ellipse(x,y,o,16)))return false;
 return true;
}
// A* across the island. Diagonal neighbours require both adjacent cells clear.
const CELL=32,COLS=Math.ceil(world.width/CELL),ROWS=Math.ceil(world.height/CELL);
const grid=new Uint8Array(COLS*ROWS);
for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)grid[y*COLS+x]=walkable((x+.5)*CELL,(y+.5)*CELL)?1:0;
function point(id){return [(id%COLS+.5)*CELL,(Math.floor(id/COLS)+.5)*CELL];}
function cell(x,y){return Math.floor(y/CELL)*COLS+Math.floor(x/CELL);}
function nearest(x,y,radius=150){
 if(walkable(x,y))return [x,y];
 for(let r=16;r<=radius;r+=16)for(let a=0;a<24;a++){let xx=x+Math.cos(a*Math.PI/12)*r,yy=y+Math.sin(a*Math.PI/12)*r;if(walkable(xx,yy))return [xx,yy];}
 return null;
}
function clearLine(a,b){let n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let i=1;i<=n;i++)if(!walkable(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;return true;}
function route(sx,sy,tx,ty){
 const target=nearest(tx,ty);if(!target)return [];
 if(clearLine([sx,sy],target))return [target];
 function nearCell(x,y){const c=cell(x,y);if(grid[c])return c;for(let r=1;r<6;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){let xx=Math.floor(x/CELL)+dx,yy=Math.floor(y/CELL)+dy,id=yy*COLS+xx;if(xx>=0&&xx<COLS&&yy>=0&&yy<ROWS&&grid[id]&&clearLine([x,y],point(id)))return id;}return -1;}
 const start=nearCell(sx,sy),end=nearCell(...target);if(start<0||end<0)return [];
 const cost=new Float32Array(grid.length).fill(Infinity),parent=new Int32Array(grid.length).fill(-1),closed=new Uint8Array(grid.length),heap=[];
 const heuristic=id=>{const a=point(id),b=point(end);return Math.hypot(a[0]-b[0],a[1]-b[1])/CELL;};
 function push(id,f){let i=heap.length;heap.push({id,f});while(i){let p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={id,f};}
 function pop(){let top=heap[0],end=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=end.f)break;heap[i]=heap[c];i=c;}heap[i]=end;}return top.id;}
 cost[start]=0;push(start,heuristic(start));let found=false;
 while(heap.length){let cur=pop();if(closed[cur])continue;closed[cur]=1;if(cur===end){found=true;break;}
 const x=cur%COLS,y=Math.floor(cur/COLS);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let xx=x+dx,yy=y+dy,n=yy*COLS+xx;if(xx<0||yy<0||xx>=COLS||yy>=ROWS||!grid[n]||closed[n])continue;if(dx&&dy&&(!grid[y*COLS+xx]||!grid[yy*COLS+x]))continue;const nc=cost[cur]+(dx&&dy?Math.SQRT2:1);if(!clearLine(point(cur),point(n)))continue;if(nc<cost[n]){cost[n]=nc;parent[n]=cur;push(n,nc+heuristic(n));}}}
 if(!found)return [];
 const raw=[];for(let n=end;n!==start;n=parent[n])raw.push(point(n));raw.reverse();raw.push(target);
 let out=[],anchor=[sx,sy];for(let i=0;i<raw.length;){let j=i;while(j+1<raw.length&&clearLine(anchor,raw[j+1]))j++;out.push(raw[j]);anchor=raw[j];i=j+1;}return out;
}
const nativeVM=file.viewModelByName('DuckyVM');
function createDuck(i,zone,player=false){
 const z=world.zones[zone];let pos=nearest(z.spawn[0]+(player?0:rnd(-250,250)),z.spawn[1]+(player?0:rnd(-130,130)),400)||z.spawn;
 const art=file.artboardByName('Ducky'),vm=nativeVM.instance(),sm=new runtime.StateMachineInstance(art.stateMachineByName('Ducky'),art);
 art.frameOrigin=false;
 const controls={};for(const key of ['x','y','bg','cap','shades','acc','shoes','city','action','facing','isPlayer'])controls[key]=vm.number(key);
 art.bindViewModelInstance(vm);sm.bindViewModelInstance(vm);
 const data={x:pos[0],y:pos[1],art,vm,sm,controls,player,zone,name:player?'you':names[i%names.length],action:0,facing:1,path:[],wait:rnd(.3,3),until:0,speed:player?245:rnd(65,105),scale:.24};
 for(const [k,v] of Object.entries({x:0,y:0,bg:0,cap:player?8:1+i%13,shades:i%4===0?1+i%3:0,acc:i%3===0?1+i%7:0,shoes:1+i%10,city:player?1:i%4,action:0,facing:1,isPlayer:player?1:0}))controls[k].value=v;
 vm.string('name').value=' '+data.name+' ';sm.advanceAndApply(0);art.advance(0);return data;
}
const zoneNames=Object.keys(world.zones),startZone=query.get('zone') in world.zones?query.get('zone'):'plaza';
const ducks=[createDuck(0,startZone,true)];
for(let i=0;i<28;i++)ducks.push(createDuck(i,zoneNames[Math.floor(i/4)]));
const player=ducks[0];
const camera={x:player.x,y:player.y-85,zoom:1};
let viewW=innerWidth,viewH=innerHeight,dpr=1;
function resize(){viewW=innerWidth;viewH=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(viewW*dpr);canvas.height=Math.round(viewH*dpr);camera.zoom=overview?Math.min(viewW/world.width,viewH/world.height):clamp(viewW/1440,.62,1);if(overview){camera.x=world.width/2;camera.y=world.height/2;}}
resize();addEventListener('resize',resize);
function quack(d){d.action=2;d.until=now+1.3;d.path=[];}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(!e.repeat&&k==='q')quack(player);if(!e.repeat&&k==='e'){player.action=3;player.until=now+4;player.path=[];}});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());
function toWorld(x,y){return [(x-viewW/2)/camera.zoom+camera.x,(y-viewH/2)/camera.zoom+camera.y];}
function toScreen(x,y){return [(x-camera.x)*camera.zoom+viewW/2,(y-camera.y)*camera.zoom+viewH/2];}
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});if(overview)return;const [x,y]=toWorld(e.clientX,e.clientY);player.path=route(player.x,player.y,x,y);if(player.path.length){player.action=1;player.until=0;}});
function move(d,vx,vy,dt){
 const len=Math.hypot(vx,vy);if(!len)return false;
 const distance=d.speed*dt,dx=vx/len*distance,dy=vy/len*distance;
 let moved=false;
 if(walkable(d.x+dx,d.y+dy)){d.x+=dx;d.y+=dy;moved=true;}
 else{if(walkable(d.x+dx,d.y)){d.x+=dx;moved=true;}if(walkable(d.x,d.y+dy)){d.y+=dy;moved=true;}}
 if(Math.abs(vx)>.03)d.facing=vx<0?-1:1;
 if(moved)d.action=1;return moved;
}
function stepDuck(d,dt){
 let vx=0,vy=0;
 if(d.player){vx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);vy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);if(vx||vy){d.path=[];d.until=0;move(d,vx,vy,dt);return;}}
 if(now<d.until)return;
 if(d.action>1)d.action=0;
 if(d.path.length){let [tx,ty]=d.path[0],dist=Math.hypot(tx-d.x,ty-d.y);if(dist<Math.max(5,d.speed*dt)){d.x=tx;d.y=ty;d.path.shift();}else if(!move(d,tx-d.x,ty-d.y,dt)){d.path=[];}if(!d.path.length)d.action=0;return;}
 d.action=0;if(d.player)return;
 d.wait-=dt;if(d.wait>0)return;d.wait=rnd(1.5,4.5);
 const chance=random();if(chance<.12){quack(d);return;}if(chance<.2){d.action=3;d.until=now+rnd(2,4);return;}
 const z=world.zones[d.zone];
 for(let i=0;i<12;i++){const x=z.spawn[0]+rnd(-330,330),y=z.spawn[1]+rnd(-210,210);if(walkable(x,y)){d.path=route(d.x,d.y,x,y);if(d.path.length)break;}}
}
let renderOrder=[],frameTimes=[];
function render(dt){
 renderer.clear();renderer.save();
 const sc=dpr*camera.zoom;
 renderer.transform(matrix(cameraMatrix,sc,dpr*viewW/2-camera.x*sc,dpr*viewH/2-camera.y*sc));
 ground.draw(renderer);
 // Sort all feet together: scenery and characters, with stable ties.
 const entities=[...props,...ducks].sort((a,b)=>a.y-b.y);
 renderOrder=entities.map(e=>({name:e.name,y:e.y,player:!!e.player}));
 const halfW=viewW/(2*camera.zoom),halfH=viewH/(2*camera.zoom);
 for(const e of entities){
  if(Math.abs(e.x-camera.x)>halfW+650||Math.abs(e.y-camera.y)>halfH+650)continue;
  if(e.sm){e.controls.action.value=e.action;e.controls.facing.value=e.facing;e.sm.advanceAndApply(dt);e.art.advance(dt);}
  e.matrix ||= new runtime.Mat2D();
  renderer.save();renderer.transform(matrix(e.matrix,e.scale||1,e.x,e.y));e.art.draw(renderer);renderer.restore();
 }
 renderer.restore();renderer.flush();runtime.resolveAnimationFrame();
}
function simulate(dt){
 now+=dt;for(const d of ducks)stepDuck(d,dt);
 if(!overview){const targetX=clamp(player.x,viewW/(2*camera.zoom),world.width-viewW/(2*camera.zoom));const targetY=clamp(player.y-85,viewH/(2*camera.zoom),world.height-viewH/(2*camera.zoom));const a=matchMedia('(prefers-reduced-motion: reduce)').matches?1:1-Math.exp(-7*dt);camera.x+=(targetX-camera.x)*a;camera.y+=(targetY-camera.y)*a;}
 for(const [name,z]of Object.entries(world.zones))if(Math.hypot(player.x-z.spawn[0],player.y-z.spawn[1])<190)visited.add(name);
}
function frame(t){
 const elapsed=(t-last)/1000||0,dt=Math.min(.035,elapsed);last=t;
 if(!paused)simulate(dt);
 render(paused?0:dt);frames++;if(elapsed)frameTimes.push(elapsed*1000);if(frameTimes.length>240)frameTimes.shift();requestAnimationFrame(frame);
}
// Read-only diagnostics + explicit review helpers, no on-screen HUD.
window.game={simulate,runtime,file,world,props,ducks,player,camera,keys,walkable,route,toScreen,toWorld,visited,
 get frames(){return frames;},get renderOrder(){return renderOrder;},get fps(){return 1000/(frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length);},
 get paused(){return paused;},set paused(v){paused=!!v;},
 goTo(name){const z=world.zones[name];if(!z)return false;player.path=route(player.x,player.y,...z.spawn);return player.path.length>0;},
 reviewZone(name){const z=world.zones[name];if(!z)return false;overview=false;resize();[player.x,player.y]=z.spawn;player.path=[];player.action=0;camera.x=z.x;camera.y=z.y;return true;},
 overview(){overview=true;resize();},follow(){overview=false;resize();},render(){render(0);},ready:true};
requestAnimationFrame(frame);
if(query.has('capture')){
 const script=document.createElement('script');script.src='review.js';document.body.appendChild(script);
}
fetch('/__report/boot.json',{method:'POST',body:JSON.stringify({ready:true,bytes:buffer.byteLength,ducks:ducks.length,props:props.length,bounds:player.art.bounds,frameOrigin:player.art.frameOrigin,propBounds:props[0].art.bounds,propFrameOrigin:props[0].art.frameOrigin})});
})().catch(e=>{console.error(e);window.gameError=String(e);fetch('/__report/error.json',{method:'POST',body:JSON.stringify({error:String(e),stack:e.stack})});const el=document.querySelector('#error');el.hidden=false;el.textContent='The island could not load. '+e.message;});
