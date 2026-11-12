// Bellovo Piazza. Generated props traced with cathedral-trace.py; assembly follows library-world.mjs.
// Only writes the cathedral theme's folders. node scripts/themes/cathedral-world.mjs
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {addArc,arcGeometry,ring,roseFloor} from './cathedral-craft.mjs';
import {geometry,inPoly,inShape} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const ART='public/pixi-art/themes/cathedral/', DATA='assets/world/themes/cathedral/';
const W=8000,H=6000,INK='#39472D',SAND='#FDE48C',CREAM='#FFE7A0',SEA='#6EC9DE';
const r=n=>Math.round(n*10)/10;
const save=(p,o)=>writeFileSync(p,JSON.stringify(o,null,2)+'\n');
function smooth(pts,closed=true,n=8){const out=[],N=pts.length,P=i=>pts[closed?(i+N)%N:Math.max(0,Math.min(N-1,i))];for(let i=0;i<(closed?N:N-1);i++){let a=P(i-1),b=P(i),c=P(i+1),d=P(i+2);for(let k=0;k<n;k++){let t=k/n;out.push([0,1].map(j=>r(.5*(2*b[j]+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t*t+(-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t))));}}if(!closed)out.push(pts.at(-1));return out;}
const area=p=>Math.abs(p.reduce((s,a,i)=>{let b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
function offset(p,d){return p.map((a,i)=>{let b=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length],dx=c[0]-b[0],dy=c[1]-b[1],l=Math.hypot(dx,dy);return[r(a[0]-dy/l*d),r(a[1]+dx/l*d)]})}
const dpath=(p,closed=true)=>'M'+p.map(p=>p.join(',')).join(' L')+(closed?' Z':'');
const ellipse=(x,y,rx,ry,fill,stroke='none',sw=0)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const path=(p,fill,stroke='none',sw=0)=>`<path d="${dpath(p)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const svg=(w,h,body,vb=`0 0 ${w} ${h}`)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${body}</svg>`;
const segdist=(x,y,a,b)=>{let dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
let seed=2246; const rnd=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
// A rounded piazza headland, two quiet garden islets, no hard corners or home-island outline reuse.
let coast=smooth([[2050,1150],[2750,820],[3800,690],[4650,750],[5500,1100],[6200,1400],[6700,2000],[7080,2800],[7010,3540],[6630,4090],[6000,4560],[5200,4920],[4290,5130],[3460,4980],[2610,4930],[1800,4550],[1100,4060],[880,3320],[1120,2500],[1530,1850]]);
// Scale the footprint, not props or paths, to exactly ~20M, centred on the main landmass.
const factor=Math.sqrt(20_000_000/area(coast));coast=coast.map(([x,y])=>[r(4000+(x-4000)*factor),r(2950+(y-2950)*factor)]);
const walkCoast=offset(coast,35), lawn=offset(coast,130);
const islets=[[920,1280,420,295],[6640,5080,430,290]];
const centre={x:4100,y:2680,rx:1070,ry:824,spawn:[4100,3070]};
const activities=[{x:2240,y:2200,rx:540,ry:400},{x:2560,y:4100,rx:660,ry:460},{x:6050,y:2910,rx:590,ry:430}];
const stalls=[{x:4860,y:3900,rx:650,ry:220},{x:3750,y:4510,rx:620,ry:200},{x:5900,y:1950,rx:470,ry:190}];
const plazaNorth={x:4100,y:1670,rx:1260,ry:470};
const pond={x:1770,y:3310,rx:430,ry:310};
const water=[pond];
const PATHS=[
 {w:260,line:[[3000,1120],[2900,1500],[3150,1880],[3600,2110]]},
 {w:260,line:[[4100,3340],[4130,3670],[4000,4100],[4100,4970]]},
 {w:250,line:[[3100,2680],[2640,2750],[2310,3100],[2100,3730],[2560,4100],[3450,4490],[4100,4610]]},
 {w:260,line:[[5100,2720],[5540,2750],[6050,2910],[6890,3150]]},
 {w:240,line:[[4820,3300],[5190,3700],[5700,3970],[6190,4480]]},
 {w:210,line:[[1500,1710],[1810,2150],[2240,2200],[2900,1500]]},
 {w:240,line:[[1150,3330],[1260,3820],[1800,4140],[2560,4100]]},
 {w:220,line:[[5250,1680],[5900,1950],[6240,2400],[6050,2910]]},
 {w:220,line:[[2560,4100],[2230,4540],[3000,4770],[4100,4840],[5150,4660],[6190,4480]]},
 {w:210,line:[[2240,2200],[1800,2670],[1300,2970],[1150,3330]]},
 {w:230,line:[[6050,2910],[6450,3590],[6200,4120],[5700,3970]]},
];
for(const p of PATHS)p.line=smooth(p.line,false,10);
const pathDist=(x,y)=>Math.min(...PATHS.map(p=>Math.min(...p.line.slice(1).map((b,i)=>segdist(x,y,p.line[i],b)))-p.w/2));
const jetties=[{foot:[3000,1130],tip:[3000,390],width:140},{foot:[1140,3330],tip:[400,3330],width:165},{foot:[6880,3150],tip:[7590,3150],width:165},{foot:[4100,4930],tip:[4100,5630],width:165}];
const arches=[{a:[1190,1400],b:[1660,1780],w:200,r:85},{a:[5930,4310],b:[6510,4920],w:200,r:90},{a:[1770,2940],b:[1770,3680],w:195,r:75}];
const walkways=[{a:[1290,3270],b:[1510,3270],w:140},...jetties.slice(1).map(j=>({a:j.foot,b:j.tip,w:j.width})),...arches.map(({a,b,w})=>({a,b,w}))];
const bridges=[{x:1400,y:3270,w:260,h:140},{x:1770,y:3310,w:195,h:760}];
const onDeck=(x,y,pad=100)=>walkways.some(b=>segdist(x,y,b.a,b.b)<b.w/2+pad)||jetties.some(b=>segdist(x,y,b.foot,b.tip)<b.width/2+pad);
const props=[],obstacles=[],decks=[],flats=[],arcBenches=[];
mkdirSync(ART+'reuse',{recursive:true});mkdirSync(DATA,{recursive:true});
const reused=['street--lamp-lantern','street--umbrella-cafe','beach--towel-striped','beach--towel-sun','beach--beach-ball','beach--sandcastle-small','nature--lily-pad-flower','nature--reeds','nature--rock-round','nature--rock-flat','nature--cattails','street--picnic-blanket','street--picnic-basket','street--signpost-three-way','street--planter-flowers','street--bin-litter','beach--shell-conch','beach--starfish-orange','water--dock-piece'];
for(const name of reused)copyFileSync('public/pixi-art/detail/'+name+'.svg',ART+'reuse/'+name+'.svg');
for(const name of ['tree-1','tree-2','tree-3','tree-5','bush-1','bush-2','bush-3','flower-1','flower-2','flower-3'])copyFileSync('public/pixi-art/plants/'+name+'.svg',ART+'reuse/'+name+'.svg');
for(const name of ['grass-tuft-1','grass-tuft-2','grass-tuft-3','pebble-1','pebble-2','sand-speck-1','sand-speck-2','flower-dot-1','flower-dot-2','flower-dot-3'])copyFileSync('public/pixi-art/decals/'+name+'.svg',ART+'reuse/'+name+'.svg');
copyFileSync('public/pixi-art/themes/sunflower/detail/barrel-seeds.svg',ART+'reuse/barrel-seeds.svg');
copyFileSync('public/pixi-art/themes/goldmine/detail/supply-crates.svg',ART+'reuse/supply-crates.svg');
const sizes=new Map();
function put(name,src,x,y,h,foot='small',id=null,flip=false){let wh=sizes.get(src);if(!wh){let s=readFileSync(ART+src,'utf8'),m=s.match(/<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/);if(m)wh=[+m[1],+m[2]];else{m=s.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/);wh=[+m[1],+m[2]]}sizes.set(src,wh)}let[w,hh]=wh,scale=h/hh;
 // Fixed legacy furniture used to sit on the soft paths. Move its entire footprint to the nearest clear verge.
 const margin=foot==='tree'?145:foot==='bench'?w*scale*.5:foot&&typeof foot==='object'?(foot.rx||w*scale*.22):foot==='small'?w*scale*.28+14:24;
 if(!/Arcade|Lily/.test(name)&&pathDist(x,y)<margin){
  const ox=x,oy=y;let chosen=null;
  for(let radius=40;radius<=650&&!chosen;radius+=20)for(let j=0;j<32;j++){
   const a=j*Math.PI/16,nx=r(ox+Math.cos(a)*radius),ny=r(oy+Math.sin(a)*radius);
   if(pathDist(nx,ny)<margin||onDeck(nx,ny,30)||!inPoly(nx,ny,walkCoast)||water.some(z=>inShape(nx,ny,z,margin))||[...activities,...stalls].some(z=>inShape(nx,ny,z,40))||props.some(q=>Math.hypot(nx-q.x,(ny-q.y)*1.3)<margin+45))continue;
   chosen=[nx,ny];break;
  }
  if(!chosen)return null; // no decoration is preferable to furniture blocking a path
  [x,y]=chosen;
  if(foot&&typeof foot==='object')foot=foot.poly?{...foot,poly:foot.poly.map(([px,py])=>[px+x-ox,py+y-oy])}:{...foot,x:foot.x+x-ox,y:foot.y+y-oy};
 }
 let p={id:id??`cathedral-${props.length}`,name,src,x,y,width:w,height:hh,scale:r(scale*1000)/1000,anchor:{x:.5,y:.98},flip};props.push(p);let width=w*scale;
 if(foot==='tree')obstacles.push({x,y:y-9,rx:31,ry:22});else if(foot==='small')obstacles.push({x,y:y-10,rx:r(width*.28),ry:20});else if(foot==='bench')obstacles.push({x,y:y-20,rx:r(width*.44),ry:30});else if(foot&&typeof foot==='object')obstacles.push(foot);return p;}
put('Cathedral hall','detail/cathedral.svg',3990,1640,1120,{poly:[[3570,1430],[4410,1430],[4410,1620],[3570,1620]]},'cathedral-hall');
put('Bell tower','detail/bell-tower.svg',4800,1570,1180,{x:4800,y:1530,rx:130,ry:90},'campanile');
// Arcades sit at the rear of their courtyards. Only columns block walking.
function arcade(x,y,w){let p=put('Arcade','detail/arcade.svg',x,y,w*.49,null);let pw=p.width*p.scale;for(let t=0;t<6;t++)obstacles.push({x:r(x-pw*.47+t*pw*.188),y:y-16,rx:22,ry:22});}
arcade(2870,1740,900);arcade(5450,1680,900);arcade(4840,3650,1100);
// Approved olive cloister. Encode authored sortY in the anchor so the existing renderer interleaves Duckies.
const centreSpec=JSON.parse(readFileSync(ART+'centre/centre.json'));const centreScale=.83;
for(const p of centreSpec.pieces){const x=centre.x+p.x*centreScale,y=centre.y+p.y*centreScale,w=p.width*centreScale,h=p.height*centreScale;
 if(p.layer==='decal'||p.layer==='back')flats.push({src:'centre/'+p.file,x,y,width:w,height:h,topLeft:true});
 else {const sy=centre.y+(p.sortY??p.at[1])*centreScale;props.push({id:'cloister-'+p.id,name:'Olive cloister '+p.id,src:'centre/'+p.file,x:x+w/2,y:sy,width:w,height:h,scale:1,anchor:{x:.5,y:(sy-y)/h},shadow:false});}}
for(const b of centreSpec.blocked){if(b.poly)obstacles.push({name:b.name,poly:b.poly.map(([x,y])=>[centre.x+x*centreScale,centre.y+y*centreScale])});else{const e=b.ellipse??b;obstacles.push({name:b.name,x:centre.x+e.x*centreScale,y:centre.y+e.y*centreScale,rx:e.rx*centreScale,ry:e.ry*centreScale});}}

writeFileSync(ART+'detail/rose-inlay.svg',roseFloor());
flats.push({src:'detail/rose-inlay.svg',x:3450,y:2160,width:1300,height:1040,topLeft:true});
for(const deg of [-142,-38,42,138])arcBenches.push(addArc({x:4100,y:2680,rx:570,ry:570*.766},deg,'cloister-'+deg,props,obstacles,{span:22,offset:0}));

for(const [x,y] of [[1830,1550],[5650,4130],[3180,4280],[920,1260],[6690,5100]])put('Cottage cafe','detail/cottage.svg',x,y,370,{x,y:y-35,rx:155,ry:70});
for(const [x,y] of [[2180,3680],[5770,1530],[5430,4610]])put('Garden pergola','detail/pergola.svg',x,y,320,{x,y:y-25,rx:135,ry:55});
for(const deg of [-155,-115,-65,-25,25,65,115,155]){let t=deg*Math.PI/180,x=r(centre.x+(centre.rx+50)*Math.cos(t)),y=r(centre.y+(centre.ry+30)*Math.sin(t));if(pathDist(x,y)<80)continue;arcBenches.push(addArc(centre,deg,'piazza-'+deg,props,obstacles,{span:12,offset:50}));put('Terracotta pot','detail/terracotta-pot.svg',x+160,y+20,110);}
for(const [x,y] of [[2020,2630],[1460,2890],[2530,3500],[3150,3730],[2830,4550],[4470,4580],[5500,3390],[6320,2420],[6470,3860],[5800,4520],[2000,1720],[3530,1810],[4570,1810]]){put('Stone bench','detail/stone-bench.svg',x,y,120,'bench');put('Terracotta pot','detail/terracotta-pot.svg',x+160,y,105)}
for(const [x,y] of [[3430,1670],[4530,1670],[2590,1770],[5770,1700],[4310,3690],[5390,3670],[1140,3650],[6500,3310]])put('Terracotta pot','detail/terracotta-pot.svg',x,y,145);
for(const [x,y] of [[3260,2220],[4950,2210],[3170,3160],[5050,3200],[2880,3630],[5610,3790],[6080,4200],[1510,3820]])put('Lantern','reuse/street--lamp-lantern.svg',x,y,230,'small');
for(const [zi,z]of [...activities,...stalls].entries()){
 let count=arcBenches.filter(b=>b.id.startsWith('rim-'+zi+'-')).length;
 for(const deg of [-120,-60,60,120,180,0,-150,-30,30,150,90,-90]){
  if(count>=2)break;
  const span=zi<3?22:18,{footprint}=arcGeometry(z,deg,span,85);
  if(footprint.some(([x,y])=>!geometry({coast:walkCoast,islets,walkways,water,bridges,obstacles}).walkable(x,y)||pathDist(x,y)<24||onDeck(x,y,30)||props.some(p=>Math.hypot(x-p.x,y-p.y)<90)))continue;
  arcBenches.push(addArc(z,deg,'rim-'+zi+'-extra-'+count,props,obstacles,{span}));count++;
 }
}
// Fixed trees frame the architecture; extra trees/bushes spread evenly in garden pockets.
const treepts=[[2300,1240],[2640,1070],[3320,960],[5340,1180],[5920,1370],[6500,1920],[1570,2350],[2770,2370],[2060,2880],[1250,4020],[1780,4390],[3010,4740],[4700,4850],[5720,4540],[6670,4030],[6810,2690],[5550,3360],[650,1240],[6500,5110]];
for(const [i,[x,y]] of treepts.entries())put(i%3?'Olive tree':'Garden tree',i%3?'detail/olive-tree.svg':'reuse/tree-5.svg',x,y,i%3?465:510,'tree',`olive-${i}`);
const avoidZones=[centre,...activities,...stalls,plazaNorth].map(z=>({...z,rx:z.rx+90,ry:z.ry+90}));
const avoid=(x,y,pad=0)=>avoidZones.some(e=>((x-e.x)/(e.rx+pad))**2+((y-e.y)/(e.ry+pad))**2<1);
const baseGeo=geometry({coast:walkCoast,islets,walkways,water,bridges,obstacles:[]});const geo=()=>({walkable:(x,y)=>baseGeo.walkable(x,y)&&!obstacles.some(o=>inShape(x,y,o,16))});
// Loose olive groves: three to seven full-sized trees, mixed with broadleaf and poplar silhouettes.
const reserves=Object.entries(JSON.parse(readFileSync(ART+'cathedral-sleep-reserve.json'))).filter(([p])=>p!=='nod').flatMap(([,v])=>v);
const bedKeep=(x,y,w=140,h=150)=>reserves.some(([bx,by])=>Math.hypot(x-bx,(y-by)*1.6)<w*.4+95||(y>by-20&&y-by<h*.9&&Math.abs(x-bx)<w/2+60));
function canopyClear(x,y,h,src){
 const ratio=src.includes('olive')?531/465:src.includes('tree-5')?150/380:180/360,w=h*ratio;
 return !props.filter(p=>/tree/i.test(p.name)).some(p=>{const pw=p.width*p.scale,ph=p.height*p.scale;return ((x-p.x)/(w*.43+pw*.43+24))**2+((y-h*.61-(p.y-ph*.61))/(h*.28+ph*.28+20))**2<1;});
}
let attempts=0,grove=0;
const treeCount=()=>props.filter(p=>/tree/i.test(p.name)).length;
while(treeCount()<64&&attempts++<30000){let cx=r(1150+rnd()*5700),cy=r(1000+rnd()*3900);let planted=0;
 for(let j=0;j<5&&treeCount()<64;j++){let t=j*2.4,x=r(cx+Math.cos(t)*(j?170+rnd()*140:0)),y=r(cy+Math.sin(t)*(j?110+rnd()*120:0));
 if(bedKeep(x,y,300,480)||!geo().walkable(x,y)||onDeck(x,y,130)||avoid(x,y,75)||pathDist(x,y)<135||props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.25)<190))continue;
 let n=attempts+j,src=n%3===0?'reuse/tree-5.svg':n%3===1?'reuse/tree-2.svg':'detail/olive-tree.svg';
 const h=440+rnd()*70;if(!canopyClear(x,y,h,src))continue;
 put(src.includes('olive')?'Olive grove tree':'Garden tree',src,x,y,h,'tree',`grove-${grove}-${j}`,rnd()<.5);planted++;
 }if(planted)grove++;
}
// Slender companions complete the olive clusters without filling the open lawns.
attempts=0;
while(treeCount()<64&&attempts++<24000){const ts=props.filter(p=>/tree/i.test(p.name)),t=ts[attempts%ts.length],a=rnd()*Math.PI*2,x=r(t.x+Math.cos(a)*(150+rnd()*140)),y=r(t.y+Math.sin(a)*(100+rnd()*100));
 if(bedKeep(x,y,205,470)||!geo().walkable(x,y)||avoid(x,y,35)||onDeck(x,y,100)||pathDist(x,y)<100||props.some(p=>Math.hypot(x-p.x,y-p.y)<135))continue;
 const h=450+rnd()*60;if(!canopyClear(x,y,h,'reuse/tree-5.svg'))continue;
 put('Grove poplar tree','reuse/tree-5.svg',x,y,h,'tree',`grove-poplar-${attempts}`);
}
// Decorate the rims, leaving the complete reserved zone interiors and all path openings clear.
for(const [zi,z]of [...activities,...stalls].entries())for(let i=0;i<18;i++){
 const t=i*Math.PI*2/18,x=r(z.x+(z.rx+85)*Math.cos(t)),y=r(z.y+(z.ry+80)*Math.sin(t));
 if(bedKeep(x,y,190,250)||!geo().walkable(x,y)||onDeck(x,y,90)||pathDist(x,y)<90||props.some(p=>Math.hypot(x-p.x,y-p.y)<130))continue;
 if(i%6===0)put('Rim lantern','reuse/street--lamp-lantern.svg',x,y,250,'small');
 else if(i%5===0)arcBenches.push(addArc(z,i*20,'rim-'+zi+'-'+i,props,obstacles,{span:20}));
 else if(i%3===0)put('Rim flower pot','detail/terracotta-pot.svg',x,y,145,'small');
 else put('Rim flowering bush',`reuse/bush-${1+i%3}.svg`,x,y,105,'small');
}
// Low flower ribbons on the activity rims, with gaps where the walking paths arrive.
for(const z of [...activities,...stalls])for(let i=0;i<42;i++){let a=i*Math.PI/21,x=r(z.x+(z.rx+18)*Math.cos(a)),y=r(z.y+(z.ry+18)*Math.sin(a));
 if(!baseGeo.walkable(x,y)||onDeck(x,y,30)||pathDist(x,y)<25)continue;
 put('Daisy flower border',`reuse/flower-${1+i%3}.svg`,x,y,46+i%3*9,null);
}
// Understory, flower gardens and rocks tied to trees, never scattered onto the playing lawns.
for(const [i,t]of props.filter(p=>/tree/i.test(p.name)).entries()){
 for(let j=0;j<2;j++){let x=t.x+(j?105:-110),y=t.y+35+j*35;
 if(bedKeep(x,y,120,120)||!geo().walkable(x,y)||avoid(x,y,35)||onDeck(x,y,60)||pathDist(x,y)<55||props.some(p=>Math.hypot(x-p.x,y-p.y)<70))continue;
 const f=i%4===0&&j===1;put(f?'Grove flowers':'Garden bush',f?`reuse/flower-${1+i%3}.svg`:`reuse/bush-${1+i%3}.svg`,x,y,f?82:85+rnd()*30,f?null:{x,y:y-12,rx:26,ry:17});
 }
}
attempts=0;let details=0;
const extras=[['Flower border','reuse/street--planter-flowers.svg',115,'small'],['Garden rock','reuse/nature--rock-round.svg',90,'small'],['Flowers','reuse/flower-2.svg',85,null],['Terracotta pot','detail/terracotta-pot.svg',120,'small'],['Lantern','reuse/street--lamp-lantern.svg',235,'small']];
while(props.length<365&&attempts++<25000){let x=r(1100+rnd()*5800),y=r(1050+rnd()*3900);if(bedKeep(x,y,180,250)||!geo().walkable(x,y)||avoid(x,y,70)||onDeck(x,y,80)||pathDist(x,y)<70||props.some(p=>Math.hypot(x-p.x,y-p.y)<135))continue;let a=extras[details++%extras.length];put(a[0],a[1],x,y,a[2],a[3]);}
for(const [x,y]of [[2450,1350],[1440,2570],[3130,3990],[5200,4390]]){if(geo().walkable(x,y)&&!avoid(x,y,30)){flats.push({src:'reuse/street--picnic-blanket.svg',x,y,width:210,height:130});put('Picnic basket','reuse/street--picnic-basket.svg',x+100,y+30,100,'small');}}
for(const [x,y]of [[2800,2850],[5750,2440],[4440,4370]])if(geo().walkable(x,y)&&!avoid(x,y,20))put('Wayfinding sign','reuse/street--signpost-three-way.svg',x,y,190,'small');
// Beach: open sun terrace in the southeast, small items outside its walking lane.
for(const [x,y,fl] of [[6500,3540,false],[6580,3800,true],[6100,4420,false]]){put('Cafe umbrella','reuse/street--umbrella-cafe.svg',x,y,250,{x,y:y-10,rx:20,ry:15});flats.push({src:'reuse/beach--towel-striped.svg',x:x+160,y:y+20,width:180,height:130,flip:fl});}
put('Sandcastle','reuse/beach--sandcastle-small.svg',6680,3650,140,'small');put('Beach ball','reuse/beach--beach-ball.svg',6350,3830,80,null);
for(const [x,y] of [[1600,3250],[1950,3450],[1950,3220]])put('Lily pads','reuse/nature--lily-pad-flower.svg',x,y,60,null);
for(const [x,y] of [[1510,3080],[2030,3490]])put('Pond reeds','reuse/nature--reeds.svg',x,y,145,'small');
// Pond rim stones, a small timber fishing deck and dockside supplies.
for(let i=0;i<12;i++){let a=i*Math.PI/6,x=r(pond.x+(pond.rx+42)*Math.cos(a)),y=r(pond.y+(pond.ry+34)*Math.sin(a));
 if(onDeck(x,y,40)||pathDist(x,y)<35||!geo().walkable(x,y)||bedKeep(x,y,90,80))continue;put('Pond rim rock',`reuse/nature--rock-${i%2?'flat':'round'}.svg`,x,y,65+i%3*12,'small');}
for(const [x,y]of [[2180,3120],[1990,3020],[1470,3440]])if(geo().walkable(x,y)&&!onDeck(x,y,30))put('Pond cattails','reuse/nature--cattails.svg',x,y,120,null);
for(const [x,y]of [[1980,1570],[5530,4160],[4320,4860],[6600,3240]]){if(!geo().walkable(x,y)||avoid(x,y,15)||bedKeep(x,y,160,125))continue;put('Supply crates','reuse/supply-crates.svg',x,y,100,'small');put('Olive barrel','reuse/barrel-seeds.svg',x+130,y+20,110,'small');}
// Bridge/jetties: deck, plank joins and arched railings in one crop. Rendered beneath the Duckies.
function deck(a,b,w,lift,name){let dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;let minx=Math.min(a[0],b[0])-w,maxx=Math.max(a[0],b[0])+w,miny=Math.min(a[1],b[1])-w-lift,maxy=Math.max(a[1],b[1])+w;let body='';const pt=(t,side,up=0)=>[r(a[0]+dx*t+nx*side),r(a[1]+dy*t+ny*side-up-lift*4*t*(1-t))];let l=[],rr=[];for(let t=0;t<=1.001;t+=.025){l.push(pt(t,-w/2));rr.push(pt(t,w/2))}body+=path([...l,...rr.reverse()],'#D9A56A',INK,3);for(let i=1;i<len/30;i++){let t=i/(len/30);body+=`<path d="M${pt(t,-w/2)} L${pt(t,w/2)}" fill="none" stroke="#A7794D" stroke-width="2"/>`;}for(const side of [-1,1]){for(let i=0;i<=8;i++){let t=i/8;body+=`<path d="M${pt(t,side*w/2)} L${pt(t,side*w/2,65)}" stroke="${INK}" stroke-width="7"/><path d="M${pt(t,side*w/2)} L${pt(t,side*w/2,65)}" stroke="#E6BD88" stroke-width="4"/>`}let rail=[];for(let i=0;i<=40;i++)rail.push(pt(i/40,side*w/2,65));body+=`<path d="${dpath(rail,false)}" fill="none" stroke="${INK}" stroke-width="11"/><path d="${dpath(rail,false)}" fill="none" stroke="#F8DEBB" stroke-width="6"/>`}
 let src=`deck-${name}.svg`;writeFileSync(ART+src,svg(r(maxx-minx),r(maxy-miny),body,`${r(minx)} ${r(miny)} ${r(maxx-minx)} ${r(maxy-miny)}`));return{src,x:r(minx),y:r(miny),width:r(maxx-minx),height:r(maxy-miny)};}
for(const [i,j]of jetties.entries()){let d=deck(j.foot,j.tip,j.width,0,'jetty-'+i);if(i)decks.push(d)}
for(const [i,a]of arches.entries())decks.push(deck(a.a,a.b,a.w,a.r,'arch-'+i));
decks.push(deck([1290,3270],[1510,3270],140,0,'pond-dock'));
// Ground uses the exact HOME palette and its grass, pebble and flower artwork.
let ground='<defs><pattern id="watergrain" width="180" height="120" patternUnits="userSpaceOnUse"><path d="M10 35q12 -5 24 0m65 55q12 -5 24 0" fill="none" stroke="#B5E7F7" stroke-width="1.5" opacity=".5"/></pattern></defs><path d="M0 0H8000V6000H0Z" fill="url(#watergrain)"/>';
for(const [d,c,sw]of [[-86,'#82D3E4',55],[-60,'#A1E1EA',20],[-28,'#D6F5E9',9]])ground+=path(offset(coast,d),'none',c,sw);
ground+=path(coast,SAND,INK,4)+path(offset(coast,15),'none','#FFF3C3',10)+path(lawn,'#93B72F','#7DAE30',6);
for(const [x,y,rx,ry]of islets){ground+=ellipse(x,y,rx+60,ry+60,'none','#96DDEA',18)+ellipse(x,y,rx+28,ry+28,'none','#D6F5E9',8)+ellipse(x,y,rx,ry,SAND,INK,3)+ellipse(x,y,rx-70,ry-60,'#93B72F','#7DAE30',5);}
ground+=`<defs><clipPath id="land"><path d="${dpath(lawn)}"/></clipPath></defs><g clip-path="url(#land)">`;
for(let i=0;i<330;i++){let x=900+rnd()*6200,y=850+rnd()*4300;ground+=ellipse(r(x),r(y),70+rnd()*150,30+rnd()*60,i%3?'#87B431':'#9BBE36');}
ground+=ellipse(6650,3930,780,630,'#FDE48C')+'</g>';
for(const p of PATHS)ground+=`<path d="${dpath(p.line,false)}" fill="none" stroke="#718D35" stroke-width="${p.w+9}" stroke-linecap="round" stroke-linejoin="round"/><path d="${dpath(p.line,false)}" fill="none" stroke="${SAND}" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"/>`;
function softCourt(z,fill,line){const pts=Array.from({length:14},(_,i)=>{let a=i*Math.PI/7,f=1+.025*Math.sin(i*2.7);return[z.x+z.rx*f*Math.cos(a),z.y+z.ry*f*Math.sin(a)]});return path(smooth(pts),fill,line,5);}
function paving(z){let str=softCourt(z,'#F9E7B0','#B79B60');let id='p'+z.x+z.y;str+=`<defs><clipPath id="${id}"><ellipse cx="${z.x}" cy="${z.y}" rx="${z.rx-20}" ry="${z.ry-15}"/></clipPath><pattern id="m${id}" width="95" height="70" patternUnits="userSpaceOnUse"><path d="M0 0H95V70H0Z M47 0V35M0 35H95M23 35V70M71 35V70" fill="none" stroke="#D8BE87" stroke-width="2"/></pattern></defs><g clip-path="url(#${id})"><ellipse cx="${z.x}" cy="${z.y}" rx="${z.rx}" ry="${z.ry}" fill="url(#m${id})"/></g>`;return str;}
ground+=paving(plazaNorth)+paving(centre)+ring(centre,centre.rx-10,centre.rx+86,{steps:96});
for(const z of activities){ground+=softCourt(z,'#99BE37','#7DAE30');for(let i=0;i<20;i++){let a=i*2.4,t=.3+(i%4)*.12;ground+=ellipse(r(z.x+Math.cos(a)*z.rx*t),r(z.y+Math.sin(a)*z.ry*t),60+(i%3)*22,28+(i%4)*10,i%2?'#96BB35':'#9CC13B');}}
for(const z of stalls){ground+=paving(z)+ring(z,z.rx-32,z.rx+12,{steps:64});}
// Lawn rims stay green and playable. Only short stone pads sit under the curved benches.
for(const b of arcBenches.filter(b=>b.id.startsWith('rim-'))){const z={x:b.centre[0],y:b.centre[1],rx:b.radius,ry:b.radius*b.k};let a0=(b.deg-b.span/2-4)*Math.PI/180,a1=(b.deg+b.span/2+4)*Math.PI/180;let pts=[];for(let i=0;i<=24;i++){let a=a0+(a1-a0)*i/24;pts.push([z.x+Math.cos(a)*(b.radius-40),z.y+Math.sin(a)*(b.radius-40)*b.k]);}for(let i=24;i>=0;i--){let a=a0+(a1-a0)*i/24;pts.push([z.x+Math.cos(a)*(b.radius+45),z.y+Math.sin(a)*(b.radius+45)*b.k]);}ground+=path(pts,'#E9D9A3','#9D9D62',2);}
ground+=ellipse(pond.x,pond.y,pond.rx+34,pond.ry+28,SAND,INK,3)+ellipse(pond.x,pond.y,pond.rx,pond.ry,'#62BDD0',INK,3)+ellipse(pond.x,pond.y,pond.rx-16,pond.ry-14,'none','#8FD6E6',18);
for(let i=0;i<13;i++){const a=i*.75;let x=pond.x+Math.cos(a)*(pond.rx-65),y=pond.y+Math.sin(a)*(pond.ry-60);ground+=`<path d="M${x-22} ${y}q22 8 44 0" fill="none" stroke="#B5E7F7" stroke-width="3"/>`;}
for(let i=0;i<coast.length;i+=5){const a=offset(coast,-50)[i],b=offset(coast,-50)[(i+2)%coast.length];ground+=`<path d="M${a}L${b}" fill="none" stroke="#FFF9DE" stroke-width="5" stroke-linecap="round"/>`;}
// Bake thousands of existing HOME decals into the ground, no extra runtime texture or collision objects.
const decals=['grass-tuft-1','grass-tuft-2','grass-tuft-3','pebble-1','pebble-2','flower-dot-1','flower-dot-2','flower-dot-3'];let decalCount=0;
ground+='<defs>';
for(const key of [...decals,'sand-speck-1','sand-speck-2']){let raw=readFileSync(ART+'reuse/'+key+'.svg','utf8');let vb=raw.match(/viewBox="([^"]+)"/)[1];ground+=`<symbol id="${key}" viewBox="${vb}" fill="none" stroke-linecap="round" stroke-linejoin="round">${raw.replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/,'')}</symbol>`;}ground+='</defs>';
for(let i=0;i<7600;i++){let x=r(900+rnd()*6300),y=r(800+rnd()*4500);if(!baseGeo.walkable(x,y)||onDeck(x,y,15)||pathDist(x,y)<15||inShape(x,y,centre)||inShape(x,y,plazaNorth)||stalls.some(z=>inShape(x,y,z)))continue;
 let sandy=!inPoly(x,y,lawn)||((x-6650)/780)**2+((y-3930)/630)**2<1,key=sandy?'sand-speck-'+(1+i%2):decals[i%decals.length],w=sandy?25:29+rnd()*13;ground+=`<use href="#${key}" x="${x}" y="${y}" width="${w}" height="${w*.68}"/>`;decalCount++;}
writeFileSync(ART+'ground.svg',svg(W,H,ground));const tiles=[];
for(let row=0;row<4;row++)for(let col=0;col<5;col++){let x=col*1600,y=row*1500,src=`ground-r${row}-c${col}.svg`;writeFileSync(ART+src,svg(1600,1500,ground,`${x} ${y} 1600 1500`));tiles.push({src,x,y,width:1600,height:1500})}
const zones={plaza:{...centre},centre:{...centre,placeholder:false},cathedral:{x:3990,y:1760,spawn:[3990,1800]},harbor:{x:3000,y:1130,spawn:[3000,1180]}};
activities.forEach((z,i)=>zones[`activity-${i+1}`]={...z,spawn:[z.x,z.y],reserved:true});stalls.forEach((z,i)=>zones[`stalls-${i+1}`]={...z,spawn:[z.x,z.y],reserved:true});
zones.garden={x:2240,y:2200,spawn:[2240,2200]};zones.beach={x:6400,y:3750,spawn:[6400,3750]};
const boats=[{x:3160,y:400,turn:Math.PI},{x:2840,y:580,turn:Math.PI},{x:3160,y:720,turn:Math.PI},...[[610,3170,-Math.PI/2],[900,3500,-Math.PI/2],[7330,2980,Math.PI/2],[7510,3320,Math.PI/2],[3920,5350,0],[4290,5490,0],[3920,5660,0]].map(([x,y,turn])=>({x,y,turn}))];
const world={centrePlacement:{source:'/pixi-art/themes/cathedral/centre/centre.json',origin:[centre.x,centre.y],scale:centreScale},width:W,height:H,coast,water,bridges,obstacles,islets,walkways,arches,zones,paths:PATHS.map(p=>p.line),pathWidths:PATHS.map(p=>p.w),props,sleepSpots:{nod:[],hammock:[],rock:[],leaf:[],book:[],chair:[],wing:[],box:[]},sleepAvoid:avoidZones,ambient:{birds:[[4100,2680],[2240,2200],[6050,2910],[2560,4100],[1770,3310],[5430,4610]],butterflies:[[2100,2670],[5600,4500]]}};
const walk={width:W,height:H,coast:walkCoast,obstacles,islets,walkways,water,bridges,arches};
// Choose 40 beds using the engine's own resolver, off all reserved activity/stall areas and off the full path width.
const sizesNap=sleepHalfWidths();const counts={chair:4,nod:6,hammock:4,rock:5,leaf:5,book:5,wing:6,box:5};
const fullWalk={...world,...walk,walkways:[...walkways,{a:jetties[0].foot,b:jetties[0].tip,w:jetties[0].width}]};
const walkable=geometry(fullWalk).walkable;
const valid=()=>resolveSleepSpots(fullWalk,props,walkable,sizesNap,{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
for(const [pose,n]of Object.entries(counts)){
 for(const spot of JSON.parse(readFileSync(ART+'cathedral-sleep-reserve.json'))[pose]||[]){if(world.sleepSpots[pose].length>=n)break;world.sleepSpots[pose].push(spot);if(valid().bad.length)world.sleepSpots[pose].pop();}
 let anchors=pose==='nod'?props.filter(p=>/tree/i.test(p.name)):props.filter(p=>pose==='book'?/bench|cottage|pergola|tree/i.test(p.name):pose==='rock'?/bush/i.test(p.name):pose==='hammock'?/tree/i.test(p.name):true);let trials=0;while(world.sleepSpots[pose].length<n&&trials++<90000){let a=anchors[trials%anchors.length];let x,y,spot;if(pose==='nod'){x=a.x;y=a.y+14;spot=[a.id,0,trials%2===0]}else{let t=rnd()*Math.PI*2,dist=a.width*a.scale*.6+sizesNap[pose]+50+rnd()*80;x=r(a.x+Math.cos(t)*dist);y=r(a.y+Math.sin(t)*dist*.7+60);if(pose==='chair'){x=r(1400+rnd()*5400);y=r(1600+rnd()*3150)}if(trials>2000&&pose!=='chair'){x=r(1000+rnd()*5900);y=r(950+rnd()*4100)}spot=[x,y,trials%2===0]}
if(avoid(x,y,0)||pathDist(x,y)<sizesNap[pose]*.75+25)continue;world.sleepSpots[pose].push(spot);let result=valid();if(result.bad.length){world.sleepSpots[pose].pop();}}
console.log('beds',pose,world.sleepSpots[pose].length,trials);if(world.sleepSpots[pose].length!==n)throw Error(`Only ${world.sleepSpots[pose].length}/${n} ${pose}`);}
const floating=props.filter(p=>p.name==='Lily pads').map(p=>({src:p.src,x:p.x,y:p.y,width:p.width*p.scale,height:p.height*p.scale,anchor:{x:.5,y:1}}));
for(let i=props.length-1;i>=0;i--)if(props[i].name==='Lily pads')props.splice(i,1);
const art={floating,width:W,height:H,sea:SEA,ground:{tiles},decks,flats,props};
save(ART+'art.json',art);save(DATA+'world.json',world);save(DATA+'walk-world.json',walk);save(DATA+'harbor.json',{jetty:jetties[0],jetties,boats,spawn:centre.spawn});
save(ART+'arc-benches.json',arcBenches);
save(ART+'build-metrics.json',{coastArea:area(coast),homeBaseline:11090000,ratio:area(coast)/11090000,map:[W,H],sleepers:valid().length,sleepCounts:counts,props:props.length,trees:props.filter(p=>/tree/i.test(p.name)).length,groves:grove,groundDecals:decalCount,pathWidths:PATHS.map(p=>p.w),jetties:4,archedBridges:3});
console.log('Bellovo Piazza',area(coast), 'area',props.length,'props',valid().length,'sleepers');
