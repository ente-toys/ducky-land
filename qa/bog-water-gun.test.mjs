import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createBogCombat} from '../src/features/bog-combat/sim.js';
import {assistShot} from '../src/features/bog-combat/mechanics.js';
import {RULES} from '../src/features/bog-combat/rules.js';
import {bindCombatInput} from '../src/features/bog-combat/input.js';
import {BogCombatRoom} from '../src/features/bog-combat/room.js';

function fixture(){
  const sim=createBogCombat({blockers:[],hideBushes:[],pickupSpots:[],bounds:{width:3000,height:2000},pads:()=>[{x:1000,y:1000}]});
  const p=sim.join({id:'p',team:'karma'});p.shieldUntil=0;
  return {sim,p};
}
const packet=(sim,p,extra={})=>sim.input(p.id,{seq:p.seq+1,x:0,y:0,fire:false,...extra});

test('holding fires a sustained stream, releasing stops, and stale input fails closed',()=>{
  const {sim,p}=fixture();let shots=0,lastAmmo=p.ammo;
  for(let i=0;i<180;i++){
    if(i%6===0)packet(sim,p,{fire:true,facing:.37});
    sim.step(1/60);if(p.ammo<lastAmmo)shots++;lastAmmo=p.ammo;
  }
  assert.ok(shots>=35&&shots<=38,`${shots} droplets over three seconds`);
  assert.ok(p.ammo>0,'one held spray lasts more than three seconds');
  assert.ok(sim.state.shots.every(s=>Math.abs(s.dx-Math.sin(.37))<1e-9));
  packet(sim,p);const ammo=p.ammo;
  for(let i=0;i<20;i++)sim.step(1/60);
  assert.equal(p.ammo,ammo);
  packet(sim,p,{fire:true});
  for(let i=0;i<60;i++)sim.step(1/60);
  assert.equal(p.input.fire,false);
  assert.ok(ammo-p.ammo<=5,'disconnected fire cannot keep spraying');
});

test('an empty spray tank refills and resumes while held, without exceeding bounded shot storage',()=>{
  const {sim,p}=fixture();let sawEmpty=false,refilled=false;
  for(let i=0;i<480;i++){
    if(i%6===0)packet(sim,p,{fire:true});
    sim.step(1/60);if(p.ammo===0)sawEmpty=true;if(sawEmpty&&p.ammo>20)refilled=true;
    assert.ok(sim.state.shots.length<=RULES.maxShots);
  }
  assert.ok(sawEmpty&&refilled);
});

test('precise aim survives strafing and rejects malformed facing without consuming sequence',()=>{
  const {sim,p}=fixture();packet(sim,p,{x:-1,facing:.371,fire:true});sim.step(1/60);
  assert.ok(p.x<1000);assert.equal(p.facing,.371);
  assert.ok(Math.abs(sim.state.shots[0].dx-Math.sin(.371))<1e-9);
  for(const facing of [NaN,Infinity,'0',{},1e7])assert.equal(packet(sim,p,{facing}),false);
  assert.equal(packet(sim,p,{facing:-.234}),true);
});

test('assist favours the enemy under the aim, and leads motion within the assist cone',()=>{
  const p={x:0,y:0,team:'karma'},front={x:360,y:0,team:'evil',alive:true},near={x:160,y:30,team:'evil',alive:true};
  const shot=assistShot({dx:1,dy:0},p,[near,front],[],0);assert.equal(shot.dy,0);
  const moving={...front,heading:[0,1],travel:200,pace:200};
  const lead=assistShot({dx:1,dy:0},p,[moving],[],0);
  const time=moving.x/(lead.dx*RULES.shotSpeed);
  assert.ok(Math.abs(lead.dy*RULES.shotSpeed*time-200*time)<1e-7);
  assert.ok(Math.atan2(lead.dy,lead.dx)<=RULES.aimCone);
});

test('dragging a held spray updates aim without moving the camera; blur and leaving clear aim',()=>{
  const dom=new JSDOM('<canvas></canvas>'),{window}=dom,canvas=window.document.querySelector('canvas');
  let fire=false,aim=null,pan=0;
  const unbind=bindCombatInput(canvas,{keyboard:window,document:window.document,onFire:v=>fire=v,onAim:v=>aim=v});
  canvas.addEventListener('pointermove',()=>pan++);
  const event=(type,x,y)=>canvas.dispatchEvent(new window.MouseEvent(type,{button:0,clientX:x,clientY:y,bubbles:true,cancelable:true}));
  event('pointerdown',10,20);event('pointermove',80,90);
  assert.equal(fire,true);assert.deepEqual(aim,{x:80,y:90});assert.equal(pan,0);
  window.dispatchEvent(new window.Event('blur'));assert.equal(fire,false);assert.equal(aim,null);
  event('pointerdown',10,20);event('pointerleave',10,20);assert.equal(fire,false);assert.equal(aim,null);
  unbind();dom.window.close();
});

test('room prediction and authority keep the same pointer direction while moving away',()=>{
  const {sim,p}=fixture();let ws;
  class Socket{readyState=1;bufferedAmount=0;constructor(){ws=this;}send(data){sim.input(p.id,JSON.parse(data));}close(){}}
  const room=new BogCombatRoom({Socket,profile:'x'.repeat(36),url:'ws://local',navigation:{walkable:()=>true,clearLine:()=>true}});
  ws.onmessage({data:JSON.stringify({type:'arena-welcome',id:p.id})});ws.onmessage({data:JSON.stringify(sim.snapshot())});
  room.setAim(()=>({x:1400,y:1100}));room.setFire(true);
  for(let i=0;i<30;i++){
    room.step(1/60,{x:-1,y:0},i*1000/60);sim.step(1/60);
    assert.ok(Math.abs(room.player.x-p.x)<1e-7);assert.ok(Math.abs(room.player.y-p.y)<1e-7);
    // The server can trail at most one input interval while the pointer vector changes.
    assert.ok(Math.abs(room.player.facing-p.facing)<.01);
  }
  assert.ok(p.x<1000&&p.facing>0);room.dispose();
});

test('a parked mouse cannot lock walking facing, while held spray aims through strafing and release restores turning',()=>{
  const {sim,p}=fixture();let ws;
  class Socket{readyState=1;bufferedAmount=0;constructor(){ws=this;}send(data){sim.input(p.id,JSON.parse(data));}close(){}}
  const room=new BogCombatRoom({Socket,profile:'x'.repeat(36),url:'ws://local',navigation:{walkable:()=>true,clearLine:()=>true}});
  ws.onmessage({data:JSON.stringify({type:'arena-welcome',id:p.id})});ws.onmessage({data:JSON.stringify(sim.snapshot())});
  room.setAim(()=>({x:room.player.x+400,y:room.player.y}));
  let now=0;
  const step=vector=>{room.step(1/60,vector,now+=100);sim.step(1/60);};
  const directions=[[0,1,0],[1,1,Math.PI/4],[1,0,Math.PI/2],[1,-1,3*Math.PI/4],[0,-1,Math.PI],[-1,-1,-3*Math.PI/4],[-1,0,-Math.PI/2],[-1,1,-Math.PI/4]];
  try{
    for(const [x,y,facing]of directions){step({x,y});assert.equal(room.facing,facing);assert.equal(p.facing,facing);}
    room.setFire(true);
    for(const [x,y]of directions){step({x,y});assert.ok(Math.abs(room.facing-Math.PI/2)<.01);assert.ok(Math.abs(p.facing-room.facing)<.01);}
    room.setFire(false);
    for(const [x,y,facing]of directions){step({x,y});assert.equal(room.facing,facing);assert.equal(p.facing,facing);}
    room.setAim(null);room.setFire(true);step({x:-1,y:0});assert.equal(room.facing,-Math.PI/2,'keyboard-only spray follows movement');
    room.stopInput();assert.equal(room.fire,false);assert.equal(room.aim,null);
  }finally{room.dispose();}
});

test('a hundred simultaneous sprays cannot starve later players at the shot cap',()=>{
  const sim=createBogCombat({blockers:[],hideBushes:[],pickupSpots:[],bounds:{width:20000,height:20000},pads:()=>[{x:1000,y:1000}]});
  const players=Array.from({length:100},(_,i)=>{
    const p=sim.join({id:String(i),team:'karma'});p.x=1000+i%10*800;p.y=1000+Math.floor(i/10)*800;return p;
  });
  for(let i=0;i<60;i++){
    if(i%6===0)for(const p of players)packet(sim,p,{fire:true,facing:Math.PI/2});
    sim.step(1/60);assert.ok(sim.state.shots.length<=RULES.maxShots);
  }
  assert.ok(players[0].ammo<40);
  assert.ok(players.every(p=>p.ammo===players[0].ammo),'each player gets the same firing cadence');
});

test('paint starts at the supplied barrel, and bounded muzzle offsets cannot fire through cover',()=>{
  const {sim,p}=fixture();packet(sim,p,{fire:true,facing:Math.PI/2,mx:50,my:-20});sim.step(1/60);
  const shot=sim.state.shots[0];assert.equal(shot.muzzle,true);
  assert.ok(Math.abs(shot.x-(p.x+50+RULES.shotSpeed/60))<1e-7);assert.equal(shot.y,p.y-20);
  for(const offset of [{mx:97,my:0},{mx:70,my:70},{mx:0},{my:0},{mx:NaN,my:0},{mx:'0',my:0}])assert.equal(packet(sim,p,offset),false);
  const wall={blocksWalk:true,blocksShots:true,polygon:[{x:1040,y:900},{x:1050,y:900},{x:1050,y:1100},{x:1040,y:1100}]};
  const blocked=createBogCombat({blockers:[wall],hideBushes:[],pickupSpots:[],bounds:{width:3000,height:2000},pads:()=>[{x:1000,y:1000}]});
  const a=blocked.join({id:'a',team:'karma'});packet(blocked,a,{fire:true,facing:Math.PI/2,mx:80,my:0});blocked.step(1/60);
  assert.equal(blocked.state.shots.length,0);assert.equal(blocked.state.splats[0].kind,'wall');assert.equal(blocked.state.splats[0].x,1040);
});

test('room sends the rendered muzzle offset and aims from that same barrel position',()=>{
  const {sim,p}=fixture();let ws,last;
  class Socket{readyState=1;bufferedAmount=0;constructor(){ws=this;}send(data){last=JSON.parse(data);sim.input(p.id,last);}close(){}}
  const room=new BogCombatRoom({Socket,profile:'x'.repeat(36),url:'ws://local',navigation:{walkable:()=>true,clearLine:()=>true}});
  ws.onmessage({data:JSON.stringify({type:'arena-welcome',id:p.id})});ws.onmessage({data:JSON.stringify(sim.snapshot())});
  room.setMuzzle(()=>({x:p.x+50,y:p.y-20}));room.setAim(()=>({x:p.x+350,y:p.y-20}));room.setFire(true);
  room.step(1/60,{x:0,y:0},100);sim.step(1/60);
  assert.equal(last.mx,50);assert.equal(last.my,-20);assert.equal(last.facing,Math.PI/2);
  assert.ok(Math.abs(sim.state.shots[0].x-p.x-50-RULES.shotSpeed/60)<1e-7);
  assert.equal(sim.state.shots[0].y,p.y-20);room.dispose();
});

test('precise barrel shots stay on the barrel axis instead of bending toward a nearby enemy',()=>{
 const {sim,p}=fixture();const enemy=sim.join({id:'off-axis',team:'evil'});enemy.x=p.x+300;enemy.y=p.y+20;enemy.shieldUntil=0;
 packet(sim,p,{fire:true,facing:Math.PI/2,mx:50,my:0});sim.step(1/60);
 const shot=sim.state.shots[0];assert.ok(Math.abs(shot.dx-1)<1e-9);assert.ok(Math.abs(shot.dy)<1e-9);
});
