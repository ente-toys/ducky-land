// Choose 40 deliberate, validated resting spots using the game's actual resolver.
import {readFileSync,writeFileSync} from 'node:fs';
import {geometry} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const root=new URL('../../',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const world=read('assets/world/themes/canal/world.json'),walk=read('assets/world/themes/canal/walk-world.json'),art=read('public/pixi-art/themes/canal/art.json');
const base={...world,...walk},sizes=sleepHalfWidths();let geo=geometry(base);
const spots={nod:[],hammock:[],rock:[],leaf:[],book:[],chair:[],wing:[],box:[]};
const resolve=()=>resolveSleepSpots(base,art.props,geo.walkable,sizes,{spots,avoid:world.sleepAvoid,warn:false});
const trees=art.props.filter(p=>p.name==='Canal tree');
for (const p of trees){spots.nod.push([p.id,0,spots.nod.length%2===0]);if(resolve().bad.length)spots.nod.pop();if(spots.nod.length===5)break;}
let seed=171;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const reservations=Object.entries(world.zones).filter(([k])=>k.startsWith('activity-')||k.startsWith('stalls-')).map(([,z])=>z);
const clearReservation=(x,y)=>!reservations.some(z=>'x0'in z?x>z.x0-150&&x<z.x1+150&&y>z.y0-115&&y<z.y1+115:((x-z.x)/(z.rx+150))**2+((y-z.y)/(z.ry+115))**2<1);
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const clearPath=(x,y)=>world.paths.every((line,i)=>line.slice(1).every((b,j)=>segmentDistance(x,y,line[j],b)>world.pathWidths[i]/2+85));
const pool=[];for(let y=900;y<5300;y+=40)for(let x=800;x<7300;x+=40)if(geo.walkable(x,y)&&clearReservation(x,y)&&clearPath(x,y))pool.push({x,y,j:rnd()});
const affinity={hammock:/tree|gazebo/i,rock:/bush|tree/i,leaf:/flower|bush/i,book:/townhouse|bench|gazebo/i,chair:/bench|lamp/i,wing:/tree|bush/i,box:/townhouse|stall/i};
for(const pose of ['box','hammock','chair','book','leaf','wing','rock']){
 const props=art.props.filter(p=>affinity[pose].test(p.name));
 const choices=pool.map(p=>({...p,d:Math.min(...props.map(q=>Math.hypot(q.x-p.x,(q.y-p.y)*1.1)))})).sort((a,b)=>(Math.abs(a.d-260)+a.j*100)-(Math.abs(b.d-260)+b.j*100));
 for(const p of choices){spots[pose].push([p.x,p.y,spots[pose].length%2===0]);if(resolve().bad.length)spots[pose].pop();if(spots[pose].length===5)break;}
}
// Finish deliberate resting clearings by clearing small vegetation from a sleeper's footprint.
// Buildings, all 82 trees, furniture, paths and reserved areas remain intact.
const cleared=[];
for(const pose of Object.keys(spots).slice(1)){
 if(spots[pose].length>=5)continue;
 const nearby=art.props.filter(p=>affinity[pose].test(p.name));
 const choices=pool.map(p=>({...p,d:Math.min(...nearby.map(q=>Math.hypot(q.x-p.x,q.y-p.y)))})).sort((a,b)=>Math.abs(a.d-230)-Math.abs(b.d-230));
 for(const p of choices){
  if(spots[pose].length>=5)break;
  const removed=art.props.filter(q=>/bush|flower|rock|shell|reeds/i.test(q.name)&&q.height*q.scale<145&&Math.hypot(q.x-p.x,(q.y-p.y)*1.2)<220);
  if(!removed.length)continue;
  const savedProps=art.props,savedObs=base.obstacles;
  art.props=art.props.filter(q=>!removed.includes(q));
  base.obstacles=base.obstacles.filter(o=>o.poly||!removed.some(q=>Math.abs(q.x-o.x)<1&&Math.abs(q.y-o.y)<25));
  geo=geometry(base);
  spots[pose].push([p.x,p.y,spots[pose].length%2===0]);
  const candidate=resolve();
  if(candidate.bad.length){spots[pose].pop();art.props=savedProps;base.obstacles=savedObs;geo=geometry(base);}
  else cleared.push({pose,x:p.x,y:p.y,removed:removed.map(q=>q.id)});
 }
}
// Use an additional tree-rest pose when a portable pose has no safe free footprint.
// The contract is 40 residents using all eight Home poses, not five of each pose.
for(const tree of trees){
 if(resolve().length>=40)break;
 if(spots.nod.some(s=>s[0]===tree.id)||!clearReservation(tree.x,tree.y+14)||!clearPath(tree.x,tree.y+14))continue;
 spots.nod.push([tree.id,0,spots.nod.length%2===0]);if(resolve().bad.length)spots.nod.pop();
}
const beds=resolve();if(beds.length!==40||beds.bad.length)throw Error(JSON.stringify({count:beds.length,bad:beds.bad,spots}));
world.sleepSpots=spots;world.props=art.props;world.obstacles=base.obstacles;walk.obstacles=base.obstacles;
writeFileSync(new URL('public/pixi-art/themes/canal/art.json',root),JSON.stringify(art));
writeFileSync(new URL('assets/world/themes/canal/walk-world.json',root),JSON.stringify(walk));
writeFileSync(new URL('public/pixi-art/themes/canal/sleep-clearings.json',root),JSON.stringify(cleared,null,2));writeFileSync(new URL('assets/world/themes/canal/world.json',root),JSON.stringify(world));
writeFileSync(new URL('public/pixi-art/themes/canal/resolved-sleepers.json',root),JSON.stringify(beds,null,2));
const metrics=read('public/pixi-art/themes/canal/polish-metrics.json');
metrics.finalProps=art.props.length;metrics.finalCounts=Object.fromEntries([...new Set(art.props.map(p=>p.name))].map(name=>[name,art.props.filter(p=>p.name===name).length]));metrics.sleepClearings=cleared.length;
writeFileSync(new URL('public/pixi-art/themes/canal/polish-metrics.json',root),JSON.stringify(metrics,null,2));
console.log('40/40 valid sleepers',Object.fromEntries(Object.entries(spots).map(([k,v])=>[k,v.length])));
