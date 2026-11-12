import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeMap} from '../../src/pixi/island-maps.js';
import {Sprite,Texture} from 'pixi.js';
import {animatePieces} from '../../src/pixi/centre-motion.js';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/pink/',D='assets/world/themes/pink/',B='../concepts/themes/work/live-persp/before/',O=B+A;
const c=read(A+'centre/centre.json'),old=read(O+'centre/centre.json'),art=read(A+'art.json'),before=read(B+A+'art.json'),w=read(D+'world.json'),was=read(B+D+'world.json'),walk=read(D+'walk-world.json'),walkWas=read(B+D+'walk-world.json'),harbor=read(D+'harbor.json');
const omit=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
assert.deepEqual(omit(art,['props','flats','decks']),omit(before,['props','flats','decks']));
for(const key of ['props','flats','decks'])assert.deepEqual(art[key].filter(p=>!p.id?.startsWith('centre-')),before[key].filter(p=>!p.id?.startsWith('centre-')),key+' outside centre changed');
assert.deepEqual(omit(w,['obstacles','centrePlacement']),omit(was,['obstacles','centrePlacement']));
assert.deepEqual(omit(w.centrePlacement,['blocked','walkable','stairs']),omit(was.centrePlacement,['blocked','walkable','stairs']));
assert.deepEqual(w.obstacles.filter(o=>o.centre!=='locked'),was.obstacles.filter(o=>o.centre!=='locked'));
assert.deepEqual(omit(walk,['obstacles']),omit(walkWas,['obstacles']));
assert.deepEqual(walk.obstacles.filter(o=>o.centre!=='locked'),walkWas.obstacles.filter(o=>o.centre!=='locked'));
assert.deepEqual(c.pieces.find(p=>p.id==='dancer'),old.pieces.find(p=>p.id==='dancer'));
assert.equal(fs.readFileSync(A+'centre/dancer.svg','utf8'),fs.readFileSync(O+'centre/dancer.svg','utf8'));
assert.deepEqual(c.pieces.find(p=>p.id==='decal-plaza'),old.pieces.find(p=>p.id==='decal-plaza'));
assert.equal(fs.readFileSync(A+'centre/decal-plaza.svg','utf8'),fs.readFileSync(O+'centre/decal-plaza.svg','utf8'));
assert.deepEqual(c.pieces.find(p=>p.id==='wind-key').animate,old.pieces.find(p=>p.id==='wind-key').animate);
assert.equal(c.depthRatio,.766);assert.equal(c.outerEdge.terrace.ry/c.outerEdge.terrace.rx,.766);
assert.equal(c.stairs[0].widthTop,c.stairs[0].widthBottom);
assert.equal(c.stairs[0].widthTop/(c.outerEdge.terrace.rx*2),.45);
assert.equal(c.stairs[0].steps,7);assert.equal(c.stairs[0].tread+c.stairs[0].riser,52);
const box=fs.readFileSync(A+'centre/music-box.svg','utf8');
assert(box.includes('A275 210.65'),'Box base uses .766 ground ratio');
assert(!box.includes('gradient'),'Flat colour artwork');
for(const p of c.pieces){
 const file=fs.readFileSync(A+'centre/'+p.file,'utf8'),vb=file.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
 // The untouched dancer was traced at a different internal resolution.
 if(p.id!=='dancer')assert.deepEqual(vb,[p.x,p.y,p.width,p.height].map((v,i)=>p.id==='wind-key'&&i<2?0:p.id.startsWith('terrace-lamp-')&&i<2?[-38,-212][i]:v),p.id+' authored SVG bounds match placement');
}
const map=makeMap('pink',{world:w,walk,harbor,sleepers:[]}),nav=map.nav(),{origin:[ox,oy],scale:k}=w.centrePlacement;
const point=(x,y)=>[ox+x*k,oy+y*k];let samples=0;
for(let y=-390;y<=40;y+=5)for(const x of [-250,-125,0,125,250]){assert(nav.walkable(...point(x,y)),`Blocked stair sample ${x},${y}`);samples++;}
for(const p of [[0,-440],[-400,-800],[400,-800],[0,-1180]])assert(nav.route(map.spawn.x,map.spawn.y,...point(...p)).length,'Terrace route '+p);
assert(!nav.walkable(...point(0,-810)),'Box footprint must block');
for(const x of [-329,329])assert(!nav.walkable(...point(x,-180)),'Rail footprint must block');
for(const p of c.blocked.filter(p=>p.name.startsWith('terrace heart lamp')))assert(!nav.walkable(...point(p.ellipse.x,p.ellipse.y)),'Lamp footprint must block');
// Exercise the real animation code through the whole winding cycle, using authored placement anchors.
const p=c.pieces.find(p=>p.id==='wind-key'),entry=art.props.find(p=>p.id==='centre-wind-key'),s=new Sprite(Texture.EMPTY);
s.anchor.set(entry.anchor.x,entry.anchor.y);s.position.set(entry.x,entry.y);s.width=entry.width;s.height=entry.height;
const pivot=()=>[s.x+(p.anchor.x-s.anchor.x)*s.texture.width*s.scale.x,s.y+(p.anchor.y-s.anchor.y)*s.texture.height*s.scale.y],rest=pivot();
for(let t=0;t<=3.2;t+=.05){animatePieces([{piece:p,sprite:s}],t);pivot().forEach((v,i)=>assert(Math.abs(v-rest[i])<1e-7,'Wind shaft pivot remains attached'));}
animatePieces([{piece:p,sprite:s}],2,true);assert.equal(s.scale.y,s.centreRest.sy);s.destroy();
const report={stairSamples:samples,terraceRoutes:4,ratio:.766,stairWidthFraction:.45,stepCount:7,stepWidthWorld:612*k,stairLengthWorld:364*k,origin:[ox,oy],outsideCentreUnchanged:true,dancerAndPlazaUnchanged:true,windPivotSamples:65,animationContractsUnchanged:true};
fs.writeFileSync('../concepts/themes/work/live-persp/pink-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

// Additional readback and navigation checks for the two other live repairs.
const evidence='../concepts/themes/work/live-persp/';
const port=read(evidence+'port-files.json');
const {execFileSync}=await import('node:child_process');
const {createHash}=await import('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
const hashes={};
for(const file of port.files.filter(f=>f.endsWith('.svg'))) {
 const bytes=fs.readFileSync(file),source=execFileSync('git',['show',`${port.source}:${file}`]);
 assert.equal(sha(bytes),sha(source),'Exact source SVG '+file);hashes[file]=sha(bytes);
}
const additional={};
for(const theme of ['waterfall','fair']) {
 const A=`public/pixi-art/themes/${theme}/`,D=`assets/world/themes/${theme}/`;
 const oldArt=read(evidence+'before/'+A+'art.json'),art=read(A+'art.json');
 const c=read(A+'centre/centre.json'),oldCentre=read(evidence+'before/'+A+'centre/centre.json');
 const file=theme==='fair'?'centre/floor.svg':'centre/decal-paving.svg';
 assert.deepEqual(omit(c,['pieces']),omit(oldCentre,['pieces']),theme+' other centre metadata');
 assert.deepEqual(c.pieces.filter(p=>'centre/'+p.file!==file),oldCentre.pieces.filter(p=>'centre/'+p.file!==file));
 assert.deepEqual(omit(art,['props','decks','flats']),omit(oldArt,['props','decks','flats']));
 for(const layer of ['props','decks','flats'])assert.deepEqual(art[layer].filter(p=>p.src!==file),oldArt[layer].filter(p=>p.src!==file),theme+' surrounding '+layer);
 for(const name of ['world.json','walk-world.json'])assert.equal(fs.readFileSync(D+name,'utf8'),fs.readFileSync(evidence+'before/'+D+name,'utf8'),theme+' geometry unchanged');
 const w=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
 const map=makeMap(theme,{world:w,walk,harbor,sleepers:[]}),nav=map.nav();
 let samples=0,routes=0;
 if(theme==='waterfall') {
  const point=(x,y)=>[3900+x*.48,3800+y*.48];
  for(let y=810;y<=1290;y+=10)for(const x of [-85,0,85]){assert(nav.walkable(...point(x,y)),theme+' south stair '+[x,y]);samples++;}
  for(const a of w.centrePlacement.access){assert(nav.walkable(...a.point));assert(nav.route(map.spawn.x,map.spawn.y,...a.point).length,theme+' route '+a.name);routes++;}
 } else {
  const {x:ox,y:oy,scale:k}=c.placement,point=(x,y)=>[ox+x*k,oy+y*k];
  for(let y=316;y<=388;y+=6)for(const x of [-95,0,95]){assert(nav.walkable(...point(x,y)),theme+' south stair '+[x,y]);samples++;}
  for(const p of [[0,350],[-534,0],[534,0]]){assert(nav.walkable(...point(...p)),theme+' entrance '+p);assert(nav.route(map.spawn.x,map.spawn.y,...point(...p)).length,theme+' route '+p);routes++;}
 }
 const placement=theme==='fair'?{origin:[c.placement.x,c.placement.y],scale:c.placement.scale}:w.centrePlacement;
 let blockers=0;
 for(const b of c.blocked.filter(b=>b.ellipse||/^rail-|^bridge-rail-/.test(b.name))) {
  const center=b.ellipse?[b.ellipse.x,b.ellipse.y]:[0,1].map(i=>b.poly.reduce((sum,p)=>sum+p[i],0)/b.poly.length);
  const point=center.map((v,i)=>placement.origin[i]+v*placement.scale);
  assert(!nav.walkable(...point),theme+' blocks '+b.name);blockers++;
 }
 additional[theme]={stairSamples:samples,entranceRoutes:routes,blockedFootprints:blockers,worldAndWalkingBytesUnchanged:true,nonCentreArtUnchanged:true};
}
// Exercise both original Pink animation contracts through their complete cycles.
const motion={};
for(const id of ['dancer','wind-key']) {
 const p=c.pieces.find(p=>p.id===id),entry=art.props.find(p=>p.id==='centre-'+id),s=new Sprite(Texture.EMPTY);
 s.anchor.set(entry.anchor.x,entry.anchor.y);s.position.set(entry.x,entry.y);s.width=entry.width;s.height=entry.height;
 let min=Infinity,max=-Infinity;
 for(let i=0;i<=100;i++){animatePieces([{piece:p,sprite:s}],i*.04);assert([s.x,s.y,s.scale.x,s.scale.y].every(Number.isFinite));const value=id==='dancer'?s.scale.x:s.scale.y;min=Math.min(min,value);max=Math.max(max,value);}
 assert(min<0&&max>0,id+' completes full turn');
 animatePieces([{piece:p,sprite:s}],1,true);assert.equal(s.scale.x,s.centreRest.sx);assert.equal(s.scale.y,s.centreRest.sy);
 motion[id]={samples:101,fullCycle:true,reducedMotionReset:true};s.destroy();
}
const {resolveSleepSpots,sleepHalfWidths}=await import('../../src/pixi/sleep-spots.js');
const {geometry}=await import('../../assets/world/island-geometry.mjs');
const sleepers={};
for(const theme of ['pink','waterfall','fair']) {
 const A=`public/pixi-art/themes/${theme}/`,D=`assets/world/themes/${theme}/`;
 const resolve=(prefix)=>{
  const world=read(prefix+D+'world.json'),walk=read(prefix+D+'walk-world.json'),harbor=read(D+'harbor.json'),art=read(prefix+A+'art.json');
  const map=makeMap(theme,{world,walk,harbor,sleepers:[]});
  return resolveSleepSpots(map.baseWalk,art.props,geometry(map.baseWalk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid??[],warn:false});
 };
 const before=resolve(evidence+'before/'),after=resolve('');
 assert.deepEqual(after,before,theme+' sleepers identical');assert.equal(after.length,40);assert.equal(after.bad.length,0);
 sleepers[theme]={resolved:after.length,unchanged:true};
}
const changed=execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim().split('\n');
for(const file of changed)assert(port.files.includes(file),'Unexpected runtime change '+file);
fs.writeFileSync(evidence+'validation.json',JSON.stringify({pink:report,additional,motion,sleepers,sourceSvgHashes:hashes},null,2)+'\n');
console.log(JSON.stringify({additional,motion},null,2));
