import {createServer} from 'vite';import {readFileSync,writeFileSync} from 'node:fs';
import {geometry,inShape} from '../../rive/web/island-geometry.mjs';
import {HOME_MAP} from '../../src/pixi/island-maps.js';
import assert from 'node:assert/strict';
import {HOME_SLEEP_TOTAL} from '../../src/pixi/sleep-spots.js';
const out=process.env.HOME_REVIEW_OUT||'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review/fix';
const v=await createServer({configFile:false,cacheDir:'/tmp/home-review-audit-vite',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},logLevel:'error'});
try {const P=await v.ssrLoadModule('/src/pixi/placements.js'),props=P.createPlacements(),world=JSON.parse(readFileSync('rive/web/world.json')),E=JSON.parse(readFileSync('src/pixi/home-expansion.json')),local=P.walkWorld(P.trimWorld(world),props);
const beds=P.sleepSpots(local,props,geometry(local).walkable,(await v.ssrLoadModule('/src/pixi/sleep-spots.js')).sleepHalfWidths());
const obstacles=local.obstacles;
assert.equal(beds.length,HOME_SLEEP_TOTAL);assert.deepEqual(beds.bad,[]);
const residentOverlaps=(list)=>routes.flatMap(r=>r.samples.flatMap(([x,y])=>list.filter(b=>inShape(x,y,P.sleeperFootprint(b),16)).map(b=>({route:r.id,x,y,pose:b.pose,bed:[b.x,b.y]}))));
const bad=[];
const routes=JSON.parse(readFileSync('scripts/home-review/sampled-routes.json'));
for(const r of routes)for(const [x,y] of r.samples){const hit=obstacles.filter(o=>inShape(x,y,o,16));if(hit.length)bad.push({route:r.id,x:Math.round(x),y:Math.round(y),hit:hit.map(o=>({id:o.id,x:o.x,y:o.y,rx:o.rx,ry:o.ry}))});}

const dest=[...E.places,...E.commons].map(p=>{const n=HOME_MAP.nav(),route=n.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...p.point);return {id:p.id,reached:JSON.stringify(route.at(-1))===JSON.stringify(p.point)};});
const newSleeperOverlaps=residentOverlaps(beds.slice(80)),existingSleeperOverlaps=residentOverlaps(beds.slice(0,80));
assert.equal(bad.length,0);assert.equal(newSleeperOverlaps.length,0);assert.ok(dest.every(d=>d.reached));
writeFileSync(out+'/walk-audit.json',JSON.stringify({overlaps:bad.length,bad,newSleeperOverlaps,existingSleeperOverlaps,destinations:dest,sleepers:beds.length},null,2));console.log('overlap samples',bad.length,'destinations',dest.filter(d=>!d.reached));console.log('new sleeper overlaps',newSleeperOverlaps.length,'pre-existing sleeper sample overlaps',existingSleeperOverlaps.length);}
finally{await v.close();}
