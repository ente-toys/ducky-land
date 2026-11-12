// Geometry shared by terrain generation, navigation and the junction regression.
import {Path2D,PathOp,StrokeCap,StrokeJoin} from '@napi-rs/canvas';
import {lakeOutline} from './lake.mjs';
import {inPoly} from '../../assets/world/island-geometry.mjs';
export const SHORE_WIDTH=24, LIP_WIDTH=12;
const round=n=>Math.round(n*100)/100;
const point=p=>p.map(round);
export function shoreDistance(p,poly){
 let d=Infinity;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  d=Math.min(d,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
 }
 return inPoly(...p,poly)?-d:d;
}
// The authored terrain uses absolute M/L/Q/C commands. Flatten at <=4 units,
// including control-polygon length, so collision checks cannot skip a cove.
export function pathSamples(d,spacing=4){
 const tokens=d.match(/[MLQCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi),out=[];let at=0,p;
 while(at<tokens.length){
  const cmd=tokens[at++];if(cmd==='Z')continue;const n={M:2,L:2,Q:4,C:6}[cmd];
  if(!n)throw Error('Unsupported terrain command '+cmd);
  const v=tokens.slice(at,at+n).map(Number);at+=n;
  const q=Array.from({length:n/2},(_,i)=>v.slice(i*2,i*2+2));
  if(cmd==='M'){p=q[0];out.push(p);continue;}
  const controls=[p,...q],length=controls.slice(1).reduce((s,b,i)=>s+Math.hypot(b[0]-controls[i][0],b[1]-controls[i][1]),0),steps=Math.max(1,spacing?Math.ceil(length/spacing):(cmd==='L'?1:12));
  for(let j=1;j<=steps;j++){
   let a=controls.map(p=>[...p]);const t=j/steps;
   while(a.length>1)a=a.slice(1).map((b,i)=>[a[i][0]*(1-t)+b[0]*t,a[i][1]*(1-t)+b[1]*t]);
   out.push(point(a[0]));
  }
  p=q.at(-1);
 }
 return out;
}
export function prepareLakeJunctions(terrain,world){
 const routes=world.iceland2.routes,ice=world.iceland2.rink;
 const originals=[...terrain.matchAll(/<path\b[^>]*stroke="#a6deec"[^>]*\/>/g)].map(m=>m[0]);
 if(![routes.length,routes.length+3].includes(originals.length))throw Error('Unexpected terrain routes');
 const anchors={'north-shore':[6978.94,4776.19],'west-shore':[6434.25,5113.62],'south-shore':[6978.94,5451.05]};
 const normals={'north-shore':[0,-1],'west-shore':[-1,0],'south-shore':[0,1]};
 const landings=Object.entries(anchors).map(([id,anchor])=>{
  const width=Math.max(...routes.filter(r=>r.ends.includes(id)).map(r=>r.width)),radius=width/2+12,normal=normals[id];
  let lo=0,hi=400;
  for(let i=0;i<40;i++){const t=(lo+hi)/2,p=anchor.map((n,j)=>n+normal[j]*t);if(shoreDistance(p,ice.poly)<radius+SHORE_WIDTH)lo=t;else hi=t;}
  const center=point(anchor.map((n,j)=>n+normal[j]*hi));
  world.iceland2.shores[id]=center;world.iceland2.nodes[id]=center;
  return {id,anchor,center,normal,width,radius,lip:LIP_WIDTH};
 });
 const paths=routes.map((route,i)=>{
  const original=originals[i],source=original.match(/data-source-d="([^"]+)"/)?.[1]??original.match(/\bd="([^"]+)"/)[1];
  let d=source;
  for(const landing of landings.filter(l=>route.ends.includes(l.id))){
   const delta=landing.center.map((n,j)=>n-landing.anchor[j]);
   d=d.replace(/(-?\d*\.?\d+(?:e[-+]?\d+)?)\s+(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi,(_,x,y)=>{
    const p=[+x,+y],t=Math.max(0,1-Math.hypot(p[0]-landing.anchor[0],p[1]-landing.anchor[1])/400),s=t*t*(3-2*t);
    return point(p.map((n,j)=>n+delta[j]*s)).join(' ');
   });
   route.samples=pathSamples(d,0);
   route.samples[route.ends[0]===landing.id?0:route.samples.length-1]=[...landing.center];
   world.paths[i]=structuredClone(route.samples);
  }
  return `<path d="${d}" fill="none" stroke="#a6deec" stroke-width="${route.width}" stroke-linecap="round" stroke-linejoin="round"${d!==source?` data-source-d="${source}"`:''}/>`;
 });
 // The old rink's rectangular knockout and its three butt-capped gate stubs
 // must disappear, rather than cutting new routes underneath the lake sprite.
 terrain=terrain.replace(/<rect\b[^>]*x="6399\.252236043941"[^>]*\/>/g,'');
 for(let i=0;i<originals.length;i++)terrain=terrain.replace(originals[i],paths[i]??'');
 // Build one surface before outlining: the snow lips follow only its exterior.
 // The short lake extensions end at the mouths, so ordinary paths remain dry
 // walking while the exact same visible ice immediately activates the slide.
 const lake=new Path2D(lakeOutline().d).transform({a:1,b:0,c:0,d:1,e:ice.x,f:ice.y});
 let mouths=new Path2D(lake);
 for(const l of landings){
  const n=l.normal,t=[-n[1],n[0]],half=l.width/2;
  const p=(depth,side)=>l.center.map((v,j)=>v-n[j]*depth+t[j]*side);
  const corners=[p(-4,-half),p(-4,half),p(320,half),p(320,-half)];
  mouths=mouths.op(new Path2D('M'+corners.map(p=>p.join(' ')).join('L')+'Z'),PathOp.Union);
 }
 const offset={width:80,cap:StrokeCap.Round,join:StrokeJoin.Round};
 const close=shape=>{const grown=shape.op(new Path2D(shape).stroke(offset),PathOp.Union);return grown.op(new Path2D(grown).stroke(offset),PathOp.Difference).simplify();};
 const lakeSurface=close(mouths),lakeD=lakeSurface.toSVGString();
 ice.poly=pathSamples(lakeD,2);
 const [x,y,x1,y1]=lakeSurface.computeTightBounds();
 Object.assign(ice,{x:round(x),y:round(y),width:round(x1-x),height:round(y1-y)});
 let union=new Path2D(lakeSurface);
 for(let i=0;i<routes.length;i++)if(routes[i].ends.some(id=>anchors[id])){
  const d=paths[i].match(/\bd="([^"]+)"/)[1];
  union=union.op(new Path2D(d).stroke({width:routes[i].width,cap:StrokeCap.Round,join:StrokeJoin.Round}),PathOp.Union);
 }
 // Closing fills concave forks and gives every path/lake shoulder a soft flare.
 const unionD=close(union).toSVGString();
 return {terrain,paths,landings,unionD,lakeD};
}
