import fs from 'node:fs';import assert from 'node:assert/strict';import {createServer} from 'vite';import {geometry,inShape} from '../../../assets/world/island-geometry.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review/hill/result';
const before=JSON.parse(fs.readFileSync('scripts/home-review/hill/before.json')),E=JSON.parse(fs.readFileSync('src/pixi/home-expansion.json')),K=JSON.parse(fs.readFileSync('src/pixi/home-kites.json'));
const v=await createServer({configFile:false,cacheDir:'/tmp/home-hill-audit',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},logLevel:'error'});
try{
 const P=await v.ssrLoadModule('/src/pixi/placements.js'),S=await v.ssrLoadModule('/src/pixi/sleep-spots.js');const props=P.createPlacements(),local=P.walkWorld(P.trimWorld(JSON.parse(fs.readFileSync('assets/world/world.json'))),props),beds=P.sleepSpots(local,props,geometry(local).walkable,S.sleepHalfWidths());
 assert.deepEqual(JSON.parse(JSON.stringify(beds)),before.beds,'all 100 sleepers stay at their approved positions');
 const hills=props.filter(p=>String(p.id).startsWith('home-hill-'));assert.equal(hills.length,6);assert.equal(local.obstacles.length-before.local.obstacles.length,6);
 const dry=geometry({...local,obstacles:[]}),walk=geometry(local);let samples=0;
 for(const s of E.stargazingHills){
  const owned=hills.filter(p=>p.id.includes(s.id));assert.equal(owned.length,3);
  for(let x=-310;x<=310;x+=20)for(let y=-115;y<=105;y+=20)if((x/310)**2+(y/125)**2<1){const X=s.x+x,Y=s.y+y;assert.ok(dry.walkable(X,Y),`${s.id} dry lawn ${X},${Y}`);if(!owned.some(p=>inShape(X,Y,p.footprint,16)))assert.ok(walk.walkable(X,Y),`${s.id} mound stays walkable`);samples++;}
  for(const k of K)assert.ok(Math.hypot((k.x-s.x)/400,(k.y-s.y)/230)>1.25,`${s.id} kite clearance ${k.id}`);
  for(const b of beds)assert.ok(Math.hypot((b.x-s.x)/400,(b.y-s.y)/230)>1,`${s.id} sleeper clearance`);
  const r=JSON.parse(fs.readFileSync('src/pixi/home-routes.json')).find(r=>r.id==='stargazing-'+s.id);
  for(const [x,y] of r.samples){assert.ok(walk.walkable(x,y),`${s.id} trail walks on dry unobstructed lawn: ${x},${y}`);assert.ok(!beds.some(b=>inShape(x,y,P.sleeperFootprint(b),25)),'trail clears residents');assert.ok(K.every(k=>Math.hypot(k.x-x,k.y-y)>180),'trail clears kite anchors');}
  for(const p of owned){assert.ok(!walk.walkable(p.footprint.x,p.footprint.y),'each solid prop blocks');assert.ok(dry.walkable(p.footprint.x,p.footprint.y),'prop stands on land');}
 }
 const server=JSON.parse(fs.readFileSync('assets/world/walk-world.json'));for(const p of hills)assert.ok(server.obstacles.some(o=>JSON.stringify(o)===JSON.stringify(p.footprint)));
 const report={hills:2,separation:Math.hypot(E.stargazingHills[0].x-E.stargazingHills[1].x,E.stargazingHills[0].y-E.stargazingHills[1].y),solidBlockers:6,moundSamples:samples,sleepersUnchanged:beds.length,trails:'connected, dry, no obstacle/sleeper/kite intersections',serverFootprints:true};fs.writeFileSync(out+'/hill-audit.json',JSON.stringify(report,null,2));console.log(report);
}finally{await v.close()}
