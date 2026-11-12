// Run from the repo root after water.mjs. Nudges green-lane planting that the water lane left with its roots in water or on a bridge deck to the nearest dry spot.
import fs from 'node:fs';
import {makeMap} from '../../src/pixi/island-maps.js';
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
const map=makeMap('cathedral',{world,walk,harbor});
const deckGap=(x,y)=>Math.min(...world.walkways.map(({a,b,w})=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(a[0]+dx*t-x,a[1]+dy*t-y)-w/2;}));
const sleeps=[...map.sleepers.map(s=>[s.x,s.y]),...Object.values(world.sleepSpots).flat().filter(s=>typeof s[0]==="number")];
const dry=(x,y)=>deckGap(x,y)>60&&sleeps.every(([sx,sy])=>Math.hypot(sx-x,sy-y)>180)&&[[0,0],[70,0],[-70,0],[0,45],[0,-45],[50,32],[-50,32],[50,-32],[-50,-32]].every(([dx,dy])=>map.landAt(x+dx,y+dy));
const moved={};
for(const p of art.props.filter(p=>p.id?.startsWith('green-')&&!dry(p.x,p.y,p.width))){
 let best=null;
 for(let r=20;r<=500&&!best;r+=20)for(let a=0;a<360;a+=15){const x=p.x+r*Math.cos(a*Math.PI/180),y=p.y+r*Math.sin(a*Math.PI/180);if(dry(x,y,p.width)){best=[Math.round(x-p.x),Math.round(y-p.y)];break;}}
 moved[p.id]=best;
}
const drop=new Set(Object.keys(moved).filter(id=>!moved[id]));
art.props=art.props.filter(p=>!drop.has(p.id)).map(p=>moved[p.id]?{...p,x:p.x+moved[p.id][0],y:p.y+moved[p.id][1]}:p);world.props=art.props;
for(const m of [world,walk])if(m.obstacles)m.obstacles=m.obstacles.filter(o=>!drop.has(o.id)).map(o=>moved[o.id]?{...o,x:o.x+moved[o.id][0],y:o.y+moved[o.id][1]}:o);
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
console.log(JSON.stringify({moved:Object.keys(moved).length-drop.size,dropped:[...drop]}));
