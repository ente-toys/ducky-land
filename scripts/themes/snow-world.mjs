// Rebuild only Snowdrift. All input dimensions are in the approved concept's coordinate space.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {specs,save,A,INK} from './snow-assets.mjs';
import {drawArcBench} from '../arc-bench-draw.mjs';
import {geometry,inPoly} from '../../assets/world/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const D='assets/world/themes/snow/';mkdirSync(D,{recursive:true});
const W=7500,H=5500,round=n=>Math.round(n*10)/10;
const T=([x,y])=>[round(450+(x-60)*4.5),round(420+(y-35)*4.9)];
const json=(p,o)=>writeFileSync(p,JSON.stringify(o,null,1)+'\n');
const d=p=>'M'+p.map(q=>q.map(round).join(' ')).join(' L'),dz=p=>d(p)+' Z';
function smooth(pts,closed=false,n=10){const out=[],N=pts.length,P=i=>pts[closed?(i+N)%N:Math.max(0,Math.min(N-1,i))];for(let i=0;i<(closed?N:N-1);i++){const a=P(i-1),b=P(i),c=P(i+1),e=P(i+2);for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;out.push([0,1].map(j=>round(.5*(2*b[j]+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-e[j])*t2+(-a[j]+3*b[j]-3*c[j]+e[j])*t3))))}}if(!closed)out.push(pts[N-1]);return out;}
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
function offset(p,r){return p.map((a,i)=>{const b=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length],dx=c[0]-b[0],dy=c[1]-b[1],l=Math.hypot(dx,dy);return[a[0]-dy/l*r,a[1]+dx/l*r]})}
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)};
const lineDist=(x,y,p)=>Math.min(...p.slice(1).map((q,i)=>seg(x,y,p[i],q)));
let seed=111106;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const coast=smooth([[150,150],[260,116],[380,127],[505,99],[641,89],[752,62],[873,80],[962,113],[1080,108],[1193,130],[1307,169],[1380,226],[1405,324],[1445,431],[1460,524],[1416,618],[1343,694],[1215,739],[1060,774],[928,792],[810,786],[693,810],[580,795],[470,806],[345,779],[253,766],[169,715],[128,631],[94,546],[81,453],[93,356],[115,257]].map(T),true,7);
const snowEdge=offset(coast,85),walking=offset(coast,34);
const islets=[[550,938,102,70],[921,928,122,73]].map(([x,y,rx,ry])=>[...T([x,y]),rx*4.5,ry*4.9]);
const E=([x,y,rx,ry],id,name)=>{const q=T([x,y]);return{id,name,x:q[0],y:q[1],rx:rx*4.5,ry:ry*4.9}};
const centre=E([750,455,167,111],'centre','Snow Ducky square');
const ice=E([1168,412,190,105],'skating','Frostglass skating pond');
const activity=[E([226,461,111,95],'activity-1','Sled meadow'),E([429,693,123,67],'activity-2','Snowflake garden'),E([1163,686,126,65],'activity-3','Lantern gathering court')];
const stalls=[E([490,302,90,25],'stalls-1','Cocoa market frontage'),E([976,566,97,25],'stalls-2','Skating market frontage'),E([433,588,102,25],'stalls-3','Winter makers row')];
const iglooPlaza=E([1016,224,132,57],'igloos','Igloo village');
const cabinPlaza=E([356,273,126,65],'cabin','Fireside lodge');
const rings=[centre,...activity,...stalls,iglooPlaza,cabinPlaza];
const paths=[
 [[750,562],[787,622],[738,702],[779,756],[898,780]],
 [[594,464],[528,514],[459,529],[376,550],[293,578],[219,637],[186,709]],
 [[620,388],[551,347],[546,290],[579,228],[649,222],[725,225],[814,235],[910,227]],
 [[876,401],[919,350],[971,309],[1020,280],[1084,284],[1143,296],[1237,286],[1349,248]],
 [[873,490],[923,535],[1003,555],[1089,568],[1183,555],[1272,533],[1379,514]],
 [[218,639],[341,620],[439,635],[528,644],[594,690],[665,726],[736,703]],
 [[999,554],[1021,612],[1073,632],[1121,622],[1216,615],[1306,662]],
 [[224,300],[192,262],[196,217],[238,193]],
 [[237,319],[215,353],[178,376]],
 [[525,684],[546,764],[550,839]],
 [[885,755],[904,801],[920,846]],
 [[293,579],[268,563]],
 [[1229,299],[1273,327]],
 [[1306,662],[1336,711],[1384,726]],
 [[186,709],[186,764]],
 [[522,316],[560,337],[596,376]],
 [[960,224],[897,231],[843,237],[793,224],[715,209]],
].map(l=>({line:smooth(l.map(T)),w:220}));
// Bridges cross open sea to the two quiet southern snow islets.
const walkways=[{a:T([550,790]),b:T([550,909]),w:142},{a:T([920,789]),b:T([920,891]),w:142},{a:T([641,941]),b:T([813,935]),w:145}];
const props=[],flats=[],decks=[],obstacles=[];let pid=0;
function put(name,cp,zone='',scale=1,{world=false,flip=false,foot='base',shadow=true}={}){
 const a=specs[name],p={id:'snow-'+pid++,name:name.replaceAll('-',' '),asset:name,src:a.src,x:world?cp[0]:T(cp)[0],y:world?cp[1]:T(cp)[1],width:a.w,height:a.h,anchor:{x:.5,y:1},scale,flip,zone,shadow};props.push(p);
 const w=p.width*scale,h=p.height*scale;
 if(foot!=='none'){
 const ob=foot==='tree'?{x:p.x,y:p.y-10,rx:28,ry:20}:foot==='pole'?{x:p.x,y:p.y-6,rx:14,ry:10}:foot==='building'?{x:p.x,y:p.y-h*.15,rx:w*.36,ry:h*.17}:{x:p.x,y:p.y-Math.min(35,h*.15),rx:w*.35,ry:Math.min(35,h*.19)};
 obstacles.push(ob);p.footprint=ob;
 }return p;
}
const pathClear=(x,y,pad)=>paths.every(p=>lineDist(x,y,p.line)>p.w/2+pad);
const inside=(x,y,e,pad=0)=>((x-e.x)/(e.rx+pad))**2+((y-e.y)/(e.ry+pad*.7))**2<1;
const reserved=(x,y,pad=0)=>[...rings,ice].some(e=>inside(x,y,e,pad));
// Large, readable secondary landmarks stay outside future activity and stall zones.
put('cabin',[350,250],'lodge',1.12,{foot:'building'});
put('cabin-small',[704,174],'north-cabin',.63,{foot:'building'});
put('igloo',[997,196],'igloos',1.2,{foot:'building'});
put('igloo',[1130,173],'igloos',.74,{foot:'building'});
put('igloo',[889,230],'igloos',.67,{foot:'building'});
put('cocoa-stall',[501,261],'cabin',1.04);
put('skate-stall',[970,519],'skating',1.05);
put('log-stack',[254,259],'cabin',1);
put('sled',[615,177],'north-cabin',.75);
put('log-stack',[762,170],'north-cabin',.65);
put('snowman',[1087,249],'igloos',.85);
put('snowman',[301,638],'garden',.72);
put('sled',[322,521],'sled',.8);
put('sled',[353,498],'sled',.78,{flip:true});
put('sled',[1332,466],'skating',.75);
// Centre's floor and plinth are independent layers, while the Ducky sorts with players.
const cx=centre.x,cy=centre.y;
flats.push({src:specs.plinth.src,x:cx-315,y:cy-100,width:630,height:250,topLeft:true});
const statue=put('snow-ducky',[cx,cy+5],'centre',1.2,{world:true,foot:'none',shadow:false});
obstacles.push({x:cx,y:cy+12,rx:248,ry:133});
const pieces=[{id:'plinth',file:'plinth.svg',layer:'decal',x:-315,y:-100,width:630,height:250,anchor:{x:0,y:0},at:[-315,-100]},{id:'snow-ducky',file:'snow-ducky.svg',layer:'sorted',x:-228,y:-481,width:456,height:486,anchor:{x:.5,y:1},at:[0,5],sortY:5}];
json(A+'centre/centre.json',{theme:'snow',name:'Snowdrift snow Ducky',concept:'concepts/themes/concepts/11-snow.png',origin:'snowflake plaza centre',placement:{x:cx,y:cy,scale:1},depthRatio:centre.ry/centre.rx,pieces,outerEdge:{x:0,y:0,rx:centre.rx,ry:centre.ry},walkable:[{ellipse:{x:0,y:0,rx:centre.rx,ry:centre.ry}}],blocked:[{name:'Snow Ducky plinth',ellipse:{x:0,y:12,rx:248,ry:133}}],spawn:[0,centre.ry-80]});
statue.id='snow-centre-snow-ducky';
// Draw each seat in its own plaza's ellipse, using exactly home's slats and spindle construction.
const benchRecords=[];
function bench(e,deg,span=25){
 const radius=e.rx-45,k=e.ry/e.rx,ground=(a,s)=>[e.x+Math.cos(a*Math.PI/180)*s,e.y+Math.sin(a*Math.PI/180)*s*k];
 const b={deg,span},o={ground,sIn:radius-36,sOut:radius,back:radius+4,seat:20,top:56,ink:INK,line:2.5,thin:1.6,u:1.1};
 const pts=[radius-42,radius+10].flatMap(s=>Array.from({length:31},(_,i)=>ground(deg-span/2+span*i/30,s))),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
 const x0=Math.floor(Math.min(...xs))-6,y0=Math.floor(Math.min(...ys))-65,w=Math.ceil(Math.max(...xs))+6-x0,h=Math.ceil(Math.max(...ys))+6-y0;
 const src=`detail/bench-${e.id}-${deg}.svg`;
 writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}"><title>Snowdrift curved slat bench, ${e.name}</title><g stroke-linecap="round" stroke-linejoin="round">${drawArcBench(b,o).join('')}</g></svg>`);
 const [x,y]=ground(deg,radius-18),poly=[...Array.from({length:20},(_,i)=>ground(deg-span/2+span*i/19,radius-41)),...Array.from({length:20},(_,i)=>ground(deg+span/2-span*i/19,radius+8))];
 const p={id:'snow-bench-'+benchRecords.length,name:'Curved wood bench',asset:'arc-bench',src,x,y,width:w,height:h,anchor:{x:(x-x0)/w,y:(y-y0)/h},scale:1,flip:false,zone:e.id,footprint:{poly}};
 if([...activity,...stalls].some(e=>inside(x,y,e,14)))return;
 props.push(p);obstacles.push({poly});benchRecords.push(p);
}
for(const e of [centre,...activity,iglooPlaza,cabinPlaza]){
 for(const deg of e===centre?[-100,-70,60,130]:[-140,-37,46,135]){
  const angle=deg*Math.PI/180,x=e.x+Math.cos(angle)*(e.rx-64),y=e.y+Math.sin(angle)*(e.ry-45);
  if(!pathClear(x,y,48))continue;
  // Activity cores remain fully empty. Furniture is on a separate outer ring.
  const target=activity.includes(e)?{...e,rx:e.rx+100,ry:e.ry+75}:e;
  bench(target,deg,e===centre?23:27);
 }
 for(let i=0;i<12;i++){
  const a=(i*30+14)*Math.PI/180,x=e.x+Math.cos(a)*(e.rx+90),y=e.y+Math.sin(a)*(e.ry+70);
  if(!pathClear(x,y,45)||[...activity,...stalls].some(z=>inside(x,y,z,40))||props.some(p=>Math.hypot(p.x-x,p.y-y)<100))continue;
  put(i%2?'planter':'lamp',[x,y],e.id,i%2?.68:.75,{world:true,foot:i%2?'base':'pole'});
 }
}
// Rink rail posts and warmly lit benches occupy the bank, not the skating surface.
for(const deg of [-154,-116,-78,-40,24,65,109,153]){
 const a=deg*Math.PI/180,x=ice.x+Math.cos(a)*(ice.rx+82),y=ice.y+Math.sin(a)*(ice.ry+72);
 if(!pathClear(x,y,25))continue;
 put('lamp',[x,y],'skating',.74,{world:true,foot:'pole'});
 put('snow-rock',[x+65,y+35],'skating',.5,{world:true});
}
// Natural groves, planted to frame sight lines and leave the full path and plaza crowns clear.
const clusters=[[267,148],[530,151],[838,96],[1236,199],[1343,361],[1405,568],[1301,723],[1038,764],[844,688],[632,668],[366,736],[174,669],[142,531],[133,378],[386,445],[665,289],[827,334],[1005,650],[544,418],[734,779]];
let trees=0;
const treeAllowed=(x,y)=>inPoly(x,y,offset(snowEdge,100))&&pathClear(x,y,135)&&!reserved(x,y,100)&&!reserved(x,y-210,35)&&!props.some(p=>Math.hypot((p.x-x),(p.y-y)*1.5)<(p.asset?.includes('cabin')?540:p.asset==='igloo'?290:195))&&!walkways.some(b=>seg(x,y,b.a,b.b)<200);
for(let c=0;c<clusters.length;c++){
 const [cx,cy]=T(clusters[c]);
 for(let i=0,tries=0;i<5&&trees<66&&tries<260;tries++){
  const a=rnd()*Math.PI*2,r=40+rnd()*650,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.75;
  if(!treeAllowed(x,y))continue;
  const p=put('pine-'+(1+trees%3),[x,y],'grove-'+c,.92+rnd()*.23,{world:true,flip:rnd()<.5,foot:'tree'});trees++;i++;
 }
}
for(let tries=0;trees<66&&tries<20000;tries++){
 const x=700+rnd()*6000,y=700+rnd()*3500;if(!treeAllowed(x,y))continue;put('pine-'+(1+trees%3),[x,y],'edge-grove',.92+rnd()*.18,{world:true,foot:'tree',flip:rnd()<.5});trees++;
}
// Islet grove anchors, placed away from bridge arrivals.
for(const [i,[x,y]]of islets.entries()){
 for(const [dx,dy]of [[-240,-10],[0,110],[240,-35]]){put('pine-'+(1+i),[x+dx,y+dy],'islets',.85,{world:true,foot:'tree'});trees++}
 put('snowman',[x-220,y+140],'islets',.65,{world:true});put('sled',[x+215,y+140],'islets',.65,{world:true});
}
// Bushes and rocks gather at the groves' feet; berry stems interrupt the snow banks.
let small=0;
const trunks=props.filter(p=>p.asset?.startsWith('pine'));
for(const [i,p]of trunks.entries()){
 for(let j=0;j<(i%3?2:3);j++){
  const x=p.x+(j%2?1:-1)*(130+rnd()*90),y=p.y+40+rnd()*95;
  if(!inPoly(x,y,snowEdge)||!pathClear(x,y,38)||reserved(x,y,25)||props.some(q=>Math.hypot(q.x-x,(q.y-y)*1.4)<85))continue;
  const name=(i+j)%4===0?'snow-rock':(i+j)%3===0?'winter-berries':'snow-bush';put(name,[x,y],'grove-foot',name==='snow-bush'?.65:.7,{world:true});small++;
 }
}
for(let tries=0;small<165&&tries<15000;tries++){
 const x=650+rnd()*6200,y=650+rnd()*3600;
 if(!inPoly(x,y,offset(snowEdge,80))||!pathClear(x,y,70)||reserved(x,y,70)||props.some(p=>Math.hypot(p.x-x,(p.y-y)*1.4)<160))continue;
 put(['snow-bush','winter-berries','snow-rock'][small%3],[x,y],'snowbank',.6+rnd()*.23,{world:true});small++;
}
// Every empty stall frontage has a finished perimeter and broad pedestrian access.
for(const e of stalls)for(const side of [-1,1]){
 put('lamp',[e.x+side*(e.rx+70),e.y+25],e.id,.74,{world:true,foot:'pole'});
 put('planter',[e.x+side*(e.rx+70),e.y+112],e.id,.72,{world:true});
}
// Ground: transparent ocean, home sand lip, ice facets, snowy texture, soft inked path network.
const g=[],tag=(d,f,s=INK,w=3)=>`<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const ell=(e,f,s=INK,w=3)=>`<ellipse cx="${e.x}" cy="${e.y}" rx="${e.rx}" ry="${e.ry}" fill="${f}" stroke="${s}" stroke-width="${w}"/>`;
g.push(`<defs><clipPath id="land"><path d="${dz(snowEdge)}"/></clipPath></defs>`);
g.push(tag(dz(offset(coast,-62)),'#A4E0DE','none'),tag(dz(coast.map(([x,y])=>[x,y+36])),'#6BBACE','#458CA3',4),tag(dz(coast),'#EAD8AC','#566B56',3.5),tag(dz(offset(coast,31)),'#DAEDF0','#8EBCC4',3),tag(dz(snowEdge),'#F3F9F1','#91B7B7',3));
// The ice rim has visible individual facets, without changing the navigation coast.
for(let i=0;i<coast.length;i+=3){const a=coast[i],b=coast[(i+3)%coast.length];if(b[0]<a[0])g.push(tag(`M${a[0]} ${a[1]+8} L${b[0]} ${b[1]+8} L${b[0]+12} ${b[1]+37} L${a[0]+8} ${a[1]+35} Z`,i%2?'#81C8D8':'#BDE6EA','#7FAEB9',1.5));}
let marks='';
for(let i=0;i<2400;i++){
 const x=500+rnd()*6400,y=500+rnd()*3700;if(!inPoly(x,y,snowEdge)||reserved(x,y,0)||!pathClear(x,y,0))continue;
 marks+=`<path d="M${round(x-10)} ${round(y)} q8 -5 15 -1 l-1 -12 9 11 7 -9 4 12 q8 -3 12 1" fill="none" stroke="${i%3?'#BDD7D2':'#FFFFFF'}" stroke-width="${i%3?1.7:5}" stroke-linecap="round"/>`;
 if(i%3===0)marks+=`<ellipse cx="${round(x+34)}" cy="${round(y+9)}" rx="4" ry="2" fill="#AEC7C3"/>`;
}
g.push(`<g clip-path="url(#land)">${marks}</g>`);
g.push('<g clip-path="url(#land)">');
// Draw all outer path strokes together, then all fills, so every junction is a clean rounded union.
for(const [c,w]of [[INK,228],['#D3D7BB',221],['#F9E9BD',215]])for(const p of paths)g.push(tag(d(p.line),'none',c,w));
for(const p of paths){const l=p.line;for(let i=5;i<l.length;i+=8){const a=l[i-1],b=l[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);g.push(tag(`M${l[i][0]-dy/len*90} ${l[i][1]+dx/len*90} L${l[i][0]+dy/len*90} ${l[i][1]-dx/len*90}`,'none','#DACCA8',1.5));}}
// Paving rings, radial joints, tiny snowflake inlays and a dressed outside band.
function pave(e,index){
 g.push(`<clipPath id="p${index}"><ellipse cx="${e.x}" cy="${e.y}" rx="${e.rx}" ry="${e.ry}"/></clipPath>`,ell({...e,rx:e.rx+25,ry:e.ry+19},'#D8E7DE','#ADC6BC',2),ell(e,'#F7E9C8',INK,3));
 const band=stalls.includes(e)?'#C7DADD':'#B2CAC4';
 g.push(ell({...e,rx:e.rx-18,ry:e.ry-13},'none',band,23),ell({...e,rx:e.rx-34,ry:e.ry-25},'none','#8CA9A6',2));
 const k=e.ry/e.rx;
if(e===centre){
 const at=(a,r)=>[e.x+Math.cos(a)*r,e.y+Math.sin(a)*r*k];
 for(let i=0;i<36;i++){
  const a=i*Math.PI/18,b=(i+1)*Math.PI/18,r0=e.rx-143,r1=e.rx-87;
  const p=[at(a,r0),at(b,r0),at(b,r1),at(a,r1)];
  g.push(tag(dz(p),i%2?'#E6C984':'#D6E6DC','#A8AB8E',2));
 }
 g.push(ell({...e,rx:e.rx-143,ry:(e.rx-143)*k},'none','#A8AB8E',2.5));
 for(let a=0;a<360;a+=60){const rad=a*Math.PI/180;
  const p=[at(rad,e.rx-255),at(rad+.034,e.rx-330),at(rad,e.rx-300),at(rad-.034,e.rx-330)];g.push(tag(dz(p),'#9BBEC0','#719AA3',1.8));
 }
}

 for(let r=90;r<e.rx-45;r+=72){g.push(ell({...e,rx:r,ry:r*k},'none','#C7BDA0',1.7));for(let a=0;a<360;a+=18){const ang=(a+(Math.floor(r/72)%2)*9)*Math.PI/180;g.push(tag(`M${e.x+(r-72)*Math.cos(ang)} ${e.y+(r-72)*k*Math.sin(ang)} L${e.x+r*Math.cos(ang)} ${e.y+r*k*Math.sin(ang)}`,'none','#CCC4AA',1.3));}}
 // Airy, repeating snowflakes instead of an empty slab. Flat blue stone inlays.
 let pat='';for(let y=e.y-e.ry+60,row=0;y<e.y+e.ry;y+=115,row++)for(let x=e.x-e.rx+60+(row%2)*65;x<e.x+e.rx;x+=140){if(!inside(x,y,{...e,rx:e.rx-54,ry:e.ry-42}))continue;pat+=`<g transform="translate(${x} ${y}) scale(1 .7)" stroke="#9BBBBC" stroke-width="2" fill="none">`;for(const a of [0,60,120])pat+=`<path transform="rotate(${a})" d="M-14 0 H14 M-8 -4 L-4 0 L-8 4 M8 -4 L4 0 L8 4"/>`;pat+='</g>'}
 g.push(`<g clip-path="url(#p${index})">${pat}</g>`);
}
rings.forEach(pave);
// Frozen pond: scalloped snow bank, bright solid ice, two etched skating loops.
g.push(ell({...ice,rx:ice.rx+53,ry:ice.ry+39},'#B3CED2','#699CA9',3),ell({...ice,rx:ice.rx+31,ry:ice.ry+23},'#FAFCF2',INK,3),ell(ice,'#83D3E2','#5D97AC',3),ell({...ice,rx:ice.rx-32,ry:ice.ry-25},'none','#D3F2EE',7));
for(let i=0;i<8;i++){const x=ice.x-ice.rx*.7+i*180,y=ice.y+Math.sin(i*2)*ice.ry*.38;g.push(tag(`M${x} ${y} C${x+250} ${y-180} ${x+490} ${y+95} ${x+210} ${y+149} S${x-50} ${y-15} ${x+240} ${y-130}`,'none',i%2?'#DAF5F0':'#B8EBEC',2));}
// Sled tracks stay on the activity surface, with timber start posts outside its open core.
const sled=activity[0];let tracks='';for(const dx of [-170,-80,60,150])tracks+=`M${sled.x-130+dx} ${sled.y-sled.ry*.8} C${sled.x+30+dx} ${sled.y-110} ${sled.x-15+dx} ${sled.y+150} ${sled.x+170+dx} ${sled.y+sled.ry*.8} `;
g.push(`<clipPath id="sled"><ellipse cx="${sled.x}" cy="${sled.y}" rx="${sled.rx-45}" ry="${sled.ry-34}"/></clipPath><ellipse cx="${sled.x}" cy="${sled.y}" rx="${sled.rx-47}" ry="${sled.ry-34}" fill="#F4FAF4"/><path d="${tracks}" fill="none" stroke="#B4D4D8" stroke-width="7" clip-path="url(#sled)"/><path d="${tracks}" fill="none" stroke="#FFFFFF" stroke-width="2" clip-path="url(#sled)"/>`);
g.push('</g>');
// Snow islets with the same warm sand footing and turquoise ice lip.
for(const [x,y,rx,ry]of islets){g.push(ell({x,y:y+24,rx:rx+15,ry:ry+5},'#72BFD0','#6B9AAB',3),ell({x,y,rx,ry},'#E7D4A6',INK,3),ell({x,y:y-8,rx:rx-25,ry:ry-20},'#F4FAF3','#9BBFC1',3));for(let i=0;i<70;i++){const px=x+(rnd()*2-1)*rx*.9,py=y+(rnd()*2-1)*ry*.8;if(((px-x)/rx)**2+((py-y)/ry)**2<.7)g.push(tag(`M${px} ${py} q10 -5 19 0 l5 -8 5 8`,'none','#C2D9D4',2));}}
const foam=offset(coast,-96);for(let i=0;i<foam.length;i+=7){const s=foam.slice(i,i+4);g.push(tag(d(s),'none','#EDF9E9',5))}
// Small ice floes are shoreline life, and never marked as walkable islands.
for(const [i,[x,y]]of coast.filter((_,i)=>i%18===0).entries()){
 const c=[W/2,2600],dx=x-c[0],dy=y-c[1],len=Math.hypot(dx,dy),px=x+dx/len*170,py=y+dy/len*170;
 flats.push({src:specs.iceberg.src,x:px,y:py,width:100+(i%3)*25,height:68+(i%3)*15,topLeft:false});
}
const body=g.join('\n'),head=(w,h,vb)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}"><title>Snowdrift snowy coastline and patterned village ground</title>${body}</svg>`;
writeFileSync(A+'ground.svg',head(W,H,`0 0 ${W} ${H}`));
const tiles=[];for(let row=0;row<4;row++)for(let col=0;col<5;col++){const x=col*1500,y=row*1375,src=`ground-r${row}-c${col}.svg`;writeFileSync(A+src,head(1500,1375,`${x} ${y} 1500 1375`));tiles.push({src,x,y,width:1500,height:1375})}
// Arched plank bridges, with deck and rails split for correct Ducky occlusion.
for(const [i,w]of walkways.entries()){
 const horizontal=Math.abs(w.b[0]-w.a[0])>Math.abs(w.b[1]-w.a[1]),minX=Math.min(w.a[0],w.b[0]),minY=Math.min(w.a[1],w.b[1]),len=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);
 if(horizontal){
 const bx=minX-20,by=minY-70,bw=len+40,bh=180,pl=[];
 for(let x=10;x<bw-15;x+=24){const lift=Math.sin(x/bw*Math.PI)*44;pl.push(`<path d="M${x} ${85-lift} L${x+24} ${85-lift} L${x+24} ${174-lift} L${x} ${174-lift}Z" fill="#C88941" stroke="${INK}" stroke-width="2"/>`)}
 save('bridge-deck-'+i,bw,bh,pl.join(''));decks.push({src:specs['bridge-deck-'+i].src,x:bx,y:by,width:bw,height:bh});
 for(const [name,dy]of [['back',0],['front',85]]){let rail='';for(let x=15;x<bw-5;x+=60){const lift=Math.sin(x/bw*Math.PI)*44;rail+=`<path d="M${x} ${80-lift} V${29-lift}" stroke="#885931" stroke-width="9"/><ellipse cx="${x}" cy="${24-lift}" rx="9" ry="5" fill="#FAFCF2"/>`}rail+=`<path d="M15 35 Q${bw/2} -42 ${bw-15} 35" fill="none" stroke="#885931" stroke-width="10"/><path d="M15 32 Q${bw/2} -45 ${bw-15} 32" fill="none" stroke="#F8F7DF" stroke-width="4"/>`;save('bridge-'+name+'-'+i,bw,bh,rail);props.push({id:'snow-bridge-'+name+i,name:'Arched bridge '+name,src:specs['bridge-'+name+'-'+i].src,x:bx,y:by+dy+85,width:bw,height:bh,anchor:{x:0,y:85/bh},scale:1,shadow:false,wind:false});}
 }else{
 const bx=minX-98,by=minY-35,bw=196,bh=len+70,pl=[];
 for(let y=20;y<bh-10;y+=24){const lift=Math.sin(y/bh*Math.PI)*28;pl.push(`<path d="M19 ${y-lift} Q98 ${y-lift-12} 177 ${y-lift} V${y+24-lift} Q98 ${y+12-lift} 19 ${y+24-lift}Z" fill="${Math.floor(y/24)%3?'#C88941':'#DBA45F'}" stroke="${INK}" stroke-width="2"/>`)}
 save('bridge-deck-'+i,bw,bh,pl.join(''));decks.push({src:specs['bridge-deck-'+i].src,x:bx,y:by,width:bw,height:bh});
 for(const side of [20,176]){let rail='';for(let y=25;y<bh-5;y+=65){const lift=Math.sin(y/bh*Math.PI)*30;rail+=`<path d="M${side} ${y-lift} V${y-lift-58}" stroke="#885931" stroke-width="9"/><ellipse cx="${side}" cy="${y-lift-58}" rx="10" ry="5" fill="#FAFCF2"/>`}rail+=`<path d="M${side} -26 Q${side-13} ${bh/2-70} ${side} ${bh-55}" stroke="#885931" stroke-width="11" fill="none"/><path d="M${side} -30 Q${side-13} ${bh/2-74} ${side} ${bh-59}" stroke="#F3D8A4" stroke-width="4" fill="none"/>`;save('bridge-rail-'+i+'-'+side,bw,bh+70,`<g transform="translate(0 65)">${rail}</g>`);props.push({id:'snow-bridge-rail'+i+side,name:'Arched bridge railing',src:specs['bridge-rail-'+i+'-'+side].src,x:bx,y:by+bh,width:bw,height:bh+70,anchor:{x:0,y:(bh+65)/(bh+70)},scale:1,shadow:false,wind:false});}
 }
}
const foot=T([186,729]),tip=T([186,826]);
// Jetty is generated by the engine using this map's actual docking axis.
const harbor={jetty:{foot,tip,width:104},boats:[{x:tip[0]-170,y:tip[1]+30,turn:Math.PI},{x:tip[0]+175,y:tip[1]+30,turn:Math.PI},{x:tip[0]-450,y:tip[1]+90,turn:Math.PI},{x:6900,y:1760,turn:Math.PI/2},{x:6560,y:4430,turn:Math.PI}],spawn:[cx,cy+centre.ry-75]};
const zones={plaza:{name:'Snowdrift square',x:cx,y:cy+centre.ry-75,spawn:harbor.spawn},centre:{...centre,centre:'centre/centre.json',landmark:statue.id,spawn:harbor.spawn},skating:{...ice,kind:'ice',spawn:[ice.x,ice.y]},lodge:{x:T([355,290])[0],y:T([355,290])[1],spawn:T([355,290])},igloos:{...iglooPlaza,spawn:T([1016,249])},isletWest:{spawn:T([555,949]),x:T([555,949])[0],y:T([555,949])[1]},isletEast:{spawn:T([978,964]),x:T([978,964])[0],y:T([978,964])[1]}};
for(const e of [...activity,...stalls])zones[e.id]={...e,kind:stalls.includes(e)?'stall-row':'paved',spawn:[e.x,e.y]};
const world={width:W,height:H,theme:'snow',name:'Snowdrift',coast,water:[],bridges:[],obstacles:[],islets,walkways,arches:walkways.slice(0,2).map(w=>({a:w.a,b:w.b,w:w.w,lift:28})),paths:paths.map(p=>p.line),zones,ambient:{birds:[T([230,210]),T([700,200]),T([1200,250]),T([400,650]),T([950,720]),T([1300,690])],butterflies:[]},sleepSpots:{},sleepAvoid:[...rings,ice].map(e=>({...e,rx:e.rx+85,ry:e.ry+70})),props:[]};
const walk={width:W,height:H,coast:walking,water:[],bridges:[],obstacles,islets,walkways};
const art={width:W,height:H,sea:'#8CC8CD',ground:{tiles},flats,decks,props};
// Sleepers use all eight existing home poses, each paired with a winter prop.
const counts={chair:2,hammock:3,book:6,leaf:6,wing:7,box:4,rock:4,nod:8};
const base=makeMap('snow',{world,walk,harbor,sleepers:[]}).walk,geo=geometry(base),sizes=sleepHalfWidths(),spots=Object.fromEntries(Object.keys(counts).map(k=>[k,[]]));
seed=110640;
const companions=props.filter(p=>/pine|snow-bush|snow-rock|cabin|stall|sled|planter|berries/.test(p.asset||''));
for(const [pose,n]of Object.entries(counts)){
 const near=pose==='nod'?trunks:companions;
 for(let i=0;spots[pose].length<n&&i<8500;i++){
  const p=near[Math.floor(rnd()*near.length)],a=rnd()*Math.PI*2,r=155+rnd()*155;
  const s=pose==='nod'?[p.id,0,rnd()<.5]:[Math.round(p.x+Math.cos(a)*r),Math.round(p.y+Math.sin(a)*r*.8),rnd()<.5];
  if(pose==='nod'&&(!pathClear(p.x,p.y,75)||reserved(p.x,p.y,50)))continue;
  if(pose!=='nod'&&(!pathClear(s[0],s[1],sizes[pose]+12)||reserved(s[0],s[1],65)))continue;
  const trial={...spots,[pose]:[...spots[pose],s]},res=resolveSleepSpots(base,props,geo.walkable,sizes,{spots:trial,avoid:world.sleepAvoid,warn:false});
  if(res.length===Object.values(trial).flat().length)spots[pose].push(s);
 }
 console.log('sleepers',pose,spots[pose].length+'/'+n);
 
}
// Resolve any crowded last pose with a fitting smaller pose instead of weakening clearance.
for(const pose of ['nod','rock','box','wing','leaf','book','chair','hammock']){
 const near=pose==='nod'?trunks:companions;
 for(let i=0;Object.values(spots).reduce((s,v)=>s+v.length,0)<40&&i<8000;i++){
  const p=near[Math.floor(rnd()*near.length)],a=rnd()*Math.PI*2,r=155+rnd()*180;
  const s=pose==='nod'?[p.id,0,rnd()<.5]:[Math.round(p.x+Math.cos(a)*r),Math.round(p.y+Math.sin(a)*r*.8),rnd()<.5];
  const xy=pose==='nod'?[p.x,p.y]:s;
  if(!pathClear(xy[0],xy[1],sizes[pose]+12)||reserved(xy[0],xy[1],65))continue;
  const trial={...spots,[pose]:[...spots[pose],s]},res=resolveSleepSpots(base,props,geo.walkable,sizes,{spots:trial,avoid:world.sleepAvoid,warn:false});
  if(res.length===Object.values(trial).flat().length)spots[pose].push(s);
 }
}
for(const pose of Object.keys(counts))counts[pose]=spots[pose].length;
world.sleepSpots=spots;world.props=props.map(({id,name,x,y,zone})=>({id,name,x,y,zone}));
const beds=resolveSleepSpots(base,props,geo.walkable,sizes,{spots,avoid:world.sleepAvoid,warn:false});
if(beds.length!==40)throw Error('Expected 40 sleepers');
// Complete the groves without moving the already valid sleeper beds.
let extraTrees=0;
for(let tries=0;trees<68&&tries<30000;tries++){
 const near=trunks[Math.floor(rnd()*trunks.length)],a=rnd()*Math.PI*2,r=250+rnd()*340;
 const x=near.x+Math.cos(a)*r,y=near.y+Math.sin(a)*r*.8;
 if(!inPoly(x,y,offset(snowEdge,100))||!pathClear(x,y,140)||reserved(x,y,100)||reserved(x,y-230,15))continue;
 if(props.some(p=>Math.hypot(p.x-x,(p.y-y)*1.4)<200))continue;
 if(beds.some(b=>Math.hypot(b.x-x,(b.y-y)*1.4)<330||(y>b.y-50&&y<b.y+430&&Math.abs(x-b.x)<230)))continue;
 put('pine-'+(extraTrees%3+1),[x,y],'grove-completion',.84+rnd()*.15,{world:true,foot:'tree'});trees++;extraTrees++;
 const bx=x+130,by=y+45;if(pathClear(bx,by,60)&&!reserved(bx,by,40)&&!beds.some(b=>Math.hypot(b.x-bx,b.y-by)<260))put('snow-bush',[bx,by],'grove-completion',.6,{world:true});
}
console.log('Completed groves',extraTrees,'additional pines');
world.props=props.map(({id,name,x,y,zone})=>({id,name,x,y,zone}));
// Decals soften every tree bank and path edge. No standing obstacle is introduced.
for(let i=0;i<900;i++){
 const x=650+rnd()*6200,y=650+rnd()*3550;if(!inPoly(x,y,snowEdge)||reserved(x,y,8)||!pathClear(x,y,4))continue;
 const s=specs[i%6?'snow-tuft':'pebbles'];flats.push({src:s.src,x,y,width:s.w*(.6+rnd()*.4),height:s.h*(.6+rnd()*.4),flip:rnd()<.5});
}
json(A+'art.json',art);json(D+'world.json',world);json(D+'walk-world.json',walk);json(D+'harbor.json',harbor);json(D+'placements.json',props);json(D+'paths.json',paths);json(D+'sleepers-resolved.json',beds);
json(A+'snow-metrics.json',{name:'Snowdrift',width:W,height:H,coastArea:Math.round(area(coast)),totalLandArea:Math.round(area(coast)+islets.reduce((s,a)=>s+Math.PI*a[2]*a[3],0)),homeRatio:(area(coast)+islets.reduce((s,a)=>s+Math.PI*a[2]*a[3],0))/11090000,trees,props:props.length,smallProps:small,curvedBenches:benchRecords.length,groundFlats:flats.length,groundTiles:tiles.length,activityZones:activity.length,stallRows:stalls.length,sleepers:beds.length,sleepCounts:counts,centrePieces:pieces.length});
console.log('Snowdrift built',Math.round(area(coast)),props.length,'props,',trees,'pines,',beds.length,'sleepers');

await import('./snow-layout-finish.mjs');
await import('./snow-sleepers-finish.mjs');
