import {readFileSync as read,writeFileSync as write,copyFileSync as copy,mkdirSync as mkdir,readdirSync as ls} from 'node:fs';
import {geometry,inShape} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const root='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/sunbob-review',P=root+'/p/',A='public/pixi-art/themes/sunflower/',D='assets/world/themes/sunflower/';
const json=f=>JSON.parse(read(f)),save=(f,o)=>write(f,JSON.stringify(o,null,1)+'\n');
const art=json(A+'art.json'),world=json(D+'world.json'),walk=json(D+'walk-world.json'),c=json(P+'centre/centre-placements.json');
function copies(src,dst){mkdir(dst,{recursive:true});for(const f of ls(src,{withFileTypes:true}))if(f.isDirectory())copies(src+'/'+f.name,dst+'/'+f.name);else if(f.name.endsWith('.svg'))copy(src+'/'+f.name,dst+'/'+f.name);}
copies(P+'bldg/fixed',A);
const retire=new Set(c.retirePropIds);
art.flats=art.flats.filter(p=>p.id!=='close-plaza-courses');
art.props=art.props.filter(p=>!retire.has(p.id));art.decks=art.decks.filter(p=>!['centre-back','centre-decal-floor','close-sunflower-rosette'].includes(p.id));
art.props.push(...c.props.filter(p=>!art.props.some(q=>q.id===p.id)));
mkdir(A+'bloom',{recursive:true});
for(const t of c.groundTiles){copy(P+'centre/'+t.src,A+'bloom/'+t.src);art.flats.push({...t,src:'bloom/'+t.src,topLeft:true});}
for(const w of [world,walk]){
 w.obstacles=w.obstacles.filter(o=>!(o.centre==='locked'&&o.name!=='clock planter')&&!c.retireObstacleRecords.some(r=>JSON.stringify(r)===JSON.stringify(o))&&!retire.has(o.name));
 w.obstacles.push(...c.walkBlockers);for(const j of c.pathJoins){const i=w.paths.findIndex(p=>JSON.stringify(p.slice(0,j.originalPathHead.length))===JSON.stringify(j.originalPathHead));if(i<0)throw Error('join missing '+j.id);w.paths[i]=j.replacementPath;}
}
world.centrePlacement=c.centrePlacementReplacement;
const seg=(x,y,a,b)=>{let dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
const pathGap=(x,y)=>Math.min(...world.paths.flatMap((l,i)=>l.slice(1).map((b,j)=>seg(x,y,l[j],b)-(world.pathWidths[i]??104)/2)));
const dry=geometry(walk).walkable,droppedPlants=[];let plantCount=0;
mkdir(A+'outer',{recursive:true});copies(P+'plants/assets',A+'outer');
for(const [i,p] of json(P+'plants/placements.json').entries()){
 const hill=/home-review\/hill/.test(p.src),mound=/mound.svg/.test(p.src),kite=/kite-/.test(p.src),r=hill?30:kite?15:Math.min(85,p.width*.22);
 if(!dry(p.x,p.y)||pathGap(p.x,p.y)<r+22||((p.x-3880)/1750)**2+((p.y-2608.5)/1080)**2<1||world.walkways.some(b=>seg(p.x,p.y,b.a,b.b)<b.w/2+r+50)){droppedPlants.push({i,src:p.src,x:p.x,y:p.y});continue;}
 const src=p.src.startsWith('./assets/')?'outer/'+p.src.split('/').at(-1):p.src;
 const q={...p,src,id:'sunbob-outer-'+i,name:hill?'Stargazing '+p.src.split('/').at(-1):kite?'Kite':/tree/.test(src)?'Outer tree':/bush/.test(src)?'Outer bush':'Outer flowers'};
 if(mound){art.flats.push({...q,x:p.x-p.width*p.anchor.x,y:p.y-p.height*p.anchor.y,topLeft:true});}else {art.props.push(q);if(!kite)for(const w of [world,walk])w.obstacles.push({name:q.id,x:p.x,y:p.y-5,rx:hill?Math.min(65,p.width*.28):Math.max(12,r*.7),ry:hill?22:Math.max(10,r*.28)});}
 plantCount++;
}
world.props=art.props;
world.sleepTotal=90;
const proposed=json(P+'sleep/spots.json'),spots=Object.fromEntries(Object.keys(proposed).map(k=>[k,[]])),sizes=sleepHalfWidths();let occupied=[],droppedBeds=[];
const opts={avoid:[...(world.sleepAvoid??[]),{x:3880,y:2608.5,rx:1700,ry:1050,name:'bloom centre'}],warn:false};
function attempt(pose,s){let b=resolveSleepSpots(walk,art.props,dry,sizes,{...opts,spots:{[pose]:[s]},occupied});if(b.length&&(!b[0].tree&&pathGap(b[0].x,b[0].y)<sizes[pose]+22||b[0].tree&&pathGap(b[0].x,b[0].y)<90))return false;if(!b.length)return false;spots[pose].push(s);occupied.push(b[0]);return true;}
for(const [pose,list]of Object.entries(proposed))for(const s of list){if(!attempt(pose,s))droppedBeds.push({pose,s});}
for(const {pose,s}of droppedBeds){const tree=typeof s[0]==='string'?art.props.find(p=>p.id===s[0]):null;let filled=false;
 if(pose==='nod'){for(const p of art.props.filter(p=>/tree/i.test(p.name??p.src))){if(attempt(pose,[p.id,0,s[2]])){filled=true;break;}}}
 else {for(let radius=160;radius<=2800&&!filled;radius+=140)for(let j=0;j<24&&!filled;j++){const x=Math.round((tree?.x??s[0])+Math.cos(j*Math.PI/12)*radius),y=Math.round((tree?.y??s[1])+Math.sin(j*Math.PI/12)*radius);filled=attempt(pose,[x,y,s[2]]);}}
 if(!filled)throw Error('unable to refill '+pose);
}
world.sleepSpots=spots;
const beds=resolveSleepSpots(walk,art.props,dry,sizes,{...opts,spots});if(beds.length!==90||beds.bad.length)throw Error('invalid final beds '+beds.length);
world.sleepAvoid=opts.avoid;
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
mkdir(root+'/final',{recursive:true});save(root+'/final/integration.json',{buildingFixes:63,centreProps:c.props.length,plants:plantCount,droppedPlants,droppedBeds,sleepers:beds});
console.log({plants:plantCount,droppedPlants:droppedPlants.length,refilledBeds:droppedBeds.length,sleepers:beds.length});
