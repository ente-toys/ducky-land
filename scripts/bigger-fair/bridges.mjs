import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {archBridge,BRIDGE_SILLS} from './arch.mjs';
import {crossings} from './fix-geometry.mjs';
import {inShape} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/fair/',D='assets/world/themes/fair/',S='scripts/bigger-fair/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,1)+'\n');
export function applyFairBridges(){
 const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),plan=read(S+'centre-source/sailing.json');
 const outlet=JSON.parse(execFileSync('python3',[S+'bridge-water.py'],{encoding:'utf8'}));
 const lagoon=outlet.lagoon.map((p,i)=>({id:'ac2-lagoon',poly:[p,outlet.lagoon[(i+1)%outlet.lagoon.length],outlet.islet[(i+1)%outlet.islet.length],outlet.islet[i]]}));
 for(const w of [world,walk]){
  w.water=w.water.filter(s=>!/^ac2-lagoon/.test(s.id??''));
  w.water.push(...lagoon,{id:'ac2-lagoon-outlet',poly:outlet.poly});
  const previous=w.fairLagoonBoatWater??[];
  delete w.fairLagoonBoatWater;
  const polys=[...lagoon.map(s=>s.poly),outlet.poly];
  const added=polys.map(poly=>{const c=poly.reduce((a,p)=>a.map((v,k)=>v+p[k]/poly.length),[0,0]);return poly.map(p=>p.map((v,k)=>c[k]+(v-c[k])*1.00001));});
  const signatures=new Set([...previous,...added].map(p=>JSON.stringify(p)));
  w.boatWater=(w.boatWater??[]).filter(p=>!signatures.has(JSON.stringify(p)));
  w.boatWater.push(...added);
 }
 const bridges=crossings.map(c=>{
  const line=c.id.startsWith('ribbon')?plan.channels[0]:c.id.startsWith('wishwater')?plan.channels[1]:plan.ring;
  const aim=({'northwest-heart':[457,1068],'southwest-heart':[765,3691]})[c.id]??[c.x,c.y];
  const i=line.reduce((best,p,j)=>Math.hypot(p[0]-aim[0],p[1]-aim[1])<Math.hypot(line[best][0]-aim[0],line[best][1]-aim[1])?j:best,0);
  const m=line[i],prev=line[(i+line.length-1)%line.length],next=line[(i+1)%line.length],t=[next[0]-prev[0],(next[1]-prev[1])/.62],normal=[-t[1],t[0]];
  let dir,best=-1;
  for(const [d,[a,b]] of Object.entries(BRIDGE_SILLS)){const v=[b[0]-a[0],(b[1]-a[1])/.62],dot=Math.abs((v[0]*normal[0]+v[1]*normal[1])/Math.hypot(...v)/Math.hypot(...normal));if(dot>best){dir=d;best=dot;}}
  let u=BRIDGE_SILLS[dir][1].map((v,k)=>v-BRIDGE_SILLS[dir][0][k]);
  if(dir==='ns')u=[0,-Math.max(c.h,350)];if(dir==='ew')u=[Math.max(c.w,420),0];
  return {id:c.id,a:m.map((v,k)=>v-u[k]/2),b:m.map((v,k)=>v+u[k]/2),w:112,boatPassUnder:true};
 });
 bridges.push({id:'ac2-lagoon-bridge',a:[3570,1441],b:[3570,1757.4],w:112,boatPassUnder:true});
 const arches=[],decks=[],landings=[];
 for(const b of bridges){
  const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],len=Math.hypot(dx,dy),u=[dx/len,dy/len];
  for(const [key,sign] of [['a',-1],['b',1]]){let step=0;while(world.water.some(s=>inShape(...b[key],s,24))&&step++<300){if(dx!==0&&dy!==0)throw Error(b.id+' diagonal landing needs a dry bank');b[key]=b[key].map((v,k)=>v+u[k]*sign*2);}}
  const {box,svg,crown,squash}=archBridge(b),src='bigger/arch-'+b.id+'.svg';
  fs.writeFileSync(A+src,svg);decks.push({id:b.id,src,x:box[0],y:box[1],width:box[2],height:box[3],overBoats:true,resolution:1.5});
  arches.push({...b,r:crown,...(squash?{squash}:{})});
  const half=dy===0?37.2:60,normal=dy===0?[0,1]:dx===0?[1,0]:[Math.SQRT1_2,Math.sign(-dx*dy)*.62*Math.SQRT1_2];
  for(const [key,sign] of [['a',-1],['b',1]]){
   const end=b[key],back=end.map((v,k)=>v+sign*u[k]*100);
   landings.push({id:b.id+'-'+key,end,back,width:half*2,laneWidth:104,poly:[end.map((v,k)=>v+normal[k]*half),end.map((v,k)=>v-normal[k]*half),back.map((v,k)=>v-normal[k]*52),back.map((v,k)=>v+normal[k]*52)]});
  }
 }
 art.decks=art.decks.filter(d=>!/^bigger\/(arch-|crossing-)/.test(d.src)&&d.id!=='ac2-lagoon-bridge');art.decks.push(...decks);
 art.props=art.props.filter(p=>p.id!=='ac2-islet-bridge');
 for(const w of [world,walk]){
  w.obstacles=w.obstacles.filter(p=>p.name!=='ac2-islet-bridge');
  w.walkways=bridges;w.bridges=bridges.map(b=>{
   const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1];
   const box={id:b.id,x:(b.a[0]+b.b[0])/2,y:(b.a[1]+b.b[1])/2,w:Math.abs(dx)+b.w,h:Math.abs(dy)+b.w};
   if(dx&&dy){const n=[Math.SQRT1_2,Math.sign(-dx*dy)*.62*Math.SQRT1_2],half=60;
    box.poly=[b.a.map((v,k)=>v+n[k]*half),b.a.map((v,k)=>v-n[k]*half),b.b.map((v,k)=>v-n[k]*half),b.b.map((v,k)=>v+n[k]*half)];}
   return box;
  });
 }
 const coast=bridges.find(b=>b.id==='wishwater-coast');
 const remap=line=>{if(line.some(p=>p[0]===coast.a[0]&&p[1]===coast.a[1]))return line;let done=false;return line.flatMap(p=>{if(p[0]>8200&&p[0]<8800&&p[1]>1480&&p[1]<1900){if(done)return [];done=true;return [coast.b,coast.a];}return [p];});};
 const expansion=read(S+'expansion.json');expansion.paths[0].line=remap(expansion.paths[0].line);save(S+'expansion.json',expansion);
 world.paths=world.paths.map(remap);save(D+'paths.json',world.paths);
 world.arches=arches;
 const toLocal=([x,y])=>[(x-3570)/4.3+768,(y-2220)/3.8+520];
 const local=outlet.outline.map(toLocal);
 const path=poly=>'M'+poly.map(p=>p.join(' ')).join('L')+'Z';
 const old=path(read(S+'centre-source/layout.json').polygons.lagoon);
 for(const t of art.ground.tiles){let svg=fs.readFileSync(A+t.src,'utf8');
  const banks=outlet.banklines.map(line=>'M'+line.map(toLocal).map(p=>p.join(' ')).join('L')).join(' ');
  const water=`<path id="fair-connected-lagoon" d="${path(local)}" fill="#6EC9DE"/><path id="fair-lagoon-banks" d="${banks}" fill="none" stroke="#39472d" stroke-width="1.6"/>`;
  const clip=`<clipPath id="fair-inner"><path d="${path(outlet.clip)}"/></clipPath>`;
  const next=svg.replace(/<path id="fair-lagoon-banks"[^>]*\/>/g,'').replace(/<clipPath id="fair-inner"><path d="[^"]*"\/><\/clipPath>/,clip).replace(new RegExp('<path id="fair-connected-lagoon"[^>]*/>'),water).replace(`<path d="${old}" fill="#6EC9DE" stroke="#39472d" stroke-width="1.6"/>`,water);
  if(next!==svg)fs.writeFileSync(A+t.src,next);
 }
 plan.bridges=bridges;plan.lagoon=outlet.lagoon.map((p,i)=>p.map((v,k)=>(v+outlet.islet[i][k])/2));plan.lagoonChannel=outlet.line;
 save(S+'bridge-landings.json',{fill:'#F6DE95',landings,waterCutout:outlet.poly,note:'Union these dry bridge throats into the SINGLE authoritative Home-system path shape; subtract the outlet from paths. No overlay painter.'});
 save(S+'centre-source/sailing.json',plan);save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
 console.log('Fair: 12 Home Honeywood bridges, connected castle lagoon; 24 throat polygons for the shared path union.');
}
if(process.argv[1]?.endsWith('/bridges.mjs'))applyFairBridges();
