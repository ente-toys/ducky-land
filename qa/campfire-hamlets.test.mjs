import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {outsideStageProps,outsideStageFlats} from './campfire-stage-scope.mjs';
import {auditCampfire} from '../scripts/campfire-hamlets/audit.mjs';
import {makeMap} from '../src/pixi/island-maps.js';
import {canSail} from '../src/pixi/islands.js';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/community/',D='rive/web/themes/community/',S='scripts/campfire-hamlets/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),plan=read(S+'placement.json'),before=read(S+'baseline/art.json');
test('Campfire approved hamlets preserve the centre and keep every contact shadow under the piece',()=>{
 const old=read('scripts/bigger-community/baseline/art.json');const centre=old.props.filter(p=>!p.src.includes('badge-buoy'));assert.deepEqual(outsideStageProps(art.props.slice(0,centre.length)),outsideStageProps(centre));assert.deepEqual(outsideStageFlats(art.flats),outsideStageFlats(old.flats));
 for(const [pose,spots]of Object.entries(read(S+'baseline/world.json').sleepSpots))assert.deepEqual(world.sleepSpots[pose].slice(0,spots.length),spots);
 const tiles=art.ground.tiles.map(t=>fs.readFileSync(A+t.src,'utf8')).join('');
 assert.equal(art.props.filter(p=>p.hamlet&&p.kind==='building').length,20);
 for(const p of art.props.filter(p=>p.hamlet)){assert(p.groundShadow,p.id);assert.equal(p.shadow,false,p.id+' avoids a duplicate engine shadow');assert(tiles.includes(`data-prop="${p.id}"`),p.id+' shadow is in the ground');if(p.kind==='building'){assert(tiles.includes(`data-base="${p.id}"`),p.id+' cast shadow');assert(world.obstacles.some(o=>o.id===p.id),p.id+' blocker');}}
 assert.equal(plan.shadow.fill,'#4AA539');assert.equal(plan.shadow.opacity,.24);
});
test('Campfire kits are vectors, reuse existing trees and retire all replaced outer artwork',()=>{
 const sources=new Set(before.props.map(p=>p.src));
 for(const p of art.props.filter(p=>p.kind==='tree'&&p.hamlet))assert(sources.has(p.src),p.id+' is an existing Campfire tree');
 for(const h of Object.keys(plan.sites))for(const file of fs.readdirSync(A+'hamlets/'+h)){assert(file.endsWith('.svg'));assert.doesNotMatch(fs.readFileSync(A+'hamlets/'+h+'/'+file,'utf8'),/<(?:image|linearGradient|radialGradient|filter)\b|data:/i);}
 for(const file of read(S+'removed-art.json'))assert(!fs.existsSync(A+file),file+' was replaced');
 for(const key of ['coast','water','bridges','obstacles','walkways','islets'])assert.deepEqual(world[key],walk[key]);
});
test('Campfire walks every bridge, painted path end, prop and approved sleeper without overlaps',()=>{
 const r=auditCampfire();assert.deepEqual(r.issues,[]);assert.equal(r.overlaps,0);assert.equal(r.walkIssues,0);assert.equal(r.checked.props,art.props.length);assert.equal(r.checked.bridges,13);assert(r.checked.pathEnds>=100);assert.equal(r.checked.sleepers,72);assert(r.pathEnds.every(e=>e.paintedDistance===undefined||e.paintedDistance<=90));
});
test('Campfire arched bridges land on dry path ends and allow boats through their water',()=>{
 const m=makeMap('community',{world,walk,harbor:read(D+'harbor.json')});
 for(const b of plan.crossings){assert.equal(b.boatPassUnder,true);const x=(b.a[0]+b.b[0])/2,y=(b.a[1]+b.b[1])/2;assert(!m.landAt(x,y),b.name+' water remains sailable');assert(canSail(x,y,'isle-250'),b.name+' full boat fits under the arch');const n=m.nav();assert(n.walkable(...b.a),b.name+' first landing');assert(n.walkable(...b.b),b.name+' second landing');}
});
