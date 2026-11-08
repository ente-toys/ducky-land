import {readFileSync,writeFileSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
const read=p=>JSON.parse(readFileSync(p));
const base='rive/web/themes/goldmine/',world=read(base+'world.json'),walk=read(base+'walk-world.json'),harbor=read(base+'harbor.json'),art=read('public/pixi-art/themes/goldmine/art.json');
const map=makeMap('goldmine',{world,walk,harbor}),nav=map.nav();
const checks=[];const ck=(label,pass,data)=>checks.push({label,pass:!!pass,...(data?{data}:{})});
const r=checkTheme('goldmine');ck('Theme ready, 40 original sleepers',r.ready,r.problems);
const old=read('scripts/bigger-goldmine/original/art.json'),oldWorld=read('scripts/bigger-goldmine/original/world.json');
ck('All 371 original prop records preserved',JSON.stringify(art.props.slice(0,old.props.length))===JSON.stringify(old.props));
ck('Original sleeper coordinates unchanged',JSON.stringify(world.sleepSpots)===JSON.stringify(oldWorld.sleepSpots));
for(const c of read('scripts/bigger-goldmine/plan.json').communities){
 const [x,y]=c.point;const route=nav.route(map.spawn.x,map.spawn.y,x,y);
 ck(c.name+' reached from the heart',nav.walkable(x,y)&&!!route.length,{x,y,route:route.length});
}
for(const p of art.props.filter(p=>p.id.startsWith('community-')&&(/ home|forge|office|cooperage/.test(p.name)))){
 const x=p.x,y=p.y+65;ck(p.name+' door '+p.id,nav.walkable(x,y)&&!!nav.route(map.spawn.x,map.spawn.y,x,y).length,{x,y});
}
for(const [i,b] of harbor.boats.entries())ck('Boat '+i+' sea and boarding shore',!map.landAt(b.x,b.y)&&!!map.shoreFor(b.x,b.y,280),b);
ck('Ground tiles <=1536 raster pixels',art.ground.tiles.every(t=>t.width*(t.resolution??1)<=1536&&t.height*(t.resolution??1)<=1536));
for(const d of read('scripts/bigger-goldmine/bridge-audit.json'))ck('Real water under '+d.src,d.waterUnderDeck);
ck('River blocks walking',!nav.walkable(8370,2100));
writeFileSync('scripts/bigger-goldmine/check-results.json',JSON.stringify(checks,null,2)+'\n');
console.log(checks.filter(c=>!c.pass));console.log(checks.filter(c=>c.pass).length+'/'+checks.length+' checks passed');
process.exitCode=checks.some(c=>!c.pass)?1:0;
