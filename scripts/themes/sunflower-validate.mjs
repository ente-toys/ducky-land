import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {checkTheme} from '../theme-index.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),A='public/pixi-art/themes/sunflower/',D='assets/world/themes/sunflower/';
const world=read(D+'world.json'),walk=read(D+'walk-world.json'),art=read(A+'art.json'),harbor=read(D+'harbor.json');
const base=makeMap('sunflower',{world,walk,harbor,sleepers:[]});
const beds=resolveSleepSpots(base.baseWalk,art.props,geometry(base.baseWalk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
assert.equal(beds.length,40);assert.deepEqual(beds.bad,[]);
const map=makeMap('sunflower',{world,walk,harbor,sleepers:beds}),geo=geometry(map.walk);
const baseline=read('../concepts/themes/work/sunflower/baseline/world.json');
assert.deepEqual(world.coast,baseline.coast);assert.deepEqual(world.zones,baseline.zones);
assert.deepEqual(world.centrePlacement,baseline.centrePlacement);assert.deepEqual(world.sleepSpots,baseline.sleepSpots);
assert.deepEqual(art.props.filter(p=>p.id.startsWith('centre-')),baseline.props.filter(p=>p.id.startsWith('centre-')));
assert.deepEqual(world.props,art.props);
const G=20,W=Math.ceil(world.width/G),H=Math.ceil(world.height/G),ok=new Uint8Array(W*H),seen=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++)ok[y*W+x]=geo.walkable(x*G,y*G);
const cell=(x,y)=>Math.round(y/G)*W+Math.round(x/G),q=[cell(map.spawn.x,map.spawn.y)];seen[q[0]]=1;
for(let i=0;i<q.length;i++){const at=q[i],x=at%W,y=Math.floor(at/W);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*W+xx;if(xx>=0&&xx<W&&yy>=0&&yy<H&&ok[j]&&!seen[j]){seen[j]=1;q.push(j);}}}
const reached=(x,y)=>[-20,0,20].some(dy=>[-20,0,20].some(dx=>seen[cell(x+dx,y+dy)]));
for(const [name,z]of Object.entries(world.zones))assert.ok(geo.walkable(...z.spawn)&&reached(...z.spawn),'zone '+name);
for(const s of world.centrePlacement.stairs)for(let i=0;i<=20;i++){const t=i/20,x=s.top[0]*(1-t)+s.bottom[0]*t,y=s.top[1]*(1-t)+s.bottom[1]*t;assert.ok(geo.walkable(x,y)&&reached(x,y),'stair '+s.name);}
for(const a of world.arches)for(let i=0;i<=20;i++){const t=i/20,x=a.a[0]*(1-t)+a.b[0]*t,y=a.a[1]*(1-t)+a.b[1]*t;assert.ok(geo.walkable(x,y)&&reached(x,y),'bridge');}
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const pathEdge=(x,y)=>Math.min(...world.paths.flatMap((p,i)=>p.slice(1).map((b,j)=>seg(x,y,p[j],b)-world.pathWidths[i]/2)));
const close=read(D+'sunflower-close-changes.json');
const benches=[...read(D+'sunflower-ten-changes.json').benches,...close.benches];
const closeBase=read('../concepts/themes/work/sunflower/close-baseline/world.json');
for(const key of ['width','height','coast','zones','centrePlacement','sleepSpots','paths','pathWidths','walkways','arches'])assert.deepEqual(world[key],closeBase[key],key+' changed from close-up baseline');
const oldArt=read('../concepts/themes/work/sunflower/close-baseline/art.json');
for(const key of ['props','flats','decks'])assert.deepEqual(art[key].filter(p=>p.id?.startsWith('centre-')),oldArt[key].filter(p=>p.id?.startsWith('centre-')),'locked centre '+key);
const newProps=art.props.filter(p=>p.id.startsWith('close-'));
for(const p of newProps){
 const o=world.obstacles.find(o=>o.name===p.id);assert.ok(o,'missing collision '+p.id);
 assert.deepEqual(o,walk.obstacles.find(o=>o.name===p.id),'collision parity '+p.id);
 assert.ok(pathEdge(p.x,p.y)>25,'new prop on a path '+p.id);
 for(const [name,z]of Object.entries(world.zones).filter(([k])=>/activity|stalls/.test(k))){
  const inside=z.rx?((p.x-z.x)/z.rx)**2+((p.y-z.y)/z.ry)**2<=1:p.x>=z.x0&&p.x<=z.x1&&p.y>=z.y0&&p.y<=z.y1;
  assert.ok(!inside,p.id+' occupies '+name);
 }
}
const beforeMap=makeMap('sunflower',{world:closeBase,walk:read('../concepts/themes/work/sunflower/close-baseline/walk-world.json'),harbor,sleepers:[]});
const priorBeds=resolveSleepSpots(beforeMap.baseWalk,oldArt.props,geometry(beforeMap.baseWalk).walkable,sleepHalfWidths(),{spots:closeBase.sleepSpots,avoid:closeBase.sleepAvoid,warn:false});
assert.deepEqual(beds.map(b=>[b.x,b.y,b.pose]),priorBeds.map(b=>[b.x,b.y,b.pose]),'resolved sleeper coordinates');
const benchGaps=benches.map(b=>({id:b.id,pathEdge:Math.min(...b.footprint.map(([x,y])=>pathEdge(x,y)))}));
assert.ok(benchGaps.every(b=>b.pathEdge>=23.9));
for(const b of benches){assert.ok(world.obstacles.some(o=>o.name===b.id));assert.ok(walk.obstacles.some(o=>o.name===b.id));}
const entries=[...art.ground.tiles,...art.props,...art.flats,...art.decks,...(art.floating??[])];
assert.ok(entries.every(p=>p.src.endsWith('.svg')));
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+e.name+'/'):[dir+e.name]);
assert.equal(files(A).filter(p=>/\.(png|jpg|jpeg|webp)$/i.test(p)).length,0);
const svgs=files(A).filter(p=>p.endsWith('.svg'));for(const p of svgs)assert.ok(!/<image\b|data:image\//i.test(readFileSync(p,'utf8')),p+' embedded raster');
const ready=checkTheme('sunflower');assert.ok(ready.ready,ready.problems.join('\n'));
const area=Math.abs(world.coast.reduce((sum,p,i)=>{const n=world.coast[(i+1)%world.coast.length];return sum+p[0]*n[1]-n[0]*p[1]},0))/2;
const report={ready:ready.ready,sleepers:beds.length,dropped:beds.bad,landArea:area,homeRatio:area/11090000,zones:Object.keys(world.zones).length,stairs:world.centrePlacement.stairs.length,arches:world.arches.length,reachablePercent:100*q.length/ok.reduce((a,b)=>a+b,0),props:art.props.length,flats:art.flats.length,svgFiles:svgs.length,rasterFiles:0,benchGaps,lockedCentreUnchanged:true,sleepCoordinatesUnchanged:true,newPropsOffPathsAndOpenAreas:true,newProps:newProps.length};
writeFileSync(D+'sunflower-validation.json',JSON.stringify(report,null,2)+'\n');console.log(report);
