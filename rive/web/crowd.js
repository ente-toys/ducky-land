import {CrowdBrain} from './crowd-brain.mjs';

// The crowd team's social brain remains in plaza-local coordinates. The adapter
// supplies the island's actual benches, counters, fountain and collision checks.
export function createIslandBrain(world,walkable){
 const ox=2020,oy=1780,scale=1.65,local=p=>({x:p.x-ox,y:p.y-oy});
 const benches=world.props.filter(p=>p.zone==='plaza'&&p.name==='Plaza bench');
 const stalls=world.props.filter(p=>p.zone==='plaza'&&p.name==='Market stall');
 const layout={groundScale:scale,floor:{x:800,y:610,rx:700,ry:470},fountain:{x:800,y:570},obstacles:[],seats:[],stalls:[],ring:[]};
 benches.forEach((p,i)=>{const id='bench-'+i,q=local(p);layout.obstacles.push({name:id,...q,radius:65});for(const side of [-1,1])layout.seats.push({id:id+'-'+side,prop:id,x:q.x+side*40,y:q.y-20,approachY:q.y+75});});
 stalls.forEach((p,i)=>{const q=local(p);layout.obstacles.push({name:'stall-'+i,x:q.x,y:q.y-25,radius:95});for(const side of [-1,1])layout.stalls.push({id:'stall-'+i+'-'+side,prop:'stall-'+i,x:q.x+side*45,y:q.y+100});});
 layout.obstacles.push({name:'fountain',x:800,y:570,radius:178});
 for(let i=0;i<12;i++){const a=i*Math.PI/6;layout.ring.push({id:'ring'+i,x:800+Math.cos(a)*350,y:570+Math.sin(a)*210});}
 const brain=new CrowdBrain(layout);
 brain.clear=function(x,y,ignore=null,pad=31){const f=layout.floor;if(((x-f.x)/(f.rx-pad))**2+((y-f.y)/(f.ry-pad/scale))**2>1)return false;
  if(ignore?.startsWith('bench-')){const p=layout.obstacles.find(o=>o.name===ignore);if(p&&Math.hypot(x-p.x,(y-p.y)*scale)<125)return true;}
  return walkable(x+ox,y+oy);
 };
 // Replace constructor paths, which were built for the original plaza, once.
 brain.claims.clear();
 for(const [i,d]of brain.ducks.entries()){
  brain.release(d);let p=layout.ring[i%layout.ring.length];
  if(!brain.clear(p.x,p.y)){p={x:800+(i-6)*70,y:880};}
  Object.assign(d,{x:p.x,y:p.y,path:[],vx:0,vy:0,action:0,nextThink:i*.2});
 }
 brain.assignSeat(brain.ducks[1],layout.seats[0]);brain.assignSeat(brain.ducks[2],layout.seats[2]);
 for(let i=3;i<=5;i++)brain.assignPlace(brain.ducks[i],'fountain',layout.ring[i+3],12+i);
 for(let i=6;i<=8;i++)brain.assignPlace(brain.ducks[i],'stall',layout.stalls[(i-6)*2],9+i);
 brain.idle(brain.ducks[9],'sleep',12);
 return {brain,ox,oy};
}
export const CROWD_ACTION={0:0,1:1,2:2,3:3,4:10,5:6,6:11,7:12,8:7};

export function installCrowd(game){
 const {brain,ox,oy}=createIslandBrain(game.world,game.walkable);
 const remove=game.ducks.filter(d=>!d.player&&d.zone==='plaza');
 for(const d of remove){game.ducks.splice(game.ducks.indexOf(d),1);d.sm.delete();d.vm.delete();d.art.delete();}
 const residents=brain.ducks.slice(1).map((d,i)=>{const duck=game.createDuck(i,'plaza');Object.assign(duck,{name:d.name,managed:true,brainId:d.id,x:d.x+ox,y:d.y+oy,turn:0,targetTurn:0});duck.vm.string('name').value=' '+d.name+' ';for(const k of ['cap','shades','acc','shoes','city']){duck[k]=d[k];duck.controls[k].value=d[k];}game.ducks.push(duck);return duck;});
 brain.updatePlayer=()=>{Object.assign(brain.player,{x:game.player.x-ox,y:game.player.y-oy,action:game.player.action,vx:0,vy:0});};
 let action=0;
 game.updateHooks.push(dt=>{if(game.network?.connected)return;
  if(game.player.action!==action){if(game.player.action===3)brain.startParty(brain.player);if(game.player.action===2)brain.pose(brain.player,'quack',1.3);action=game.player.action;}
  brain.update(dt);
  for(let i=0;i<residents.length;i++){const duck=residents[i],d=brain.ducks[i+1],x=d.x+ox,y=d.y+oy,dx=x-duck.x,dy=y-duck.y;Object.assign(duck,{x,y,action:CROWD_ACTION[d.action]??0,facing:d.facing});if(Math.hypot(dx,dy)>.15)duck.targetTurn=Math.atan2(dx,dy)*180/Math.PI;else if(duck.action>1)duck.targetTurn=0;}
 });
 game.crowd={brain,residents,snapshot:()=>brain.snapshot()};
}
