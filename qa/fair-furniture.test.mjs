import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HOME_BENCH_ART,HOME_BENCH_SCALE,benchFeet} from '../scripts/bigger-fair/furniture.mjs';
import {isBench} from '../scripts/bigger-fair/benches.mjs';
import {inPoly,inShape} from '../assets/world/island-geometry.mjs';
import sharp from 'sharp';
import {render} from '../scripts/bigger-fair/render-core.mjs';
import {mapFor} from '../src/pixi/island-maps.js';
const A='public/pixi-art/themes/fair/';
const read=f=>JSON.parse(fs.readFileSync(f));
const art=read(A+'art.json'),layout=read('scripts/bigger-fair/centre-source/layout.json');
const walk=read('assets/world/themes/fair/walk-world.json'),nav=mapFor('fair').nav();
const benches=art.props.filter(isBench),placements=read('assets/world/themes/fair/placements.json');
const audit=read('scripts/bigger-fair/path-routes.json');
const polygons=audit.surface.type==='Polygon'?[audit.surface.coordinates]:audit.surface.coordinates;
const paved=(x,y)=>polygons.some(rings=>inPoly(x,y,rings[0])&&!rings.slice(1).some(h=>inPoly(x,y,h)));
test('EVERY Fair bench uses an unchanged upright Home view at the exact Home duck scale',()=>{
 assert.equal(benches.length,14);
 const home=fs.readFileSync('src/pixi/placements.js','utf8');
 assert(home.includes('scale: side ? .28 : .18'),'Home scale reference changed');
 for(const p of benches){
  assert.equal(p.src,'/pixi-art/detail/'+HOME_BENCH_ART[p.look]+'.svg',p.id);
  assert.equal(p.scale,HOME_BENCH_SCALE[p.look],p.id+' Home scale');
  assert.deepEqual([p.width,p.height],[818,463]);
  assert.deepEqual(p.anchor,{x:.5,y:451/463});
  for(const key of ['rotation','rotate','angle','skew','skewX','skewY','transform','matrix'])assert(!p[key]||p[key]===0,p.id+' '+key);
  assert(!p.flip,p.id+' uses its authored facing');
  const svg=fs.readFileSync('public'+p.src,'utf8');
  assert(!/rotate\(|matrix\(|skew|<filter|gradient|<image|opacity=/i.test(svg),p.id+' transformed art or baked shadow');
  assert.deepEqual(placements.find(q=>q.id===p.id),p,p.id+' runtime manifest drift');
 }
});
test('every drawn bench foot is on connected paving with one tight contact shadow and matching solid base',()=>{
 const contains=(rings,[x,y])=>inPoly(x,y,rings[0])&&!rings.slice(1).some(h=>inPoly(x,y,h));
 const routePoints=audit.routes.flatMap(r=>r.samples);
 for(const p of benches){
  const component=polygons.find(rings=>contains(rings,benchFeet(p)[0]));
  assert(component&&routePoints.some(q=>contains(component,q)),p.id+' isolated paved pad');
  for(const [x,y]of benchFeet(p))for(const [dx,dy]of [[0,0],[-2,0],[2,0],[0,-2],[0,2]]){
   assert(paved(x+dx,y+dy),p.id+' foot off paving '+[x,y]);
   assert(!walk.water.some(w=>inShape(x+dx,y+dy,w)),p.id+' wet foot');
  }
  assert.equal(p.shadow,true,p.id);
  assert(p.shadowSize[0]<=53&&p.shadowSize[1]<=9,p.id+' oversized contact');
  assert(p.shadowOffset.every(n=>Math.abs(n)<=4),p.id+' detached shadow');
  assert(walk.obstacles.some(o=>JSON.stringify(o)===JSON.stringify(p.footprint)),p.id+' collider');
  assert(!nav.walkable(p.footprint.x,p.footprint.y),p.id+' nonsolid seat');
 }
});
test('the baked ground actually paints sand beneath all four feet of every bench',async()=>{
 const svg=fs.readFileSync(A+art.ground.tiles[0].src,'utf8');
 const body=svg.match(/<g data-name="Fair unified paths">([\s\S]*?)<\/g>/)[1];
 for(const p of benches){
  const feet=benchFeet(p),x0=Math.floor(Math.min(...feet.map(q=>q[0])))-4,y0=Math.floor(Math.min(...feet.map(q=>q[1])))-4;
  const width=Math.ceil(Math.max(...feet.map(q=>q[0])))-x0+4,height=Math.ceil(Math.max(...feet.map(q=>q[1])))-y0+4;
  const raw=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}">${body}</svg>`)).ensureAlpha().raw().toBuffer();
  for(const [x,y]of feet){const i=(Math.round(y-y0)*width+Math.round(x-x0))*4;assert(raw[i+3]>250,p.id+' grass beneath rendered foot '+[x,y]);}
 }
});
test('hill overlay cannot paint grass back over the visible bench foot paving',async()=>{
 const p=benches.find(p=>p.id==='fair-life-hill-bench');
 const x=Math.floor(p.x-120),y=Math.floor(p.y-130),width=400,height=260;
 const png=await render({...art,props:[],floating:[]},{x,y,width,height,k:1,home:true,sleepers:false});
 const raw=await sharp(png).ensureAlpha().raw().toBuffer();
 for(const [fx,fy]of benchFeet(p)){
  const i=(Math.round(fy-y)*width+Math.round(fx-x))*4;
  assert.deepEqual([...raw.subarray(i,i+4)],[246,222,149,255],'hill grass covers drawn bench foot');
 }
});
test('paired seats keep equal court spacing and face inward using their drawn views',()=>{
 const get=id=>art.props.find(p=>p.id==='ac2-'+id);
 for(const [a,b,cx]of [['bench-01','bench-02',1286.7],['bench-03','bench-04',5853.3],['bench-05','bench-06',3570],['plaza-bench-west','plaza-bench-east',3570]]){
  const left=get(a),right=get(b);assert(Math.abs((left.x+right.x)/2-cx)<.01,a+' symmetric spacing');
  assert.equal(left.y,right.y,a+' same court latitude');
  for(const p of [left,right]){const [cx,cy,rx,ry]=p.court;const r=Math.hypot(((p.x-3570)/4.3+768-cx)/rx,((p.y-2220)/3.8+520-cy)/ry);assert(r>=.8&&r<=1.02,p.id+' court edge');}
  assert.deepEqual([left.look,right.look],a==='bench-05'?['front','front']:['right','left']);
 }
});
test('Fair contact shadows sit on actual feet once, without changing building grounding',()=>{
 const targets=art.props.filter(p=>/balloon-kiosk|lamp|tea-table|flour-crates|placed-ac2-(carousel|swing-ride|teacup-ride|ferris-wheel)/.test(p.src));
 assert(targets.length>=20);
 for(const p of targets){
  assert.equal(p.shadow,true,p.id);assert(p.shadowSize?.every(n=>n>0),p.id);
  assert(p.shadowOffset?.length===2,p.id);
  const svg=fs.readFileSync(A+p.src,'utf8');
  assert(!/opacity="(?:\.15|0\.15)"|id="[^"]*shadow|<filter/i.test(svg),p.id+' baked second shadow');
  assert(!/<image|gradient/i.test(svg),p.id);
 }
 for(const p of art.props.filter(p=>p.role))assert(p.shadowSize?.[0]>0,p.id+' missing existing building fit');
 const tea=targets.find(p=>p.src==='bigger/tea-table.svg');
 assert(Math.abs(tea.y+tea.shadowOffset[1]-(tea.y-tea.height*17/250))<.001,'table shadow at leg endpoints');
});
test('the balloon court is one flush checker surface in source and every baked tile',()=>{
 const svg=fs.readFileSync(A+'ac2/plaza-ground.svg','utf8');
 assert.equal((svg.match(/<ellipse /g)??[]).length,1);
 assert(!/stroke=|V94|M144 164|M144 172/.test(svg));
 for(const t of art.ground.tiles){const s=fs.readFileSync(A+t.src,'utf8');assert(!s.includes('<title>Checkered balloon plaza and entry steps</title>'),t.src+' still contains raised court');}
 const kiosk=fs.readFileSync(A+'ac2/balloon-kiosk.svg','utf8');
 assert(kiosk.includes('M42 181H158V221H42Z'));
 assert(kiosk.includes('<ellipse cx="161" cy="29"'),'balloon retained');
});
test('selectively squared Fair walls retain the fantasy roofs and caravan wheels',()=>{
 for(const name of ['rose-tulip','golden-petal','mint-daisy','lilac-bunting']){
  const s=fs.readFileSync(A+'hamlets/cloudpop/house-'+name+'.svg','utf8');
  assert(s.includes('H218V254H18Z'),name);assert(!s.includes('V254Q120 267'),name);
  assert(s.includes('M3 119C5 107'),'rounded roof retained');
 }
 for(const name of ['blue','yellow']){
  const s=fs.readFileSync(A+'hamlets/waddleshow/cottage-'+name+'.svg','utf8');
  assert(s.includes('V276H22Z'));assert(s.includes('translate(48 268)'));
  assert(s.includes('M8 138C-5 133'),'domed roof retained');
 }
});
