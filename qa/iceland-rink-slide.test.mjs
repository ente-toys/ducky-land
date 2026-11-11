import test from 'node:test';
import assert from 'node:assert/strict';
import {Container} from 'pixi.js';
import {mapFor} from '../src/pixi/island-maps.js';
import {navOf} from '../src/pixi/islands.js';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {walkStep,WALK_SPEED,setWalkDestination} from '../src/pixi/player-motion.js';
import {onRink,onIce,ICE_SPEED,ICE_CRASH} from '../src/pixi/rink-slide.js';
import {createRinkTrails,RINK_TRAIL_CAP} from '../src/pixi/rink-trails.js';
import {RoomClient} from '../src/pixi/room-client.js';
import {makeRoom,addPlayer} from './room-harness.mjs';

const map=mapFor('snow'),nav=map.nav(),rink=nav.rink,gates=map.walk.iceland2.shores;
const islandId=WORLD_ISLANDS.find(i=>i.theme==='snow').id;
const zero={x:0,y:0},[cx,cy]=rink.heart;
const actor=(x,y)=>({x,y,turn:0,path:[],until:0,pace:0,travel:0,action:0,emoteVersion:0,mode:'walking'});
const inward=name=>({x:name==='west-shore'?1:0,y:name==='north-shore'?1:name==='south-shore'?-1:0});
// Find an actual open boundary crossing, independent of former gate positions.
function shore(angle) {
 const ux=Math.cos(angle),uy=Math.sin(angle);let lo=0,hi=1300;
 for(let i=0;i<30;i++){const m=(lo+hi)/2;if(onRink(rink,cx+ux*m,cy+uy*m))lo=m;else hi=m;}
 return {x:cx+ux*(lo+5),y:cy+uy*(lo+5),input:{x:-ux,y:-uy},ux,uy,r:lo};
}
const openShores=Array.from({length:48},(_,i)=>shore(i*Math.PI/24)).filter(p=>[-25,-5,0,5,25].every(d=>nav.walkable(p.x+p.ux*d,p.y+p.uy*d)));
function enter(name,reduced=false,dt=1/60) {
 const angle=name==='west-shore'?Math.PI:name==='north-shore'?-Math.PI/2:Math.PI/2;
 const p=shore(angle),a=actor(p.x,p.y);
 for(let t=0;t<.25;t+=dt)walkStep(a,nav,dt,t,{...p.input,reducedMotion:reduced});
 assert.equal(a.ice?.phase,'glide',name);return a;
}

// boss 11 Nov: stepping on any ice (lake or blue path) sends the Ducky spinning straight on in the direction it was going,
// with no steering and no pull to a centre, until it crashes out onto land (or into a rock), then it walks normally.
function slide(a,first,steps=600,dt=1/60,input=zero){
 walkStep(a,nav,dt,0,first);const phases=[a.ice?.phase??'none'];
 for(let i=1;i<steps;i++){walkStep(a,nav,dt,i*dt,input);const p=a.ice?.phase??'none';if(phases.at(-1)!==p)phases.push(p);assert.ok(nav.walkable(a.x,a.y),'collision-safe');}
 return phases;
}

test('the lake and every blue path are ice; snow beside them is not',()=>{
  assert.equal(onRink(rink,cx,cy),true);assert.equal(onIce(nav,cx,cy),true);
  assert.equal(onRink(rink,rink.x+3,rink.y+3),false,'bank outside the curved outline is snow');
  const r=nav.icePaths[0],w=r.samples[Math.floor(r.samples.length/2)];assert.equal(onIce(nav,w[0],w[1]),true);
  assert.equal(navOf(islandId).rink,rink);assert.equal(navOf(islandId).icePaths.length,nav.icePaths.length,'room navigation keeps the ice paths');
});

test('stepping onto the lake spins the Ducky straight across, no steering, until it crashes onto land, then walking returns',()=>{
  const p=shore(Math.PI/2),a=actor(p.x,p.y);
  walkStep(a,nav,1/60,0,p.input);let t=0;
  while(a.ice?.phase==='glide'&&t<20){walkStep(a,nav,1/60,t,{x:1,y:0});t+=1/60;}
  assert.equal(a.ice?.phase,'crash');
  assert.ok(Math.abs(a.x-cx)<40,'held steering cannot turn the slide: '+(a.x-cx));
  const phases=['glide','crash'];for(let i=0;i<120;i++){walkStep(a,nav,1/60,t+i/60,zero);const ph=a.ice?.phase??'none';if(phases.at(-1)!==ph)phases.push(ph);}
  assert.deepEqual(phases,['glide','crash','none']);
  assert.ok(a.y<cy-200,'crossed the lake to the far shore');
  assert.ok(!onIce(nav,a.x,a.y),'crash lands on snow');
});

test('the Ducky spins while sliding and stops spinning in reduced motion',()=>{
  const p=shore(Math.PI/2),a=actor(p.x,p.y),b=actor(p.x,p.y);
  walkStep(a,nav,1/60,0,p.input);const t0=a.turn;for(let i=1;i<20;i++)walkStep(a,nav,1/60,i/60,zero);
  assert.ok(a.turn-t0>1.5,'spins: '+(a.turn-t0));
  walkStep(b,nav,1/60,0,{...p.input,reducedMotion:true});const b0=b.turn;for(let i=1;i<20;i++)walkStep(b,nav,1/60,i/60,zero);
  assert.equal(b.turn,b0);
});

test('standing still on a blue path also slides (in the facing direction) and ends in a crash on land',()=>{
  let crashed=0,total=0;
  for(const r of nav.icePaths){const w=r.samples[Math.floor(r.samples.length/2)];total++;
    const a=actor(w[0],w[1]);const phases=slide(a,zero,1200,1/30);if(phases.includes('glide')&&phases.includes('crash'))crashed++;}
  assert.equal(crashed,total);
});

test('the crash holds about '+ICE_CRASH+' s, then normal control returns',()=>{
  const p=shore(Math.PI/2),a=actor(p.x,p.y);walkStep(a,nav,1/60,0,p.input);
  let t=0;while(a.ice?.phase!=='crash'&&t<10){walkStep(a,nav,1/60,t,zero);t+=1/60;}
  const x=a.x,y=a.y;for(let i=0;i<Math.floor(ICE_CRASH*60)-2;i++)walkStep(a,nav,1/60,t+i/60,{x:1,y:0});
  assert.ok(Math.hypot(a.x-x,a.y-y)<1,'held during the crash');
  for(let i=0;i<30;i++)walkStep(a,nav,1/60,t+1+i/60,{x:0,y:1});
  assert.ok(Math.hypot(a.x-x,a.y-y)>10,'walks again after the crash');
});

test('20 Hz authority and 60 Hz prediction agree on a slide',()=>{
  const p=shore(Math.PI/2),a=actor(p.x,p.y),b=actor(p.x,p.y);
  walkStep(a,nav,.05,0,p.input);for(let i=0;i<3;i++)walkStep(b,nav,1/60,i/60,i?zero:p.input);
  for(let i=1;i<20;i++){walkStep(a,nav,.05,i*.05,zero);for(let k=0;k<3;k++)walkStep(b,nav,1/60,i*.05+k/60,zero);}
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<3);
  assert.ok(ICE_SPEED>=200);
});

test('normal room input drives the authority, snapshots carry glide poses and self momentum, and prediction reconciles',async t=>{
  const room=await makeRoom();t.after(()=>clearInterval(room.timer));
  const west=shore(Math.PI),x=west.x,y=west.y,p=addPlayer(room,5601,{islandId,x,y});
  const watcher=addPlayer(room,5602,{islandId,x:cx-250,y:cy-130});
  await room.webSocketMessage(p.socket,JSON.stringify({type:'input',seq:1,islandId,x:1,y:0,reducedMotion:false}));
  for(let i=0;i<8;i++)room.step();
  room.connections.get(p.socket).input=zero;
  for(let i=0;i<8;i++)room.step();room.broadcast();
  const packet=JSON.parse(p.socket.last),seen=JSON.parse(watcher.socket.last).players.find(a=>a.id===p.actor.id);
  assert.equal(seen.ice.phase,'glide');assert.ok(p.actor.x>x+40,'authority glides inward: '+(p.actor.x-x));
  assert.ok(Number.isFinite(packet.self.ice.vx));
  const client=new RoomClient(()=>{});client.id=p.actor.id;client.configure(nav,map.walk);client.snapshot(packet);
  const before=[client.player.x,client.player.y];
  for(let i=0;i<6;i++)client.step(1/60,zero);
  for(let i=0;i<2;i++)room.step();room.broadcast();
  assert.ok(Math.hypot(client.player.x-before[0],client.player.y-before[1])>1);assert.ok(Math.hypot(client.player.x-p.actor.x,client.player.y-p.actor.y)<2);
  client.snapshot(JSON.parse(p.socket.last));assert.equal(client.player.ice.phase,'glide');
  assert.notEqual(client.player.ice,packet.self.ice,'momentum is owned by prediction');
  // A delta must explicitly clear ice so a departing remote never keeps the pose.
  p.actor.x=cx;p.actor.y=rink.y-100;p.actor.ice=null;room.broadcast();
  assert.equal(JSON.parse(watcher.socket.last).players.find(a=>a.id===p.actor.id).ice,null);
  client.dispose();
});

test('skate scratches and sparkles use a bounded pool for local and remote movement, then clear on reduced motion',()=>{
  const parent=new Container(),fx=createRinkTrails(parent),a={},b={};
  try {
    assert.equal(parent.children[0].children.length,RINK_TRAIL_CAP);
    for(let i=0;i<60;i++) {
      fx.begin(i/60,rink);fx.track(a,cx-220+i*3,cy-100,180);fx.track(b,cx+210-i*3,cy-100,180);
    }
    assert.ok(parent.children[0].children.some(c=>c.visible));
    fx.begin(1,rink,true);assert.equal(parent.children[0].visible,false);
    fx.begin(1.01,null);assert.ok(parent.children[0].children.every(c=>!c.visible));
  } finally {fx.destroy();parent.destroy();}
});

