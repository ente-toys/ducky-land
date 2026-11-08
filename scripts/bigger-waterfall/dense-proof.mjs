import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync}from 'node:child_process';import {createHash}from 'node:crypto';import {render}from './render.mjs';import {inPoly}from '../../rive/web/island-geometry.mjs';
const OUT='../concepts/themes/world-map/bigger/',A='public/pixi-art/themes/waterfall/',D='rive/web/themes/waterfall/',BASE='a7bb5f54';
const read=p=>JSON.parse(fs.readFileSync(p)),before=p=>JSON.parse(execFileSync('git',['show',BASE+':'+p],{maxBuffer:20*1024*1024}));
const art=read(A+'art.json'),oldArt=before(A+'art.json'),world=read(D+'world.json'),oldWorld=before(D+'world.json'),walk=read(D+'walk-world.json'),oldWalk=before(D+'walk-world.json'),plan=read('scripts/bigger-waterfall/plan.json'),original=read('scripts/bigger-waterfall/original/world.json');
fs.mkdirSync(OUT+'waterfall-dense-proof',{recursive:true});
for(const key of ['coast','water','bridges','islets','originalCanalIslets','sleepSpots','zones','centrePlacement','communities'])assert.deepEqual(world[key],oldWorld[key],key+' stays unchanged');
for(const key of ['coast','water','bridges','islets','originalCanalIslets'])assert.deepEqual(walk[key],oldWalk[key],key+' walk data stays unchanged');
for(const key of ['decks','flats','floating'])assert.deepEqual(art[key],oldArt[key],key+' stays unchanged');
assert.deepEqual(read(D+'harbor.json'),before(D+'harbor.json'));
const locked=read('scripts/bigger-waterfall/original/art.json');assert.deepEqual(art.props.slice(0,locked.props.length),locked.props);
let originalTiles=0;for(const p of art.ground.tiles.filter(t=>t.src.startsWith('community/original-'))){assert.equal(createHash('sha256').update(fs.readFileSync(A+p.src)).digest('hex'),createHash('sha256').update(execFileSync('git',['show',BASE+':'+A+p.src],{maxBuffer:20*1024*1024})).digest('hex'));originalTiles++;}
for(const p of art.props.filter(p=>p.id.startsWith('community-dense'))){assert.equal(inPoly(p.x,p.y,original.coast),false,'new prop outside heart '+p.id);}
const bytes=a=>a.ground.tiles.reduce((n,t)=>n+Math.ceil(t.width*(t.resolution??1))*Math.ceil(t.height*(t.resolution??1))*4,0);
const area=JSON.parse(execFileSync('python3',['scripts/bigger-waterfall/dense-area.py'],{env:{...process.env,PYTHONPATH:'/private/tmp/ducky-waterfall-geometry'}}));
assert.ok(area.after.percent<25);assert.ok(area.after.roadArea<area.before.roadArea*.7);
fs.writeFileSync(OUT+'waterfall-dense-proof/area.json',JSON.stringify(area,null,2));
await render(OUT+'waterfall-dense.png');
// The fixed-pass image is retained as the genuine before image. Its SVGs have since changed,
// so re-rendering old records against the new SVG files would be misleading.
fs.copyFileSync(OUT+'waterfall-fixed.png',OUT+'waterfall-dense-proof/before.png');
for(const c of plan.communities)await render(OUT+'waterfall-dense-'+c.id+'.png',{x:c.crop[0],y:c.crop[1],k:.8,w:2200,h:2000});
for(const [id,x,y]of [['junction',-700,2670],['lane',-550,2210],['inlet',4250,6650]])await render(OUT+'waterfall-dense-proof/'+id+'.png',{x,y,k:.8,w:1400,h:1000});
const result={baselineCommit:BASE,unchanged:{originalProps:locked.props.length,originalGroundTiles:originalTiles,allDeckRecords:art.decks.length,allWaterShapes:world.water.length,allBridgeRecords:world.bridges.length,communities:world.communities.map(c=>c.name),sleepers:40,harbor:true},groundTexture:{beforeMiB:bytes(oldArt)/2**20,afterMiB:bytes(art)/2**20},props:{before:oldArt.props.length,after:art.props.length},roads:area,proofScale:{whole:.12,communities:.8},renderLimitations:'Static production SVG assembly; excludes live players, sleepers, animated water overlays, runtime shadows and procedural harbour deck/boats.'};
fs.writeFileSync(OUT+'waterfall-dense-proof/validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
