import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {Texture} from 'pixi.js';
import {makeMap} from '../src/world/island-maps.js';
import {checkTheme} from '../scripts/theme-index.mjs';
import {inPoly} from '../assets/world/island-geometry.mjs';
import {tileResolution,tileInView,GROUND_BUDGET_BYTES,createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {ICELAND_SMOKE} from '../src/rendering/pixi/environment/iceland-life.js';
import {snowVisible,snowPose,createSnowfall,SNOW_POOL_SIZE,SNOW_PHONE_COUNT} from '../src/rendering/pixi/environment/snowfall.js';
import {Container} from 'pixi.js';
const j=p=>JSON.parse(readFileSync(p));
const world=j('assets/world/themes/snow/world.json'),walk=j('assets/world/themes/snow/walk-world.json'),harbor=j('assets/world/themes/snow/harbor.json'),art=j('public/pixi-art/themes/snow/art.json');
const ready=checkTheme('snow'),map=makeMap('snow',{world,walk,harbor,sleepers:ready.sleepers}),nav=map.nav();
const route=(x,y)=>nav.walkable(x,y)&&(nav.clearLine([map.spawn.x,map.spawn.y],[x,y])||nav.route(map.spawn.x,map.spawn.y,x,y).length>0);
const area=c=>Math.abs(c.reduce((n,a,i)=>{const b=c[(i+1)%c.length];return n+a[0]*b[1]-a[1]*b[0]},0)/2);
test('Iceland B2 coast is 112-125% of Home area, wider than tall, with a real harbour bay',()=>{
 const ratio=area(world.coast)/area(j('assets/world/world.json').coast);assert.ok(ratio>=1.12&&ratio<=1.25,ratio);
 const extent=axis=>Math.max(...world.coast.map(p=>p[axis]))-Math.min(...world.coast.map(p=>p[axis]));assert.ok(extent(0)>extent(1));
 assert.ok(world.coast.length>200);assert.deepEqual(walk.coast,world.coast);
 assert.ok(!inPoly(map.HARBOR.water.x,map.HARBOR.water.y,world.coast));
});
test('Iceland replaces rivers, bridges, kites and ski centres with one solid snow island and one rink',()=>{
 for(const field of ['water','bridges','islets','walkways'])assert.deepEqual(world[field],[]);
 assert.deepEqual(art.decks,[]);assert.equal(art.kites?.length??0,0);assert.equal(world.boatWater?.length??0,0);
 assert.equal(art.flats.filter(p=>p.id==='rink').length,1);assert.ok(nav.walkable(...world.zones.rink.spawn));assert.ok(map.landAt(...world.zones.rink.spawn));
 assert.ok(!/ski|telescope|stargaz|river|bridge|kite/.test(art.props.map(p=>p.id).join(' ')));
});
test('all B2 places, fourteen building doors and the harbour are reachable; solids match their art',()=>{
 assert.ok(ready.ready,ready.problems.join('\n'));
 for(const [name,z]of Object.entries(world.zones))assert.ok(route(...z.spawn),name);
 for(const [name,x,y]of world.iceland2.doors)assert.ok(route(x,y),name+' doorway');
 for(const p of art.props){assert.ok(inPoly(p.x,p.y,world.coast),p.id+' offshore');const solid=world.obstacles.find(o=>o.prop===p.id);if(solid)assert.equal(nav.walkable(solid.x,solid.y),false,p.id+' solid');}
 assert.ok(route(map.HARBOR.land.x,map.HARBOR.land.y));
 for(const b of map.boatSpots())for(let i=0;i<16;i++){const a=i*Math.PI/8;assert.ok(!map.landAt(b.x+46*Math.cos(a),b.y+46*Math.sin(a)),'boat hull clearance');}
});
test('Iceland has exactly sixty resolved solid residents, all eight approved sleep poses',()=>{
 assert.equal(world.sleepTotal,60);assert.equal(ready.sleepers.length,60);assert.equal(map.sleepers.length,60);
 assert.equal(new Set(map.sleepers.map(b=>b.pose)).size,8);
 for(const bed of map.sleepers){assert.ok(map.landAt(bed.x,bed.y));assert.ok(map.walk.obstacles.some(o=>o.sleeper&&Math.abs(o.x-bed.x)<1));}
});
test('Home plant silhouettes are retained under snow caps and every plant base clears a path',()=>{
 for(const family of ['tree','bush'])for(let i=1;i<=(family==='tree'?5:4);i++){
  const original=readFileSync(`public/pixi-art/plants/${family}-${i}.svg`,'utf8');const capped=readFileSync(`public/pixi-art/themes/snow/v2/${family}-${i}.svg`,'utf8');assert.ok(capped.startsWith(original.slice(0,original.lastIndexOf('</svg>'))));assert.ok(capped.includes('clipPath'));assert.ok(capped.includes('#fffdf8'));
 }
 const dist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a[0]-dx*t,p.y-a[1]-dy*t)};
 for(const p of art.props.filter(p=>/grove|bush/.test(p.id)))for(const l of world.paths)for(let i=1;i<l.length;i++)assert.ok(dist(p,l[i-1],l[i])>=80,p.id+' on path');
});
test('every SVG crop retains at least one texel per device pixel at default and maximum zoom at 2x DPR',()=>{
 for(const p of [...art.props,...art.flats]){
  assert.ok(p.tiles?.length,p.id+' must stream rather than decode a huge static texture');
  const xspan=Math.max(...p.tiles.map(t=>t.x+t.width)),yspan=Math.max(...p.tiles.map(t=>t.y+t.height));assert.ok(Math.abs(xspan-p.width)<.01);assert.ok(Math.abs(yspan-p.height)<.01);
  for(const t of p.tiles){assert.ok(existsSync('public/pixi-art/themes/snow/'+t.src));assert.ok(Math.max(t.width,t.height)<=256);for(const z of [1,1.8])assert.ok(tileResolution(t,z,2)/(z*2)>=1,p.id+' zoom '+z);}
 }
 for(const p of [...art.props,...art.flats])assert.ok(!/gradient|filter|<image/i.test(readFileSync('public/pixi-art/themes/snow/'+p.src,'utf8')));
});
test('standing SVG streams retain the depth anchor and allocate no eager landmark textures',async t=>{
 const fetchBefore=globalThis.fetch;t.after(()=>globalThis.fetch=fetchBefore);globalThis.fetch=async url=>({ok:true,json:async()=>url.endsWith('art.json')?art:{pieces:[]}});
 const decoded=[];const acquired=[];
 const raster={acquire:async(src,r)=>{decoded.push(src);const crop=new URL(src,'https://test').searchParams.get('rasterCrop').split(',').map(Number);return Texture.EMPTY;},release(){},destroy(){}};const pool=createGroundPool({acquire:async src=>{decoded.push(src);return Texture.EMPTY},release:()=>{}});const loaded=await loadThemeArt({...map,art:'/pixi-art/themes/snow/art.json'},{groundPool:pool,icelandRasterLoaderFactory:()=>raster,acquire:async src=>{acquired.push(src);return Texture.WHITE},release:()=>{}});
 assert.ok(acquired.includes('/pixi-art/globe/snow-ground.svg'));assert.ok(acquired.every(src=>src===ICELAND_SMOKE||src.endsWith('snow-ground.svg')||[...art.props,...art.flats].some(p=>p.preload&&src.endsWith(p.src))));assert.equal(pool.stats().residentTiles,0);
 const pine=loaded.props.find(p=>p.id==='lake-bank-pine-2');assert.equal(pine.sprite.x,pine.x);assert.equal(pine.sprite.y,pine.y);
 const bakery=art.props.find(p=>p.id==='bakery');const stream=loaded.groundStreams.find(s=>s.entries[0]?.src.includes(bakery.src+'?'));
 assert.ok(stream);assert.ok(Math.abs(stream.entries[0].sprite.x-(stream.entries[0].x-bakery.x))<1e-8);assert.ok(Math.abs(stream.entries[0].sprite.y-(stream.entries[0].y-bakery.y))<1e-8);
 assert.ok(!loaded.groundStreams.some(s=>s.entries[0]?.src.includes('lake-bank-pine-2-tile')),'FIX4 rink pieces are present before streaming');
 loaded.rasterPool.update([{stream,camera:{x:bakery.x,y:bakery.y-bakery.height/2,zoom:1},width:1200,height:800}],2);
 for(let i=0;i<100&&loaded.rasterPool.stats().pendingTiles;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(decoded.length>0,'authored crops decode through the shared loader');assert.equal(loaded.rasterPool.stats().failedTiles,0);assert.ok(loaded.rasterPool.stats().residentTiles>0);
 loaded.destroy();pool.destroy();assert.equal(pool.stats().streams,0);
});
test('screen-space snow is pooled, phone-capped, covers the whole view and disabled for reduced motion and other islands',()=>{
 assert.equal(SNOW_POOL_SIZE,180);assert.equal(SNOW_PHONE_COUNT,90);
 assert.equal(snowVisible('snow',false),true);for(const args of [['snow',true],['home',false],['snow',false,false]])assert.equal(snowVisible(...args),false);
 const stage=new Container(),snow=createSnowfall(stage);snow.update(0,false,'snow',390,844,true);assert.equal(snow.root.children.filter(s=>s.visible).length,SNOW_PHONE_COUNT);const children=[...snow.root.children];snow.update(10,false,'snow',1200,800,true);assert.equal(snow.root.children.length,SNOW_POOL_SIZE);assert.deepEqual(snow.root.children,children);
 snow.update(20,true,'snow',1200,800,true);assert.equal(snow.root.visible,false);
 for(let i=0;i<SNOW_POOL_SIZE;i++){const p=snowPose(i,500,390,844);assert.ok(p.y>=-48&&p.y<892);assert.ok(p.x>=-48&&p.x<438);}
 snow.destroy();stage.destroy();
});

test('Iceland representative 2x DPR views fit the shared pool without a sharpness downgrade',()=>{
 const tiles=[...art.ground.tiles,...art.flats.flatMap(p=>p.tiles.map(t=>({...t,x:p.x-(p.topLeft?0:p.width/2)+t.x,y:p.y-(p.topLeft?0:p.height)+t.y}))),...art.props.flatMap(p=>p.tiles.map(t=>({...t,x:p.x-p.width/2+t.x,y:p.y-p.height+t.y})))];
 for(const [width,height]of [[1440,900],[390,844]])for(const zoom of [1,1.8])for(const name of ['plaza','rink','bakery','lodge','workshop','harbour']){
  const camera={...world.zones[name],zoom};let bytes=0;
  for(const t of tiles)if(tileInView(t,camera,width,height)){const r=tileResolution(t,zoom,2);bytes+=t.width*t.height*r*r*4;}
  assert.ok(bytes<=GROUND_BUDGET_BYTES*.9,`${name} ${width}px zoom ${zoom}: ${bytes/1048576} MiB`);
 }
});

test('the three existing paths meet the freely walkable lake shore',()=>{
 for(const [name,[x,y]] of Object.entries(world.iceland2.shores))for(const off of [-50,0,50]){
  const X=x+(name==='west-shore'?off:0),Y=y+(name==='west-shore'?0:off);assert.ok(route(X,Y),`${name} ${off}`);
 }
});
