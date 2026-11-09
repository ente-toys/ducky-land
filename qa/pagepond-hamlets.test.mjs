import {spread} from '../scripts/pagepond-rework/design.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditPagepond} from '../scripts/pagepond-hamlets/audit.mjs';
import {checkTheme} from '../scripts/theme-index.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read('public/pixi-art/themes/library/art.json'),world=read('rive/web/themes/library/world.json'),walk=read('rive/web/themes/library/walk-world.json'),plan=read('scripts/pagepond-hamlets/placement.json');

test('Pagepond approved hamlets use vector pieces, centre-sized houses and bounded workplaces',()=>{
 assert.equal(art.props.filter(p=>p.hamlet&&p.kind==='building').length,20);
 const originals=new Set(read('scripts/bigger-library/original/art.json').props.map(p=>p.src));
 for(const h of Object.keys(plan.sites)){
  const buildings=art.props.filter(p=>p.hamlet===h&&p.kind==='building'),houses=buildings.filter(p=>/cottage/.test(p.blueprintId)),house=Math.max(...houses.map(p=>p.width));
  assert(houses.length>=3,h+' houses');assert(house>=320&&house<=400,h+' centre scale');
  for(const p of buildings){assert(p.width<=house*1.15+.01,p.id+' workplace size');assert(p.shadow,p.id+' contact shadow');assert(p.footprint?.poly?.length>=3,p.id+' footprint');assert(world.obstacles.some(o=>o.name===p.id),p.id+' walk blocker');}
  for(const p of art.props.filter(p=>p.hamlet===h&&/tree|bush/.test(p.kind)))assert(originals.has(p.src),p.id+' original tree art');
 }
 for(const h of Object.keys(plan.sites))for(const f of fs.readdirSync('public/pixi-art/themes/library/hamlets/'+h)){assert(f.endsWith('.svg'),f+' vectors only');const svg=fs.readFileSync('public/pixi-art/themes/library/hamlets/'+h+'/'+f,'utf8');assert(!/<image\b|data:|<(?:linear|radial)Gradient\b/.test(svg),f+' no raster or gradients');}
 assert.deepEqual(world.obstacles,walk.obstacles);assert.deepEqual(world.water,walk.water);assert.deepEqual(world.coast,walk.coast);
});

test('Pagepond walks every bridge, path end, prop and approved sleeper with zero new overlaps',()=>{
 const audit=auditPagepond();assert.deepEqual(audit.issues,[],JSON.stringify(audit.issues));assert.equal(audit.overlaps,0);assert.equal(audit.walkIssues,0);assert(audit.checked.props>900);assert(audit.checked.bridges>=14);assert.equal(audit.checked.sleepers,40);assert.equal(audit.checked.boats,3);
});

test('Pagepond keeps forty approved sleepers and places hamlet residents only at supplied rest points',()=>{
 const report=checkTheme('library');assert(report.ready,report.problems.join('\n'));assert.equal(report.sleepers.length,40);assert(plan.sleepers.length>=4,'hamlet resting residents');
 for(const b of plan.sleepers){const d=read('scripts/pagepond-hamlets/layouts/'+b.hamlet+'.json'),s=plan.sites[b.hamlet],p=d.sleepers[b.index];const expected=plan.revision===2?spread(b.hamlet,[s.at[0]+p.x*s.k,s.at[1]+p.y*s.k]):[s.at[0]+p.x*s.k,s.at[1]+p.y*s.k];assert(Math.hypot(b.x-expected[0],b.y-expected[1])<2,'rest point follows the wider composition');assert(report.sleepers.some(r=>r.pose===b.pose&&Math.hypot(r.x-b.x,r.y-b.y)<2),b.hamlet+' resolved pose');}
});
