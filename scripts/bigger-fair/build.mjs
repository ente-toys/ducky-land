import fs from 'node:fs';
import {water,crossings,oldDeckBridges} from './fix-geometry.mjs';
import {read,write} from './design.mjs';
const S='scripts/bigger-fair/',A='public/pixi-art/themes/fair/',D='assets/world/themes/fair/';
const plan=read(S+'design.json'),art=read(S+'proposed-art.json'),world=read(S+'original-world.json'),walk=read(S+'original-walk-world.json'),placements=read(S+'original-placements.json');
const originalWorld=structuredClone(world);
const obstacles=[];
for(const p of plan.newProps){
 const w=p.width*p.scale,h=p.height*p.scale;
 let feet=[];
 if(p.footprints)feet=p.footprints;
 else if(p.footprint)feet=[p.footprint];
 else if(p.name==='Tree')feet=[{x:p.x,y:p.y-9,rx:31,ry:22}];
 else if(p.name==='Bush')feet=[{x:p.x,y:p.y-14,rx:w*.36,ry:Math.min(30,h*.25)}];
 else if(/Flowers|picnic blanket|lily|shell|starfish|reeds|cattails|towel/i.test(p.name))feet=[];
 else if(/lamp|flag|balloons|umbrella/i.test(p.name))feet=[{x:p.x,y:p.y-8,rx:18,ry:12}];
 else if(/Ribbon arch|Bunting/i.test(p.name))feet=[-1,1].map(sign=>({x:p.x+sign*w*.37,y:p.y-12,rx:Math.max(22,w*.08),ry:18}));
 else feet=[{x:p.x,y:p.y-Math.min(w,300)*.14,rx:w*.42,ry:Math.min(w,300)*.17}];
 obstacles.push(...feet);p.footprints=feet;
}
for(const w of [world,walk]){Object.assign(w,{width:plan.width,height:plan.height,origin:plan.origin,coast:plan.coast});}
walk.obstacles.push(...obstacles);
for(const data of [world,walk]){
 data.water.push(...water);
 data.bridges.push(...oldDeckBridges,...crossings);
}
for(const b of crossings){
 const horizontal=b.horizontal,src='bigger/crossing-'+b.id+'.svg';
 const W=horizontal?b.w:b.w*1.8,H=horizontal?b.h*2.2:b.h;
 const source=fs.readFileSync(A+(horizontal?'jetty-northwest.svg':'islet-bridge-1.svg'),'utf8');
 fs.writeFileSync(A+src,source.replace(/width="[^"]+"/,`width="${W}"`).replace(/height="[^"]+"/,`height="${H}"`));
 art.decks.push({src,x:b.x-W/2,y:b.y-H/2,width:W,height:H});
}

for(const p of plan.places)world.zones[p.id]={name:p.name,x:p.x,y:p.y,spawn:p.point,kind:p.kind,rx:p.floor[0],ry:p.floor[1]};
world.islets=[];
world.props.push(...plan.newProps.map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,zone:plan.places.reduce((best,z)=>Math.hypot(p.x-z.x,p.y-z.y)<Math.hypot(p.x-best.x,p.y-best.y)?z:best).id})));
const harbor={jetty:{foot:[1005,5650],tip:[1005,6170],width:120},water:{x:1160,y:6190},spawn:originalWorld.zones.plaza.spawn,boats:[{x:850,y:6110,turn:Math.PI},{x:1160,y:6110,turn:Math.PI},{x:1160,y:6290,turn:Math.PI}]};
for(const target of [[-1850,2700],[-1300,-650],[3500,-1350],[8200,-800],[9000,2300],[8000,5400],[4500,5900]]){
 const q=plan.coast.reduce((a,p)=>Math.hypot(p[0]-target[0],p[1]-target[1])<Math.hypot(a[0]-target[0],a[1]-target[1])?p:a);
 const vx=q[0]-3500,vy=q[1]-2300,len=Math.hypot(vx,vy);harbor.boats.push({x:Math.round(q[0]+vx/len*125),y:Math.round(q[1]+vy/len*125),turn:Math.atan2(-vx,vy)});
}
const paths=read(S+'original-paths.json');paths.push(...plan.paths.map(p=>p.line));
write(A+'art.json',art);write(D+'world.json',world);write(D+'walk-world.json',walk);write(D+'placements.json',[...placements,...plan.newProps]);write(D+'paths.json',paths);write(D+'harbor.json',harbor);
write(S+'expansion.json',{...plan,newProps:plan.newProps,harbor,groundBeforeBytes:read(S+'original-art.json').ground.tiles.reduce((s,t)=>s+t.width*t.height*4,0),groundAfterBytes:art.ground.tiles.reduce((s,t)=>s+t.width*t.height*4*(t.resolution??1)**2,0)});
console.log('Built Fair:',plan.newProps.length,'new props and',obstacles.length,'visible matching footprints.');

await import('./hamlets-apply.mjs');
