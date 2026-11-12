import {readFileSync,writeFileSync} from 'node:fs';
import {inShape,inPoly} from '../../../assets/world/island-geometry.mjs';
import {HOME_MAP} from '../../../src/pixi/island-maps.js';
const E=JSON.parse(readFileSync('src/pixi/home-expansion.json')),O='../concepts/themes/world-map/bigger',n=HOME_MAP.nav();
const before=JSON.parse(readFileSync(new URL('./before.json',import.meta.url)));
const wet=(x,y)=>HOME_MAP.walk.water.some(w=>inShape(x,y,w))||!inPoly(x,y,E.coast);
const legacy=[
 ['lily-bridge',[1640,2630],'Lily Pond, wet before'],
 ['old-jetty-1',[3320,3524.5],'dry grass before'],
 ['old-jetty-2',[1039.015,3241.74],'dry grass before'],
 ['old-jetty-3',[2304.895,3561.995],'dry grass before'],
 ['old-jetty-5',[5251.99,1660.2],'dry grass before'],
 ['makers-pond-jetty',[361,3750],'makers pond, wet before'],
 ['reedwhistle-pier',[4082,5584.44],'most crossbar dry before'],
 ['original-lake-landing',[3730,1732],'race lake, wet before'],
 ['swan-cove-harbour',[5900,1847],'sea, wet before']
];
const bridges=legacy.map(([id,point,before])=>({id,point,before,after:wet(...point)?'water underneath':'sea or dry',walkable:n.walkable(...point)}));
for(const c of E.crossings){const p=[(c.x-278)/.18,(c.y-204)/.18];bridges.push({id:c.id,point:p,before:'new road crossing',after:wet(...p)?'water underneath':'dry',walkable:n.walkable(...p)});}
const destinations=[...E.places,...E.commons].map(p=>{const target=n.nearest(...p.point,180);const r=target?n.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...target):[];return{id:p.id,requested:p.point,target,reached:JSON.stringify(r.at(-1))===JSON.stringify(target),walkable:target&&n.walkable(...target)};});
// Check every sampled centreline point that is unambiguously inside the actual water.
let blockedWater=0,leakedWater=0;const leak=[];
for(const w of E.riverWater){let x0=Math.min(...w.poly.map(p=>p[0])),x1=Math.max(...w.poly.map(p=>p[0])),y0=Math.min(...w.poly.map(p=>p[1])),y1=Math.max(...w.poly.map(p=>p[1]));for(let x=x0;x<x1;x+=29)for(let y=y0;y<y1;y+=29){if(!inShape(x,y,w,-12))continue;const deck=HOME_MAP.walk.bridges.some(b=>Math.abs(x-b.x)<b.w/2-8&&Math.abs(y-b.y)<b.h/2-12);if(deck)continue;if(n.walkable(x,y)){leakedWater++;if(leak.length<10)leak.push([x,y]);}else blockedWater++;}}
const original=JSON.parse(readFileSync(O+'/work/original-walk-world.json'));let changedOriginalDry=0;
for(let x=200;x<5500;x+=25)for(let y=0;y<3650;y+=25){if(inPoly(x,y,original.coast)&&E.riverWater.some(w=>inShape(x,y,w)))changedOriginalDry++;}
const report={bridges,destinations,water:{blockedWater,leakedWater,leak,riverWaterOverOriginalInterior:changedOriginalDry},houses:{beforeSources:new Set(before.props.filter(p=>p.communityRole==='home').map(p=>p.src)).size,afterSources:new Set(E.props.filter(p=>p.communityRole==='home').map(p=>p.src)).size},newCrossings:E.crossings.length};
writeFileSync(O+'/home-fix-work/audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(leakedWater||changedOriginalDry||destinations.some(p=>!p.reached||!p.walkable)||bridges.some(p=>p.after==='dry'))process.exitCode=1;
