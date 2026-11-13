import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';
import {BOG_BLOCKERS} from '../src/features/bog-combat/bog-blockers.js';
import {DUCK_RADIUS,traceShot} from '../src/features/bog-combat/physics.js';
import {shelters,hasWideBypass,shortCrossing} from './bog-wall-layout-helpers.mjs';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/bog-arena/art.json'));
const layout=JSON.parse(fs.readFileSync('scripts/bog-environment/layout.json'));
const cover=art.props.filter(p=>p.author==='warzone'&&p.coverFootprints);
const nav=BOG_COMBAT.navigation;
const bounds=p=>({l:p.x-p.width*p.anchor.x,r:p.x+p.width*(1-p.anchor.x),t:p.y-p.height*p.anchor.y,b:p.y+p.height*(1-p.anchor.y)});
const footprint=p=>BOG_BLOCKERS.filter(b=>b.prop===p.id&&b.author==='warzone');

test('all war-zone walls and supply stacks have exact shared paint and movement footprints',()=>{
 assert.equal(cover.length,layout.warzone.coverStations);
 assert.equal(cover.length,123);
 assert.equal(layout.wallLayout.groups.reduce((n,g)=>n+g.members.length,0),131);
 for(const p of cover){
  const feet=footprint(p);assert.equal(feet.length,p.coverFootprints.length,p.id);
  for(const [i,[x,y,w,h]]of p.coverFootprints.entries()){
   const b=feet[i];
   assert.deepEqual([b.x,b.y,b.width,b.height],[p.x-p.width/2+x,p.y-p.height+y,w,h],p.id);
   assert.equal(nav.walkable(b.x+w/2,b.y+h/2),false,p.id+' stops walking');
   const hit=traceShot(...shortCrossing(b),BOG_COMBAT.blockers);
   assert.equal(hit.blocker?.id,b.id,p.id+' stops paint on its visible foot');
   assert.deepEqual(layout.blockers.find(q=>q.id===b.id),b);
  }
 }
});

test('connected cover structures have reachable shelter, a flank and a continuous two-Ducky bypass',()=>{
 for(const g of layout.wallLayout.groups){
  const points=shelters(g);assert.ok(points.length>=2,g.id+' shelters on two exterior sides');
  assert.ok(nav.route(...points[0],...points[1]).length,g.id+' connected flank');
  assert.ok(hasWideBypass(g),g.id+' two-Ducky bypass around the whole structure');
 }
});

test('foreground kit plants do not conceal any war-zone wall or supply stack',()=>{
 for(const p of art.props.filter(p=>/^wz-(wall|ruin|planks|sacks|barrels|crates|corner)(-ns)?$/.test(p.name))){const a=bounds(p);
  for(const q of art.props.filter(q=>/^(tree|bush)-/.test(q.name)&&q.y>=p.y)){
   const b=bounds(q);assert.equal(b.l<a.r&&b.r>a.l&&b.t<a.b&&b.b>a.t,false,q.id+' conceals '+p.id);
  }
 }
});

test('hiding clumps use the unscaled bush kit, remain walkable and connect to combat floor',()=>{
 const bushes=art.props.filter(p=>p.hideBush);
 assert.equal(bushes.length,92);
 const groups=Map.groupBy(bushes.filter(p=>p.author==='warzone'),p=>p.hideClump);
 assert.equal(groups.size,22);
 for(const [name,ps]of groups){
  assert.equal(ps.length,4,name+' dense four-piece clump');
  assert.equal(new Set(ps.map(p=>p.homeSource)).size,4);
 }
 for(const p of bushes){
  assert.match(p.homeSource,/\/plants\/bush-[1-4]\.svg$/);
  assert.ok(!BOG_BLOCKERS.some(b=>b.id===p.id||b.prop===p.id),p.id+' has no solid blocker');
  for(const y of [p.y,p.y-35]){
   assert.ok(nav.walkable(p.x,y),p.id+' walkable hiding floor');
   assert.ok(nav.route(4200,2800,p.x,y).length,p.id+' reachable hiding floor');
  }
 }
});

test('four boarded Home cottages are solid cover with connected front and rear flanks',()=>{
 const shells=art.props.filter(p=>p.name==='boarded-cottage');assert.equal(shells.length,4);
 for(const p of shells){
  const b=BOG_BLOCKERS.find(b=>b.id===p.id);assert.ok(b,p.id);
  for(const q of [[p.x,p.y+30],[p.x,b.y-50],[b.x-50,p.y],[b.x+b.width+50,p.y]]){
   assert.ok(nav.walkable(...q),p.id+' clear shoulder '+q);
   assert.ok(nav.route(4200,2800,...q).length,p.id+' shoulder connected '+q);
  }
  assert.equal(traceShot({x:p.x,y:b.y-2},{x:p.x,y:b.y+b.height+2},BOG_COMBAT.blockers).blocker?.id,p.id);
  const s=fs.readFileSync('public/pixi-art/themes/bog-arena/'+p.src,'utf8');
  assert.doesNotMatch(s,/<(?:image|linearGradient|radialGradient|filter)\b/i);
 }
});
