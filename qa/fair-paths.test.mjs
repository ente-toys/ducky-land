import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapFor} from '../src/world/island-maps.js';
import {inShape,inPoly} from '../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const A='public/pixi-art/themes/fair/',D='assets/world/themes/fair/';
const art=read(A+'art.json'),audit=read('scripts/bigger-fair/path-routes.json'),map=mapFor('fair'),nav=map.nav();
test('Fair ground tiles share one continuous terrain, water and opaque path union',()=>{
 let common;
 assert.equal(art.ground.tiles.length,72);
 for(const t of art.ground.tiles){
  const svg=fs.readFileSync(A+t.src,'utf8');
  const body=svg.replace(/^<svg[^>]*>/,'');
  common??=body;assert.equal(body,common,`${t.src} differs at a tile seam`);
  assert.equal((svg.match(/data-name="Fair unified paths"/g)??[]).length,1);
  const paths=svg.match(/<g data-name="Fair unified paths">([\s\S]*?)<\/g>/)[1];
  assert.equal((paths.match(/<path /g)??[]).length,1);
  assert(paths.includes('fill="#F6DE95"'));
  assert(!/stroke|opacity|gradient|<image|filter/.test(paths));
  assert(!/fair-centre|fair-hamlet-overlay|keep-original|fair-rivers|#FFF0B8|#FFF1BB|#F3DF98|#9D9856|#648C37/.test(svg));
 }
 assert.equal(audit.propOverlapArea,0);
 const polygons=audit.surface.type==='Polygon'?[audit.surface.coordinates]:audit.surface.coordinates;
 for(const p of art.props.filter(p=>/\/(tree-|bush-|flower|flowers|grass-tuft)/.test(p.src))){
  assert(!polygons.some(rings=>inPoly(p.x,p.y,rings[0])&&!rings.slice(1).some(h=>inPoly(p.x,p.y,h))),p.id+' illustrated foot is on paving');
 }

});
test('Every Fair route and interpolated segment avoids water, props and runtime residents',()=>{
 assert.deepEqual(audit.widths,[128,104]);
 assert.equal(audit.fill,'#F6DE95');
 assert.deepEqual(read(D+'paths.json'),audit.routes.map(r=>r.samples));
 assert.deepEqual(read(D+'world.json').paths,audit.routes.map(r=>r.samples));
 for(const r of audit.routes){
  assert([104,128].includes(r.width));
  for(const p of r.samples)assert(nav.walkable(...p),`${r.id} blocked at ${p}`);
  for(let i=1;i<r.samples.length;i++)assert(nav.clearLine(r.samples[i-1],r.samples[i]),`${r.id} crosses an obstacle between ${r.samples[i-1]} and ${r.samples[i]}`);
 }
 const trees=art.props.filter(p=>/^hamlet-sugarspoon-tree-round-(11|12)$/.test(p.id));
 assert.equal(trees.length,2);
 for(const tree of trees)for(const r of audit.routes)for(const p of r.samples)assert(!inShape(...p,tree.footprint,r.width/2+7),`${r.id} crowds ${tree.id}`);
});
test('Retained hamlet doors and bridge landings are served by the new graph',()=>{
 for(const p of art.props.filter(p=>p.role&&p.door))assert(audit.routes.some(r=>r.id==='door-'+p.id),p.id);
 for(const b of read(D+'world.json').walkways)for(const end of [b.a,b.b]){
  assert(nav.walkable(...end),`${b.id} endpoint blocked`);
  assert(audit.routes.some(r=>r.samples.some(p=>Math.hypot(p[0]-end[0],p[1]-end[1])<120)),`${b.id} endpoint has no approach`);
 }
});
test('Regeneration delegates ground instead of restoring old baked path systems',()=>{
 for(const file of ['hamlets-apply.mjs','centre.mjs','boats.mjs','design.mjs']){
  const s=fs.readFileSync('scripts/bigger-fair/'+file,'utf8');assert(s.includes('rebuildFairSurface'),file);
  assert(!/stroke="#FFF0B8"|stroke="#FFF1BB"|const road=|function ground\(/.test(s),file);
 }
 const s=fs.readFileSync('scripts/bigger-fair/communities.mjs','utf8');
 assert(s.includes('return buildTiles()'));assert(!/function roadShape|function ground\(|keep-original/.test(s));
});
