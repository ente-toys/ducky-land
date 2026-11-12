import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {geometry,inShape} from '../../assets/world/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
import {Texture} from 'pixi.js';
const ROOT='public/pixi-art/themes/cathedral/',DATA='assets/world/themes/cathedral/';
const read=p=>JSON.parse(readFileSync(p));const art=read(ROOT+'art.json'),world=read(DATA+'world.json'),walk=read(DATA+'walk-world.json'),harbor=read(DATA+'harbor.json'),arcs=read(ROOT+'arc-benches.json');
const files=(p)=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(p+d.name+'/'):[p+d.name]);
const pngs=files(ROOT).filter(p=>/\.(png|jpg|webp)$/i.test(p));assert.equal(pngs.length,0,'all raster work lives outside public');
const entries=[...art.ground.tiles,...art.decks,...art.flats,...art.props,...art.floating];
for(const e of entries){assert.match(e.src,/\.svg$/);const svg=readFileSync(ROOT+e.src,'utf8');assert.ok(!/<image\b|data:image\/(png|jpeg|webp)/i.test(svg),e.src+' has no embedded raster');}
assert.deepEqual(art.props,world.props);assert.deepEqual(walk.obstacles,world.obstacles);
assert.equal(new Set(art.props.map(p=>p.id)).size,art.props.length);
const map=makeMap('cathedral',{world,walk,harbor,art:'/pixi-art/themes/cathedral/art.json'});
assert.equal(map.sleepers.length,40);assert.equal(world.width,8000);assert.equal(world.height,6000);
const zones=Object.entries(world.zones).filter(([n])=>/^(activity|stalls)-/.test(n));
assert.equal(zones.length,6);
for(const [n,z]of zones){assert.equal(art.props.filter(p=>inShape(p.x,p.y,z)).length,0,n+' has no props inside');assert.equal(map.sleepers.filter(p=>inShape(p.x,p.y,z)).length,0,n+' has no sleepers inside');}
function seg(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)}
const pd=(x,y)=>Math.min(...world.paths.map((l,i)=>Math.min(...l.slice(1).map((b,j)=>seg(x,y,l[j],b)))-world.pathWidths[i]/2));
const pathHits=art.props.filter(p=>!p.id.startsWith('cloister')&&!/Arcade/.test(p.name)&&pd(p.x,p.y)<0);assert.deepEqual(pathHits,[]);
for(const b of walk.obstacles.filter(o=>o.name?.startsWith('arc-'))){assert.ok(b.poly.every(p=>pd(...p)>=0),b.name+' clear of path');assert.ok(b.poly.some(p=>!map.nav().walkable(...p)),b.name+' has real collision');}
for(const [i,z]of zones.entries())assert.ok(arcs.some(b=>b.id.startsWith('rim-'+i+'-')),z[0]+' has curved rim seating');
const ts=art.props.filter(p=>/tree/i.test(p.name));let crownOverlaps=0;
for(let i=0;i<ts.length;i++)for(let j=i+1;j<ts.length;j++){const p=ts[i],q=ts[j],ph=p.height*p.scale,qh=q.height*q.scale;if(((p.x-q.x)/(.43*(p.width*p.scale+q.width*q.scale)))**2+((p.y-ph*.61-(q.y-qh*.61))/(.28*(ph+qh)))**2<1)crownOverlaps++;}
assert.equal(crownOverlaps,0,'no overlapping tree crown envelopes');
const original=globalThis.fetch;let acquired=0,released=0,loaded;
try{globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});loaded=await loadThemeArt(map,{acquire:async()=>{acquired++;return Texture.EMPTY},release:()=>released++});assert.equal(loaded.props.length,art.props.length);assert.ok(loaded.props.every(p=>!p.centrePiece||!p.wind));loaded.destroy();assert.equal(acquired,released);}finally{globalThis.fetch=original;}
const result={ready:true,dimensions:[8000,6000],sleepers:map.sleepers.length,props:art.props.length,trees:ts.length,arcBenches:arcs.length,openZones:6,pathAnchorOverlaps:0,treeCrownOverlaps:0,rasterFiles:0,svgManifestEntries:entries.length,loadedTextures:acquired,releasedTextures:released,centrePieces:art.props.filter(p=>p.src.startsWith('centre/')).length,liveBrowserVerified:false};
writeFileSync(ROOT+'validation.json',JSON.stringify(result,null,2)+'\n');console.log(result);
