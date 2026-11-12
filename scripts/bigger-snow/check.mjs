import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {j,base,output,renderArt,json,area} from './scene.mjs';
import {inPoly,inShape} from '../../assets/world/island-geometry.mjs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {roads,communities,bridges} from './plan.mjs';
import sharp from 'sharp';
const a=j('public/pixi-art/themes/snow/art.json'),w=j('assets/world/themes/snow/world.json'),walk=j('assets/world/themes/snow/walk-world.json'),h=j('assets/world/themes/snow/harbor.json'),old=j(base+'art.json'),ow=j(base+'world.json');
const result=checkTheme('snow');assert.ok(result.ready,result.problems.join('\n'));
const map=makeMap('snow',{world:w,walk,harbor:h,sleepers:result.sleepers}),nav=map.nav(),route=(x,y)=>nav.walkable(x,y)&&(nav.clearLine([map.spawn.x,map.spawn.y],[x,y])||nav.route(map.spawn.x,map.spawn.y,x,y).length>0);
const dests=[];for(const c of communities)for(const [type,x,y]of [...c.homes,...c.work]){assert.ok(route(x,y+65));dests.push({community:c.id,type,x,y:y+65,reachable:true})}
const pathSweep=[];for(const r of roads){let solid=0,water=0,offshore=0;for(const [x,y]of r.line){if(inPoly(x,y,ow.coast))continue;if(!inPoly(x,y,w.coast))offshore++;else if(!nav.walkable(x,y)){if(w.water.some(v=>inShape(x,y,v,20)))water++;else solid++}}pathSweep.push({road:r.id,solidSamples:solid,waterSamples:water,offshoreSamples:offshore});}
// An actual rendered pixel comparison, with the full original ground, decals and standing art.
const opts={k:.2,x:0,y:0,width:1600,height:1200};
const before=await renderArt(old,opts),after=await renderArt(a,opts);writeFileSync(output+'/work/snow/original-before.png',before);writeFileSync(output+'/work/snow/original-after.png',after);
const b0=await sharp(before).raw().toBuffer(),b1=await sharp(after).raw().toBuffer();let samples=0,changed=0;const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
for(let py=0;py<1200;py++)for(let px=0;px<1600;px++){const x=(px+.5)/.2,y=(py+.5)/.2;if(!inPoly(x,y,ow.coast))continue;let edge=Infinity;for(let i=0;i<ow.coast.length;i++)edge=Math.min(edge,seg(x,y,ow.coast[i],ow.coast[(i+1)%ow.coast.length]));if(edge<100)continue;const p=(py*1600+px)*4;samples++;if(b0[p]!==b1[p]||b0[p+1]!==b1[p+1]||b0[p+2]!==b1[p+2]||b0[p+3]!==b1[p+3])changed++;}
assert.equal(changed,0,'original dry interior changed');
json(output+'/work/snow/validation.json',{ready:true,sleepers:result.sleepers.length,originalPropsUnchanged:JSON.stringify(old.props)===JSON.stringify(a.props.slice(0,old.props.length)),originalGroundTilesUnchanged:JSON.stringify(old.ground.tiles)===JSON.stringify(a.ground.tiles.slice(-old.ground.tiles.length)),pixelValidation:{projection:'flat production artwork',scale:.2,mask:'inside original coastline, at least 100 world units from its edge',samples,changed},destinationReadback:dests,bridgeCount:bridges.length,pathSweep,...j(output+'/work/snow/build-metrics.json')});console.log('Snow validated. Original dry interior: '+changed+' changed pixels of '+samples+' checked.');console.log(pathSweep);
