import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {integrate,validate,ROOT,ART,bounds,propPathClearance,pathClearance} from '../scripts/iceland-final/place.mjs';
import {isCanopy,isSoftPatch,canopyProblems,fenceProblems,softPatchProblems,snowmanProblems} from '../scripts/iceland-final/fix-all.mjs';
const result=await integrate(),{art,world,report,files}=result;
const source=p=>files.get(path.join(ART,p.src))??readFileSync(path.join(ROOT,ART,p.src),'utf8');

test('every pine and shrub silhouette clears buildings, their front yards and the full path width',()=>{
 for(const p of art.props.filter(isCanopy))assert.deepEqual(canopyProblems(p,art,world),[],p.id);
 const b=art.props.find(p=>p.id==='cocoa-hut');
 const tree={...art.props.find(p=>p.finalKind==='tree'),id:'front-yard-tree',x:b.x,y:b.y+300};
 assert.ok(canopyProblems(tree,art,world).some(s=>s.includes('tree in front of building')),'the trunk may clear the facade while its canopy hides the door');
 const [x,y]=world.iceland2.routes[0].samples[3];
 assert.ok(canopyProblems({...tree,x,y:y+tree.height*.5},art,world).some(s=>s.includes('canopy hides path')),'the entire silhouette is checked, not just the trunk');
 const broken={...result,...structuredClone({art,world,report})};broken.art.props.push(tree);
 assert.ok(validate(broken).some(s=>s.includes('front-yard-tree')));
});

test('every soft patch has organic curves, transparent bounds and no rectangular crop background',async()=>{
 const patches=[...art.flats,...art.props].filter(isSoftPatch);
 assert.ok(patches.length>=20);
 for(const p of patches){
  const svg=source(p);assert.deepEqual(softPatchProblems(svg,p.id),[]);
  const {data,info}=await sharp(Buffer.from(svg)).resize(180,120,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let x=0;x<info.width;x++)for(const y of [0,info.height-1])assert.equal(data[(y*info.width+x)*4+3],0,p.id+' horizontal clipping edge');
  for(let y=0;y<info.height;y++)for(const x of [0,info.width-1])assert.equal(data[(y*info.width+x)*4+3],0,p.id+' vertical clipping edge');
  const corner=p.tiles.find(t=>t.x===0&&t.y===0);
  const crop=files.get(path.join(ART,corner.src));
  const raw=await sharp(Buffer.from(crop)).ensureAlpha().raw().toBuffer();
  assert.equal(raw[3],0,p.id+' stale opaque crop corner');
 }
 for(const svg of ['<svg><rect width="900" height="600" fill="#eef3f9" opacity=".2"/></svg>','<svg><path d="M0 0H900V600H0Z"/></svg>'])assert.ok(softPatchProblems(svg).length);
 const broken={...result,files:new Map(files)};const p=patches[0];broken.files.set(path.join(ART,p.src),'<svg><rect width="900" height="600"/></svg>');
 assert.ok(validate(broken).some(s=>s.includes('straight-edged soft patch')));
});

test('all low fences join another post in a yard perimeter, with an open path entrance',()=>{
 const fences=art.props.filter(p=>p.finalRole==='fence');assert.ok(fences.length>=6);
 assert.deepEqual(fenceProblems(art),[]);
 for(const p of fences){assert.equal(p.scene,'snowman-scene');assert.ok(propPathClearance(world,p)>=0);assert.ok(source(p).includes('yard')||source(p).includes('<ellipse'));
  for(const [x,y]of p.fenceEndpoints)assert.ok(world.obstacles.some(o=>o.prop===p.id&&o.poly),'joined rails have physical footprints');
 }
 const broken=structuredClone(art);broken.props.push({...fences[0],id:'loose-fence',fenceRun:'stray',fenceEndpoints:[[10,10],[170,10]]});
 assert.deepEqual(fenceProblems(broken),['isolated fence segment loose-fence']);
 broken.props=broken.props.filter(p=>p.id!=='loose-fence');const run=fences[0].fenceRun;broken.props=broken.props.filter(p=>p.fenceRun!==run||p.id===fences[0].id);
 assert.ok(fenceProblems(broken).some(s=>s.includes(fences[0].id)),'a labelled perimeter with only one piece is still isolated');
});

test('snowman B contains the cabin, shed, supplies, distinct build stages and two bench sleepers',()=>{
 assert.deepEqual(snowmanProblems(art,report),[]);
 const parts=art.props.filter(p=>p.scene==='snowman-scene'),stages=parts.filter(p=>p.buildStage),rear=parts.filter(p=>p.buildingSilhouette);
 assert.ok(rear.every(p=>p.y<Math.min(...stages.map(p=>p.y))));
 for(const seat of report.snowmanSeats){
  const bench=parts.find(p=>p.id===seat.bench),bb=bounds(bench),bed=report.sleepers.find(p=>p.seat===bench.id);
  assert.ok(bed.x>bb.x0&&bed.x<bb.x1&&bed.y>bb.y0&&bed.y<bb.y1,'sleeper rests inside the bench drawing');
  assert.ok(bench.z<bed.y,'bench sorts behind its resident');assert.equal(bed.pose,'wing');
 }
 const broken=structuredClone(art);broken.props=broken.props.filter(p=>p.finalRole!=='woodshed');
 assert.ok(snowmanProblems(broken,report).includes('snowman yard missing woodshed'));
 for(const p of broken.props.filter(p=>p.buildStage))p.y=7800;
 assert.ok(snowmanProblems(broken,report).includes('snowman yard stiff row'));
});

test('each facade has one approach lamp, houses have one path-side mailbox and cocoa seats face the table',()=>{
 for(const b of art.props.filter(p=>p.finalKind==='building')){
  const yard=art.props.filter(p=>p.building===b.id),lamps=yard.filter(p=>p.finalRole==='lamp'),mail=yard.filter(p=>p.finalRole==='mailbox');
  assert.equal(lamps.length,1,b.id);assert.ok(lamps[0].pathLamp);assert.equal(mail.length,b.finalRole.startsWith('cottage-')?1:0,b.id);
  for(const p of mail){assert.ok(Math.hypot(p.x-lamps[0].x,p.y-lamps[0].y)<=150);assert.ok(pathClearance(world,p.x,p.y)<=200);assert.ok(propPathClearance(world,p)>=8);}
 }
 const table=art.props.find(p=>p.id==='cocoa-garden-table'),benches=art.props.filter(p=>p.scene==='cocoa-garden'&&p.finalRole==='bench');
 assert.equal(benches.length,2);for(const p of benches)assert.deepEqual(p.faces,[table.x,table.y]);
});
