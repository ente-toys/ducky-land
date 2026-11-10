// Apply AFTER the Fair ground/plant/bridge passes, BEFORE source-size refresh.
// Owns only fair-life-* additions, the listed recompositions and extra beds.
// routes are INPUT to the one Home path union, never a separate path painter.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {checkTheme} from '../theme-index.mjs';
import {fitContact} from '../bigger-fair/furniture.mjs';
import {geometry, inShape} from '../../rive/web/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {sleepHalfWidths, sleeperFootprint} from '../../src/pixi/sleep-spots.js';

export const read = p => JSON.parse(fs.readFileSync(p));
const save = (p,v) => fs.writeFileSync(p,JSON.stringify(v,null,1)+'\n');
export const layout = read('scripts/fair-life/layout.json');
export const original = read('qa/fixtures/fair-original-forty-sleepers.json');
export const A='public/pixi-art/themes/fair/', D='rive/web/themes/fair/';
export function segmentDistance(x,y,a,b) {
 const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}
export function sample(points) {
 const out=[];
 for(let i=0;i<points.length-1;i++){
  const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)],n=Math.max(4,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/10));
  for(let j=0;j<n;j++){const t=j/n,u=1-t;out.push([0,1].map(k=>u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(d[k]-b[k])/6)+t**3*c[k]));}
 }
 return [...out,points.at(-1)];
}
export function featureProps(art) {
 const out=[], prop=(id,src,x,y,width,height,rx,ry,extra={})=>{
  const footprint={name:id,x,y:y-12,rx,ry};
  out.push({id,name:id,src,x,y,width,height,scale:1,anchor:{x:.5,y:1},resolution:2,footprints:[footprint],...extra});
 };
 prop('fair-life-hill-telescope','/pixi-art/home-review/hill/telescope.svg',7500,1250,190,225,62,19,{shadow:false});
 prop('fair-life-hill-bench','/pixi-art/home-review/hill/bench.svg',7290,1280,200,130,90,19,{shadow:false});
 prop('fair-life-hill-sign','/pixi-art/home-review/hill/star-sign.svg',7710,1310,105,145,16,10,{shadow:false});
 prop('fair-life-picnic-seat-west','/pixi-art/home-review/hill/bench.svg',4840,4630,200,130,90,19,{shadow:false});
 prop('fair-life-picnic-seat-east','/pixi-art/home-review/hill/bench.svg',5220,4630,200,130,90,19,{shadow:false,flip:true});
 prop('fair-life-picnic-table','life/tea-table.svg',5030,4550,208,173.6,64,25,{shadowSize:[65,20],shadowOffset:[0,-5]});
 for(const [i,x,y,n]of [[0,4760,4790,2],[1,5080,4840,3],[2,5350,4780,4]]) {
  const model=art.props.find(p=>p.src===`reuse/bush-${n}.svg`);
  // Full Home family, no new plant drawing.
  const sizes={2:[168,110],3:[116,104],4:[140,100]};
  const [w,h]=model?[model.width,model.height]:sizes[n];
  prop(`fair-life-picnic-bush-${i}`,`reuse/bush-${n}.svg`,x,y,w,h,32,16,{wind:true,shadowSize:[w*.3,12]});
 }
 return out;
}
export function applyFeatures(art,world,walk) {
 const previousRoutes=world.fairLife?.routes??[];
 const mine=p=>String(p.id??p.name??'').startsWith('fair-life-');
 art.props=art.props.filter(p=>!mine(p));art.flats=(art.flats??[]).filter(p=>!mine(p));
 for(const w of [world,walk])w.obstacles=w.obstacles.filter(p=>!mine(p));
 world.props=world.props.filter(p=>!mine(p));
 for(const [id,[x,y]]of Object.entries(layout.moves)) {
  const p=art.props.find(p=>p.id===id);assert(p,`missing retained prop ${id}`);
  const dx=x-p.x,dy=y-p.y;
  const shifted=f=>({...f,x:f.x+dx,y:f.y+dy});
  for(const w of [world,walk])w.obstacles=w.obstacles.map(f=>(f.name===id||f.id===id)?shifted(f):f);
  if(p.footprint)p.footprint=shifted(p.footprint);
  if(p.footprints)p.footprints=p.footprints.map(shifted);
  p.x=x;p.y=y;if(p.z!==undefined)p.z+=dy;
  const meta=world.props.find(p=>p.id===id);if(meta)Object.assign(meta,{x,y});
 }
 art.flats.push({id:'fair-life-hill-mound',src:'/pixi-art/home-review/hill/mound.svg',x:7150,y:980,width:700,height:410,topLeft:true,resolution:2});
 const props=featureProps(art).map(fitContact);art.props.push(...props);
 for(const w of [world,walk])w.obstacles.push(...props.flatMap(p=>p.footprints));
 world.props.push(...props.map(({id,name,x,y})=>({id,name,x,y,zone:'fair-life'})));
 art.kites=layout.kites;
 world.fairLife={hill:layout.hill,picnic:layout.picnic,routes:layout.routes.map(r=>({...r,samples:previousRoutes.find(p=>p.id===r.id)?.samples??sample(r.points)}))};
 // Add exact samples to the shared route data. Ground painter must union these
 // lanes with its canonical path surface after all workers have been merged.
 for(const r of world.fairLife.routes)if(!world.paths.some(p=>JSON.stringify(p)===JSON.stringify(r.samples)))world.paths.push(r.samples);
}
export function clearance(world,walk,art) {
 const nav=geometry(makeMap('fair',{world,walk,harbor:read(D+'harbor.json'),sleepers:[]}).walk);
 const roads=world.paths.flatMap(p=>p.slice(1).map((b,i)=>[p[i],b]));
 return (x,y,pose,tree)=>{
  const r=sleepHalfWidths()[pose],f=sleeperFootprint({x,y,r});
  // Test the full ground contact ellipse, not just the pose's centre point.
  for(let i=0;i<24;i++){const a=i*Math.PI/12,xx=f.x+Math.cos(a)*(f.rx+16),yy=f.y+Math.sin(a)*(f.ry+16);
   if(!nav.walkable(xx,yy)&&!(tree&&walk.obstacles.some(o=>(o.name===tree||o.id===tree)&&inShape(xx,yy,o,16))))return false;
   if(world.water.some(w=>inShape(xx,yy,w,35)))return false;
  }
  if(world.walkways.some(b=>segmentDistance(x,y,b.a,b.b)<b.w/2+r+70))return false;
  if(world.bridges.some(b=>Math.abs(x-b.x)<b.w/2+r+70&&Math.abs(y-b.y)<b.h/2+100))return false;
  if(roads.some(([a,b])=>segmentDistance(x,y,a,b)<90+r))return false;
  // All central rides, checker court, moat entrances and hamlet courts stay free.
  if(Math.hypot((x-3570)/1050,(y-3350)/620)<1)return false;
  return true;
 };
}
export function apply() {
 fs.mkdirSync(A+'life',{recursive:true});
 fs.writeFileSync(A+'life/tea-table.svg',fs.readFileSync(A+'bigger/tea-table.svg','utf8').replace(/stroke="#A88A46"/gi,'stroke="#39472d"'));
 const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
 applyFeatures(art,world,walk);
 world.sleepSpots=structuredClone(original.spots);
 for(const s of layout.sleepers)world.sleepSpots[s.pose].push(s.spot);
 world.sleepTotal=90;
 save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'paths.json',world.paths);save(D+'placements.json',art.props);
 const report=checkTheme('fair');assert(report.ready,report.problems.join('\n'));assert.equal(report.sleepers.length,90);
 for(const bed of original.beds)assert(report.sleepers.some(s=>JSON.stringify(s)===JSON.stringify(bed)),`lost approved resident ${JSON.stringify(bed)}`);
 const clear=clearance(world,walk,art);
 for(const s of report.sleepers.filter(s=>!original.beds.some(b=>b.x===s.x&&b.y===s.y&&b.pose===s.pose)))assert(clear(s.x,s.y,s.pose,s.tree),`bad footprint ${JSON.stringify(s)}`);
 save(D+'sleepers-resolved.json',report.sleepers);
 // Update ONLY Fair's registry line, leaving the other four workers' themes.
 const file='rive/web/themes/index.js',src=fs.readFileSync(file,'utf8'),line=src.split('\n').find(l=>l.startsWith('  fair:'));
 assert(line,'Fair missing from actual registry');
 fs.writeFileSync(file,src.replace(line,line.replace(/sleepers: \[.*\]/,'sleepers: '+JSON.stringify(report.sleepers))));
 console.log(`Fair life: ${art.kites.length} Home kites, Home hill, picnic, ${report.sleepers.length} resolved residents; 40 retained.`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))apply();
