import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {homeArtwork} from '../scripts/globe-perf/snapshot.mjs';
import {globePreviewUrl} from '../src/pixi/globe-preview.js';
import {worldIsland} from '../src/pixi/world-map.js';
import {geometry,inPoly} from '../rive/web/island-geometry.mjs';
const j=p=>JSON.parse(readFileSync(p));
const w=j('rive/web/themes/snow/world.json'),a=j('public/pixi-art/themes/snow/art.json');
const home=homeArtwork();
const byId=id=>a.props.find(p=>p.id===id);
test('FIX1 buildings match measured Home facades and 3-4 standing Ducky heights',()=>{
 for(const [id] of w.iceland2.doors){const p=byId(id);assert.ok(p.width>=300&&p.width<=563,id+' width');assert.ok(p.height>=250&&p.height<=520,id+' height');
  assert.ok(p.sourceSize?.every(n=>n>0),id+' source dimensions');
  assert.ok(Math.abs(p.width/p.height-p.sourceSize[0]/p.sourceSize[1])<.001,id+' preserve aspect ratio');
 }
 assert.ok(byId('lake-bank-pine-2').height<=420);
 for(const p of a.props.filter(p=>p.finalRole?.startsWith('snowman-')))assert.ok(p.height<=180,p.id);

});
test('FIX1 route graph has no empty-snow endpoints, exact joins and every door on one connected network',()=>{
 const {nodes,routes,doors}=w.iceland2,adj=new Map();
 for(const r of routes){for(const [i,n]of r.ends.entries()){
 assert.ok(nodes[n],r.id+' unknown node');const end=i?r.samples.at(-1):r.samples[0];assert.ok(Math.hypot(end[0]-nodes[n][0],end[1]-nodes[n][1])<.02,r.id+' endpoint drift');
 if(!adj.has(n))adj.set(n,new Set());adj.get(n).add(r.ends[1-i]);}
 assert.ok([104,128].includes(r.width));}
 // The unpainted, walkable ice connects the three terminal gate landings.
 const gates=Object.keys(w.iceland2.shores);for(const g of gates)for(const other of gates)if(g!==other)adj.get(g).add(other);
 const reached=new Set(['harbour']);for(let last=-1;last!==reached.size;){last=reached.size;for(const n of reached)for(const next of adj.get(n)??[])reached.add(next);}
 assert.equal(reached.size,adj.size,'disconnected path network');
 const destinations=new Set([...doors.map(d=>d[0]),'harbour','yard','sled','stall',...Object.keys(w.iceland2.shores)]);
 for(const [name,edges]of adj)if(edges.size===1)assert.ok(destinations.has(name),name+' dead-end snow stub');
 for(const [name,x,y]of doors){assert.ok(reached.has(name));assert.deepEqual(nodes[name],[x,y]);}
 for(const r of routes)for(const [x,y]of r.samples)assert.ok(inPoly(x,y,w.coast),r.id+' paints out to sea');
});
test('FIX1 walking corridor centre lines clear every solid prop with full Ducky radius',()=>{
 const nav=geometry(w);
 for(const r of w.iceland2.routes)for(const [x,y]of r.samples)assert.ok(nav.walkable(x,y),r.id+' blocked at '+x+','+y);
});
test('FIX1 groves use Home plant height and comparable authored density',()=>{
 const trees=a.props.filter(p=>p.id.includes('-tree-')),bushes=a.props.filter(p=>p.finalKind==='shrub');
 const ht=home.filter(p=>/plants\/tree/.test(p.src));assert.ok(trees.length>=ht.length*.9,trees.length+' trees');
 for(const p of trees)assert.ok(p.height>=180&&p.height<=400,p.id);
 assert.ok(bushes.length>=20&&bushes.length<80,'Q3 retires scattered shrub pairs');assert.ok(a.props.some(p=>p.id==='bakery-yard-woodpile-3')); // FIX3 replaces loose filler with authored court scenes.
 assert.ok(!a.props.some(p=>/snow-crates|snow-fence|snow-pile/.test(p.id)));
});
test('FIX1 snow coast clips sand paths to land and sled sits over a shaded hill',()=>{
 const text=readFileSync('public/pixi-art/themes/snow/v2/terrain.svg','utf8');assert.ok(text.includes('clip-path="url(#snow-coast)"'));assert.ok(text.includes('stroke="#d5c9f2"'));
 const hill=a.flats.find(p=>p.id==='sled-hill'),sleds=a.props.filter(p=>p.scene==='sled-scene'&&p.finalRole==='sled');assert.ok(hill.width>=640&&hill.width<=720&&hill.height>=340&&hill.height<=400);assert.equal(sleds.length,2);for(const sled of sleds)assert.ok(Math.hypot(sled.x-hill.x,sled.y-hill.y)<750);
});
test('FIX1 polar minimap uses complete snow vector before GPU streams load',async()=>{
 const island=worldIsland('isle-55'),src=new URL(globePreviewUrl(island),'http://localhost').pathname;
 assert.equal(src,'/pixi-art/globe/snow.svg');assert.equal(island.width,w.width);assert.equal(island.height,w.height);
 const {data,info}=await sharp('public'+src).ensureAlpha().raw().toBuffer({resolveWithObject:true});let land=0,opaque=0;
 for(let i=0;i<data.length;i+=4){if(data[i+3]>128)opaque++;if(data[i]>230&&data[i+1]>225&&data[i+2]>230&&data[i+3]>128)land++;}
 assert.ok(land>info.width*info.height*.3,'snow land missing');assert.ok(opaque<info.width*info.height*.9,'sea transparency missing');
});
