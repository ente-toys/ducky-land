import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ROOT,ART,WORLD,WORKERS,loadCatalog,integrate,validate,bounds,overlaps,pathClearance,propPathClearance,landViews,viewCoverage,area,homeDensity} from '../scripts/iceland-final/place.mjs';
import sharp from 'sharp';
import {maxSleepersInView,quality3Problems} from '../scripts/iceland-final/quality3.mjs';
import {geometry,inShape} from '../assets/world/island-geometry.mjs';
import {onRink} from '../src/gameplay/rink-slide.js';
import {makeMap} from '../src/world/island-maps.js';
import {resolveSleepSpots,sleepHalfWidths,sleepShapeProblems} from '../src/world/home/sleep-spots.js';

const read = file=>JSON.parse(readFileSync(path.join(ROOT,file)));
const originalArt=read(ART+'/art.json'),originalWorld=read(WORLD+'/world.json');
const density=await homeDensity();
const catalog=loadCatalog(ROOT,{dryRun:true});
const result=await integrate({catalog,density,inputArt:originalArt,inputWorld:originalWorld});
const {art,world,report}=result;
const all=[...art.props,...art.flats];

test('Iceland final composition passes the integration gate using available real manifests',()=>{
 assert.deepEqual(validate(result),[]);
 assert.equal(report.counts.buildings,14);
 assert.deepEqual(world.coast,originalWorld.coast);
 assert.deepEqual(world.paths,originalWorld.paths);
 assert.deepEqual(world.iceland2,originalWorld.iceland2);
 assert.deepEqual(art.ground,originalArt.ground);
 assert.deepEqual(art.flats.find(p=>p.id==='rink'),originalArt.flats.find(p=>p.id==='rink'));
 assert.equal(world.iceland2.snowfall,true);
});

test('natural lake replaces fence, gates and centre tree with the complete flat SVG kit',()=>{
 const r=world.iceland2.rink,ice=art.flats.find(p=>p.id==='rink');
 assert.equal(r.type,'natural-lake');assert.ok(r.poly.length>200);
 assert.equal(world.iceland2.gates,undefined);assert.equal(r.posts,undefined);assert.equal(r.rails,undefined);
 assert.ok(!art.props.some(p=>/^rink-fence/.test(p.id)||p.id==='decorated-pine'));
 assert.ok(ice.src.startsWith('final/rink/'));
 const surface=result.files.get(path.join(ART,ice.src));
 for(const id of ['shore-snow','lake-ice','heart-carving','skate-swirl-lines'])assert.ok(surface.includes(`id="${id}"`));
 assert.ok(surface.includes('fill="#a6deec"'));assert.ok(!/gradient|filter|<image/.test(surface));
 const expected=['warming-hut','jetty','rock-1','rock-2','rock-3','reeds-1','reeds-2','bench-skates','lantern-post','mug-table','woodpile','sled','ice-decal'];
 assert.deepEqual(report.lake.pieces,expected);
 for(const name of expected){const source=result.files.get(path.join(ART,'final/rink',name+'.svg'));assert.ok(source?.includes('<svg'));assert.ok(source.includes('stroke="#39472d"'));assert.ok(!/gradient|<image|filter/.test(source));}
 assert.ok(geometry(world).walkable(...r.heart));assert.ok(onRink(r,...r.heart));
 assert.ok(Math.abs(area(r.poly)/(1089.3755*674.8597)-.7)<.2,'similar lake area');
 const walk=geometry(world).walkable;
 for(const [x,y] of r.poly.filter((_,i)=>i%8===0)){
  const blocked=world.obstacles.some(o=>inShape(x,y,o,16));
  assert.equal(walk(x,y),!blocked,'no invisible shore wall');
 }
});

test('quality pass preserves approved buildings, paths, rink, snow and resident count',()=>{
 const fixed=a=>a.props.filter(p=>['building','smoke'].includes(p.finalKind));
 assert.deepEqual(fixed(art),fixed(originalArt));
 assert.deepEqual(report.yards,originalArt.icelandFinal.yards);
 const base=makeMap('snow',{world,walk:world,harbor:read(WORLD+'/harbor.json'),sleepers:[]}).baseWalk;
 const beds=resolveSleepSpots(base,art.props,geometry(base).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
 assert.equal(beds.length,60);assert.deepEqual(beds.bad,[]);assert.equal(new Set(beds.map(b=>b.pose)).size,8);
});

test('every new door meets its original path and every facade has a furnished yard and smoke',()=>{
 for(const [id,x,y] of originalWorld.iceland2.doors){
  const p=art.props.find(p=>p.id===id),a=catalog.get(p.finalRole),b=bounds(p);
  assert.deepEqual(p.door,[x,y]);
  const door=a.door??{x:a.width/2,y:a.height-30};
  assert.ok(Math.abs(b.x0+door.x*p.width/a.width-x)<.02,id+' door x');
  assert.ok(Math.abs(b.y0+door.y*p.height/a.height-y)<.02,id+' door y');
  assert.ok(Math.abs(p.width/p.height-a.width/a.height)<.001,id+' aspect ratio');
  const yard=art.props.filter(q=>q.building===id);
  for(const role of ['woodpile','lamp','bench'])assert.ok(yard.some(p=>p.finalRole===role),id+' missing '+role);
  assert.equal(yard.filter(p=>p.finalRole==='fence').length,0);
  assert.equal(yard.filter(p=>p.finalRole==='lamp').length,1);
  assert.equal(yard.filter(p=>p.finalRole==='mailbox').length,p.finalRole.startsWith('cottage-')?1:0);
  const plants=yard.filter(p=>p.finalRole==='flowerpot');
  assert.equal(plants.length,2,id+' door has no planted shoulders');
  assert.ok(plants.some(p=>p.x<x)&&plants.some(p=>p.x>x),id+' plants must flank the door');
  for(const plant of plants){assert.ok(Math.abs(plant.x-x)<=100&&Math.abs(plant.y-p.y)<5,id+' planter must meet the facade');assert.ok(plant.z>p.y,id+' planter hidden behind facade');}
  const drifts=art.flats.filter(q=>q.building===id&&q.finalRole==='wall-drift');
  assert.equal(drifts.length,2,id+' bare walls');
  for(const drift of drifts)assert.ok(Math.abs(drift.y-p.y)<=20,id+' drift detached from wall');
  const dressing=report.yardDressing.find(q=>q.building===id);
  assert.ok(dressing.route.distance<1,id+' yard does not connect to an original ice route');
  const approachLamp=yard.find(q=>q.id===dressing.pathLamp);
  assert.ok(approachLamp?.pathLamp,id+' missing light by the ice approach');
  assert.ok(pathClearance(world,approachLamp.x,approachLamp.y)<=160,id+' approach light too far from path');
  assert.ok(propPathClearance(world,approachLamp)>=8,id+' light intrudes into approach');
  assert.ok(p.embeddedSmoke||art.props.some(p=>p.id===id+'-chimney-smoke'&&p.contact===false));
  assert.ok(geometry(world).walkable(x,y),id+' blocked door');
 }
 assert.ok(new Set(art.props.filter(p=>p.finalRole?.startsWith('cottage-')).map(p=>p.src)).size>=4);
});

test('roof furniture is removed and new props and ground details leave the paths clear',()=>{
 for(const id of ['home-bench-2','home-bench-3','bakery-bread-cart'])assert.ok(!art.props.some(p=>p.id===id),id);
 const buildings=art.props.filter(p=>p.finalKind==='building');
 for(const p of all.filter(p=>p.finalKind&&!['building','smoke','scene-base'].includes(p.finalKind))){
  if(p.wallDressing){assert.ok(p.building&&buildings.some(b=>b.id===p.building),'wall dressing has no facade');continue;}
  assert.ok(!buildings.some(b=>overlaps(bounds(p),p.finalKind==='path-edge'?{...bounds(b),y1:b.door[1]+4}:bounds(b))),p.id+' overlaps a building');
  if(!p.continuousTrail)assert.ok(pathClearance(world,p.x,p.y)>=0,p.id+' on path');
  if(['yard','scene','nook','vignette'].includes(p.finalKind))assert.ok(propPathClearance(world,p)>=0,p.id+' sprite overlaps the snow lip');
 }
 const walk=geometry(world).walkable;
 for(const route of world.iceland2.routes)for(const p of route.samples)assert.ok(walk(...p),route.id+' blocked');
 for(const o of world.obstacles)assert.ok(art.props.some(p=>p.id===o.prop),'orphan '+o.prop);
 for(const p of art.props.filter(p=>p.finalKind&&!['smoke'].includes(p.finalKind)&&!p.occupiedBySleeper&&p.contact!==false))assert.ok(world.obstacles.some(o=>o.prop===p.id),'no footprint '+p.id);
});

test('pine and shrub counts survive in compact groves, with no duplicated trunks',()=>{
 const trees=art.props.filter(p=>p.finalKind==='tree'),shrubs=art.props.filter(p=>p.finalKind==='shrub');
 assert.equal(trees.length,report.sourceLayout.treeCount*2);assert.ok(shrubs.length<80,'retire the hundreds of isolated shrub pairs');
 assert.equal(new Set(trees.map(p=>p.src)).size,3,'reuse the three pine textures');
 for(const role of ['pine-small','pine-medium','pine-large'])assert.ok(trees.filter(p=>p.finalRole===role).length>150,role);
 assert.equal(new Set(trees.map(p=>p.x+','+p.y)).size,trees.length);
 for(const p of trees){const same=trees.filter(q=>q.grove===p.grove&&q!==p);
  assert.ok(same.length>=1,p.id+' ungrouped tree');
  assert.ok(same.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<400),p.id+' isolated');
 }
});

test('new grove crowns frame scenes and clear every route, yard and resident',()=>{
 for(const p of art.props.filter(p=>p.feedbackAdded)){
  const b=bounds(p);
  for(const r of world.iceland2.routes)for(const [x,y] of r.samples)assert.ok(!(x>b.x0-80&&x<b.x1+80&&y>b.y0-80&&y<b.y1+80),p.id+' hides '+r.id);
  assert.ok(art.props.some(q=>q!==p&&q.finalKind==='tree'&&q.grove===p.grove&&Math.hypot(p.x-q.x,p.y-q.y)<330),p.id+' isolated');
 }
});

test('ground motifs use crisp shared SVG crops at their actual placed size, without blurry shade patches',()=>{
 const ground=report.ground.clusters;
 assert.equal(report.ground.baked,false);assert.ok(ground.filter(p=>p.role!=='trail').length<300,'fewer grouped details');
 assert.equal(report.ground.rendering,'shared-svg-crops');
 assert.ok(!all.some(p=>['ground','path-edge'].includes(p.finalKind)||['tuft','snowbank-edge'].includes(p.finalRole)));
 for(const role of ['frost-cluster','drift-cluster','trail','pebbles-cluster'])assert.ok(ground.some(c=>c.role===role),role);
 assert.ok(!ground.some(c=>c.role==='shade-cluster'),'retired broad shade smudges');
 for(const c of ground){
  assert.ok(c.motifCount>=2,c.id+' isolated ground item');
  const flat=art.flats.find(p=>p.id===c.id);assert.ok(flat?.tiles.length,c.id+' missing SVG detail crops');
  assert.equal(flat.width,c.width);assert.equal(flat.height,c.height);
  for(const tile of flat.tiles){assert.equal(tile.resolution,4);assert.ok(tile.width<=128&&tile.height<=128);assert.ok(result.files.has(path.join(ART,tile.src)));}
  const svg=result.files.get(path.join(ART,c.src))??readFileSync(path.join(ROOT,ART,c.src),'utf8');
  assert.ok(!/gradient|filter|<image/.test(svg),c.id+' non-vector or filtered detail');
  if(c.role!=='shade-cluster')assert.ok(!art.props.filter(p=>!['tree','shrub','smoke'].includes(p.finalKind)).some(p=>overlaps(bounds(c),bounds(p),5)),c.id+' under furniture');
 }
 const terrain=result.files.get(path.join(ART,art.ground.vector));assert.ok(!terrain.includes('data-ground-cluster='),'detail must not be downsampled into terrain');
});

test('sixty residents share furnished camps and the snowman yard and never exceed four in any view',()=>{
 assert.equal(report.camps.length,21);
 assert.equal(maxSleepersInView(report.sleepers),4);
 for(const camp of report.camps){
  assert.ok(camp.residents.length>=2&&camp.residents.length<=4);
  for(const id of [camp.focal,camp.lamp,camp.patch])assert.ok(all.some(p=>p.id===id),id);
  for(const b of camp.residents)assert.ok(Math.hypot(b.x-camp.x,b.y-camp.y)<=(camp.id==='snowman-scene'?500:400));
  const patch=all.find(p=>p.id===camp.patch),svg=result.files.get(path.join(ART,patch.src))??readFileSync(path.join(ROOT,ART,patch.src),'utf8');
  assert.ok(svg.includes('#eef3f9')&&!svg.includes('stroke='));
 }
 assert.deepEqual(quality3Problems(art,world,report),[]);
});

test('coverage counts composed groups and every small detail has a nearby parent',()=>{
 const views=landViews(world,{stride:120});assert.ok(views.length>4000);
 for(const v of views)assert.deepEqual(viewCoverage(v,art,report),{composedPlace:true},`land view ${v.x0},${v.y0}`);
 for(const [x,y]of [[5100,1500],[6900,1500],[3300,3000],[8700,4500],[3300,7500]])assert.deepEqual(viewCoverage({x0:x-720,x1:x+720,y0:y-450,y1:y+450},art,report),{composedPlace:true});
 const empty={props:[],flats:[],icelandFinal:{groups:[]}};
 assert.deepEqual(viewCoverage(views[0],empty),{composedPlace:false});
 for(const g of report.groups.filter(g=>g.kind==='grove'))assert.ok(g.members.length>=5&&g.members.length<=12,g.id+' composition size');
 assert.equal(report.coverage.maxIsolatedSmallItemDistance,120);
 assert.ok(!all.some(p=>p.finalRole==='frozen-puddle'||p.finalRole==='tracks-cluster'));
 const unowned=structuredClone({art,world,report});
 unowned.art.flats.push({id:'stray-stone',finalKind:'ground-detail',finalRole:'pebbles-cluster',x:8700,y:4500,width:40,height:20});
 assert.ok(quality3Problems(unowned.art,world,report).includes('unowned small item stray-stone'));
 const crowded=structuredClone(report);crowded.sleepers=Array.from({length:5},(_,i)=>({x:8700+i*10,y:4500}));
 assert.ok(quality3Problems(art,world,crowded).includes('more than four sleepers in a view'));
 assert.equal(report.trails.length,21);
 for(const trail of report.trails){assert.equal(trail.from,'ice-path');assert.equal(trail.to,trail.camp);assert.ok(trail.gaps.every(d=>d<=31));}
});

test('sled hill fits one screen with a curved unoutlined base, deck, flags, sleds and cocoa',async()=>{
 const hill=art.flats.find(p=>p.id==='sled-hill'),svg=readFileSync(path.join(ROOT,ART,hill.src),'utf8');
 assert.ok(hill.width<=720&&hill.height<=400);
 for(const id of ['mound-snow','mound-shade']){
  const tag=svg.match(new RegExp(`<path id="${id}"[^>]*>`))?.[0];assert.ok(tag,id);
  assert.ok(tag.includes('stroke="none"'));assert.ok(!/[HLhl]/.test(tag.match(/\bd="([^"]+)"/)[1]),id+' straight skirt');
 }
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let y=420;y<info.height;y++){
  let ink=0;for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4;if(data[i+3]>200&&data[i]<100&&data[i+1]<110&&data[i+2]<100)ink++;}
  assert.ok(ink<20,'bottom outline at source row '+y);
 }
 const members=art.props.filter(p=>p.scene==='sled-scene'&&p.finalKind!=='nook');
 assert.ok(members.some(p=>p.finalRole==='cocoa-cart'));assert.equal(members.filter(p=>p.finalRole==='sled').length,2);
 const boxes=[bounds(hill),...members.map(bounds)];
 assert.ok(Math.max(...boxes.map(b=>b.x1))-Math.min(...boxes.map(b=>b.x0))<1440);
 assert.ok(Math.max(...boxes.map(b=>b.y1))-Math.min(...boxes.map(b=>b.y0))<900);
 assert.ok(svg.includes('launch deck')&&svg.includes('pennants'));
 for(const id of ['crest-fence','runner-tracks','run-flags','slope-drifts','framing-pines'])assert.ok(svg.includes(`id="${id}"`),id+' missing slope detail');
});

test('one continuous soft snow lip follows the original Bezier on both sides of every route without join seams',()=>{
 const terrain=result.files.get(path.join(ART,art.ground.vector));
 assert.equal((terrain.match(/id="snow-lip"/g)??[]).length,1);
 const lip=terrain.match(/<g id="snow-lip"[^>]*>([\s\S]*?)<\/g>/)[1];
 assert.ok(!/#39472d|#232323|stroke-dasharray/.test(lip));
 assert.equal((lip.match(/stroke="#eef3f9"/g)??[]).length,world.iceland2.routes.length+1);
 assert.equal((lip.match(/stroke="#d4dfec"/g)??[]).length,world.iceland2.routes.length+1);
 for(const r of world.iceland2.routes){
  const band=report.pathEdges.find(e=>e.route===r.id);assert.deepEqual(band.sides,[-1,1]);
  assert.ok(lip.includes(`d="${band.d}" fill="none" stroke="#eef3f9" stroke-width="${r.width+24}"`),r.id+' continuous raised band');
  assert.ok(lip.includes(`d="${band.d}" fill="none" stroke="#d4dfec" stroke-width="${r.width+4}"`),r.id+' thin path-side shadow');
 }
 assert.ok(lip.lastIndexOf('#eef3f9')<lip.indexOf('#d4dfec'));
 assert.ok(terrain.indexOf(lip)<terrain.indexOf('stroke="#a6deec"'));
});

test('activity pieces form local scenes and all sixty residents resolve in their scenes',()=>{
 for(const id of ['sled-scene','snowman-scene','rink-scene','cocoa-garden']){
  const scene=report.scenes.find(s=>s.id===id);assert.ok(scene?.props.length>=5,id);
  const parts=art.props.filter(p=>p.scene===id);
  for(const p of parts)assert.ok(Math.hypot(p.x-scene.x,p.y-scene.y)<1300,p.id+' wandered out of scene');

 }
 assert.deepEqual(sleepShapeProblems(world.sleepSpots,60),[]);
 const beds=resolveSleepSpots(world,art.props,geometry(world).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
 assert.equal(beds.length,60);assert.deepEqual(beds.bad,[]);
 assert.equal(report.camps.length,21);
});

test('all referenced art, retained terrain crops and new pieces are existing SVGs',()=>{
 assert.deepEqual(validate(result).filter(e=>/missing asset|non-SVG/.test(e)),[]);
 for(const p of all.filter(p=>p.finalKind)){
  assert.ok(p.src.endsWith('.svg'));
  const file=p.src.startsWith('/')?path.join(ROOT,'public',p.src):path.resolve(ROOT,ART,p.src);
  assert.ok(existsSync(file)||result.files.has(path.relative(ROOT,file)),p.src);assert.ok((result.files.get(path.relative(ROOT,file))??readFileSync(file,'utf8')).includes('<svg'),p.src);
 }
});

test('missing worker manifests use placeholders only for dry-run, without modifying inputs',async t=>{
 const empty=mkdtempSync(path.join(os.tmpdir(),'iceland-place-test-'));t.after(()=>rmSync(empty,{recursive:true,force:true}));
 assert.throws(()=>loadCatalog(ROOT,{manifestDir:empty}),/Missing manifests/);
 const c=loadCatalog(ROOT,{dryRun:true,manifestDir:empty});assert.deepEqual(c.missing,WORKERS);
 const before=JSON.stringify({originalArt,originalWorld});
 const preview=await integrate({catalog:c,density,inputArt:originalArt,inputWorld:originalWorld});
 assert.deepEqual(validate(preview).filter(e=>!e.startsWith('blank land view')),[]);assert.equal(preview.report.counts.sleepers,60);
 assert.ok(preview.report.placeholderRoles.length>=3);assert.equal(JSON.stringify({originalArt,originalWorld}),before);
});

test('rerunning integration is deterministic and does not accumulate art or obstacles',async()=>{
 const again=await integrate({catalog:loadCatalog(ROOT,{dryRun:true}),density,inputArt:art,inputWorld:world});
 assert.deepEqual(again.art,art);assert.deepEqual(again.world,world);
});

test('QA rejects roof furniture, path props, missing assets and orphan collision',()=>{
 const broken=structuredClone({art,world,report}),b=broken.art.props.find(p=>p.id==='bakery');
 broken.art.props.push({id:'roof-cart',src:'absent.svg',x:b.x,y:b.y-80,width:30,height:30,finalKind:'scene'});
 const [x,y]=world.iceland2.routes[0].samples[2];broken.art.props.push({id:'path-box',src:'absent.svg',x,y,width:20,height:20,finalKind:'scene'});
 broken.world.obstacles.push({x:10,y:10,rx:10,ry:10,prop:'gone'});
 const issues=validate(broken);
 for(const fragment of ['roof overlap roof-cart','path overlap path-box','missing asset absent.svg','orphan obstacle gone'])assert.ok(issues.some(s=>s.includes(fragment)),fragment);
});

test('QA rejects a stripped facade even when other nearby furniture still fills the view',()=>{
 const broken=structuredClone({art,world,report});
 broken.art.props=broken.art.props.filter(p=>p.id!=='bakery-door-pot-left');
 broken.art.flats=broken.art.flats.filter(p=>p.building!=='bakery'||p.finalRole!=='wall-drift');
 broken.report.yardDressing.find(p=>p.building==='bakery').route.distance=200;
 const issues=validate(broken);
 for(const message of ['bare door bakery','bare walls bakery','disconnected yard bakery'])assert.ok(issues.includes(message),message);
});
