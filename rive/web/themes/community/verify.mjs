import fs from 'node:fs';
import assert from 'node:assert/strict';
import {checkTheme} from '../../../../scripts/theme-index.mjs';
import {makeMap} from '../../../../src/pixi/island-maps.js';
import {geometry} from '../../island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../../../src/pixi/sleep-spots.js';
import {neighboursOf} from '../../../../src/pixi/world-map.js';
const root=new URL('../../../../',import.meta.url);
const read=f=>JSON.parse(fs.readFileSync(new URL(f,root)));
const save=(f,d)=>fs.writeFileSync(new URL(f,root),JSON.stringify(d,null,2)+'\n');
const world=read('rive/web/themes/community/world.json'), walk=read('rive/web/themes/community/walk-world.json'), harbor=read('rive/web/themes/community/harbor.json'), art=read('public/pixi-art/themes/community/art.json');
const baseWalk=makeMap('community',{world,walk,harbor,sleepers:[]}).walk;
const resolve=()=>resolveSleepSpots(baseWalk,art.props,geometry(baseWalk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
let beds=resolve();
if(process.argv.includes('--fix-sleeper') && beds.bad.length){
 for(const bad of beds.bad){
  const spot=world.sleepSpots[bad.pose].find(s=>s[0]===bad.x&&s[1]===bad.y);
  assert(spot,`Cannot repair ${JSON.stringify(bad)}`);
  const origin=[spot[0],spot[1]];let found=false;
  search:for(let r=30;r<=600;r+=30)for(let angle=0;angle<360;angle+=20){
   spot[0]=Math.round(origin[0]+Math.cos(angle*Math.PI/180)*r);spot[1]=Math.round(origin[1]+Math.sin(angle*Math.PI/180)*r);
   if(resolve().bad.length<beds.bad.length){found=true;break search;}
  }
  assert(found,'No valid nearby sleeper site');
 }
 save('rive/web/themes/community/world.json',world);beds=resolve();
}
let report=checkTheme('community');
console.log(`${report.ready?'READY':'FAIL'} community sleepers ${beds.length}/40`);
assert(report.ready,report.problems.join('\n'));assert.equal(beds.length,40,JSON.stringify(beds.bad));assert.equal(beds.bad.length,0);
assert.equal(report.sleepers.length,40,report.sleepNotes.join('\n'));
assert(Math.min(...world.pathWidths)>=160,'All footpaths must be at least 160 units wide');
save('public/pixi-art/themes/community/resolved-sleepers.json',beds.map(({x,y,pose,r,flip,tree})=>({x,y,pose,r,flip,...(tree?{tree}:{})})));
const map=makeMap('community',{world,walk,harbor,sleepers:beds}),nav=map.nav();
const problems=[];
for(const [id,z] of Object.entries(world.zones)){
 const [x,y]=z.spawn;
 if(!nav.walkable(x,y))problems.push(`zone ${id} spawn blocked at ${x},${y}`);
 else if(!nav.route(map.spawn.x,map.spawn.y,x,y).length&&!nav.clearLine([map.spawn.x,map.spawn.y],[x,y]))problems.push(`zone ${id} unreachable`);
}
for(const [i,way] of world.walkways.entries()){
 if(!nav.walkable(...way.b))problems.push(`walkway ${i} endpoint blocked`);
 if(!nav.route(map.spawn.x,map.spawn.y,...way.b).length)problems.push(`walkway ${i} unreachable`);
}
let open=0;for(let y=2100;y<3200;y+=110)for(let x=3300;x<4700;x+=110)if(nav.walkable(x,y))open++;
assert(open>=100,`Only ${open} open crowd positions`);
const n=neighboursOf('home').find(n=>!n.island.theme);
console.log('Registration:', n ? `unassigned neighbour ${n.island.id}` : 'all home neighbours already assigned');
const area=Math.abs(world.coast.reduce((v,[x,y],i)=>{const [a,b]=world.coast[(i+1)%world.coast.length];return v+x*b-a*y},0))/2;
const stats={ready:report.ready,sleepers:beds.length,landArea:area,ratioToOriginalHome:area/11.09e6,width:world.width,height:world.height,props:art.props.length,activities:Object.keys(world.zones).filter(k=>k.startsWith('activity-')).length,stallRows:Object.keys(world.zones).filter(k=>k.startsWith('stalls-')).length,crowdPositions:open,boats:map.boatSpots().length,nearestUnthemed:n?.island.id??null,problems};
save('rive/web/themes/community/validation.json',stats);console.log(JSON.stringify(stats,null,2));assert.equal(problems.length,0,problems.join('\n'));
