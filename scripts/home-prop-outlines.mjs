#!/usr/bin/env node
// Rebuild all Home art outlines and the shared worker walk map. No art/placement edits.
import {readFileSync, writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import sharp from 'sharp';
import {propOutlineKind} from '../src/world/home/prop-outline-rules.js';
const SIZE = 256;
async function placements() {
  const bundle = await build({stdin:{resolveDir:process.cwd(),contents:`export * from './src/world/home/placements.js'; export {harborWorld} from './src/gameplay/islands.js'; export {sleepHalfWidths} from './src/world/home/sleep-spots.js';`},bundle:true,platform:'node',format:'esm',write:false});
  return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text+'\n//# sourceURL=home-prop-data.mjs').toString('base64'));
}
// Convex envelope of the opaque pixel cells, including their outside corners.
// Like the original building trace, this conservatively closes transparent holes.
function hull(points) {
  const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=ps=>{const out=[];for(const p of ps){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  return [...half(sorted).slice(0,-1),...half(sorted.toReversed()).slice(0,-1)].map(p=>p.map(v=>v/SIZE));
}
async function trace(svg) {
  const {data}=await sharp(Buffer.from(svg)).resize(SIZE,SIZE,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let bottom=0;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(data[(y*SIZE+x)*4+3]>32){bottom=Math.max(bottom,y+1);}
  const points=[];
  for(let y=0;y<bottom;y++){
    let left=SIZE,right=-1;
    for(let x=0;x<SIZE;x++)if(data[(y*SIZE+x)*4+3]>32){left=Math.min(left,x);right=x;}
    if(right>=0)points.push([left,y],[right+1,y],[left,y+1],[right+1,y+1]);
  }
  const poly=hull(points);if(poly.length<3)throw Error('Empty SVG trace');return poly;
}
const P=await placements(), props=P.createUnoutlinedPlacements();
const full={};
for(const src of [...new Set(props.map(p=>p.src))].sort()) {
  const svg=readFileSync('public'+src,'utf8');full[src]=await trace(svg);
}
writeFileSync('src/world/home/building-silhouettes.json','{\n'+Object.entries(full).map(([k,v])=>' '+JSON.stringify(k)+':'+JSON.stringify(v)).join(',\n')+'\n}'+'\n');
console.log(JSON.stringify({props:props.length,arts:Object.keys(full).length,kinds:props.reduce((a,p)=>{const k=propOutlineKind(p);a[k]=(a[k]??0)+1;return a;},{})}));
if(process.argv.includes('--outlines-only'))process.exit(0);
// Bundle again after the new catalogues exist, so baked and runtime geometry agree.
const Q=await placements(), world=JSON.parse(readFileSync('assets/world/world.json'));
const {geometry}=await import('../assets/world/island-geometry.mjs');
const ps=Q.createPlacements(), local=Q.harborWorld(Q.walkWorld(Q.trimWorld(world),ps));
const beds=Q.sleepSpots(local,ps,geometry(local).walkable,Q.sleepHalfWidths(.88*.24*3));
if(beds.bad.length)throw Error(`Unresolved sleepers: ${JSON.stringify(beds.bad)}`);
const walk={...local,obstacles:[...local.obstacles,...beds.map(Q.sleeperFootprint)]};
const keys=['navigationCellSize','width','height','origin','coast','obstacles','walkways','bridges','islets','water','boardwalk'];
console.log(JSON.stringify({props:props.length,arts:Object.keys(full).length,kinds:props.reduce((a,p)=>{const k=propOutlineKind(p);a[k]=(a[k]??0)+1;return a;},{}),sleepers:beds.length}));

// Feathers keep their authored targets. Move scenery when a canopy obstructs
// one, rather than silently moving the pickup to a different spot.
const {createNavigation}=await import('../src/world/navigation.js');
const nav=createNavigation(walk), sites=JSON.parse(readFileSync('src/gameplay/karma-sites.json'));
for(const site of sites.filter(s=>s.region==='home')){
  if(!nav.walkable(site.x,site.y)||!nav.route(...world.zones.plaza.spawn,site.x,site.y).length)throw Error(`Unreachable Home pickup: ${site.id}`);
}

// Save only after resident and pickup validation succeeds.
writeFileSync('assets/world/walk-world.json',JSON.stringify(Object.fromEntries(keys.filter(k=>k in walk).map(k=>[k,walk[k]])))+'\n');
