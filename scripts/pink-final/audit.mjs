// Audit production data, using solid ground contacts rather than tree canopies.
import {execFileSync} from 'node:child_process';
import {inCentre} from './centre-lock.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {inShape,inPoly} from '../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(readFileSync(p));
export function auditPink(){
 const art=read('public/pixi-art/themes/pink/art.json'),world=read('rive/web/themes/pink/world.json'),walk=read('rive/web/themes/pink/walk-world.json');
 const index=readFileSync('rive/web/themes/index.js','utf8').split('\n').find(l=>l.startsWith('  pink:')),beds=JSON.parse(index.match(/sleepers: (\[.*\])/)[1]);
 const bridges=read('scripts/pink-fix/shore.json').crossings;
 const roads=world.paths.flatMap((p,id)=>p.slice(1).map((b,i)=>({a:p[i],b,id})));
 const near=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return [x-a[0]-t*dx,y-a[1]-t*dy];};
 const dist=(p,a,b)=>Math.hypot(...near(...p,a,b));
 const shape=f=>{if(f.poly){const xs=f.poly.map(p=>p[0]),ys=f.poly.map(p=>p[1]);return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2,(Math.max(...xs)-Math.min(...xs))/2,(Math.max(...ys)-Math.min(...ys))/2];}return [f.x,f.y,f.rx??10,f.ry??10];};
 const contact=p=>p.footprint??world.obstacles.find(o=>o.name===p.id||(!o.name&&Math.abs((o.x??1e9)-p.x)<2&&Math.abs((o.y??1e9)-p.y)<100))??{x:p.x,y:p.y-8,rx:Math.min(32,p.width*(p.scale??1)*.24),ry:12};
 const overlap=(f,a,b,width)=>{const [x,y,rx,ry]=shape(f),[dx,dy]=near(x,y,a,b),d=Math.hypot(dx,dy);return d<width/2+Math.hypot(rx*dx,ry*dy)/(d||1)-.1;};
 const remaining={propVsPath:[],propVsBridge:[],bridgeVsBridge:[],bridgeWithoutWater:[],sleeperVsTrunk:[],sleeperVsPath:[],sleeperVsBridge:[],pathEnds:[],gardenVsPath:[],gardenVsBridge:[]};
 for(const p of art.props){const f=contact(p),road=roads.find(s=>overlap(f,s.a,s.b,178));if(road)remaining.propVsPath.push({id:p.id,path:road.id});const bridge=bridges.find(c=>overlap(f,c.a,c.b,c.width));if(bridge)remaining.propVsBridge.push({id:p.id,bridge:bridge.id});}
 const segGap=(a,b,c,d)=>Math.min(dist(a,c,d),dist(b,c,d),dist(c,a,b),dist(d,a,b));
 for(let i=0;i<bridges.length;i++){
  const c=bridges[i];for(const t of [.45,.5,.55]){const p=c.a.map((v,k)=>v+(c.b[k]-v)*t);if(!world.water.some(w=>inShape(...p,w)))remaining.bridgeWithoutWater.push({id:c.id,at:p});}
  for(let j=i+1;j<bridges.length;j++){const d=bridges[j];if(segGap(c.a,c.b,d.a,d.b)<(c.width+d.width)/2+35)remaining.bridgeVsBridge.push([c.id,d.id]);}
 }
 const trees=art.props.filter(p=>/tree-|tree-cherry/.test(p.src));
 for(const b of beds){const f={x:b.x,y:b.y-6,rx:b.r*.9,ry:Math.min(34,Math.max(22,b.r*.42))};const road=roads.find(s=>overlap(f,s.a,s.b,178));if(road)remaining.sleeperVsPath.push({pose:b.pose,x:b.x,y:b.y,path:road.id});for(const t of trees)if(((b.x-t.x)/(b.r+65))**2+((b.y-t.y)/(b.r*.65+40))**2<1)remaining.sleeperVsTrunk.push({pose:b.pose,x:b.x,y:b.y,tree:t.id});const c=bridges.find(c=>overlap(f,c.a,c.b,c.width));if(c)remaining.sleeperVsBridge.push({pose:b.pose,bridge:c.id});}
 const hamletPolys=[];
 for(const h of ['ribbonwick','chirrup','petalpatch']){const t=read('scripts/pink-hamlets/hamlets/'+h+'.json'),m=t.map;for(const p of t.layout.paths??[])hamletPolys.push(p.polygon.map(q=>q.map((v,k)=>m.at[k]+(v-m.bp[k])*m.k)));}
 const shoreMaps=read('scripts/pink-hamlets-b/placement.json');
 for(const h of ['teacup','tutu-tides']){const t=read('scripts/pink-hamlets-b/'+h+'-layout.json'),m=shoreMaps[h].map;for(const p of t.paths)hamletPolys.push(p.polygon.map(q=>q.map((v,k)=>m.at[k]+(v-m.bp[k])*m.k)));}
 const courts=art.flats.filter(f=>/close-(plaza|cafe|festival|court)|hamlets.*(court|square)/.test(f.src));
 const inCourt=(x,y)=>hamletPolys.some(p=>inPoly(x,y,p)||p.some((a,i)=>dist([x,y],a,p[(i+1)%p.length])<90))||world.paths.filter(p=>JSON.stringify(p[0])===JSON.stringify(p.at(-1))).some(p=>inPoly(x,y,p))||courts.some(f=>{const x0=f.x-(f.topLeft?0:f.width/2),y0=f.y-(f.topLeft?0:f.height);return x>=x0-110&&x<=x0+f.width+110&&y>=y0-110&&y<=y0+f.height+110;})||Object.values(world.zones).some(z=>Math.hypot(x-(z.spawn?.[0]??z.x),y-(z.spawn?.[1]??z.y))<320);
 const endAudit=[];
 for(let id=0;id<world.paths.length;id++){
  const p=world.paths[id];for(const [end,point]of [['start',p[0]],['end',p.at(-1)]]){
   let goal=roads.find(s=>s.id!==id&&dist(point,s.a,s.b)<=170)?'connected path':inCourt(...point)?'plaza or hamlet':world.jetties?.some(j=>dist(point,j.foot,j.tip)<140)?'jetty':null;
   if(!goal&&art.props.some(p=>(p.household||/cafe|gazebo|workshop|conservatory/.test(p.src))&&Math.hypot(point[0]-p.x,point[1]-p.y)<350))goal='building approach';
   if(!goal&&JSON.stringify(p[0])===JSON.stringify(p.at(-1))&&p.some(pt=>roads.some(s=>s.id!==id&&dist(pt,s.a,s.b)<=170)))goal='connected promenade loop';
   const record={path:id,end,point,goal};endAudit.push(record);if(!goal)remaining.pathEnds.push(record);
  }
 }
 for(const f of art.flats.filter(f=>/pink-bed-/.test(f.src))){const [x,y,w,h]=[f.x,f.y,f.width,f.height],contact={x:x+w/2,y:y+h/2,rx:w/2,ry:h/2};if(roads.some(s=>overlap(contact,s.a,s.b,178)))remaining.gardenVsPath.push(f.id);if(bridges.some(c=>overlap(contact,c.a,c.b,c.width)))remaining.gardenVsBridge.push(f.id);}
 const forbidden=art.props.filter(p=>/^hamlets\/.*\/(?:[^/]*(?:tree|oak|cherry|blossom|shrub|bush)[^/]*)\.svg$/i.test(p.src));
 // The boss explicitly locked the original centre, including its intentional lamp/path
 // contacts and the original nod pose beside its own tree. Verify exact baseline data
 // before classifying these separately from newly introduced overlaps.
 const baseline=JSON.parse(readFileSync('scripts/pink-final/baseline/art.json','utf8'));
 const protectedIds=new Set(read('scripts/pink-final/centre-lock-report.json').protectedProps);
 const lockedBaselineContacts=[];
 remaining.propVsPath=remaining.propVsPath.filter(hit=>{const p=art.props.find(p=>p.id===hit.id),old=baseline.props.find(p=>p.id===hit.id);if(protectedIds.has(hit.id)&&JSON.stringify(p)===JSON.stringify(old)){lockedBaselineContacts.push(hit);return false;}return true;});
 const oldLine=readFileSync('scripts/pink-final/baseline/pink-index-line.js','utf8').split('\n').find(l=>l.startsWith('  pink:')),oldBeds=JSON.parse(oldLine.match(/sleepers: (\[.*\])/)[1]);
 remaining.sleeperVsTrunk=remaining.sleeperVsTrunk.filter(hit=>{if(inCentre(hit.x,hit.y)&&oldBeds.some(b=>b.x===hit.x&&b.y===hit.y&&b.pose===hit.pose&&b.tree===hit.tree)){lockedBaselineContacts.push(hit);return false;}return true;});
 const count=Object.values(remaining).reduce((s,a)=>s+a.length,0);
 return {lockedBaselineContacts,remainingOverlapCount:count,forbiddenHamletPlantProps:forbidden.length,checked:{props:art.props.length,bridges:bridges.length,pathEnds:endAudit.length,sleepers:beds.length},remaining,pathEnds:endAudit,bridges:bridges.map(c=>({id:c.id,a:c.a,b:c.b,water:true})),coastMatches:JSON.stringify(world.coast)===JSON.stringify(walk.coast)};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const report=auditPink();writeFileSync('scripts/pink-final/overlap-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.remainingOverlapCount||report.forbiddenHamletPlantProps)process.exitCode=1;}
