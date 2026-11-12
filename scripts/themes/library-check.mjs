import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry,inPoly,inShape} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const json=f=>JSON.parse(readFileSync(f));
const dir='assets/world/themes/library/',art=json('public/pixi-art/themes/library/art.json'),world=json(dir+'world.json'),walk=json(dir+'walk-world.json'),harbor=json(dir+'harbor.json');
const report=checkTheme('library');assert(report.ready,report.problems.join('\n'));assert.equal(report.sleepers.length,40);assert(!report.sleepNotes.some(s=>s.includes('dropped')));
assert.deepEqual([world.width,world.height],[8000,5600]);
assert.equal(world.coastRings.length,2);
assert(art.props.length>=300,'at least 300 props');
assert(art.props.filter(p=>/^tree-/.test(p.asset??'')).length>=60,'at least 60 large trees');
assert(art.flats.filter(p=>/grass-tuft|flower-dot|pebble|sand-speck/.test(p.src)).length>=2500,'home-scale ground detail');
const map=makeMap('library',{world,walk,harbor,sleepers:report.sleepers}),geo=geometry(map.walk);
const STEP=32,GW=Math.ceil(world.width/STEP),GH=Math.ceil(world.height/STEP),ok=new Uint8Array(GW*GH),seen=new Uint8Array(ok.length);
for(let j=0;j<GH;j++)for(let i=0;i<GW;i++)ok[j*GW+i]=+geo.walkable((i+.5)*STEP,(j+.5)*STEP);
const cell=([x,y])=>Math.floor(y/STEP)*GW+Math.floor(x/STEP);
const start=cell(world.zones.plaza.spawn),queue=[start];seen[start]=1;
for(let k=0;k<queue.length;k++){const c=queue[k],x=c%GW,y=Math.floor(c/GW);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy,n=yy*GW+xx;if(xx>=0&&xx<GW&&yy>=0&&yy<GH&&ok[n]&&!seen[n]){seen[n]=1;queue.push(n);}}}
const problems=[];
for(const bed of report.sleepers){
 const hit=art.props.find(p=>p.id!==bed.tree&&p.y>bed.y-20&&p.y-bed.y<p.height*(p.scale??1)*.95&&Math.abs(p.x-bed.x)<p.width*(p.scale??1)*.45+bed.r*.6);
 if(hit)problems.push(`${bed.pose} at ${bed.x},${bed.y} hidden by ${hit.id}`);
}
const openAreas={};
for(const [id,z]of Object.entries(world.zones).filter(([id])=>/^(activity|stalls)-/.test(id))){
 let free=0,total=0;
 for(let y=-.7;y<=.7;y+=.1)for(let x=-.7;x<=.7;x+=.1){if(x*x+y*y>.49)continue;total++;if(geo.walkable(z.x+x*z.rx,z.y+y*z.ry))free++;}
 openAreas[id]={free,total};if(free!==total)problems.push(`${id} interior blocked: ${free}/${total}`);
}
for(const [name,z]of Object.entries(world.zones)){if(!geo.walkable(...z.spawn))problems.push(`zone ${name} spawn blocked`);if(!seen[cell(z.spawn)])problems.push(`zone ${name} disconnected`);}
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)};
for(const [i,line]of world.paths.entries()){const bad=line.filter(p=>!geo.walkable(...p));if(bad.length)problems.push(`path ${i} has ${bad.length} blocked centre samples, first ${bad[0]}`);}
for(const [i,b]of world.walkways.entries()){
 for(let t=0;t<=1;t+=.025){const p=[b.a[0]+(b.b[0]-b.a[0])*t,b.a[1]+(b.b[1]-b.a[1])*t];if(!geo.walkable(...p)){problems.push(`deck ${i} blocked at ${p}`);break;}}
 if(!seen[cell(b.a)]||!seen[cell(b.b)])problems.push(`deck ${i} disconnected`);
}
// A floating canal point must remain both undrawn and nonsolid. Compare single
// polygon compatibility encoding with the two actual shore rings across the map.
let coastChecks=0;
for(let y=400;y<5200;y+=43)for(let x=400;x<7600;x+=43){const actual=world.coastRings.some(r=>inPoly(x,y,r));if(inPoly(x,y,world.coast)!==actual)problems.push(`coast seam mismatch ${x},${y}`);coastChecks++;}
for(const y of [1100,1500,3000,3500,4400,4800]){let wet=0;for(let x=3500;x<4600;x+=20)if(!map.landAt(x,y))wet++;if(!wet)problems.push(`canal closed at ${y}`);}
const bridgeIds=['canal-bridge-north','canal-bridge-south'];
for(const b of world.walkways.slice(0,2))for(const p of art.props){if(/bridge/.test(p.name)||!p.asset)continue;const w=p.width*p.scale,h=p.height*p.scale;
 const mid=[(b.a[0]+b.b[0])/2,(b.a[1]+b.b[1])/2];
 if(p.y>mid[1]+30&&p.y-h<mid[1]&&p.x+w/2>Math.min(b.a[0],b.b[0])-10&&p.x-w/2<Math.max(b.a[0],b.b[0])+10)problems.push(`prop ${p.id} ${p.asset} hides bridge`);
}
for(const p of art.props){if(!p.asset||/lily|reeds|cattails/.test(p.asset))continue;if(!world.coastRings.some(r=>inPoly(p.x,p.y-4,r)))problems.push(`prop ${p.id} ${p.asset} off land`);}
const freeCount=ok.reduce((a,b)=>a+b,0),metrics={ready:report.ready,sleepers:report.sleepers.length,trees:art.props.filter(p=>/^tree-/.test(p.asset??'')).length,props:art.props.length,groundDetails:art.flats.filter(p=>/grass-tuft|flower-dot|pebble|sand-speck/.test(p.src)).length,openAreas,walkableCells:freeCount,reachableCells:queue.length,reachablePercent:queue.length/freeCount*100,coastChecks,problems,checkerNotes:report.sleepNotes};
writeFileSync('public/pixi-art/themes/library/library-check.json',JSON.stringify(metrics,null,2));console.log(metrics);assert.equal(problems.length,0,'Library geometry checks');
// Curved benches have the same ground geometry in art and collision, and each
// seat is visible instead of being hidden under a foreground tree canopy.
const landmarkArcs=json('public/pixi-art/themes/library/arc-benches.json');
const courtArcs=json('public/pixi-art/themes/library/library-closeup-benches.json');
assert.equal(landmarkArcs.length,8);assert.equal(courtArcs.length,6);
const arcs=[...landmarkArcs,...courtArcs];
for(const b of arcs){
 const p=art.props.find(p=>p.id===b.id);assert(p,b.id+' placed');
 assert.deepEqual(world.obstacles.find(o=>o.name===b.id)?.poly,b.footprint,b.id+' world footprint');
 assert.deepEqual(walk.obstacles.find(o=>o.name===b.id)?.poly,b.footprint,b.id+' server footprint');
 assert.equal(geo.walkable(p.x,p.y),false,b.id+' seat is solid');
 const hidden=art.props.find(q=>/^tree-/.test(q.asset??'')&&q.y>p.y&&q.y-q.height*q.scale<p.y-20&&Math.abs(q.x-p.x)<q.width*q.scale*.4+p.width*.25);
 assert(!hidden,b.id+' hidden by '+hidden?.id);
}
const {readdirSync,existsSync}=await import('node:fs');
const root='public/pixi-art/themes/library/';
const sources=[...art.ground.tiles,...art.flats,...art.decks,...art.props,...art.floating].map(p=>p.src);
for(const src of new Set(sources)){
 assert(src.endsWith('.svg'),'SVG only: '+src);assert(existsSync(root+src),src+' exists');
 assert(!/<image\b|data:image\/(png|jpe?g|webp)|<foreignObject\b/i.test(readFileSync(root+src,'utf8')),'no embedded raster: '+src);
}
assert(!readdirSync(root,{recursive:true}).some(p=>/\.(png|jpe?g|webp)$/i.test(p)),'working raster outside public');
console.log(`${arcs.length} curved benches: solid, visible, matched footprints. All manifest sources SVG, no raster under Library public folder.`);

metrics.arcBenches=arcs.length;metrics.svgSources=new Set(sources).size;metrics.rasterAssets=0;
writeFileSync(root+'library-check.json',JSON.stringify(metrics,null,2));
