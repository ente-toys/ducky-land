import {placeRigid} from '../src/pixi/rigid.js';
import test from 'node:test';import assert from 'node:assert/strict';
import E from '../src/pixi/home-expansion.json' with {type:'json'};
import C from '../scripts/bigger-home/communities/baseline-C.json' with {type:'json'};
import B from '../scripts/bigger-home-2/baseline-B.json' with {type:'json'};
import {HOME_MAP} from '../src/pixi/island-maps.js';
import {canSail,originOffset} from '../src/pixi/islands.js';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';
import S from '../scripts/home-10/shore.json' with {type:'json'};
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2);
test('Home communities keep C coast, map coordinates, working harbour and both piers',()=>{
 const near=(p,q)=>Math.round(p[0])===q[0]&&Math.round(p[1])===q[1],i=C.coast.findIndex(p=>near(p,S.coast.after)),j=C.coast.findIndex(p=>near(p,S.coast.before));
 assert.deepEqual(E.coast,[...C.coast.slice(0,i+1),...S.coast.points,...C.coast.slice(j)]);assert.deepEqual(E.origin,C.origin);
 assert.equal(E.width,C.width);assert.equal(E.height,C.height);
 const pier=C.decks.filter(d=>!d.src.endsWith('/pond-jetty.svg')),pierWalks=C.walkways.slice(1);
 assert.ok(!E.decks.some(d=>d.src.endsWith('/pond-jetty.svg')));assert.deepEqual(E.decks.slice(0,pier.length),pier);assert.deepEqual(E.walkways.slice(0,pierWalks.length),pierWalks);
 assert.deepEqual(E.jetty,S.harbour.jetty);assert.deepEqual(E.harborWater,S.harbour.harborWater);assert.deepEqual(E.boats,[...S.harbour.boats012,...C.boats.slice(3)]);
 for(const b of E.boats.slice(0,3))assert.ok(canSail(b.x,b.y,'home'),`jetty boat ${b.x},${b.y} afloat`);
 assert.ok(canSail(E.harborWater.x,E.harborWater.y,'home'));for(const p of [[6050,1778],[5956,1756],[5789,1700]])assert.equal(canSail(...p,'home'),false,'the old bay is land');
 assert.ok(canSail(6150,1856,'home'),'Millrill Pond now joins the sea');
 const ratio=area(E.coast)/area(B.coast);assert.ok(ratio>=1.8&&ratio<=2.05,`land ratio ${ratio}`);
});
test('five Home communities have distinct homes, meaningful workplaces and reachable front doors',()=>{
 const nav=HOME_MAP.nav();assert.equal(E.communities.length,5);let homes=0;
 for(const c of E.communities){assert.ok(c.residents.length>15);assert.ok(c.homes.length>=3,c.id);assert.ok(c.workplaces.length>=2,c.id);
  for(const id of c.workplaces){const p=E.props.find(p=>p.id===id);assert.equal(p.zone,c.id);assert.equal(p.communityRole,'workplace');}
  for(const id of c.homes){const p=E.props.find(p=>p.id===id);homes++;assert.equal(p.zone,c.id);assert.ok(HOME_MAP.landAt(p.x,p.y));
   assert.ok(!nav.walkable(p.footprint.x,p.footprint.y),'house base is solid');const door=p.door;assert.ok(nav.walkable(...door),`${c.name} ${id} door`);
   assert.deepEqual(nav.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...door).at(-1),door,`${c.name} ${id} doorstep route`);
  }
 }
 assert.ok(homes>=15);
});
test('Home keeps clear commons and joins every shared green to the original heart',()=>{
 const nav=HOME_MAP.nav();for(const p of E.openSpaces)for(let x=-p.radius;x<=p.radius;x+=38)for(let y=-p.radius;y<=p.radius;y+=38)if(x*x+y*y<=p.radius*p.radius)assert.ok(nav.walkable(p.point[0]+x,p.point[1]+y),`${p.id}: ${x},${y}`);
 for(const p of E.places){const route=nav.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...p.point);assert.deepEqual(route.at(-1),p.point,p.id);let prev=[HOME_MAP.spawn.x,HOME_MAP.spawn.y];for(const q of route){assert.ok(nav.clearLine(prev,q),p.id);prev=q;}}
 const main=E.roads.filter(r=>r.kind==='main');assert.equal(main.length,1);
 assert.ok(main[0].width>=120&&main[0].width<=135,'main loop matches original Home path width');
 assert.ok(E.roads.filter(r=>r.kind==='lane').every(r=>r.width<main[0].width),'household lanes stay narrower');
});
test('Home fishing pier is walkable above water and solid for sailors in every coordinate frame',()=>{
 const walkway=E.walkways[C.walkways.length-2],p=[walkway.b[0],walkway.b[1]-20];assert.ok(HOME_MAP.nav().walkable(...p));assert.ok(HOME_MAP.landAt(...p));assert.equal(canSail(...p,'home'),false);
 for(const other of WORLD_ISLANDS.filter(i=>i.id!=='home')){const at=placeRigid(other.id,'home',{x:p[0],y:p[1]});assert.equal(canSail(at.x,at.y,other.id),false,other.id);}
});
test('Home community ground stays GPU-safe with no texture allocation growth over C',()=>{
 const bytes=t=>Math.ceil(t.width*(t.resolution??1))*Math.ceil(t.height*(t.resolution??1))*4;
 assert.ok(E.tiles.every(t=>t.width<=1536&&t.height<=1536&&t.width*t.resolution<=1536&&t.height*t.resolution<=1536));
 assert.equal(E.tiles.reduce((s,t)=>s+t.width*t.height,0),E.width*E.height);
 assert.equal(E.tiles.reduce((s,t)=>s+bytes(t),0),C.tiles.reduce((s,t)=>s+bytes(t),0));
 assert.ok(E.tiles.reduce((s,t)=>s+bytes(t),0)<B.tiles.reduce((s,t)=>s+bytes(t),0));
});
