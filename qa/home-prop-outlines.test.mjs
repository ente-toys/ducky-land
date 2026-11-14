import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import sharp from 'sharp';
import {HOME_MAP} from '../src/world/island-maps.js';
import {geometry, inShape} from '../assets/world/island-geometry.mjs';
import E from '../src/world/home/home-expansion.json' with {type:'json'};
import routes from '../src/world/home/home-routes.json' with {type:'json'};
import outlines from '../src/world/home/building-silhouettes.json' with {type:'json'};
import {propOutlineKind} from '../src/world/home/prop-outline-rules.js';
import pickups from '../src/gameplay/karma-sites.json' with {type:'json'};
import {atMuseumDoor} from '../src/gameplay/player-motion.js';
const bundle=await build({entryPoints:['src/world/home/placements.js'],bundle:true,platform:'node',format:'esm',write:false});
const P=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const props=P.createPlacements(), nav=HOME_MAP.nav();
const client=geometry(P.walkWorld(P.trimWorld(HOME_MAP.world),props)).walkable;

test('every Home prop has a generated outline and every solid outline is blocked on client and worker',()=>{
  assert.ok(props.length>=804);
  for(const p of props){
    assert.ok(outlines[p.src]?.length>=3,`${p.id}: art traced`);
    const kind=propOutlineKind(p);
    assert.equal(p.outlineKind,kind);
    if(kind!=='solid'){
      assert.equal(p.footprint,undefined,`${p.id}: walk-over art has no blocker`);
      assert.ok(p.z<HOME_MAP.origin.y-10000,`${p.id}: beneath all Duckies`);
      continue;
    }
    const poly=p.footprint.poly;
    assert.ok(poly.flat().every(Number.isFinite),`${p.id}: valid geometry`);
    assert.equal(p.z,Math.max(...poly.map(p=>p[1])),`${p.id}: depth uses blocker base`);
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);let samples=0;
    // Include a centroid plus a dense interior lattice, even for tiny props.
    const points=[[xs.reduce((a,b)=>a+b)/xs.length,ys.reduce((a,b)=>a+b)/ys.length]];
    for(let i=1;i<12;i++)for(let j=1;j<12;j++)points.push([Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*i/12,Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*j/12]);
    for(const [x,y] of points)if(inShape(x,y,p.footprint)){
      assert.equal(client(x,y),false,`${p.id}: client allows ${x},${y}`);
      assert.equal(nav.walkable(x,y),false,`${p.id}: worker allows ${x},${y}`);samples++;
    }
    assert.ok(samples>0,`${p.id}: interior sampled`);
  }
});

test('opaque solid art is covered, including flipped props',async()=>{
  const rasters=new Map();
  for(const p of props.filter(p=>p.outlineKind==='solid')){
    if(!rasters.has(p.src))rasters.set(p.src,await sharp('public'+p.src).resize(48,48,{fit:'fill'}).ensureAlpha().raw().toBuffer());
    const data=rasters.get(p.src),w=p.width*(p.scale??1),h=p.height*(p.scale??1);
    for(let y=0;y<48;y++)for(let x=0;x<48;x++)if(data[(y*48+x)*4+3]>240){
      const wx=p.x+(p.flip?p.anchor.x-(x+.5)/48:(x+.5)/48-p.anchor.x)*w,wy=p.y+((y+.5)/48-p.anchor.y)*h;
      assert.equal(nav.walkable(wx,wy),false,`${p.id}: visible art permits walking`);
    }
  }
});

test('every Home door, destination, dock and crossing remains reachable from spawn',()=>{
  const start=[HOME_MAP.spawn.x,HOME_MAP.spawn.y];
  assert.ok(nav.walkable(...start),'spawn is clear');
  const exact=[['museum',[2920,1190]],...pickups.filter(p=>p.region==='home').map(p=>[p.id,[p.x,p.y]]),...props.filter(p=>p.door).map(p=>[p.id,p.door]),...[...(E.places??[]),...(E.commons??[]),...(E.openSpaces??[])].map(p=>[p.id,p.point])];
  for(const [id,point] of exact){
    assert.ok(nav.walkable(...point),`${id}: target clear ${point}`);
    assert.deepEqual(nav.route(...start,...point).at(-1),point,`${id}: target reachable`);
  }
  assert.ok(atMuseumDoor(2920,1190));
  const approaches=[['harbour',[HOME_MAP.HARBOR.land.x,HOME_MAP.HARBOR.land.y]],...routes.flatMap(r=>[[r.id+' start',r.samples[0]],[r.id+' end',r.samples.at(-1)]]),...HOME_MAP.walk.walkways.flatMap((w,i)=>[['dock '+i+' a',w.a],['dock '+i+' b',w.b],['dock '+i+' middle',[(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2]]])];
  for(const [id,point] of approaches){
    const target=nav.nearest(...point,180);
    assert.ok(target,`${id}: nearby walkable approach ${point}`);
    assert.deepEqual(nav.route(...start,...target).at(-1),target,`${id}: approach reachable ${point}`);
  }
});

test('classification uses art tokens and size without mistaking neighbourhood names for decals',()=>{
  const p=(src,w=100,h=80)=>({src,width:w,height:h,scale:1});
  assert.equal(propOutlineKind(p('/petalpatch/house-petaldoor.svg')),'solid');
  assert.equal(propOutlineKind(p('/lanternleaf/bush-green.svg')),'solid');
  assert.equal(propOutlineKind(p('/flowerpot-daisies.svg')),'solid');
  assert.equal(propOutlineKind(p('/wildflowers.svg')),'decal');
  assert.equal(propOutlineKind(p('/bush-flowering.svg')),'solid');
  assert.equal(propOutlineKind(p('/wildflowers.svg',300,200)),'solid');
  assert.equal(propOutlineKind(p('/tree-oak.svg',200,350)),'solid');
});

test('trees, lamps and reeds use the full drawing and clear authored route corridors',()=>{
  const tall=props.filter(p=>/(?<![a-z])(?:tree|oak|birch|palm|lamp|lantern|reeds|cattail)/.test(p.asset+' '+p.src.split('/').at(-1)));
  assert.ok(tall.length>=260);
  for(const p of tall){
    assert.equal(p.outlineKind,'solid',`${p.id}: entire drawing blocks`);
    for(const [u,v] of outlines[p.src]){
      const x=p.x+(p.flip?p.anchor.x-u:u-p.anchor.x)*p.width*p.scale,y=p.y+(v-p.anchor.y)*p.height*p.scale;
      assert.ok(inShape(x,y,p.footprint),`${p.id}: full outline enclosed`);
    }
    for(const r of routes)for(const point of r.samples)assert.equal(inShape(...point,p.footprint,r.width/2+16),false,`${p.id}: canopy covers ${r.id}`);
  }
});

test('existing leaf and box sleepers keep their positions without opaque Duck bodies intersecting bushes',async()=>{
  const {default:data}=await import('../src/world/home/sleep-poses.json',{with:{type:'json'}});
  const world=P.walkWorld(P.trimWorld(HOME_MAP.world),props), beds=P.sleepSpots(world,props,geometry(world).walkable);
  assert.equal(beds.length,100);assert.deepEqual(beds.bad,[]);
  for(const [x,y,pose] of [[-1410,2030,'leaf'],[-110,4790,'leaf'],[2060,-920,'box']]){
    const bed=beds.find(b=>b.x===x&&b.y===y&&b.pose===pose);assert.ok(bed,'original resident retained');
    const p=data.poses[pose],k=p.k*.81*.88*.24, pixels=await sharp('public'+p.layers.find(l=>l.id==='duck').src).resize(128,128,{fit:'fill'}).ensureAlpha().raw().toBuffer();
    for(let j=0;j<128;j++)for(let i=0;i<128;i++)if(pixels[(j*128+i)*4+3]>240){
      const wx=x+((i+.5)/128*p.W-(p.box[0]+p.box[2])/2)*k*(bed.flip?-1:1),wy=y+((j+.5)/128*p.H-p.box[3])*k;
      assert.ok(!props.some(q=>q.footprint&&inShape(wx,wy,q.footprint)),`${pose} at ${x},${y}: opaque body intersects solid`);
    }
  }
});
