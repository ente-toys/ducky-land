// Repeatable HOME-quality pass. Only Neon files are written.
// Run after neon-world + neon-finish, or rerun from the saved pre-polish source.
import fs from 'node:fs';
import {geometry,inPoly} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/neon/',D='assets/world/themes/neon/',B=A+'polish-source/';
fs.mkdirSync(B,{recursive:true});
const files={art:A+'art.json',world:D+'world.json',walk:D+'walk-world.json',placements:D+'placements.json',beds:A+'resolved-sleepers.json'};
for(const [key,file]of Object.entries(files))if(!fs.existsSync(B+key+'.json'))fs.copyFileSync(file,B+key+'.json');
if(!fs.existsSync(B+'ground.svg'))fs.copyFileSync(A+'ground.svg',B+'ground.svg');
const read=n=>JSON.parse(fs.readFileSync(B+n+'.json','utf8'));
const art=read('art'),world=read('world'),walk=read('walk'),beds=read('beds'),placements=read('placements');
const save=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,1)+'\n');
let ground=fs.readFileSync(B+'ground.svg','utf8');
let seed=5253;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const r=n=>Math.round(n*10)/10;
const dz=p=>'M'+p.map(q=>q.map(r).join(' ')).join(' L')+' Z';
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2;
const offset=(p,d)=>{const sgn=Math.sign(area(p));return p.map((a,i)=>{const b=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length],dx=c[0]-b[0],dy=c[1]-b[1],l=Math.hypot(dx,dy);return [a[0]-sgn*dy/l*d,a[1]+sgn*dx/l*d]})};
const dist=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const lineDist=(x,y,l)=>Math.min(...l.slice(1).map((b,i)=>dist(x,y,l[i],b)));
const zones=Object.entries(world.zones).filter(([id])=>/^(activity|stalls)-/.test(id));
const reserved=(x,y,pad=0)=>zones.some(([,z])=>z.poly?(inPoly(x,y,z.poly)||lineDist(x,y,[...z.poly,z.poly[0]])<pad):((x-z.x)/(z.rx+pad))**2+((y-z.y)/(z.ry+pad))**2<1);
const paths=world.paths;
const pathNear=(x,y,pad)=>paths.some((p,i)=>lineDist(x,y,p)<([0,1,2,3,4,5,6].includes(i)?100:90)+pad);
const bare=geometry({...walk,obstacles:[]}),inland=offset(world.coast,90);
const waterMargin=world.water.map(q=>q.poly?offset(q.poly,-150):null);
const centre=world.zones.centre;
// A small HOME wooden dock enters the pond from its quiet west bank.
{
 const pond=world.water[0],J={a:[5034.08,1638.41],b:[5469.9,1681.99],vb:[5004.9592,1492.5089,494.0617,277.2587]};
 const at=[pond.x-pond.rx-70,pond.y+50],sx=.38,sy=1;
 const map=([x,y])=>[at[0]+(x-J.a[0])*sx,at[1]+y-J.a[1]];
 const [x,y]=map(J.vb),width=J.vb[2]*sx,height=J.vb[3],b=map(J.b);
 const inner=fs.readFileSync('public/pixi-art/bridge-jetty-5.svg','utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 fs.writeFileSync(A+'pond-dock.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}"><g transform="translate(${at.join(' ')}) scale(${sx} ${sy}) translate(${-J.a[0]} ${-J.a[1]})">${inner}</g></svg>`);
 art.decks.push({src:'pond-dock.svg',x,y,width,height});
 const walkway={a:at,b,w:84};world.walkways.push(walkway);walk.walkways.push(walkway);
 // Inland water requires a bridge footprint as well as the deck walkway.
 const bridge={x:(at[0]+b[0])/2,y:(at[1]+b[1])/2,w:b[0]-at[0]+76,h:b[1]-at[1]+72};
 world.bridges.push(bridge);walk.bridges.push(bridge);
}
const isTree=p=>/reuse\/(?:tree-[1-5]|nature--tree-)/.test(p.src);
const isCoreTree=p=>/reuse\/tree-[1-5]\.svg/.test(p.src);
const isShop=p=>/^shop-/.test(p.src);
const width=p=>p.width*p.scale,height=p=>p.height*p.scale;

// Warm sand shore and HOME's water. Geometry, area and docking stay exact.
const shore=[];
for(const [d,w,col,alpha]of [[-130,80,'#9EDEE5',.35],[-65,60,'#99E0E8',.8],[-25,22,'#B7ECED',.9],[-16,7,'#FFF0C7',1]])shore.push(`<path d="${dz(offset(world.coast,d))}" fill="none" stroke="${col}" stroke-width="${w}" opacity="${alpha}"/>`);
for(const [x,y,rx,ry]of world.islets)for(const [pad,w,col]of [[110,32,'#9ADFE7'],[65,20,'#B7ECED'],[24,7,'#FFF0C7']])shore.push(`<ellipse cx="${x}" cy="${y}" rx="${rx+pad}" ry="${ry+pad*.7}" fill="none" stroke="${col}" stroke-width="${w}"/>`);
shore.push(`<path d="${dz(offset(world.coast,-80))}" fill="none" stroke="#FFF0C7" stroke-width="5" stroke-dasharray="95 120 180 220" opacity=".8"/>`);
shore.push(`<path d="${dz(world.coast)}" fill="#FDE48C" stroke="#FFF0C7" stroke-width="9"/>`);
shore.push(`<path d="${dz(offset(world.coast,110))}" fill="#83A82D" stroke="#758B2C" stroke-width="4"/>`);
shore.push(`<path d="${dz(offset(world.coast,125))}" fill="#93B72F"/>`);
ground=ground.replace(/<path d="[\s\S]*?fill="#86B064"[^>]*\/>/,shore.join('\n'));
const colours={'#86B064':'#93B72F','#79A35A':'#85AA2B','#5F8A4E':'#718B2C','#DCD5EC':'#FDE48C','#C3BADB':'#E8CA73','#8F90B8':'#E8C56E','#5D6190':'#C2A357','#CDBCD9':'#FDE48C','#B19FC2':'#D4B966','#8A84AE':'#B89A55','#D8CAE2':'#F8E8AC','#5B83B8':'#62BACE','#9DBDE6':'#9DDEEA','#9A9CC0':'#E8C56E','#5A78A8':'#8BD4E0','#8FBA6B':'#98BC38','#9CC577':'#A0C343'};
for(const [a,b]of Object.entries(colours))ground=ground.split(a).join(b);
ground=ground.replace(/<path[^>]*stroke-dasharray="40 60"[^>]*\/>/g,'');
// Keep walking room at 1.5x HOME or more, and reclaim surplus paving as grass.
ground=ground.replace(/stroke-width="(266|258|250|216|208|200)"/g,(_,n)=>`stroke-width="${{266:216,258:208,250:200,216:196,208:188,200:180}[n]}"`);
// Both little hard-surfaced ovals become garden lawns. Keep their reserved footprints.
const lines=ground.split('\n');
for(let i=0;i<lines.length;i++)if(/<clipPath id="pz[12]"/.test(lines[i])){
 const z=world.zones[lines[i].includes('pz1')?'activity-1':'activity-4'];
 lines.splice(i,4,`<ellipse cx="${z.x}" cy="${z.y}" rx="${z.rx-10}" ry="${z.ry-9}" fill="#98BC38" stroke="#718B2C" stroke-width="4"/>`);
}
ground=lines.join('\n');
// Reserved stall rows are garden strips with softly curved ends.
const stripLines=ground.split('\n');
for(let i=0;i<stripLines.length;i++)if(/<clipPath id="stall[012]"/.test(stripLines[i])){
 const n=+stripLines[i].match(/stall(\d)/)[1],z=world.zones[`stalls-${n+1}`],p=z.poly;
 const mid=(a,b)=>[r((a[0]+b[0])/2),r((a[1]+b[1])/2)];
 const smooth='M'+mid(p[p.length-1],p[0]).join(' ')+p.map((a,j)=>' Q'+a.join(' ')+' '+mid(a,p[(j+1)%p.length]).join(' ')).join('')+' Z';
 stripLines.splice(i-2,5,`<path d="${smooth}" fill="#93B72F"/>`);i-=2;
}
ground=stripLines.join('\n');
for(const id of ['activity-1','activity-4'])world.zones[id].kind='lawn';
art.sea='#6EC9DE';

// Preserve existing tree sizes exactly; add large trees around the fixed sleeper art.
const templates={};
for(const p of art.props)if(!templates[p.src])templates[p.src]=p;
function importHome(name,label,h){
 const source='public/pixi-art/detail/'+name+'.svg',target='reuse/'+name+'.svg';
 fs.copyFileSync(source,A+target);
 let s=fs.readFileSync(A+target,'utf8');
 const gradients=new Map();
 s=s.replace(/<(linearGradient|radialGradient)\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g,(_,tag,id,body)=>{const stops=[...body.matchAll(/stop-color="([^"]+)"/g)];gradients.set(id,stops[Math.min(1,stops.length-1)][1]);return ''});
 for(const [id,col]of gradients)s=s.split(`url(#${id})`).join(col);
 fs.writeFileSync(A+target,s);
 const vb=s.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
 templates[target]={src:target,name:label,width:vb[2],height:vb[3],scale:h/vb[3],anchor:{x:.5,y:.95}};
 return target;
}
const picnic=importHome('street--picnic-blanket','Picnic blanket',85),basket=importHome('street--picnic-basket','Picnic basket',65),sign=importHome('street--signpost-three-way','Garden signpost',170);
importHome('nature--rock-round','Rock',80);
// Reuse the studio's small flat timber props, copied into Neon before placement.
for(const [name,label]of [['community-crate','Crate'],['community-barrel','Barrel'],['garden-butterfly','Garden butterfly']]){
 const target='reuse/'+name.replace('community-','neon-')+'.svg';
 fs.copyFileSync('public/pixi-art/themes/community/detail/'+name+'.svg',A+target);
 const s=fs.readFileSync(A+target,'utf8'),vb=s.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
 templates[target]={src:target,name:label,width:vb[2],height:vb[3],scale:1,anchor:{x:.5,y:1}};
}
const additions=[];
function fits(p,kind='small'){
 const x=p.x,y=p.y,w=width(p),h=height(p),rad=kind==='tree'?36:kind==='shop'?w*.47:Math.min(100,w*.4);
 if(!bare.walkable(x,y)||!inPoly(x,y,inland))return false;
 if(pathNear(x,y,rad+18)||reserved(x,y,rad+20))return false;
 if(((x-centre.x)/(centre.rx+rad+70))**2+((y-centre.y)/(centre.ry+rad+70))**2<1)return false;
 if(walk.walkways.some(b=>dist(x,y,b.a,b.b)<b.w/2+100))return false;
 if(world.water.some((q,qi)=>q.poly?inPoly(x,y,waterMargin[qi]):((x-q.x)/(q.rx+rad+20))**2+((y-q.y)/(q.ry+rad+20))**2<1))return false;
 if(Object.values(world.zones).some(z=>Math.hypot(x-z.spawn[0],y-z.spawn[1])<rad+70))return false;
 if(beds.some(b=>Math.hypot(x-b.x,(y-b.y)*1.6)<w*.4+b.r+35 || (y>b.y-25&&y-b.y<h*.9+30&&Math.abs(x-b.x)<w*.5+b.r*.6+20)))return false;
 if(kind==='tree'||kind==='shop'){
  if(reserved(x,y-h*.65,w*.25))return false;
  if(art.props.some(q=>isShop(q)&&Math.abs(x-q.x)<(w+width(q))*.44&&y>q.y-height(q)*.4&&y<q.y+height(p)*.8))return false;
 }
 return !art.props.some(q=>{
  if(q.src.startsWith('centre/'))return false;
  const otherTree=isTree(q),otherShop=isShop(q);
  const clearance=kind==='tree'&&otherTree?210:otherShop?width(q)*.5+rad+25:kind==='shop'?width(q)*.4+rad+25:rad+Math.min(85,width(q)*.35);
  return Math.hypot(x-q.x,(y-q.y)*1.6)<clearance;
 });
}
function add(src,x,y,kind='small',mult=1){
 const t=templates[src];if(!t)throw Error('missing '+src);
 const p={...t,id:'neon-polish-'+additions.length,x:r(x),y:r(y),scale:t.scale*mult,flip:rnd()<.5};
 if(!fits(p,kind))return false;
 art.props.push(p);additions.push({...p,kind});
 const w=width(p);
 if(kind!=='flat')walk.obstacles.push({x:p.x,y:r(p.y-(kind==='tree'?9:kind==='shop'?w*.2:10)),rx:r(kind==='tree'?31:kind==='shop'?w*.47:Math.min(100,w*.36)),ry:r(kind==='tree'?22:kind==='shop'?w*.22:Math.min(30,height(p)*.18)),neonPolish:true});
 return true;
}
// Distinct shops and kiosks on the north and outer promenades.
for(const [src,x,y]of [['shop-cat.svg',3500,990],['shop-star.svg',4450,1030],['shop-noodle.svg',5250,1030],['shop-boba.svg',1550,3050]])add(src,x,y,'shop',1.2);
for(let n=0,tries=0;n<2&&tries<16000;tries++)if(add(['shop-cupcake.svg','shop-star.svg'][n],950+rnd()*5800,1050+rnd()*2700,'shop',1.15))n++;
for(let n=0,tries=0;n<5&&tries<12000;tries++){
 const x=900+rnd()*5900,y=1000+rnd()*2900;
 if(add('noodle-kiosk.svg',x,y,'shop',1.06))n++;
}
// Grow groves of 3-7 from existing trees and along outer lawn edges.
// Planters and flowers break up the long northern beach promenade.
for(let x=3300;x<4800;x+=220){
 const t=templates['planter-box.svg'],p={...t,id:'neon-polish-north-'+x,x,y:940,scale:t.scale*.65,flip:false};
 if(bare.walkable(x,940)&&!pathNear(x,940,30)&&!reserved(x,940,40)&&!beds.some(b=>Math.hypot(x-b.x,940-b.y)<b.r+100)){
  art.props.push(p);additions.push({...p,kind:'small'});walk.obstacles.push({x,y:930,rx:40,ry:18,neonPolish:true});
 }
}
// North beach grove breaks the long bare horizon behind the promenade.
for(const [i,x]of [3100,3280,3530,3910,4150,4490,4720].entries())add(`reuse/tree-${1+i%5}.svg`,x,950+(i%3)*15,'tree',1.08);
const groveSeeds=[...art.props.filter(isCoreTree).map(p=>[p.x,p.y]),[3050,980],[4000,980],[4850,1100],[5600,1250],[1150,2500],[6550,2800],[3100,3700],[4700,3700]];
let core=art.props.filter(isCoreTree).length;
for(let tries=0;tries<35000&&core<64;tries++){
 const [gx,gy]=groveSeeds[tries%groveSeeds.length],a=rnd()*Math.PI*2,dd=165+rnd()*370;
 const src=`reuse/tree-${1+tries%5}.svg`;
 if(add(src,gx+Math.cos(a)*dd,gy+Math.sin(a)*dd*.7,'tree',1.05+rnd()*.18))core++;
}
// Bushes under the new groves. These are low enough to keep the sleepers visible.
for(const t of additions.filter(p=>p.kind==='tree'))for(const side of [-1,1])add(`reuse/bush-${1+Math.floor(rnd()*6)}.svg`,t.x+side*(80+rnd()*80),t.y+35+rnd()*30,'small',.85);
// Dress each reserved area from outside its boundary, leaving approaches open.
for(const [id,z]of zones){
 if(z.poly){
  const line=z.line;
  for(let i=0;i<line.length;i+=3){const q=line[i],mid=line[Math.min(i+1,line.length-1)],dx=mid[0]-q[0],dy=mid[1]-q[1],l=Math.hypot(dx,dy)||1;
   for(const side of [-1,1])add(i%6?'planter-box.svg':'neon-lamp.svg',q[0]-dy/l*side*190,q[1]+dx/l*side*190,'small',.85);
  }
 }else{
  for(let i=0;i<20;i++){
   const a=i*Math.PI/10,x=z.x+Math.cos(a)*(z.rx+95),y=z.y+Math.sin(a)*(z.ry+75);
   const src=i%5===0?'reuse/street--bench-park.svg':i%7===0?'neon-lamp.svg':`reuse/bush-${1+i%6}.svg`;
   add(src,x,y,'small',src.includes('bush')?.72:.9);
   add(`reuse/flower-${1+i%3}.svg`,x+35,y+35,'flat',.9);
  }
 }
}
// Pond rim: rocks and reeds, without consuming the water or its approaches.
const pond=world.water[0];
for(let i=0;i<14;i++){
 const a=i*Math.PI/7;add(i%3===0?'reuse/nature--reeds.svg':'reuse/nature--rock-round.svg',pond.x+Math.cos(a)*(pond.rx+100),pond.y+Math.sin(a)*(pond.ry+85),'small',.7+rnd()*.3);
}
// Everyday life on free lawns: picnics, signs, benches and small flowering beds.
const smalls=[picnic,basket,sign,'reuse/street--bench-wood.svg','sign-board.svg','planter-box.svg','reuse/nature--rock-round.svg','reuse/flower-1.svg','reuse/flower-2.svg','reuse/flower-3.svg'];
for(let n=0,tries=0;n<55&&tries<22000;tries++){
 const src=smalls[n%smalls.length],kind=src===picnic||src.includes('flower')?'flat':'small';
 if(add(src,900+rnd()*5900,1000+rnd()*3000,kind,.85))n++;
}
// Timber supplies live beside kiosks; butterflies sit over flower gardens.
for(const p of art.props.filter(q=>/kiosk|shop/.test(q.src))){
 for(const side of [-1,1])add(side<0?'reuse/neon-crate.svg':'reuse/neon-barrel.svg',p.x+side*(width(p)*.55+90),p.y+55,'small',.9);
}
const shopAnchors=art.props.filter(q=>/kiosk|shop/.test(q.src));
for(let n=0,tries=0;n<3&&tries<3000;tries++){
 const p=shopAnchors[tries%shopAnchors.length],a=rnd()*Math.PI*2,dd=width(p)*.55+100+rnd()*160;
 if(add('reuse/neon-barrel.svg',p.x+Math.cos(a)*dd,p.y+Math.sin(a)*dd*.6,'small',.9))n++;
}
for(const [id,z]of zones.filter(([id])=>id.startsWith('activity'))){
 for(const side of [-1,1])add('reuse/garden-butterfly.svg',z.x+side*(z.rx+70),z.y-z.ry-60,'flat',.85);
}
// Low flowers and planters around the locked crossing, between the path mouths.
for(let i=0;i<24;i++){
 const a=(i+.5)*Math.PI/12,x=centre.x+Math.cos(a)*(centre.rx+100),y=centre.y+Math.sin(a)*(centre.ry+80);
 add(i%3===0?'planter-box.svg':`reuse/flower-${1+i%3}.svg`,x,y,i%3===0?'small':'flat',.8);
}

// HOME decals, at source scale, across all grass including the open lawns.
let decals=0;
for(let tries=0;decals<1300&&tries<100000;tries++){
 const x=850+rnd()*6200,y=850+rnd()*3500;
 if(!bare.walkable(x,y)||!inPoly(x,y,inland)||pathNear(x,y,18))continue;
 if(((x-centre.x)/(centre.rx+30))**2+((y-centre.y)/(centre.ry+30))**2<1)continue;
 if(zones.some(([id,z])=>id.startsWith('stalls')&&inPoly(x,y,z.poly)))continue;
 if(x>5800&&y>3300)continue;
 const src=['grass-tuft-1','grass-tuft-2','grass-tuft-3','grass-tuft-1','pebble-1','flower-dot-1','flower-dot-2','flower-dot-3'][decals%8];
 const sample=art.flats.find(p=>p.src===`reuse/${src}.svg`);
 art.flats.push({...sample,x:r(x),y:r(y),flip:rnd()<.5});decals++;
}
// Flower borders frame the open activity lawns without occupying their interiors.
for(const [,z]of zones.filter(([id])=>id.startsWith('activity')))for(let i=0;i<52;i++){
 const a=i*Math.PI/26,x=z.x+Math.cos(a)*(z.rx+38),y=z.y+Math.sin(a)*(z.ry+30);
 if(pathNear(x,y,18)||!bare.walkable(x,y))continue;
 const sample=art.flats.find(p=>p.src===`reuse/flower-dot-${1+i%3}.svg`);
 art.flats.push({...sample,x:r(x),y:r(y),width:sample.width*1.5,height:sample.height*1.5});
}
// Save exact tile crops from the new ground. Transparent sea keeps shared-world water intact.
ground=ground.replace(/<desc>[\s\S]*?<\/desc>/,'<desc>Tickytown polished ground: HOME turquoise water, warm sand shore, rich grass, curved cream paths. Night character lives in the neon shop signs and lamps.</desc>');
fs.writeFileSync(A+'ground.svg',ground);
for(const t of art.ground.tiles){let s=ground.replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,`width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}"`);fs.writeFileSync(A+t.src,s);}
world.obstacles=walk.obstacles;world.props=art.props.map(p=>({...p}));
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'placements.json',art.props.map(p=>({...placements.find(q=>q.id===p.id),...p})));
const stats={props:art.props.length,trees:art.props.filter(isTree).length,bigHomeTrees:art.props.filter(isCoreTree).length,shops:art.props.filter(isShop).length,kiosks:art.props.filter(p=>p.src==='noodle-kiosk.svg').length,newProps:additions.length,groundDecals:art.flats.length,sea:art.sea,coastArea:Math.abs(area(world.coast)),sleepers:beds.length,activityAreas:4,stallRows:3};
save(A+'polish-metrics.json',stats);console.log(stats);
