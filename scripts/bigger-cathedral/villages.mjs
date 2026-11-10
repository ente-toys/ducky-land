import fs from 'node:fs';
import {rebuildPaths} from './paths.mjs';
import {JSDOM} from 'jsdom';
import {smooth} from './design.mjs';
import {inPoly} from '../../rive/web/island-geometry.mjs';
import {VILLAGES,ARRIVALS,GROVES,VILLAGE_REST} from './villages-data.mjs';
import {applyBuildings} from './buildings.mjs';
const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/',S='scripts/bigger-cathedral/villages-source/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const art=read(S+'art.json'),world=read(S+'world.json'),walk=read(S+'walk-world.json');
const retired=p=>/^(bellpeep|olivello|tessera|crumbbell|dense|olive-working|olive-press|mosaic-worktable|harbour|junction-sign)-/.test(p.id??'')||/^b2-balustrade-/.test(p.id??'');
const nearVillage=p=>VILLAGES.some(v=>Math.hypot(p.x-v.square[0],p.y-v.square[1])<1050);
const removed=art.props.filter(p=>retired(p)||p.id?.startsWith('green-')&&nearVillage(p));
art.props=art.props.filter(p=>!removed.includes(p));
art.flats=art.flats.filter(p=>!p.src.startsWith('communities/'));
for(const m of [world,walk])m.obstacles=m.obstacles.filter(o=>o.id?.startsWith('b2-')||!removed.some(p=>Math.abs(p.x-o.x)<Math.max(p.width*.55,40)&&Math.abs(p.y-o.y)<Math.max(p.height*.3,85)));
// Retained outer groves use the same Home plant kit as the inner island.
const sizes={1:[260,360],2:[180,360],3:[300,380],4:[200,280],5:[150,380],b1:[130,100],b2:[168,110],b3:[116,104],b4:[140,100]};
for(const p of art.props.filter(p=>p.id?.startsWith('green-'))){const b=/bush/.test(p.src),type=b?'b2':/tree-5/.test(p.src)?5:1;[p.width,p.height]=sizes[type];p.src='/pixi-art/plants/'+(b?'bush-2':'tree-'+type)+'.svg';p.scale=1;}
function addSolid(p,rx,ry,y=p.y-25){for(const m of [world,walk])m.obstacles.push({id:p.id,x:p.x,y,rx,ry});}
for(const v of VILLAGES){
 fs.mkdirSync(A+'villages/'+v.id,{recursive:true});
 const source='../concepts/themes/work/bellovo-check/villages/svg/'+v.id+'/';
 for(const o of v.pieces){
  const dest='villages/'+v.id+'/'+o.file;if(fs.existsSync(source+o.file))fs.copyFileSync(source+o.file,A+dest);
  const [width,height]=o.size,[cx,cy]=v.square.map((n,i)=>n+o.offset[i]),floor=/ground|square-floor/.test(o.role),mosaic=o.id==='flower-mosaic';
  const p={id:v.id+'-'+o.id,name:v.id+' '+o.id,src:dest,x:cx,y:cy+height/2,width,height,scale:1,anchor:{x:.5,y:1},shadow:false,wind:false,flip:o.flip};
  if(floor||mosaic){art.flats.push({...p,x:cx-width/2,y:cy-height/2,topLeft:true});continue;}
  art.props.push(p);
  const building=/building|house|workplace/.test(o.role),hero=/hero/.test(o.role);
  if(building)addSolid(p,width*.38,30);
  else if(!/trade/.test(o.role))addSolid(p,hero?width*.33:Math.min(width*.35,55),hero?28:10,p.y-15);
 }
 for(const [i,g]of GROVES[v.id].entries())for(const [j,[x,y,t]]of g.entries()){
  const b=String(t).startsWith('b'),[width,height]=sizes[t];const p={id:v.id+'-grove-'+i+'-'+j,name:b?'Home village bush':'Home village tree',src:'/pixi-art/plants/'+(b?'bush-'+t.slice(1):'tree-'+t)+'.svg',x,y,width,height,scale:1,anchor:{x:.5,y:1},shadow:false,wind:false};art.props.push(p);if(!b)addSolid(p,18,12,y-10);
 }
 const c=world.communities.find(c=>c.id===v.id);c.homes=3;c.square=v.square;const work=art.props.find(p=>p.id.startsWith(v.id)&&/foundry|olive-workshop|mosaic-workshop|bakery/.test(p.id));c.workplace=[work.x,work.y];
}
// Every route is authored centrally in paths-data.mjs.
for(const [pose,entries]of Object.entries(VILLAGE_REST))for(const [i,[x,y]]of Object.entries(entries))world.sleepSpots[pose][i]=[x,y,world.sleepSpots[pose][i][2]];
// Ground roads are generated exclusively by paths.mjs after placement.
// Explicit shared flat contact shadows make offline proofs and runtime agree.
fs.writeFileSync(A+'villages/plant-shadow.svg','<svg xmlns="http://www.w3.org/2000/svg" width="300" height="90" viewBox="0 0 300 90"><ellipse cx="150" cy="45" rx="145" ry="38" fill="#39472d" opacity=".15"/></svg>');
for(const p of art.props.filter(p=>p.src.startsWith('/pixi-art/plants/'))){
 const width=p.width*.72,height=width*.3;p.shadow=false;
 art.flats.push({id:p.id+'-shadow',name:'Plant contact shadow',src:'villages/plant-shadow.svg',x:p.x-width/2+6,y:p.y-height/2+4,width,height,scale:1,topLeft:true});
}
const plan=read('scripts/bigger-cathedral/plan.json');
for(const v of VILLAGES){const c=plan.communities.find(c=>c.id===v.id),ps=art.props.filter(p=>p.id.startsWith(v.id+'-'));c.x=v.square[0];c.y=v.square[1];c.homes=ps.filter(p=>p.id.includes('-house-')).map(p=>[p.x,p.y]);c.work=world.communities.find(c=>c.id===v.id).workplace;}
save('scripts/bigger-cathedral/plan.json',plan);
applyBuildings(art,world,walk);
world.props=art.props;save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
console.log({villages:VILLAGES.length,removed:removed.length,props:art.props.length,paths:world.paths.length});

rebuildPaths();
