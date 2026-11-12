import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapOf} from '../src/pixi/island-maps.js';
import {IslandRoom} from '../worker/index.js';
import {inShape} from '../assets/world/island-geometry.mjs';
import {setWalkDestination,walkStep} from '../src/pixi/player-motion.js';
import sharp from 'sharp';
import {Path2D,createCanvas} from '@napi-rs/canvas';
const read=p=>JSON.parse(readFileSync(p));
const map=mapOf('sunset'),C=read('scripts/rosy-ground/data/centre.json'),B=read('scripts/rosy-ground/data/population.json'),art=read('public/pixi-art/themes/pink/art.json');
test('Rosy circle is open in client and authority except the box and five lamps',()=>{
 for(const nav of [map.nav(),IslandRoom.prototype.navFor.call({},'sunset')]){
  let count=0;
  for(let x=3230;x<4770;x+=12)for(let y=2070;y<3170;y+=12){
   if(((x-4000)/770)**2+((y-2620)/550)**2>=1||C.walkBlockers.some(o=>inShape(x,y,o,17)))continue;
   assert.ok(nav.walkable(x,y),`open circle ${x},${y}`);count++;
  }
  assert.ok(count>7000);
  for(const o of C.walkBlockers)assert.equal(nav.walkable(o.x,o.y),false,o.name);
 }
});
test('Rosy box SVG base centre matches the actual paving circle within four pixels',()=>{
 const p=art.props.find(p=>p.id==='rosy-music-box');
 const svg=readFileSync('public/pixi-art/themes/pink/ribbon-centre/music-box.svg','utf8');
 assert.match(svg,/viewBox="-270 -720 540 965"/);
 assert.match(svg,/scale\(\.9\) translate\(0 815\)/);
 const base=[p.x+(270/540-p.anchor.x)*p.width,p.y+(720/965-p.anchor.y)*p.height];
 const floor=art.flats.find(p=>p.id==='plaza-floor');
 const circle=[floor.x+782,floor.y+562];
 assert.ok(Math.hypot(base[0]-circle[0],base[1]-circle[1])<=4);
 assert.deepEqual(circle,[map.world.zones.plaza.x,map.world.zones.plaza.y]);
});
test('Rosy ribbon gaps connect road tips to open floor at server and render rates',()=>{
 for(const join of C.pathJoins.filter(j=>j.id!=='ribbon-join-north-loop'))for(const dt of [.05,1/60]){
  const nav=map.nav(),actor={x:join.outer[0],y:join.outer[1],turn:0,travel:0,action:0,path:[],until:0};let t=0;
  assert.ok(nav.walkable(actor.x,actor.y),join.id+' outer');
  assert.ok(setWalkDestination(actor,nav,...join.inner));
  for(let i=0;i<2000&&actor.path.length;i++){walkStep(actor,nav,dt,t+=dt,{x:0,y:0});assert.ok(nav.walkable(actor.x,actor.y));}
  assert.ok(Math.hypot(actor.x-join.inner[0],actor.y-join.inner[1])<1,join.id);
 }
});
test('all six rendered ribbon gaps have opaque full-width roads and clean ribbon ends',async()=>{
 const surface=readFileSync('scripts/rosy-ground/path-surface.svgfrag','utf8');
 const contour=new Path2D(surface.match(/<path d="([^"]+)"/)[1]),ctx=createCanvas(1,1).getContext('2d');
 const {data,info}=await sharp('public/pixi-art/themes/pink/ribbon-centre/ribbon-ring-floor.svg').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(const join of C.pathJoins){
  const pts=join.id.endsWith('north-loop')?join.previewPath:join.replacementPath;let count=0;
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)continue;
   for(let s=0;s<=len;s+=3){
    const x=a[0]+dx*s/len,y=a[1]+dy*s/len,r=Math.hypot((x-4000)/780,(y-2620)/560);if(r<.88||r>1.13)continue;
    for(let off=-48;off<=48;off+=6){
     const px=x-dy/len*off,py=y+dx/len*off,ix=Math.round(px-3216),iy=Math.round(py-2056);
     assert.ok(ctx.isPointInPath(contour,px,py,'evenodd'),join.id+' road gap '+[px,py]);
     if(ix>=0&&iy>=0&&ix<info.width&&iy<info.height)assert.ok(data[(iy*info.width+ix)*4+3]<=10,join.id+' ribbon crosses lane '+[px,py]);
     count++;
    }
   }
  }
  assert.ok(count>700,join.id+' inspected across complete opening');
 }
});
test('Rosy integrates all authored population while retaining the original forty',()=>{
 assert.equal(map.sleepers.length,90);assert.equal(art.kites.length,13);
 assert.equal(art.props.filter(p=>B.planting.props.some(q=>q.id===p.id)).length,381);
 for(const [pose,spots]of Object.entries(B.sleepers.originalAuthored))assert.deepEqual(map.world.sleepSpots[pose].slice(0,spots.length),spots);
 assert.deepEqual(read('scripts/rosy-ground/population-report.json').dropped,[]);
});
