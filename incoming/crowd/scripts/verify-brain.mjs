import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CrowdBrain,POSE} from '../rive/web/brain.mjs';
const layout=JSON.parse(fs.readFileSync(new URL('../rive/web/plaza-layout.json',import.meta.url)));
const reports=[];
for(const seed of [2808,1,42,12345,98765]){
 const b=new CrowdBrain(layout,seed);let overlaps=0,collisions=0,maxDancers=0,parties=0;
 const bad=[];const counts={};let seen=0;
 for(const p of [...layout.seats.map(s=>({...s,y:s.approachY})),...layout.stalls,...layout.ring]){
   assert(b.clear(p.x,p.y),`Blocked destination ${p.id}`);
   assert(b.route(b.player,p).length,`No route to ${p.id}`);
 }
 for(let frame=0;frame<180*60;frame++){
   // Real control inputs exercise greetings, follower pursuit and player-led parties.
   if(frame===4*60)b.quack();
   if(frame===8*60)b.keys.add('d');
   if(frame===9*60)b.keys.clear();
   if(frame===11*60)assert(b.startParty(b.player));
   b.update(1/60);
   const dancing=b.ducks.filter(d=>d.action===POSE.dance).length;
   maxDancers=Math.max(maxDancers,dancing);
   assert(dancing<=6,`Too many dancers: ${dancing}`);
   for(const d of b.ducks){
     assert(Number.isFinite(d.x)&&Number.isFinite(d.y));
     const ignore=d.goal?.kind==='bench'&&d.goal.phase!=='approach'?d.goal.place.prop:null;
     if(!b.clear(d.x,d.y,ignore)){collisions++;if(bad.length<3)bad.push({t:b.time,id:d.id,goal:d.goal?.kind,phase:d.goal?.phase});}
     if(d.action===POSE.sit){assert(d.goal?.kind==='bench');assert(d.settled);assert.equal(d.x,d.goal.place.x);assert.equal(d.y,d.goal.place.y);}
   }
   const claims=b.ducks.filter(d=>d.goal?.claim).map(d=>d.goal.claim);
   assert.equal(new Set(claims).size,claims.length,'A destination was double-booked');
   if(b.party)assert(b.party.members.length>=3&&b.party.members.length<=6);
   while(seen<b.events.length){const e=b.events[seen++];counts[e.type]=(counts[e.type]||0)+1;if(e.type==='party')parties++;}
 }
 assert.equal(collisions,0,JSON.stringify(bad));
 for(const type of ['sit','visit','gather','follow','wave','quack','sleep','preen','look','party','dance','party-end'])assert(counts[type]>0,`Missing ${type} with seed ${seed}`);
 assert(maxDancers>=3,'Party never gathered');
 reports.push({seed,simulatedSeconds:180,collisions,maxDancers,parties,counts});
}
const b=new CrowdBrain(layout);
const initial=b.renderSlots(),playerSlot=initial.indexOf(b.player);
b.quack();b.ducks[12].y=b.player.y+10;
assert.equal(b.renderSlots().indexOf(b.player),playerSlot,'Quack was moved into another timeline placement');
assert.equal(b.tap(800,560),false,'Fountain accepted as walking target');
assert(b.tap(1100,740));assert(b.player.path.length>0);
b.keys.add('w');b.update(1/60);assert.equal(b.player.action,POSE.walk);
const result={passed:true,simulatedSeconds:900,reports};
fs.writeFileSync(new URL('../evidence/brain-check.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
