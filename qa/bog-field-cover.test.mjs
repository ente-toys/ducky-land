import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BOG_BLOCKERS} from '../src/features/bog-combat/bog-blockers.js';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';
import {DUCK_RADIUS} from '../src/features/bog-combat/physics.js';
import {groupFeet,shelters,hasWideBypass} from './bog-wall-layout-helpers.mjs';
const layout=JSON.parse(fs.readFileSync('scripts/bog-environment/layout.json'));
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/bog-arena/art.json'));
const map=JSON.parse(fs.readFileSync('src/features/bog-combat/bog-environment.json'));
const groups=layout.wallLayout.groups.filter(g=>g.id.startsWith('field-cover-'));
const pieces=art.props.filter(p=>p.id.startsWith('field-cover-'));
const bounds=p=>({x:p.x-p.width/2,y:p.y-p.height,width:p.width,height:p.height});
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
const distance=(a,b)=>Math.hypot(Math.max(a.x-b.x-b.width,b.x-a.x-a.width,0),Math.max(a.y-b.y-b.height,b.y-a.y-a.height,0));

test('48 field walls form 24 exactly mirrored L shapes using only existing wall art',()=>{
 assert.equal(pieces.length,48);assert.equal(groups.length,24);
 for(const west of groups.filter(g=>g.side==='west')){
  const east=groups.find(g=>g.area===west.area&&g.side==='east');assert.ok(east,west.id);
  assert.equal(west.members.length,2);assert.equal(east.members.length,2);
  const w=groupFeet(west),e=groupFeet(east);
  assert.deepEqual(e.map(b=>[b.x,b.y,b.width,b.height]),w.map(b=>[8400-b.x-b.width,b.y,b.width,b.height]));
 }
 for(const p of pieces){
  assert.ok(['wz-wall','wz-wall-ns'].includes(p.name));
  assert.ok(art.props.some(q=>!q.id.startsWith('field-cover-')&&q.src===p.src));
  assert.equal(BOG_BLOCKERS.filter(b=>b.prop===p.id).length,1,p.id+' matching collision');
 }
});

test('field cover preserves paths, spawn courts, plants and a Ducky-width gap to unrelated solids',()=>{
 for(const g of groups){
  assert.ok(shelters(g).length>=2,g.id+' reachable exterior cover');
  assert.ok(hasWideBypass(g),g.id+' two-Ducky bypass');
  for(const b of groupFeet(g)){
   for(const q of BOG_BLOCKERS.filter(q=>q.wallLayout!==g.id))
    assert.ok(distance(b,q)>=DUCK_RADIUS*2,g.id+' gap to '+q.id);
   for(const r of layout.routes)for(let i=1;i<r.points.length;i++){
    const a=r.points[i-1],c=r.points[i],n=Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/8);
    for(let j=0;j<=n;j++){
     const x=a[0]+(c[0]-a[0])*j/n,y=a[1]+(c[1]-a[1])*j/n;
     assert.ok(distance(b,{x,y,width:0,height:0})>=r.width/2+DUCK_RADIUS,g.id+' clear '+r.id);
    }
   }
   for(const [name,z]of Object.entries(map.world.zones)){
    const [x,y]=z.spawn;
    assert.ok(distance(b,{x,y,width:0,height:0})>=DUCK_RADIUS*2,g.id+' spawn '+name);
    if(/karma|evil|plaza|cove/.test(name))
     assert.ok(distance(b,{x:z.x,y:z.y,width:0,height:0})>=z.r,g.id+' clear plot '+name);
   }
  }
  for(const id of g.members){const p=pieces.find(p=>p.id===id);
   for(const q of art.props.filter(q=>/^(tree|bush)-/.test(q.name)||q.hideBush))
    assert.equal(overlaps(bounds(p),bounds(q)),false,p.id+' leaves '+q.id+' untouched');
  }
 }
 for(const z of Object.values(map.world.zones)){
  assert.ok(BOG_COMBAT.navigation.walkable(...z.spawn));
  assert.ok(BOG_COMBAT.navigation.route(4200,2800,...z.spawn).length);
 }
});
