// Close-up craft pass, repeatable from the Neon-only snapshot in concepts/work.
import fs from 'node:fs';
import {geometry,inPoly} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/neon/',D='assets/world/themes/neon/',B='../concepts/themes/work/neon/close-source/';
const read=n=>JSON.parse(fs.readFileSync(B+n+'.json'));
const art=read('art'),world=read('world'),walk=read('walk-world'),paths=world.paths;
const beds=JSON.parse(fs.readFileSync(A+'resolved-sleepers.json'));
const round=+(process.env.ROUND||1),r=n=>Math.round(n*10)/10;
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const head=(w,h,vb)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" stroke-linecap="round" stroke-linejoin="round">`;
const pt=(rad,a,k=1)=>[r(rad*Math.cos(a)),r(rad*Math.sin(a)*k)];
function wedge(ri,ro,a,b,k){const p=pt(ro,a,k),q=pt(ro,b,k),s=pt(ri,b,k),t=pt(ri,a,k);return `M${p} A${ro} ${r(ro*k)} 0 0 1 ${q} L${s} A${ri} ${r(ri*k)} 0 0 0 ${t}Z`;}
function paving(radii,k,{clock=false,small=false}={}){
 const out=[],palette=clock?(round>=2?['#E8BCB9','#EFCAC1','#E3B2B3','#ECC1BC']:['#ECC3BD','#F2D5C2','#E2AFB3','#F6DFCB']):['#FFF0BD','#F8E4A3','#FFF4CE','#EBDCAB'];
 for(let j=0;j<radii.length-1;j++){
  const ri=radii[j],ro=radii[j+1],count=Math.round(ro*(small?.13:.075)),shift=j%2?Math.PI/count:0;
  for(let i=0;i<count;i++){const a=i/count*2*Math.PI+shift,b=(i+1)/count*2*Math.PI+shift;
   const fill=clock&&round>=2&&(i+j*3)%11===0?'#F6DFCB':palette[(i+j*3)%palette.length];
   out.push(`<path d="${wedge(ri,ro,a,b,k)}" fill="${fill}" stroke="${clock?'#B58D8C':'#B4A270'}" stroke-width="1.4"/>`);
  }
 }
 return out.join('');
}
// Preserve the locked centre SVG and every centre manifest record. A separate floor
// inlay adds masonry at identical bounds and repeats the original zebra crossings.
const old=fs.readFileSync(A+'centre/decal-floor.svg','utf8');
const zebra=old.slice(old.indexOf('<g fill="#FFF0CA">'),old.lastIndexOf('</svg>'));
const k=488.8/806.8;
let floor=head(1621.6,985.6,'-810.8 -492.8 1621.6 985.6')+'<title>Clock crossing, rose stone rings and city markings</title>';
floor+='<ellipse rx="806.8" ry="488.8" fill="#F7E6BF" stroke="#766A7C" stroke-width="4"/>';
floor+=paving([18,210,320,430,535,635,718,782.8],k,{clock:true});
// Continuous cream ribbon with alternating mint/rose clock ticks on the outer rim.
floor+=`<ellipse rx="759" ry="${r(759*k)}" fill="none" stroke="#FFF0CA" stroke-width="18"/>`;
for(let i=0;i<60;i++){const a=i*Math.PI/30,[x,y]=pt(759,a,k),major=i%5===0;
 floor+=`<path d="M${pt(major?744:752,a,k)} L${pt(major?774:766,a,k)}" fill="none" stroke="${major?'#648E84':'#B58D8C'}" stroke-width="${major?8:2}"/>`;
 if(major&&round>=2){floor+=`<path d="M${x} ${y-6} l8 6 -8 6 -8 -6Z" fill="#F3CE6A" stroke="#8B8E68" stroke-width="1.5"/>`;}
}
// Cream crossing panels keep the legible four-way street motif from the pick.
floor+=zebra+'</svg>';
fs.writeFileSync(A+'close-clock-paving.svg',floor);
art.flats.push({src:'close-clock-paving.svg',x:3033.2,y:1771.2,width:1621.6,height:985.6,topLeft:true});
let ground=fs.readFileSync(B+'ground.svg','utf8'),details=[];
// Fine, staggered city pavement on the broad roads. This never changes a route.
const line=p=>'M'+p.map(q=>q.join(' ')).join(' L');
details.push('<defs><pattern id="close-street-tile" width="168" height="100" patternUnits="userSpaceOnUse"><path d="M0 0H168 M0 50H168 M42 0V50 M126 50V100" fill="none" stroke="#C8B77C" stroke-width="1.3"/><path d="M84 14h20 M22 70h16" stroke="#E9D490" stroke-width="2"/></pattern><mask id="close-road" maskUnits="userSpaceOnUse" x="0" y="0" width="7753" height="5166">');
for(const [i,p]of paths.entries())details.push(`<path d="${line(p)}" fill="none" stroke="white" stroke-width="${i<7?192:172}" stroke-linejoin="round" stroke-linecap="round"/>`);
for(const q of world.water)details.push(q.poly?`<path d="${line(q.poly)}Z" fill="black" stroke="black" stroke-width="18"/>`:`<ellipse cx="${q.x}" cy="${q.y}" rx="${q.rx+9}" ry="${q.ry+9}" fill="black"/>`);
// Market lawns were deliberately painted above the old roads. Preserve that order.
for(const [id,z]of Object.entries(world.zones))if(id.startsWith('stalls-'))details.push(`<path d="${line(z.poly)}Z" fill="black" stroke="black" stroke-width="8"/>`);
details.push('</mask></defs><rect width="7753" height="5166" fill="url(#close-street-tile)" mask="url(#close-road)"/>');
for(const [i,p]of paths.entries())if([2,3,4,11].includes(i))details.push(`<path d="${line(p)}" fill="none" stroke="#C4AB79" stroke-width="3" stroke-dasharray="25 63" stroke-linecap="round" mask="url(#close-road)"/>`);
// Activity areas stay mostly lawn, with a paved perimeter and small clock mosaic.
const lawns=Object.entries(world.zones).filter(([id])=>id.startsWith('activity-'));
for(const [id,z]of lawns){const kk=z.ry/z.rx;
 details.push(`<g transform="translate(${z.x} ${z.y})"><title>${id}: promenade, clock mosaic and open lawn</title>`);
 details.push(paving([z.rx-39,z.rx-18,z.rx],kk,{small:true}));
 details.push(`<ellipse rx="${z.rx-40}" ry="${r((z.rx-40)*kk)}" fill="none" stroke="#668A36" stroke-width="2.5"/>`);
 const rr=z.rx*.27;
 details.push(`<ellipse rx="${r(rr)}" ry="${r(rr*kk)}" fill="#F8E8AD" stroke="#B4A270" stroke-width="2"/>`);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;details.push(`<path d="M${pt(rr*.77,a,kk)} L${pt(rr*.92,a,kk)}" stroke="${i%3===0?'#7F9F89':'#C1A46F'}" stroke-width="${i%3===0?5:2}"/>`);}
 details.push(`<path d="M${pt(rr*.4,-Math.PI/2,kk)} L0 0 ${pt(rr*.6,.3,kk)}" fill="none" stroke="#937E61" stroke-width="3.5"/><ellipse rx="4" ry="3" fill="#937E61"/></g>`);
}
ground=ground.replace('</svg>',details.join('')+'</svg>');
// Remove only the small stamps that the new promenade or its medallion covers.
art.flats=art.flats.filter(f=>!/(grass|flower-dot|pebble)/.test(f.src)||!lawns.some(([,z])=>{const d=Math.hypot((f.x-z.x)/z.rx,(f.y-z.y)/z.ry);return d>.85&&d<1.02||d<.29}));
const bare=geometry({...walk,obstacles:[]});
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const pd=(x,y)=>Math.min(...paths.map(p=>Math.min(...p.slice(1).map((b,i)=>seg(x,y,p[i],b)))));
const reserved=(x,y)=>Object.entries(world.zones).some(([id,z])=>/^(activity|stalls)-/.test(id)&&(z.poly?inPoly(x,y,z.poly):((x-z.x)/z.rx)**2+((y-z.y)/z.ry)**2<1));
// Home-weight ink, flat ceramic pot, bright foliage and flowers, no effects.
fs.writeFileSync(A+'close-flower-pot.svg',head(100,134,'0 0 100 134')+`<title>Mint ceramic flower planter</title><g stroke="#45533D" stroke-width="2.5"><path d="M20 85L28 121Q50 136 72 121L80 85Z" fill="#6CB5A2"/><path d="M53 98L71 118L72 121Q51 133 28 121L25 110Q42 120 53 98" fill="#4A8F7C" stroke="none"/><ellipse cx="50" cy="85" rx="35" ry="12" fill="#B8DCA4"/><ellipse cx="50" cy="83" rx="27" ry="7" fill="#996E46"/><path d="M48 84V39 M35 81L24 50 M62 81L76 31" fill="none" stroke="#52833F" stroke-width="4"/><path d="M46 70Q20 73 24 59Q40 54 46 70 M56 61Q79 61 77 47Q62 45 56 61 M48 49Q31 51 33 37Q46 37 48 49" fill="#73B742"/><g fill="#EF94B4"><path d="M24 48C4 51 9 34 18 34C12 20 29 18 31 30C46 22 51 40 37 43C39 57 25 59 24 48Z"/><path d="M73 31C55 35 56 19 65 17C60 3 77 2 79 14C94 9 99 25 85 28C87 40 76 43 73 31Z"/></g><circle cx="26" cy="37" r="5" fill="#FFE481"/><circle cx="75" cy="22" r="5" fill="#FFE481"/><path d="M48 32C33 37 32 22 40 19C33 7 48 1 52 12C66 5 74 21 62 26C66 39 52 43 48 32Z" fill="#FFE481"/><circle cx="50" cy="23" r="5" fill="#EBA056"/><path d="M33 96L37 116" fill="none" stroke="#D7E9B9" stroke-width="4"/></g></svg>`);
const added=[];
function prop(src,x,y,scale=1){
 let t=src==='close-flower-pot.svg'?{name:'Flower planter',src,width:100,height:134,scale:.9,anchor:{x:.5,y:.98}}:art.props.find(p=>p.src===src);
 if(!t)return false;t={...t,x:r(x),y:r(y),scale:t.scale*scale,id:'neon-close-'+added.length,wind:false,flip:false};
 const rad=src==='neon-lamp.svg'?24:src==='sign-board.svg'?38:38;
 if(!bare.walkable(x,y)||!bare.walkable(x-rad,y)||!bare.walkable(x+rad,y)||reserved(x,y)||pd(x,y)<112+rad)return false;
 if(beds.some(b=>Math.hypot(x-b.x,(y-b.y)*1.5)<b.r+rad+50))return false;
 if(art.props.some(p=>!p.src.startsWith('centre/')&&Math.hypot(x-p.x,(y-p.y)*1.5)<Math.min(150,p.width*p.scale*.44)+rad+24))return false;
 art.props.push(t);walk.obstacles.push({x:t.x,y:t.y-4,rx:rad,ry:18,neonClose:true});added.push(t);return true;
}
// Paired planters and lamps around the plaza and lawn rims, leaving every mouth open.
for(const z of [world.zones.centre,...lawns.map(([,z])=>z)]){
 for(let i=0;i<16;i++){
  const a=(i*22.5+11.25)*Math.PI/180,x=z.x+(z.rx+67)*Math.cos(a),y=z.y+(z.ry+54)*Math.sin(a);
  prop(i%4===1?'neon-lamp.svg':'close-flower-pot.svg',x,y,i%4===1?.85:1);
 }
}
for(const [x,y]of [[3150,2600],[4550,2630],[3155,1940],[4550,1920]])prop('sign-board.svg',x,y,.8);
if(round>=3){
 // Tuck pots into the seating ring instead of letting props drift into the lawn.
 const c=world.zones.centre;
 for(const deg of [35,50,130,145,215,230,310,325]){
  const a=deg*Math.PI/180;prop('close-flower-pot.svg',c.x+Math.cos(a)*735,c.y+Math.sin(a)*735*k,.85);
 }
}
// Fine grass and stone companions at junction corners and along every avenue.
let seed=5291,tufts=0;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(const p of paths)for(let i=1;i<p.length-1;i+=2){
 const a=p[i-1],b=p[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
 for(const sign of [-1,1])for(let j=0;j<3;j++){
  const off=125+j*23+rnd()*17,x=p[i][0]-dy/len*sign*off+(rnd()-.5)*50,y=p[i][1]+dx/len*sign*off+(rnd()-.5)*35;
  if(!bare.walkable(x,y)||pd(x,y)<116||reserved(x,y)||world.water.some(q=>q.poly?inPoly(x,y,q.poly):((x-q.x)/(q.rx+30))**2+((y-q.y)/(q.ry+30))**2<1))continue;
  const c=world.zones.centre;if(((x-c.x)/(c.rx+25))**2+((y-c.y)/(c.ry+25))**2<1)continue;
  const src='reuse/'+(j===2?'pebble-1':j===1?'flower-dot-2':'grass-tuft-1')+'.svg',sample=art.flats.find(f=>f.src===src);
  if(art.flats.some(f=>Math.hypot(x-f.x,(y-f.y)*1.5)<20))continue;
  art.flats.push({...sample,x:r(x),y:r(y),flip:rnd()<.5});tufts++;
 }
}
world.obstacles=walk.obstacles;world.props=art.props;
fs.writeFileSync(A+'ground.svg',ground);
for(const t of art.ground.tiles)fs.writeFileSync(A+t.src,ground.replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,`width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}"`));
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'placements.json',art.props);
save(A+'close-metrics.json',{round,addedProps:added.map(p=>({id:p.id,src:p.src,x:p.x,y:p.y})),junctionDetails:tufts,props:art.props.length,decals:art.flats.length,patternedActivityRims:lawns.length,lockedCentreUnchanged:true});
console.log({round,addedProps:added.length,junctionDetails:tufts,props:art.props.length,decals:art.flats.length});
