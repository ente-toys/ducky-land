import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {mapFor} from '../src/pixi/island-maps.js';
import {inPoly,inShape,geometry} from '../rive/web/island-geometry.mjs';
import {auditPink} from '../scripts/pink-final/audit.mjs';
import {checkTheme} from '../scripts/theme-index.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const shore=read('scripts/pink-fix/shore.json');
const original=read('scripts/bigger-pink/original-art.json'),oldWorld=read('scripts/bigger-pink/original-world.json'),oldWalk=read('scripts/bigger-pink/original-walk.json');
const art=read('public/pixi-art/themes/pink/art.json'),layout=read('scripts/bigger-pink/layout.json'),map=mapFor('pink');

test('Rosy preserves original residents and neighbourhood geometry through the approved centre replacement',()=>{
 const B=read('scripts/rosy-ground/data/population.json');
 for(const [pose,spots] of Object.entries(B.sleepers.originalAuthored))assert.deepEqual(map.world.sleepSpots[pose].slice(0,spots.length),spots);
 assert.equal(map.sleepers.length,90);
 assert.deepEqual(map.world.sleepAvoid,oldWorld.sleepAvoid);
 assert.ok(!art.decks.some(d=>d.id==='centre-back'));
 assert.ok(!art.props.some(p=>p.src.startsWith('centre/')));
 for(const [key,zone] of Object.entries(oldWorld.zones))if(!['plaza','stalls-1','stalls-3'].includes(key))assert.deepEqual(map.world.zones[key],zone);
 assert.deepEqual(map.spawn,{x:4000,y:3224.62});
 for(const bed of map.sleepers)assert.ok(map.landAt(bed.x,bed.y));
});

test('bigger Pink reaches every new court and completes both promenade loops with a negative origin',()=>{
 assert.deepEqual(map.origin,{x:-2600,y:-1900});
 assert.equal(map.width,13200);assert.equal(map.height,9800);
 const nav=map.nav(),from=map.spawn;
 for(const p of layout.places){const point=map.world.zones['bigger-'+p.id].spawn;assert.ok(nav.walkable(...point),p.id+' arrival');assert.ok(nav.route(from.x,from.y,...point).length,p.id+' route');}
 // Current path metadata is the exact sampled drawn network, without nearest fallbacks.
 for(const r of read('scripts/rosy-ground/sampled-routes.json'))for(const p of r.samples)assert.ok(nav.walkable(...p),r.id+' exact point '+p);
 for(const prop of layout.props.filter(p=>!p.id.startsWith('rosy-b-'))){
  assert.ok(inPoly(prop.x,prop.y,layout.coast),prop.id+' on land');
  if(prop.hamlet||read('scripts/pink-final/review-changes.json').movedProps.some(p=>p.id===prop.id))continue; // Approved hamlet canopies may overlap the former islet lawns.
  const w=prop.width*prop.scale,h=prop.height*prop.scale,a=prop.anchor??{x:.5,y:1};
  for(let y=0;y<=6;y++)for(let x=0;x<=6;x++){
   const px=prop.x-a.x*w+w*x/6,py=prop.y-a.y*h+h*y/6;
   const protectedLand=inPoly(px,py,oldWorld.coast)||oldWorld.islets.some(([cx,cy,rx,ry])=>((px-cx)/rx)**2+((py-cy)/ry)**2<1);
   assert.ok(!protectedLand,prop.id+' keeps original mainland and islets clear');
  }
 }
});

test('bigger Pink has GPU-safe ground tiles, visible solids and working refitted moorings',()=>{
 const report=checkTheme('pink');assert.deepEqual(report.problems,[]);
 for(const t of art.ground.tiles){const text=readFileSync(new URL('../public/pixi-art/themes/pink/'+t.src,import.meta.url),'utf8');const m=text.match(/width="([\d.]+)" height="([\d.]+)"/);assert.ok(+m[1]<=1536&&+m[2]<=1536,t.src);}
 const ids=new Set(art.props.map(p=>p.id));
 for(const o of layout.obstacles){assert.ok(o.name&&(ids.has(o.name)||/post|planter|leg/.test(o.name)),o.name+' visible source');assert.equal(map.nav().walkable(o.x,o.y),false,o.name+' blocks its base');}
 for(const b of map.boatSpots()){assert.equal(map.landAt(b.x,b.y),false);assert.ok(map.shoreFor(b.x,b.y,260),'boardable berth');}
 assert.ok(map.nav().route(map.HARBOR.land.x,map.HARBOR.land.y,map.spawn.x,map.spawn.y).length,'marina to plaza');
});

test('Pink communities have accessible household gates, distinct workplaces and linked residential lanes',()=>{
 const nav=map.nav();
 assert.equal(layout.places.length,5);
 const workplaces={ribbonwick:'hamlets/ribbonwick/ribbon-workshop.svg',melody:'hamlets/chirrup/dovecote-workplace.svg',quay:'hamlets/teacup/workplace-teacup-cafe.svg',petalpatch:'hamlets/petalpatch/rose-glass-conservatory.svg',tutu:'hamlets/tutu-tides/tutu-tailor-workshop.svg'};
 for(const p of layout.places){
  const houses=layout.props.filter(h=>h.zone===p.id&&h.household);
  assert.ok(houses.length===3,p.name+' is a neighbourhood');
  assert.ok(layout.props.some(h=>h.zone===p.id&&h.src===workplaces[p.id]),p.name+' workplace');
  for(const h of houses){
   const gate=nav.nearest(...h.door,120);
   assert.ok(gate,h.id+' open front gate');
   assert.ok(nav.route(map.spawn.x,map.spawn.y,...gate).length,h.id+' connected household');
  }
 }
 for(const p of layout.props.filter(p=>/worktable|potting-bench|music-rack|tea-table/.test(p.src))){
  const near=nav.nearest(p.x,p.y+100,80);
  assert.ok(near,p.id+' workplace approach');
  assert.ok(nav.route(map.spawn.x,map.spawn.y,...near).length,p.id+' workplace reachable');
 }
});

test('Pink fills the old moat and supports every real brook crossing',()=>{
 const raw=geometry({...map.walk,bridges:[]}),nav=map.nav();
 for(const [x,y] of [[958,2781],[6458,799],[7100,2786],[2200,4500],[5830,4500],[4000,5300]]){
  assert.ok(map.landAt(x,y),'filled old coast is sailing land '+x+','+y);
  assert.ok(!map.world.water.some(o=>inShape(x,y,o)),'no moat water '+x+','+y);
 }
 assert.deepEqual(map.world.islets,[]); assert.deepEqual(map.world.surfIslets,[]);
 assert.equal(shore.crossings.length,4);
 assert.equal(shore.crossings.filter(c=>c.id.startsWith('rosewater')).length,1,'one western promenade crossing');
 for(const c of shore.crossings){
  const mid=[(c.a[0]+c.b[0])/2,(c.a[1]+c.b[1])/2];
  assert.ok(map.world.water.some(o=>inShape(...mid,o)),c.name+' crosses real water');
  assert.equal(raw.walkable(...mid),false,c.name+' blocks walking without deck');
  assert.ok(nav.walkable(...mid),c.name+' supports walking');
  const near=nav.nearest(...mid,70);assert.ok(near,c.name+' grid access');
  assert.ok(nav.route(map.spawn.x,map.spawn.y,...near).length,c.name+' connected to centre');
 }
 for(const b of shore.brooks){
  assert.ok(map.world.water.some(o=>inShape(...b.centre.at(-1),o)),b.name+' mouth has water');
  assert.ok(!map.landAt(...b.centre.at(-1)),b.name+' reaches sea');
 }
 for(const b of map.boatSpots()){
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12;
   assert.equal(map.landAt(b.x+Math.cos(a)*94,b.y+Math.sin(a)*94),false,'full duck sailboat hull clears shore');
  }
  assert.ok(map.shoreFor(b.x,b.y,260),'boardable beach boat');
 }
});

test('Pink community layout retains its authored neighbourhoods',()=>{
 const before=read('scripts/bigger-pink/dense-before-layout.json');
 assert.deepEqual(layout.places.map(p=>[p.id,p.name,p.residents]),before.places.map(p=>[p.id,p.name,p.residents]),'five community identities preserved');
 for(const p of layout.places)assert.deepEqual(p.arrival,map.world.zones['bigger-'+p.id].spawn,'authored court arrival');
 assert.deepEqual(layout.coast,map.world.coast,'drawing and gameplay share the coast');
 const closed=layout.paths.filter(p=>p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1]);
 assert.equal(closed.length,2,'promenade and retained heart garden loop');
 assert.deepEqual([...new Set(layout.pathWidths)].sort((a,b)=>a-b),[104,128],'Home widths');
 assert.equal(layout.props.filter(p=>p.household).length,15);
 for(const c of layout.roadArt.densityMetrics.communities)assert.ok(c.meanDistanceToGreenAfter<c.meanDistanceToGreenBefore,c.name+' households closer to green');
});


test('Teacup Quay has a short usable jetty and exactly one duck sailboat beside its sandy shore',()=>{
 const jetty=map.world.jetties.find(j=>j.name==='teacup-quay');assert.ok(jetty);
 const [a,b]=[jetty.foot,jetty.tip];assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])<450);
 assert.ok(map.landAt(...a),'upper jetty meets the court');
 assert.ok(!inPoly(b[0],b[1]+90,map.world.coast),'short jetty reaches sea');
 const boats=map.boatSpots().filter(p=>Math.hypot(p.x-b[0],p.y-b[1])<600);assert.equal(boats.length,1);
 assert.ok(map.nav().nearest(...a,100),'landing is walkable');
 const court=layout.places.find(p=>p.id==='quay');assert.ok(Math.hypot(court.x-a[0],court.y-a[1])<700,'court belongs to its own waterfront');
});

test('Tutu Tides shore has authored coves and no straight diagonal cut',()=>{
 const pts=map.world.coast.filter(([x,y])=>x>4500&&x<5500&&y>6000&&y<6650);
 const mx=pts.reduce((s,p)=>s+p[0],0)/pts.length,my=pts.reduce((s,p)=>s+p[1],0)/pts.length;
 const slope=pts.reduce((s,[x,y])=>s+(y-my)*(x-mx),0)/pts.reduce((s,[,y])=>s+(y-my)**2,0);
 assert.ok(Math.max(...pts.map(([x,y])=>Math.abs(x-mx-slope*(y-my))))>100,'shore bends substantially away from a straight diagonal');
 assert.deepEqual(map.world.coast,map.baseWalk.coast,'drawn shore and walking coast agree');
 for(const p of layout.props)assert.ok(inPoly(p.x,p.y,layout.coast),p.id+' retained on dry grass');
 for(const h of ['ribbonwick','chirrup','petalpatch','teacup','tutu-tides'])assert.ok(art.props.some(p=>p.src.startsWith('hamlets/'+h+'/')),h+' imported');
});


test('Pink review has only OG plants and no prop, bridge, sleeper or path-end overlaps',()=>{
 const report=auditPink();assert.equal(report.forbiddenHamletPlantProps,0);assert.equal(report.remainingOverlapCount,0,JSON.stringify(report.remaining));
 assert.equal(report.checked.sleepers,map.sleepers.length);assert.ok(report.checked.props>400);assert.ok(report.checked.pathEnds>30);
 assert.ok(!art.props.some(p=>p.src==='detail/pink-car.svg'));
 assert.ok(!art.flats.some(p=>['detail/pink-close-road.svg','detail/pink-close-market.svg'].includes(p.src)));
 assert.ok(art.props.some(p=>p.id==='tutu-sand-lounger'&&map.landAt(p.x,p.y)));
 for(const [x,y]of [[9600,2850],[-1600,2800]])assert.ok(art.ground.tiles.some(t=>t.src.startsWith('expansion/shore/')&&x>=t.x&&x<=t.x+t.width&&y>=t.y&&y<=t.y+t.height),'road paint reaches '+x+','+y);
});


test('Pink redraw buildings retain their ground bases, declared widths and scaled shared blockers',()=>{
 const report=read('scripts/pink-final/building-report.json');assert.equal(report.buildings.length,19);assert.deepEqual(report.skipped,[]);
 for(const b of report.buildings){
  const p=art.props.find(p=>p.id===b.id);assert.ok(p);assert.equal(p.width*p.scale,b.width,p.id+' target width');assert.deepEqual([p.x,p.y],b.base,p.id+' base fixed');assert.ok(p.shadow,p.id+' scaled base shadow');
  assert.equal(p.anchor.y,1);assert.deepEqual(p.door??null,b.door??null,p.id+' scaled door');
  for(const data of [map.world,map.baseWalk])assert.ok(data.obstacles.some(o=>o.name===p.id),p.id+' shared walk blocker');
 }
});

test('Pink joins use one unioned floor boundary and no independently outlined path flats',()=>{
 const report=read('scripts/rosy-ground/surface-report.json');assert.ok(report.routes>=30);
 assert.ok(report.noInternalOutlines);assert.ok(!art.flats.some(p=>/^hamlets\/.*\/paths/.test(p.src)));
 const source=readFileSync(new URL('../public/pixi-art/themes/pink/expansion/merged/unified-paths.svg',import.meta.url),'utf8');
 const paths=[...source.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);assert.equal(paths.length,1,'one opaque surface without a lower-edge band');
 assert.deepEqual([...new Set(source.match(/#[0-9a-f]{6}/gi))],['#FBE6C8']);
 for(const t of art.ground.tiles.filter(t=>t.src.startsWith('expansion/shore/')))assert.ok(readFileSync(new URL('../public/pixi-art/themes/pink/'+t.src,import.meta.url),'utf8').includes('data-name="Rosy unified paths"'),t.src+' uses merged geometry');
});


test('Pink union preserves the heart lawn and now also serves the music-box terrace',async()=>{
 const svg=readFileSync(new URL('../public/pixi-art/themes/pink/expansion/merged/unified-paths.svg',import.meta.url),'utf8');
 async function alphaAt(x,y){const crop=svg.replace(/<svg[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="${x-2} ${y-2} 4 4">`);const {data}=await sharp(Buffer.from(crop)).ensureAlpha().raw().toBuffer({resolveWithObject:true});return data[(2*4+2)*4+3];}
 assert.equal(await alphaAt(4000,1600),0,'the enclosed heart lawn remains grass');
 assert.ok(await alphaAt(4000,3000)>0,'one travel surface continues through the terrace');
 assert.ok(!art.flats.some(p=>['pink-close-plaza','pink-close-court'].includes(p.id)));
 assert.ok(art.flats.some(p=>p.id==='plaza-floor'));
});

test('Rosy ribbon centre retires all terrace art and all raised walk blockers',()=>{
 for(const data of [map.world,map.baseWalk]){
  assert.deepEqual(data.centrePlacement.stairs,[]);
  assert.equal(data.centrePlacement.blocked.length,6);
  assert.ok(!data.obstacles.some(o=>o.centre==='locked'));
 }
 for(const cat of ['flats','decks','props'])assert.ok(!art[cat].some(p=>p.src.startsWith('centre/')));
});
