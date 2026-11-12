import {readFileSync,writeFileSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
const read=p=>JSON.parse(readFileSync(p));const d='assets/world/themes/waterfall/';
const world=read(d+'world.json'),walk=read(d+'walk-world.json'),harbor=read(d+'harbor.json');
const report=checkTheme('waterfall');const map=makeMap('waterfall',{world,walk,harbor,sleepers:report.sleepers});const nav=map.nav();
let failures=[];
const baseline=read('scripts/themes/waterfall-ten-source.json').world;
for(const key of ['width','height','coast','zones','sleepSpots'])if(JSON.stringify(world[key])!==JSON.stringify(baseline[key]))failures.push('Protected layout changed: '+key);
const art=read('public/pixi-art/themes/waterfall/art.json');
const trees=art.props.filter(p=>/tree/i.test(p.name));
if(trees.length<60)failures.push('Fewer than 60 trees');
if(art.props.length<300)failures.push('Fewer than 300 props');
for(const [name,z]of Object.entries(world.zones).filter(([name])=>/^(activity|stalls)-/.test(name))){
 const interior=art.props.filter(p=>((p.x-z.x)/z.rx)**2+((p.y-z.y)/z.ry)**2<.7**2);
 if(interior.length)failures.push(name+' interior contains props: '+interior.map(p=>p.id).join(','));
}
const from=world.zones.plaza.spawn;
for(const [name,z]of Object.entries(world.zones))if(!nav.walkable(...z.spawn)||(!nav.clearLine(from,z.spawn)&&!nav.route(...from,...z.spawn).length)) failures.push('Unreachable zone '+name);
for(const [i,b]of world.walkways.entries())for(const t of [.1,.9]){const p=b.a.map((a,j)=>a+(b.b[j]-a)*t);if(!nav.walkable(...p)||(!nav.clearLine(from,p)&&!nav.route(...from,...p).length))failures.push('Unreachable walkway '+i+' at '+t)}
let crowd=[];for(let y=1100;y<4800&&crowd.length<100;y+=180)for(let x=850;x<7000&&crowd.length<100;x+=180)if(nav.walkable(x,y)&&nav.route(...from,x,y).length)crowd.push([x,y]);
if(crowd.length!==100)failures.push('Cannot place 100 reachable positions');
if(report.sleepers?.length!==40)failures.push('Not 40 resolved sleepers');
let area=Math.abs(world.coast.reduce((s,a,i)=>{let b=world.coast[(i+1)%world.coast.length];return s+a[0]*b[1]-b[0]*a[1]},0))/2;
const result={ready:report.ready,area,homeRatio:area/11090000,map:[world.width,world.height],props:art.props.length,trees:trees.length,bigTrees:trees.filter(p=>p.height>=300).length,protectedLayoutUnchanged:!failures.some(f=>f.startsWith("Protected")),sleepers:report.sleepers?.length,crowdPositions:crowd.length,zones:Object.keys(world.zones),problems:report.problems,failures,sleepNotes:report.sleepNotes};
writeFileSync('public/pixi-art/themes/waterfall/validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(failures.length||!report.ready)process.exitCode=1;
