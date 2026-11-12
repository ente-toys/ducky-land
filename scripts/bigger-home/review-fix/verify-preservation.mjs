import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import sharp from 'sharp';
import {HOME_MAP} from '../../../src/pixi/island-maps.js';
import {canSail,boardingPoint} from '../../../src/pixi/islands.js';
import {inPoly} from '../../../assets/world/island-geometry.mjs';
const O='../concepts/themes/world-map/bigger',read=p=>JSON.parse(readFileSync(p));
const E=read('src/pixi/home-expansion.json'),C=read(new URL('../communities/baseline-C.json',import.meta.url)),n=HOME_MAP.nav();
const report={routes:[],homes:[],moorings:[],groundTextureBudget:{},originalRecords:{}};
for(const p of E.places){const r=n.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...p.point);let prev=[HOME_MAP.spawn.x,HOME_MAP.spawn.y];const clear=r.every(q=>{const ok=n.clearLine(prev,q);prev=q;return ok;});report.routes.push({id:p.id,walkable:n.walkable(...p.point),complete:JSON.stringify(r.at(-1))===JSON.stringify(p.point),clear});}
for(const c of E.communities)for(const id of c.homes){const p=E.props.find(p=>p.id===id),door=[p.x,p.y+145],r=n.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...door);report.homes.push({id,community:c.id,onLand:HOME_MAP.landAt(p.x,p.y),doorWalkable:n.walkable(...door),doorReached:JSON.stringify(r.at(-1))===JSON.stringify(door)});}
for(const b of HOME_MAP.boatSpots()){const p=boardingPoint({...b,islandId:'home'});report.moorings.push({afloat:canSail(b.x,b.y),boardingWalkable:n.walkable(p.x,p.y)});}
const vite=await createServer({configFile:false,cacheDir:'/private/tmp/home-communities-verify',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,watch:null},logLevel:'error'});
try{const P=await vite.ssrLoadModule('/src/pixi/placements.js'),{geometry}=await vite.ssrLoadModule('/assets/world/island-geometry.mjs'),{sleepHalfWidths}=await vite.ssrLoadModule('/src/pixi/sleep-spots.js');const w=P.trimWorld(read('assets/world/world.json')),props=P.createPlacements(),local=P.walkWorld(w,props),base=read(O+'/work/original-composition.json'),oldProps=props.filter(p=>!String(p.id).startsWith('bigger-')),beds=P.sleepSpots(local,props,geometry(local).walkable,sleepHalfWidths());report.originalRecords={props:oldProps.length,propsIdentical:JSON.stringify(oldProps)===JSON.stringify(base.props),decals:P.homeDecals(props).length,decalsIdentical:JSON.stringify(P.homeDecals(props))===JSON.stringify(base.decals),sleepers:beds.length,sleepersIdentical:JSON.stringify(beds)===JSON.stringify(base.beds)};}finally{await vite.close();}
const original=read('src/pixi/art-manifest.json').ground.tiles,bytes=t=>Math.ceil(t.width*(t.resolution??1))*Math.ceil(t.height*(t.resolution??1))*4,budget=ts=>[...ts,...original].reduce((s,t)=>s+bytes(t),0);
report.groundTextureBudget={beforeBytes:budget(C.tiles),afterBytes:budget(E.tiles),beforeMiB:budget(C.tiles)/1048576,afterMiB:budget(E.tiles)/1048576,maxPhysicalTile:Math.max(...E.tiles.flatMap(t=>[Math.ceil(t.width*t.resolution),Math.ceil(t.height*t.resolution)]))};
const src=await sharp(O+'/home-now.png').ensureAlpha().raw().toBuffer(),built=await sharp(O+'/home-fix-work/preservation-frame.png').ensureAlpha().raw().toBuffer(),coast=read(O+'/work/original-walk-world.json').coast;
let pixels=0,changed=0;const first=[];for(let y=0;y<1200;y++)for(let x=0;x<1600;x++){if(!inPoly((x-278)/.18,(y-204)/.18,coast))continue;pixels++;const i=(y*1600+x)*4;if(!src.subarray(i,i+4).equals(built.subarray(i,i+4))){changed++;if(first.length<30)first.push([x,y,...src.subarray(i,i+3),...built.subarray(i,i+3)]);}}
report.pixelPreservation={pixels,changed,first};
writeFileSync(O+'/home-fix-work/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
assert.equal(changed,0,'original island pixels');for(const v of Object.values(report.originalRecords))if(typeof v==='boolean')assert.ok(v,'original records');
for(const v of report.routes)assert.ok(v.walkable&&v.complete&&v.clear,v.id);
for(const v of report.homes)assert.ok(v.onLand&&v.doorWalkable&&v.doorReached,JSON.stringify(v));
for(const v of report.moorings)assert.ok(v.afloat&&v.boardingWalkable);
