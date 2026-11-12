import fs from 'node:fs';
import {geometry, inPoly} from '../../assets/world/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {resolveSleepSpots, sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {checkTheme} from '../theme-index.mjs';
const A='public/pixi-art/themes/neon/', D='assets/world/themes/neon/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const art=read(A+'art.json'), world=read(D+'world.json'), walk=read(D+'walk-world.json'), harbor=read(D+'harbor.json');
const placements=read(D+'placements.json');
for(const file of fs.readdirSync(A+'reuse').filter(f=>f.endsWith('.svg'))){
 let source=fs.readFileSync(A+'reuse/'+file,'utf8');
 const fills=new Map();
 source=source.replace(/<(linearGradient|radialGradient)\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g,(_,tag,id,body)=>{
  const stops=[...body.matchAll(/stop-color="([^"]+)"/g)];
  if(stops.length)fills.set(id,stops[Math.min(1,stops.length-1)][1]);
  return '';
 });
 for(const [id,fill]of fills)source=source.split(`url(#${id})`).join(fill);
 fs.writeFileSync(A+'reuse/'+file,source);
}
const c=world.zones.centre, ox=c.x, oy=c.y;
const svg=(name,vb,body)=>{
  const [x,y,w,h]=vb;
  fs.writeFileSync(A+'centre/'+name+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb.join(' ')}"><title>Tickytown ${name}</title>${body}</svg>\n`);
  return {id:name,file:name+'.svg',x,y,width:w,height:h,anchor:{x:0,y:0},at:[x,y]};
};
const rx=c.rx-12, ry=c.ry-8;
const floor=[];
floor.push(`<ellipse rx="${rx}" ry="${ry}" fill="#F7E6BF" stroke="#766A7C" stroke-width="4"/>`);
floor.push(`<ellipse rx="${rx-20}" ry="${ry-16}" fill="#E6ACB3" stroke="#C589A0" stroke-width="3"/>`);
floor.push(`<defs><clipPath id="plaza"><ellipse rx="${rx-24}" ry="${ry-20}"/></clipPath></defs><g clip-path="url(#plaza)" fill="none" stroke="#D99EA9" stroke-width="2">`);
for(let x=-1800;x<1800;x+=100) floor.push(`<path d="M${x} -600 l1200 1200 M${x} -600 l-1200 1200"/>`);
floor.push('</g><g fill="#FFF0CA">');
for(let y=-ry+36;y<ry-20;y+=64) if(Math.abs(y)>160) floor.push(`<path d="M-136 ${y} h272 v34 h-272Z"/>`);
for(let x=-rx+34;x<rx-24;x+=64) if(Math.abs(x)>265) floor.push(`<path d="M${x} -83 h33 v166 h-33Z"/>`);
floor.push('</g>');
const floorPiece={...svg('decal-floor',[-rx-4,-ry-4,2*rx+8,2*ry+8],floor.join('')),layer:'decal',note:'Flat pink paving, cream ring and four zebra crossings. No glow.'};

const tower=fs.readFileSync(A+'centre/tower.svg','utf8');
const box=tower.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const th=900, tw=+(th*box[2]/box[3]).toFixed(1), top=-820, left=-tw/2;
const faces=[];
for(const [cx,angle,hour] of [[232,-14,0],[413,14,2]]){
 const cy=505;
 faces.push(`<g transform="rotate(${angle} ${cx} ${cy})"><ellipse cx="${cx}" cy="${cy}" rx="65" ry="74" fill="#FFF0C7" stroke="#B86F22" stroke-width="4"/>`);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  faces.push(`<path d="M${cx+Math.sin(a)*53} ${cy-Math.cos(a)*62} L${cx+Math.sin(a)*48} ${cy-Math.cos(a)*56}" fill="none" stroke="#88551D" stroke-width="3.5" stroke-linecap="round"/>`);
 }
 const a=hour*Math.PI/6;
 faces.push(`<path d="M${cx} ${cy-39} V${cy} L${cx+Math.sin(a)*30} ${cy-Math.cos(a)*32}" fill="none" stroke="#704D24" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="#F0BA48" stroke="#704D24" stroke-width="3"/></g>`);
}
const inner='<path d="M232 946 V738 Q243 693 321 692 Q399 694 410 738 V946Z" fill="#967982"/>'+tower.replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/,'')+faces.join('');
const split=box[3]*.927;
function towerPart(name,front){
  fs.writeFileSync(A+'centre/'+name+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}" viewBox="${box.join(' ')}"><title>Tickytown clock ${front?'front step':'body'}</title><defs><clipPath id="cut"><rect x="0" y="${front?split:0}" width="${box[2]}" height="${front?box[3]-split:split}"/></clipPath></defs><g clip-path="url(#cut)">${inner}</g></svg>`);
  const sy=front?80:32;
  return {id:name,file:name+'.svg',layer:front?'front':'sorted',x:left,y:top,width:tw,height:th,anchor:{x:.5,y:(sy-top)/th},at:[0,sy],sortY:sy};
}
const body=towerPart('tower-body',false), front=towerPart('tower-front',true);
const centre={theme:'neon',name:'Tickytown clock crossing',concept:'concepts/themes/next-centres/neon-centre-1.png',origin:'centre of the pink crossing',depthRatio:ry/rx,pieces:[floorPiece,body,front],outerEdge:{ellipse:{x:0,y:0,rx,ry}},walkable:[{ellipse:{x:0,y:0,rx:rx-20,ry:ry-16}}],blocked:[{ellipse:{x:0,y:8,rx:tw*.47,ry:83}}],stairs:[],spawn:[0,ry-70],capacity:{duckies:100,note:'Island capacity. The open crossing is connected to four activity areas and three reserved stall rows.'}};
save(A+'centre/centre.json',centre);
art.props=art.props.filter(p=>p.id!=='neon-0'&&!p.id.startsWith('neon-centre-'));
art.flats=art.flats.filter(p=>!p.src.startsWith('centre/'));
art.flats.push({src:'centre/decal-floor.svg',x:ox+floorPiece.x,y:oy+floorPiece.y,width:floorPiece.width,height:floorPiece.height,topLeft:true});
for(const p of [body,front]) art.props.push({id:'neon-centre-'+p.id,name:front===p?'Clock tower front step':'Twin clock tower',src:'centre/'+p.file,x:ox+p.at[0],y:oy+p.sortY,width:p.width,height:p.height,anchor:p.anchor,scale:1,shadow:false,sortY:oy+p.sortY});
const old=placements.find(p=>p.id==='neon-0');
walk.obstacles=walk.obstacles.filter(o=>!o.neonCentre && !(old && o.x===old.x && Math.abs(o.y-(old.y-old.width*old.scale*.2))<1));
walk.obstacles.push({x:ox,y:oy+8,rx:tw*.47,ry:83,neonCentre:true});
world.paths=read(D+'paths.json'); walk.paths=world.paths;
world.zones.centre={...c,name:'Clock crossing',landmark:'neon-centre-tower-body',placeholder:false,lockedConcept:centre.concept};
world.ambient={birds:[[ox-1000,oy-1000],[ox+1500,oy-900],[ox-2100,oy],[ox+1700,oy+600],[ox-1200,oy+1300],[ox+800,oy+1500]],butterflies:[[world.zones['flower-park'].x,world.zones['flower-park'].y],[world.zones['pond-park'].x,world.zones['pond-park'].y]]};
world.obstacles=walk.obstacles;
world.props=art.props.map(({id,name,x,y,width,height,anchor,scale,src})=>({id,name,x,y,width,height,anchor,scale,src}));

const nav=geometry(walk), sizes=sleepHalfWidths(), out=[], spots={};
let seed=5215; const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const counts={nod:6,hammock:3,rock:4,leaf:6,book:6,chair:3,wing:7,box:5};
const dist=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
const pathNear=(x,y,r)=>world.paths.some(l=>l.slice(1).some((b,i)=>dist(x,y,l[i],b)<125+r*.7+12));
const avoid=(x,y,r)=>world.sleepAvoid.some(e=>((x-e.x)/(e.rx+r*.35))**2+((y-e.y)/(e.ry+25))**2<1);
function add(pose,spot){
 const tree=pose==='nod'?art.props.find(p=>p.id===spot[0]):null;
 const [x,y]=tree?[tree.x+spot[1],tree.y+14]:spot,r=sizes[pose];
 if(pathNear(x,y,r)||avoid(x,y,r))return false;
 if(out.some(s=>Math.hypot(s.x-x,(s.y-y)*1.3)<Math.max(300,s.r+r+100)+12 || (s.pose===pose&&Math.hypot(s.x-x,s.y-y)<(pose==='chair'?850:900)+12))) return false;
 if(tree && (!nav.walkable(x-r*.8,y+35)||!nav.walkable(x+r*.8,y+35)||!nav.walkable(x,y+40)))return false;
 const got=resolveSleepSpots(walk,art.props,nav.walkable,sizes,{spots:{[pose]:[spot]},avoid:world.sleepAvoid,warn:false});
 if(!got.length)return false;
 if(tree && art.props.some(p=>p!==tree && p.y>y-20&&p.y-y<p.height*(p.scale??1)*.85&&Math.abs(x-p.x)<p.width*(p.scale??1)/2+r*.6))return false;
 spots[pose].push(spot);out.push(got[0]);return true;
}
for(const pose of ['nod','chair','hammock','book','rock','leaf','box','wing']){
 spots[pose]=[];
 if(pose==='nod'){
  for(const tree of art.props.filter(p=>/tree/i.test(p.name)).sort(()=>rnd()-.5)){
   if(spots[pose].length===counts[pose])break;
   add(pose,[tree.id,0,rnd()<.5]);
  }
 }else{
  for(const s of world.sleepSpots[pose]??[]){if(spots[pose].length===counts[pose])break;add(pose,s);}
  for(let i=0;i<80000&&spots[pose].length<counts[pose];i++){
   const x=Math.round(500+rnd()*(world.width-1000)), y=Math.round(600+rnd()*(world.height-1200));
   if(!nav.walkable(x,y)||!inPoly(x,y,world.coast))continue;
   const fitting=art.props.some(p=>/tree|bush|bench|shop|cafe|kiosk|seat|planter|rock|cabinet/i.test(p.name)&&Math.hypot(x-p.x,y-p.y)<480);
   if(!fitting)continue;
   add(pose,[x,y,rnd()<.5]);
  }
 }
}
world.sleepSpots=spots;
save(A+'art.json',art); save(D+'world.json',world); save(D+'walk-world.json',walk);
save(D+'placements.json',art.props.map(p=>({...placements.find(old=>old.id===p.id),...p})));
save(A+'resolved-sleepers.json',out.map(({tree,...b})=>({...b,...(tree?{tree}: {})})));
const report=checkTheme('neon');
const map=makeMap('neon',{world,walk,harbor,art:'/pixi-art/themes/neon/art.json',sleepers:report.sleepers});
const n=map.nav();
const routes=Object.entries(world.zones).map(([name,z])=>({name,walkable:n.walkable(...z.spawn),reachable:!!n.route(map.spawn.x,map.spawn.y,...z.spawn).length||n.clearLine([map.spawn.x,map.spawn.y],z.spawn)}));
const land=Math.abs(world.coast.reduce((s,p,i)=>{const q=world.coast[(i+1)%world.coast.length];return s+p[0]*q[1]-q[0]*p[1]},0))/2;
const [hx,hy]=harbor.jetty.foot, [,ty]=harbor.jetty.tip, hw=harbor.jetty.width;
const harborParts=[`<rect x="${hx-hw/2}" y="${hy}" width="${hw}" height="${ty-hy}" fill="#C99548" stroke="#55513B" stroke-width="3"/>`];
for(let y=hy+24;y<ty;y+=26)harborParts.push(`<path d="M${hx-hw/2} ${y} h${hw}" stroke="#987336" stroke-width="2"/>`);
for(const x of [hx-hw/2,hx+hw/2])for(let y=hy+10;y<ty;y+=105)harborParts.push(`<rect x="${x-6}" y="${y-10}" width="12" height="30" rx="3" fill="#9A743E" stroke="#55513B" stroke-width="2"/><ellipse cx="${x}" cy="${y-9}" rx="6" ry="3" fill="#F9E9BD"/>`);
const hp={src:'harbor-preview.svg',x:hx-hw/2-16,y:hy-20,width:hw+32,height:ty-hy+40};
fs.writeFileSync(A+hp.src,`<svg xmlns="http://www.w3.org/2000/svg" width="${hp.width}" height="${hp.height}" viewBox="${hp.x} ${hp.y} ${hp.width} ${hp.height}"><title>Tickytown harbour preview deck, game draws its own</title>${harborParts.join('')}</svg>`);
const metrics={theme:'neon',name:world.name,width:world.width,height:world.height,coastArea:land,homeLandRatio:land/11090000,props:art.props.length,groundTiles:art.ground.tiles.length,pathsWidth:{main:250,minor:200},activityAreas:4,stallRows:3,sleepRequested:Object.values(spots).reduce((s,a)=>s+a.length,0),sleepResolved:report.sleepers?.length,counts:Object.fromEntries(Object.entries(spots).map(([k,v])=>[k,v.length])),ready:report.ready,problems:report.problems,sleepNotes:report.sleepNotes,routes};
metrics.previewHarbor=hp;
save(A+'build-metrics.json',metrics);
console.log(`${report.ready?'READY':'FAIL'} neon: ${world.width} x ${world.height}, ${(land/1e6).toFixed(2)}M land, ${report.sleepers?.length}/40 sleepers, ${routes.filter(r=>r.walkable&&r.reachable).length}/${routes.length} zones reachable`);
if(report.problems.length)console.log(report.problems);
if(!report.ready||report.sleepers?.length!==40||routes.some(r=>!r.walkable||!r.reachable))process.exitCode=1;
