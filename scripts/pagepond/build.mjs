// Rerunnable outer ground/water pass. Centre data and source art come from the
// checked-in original Library baseline, never from a previous generated result.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Path2D,PathOp,ring,curve,stroke,union,contours,dist,simplifyRing} from './geometry.mjs';
import {outer,roads,channels,groves,reserves} from './design.mjs';
const A='public/pixi-art/themes/library/',D='rive/web/themes/library/',B='scripts/bigger-library/original/';
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const old={art:read(B+'art.json'),world:read(B+'world.json'),walk:read(B+'walk-world.json')};
const before=read(A+'art.json'),worldBefore=read(D+'world.json');
fs.mkdirSync(A+'pagepond',{recursive:true});
const oldD=old.world.coastRings.map(ring).join(''),locked=new Path2D(oldD);
const expanded=old.world.coastRings.map((p,i)=>{
 const [a,b]=i===0?[76,260]:[35,220],points=[p[a-2],p[a-1],...outer[i],p[b],p[b+1]],extension=curve(points);
 // Keep the dense original canal edge exact. Only the sea-facing expansion uses cubic coast curves.
 return new Path2D(ring(p.slice(0,a)).slice(0,-1)+extension.slice(extension.indexOf('C'))+'L'+p.slice(b+1).map(p=>p.join(' ')).join('L')+'Z').op(new Path2D(ring(p)),PathOp.Union);
});
const coastRings=expanded.flatMap(p=>contours(p.toSVGString())),coast=coastRings.flatMap(r=>[...r,r[0],coastRings[0][0]]),land=union(expanded);
// Protect the old ground and its collision margin. River banks cannot eat the locked centres.
const protectedLand=union([locked,stroke(oldD,62)]);
function sample(points){const result=[];for(let i=0;i<points.length-1;i++){const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(i+2,points.length-1)],n=Math.max(8,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/16));for(let j=0;j<n;j++){const t=j/n;result.push(b.map((v,k)=>.5*(2*v+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t*t+(-a[k]+3*v-3*c[k]+d[k])*t*t*t)));}}result.push(points.at(-1));return result;}
const water=[];
for(const ch of channels){ch.samples=sample(ch.points);const left=[],right=[];for(let i=0;i<ch.samples.length;i++){const p=ch.samples[i],a=ch.samples[Math.max(0,i-1)],b=ch.samples[Math.min(ch.samples.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/l,ny=(b[0]-a[0])/l;left.push([p[0]+nx*p[2]/2,p[1]+ny*p[2]/2]);right.push([p[0]-nx*p[2]/2,p[1]-ny*p[2]/2]);}
 ch.shape=new Path2D(ring([...left,...right.reverse()])).op(protectedLand,PathOp.Difference).simplify();
 ch.poly=contours(ch.shape.toSVGString()).map(p=>simplifyRing(p,1));water.push(...ch.poly.map((poly,i)=>({name:ch.id+(i?'-'+i:''),poly})));
}
const rawWet=union(channels.map(c=>c.shape));
const rawDry=new Path2D(land).op(rawWet,PathOp.Difference);
// Reduce short tessellation edges before rounding: otherwise a 160-unit corner
// radius is limited by 8-unit sample edges and the mouth remains a right angle.
const smoothDry=union(contours(rawDry.toSVGString()).map(p=>new Path2D(ring(simplifyRing(p,12))).round(160)));
const dry=smoothDry.op(locked,PathOp.Union).simplify();
// Use three open river polygons for both boat and walking rules. Flattening a
// full coast difference would turn its dry-island holes into filled water shapes.
const wet=rawWet;
// Find each route/river intersection, then measure bank-to-bank along the route.
const crossings=[];
for(const road of roads){road.samples=sample(road.points);for(let i=0;i<road.samples.length-1;i++){const a=road.samples[i],b=road.samples[i+1];for(const ch of channels)for(let j=0;j<ch.samples.length-1;j++){const c=ch.samples[j],d=ch.samples[j+1],dx=b[0]-a[0],dy=b[1]-a[1],ex=d[0]-c[0],ey=d[1]-c[1],det=dx*ey-dy*ex;if(Math.abs(det)<1e-5)continue;const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/det,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/det;if(t<0||t>=1||u<0||u>=1)continue;const x=a[0]+t*dx,y=a[1]+t*dy;if(!wet.isPointInPath(x,y)||crossings.some(c=>Math.hypot(c.x-x,c.y-y)<180))continue;
 const angle=Math.atan2(dy,dx),cs=Math.cos(angle),sn=Math.sin(angle),W=road.width;
 const edge=sign=>{let length=0;for(const offset of [-W/2,0,W/2]){let s=0;while(s<1000&&wet.isPointInPath(x+sign*s*cs-offset*sn,y+sign*s*sn+offset*cs))s+=1;length=Math.max(length,s);}return length+7;};
 const n=edge(-1),p=edge(1),cx=x+(p-n)/2*cs,cy=y+(p-n)/2*sn;
 crossings.push({id:'bridge-'+crossings.length,road:road.id,channel:ch.id,x:cx,y:cy,angle,length:p+n,width:W,bankA:[x-n*cs,y-n*sn],bankB:[x+p*cs,y+p*sn],centreSource:'canal-bridge-north.svg'});
 }} }
if(crossings.length!==8)throw Error('Expected eight distinct main-route crossings, got '+crossings.length);
const floor=union(roads.map(r=>stroke(curve(r.points),r.width))).op(dry,PathOp.Intersect).simplify();
const onlyOuter=new Path2D('M-3000-2200H11000V8200H-3000Z').op(locked,PathOp.Difference),outerDry=new Path2D(dry).op(locked,PathOp.Difference);
const mask=`<defs><clipPath id="outer-only"><path d="${onlyOuter.toSVGString()}" clip-rule="evenodd"/></clipPath><clipPath id="dry"><path d="${dry.toSVGString()}" clip-rule="evenodd"/></clipPath></defs>`;
// Coast and riverbanks are one boolean land silhouette, so mouth shoulders have no cut edge.
let body=mask+'<g clip-path="url(#outer-only)" fill-rule="evenodd">';
// Cover only the obsolete exterior surf strip. The original tiles remain byte
// for byte ungrouped underneath; all new paint is excluded from locked land.
const oldSurf=stroke(oldD,380).op(locked,PathOp.Difference);
body+=`<path d="${oldSurf.toSVGString()}" fill="${old.art.sea}"/>`;
for(const [color,width] of [['#8FD6E6',92],['#B5E7F7',64],['#FDE48C',38]])body+=`<path d="${dry.toSVGString()}" fill="#93B72F" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`;
body+=`<path d="${dry.toSVGString()}" fill="#93B72F" stroke="#FFF4CB" stroke-width="5"/>`;
// Sparse cut-grass marks, clipped to dry lawn. Geometry remains vector at every zoom.
body+='<g clip-path="url(#dry)" opacity=".26" stroke="#759D31" stroke-width="2" fill="none">';
for(let row=0;row<47;row++)for(let col=0;col<60;col++){const x=-2600+col*219+(row%3)*63,y=-1700+row*188+(col%4)*19;if(!outerDry.isPointInPath(x,y))continue;body+=`<path d="M${x} ${y}l4-8 4 7m11 2 8-3 9 2"/>`;}
body+='</g>';
body+=`<path data-merged-paths="true" d="${floor.toSVGString()}" fill="#FFF0C7" stroke="#C9AF71" stroke-width="4" stroke-linejoin="round"/>`;
// Water is the sea showing through the land cutout. No opaque blue rectangles or stubs.
body+='</g>';
fs.writeFileSync(A+'pagepond/outer-source.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3000 -2200 14000 10400">${body}</svg>`);
const tiles=[];
for(let row=0;row<8;row++)for(let col=0;col<10;col++){const x=-3000+col*1400,y=-2200+row*1300,src=`bigger/ground-${row}-${col}.svg`;fs.writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="650" viewBox="${x} ${y} 1400 1300" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`);tiles.push({src,x,y,width:1400,height:1300,resolution:1});}
// Original tile paint remains unmodified. The vector expansion follows these
// tiles in the manifest and covers obsolete surf only OUTSIDE the locked land.
for(const t of old.art.ground.tiles){const src='bigger/original-'+t.src;let svg=fs.readFileSync(B+'ground.svg','utf8').replace(/<svg\b[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}" stroke-linecap="round" stroke-linejoin="round">`).replace(/<rect[^>]*fill="url\(#sea-ripples\)"[^>]*\/>/g,'').replace(/<path\b[^>]*fill="#8FD6E6"[^>]*\/>/g,'');const open=svg.match(/<svg\b[^>]*>/)[0],content=svg.slice(svg.indexOf(open)+open.length).replace(/<\/svg>\s*$/,'');fs.writeFileSync(A+src,open+content+'</svg>');tiles.push({...t,src});}
const extras=[],obstacles=[];
for(const [gi,group]of groves.entries())for(const [pi,tuple]of group.entries()){const [species,x,y,scale]=tuple,t=old.art.props.find(p=>p.src===`reuse/tree-${species}.svg`),p={...t,id:`pagepond-grove-${gi}-${pi}`,x,y,scale,flip:(pi+gi)%2===0,zone:'outer-grove'};extras.push(p);obstacles.push({name:p.id,x,y:y-10,rx:Math.max(20,p.width*scale*.16),ry:Math.max(14,p.width*scale*.065)});}
// Contact shrubs use the island's own bushes, deliberately at grove feet.
for(const [gi,group]of groves.entries()){const [,,y]=group[0],[,x]=group[0],t=old.art.props.find(p=>p.src==='reuse/bush-1.svg');if(t)extras.push({...t,id:`pagepond-understory-${gi}`,x:x+160,y:y+115,scale:.8,zone:'outer-grove'});}
const plan={version:1,origin:{x:-3000,y:-2200},width:14000,height:10400,reserves,roads:roads.map(({samples,...r})=>r),channels:channels.map(({id,points,poly})=>({id,points,poly})),crossings,groves,removedProps:before.props.filter(p=>!old.art.props.some(o=>o.id===p.id)&&!p.id.startsWith('pagepond-')).map(p=>p.id),centre:{props:old.art.props.length,flats:old.art.flats.length,tiles:old.art.ground.tiles.length},floor:floor.toSVGString(),dry:dry.toSVGString()};
write('scripts/pagepond/layout.json',plan);
execFileSync('python3',['scripts/pagepond/bridge.py'],{stdio:'inherit'});
const layout=read('scripts/pagepond/layout.json'),decks=[...old.art.decks];
// Collision rectangles tile the visible ground-plane deck and stop at its bank landings.
const bridgeAreas=[];
for(const c of layout.crossings){const [x,y,width,height]=c.viewports.back,src=`pagepond/${c.id}-back.svg`;decks.push({id:c.id,src,x,y,width,height});const [fx,fy,fw,fh]=c.viewports.front;extras.push({id:c.id+'-rail',name:'Arched bridge front rail',src:`pagepond/${c.id}-front.svg`,x:fx+fw/2,y:fy+fh,width:fw,height:fh,anchor:{x:.5,y:1},scale:1,z:c.y+c.width/2,shadow:false,zone:'outer-bridge'});
 const cs=Math.cos(c.angle),sn=Math.sin(c.angle),L=c.length/2+24,W=c.width/2,poly=[[-L,-W],[L,-W],[L,W],[-L,W]].map(([u,v])=>[c.x+u*cs-v*sn,c.y+u*sn+v*cs]);c.footprint=poly;
 const min=Math.min(...poly.map(p=>p[1])),max=Math.max(...poly.map(p=>p[1])),n=Math.ceil((max-min)/8),step=(max-min)/n;
 const interval=y=>{const xs=[];for(let j=0;j<4;j++){const a=poly[j],b=poly[(j+1)%4];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}return xs.sort((a,b)=>a-b);};
 for(let i=0;i<n;i++){const y=min+(i+.5)*step,a=interval(y-step/2+.01),b=interval(y+step/2-.01);if(a.length<2||b.length<2)continue;const left=Math.max(a[0],b[0]),right=Math.min(a[1],b[1]);if(right-left>4)bridgeAreas.push({name:c.id,x:(left+right)/2,y,w:right-left+16,h:step+24.02});}
}
// The three old jetties keep exactly their original visible strips, including when inside river water.
const jetties=old.world.walkways.slice(2,5).map((b,i)=>({name:['west-jetty','east-jetty','south-jetty'][i],x:(b.a[0]+b.b[0])/2,y:(b.a[1]+b.b[1])/2,w:Math.abs(b.a[0]-b.b[0])+b.w+16,h:Math.abs(b.a[1]-b.b[1])+b.w+24}));
const art={...old.art,origin:plan.origin,width:plan.width,height:plan.height,ground:{...old.art.ground,tiles:[...tiles.slice(80),...tiles.slice(0,80)]},decks,props:[...old.art.props,...extras]};
const zones={...old.world.zones,...Object.fromEntries(Object.entries(worldBefore.zones).filter(([id])=>id.startsWith('bigger-')))};
const raised=layout.crossings.map(c=>({id:c.id,a:c.bankA,b:c.bankB,w:c.width,boatPassUnder:true}));
const common={walkways:[...old.world.walkways,...raised],origin:plan.origin,width:plan.width,height:plan.height,coast,coastRings,water:[...old.world.water,...water],boatWater:water.map(w=>w.poly),bridges:[...old.world.bridges,...jetties,...bridgeAreas],obstacles:[...old.world.obstacles,...obstacles]};
const world={...old.world,...common,zones,props:art.props},walk={...old.walk,...common};
write(A+'art.json',art);write(D+'world.json',world);write(D+'walk-world.json',walk);write(D+'placements.json',art.props);write('scripts/pagepond/layout.json',layout);
// The older expansion plan remains a compatibility index, now describing empty hamlet reserves.
const oldPlan=read('scripts/bigger-library/plan.json');write('scripts/bigger-library/plan.json',{...oldPlan,homes:[],roads:plan.roads,coastRoads:[],lanes:plan.roads.map(r=>r.points),crossings:layout.crossings,channels:plan.channels,newProps:extras.length,newObstacles:obstacles.length,status:'ground-water-ready-for-approved-hamlets'});
const lockFiles=[...new Set([...old.art.props,...old.art.flats,...old.art.decks,...old.art.floating,...old.art.ground.tiles].map(p=>p.src))];
const hashes=Object.fromEntries(lockFiles.filter(src=>fs.existsSync(A+src)).map(src=>[src,createHash('sha256').update(fs.readFileSync(A+src)).digest('hex')]));
if(!fs.existsSync('scripts/pagepond/centre-lock.json'))write('scripts/pagepond/centre-lock.json',hashes);
console.log(`Pagepond: 80 vector tiles, ${layout.crossings.length} arched crossings, ${extras.length-layout.crossings.length} OG plants; both centres locked.`);
