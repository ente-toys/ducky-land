import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {geometry, inPoly} from '../rive/web/island-geometry.mjs';
import {mapOf} from '../src/pixi/island-maps.js';
import {homePropY, homePropRotation} from '../src/pixi/home-motion.js';

const read = p => JSON.parse(fs.readFileSync(p));
const placement = read('scripts/pagepond-meadow/placements.json');
const art = read('public/pixi-art/themes/library/art.json');
const world = read('rive/web/themes/library/world.json');
const walk = read('rive/web/themes/library/walk-world.json');
const base = 'public/pixi-art/themes/library/';

test('Pagepond meadow installs the chosen SVG floors and upright anchors in authored order', () => {
  const floors = art.flats.filter(p => placement.floorTiles.some(f => f.id === p.id));
  assert.deepEqual(floors.map(f => f.id), placement.floorTiles.toSorted((a,b) => a.order-b.order).map(f => f.id));
  for (const f of floors) {
    const source = placement.floorTiles.find(p => p.id === f.id);
    assert.equal(f.topLeft, true);
    assert.deepEqual([f.x,f.y,f.width,f.height], [source.x,source.y,source.width,source.height]);
  }
  for (const p of placement.props) {
    const actual = art.props.find(a => a.id === p.id);
    assert(actual, p.id);
    for (const key of ['x','y','width','height','anchor','scale','sortY','shadow','wind']) assert.deepEqual(actual[key],p[key],p.id+' '+key);
    assert.deepEqual(world.props.find(a => a.id === p.id), actual);
  }
  assert.equal(art.props.filter(p => p.id === 'meadow-book-lighthouse').length, 1);
  assert(placement.poolBounds.y > world.zones.plaza.y + world.zones.plaza.ry);
});

test('Pagepond meadow assets use flat vector fills and the approved outline ink', () => {
  for (const name of Object.keys(placement.assetManifest)) {
    const svg = fs.readFileSync(base+'pagepond/meadow/'+name, 'utf8');
    assert(!/<(?:image|foreignObject|filter|linearGradient|radialGradient)\b|data:image/i.test(svg),name);
    // Colored ripple, page-line and highlight strokes are paint details. The
    // filled silhouettes use the common ink; the rim also has light stone seams.
    for (const [tag] of svg.matchAll(/<[^>]+\bfill="(?!none")[^"]+"[^>]*\bstroke="#[a-f\d]+"[^>]*>/gi)) {
      const stroke = tag.match(/\bstroke="([^"]+)"/)[1].toLowerCase();
      assert(stroke === '#39472d' || /^(stone-rim|island-grass)-floor\.svg$/.test(name) && stroke === '#938b57',name+' outline ink');
    }
    if (!/^(pool-floor|water-ripples-floor|boat-wake|contact-shadows-floor)\.svg$/.test(name)) assert(svg.includes('stroke="#39472d"'),name+' common ink');
  }
});

test('Pagepond pool blocks walking in client, authority and runtime while its stepping route stays continuous', () => {
  assert.deepEqual(world.water,walk.water);
  assert.deepEqual(world.obstacles,walk.obstacles);
  const map = mapOf('isle-251');
  assert.equal(map.id,'library');
  assert.equal(map.walk.navigationCellSize,24,'click grid resolves the padded stepping-stone necks');
  for (const data of [world, walk, map.walk]) {
    const {walkable} = geometry(data);
    for (const p of [[1800,3990],[2370,4140],[2070,4093]]) assert(!walkable(...p), 'water or lighthouse '+p);
    assert(walkable(2028,4395),'dry rim');
    const route = [[1590,4320],...placement.walkable.routeWorld,[1930,4090]];
    for (let i=1;i<route.length;i++) {
      const a=route[i-1],b=route[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
      for (let j=0;j<=n;j++) {
        const x=a[0]+(b[0]-a[0])*j/n,y=a[1]+(b[1]-a[1])*j/n;
        assert(walkable(x,y),'continuous tread access '+x+','+y);
      }
    }
    for (const p of [[1890,4060],[2059,3960],[2230,4070],[2059,4180]]) assert(walkable(...p),'island loop '+p);
  }
  for (const water of placement.waterRegions) assert.deepEqual(world.water.find(w => w.id===water.id),water);
  for (const solid of placement.solidFootprints) assert.deepEqual(world.obstacles.find(w => w.id===solid.id),solid);
  for (const boat of placement.props.filter(p => p.waterOnly)) assert(!world.obstacles.some(o => o.id===boat.id));
  assert(!world.boatWater.some(poly => inPoly(1800,3990,poly)),'closed decorative water stays out of sailing');
});

test('Pool island circulation is reachable from the bank with the real padded runtime geometry', () => {
  const {walkable} = geometry(mapOf('isle-251').walk);
  const R=4,x0=1440,y0=3710,w=300,h=200,key=(x,y)=>x+','+y;
  const grid=p=>[Math.round((p[0]-x0)/R),Math.round((p[1]-y0)/R)];
  const start=grid([1590,4320]),seen=new Set([key(...start)]),queue=[start];
  for (let i=0;i<queue.length;i++) {
    const [x,y]=queue[i];
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const a=x+dx,b=y+dy,k=key(a,b);
      if(a<0||b<0||a>=w||b>=h||seen.has(k)||!walkable(x0+a*R,y0+b*R))continue;
      seen.add(k);queue.push([a,b]);
    }
  }
  for(const p of [[1890,4060],[2059,3960],[2230,4070],[2059,4180]]) assert(seen.has(key(...grid(p))),'reachable island side '+p);
  const map=mapOf('isle-251'),nav=map.nav(),target=[1930,4090];
  const route=nav.route(map.spawn.x,map.spawn.y,...target);
  assert.deepEqual(route.at(-1),target,'click navigation reaches the lighthouse island from the plaza');
  let previous=[map.spawn.x,map.spawn.y];
  for(const point of route){assert(nav.clearLine(previous,point),'route stays on dry ground and treads');previous=point;}
});

test('All five paper boats reuse Home bob with independent gentle phases and fixed sort anchors', () => {
  const boats = art.props.filter(p => /^meadow-paper-boat-\d$/.test(p.id));
  assert.equal(boats.length,5);
  assert.equal(new Set(boats.map(p => p.animation.phaseRadians)).size,5);
  for (const boat of boats) {
    assert.equal(boat.boat,true);
    assert.equal(boat.sortY,boat.y);
    for(let t=0;t<20;t+=.1) {
      assert(Math.abs(homePropY(boat,t)-boat.y)<=2.4+1e-9);
      assert(Math.abs(homePropRotation(boat,t))<=.018+1e-9);
      assert.equal(homePropY(boat,t,true),boat.y);
      assert.equal(homePropRotation(boat,t,true),0);
    }
    assert.equal(boat.sortY,boat.y,'motion never changes sorting');
    assert(art.flats.some(f => f.id===boat.id+'-wake'));
  }
  for (const t of [0,1,8]) {
    const home={boat:true,y:100};
    assert.equal(homePropY(home,t,false,3),100+Math.sin(t*1.5+3)*3);
    assert.equal(homePropRotation(home,t,false,3),Math.sin(t*1.1+3)*.008);
  }
  const benches = art.props.filter(p => /^meadow-bench-/.test(p.id));
  assert.equal(benches.length,4);
  assert(benches.every(p => p.facing==='pool'));
});
