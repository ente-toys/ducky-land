// Lantern Lake. Original SVG festival art, home plants/ink, and data-only integration.
// Rebuild: node scripts/themes/lantern-build.mjs
import fs from 'node:fs';
import {geometry,inPoly,inShape} from '../../rive/web/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {drawArcBench} from '../arc-bench-draw.mjs';
const A='public/pixi-art/themes/lantern/',D='rive/web/themes/lantern/';
const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/lantern/';
for(const p of [A+'reuse',A+'centre',D,OUT])fs.mkdirSync(p,{recursive:true});
const W=8000,H=6000,INK='#39472D',SEA='#7FD3D6';
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const f=n=>Math.round(n*10)/10;
let seed=131106;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const svg=(w,h,s,v=`0 0 ${w} ${h}`)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${v}" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
const path=p=>'M'+p.map(a=>a.map(f).join(' ')).join(' L');
const ell=(x,y,rx,ry,n=120)=>Array.from({length:n},(_,i)=>[f(x+Math.cos(i/n*Math.PI*2)*rx),f(y+Math.sin(i/n*Math.PI*2)*ry)]);
const dist=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const ld=(x,y,p)=>Math.min(...p.slice(1).map((b,i)=>dist(x,y,p[i],b)));
function smooth(p,closed=false,n=10){const out=[],N=p.length,P=i=>p[closed?(i+N)%N:Math.max(0,Math.min(N-1,i))];for(let i=0;i<(closed?N:N-1);i++){const [a,b,c,d]=[P(i-1),P(i),P(i+1),P(i+2)];for(let k=0;k<n;k++){const t=k/n;out.push([0,1].map(j=>f(.5*(2*b[j]+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t*t+(-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t))))}}if(!closed)out.push(p.at(-1));return out}
const coast=Array.from({length:160},(_,i)=>{const t=i/160*Math.PI*2,r=1+.024*Math.sin(t*5)+.019*Math.cos(t*7);return[f(4000+3420*r*Math.cos(t)),f(3000+2370*r*Math.sin(t))]});
const grass=coast.map(([x,y])=>[f(4000+(x-4000)*.965),f(3000+(y-3000)*.957)]);
const walkCoast=coast.map(([x,y])=>[f(4000+(x-4000)*.99),f(3000+(y-3000)*.986)]);
const lakeOutline=Array.from({length:140},(_,i)=>{const t=i/140*Math.PI*2,r=1+.035*Math.sin(t*3)+.022*Math.cos(t*5);return[f(4350+1610*r*Math.cos(t)),f(2780+1010*r*Math.sin(t))]});
// Lake islands are genuine dry holes in the water polygon. Paired zero-width seams
// make the even-odd polygon work with the existing shared geometry (no engine edit).
const islands=[[4370,2500,330,235],[5020,3050,245,180]];
let waterPoly=[...lakeOutline,lakeOutline[0]];
for(const [x,y,rx,ry]of islands){const e=ell(x,y,rx,ry,72).reverse();waterPoly.push(e[0],...e,e[0],lakeOutline[0]);}
const water=[{poly:waterPoly,x:4350,y:2780,rx:1610,ry:1010}];
const paths=[
 {w:220,line:smooth([[1980,3160],[2110,3590],[2830,4050],[4190,4250],[5630,4060],[6290,3530],[6310,2400],[5740,1640],[4590,1420],[3270,1550],[2320,2080],[1980,2660],[1980,3160]])},
 {w:205,line:smooth([[1980,2800],[1530,2530],[1320,1960],[1710,1350],[2550,1040],[3350,1160],[3650,1470]])},
 {w:205,line:smooth([[1980,3160],[1380,3450],[1250,4020],[1760,4620],[2700,4780],[3650,4750],[4310,4250]])},
 {w:205,line:smooth([[4310,4250],[4750,4730],[5730,4710],[6460,4200],[6720,3480],[6620,2940],[6310,2820]])},
 {w:205,line:smooth([[5740,1640],[6080,1220],[6510,1730],[6860,2390],[6620,2940]])},
 {w:190,line:smooth([[1320,1960],[1000,2320],[1040,2890],[1380,3450]])},
 {w:190,line:smooth([[3270,1550],[3630,1830],[4300,1940],[4370,2180]])},
 {w:190,line:smooth([[5020,3220],[5200,3650],[5370,4120]])},
 {w:205,line:smooth([[2700,4780],[2910,5000],[2920,5235]])},
];
const plazas=[
 {id:'centre',name:'Paper lantern gate',x:1980,y:2890,rx:650,ry:500,kind:'stone'},
 {id:'release',name:'Lake lantern terrace',x:4310,y:4250,rx:750,ry:460,kind:'wood'},
 {id:'activity-1',name:'Moon dance court',x:1410,y:1680,rx:410,ry:310,kind:'stone'},
 {id:'activity-2',name:'Firefly lawn',x:6620,y:2940,rx:400,ry:330,kind:'lawn'},
 {id:'activity-3',name:'Wishes garden',x:2530,y:4560,rx:520,ry:310,kind:'stone'},
 {id:'stalls-1',name:'North festival stalls, reserved',x:5500,y:1250,rx:460,ry:210,kind:'stone'},
 {id:'stalls-2',name:'West festival stalls, reserved',x:1450,y:3890,rx:460,ry:230,kind:'stone'},
];
const pd=(x,y)=>Math.min(...paths.map(p=>ld(x,y,p.line)-p.w/2));
const open=(x,y,pad=0)=>plazas.some(p=>((x-p.x)/(p.rx+pad))**2+((y-p.y)/(p.ry+pad))**2<1);
const onLake=(x,y,pad=0)=>inShape(x,y,water[0],pad);
const props=[],decks=[],flats=[],floating=[],obstacles=[],walkways=[],bridges=[],arches=[];
const deckClear=(x,y,pad=50)=>walkways.every(b=>dist(x,y,b.a,b.b)>b.w/2+pad);
let pid=0;
const copy=(src,dest)=>{fs.copyFileSync(src,A+dest);return dest};
const plantSizes={tree1:[260,360],tree2:[180,360],tree3:[300,380],tree4:[200,280],tree5:[150,380],bush1:[130,100],bush2:[168,110],bush3:[116,104],bush4:[140,100],bush5:[170,110],bush6:[120,96],flower1:[48,36],flower2:[48,36],flower3:[44,36]};
const assets={};
for(const [name,[width,height]]of Object.entries(plantSizes)){const file=name.replace(/(\d)/,'-$1')+'.svg';assets[name]={src:copy('public/pixi-art/plants/'+file,'reuse/'+file),width,height}}
const fair=JSON.parse(fs.readFileSync('public/pixi-art/themes/fair/art.json'));
for(const [key,re]of [['rock',/rock-round/],['bench',/bench-park/],['blanket',/picnic-blanket/],['umbrella',/umbrella-cafe/],['sandcastle',/sandcastle-small/],['shell',/shell-scallop/],['reeds',/nature--reeds/],['lily',/lily-pad-flower/]]){const p=fair.props.find(p=>re.test(p.src));if(!p)throw Error(key);assets[key]={src:copy('public/pixi-art/themes/fair/'+p.src,'reuse/'+key+'.svg'),width:p.width,height:p.height,scale:p.scale,anchor:p.anchor}}
function put(key,x,y,{name=key,scale=1,kind='base',zone='',flip=false,shadow=true}={}){const a=assets[key];const p={id:'lantern-'+pid++,name,asset:key,src:a.src,x:f(x),y:f(y),width:a.width,height:a.height,anchor:a.anchor||{x:.5,y:1},scale:scale*(a.scale||1),flip,shadow,zone};props.push(p);const w=p.width*p.scale,h=p.height*p.scale;
 if(kind==='tree')obstacles.push({x:p.x,y:p.y-9,rx:31,ry:22,prop:p.id});
 if(kind==='bush')obstacles.push({x:p.x,y:p.y-12,rx:w*.33,ry:Math.min(32,h*.22),prop:p.id});
 if(kind==='base')obstacles.push({x:p.x,y:p.y-12,rx:w*.39,ry:Math.min(65,h*.16),prop:p.id});
 if(kind==='pole')obstacles.push({x:p.x,y:p.y-6,rx:16,ry:12,prop:p.id});return p}
function art(name,w,h,content){fs.writeFileSync(A+name+'.svg',svg(w,h,content));assets[name]={src:name+'.svg',width:w,height:h};}
// Ribbed paper lantern. Flat warm panels, home ink, cream reflections, no gradients.
function lantern(x,y,s=1,color='#F7A346'){return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="2.7"><path d="M-15 -42 H15 L20 -36 H-20Z" fill="#A66536"/><path d="M-22 -35 Q-44 -14 -31 18 Q-23 36 0 38 Q24 35 32 15 Q44 -16 22 -35Z" fill="${color}"/><path d="M14 -35 Q37 -7 22 25 L12 34 Q29 1 9 -35" fill="#E4783C" stroke="none"/><path d="M-10 -35 Q-25 -3 -12 32 M10 -35 Q23 -2 12 32 M-32 -12 Q0 -3 33 -12 M-34 5 Q0 14 34 5 M-28 22 Q0 29 28 22" fill="none" stroke="#B7733F" stroke-width="1.8"/><path d="M-18 -25 Q-28 -11 -25 -2" fill="none" stroke="#FFF4B5" stroke-width="6"/><path d="M-15 37 H15 V44 H-15Z" fill="#AE683D"/><path d="M0 44 V62 M-6 62 H6 L9 77 H-9Z" fill="#D65E3F"/><path d="M0 -42 V-59" fill="none"/></g>`}
art('lantern-lamp',104,252,`<g stroke="${INK}" stroke-width="3"><ellipse cx="52" cy="245" rx="27" ry="5" fill="#8F663B"/><path d="M46 243 V23 H83 V34 H57 V243Z" fill="#BA7D3F"/><path d="M48 33 V236" stroke="#F6CE7B"/><circle cx="51" cy="17" r="8" fill="#F2C55A"/></g>${lantern(77,108,.67)}`);
art('lantern-rack',400,270,`<g fill="#B47840" stroke="${INK}" stroke-width="3"><path d="M30 264 V40 H40 V264Z M360 264 V40 H370 V264Z"/><path d="M20 42 Q200 2 380 42 V55 Q200 17 20 55Z"/><circle cx="35" cy="33" r="9" fill="#E7BA55"/><circle cx="365" cy="33" r="9" fill="#E7BA55"/></g>${[85,160,240,315].map((x,i)=>lantern(x,120+(i%2)*32,.8,i%2?'#F8CE62':'#EE8A51')).join('')}`);
art('string-lights',510,235,`<g stroke="${INK}" stroke-width="3" fill="#BA7C41"><path d="M18 230 V30 H27 V230Z M483 230 V30 H492 V230Z"/><circle cx="23" cy="22" r="8" fill="#F4CD63"/><circle cx="488" cy="22" r="8" fill="#F4CD63"/><path d="M24 39 Q255 136 488 39" fill="none"/></g>${[80,166,255,345,434].map((x,i)=>lantern(x,99+Math.sin((x-24)/464*Math.PI)*44,.48,i%2?'#F9D768':'#F39A4E')).join('')}`);
art('planter',116,100,`<g stroke="${INK}" stroke-width="2.4"><path d="M21 58 H97 L85 94 Q58 103 33 94Z" fill="#BE7957"/><path d="M22 60 Q60 72 97 60 V72 Q60 82 22 72Z" fill="#E8B37D"/><ellipse cx="59" cy="55" rx="43" ry="14" fill="#4B922F"/>${[[30,41],[51,28],[73,36],[90,48]].map(([x,y],i)=>`<path d="M${x} 58 V${y}" fill="none"/>`+[0,1,2,3,4].map(t=>`<circle cx="${x+Math.cos(t*1.256)*8}" cy="${y+Math.sin(t*1.256)*7}" r="6" fill="${i%2?'#F8D780':'#F5A6A0'}"/>`).join('')+`<circle cx="${x}" cy="${y}" r="4" fill="#FFE8A1"/>`).join('')}</g>`);
art('wish-sign',120,182,`<g stroke="${INK}" stroke-width="3"><path d="M55 179 V28 H65 V179Z" fill="#9C6A3B"/><path d="M11 26 Q60 14 110 26 V102 Q60 115 11 102Z" fill="#EEC981"/><path d="M21 37 Q60 29 100 37" stroke="#FFF0B4" fill="none"/><path d="M33 57 Q60 41 87 57 L78 82 H42Z" fill="#F29B54"/><path d="M48 87 H73 M60 88 V99" fill="none"/></g>`);
art('tea-table',210,156,`<g stroke="${INK}" stroke-width="2.8"><path d="M45 96 V151 H57 V97 M153 96 V151 H165 V97" fill="#8C5D36"/><ellipse cx="105" cy="86" rx="99" ry="37" fill="#8F6339"/><ellipse cx="105" cy="77" rx="99" ry="37" fill="#C8914E"/><path d="M14 71 Q78 43 155 62" fill="none" stroke="#F0C67B"/><ellipse cx="67" cy="72" rx="29" ry="12" fill="#F7DE9A"/><path d="M48 58 Q44 83 68 82 Q91 80 86 58Z" fill="#F6D780"/><path d="M87 61 Q107 59 100 72 L86 75" fill="none"/><path d="M123 53 Q116 77 144 78 Q172 72 161 51Z" fill="#F3B75B"/><path d="M119 53 Q141 39 164 51 M133 40 L147 39 M161 59 L180 47 L175 69 H163" fill="#F4D081"/><path d="M59 48 Q52 37 60 28 M139 31 Q131 20 139 12" fill="none" stroke="#FFF0BC"/></g>`);
// Detailed festival stalls use the home's thick ink, scalloped canopy and wood grain.
for(const [n,accent]of [['stall-coral','#EA8062'],['stall-gold','#E8B755'],['stall-mint','#64B3A0']]){
 art(n,360,374,`<g stroke="${INK}" stroke-width="3"><path d="M34 177 V356 H326 V177" fill="#C98F4D"/><path d="M47 177 V349 H60 V178 M300 177 V349 H313 V178" fill="#8C5D35"/><path d="M24 261 H336 V310 H24Z" fill="#E2B56A"/><path d="M30 310 V346 H330 V310" fill="#B47B3E"/><path d="M46 321 H310 M48 334 H312 M72 311 V344 M282 311 V344" fill="none" stroke="#8E643B"/><path d="M17 168 L50 78 Q180 44 310 78 L343 168Z" fill="#FFF0BC"/>${[0,2,4,6].map(i=>`<path d="M${50+i*37} 78 L${17+i*46} 168 H${63+i*46} L${87+i*37} 78Z" fill="${accent}" stroke="none"/>`).join('')}<path d="M17 168 Q40 203 64 170 Q87 203 110 170 Q134 202 157 170 Q180 202 204 170 Q227 202 250 170 Q274 202 297 170 Q321 201 343 168" fill="${accent}"/><path d="M50 78 Q180 44 310 78" fill="none"/><path d="M32 259 H329" stroke="#FFF0B9" stroke-width="7"/>${lantern(105,211,.45,'#FFD674')}${lantern(179,205,.46)}${lantern(254,211,.45,'#FFD674')}<path d="M65 280 H131 M156 280 H215 M242 280 H298" stroke="#FFF0BC"/><path d="M43 356 H319" fill="none" stroke-width="7"/></g>`);
}
art('floating-lantern',92,106,`<ellipse cx="46" cy="91" rx="40" ry="10" fill="none" stroke="#FFF0AD" stroke-width="2" opacity=".8"/><path d="M34 99 H58" stroke="#F7D78A" stroke-width="3"/>${lantern(46,50,.58,'#FFC76D')}`);
// Gate centre: independently sortable roof/back, posts and hanging lanterns.
const pieces=[],blocked=[];const CX=1980,CY=2820;
function piece(id,x,y,w,h,layer,s,sortY=y+h){fs.writeFileSync(A+'centre/'+id+'.svg',svg(w,h,s,`${x} ${y} ${w} ${h}`));pieces.push({id,file:id+'.svg',layer,x,y,width:w,height:h,anchor:{x:0,y:0},at:[x,y],sortY});}
piece('gate-roof',-515,-756,1030,430,'sorted',`<g stroke="${INK}" stroke-width="4"><path d="M-468 -500 Q-390 -540 -355 -660 Q0 -740 355 -660 Q390 -540 468 -500 Q390 -455 310 -477 H-310 Q-390 -455 -468 -500Z" fill="#B9543F"/><path d="M-473 -510 Q-396 -515 -358 -667 Q0 -750 358 -667 Q395 -515 473 -510 L482 -487 Q391 -441 308 -463 H-308 Q-390 -440 -482 -487Z" fill="#F2C264"/><path d="M-347 -653 Q0 -721 347 -653 Q300 -550 342 -501 H-342 Q-301 -556 -347 -653Z" fill="#D66F43"/>${Array.from({length:19},(_,i)=>{const x=-325+i*36;return `<path d="M${x} ${-666+Math.abs(x)*.075} Q${x*.85} -560 ${x*1.05} -501" fill="none" stroke="#984E35" stroke-width="3"/>`}).join('')}<path d="M-440 -491 Q-370 -466 -310 -480 H310 Q377 -467 440 -491" stroke="#FFF0B1" fill="none" stroke-width="7"/><path d="M-369 -678 Q0 -762 369 -678" fill="none" stroke="#F9D98B" stroke-width="12"/><path d="M-42 -734 L0 -753 L42 -734" fill="#F2BE5C"/><rect x="-115" y="-491" width="230" height="69" rx="7" fill="#9E5237"/><path d="M-91 -476 H91 V-439 H-91Z" fill="#F0C46A"/><path d="M-61 -458 H61 M-20 -470 V-447 M20 -470 V-447" fill="none"/></g>`, -80);
for(const side of [-1,1]){const x=side*345;piece('gate-post-'+(side<0?'left':'right'),x-40,-480,80,520,'sorted',`<g stroke="${INK}" stroke-width="3.5"><path d="M${x-28} -480 H${x+28} V6 H${x-28}Z" fill="#BD5C3E"/><path d="M${x-24} -474 H${x-11} V-8 H${x-24}Z" fill="#EEAF64"/><path d="M${x+10} -470 H${x+27} V-4 H${x+10}Z" fill="#8F4934"/><path d="M${x-39} -19 H${x+39} V33 H${x-39}Z" fill="#E4CD91"/><path d="M${x-39} 16 H${x+39}" fill="none"/><path d="M${x-38} -484 H${x+38} V-455 H${x-38}Z" fill="#D9A552"/></g>`,20);blocked.push({name:'Gate '+side+' post',ellipse:{x,y:7,rx:42,ry:32}})}
for(const [id,x,s]of [['left',-215,1.28],['right',215,1.28],['middle',0,.9]])piece('gate-lantern-'+id,x-65,-465,130,210,'sorted',lantern(x,-378,s,'#FBC263'),30);
const centre={theme:'lantern',name:'Paper Lantern Gate',concept:'13-lantern.png, ceremonial gate beside the lake',placement:{x:CX,y:CY,scale:1},pieces,outerEdge:{x:0,y:70,rx:650,ry:500},blocked,walkable:[{ellipse:{x:0,y:70,rx:630,ry:480}}],stairs:[],spawn:[0,400],capacity:{duckies:100,note:'Open patterned gate court and connected release terrace'}};
save(A+'centre/centre.json',centre);
for(const p of pieces){const sy=p.sortY;props.push({id:'lantern-centre-'+p.id,name:'Paper lantern gate '+p.id,src:'centre/'+p.file,x:CX+p.x+p.width/2,y:CY+sy,width:p.width,height:p.height,anchor:{x:.5,y:(sy-p.y)/p.height},scale:1,flip:false,shadow:false,wind:false,zone:'centre',centrePiece:p});}
for(const p of blocked)obstacles.push({...p.ellipse,x:CX+p.ellipse.x,y:CY+p.ellipse.y});
// The lake promenade meets two arched footbridges, then two planted islands.
function bridge(id,x1,y1,x2,y2,width=168,lift=75){
 const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
 const at=(t,s,z=0)=>[x1+dx*t+nx*s,y1+dy*t+ny*s-lift*4*t*(1-t)-z];
 const rail=(s,z)=>path(Array.from({length:41},(_,i)=>at(i/40,s,z)));
 const poly=[...Array.from({length:41},(_,i)=>at(i/40,-width/2)),...Array.from({length:41},(_,i)=>at(1-i/40,width/2))];
 let b=`<path d="${path(poly)}Z" fill="#CA914E" stroke="${INK}" stroke-width="3"/>`;
 for(let i=0;i<=25;i++)b+=`<path d="${path([at(i/25,-width/2),at(i/25,width/2)])}" stroke="#8F653C" stroke-width="2"/>`;
 for(const side of [-1,1]){for(let i=0;i<=10;i++)b+=`<path d="${path([at(i/10,side*width/2),at(i/10,side*width/2,68)])}" stroke="${INK}" stroke-width="10"/><path d="${path([at(i/10,side*width/2),at(i/10,side*width/2,68)])}" stroke="#C38A48" stroke-width="6"/>`;b+=`<path d="${rail(side*width/2,68)}" fill="none" stroke="${INK}" stroke-width="13"/><path d="${rail(side*width/2,68)}" fill="none" stroke="#D5A55C" stroke-width="8"/><path d="${rail(side*width/2,36)}" fill="none" stroke="#A57640" stroke-width="5"/>`;}
 const all=poly.concat(Array.from({length:41},(_,i)=>at(i/40,-width/2,80)),Array.from({length:41},(_,i)=>at(i/40,width/2,80))),x0=Math.floor(Math.min(...all.map(p=>p[0])))-10,y0=Math.floor(Math.min(...all.map(p=>p[1])))-10,w=Math.ceil(Math.max(...all.map(p=>p[0])))-x0+10,h=Math.ceil(Math.max(...all.map(p=>p[1])))-y0+10;
 fs.writeFileSync(A+id+'.svg',svg(w,h,b,`${x0} ${y0} ${w} ${h}`));decks.push({src:id+'.svg',x:x0,y:y0,width:w,height:h});walkways.push({a:[x1,y1],b:[x2,y2],w:width});arches.push({a:[x1,y1],b:[x2,y2],w:width,r:lift});
 // Geometry's bridge exception is axis-aligned, so use a string of close squares
 // only under the deck, never a broad rectangle making surrounding water walkable.
 for(let i=0;i<=Math.ceil(len/35);i++){const t=i/Math.ceil(len/35);bridges.push({x:f(x1+dx*t),y:f(y1+dy*t),w:width-12,h:width-12});}
}
bridge('lake-bridge-north',4370,1680,4370,2380,185,78);
bridge('lake-bridge-islets',4520,2580,4940,3010,185,70);
bridge('lake-bridge-south',5020,3110,5020,3880,185,84);
// Moon pavilion on the smaller island, under its own warm paper lanterns.
art('pavilion',340,365,`<g stroke="${INK}" stroke-width="3"><ellipse cx="170" cy="338" rx="156" ry="22" fill="#D5B46B"/><path d="M47 165 V327 H61 V165 M278 165 V327 H292 V165" fill="#A76B37"/><path d="M30 162 Q101 120 170 54 Q239 120 310 162 Q170 209 30 162Z" fill="#C86442"/><path d="M25 162 Q170 204 315 162 M170 54 V33" fill="none" stroke="#EBC46E" stroke-width="10"/><circle cx="170" cy="27" r="11" fill="#F4CE74"/><path d="M76 316 H264 M76 284 H264" fill="none" stroke="#A76B37" stroke-width="8"/>${lantern(110,225,.56)}${lantern(230,225,.56,'#FFD575')}</g>`);
put('pavilion',5020,3070,{name:'Lake moon pavilion',kind:'none'});
for(const x of [4900,5140])obstacles.push({x,y:3038,rx:17,ry:16});
for(const [x,y]of [[4290,2490],[4500,2570]])put('tree1',x,y,{name:'Tree',kind:'tree',scale:1.05});
put('string-lights',4370,2570,{name:'Paper string lights',kind:'none',scale:.9});
put('bench',4370,2670,{name:'Lake garden bench',kind:'base',scale:1.2});
for(const [x,y]of [[4130,2540],[4580,2460],[4830,3060],[5140,3090]]){put('bush2',x,y,{name:'Bush',kind:'bush',scale:1.05});put('flower2',x+50,y+20,{name:'Flowers',kind:'none',scale:1.5});}
// Patterned plaza floors, plus the home's exact slatted curved benches.
let paving='';
const benchStats=[];
for(const p of plazas){
 paving+=`<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="${p.kind==='lawn'?'#8CB741':p.kind==='wood'?'#C99655':'#F2D99E'}" stroke="${INK}" stroke-width="3"/>`;
 for(const r of [.98,.89,.79,.48])paving+=`<ellipse cx="${p.x}" cy="${p.y}" rx="${f(p.rx*r)}" ry="${f(p.ry*r)}" fill="none" stroke="${r===.89?'#BE8055':'#A18C60'}" stroke-width="${r===.89?13:2.3}"/>`;
 if(p.kind!=='lawn'){
 for(let i=0;i<40;i++){const a=i/40*Math.PI*2,az=(i+1)/40*Math.PI*2;const b=i%2?.48:.79;
 if(i%2===0){const band=[...Array.from({length:5},(_,j)=>[p.x+Math.cos(a+(az-a)*j/4)*p.rx*.79,p.y+Math.sin(a+(az-a)*j/4)*p.ry*.79]),...Array.from({length:5},(_,j)=>[p.x+Math.cos(az-(az-a)*j/4)*p.rx*.98,p.y+Math.sin(az-(az-a)*j/4)*p.ry*.98])];paving+=`<path d="${path(band)}Z" fill="${p.kind==='wood'?'#E1B671':'#FFF0BA'}" stroke="#AF9663" stroke-width="1.6"/>`;}
 paving+=`<path d="M${f(p.x+Math.cos(a)*p.rx*b)} ${f(p.y+Math.sin(a)*p.ry*b)} L${f(p.x+Math.cos(a)*p.rx*.98)} ${f(p.y+Math.sin(a)*p.ry*.98)}" stroke="#AB925F" stroke-width="2.1"/>`}
 // Delicate staggered stone/wood joints across the OPEN centre, no giant blank disc.
 const clip='clip-'+p.id;paving+=`<defs><clipPath id="${clip}"><ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx*.78}" ry="${p.ry*.78}"/></clipPath></defs><g clip-path="url(#${clip})" stroke="#B6A376" stroke-width="1.7" opacity=".62">`;
 for(let y=p.y-p.ry;y<p.y+p.ry;y+=66){paving+=`<path d="M${p.x-p.rx} ${y} H${p.x+p.rx}"/>`;for(let x=p.x-p.rx+((Math.round(y/66)%2)*70);x<p.x+p.rx;x+=140)paving+=`<path d="M${x} ${y} V${y+66}"/>`;}paving+='</g>';
 // Lotus petal inlay, scaled to the plaza, flat enough to walk over.
 for(let i=0;i<8;i++){const a=i*Math.PI/4,at=(r,t)=>[p.x+Math.cos(t)*p.rx*r,p.y+Math.sin(t)*p.ry*r],q=[at(.045,a),at(.18,a-.24),at(.34,a),at(.18,a+.24)];paving+=`<path d="M${q[0].map(f)} Q${q[1].map(f)} ${q[2].map(f)} Q${q[3].map(f)} ${q[0].map(f)}Z" fill="${i%2?'#F0CA86':'#DCA771'}" stroke="#A98457" stroke-width="2"/>`;}
 }
 for(const deg of [35,145,215,325]){const a=deg*Math.PI/180,x=p.x+Math.cos(a)*(p.rx+65),y=p.y+Math.sin(a)*(p.ry+55);if(pd(x,y)<60||onLake(x,y))continue;put('lantern-lamp',x,y,{name:'Lantern lamp',kind:'pole',zone:p.id});put('planter',x+70,y+10,{name:'Flower planter',kind:'bush',zone:p.id,scale:.8});}
 for(const deg of (p.id==='centre'?[40,140]:p.id==='activity-2'?[0,270]:[65,115,245,295])){const r=p.rx*.91,ground=(a,s)=>[p.x+Math.cos(a*Math.PI/180)*s,p.y+Math.sin(a*Math.PI/180)*s*p.ry/p.rx];const [x,y]=ground(deg,r);if(pd(x,y)<38||onLake(x,y))continue;const span=250/r*180/Math.PI,arc=(r)=>Array.from({length:25},(_,i)=>ground(deg-span/2+span*i/24,r));const all=[...arc(r-24),...arc(r+30)],x0=Math.floor(Math.min(...all.map(p=>p[0])))-7,y0=Math.floor(Math.min(...all.map(p=>p[1])))-57,w=Math.ceil(Math.max(...all.map(p=>p[0])))-x0+7,h=Math.ceil(Math.max(...all.map(p=>p[1])))-y0+7;const src=`bench-${p.id}-${deg}.svg`;fs.writeFileSync(A+src,svg(w,h,drawArcBench({deg,span},{ground,sIn:r-20,sOut:r+20,back:r+24,seat:18,top:49,ink:INK,line:2.5,thin:1.6,spindleDeg:3.2*446/r}).join(''),`${x0} ${y0} ${w} ${h}`));props.push({id:'lantern-bench-'+p.id+'-'+deg,name:'Curved wooden bench',src,x,y,width:w,height:h,anchor:{x:(x-x0)/w,y:(y-y0)/h},scale:1,flip:false,wind:false,zone:p.id});const poly=[...arc(r-23),...arc(r+29).reverse()];obstacles.push({poly,bench:true});benchStats.push({plaza:p.id,deg,span,poly});}
}
// Low curved release rails follow the lake-facing edge of the terrace, with a
// wide central opening for launching paper lanterns. Posts sort with the crowd.
for(const [i,[a0,a1]]of [[198,235],[305,342]].entries()){
 const at=(a,z=0)=>[4310+Math.cos(a*Math.PI/180)*760,4250+Math.sin(a*Math.PI/180)*465-z];
 const arc=z=>Array.from({length:40},(_,j)=>at(a0+(a1-a0)*j/39,z));
 let s='';for(let j=0;j<=6;j++){const a=a0+(a1-a0)*j/6;s+=`<path d="${path([at(a),at(a,78)])}" stroke="${INK}" stroke-width="12"/><path d="${path([at(a),at(a,78)])}" stroke="#BF8745" stroke-width="8"/>`;const [x,y]=at(a,83);s+=`<circle cx="${f(x)}" cy="${f(y)}" r="7" fill="#EAC36B" stroke="${INK}" stroke-width="2.5"/>`;}
 for(const z of [40,73])s+=`<path d="${path(arc(z))}" fill="none" stroke="${INK}" stroke-width="11"/><path d="${path(arc(z))}" fill="none" stroke="#D6A25A" stroke-width="7"/>`;
 const points=[...arc(0),...arc(95)],x0=Math.floor(Math.min(...points.map(p=>p[0])))-10,y0=Math.floor(Math.min(...points.map(p=>p[1])))-10,w=Math.ceil(Math.max(...points.map(p=>p[0])))-x0+10,h=Math.ceil(Math.max(...points.map(p=>p[1])))-y0+10,src=`release-rail-${i}.svg`,y=Math.max(...arc(0).map(p=>p[1]));
 fs.writeFileSync(A+src,svg(w,h,s,`${x0} ${y0} ${w} ${h}`));props.push({id:'lantern-release-rail-'+i,name:'Lantern release terrace rail',src,x:x0+w/2,y,width:w,height:h,anchor:{x:.5,y:(y-y0)/h},scale:1,shadow:false,wind:false,zone:'release'});
 const poly=[...arc(0).map(([x,y])=>[x,y-6]),...arc(0).reverse().map(([x,y])=>[x,y+6])];obstacles.push({poly,rail:true});
}
// Existing stalls stand outside reserved rows and activity floors.
for(const [i,[x,y]]of [[2940,1290],[3820,1150],[4570,1190],[1190,3260],[1710,3550],[6080,3890],[5970,1780]].entries()){put(['stall-coral','stall-gold','stall-mint'][i%3],x,y,{name:'Paper lantern stall',kind:'base',zone:'festival'});put('lantern-rack',x+260,y+20,{name:'Lantern display rack',kind:'base',scale:.58});put('tea-table',open(x-190,y+210,60)?x+420:x-190,y+210,{name:'Tea table',kind:'base',scale:.8});}
for(const [x,y,s]of [[3210,1430,1.05],[5200,1510,.95],[1300,4330,.9],[2900,4130,1],[5880,4270,1],[4310,4000,1.3],[5850,2400,1],[6450,3410,1]])put('string-lights',x,y,{name:'Festival string lights',kind:'none',scale:s});
for(const [x,y]of [[2000,3380],[3610,4210],[5350,4130],[6120,2870],[3180,1610]])put('wish-sign',x,y,{name:'Wish notice board',kind:'pole',scale:.85});
for(const [x,y]of [[6430,3940],[6780,3590]])put('umbrella',x,y,{name:'Beach umbrella',kind:'pole',scale:.72});
put('blanket',6650,4050,{name:'Picnic blanket',kind:'none',scale:.8});put('sandcastle',6800,3840,{name:'Sandcastle',kind:'base',scale:.55});
const beach=ell(6650,3900,580,620);
// Furniture occupies the shoulders, with its entire footprint clear of a path.
// Do this before planting and sleepers, so those later passes respect the result.
const shoulderMoves=[];
for(const p of props){
 const feet=obstacles.filter(o=>o.prop===p.id);if(!feet.length)continue;
 const room=Math.max(...feet.map(o=>o.rx))+22;
 if(pd(p.x,p.y)>=room)continue;
 let best=null;
 for(let radius=35;radius<=650&&!best;radius+=25)for(let j=0;j<64;j++){
  const a=j/64*Math.PI*2,x=p.x+Math.cos(a)*radius,y=p.y+Math.sin(a)*radius;
  if(pd(x,y)<room||!inPoly(x-room,y,grass)||!inPoly(x+room,y,grass)||onLake(x,y,room)||open(x,y,45)||!deckClear(x,y,room))continue;
  if(props.some(q=>q!==p&&obstacles.some(o=>o.prop===q.id)&&Math.hypot(x-q.x,(y-q.y)*1.6)<room+Math.min(150,q.width*q.scale*.35)))continue;
  best=[f(x),f(y)];break;
 }
 if(!best)throw Error('No free path shoulder for '+p.name+' '+p.id);
 const dx=best[0]-p.x,dy=best[1]-p.y;shoulderMoves.push({id:p.id,from:[p.x,p.y],to:best});p.x=best[0];p.y=best[1];for(const o of feet){o.x=f(o.x+dx);o.y=f(o.y+dy);}
}
// Natural clusters: varied broadleaf trees, poplars, bushes and stones. Keep both
// canopy silhouettes and trunk footprints away from paths and open zone interiors.
function plantFree(x,y,r=140){if(!inPoly(x,y,grass)||onLake(x,y,70)||open(x,y,90)||pd(x,y)<r||inPoly(x,y,beach)||!deckClear(x,y,r))return false;if(x>1430&&x<2520&&y>1830&&y<3330)return false;return !props.some(p=>Math.hypot(p.x-x,(p.y-y)*1.25)<r+Math.min(160,p.width*p.scale*.36))}
const clusterCenters=[[1230,2380],[1750,1110],[2500,880],[3250,900],[4240,920],[5180,970],[6090,1210],[6660,1840],[6950,2420],[7010,3200],[6410,4480],[5590,4860],[4590,4890],[3560,4930],[1920,4750],[1270,4340],[1000,3620],[1000,2920],[2680,3550],[5780,3580],[5780,2140],[2770,2020]];
let trees=0;
for(const [ci,[cx,cy]]of clusterCenters.entries())for(let n=0;n<5;n++){let ok=false;for(let t=0;t<100;t++){const a=rnd()*Math.PI*2,r=90+rnd()*400,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.7;if(!plantFree(x,y,155))continue;const type=[1,3,1,4,2,5][(ci+n)%6];put('tree'+type,x,y,{name:'Tree',kind:'tree',scale:type===5?1.05:1.1+rnd()*.17,flip:rnd()<.5,zone:'grove-'+ci});trees++;ok=true;break;}if(!ok)break;}
for(let t=0;trees<70&&t<30000;t++){const x=700+rnd()*6600,y=650+rnd()*4700;if(plantFree(x,y,160)){put('tree'+[1,3,4,2,5][trees%5],x,y,{name:'Tree',kind:'tree',scale:1.18,zone:'grove'});trees++;}}
// Bushes gathered at the tree bases and low mixed flower borders on the lake edge.
for(const tree of [...props.filter(p=>p.name==='Tree'&&p.zone)]){for(let n=0;n<2;n++){const x=tree.x+(n?1:-1)*(95+rnd()*75),y=tree.y+10+rnd()*50;if(!inPoly(x,y,grass)||onLake(x,y)||pd(x,y)<85||open(x,y,20)||!deckClear(x,y,90))continue;put('bush'+(1+Math.floor(rnd()*6)),x,y,{name:'Bush',kind:'bush',scale:.85+rnd()*.3,zone:tree.zone});put('flower'+(1+Math.floor(rnd()*3)),x+50,y+30,{name:'Flowers',kind:'none',scale:1.5});}}
for(let i=0;i<70;i++){const a=i/70*Math.PI*2,x=4350+Math.cos(a)*1775,y=2780+Math.sin(a)*1155;if(!inPoly(x,y,grass)||onLake(x,y)||pd(x,y)<100||open(x,y,80)||!deckClear(x,y,90)||props.some(p=>Math.hypot(x-p.x,y-p.y)<110))continue;put(i%5===0?'reeds':'bush'+(i%6+1),x,y,{name:i%5===0?'Lake reeds':'Bush',kind:i%5===0?'none':'bush',scale:i%5===0?.65:.8});put('flower'+(i%3+1),x-65,y+10,{name:'Flowers',kind:'none',scale:1.8});}
for(let i=0;i<32;i++){const a=rnd()*Math.PI*2,x=4350+Math.cos(a)*(1530+rnd()*220),y=2780+Math.sin(a)*(950+rnd()*190);if(!onLake(x,y)&&inPoly(x,y,grass)&&pd(x,y)>90&&!open(x,y,15)&&deckClear(x,y,60))put('rock',x,y,{name:'Lake rock',kind:'base',scale:.65});}
// Quiet lake lanterns and lilies. All remain SVG, bobbed by the existing engine.
for(let i=0;i<33;i++){let x,y;do{x=2850+rnd()*3000;y=1830+rnd()*1860}while(!onLake(x,y)||walkways.some(b=>dist(x,y,b.a,b.b)<200));floating.push({src:'floating-lantern.svg',x:f(x),y:f(y),width:76,height:88,phase:rnd()*6.28,anchor:{x:.5,y:.8}});}
for(let i=0;i<12;i++){const a=i/12*Math.PI*2,x=4350+Math.cos(a)*1430,y=2780+Math.sin(a)*830;if(onLake(x,y))floating.push({src:assets.lily.src,x:f(x),y:f(y),width:110,height:54,phase:i*.7});}
// Harbor at the south shore, foot in the landing path, long enough for open sea.
const harbor={jetty:{foot:[2920,5230],tip:[2920,5650],width:125},boats:[{x:2740,y:5520,turn:0},{x:3100,y:5520,turn:0},{x:2740,y:5760,turn:0}],spawn:[1980,3220]};
const zones={plaza:{x:1980,y:3220,spawn:[1980,3220]},lake:{x:4350,y:2780,spawn:[4310,4250]}};
for(const p of plazas)zones[p.id]={...p,spawn:[p.x,p.y],...(p.id==='centre'?{centre:'centre/centre.json',landmark:'lantern-centre-gate-roof'}:{})};
zones.centre.spawn=[1980,3220];
const sleepAvoid=plazas.map(p=>({x:p.x,y:p.y,rx:p.rx+70,ry:p.ry+70,name:p.name}));
const world={width:W,height:H,theme:'lantern',name:'Lantern Lake',coast,water,bridges,obstacles,islets:[],walkways,arches,paths:paths.map(p=>p.line),zones,sleepAvoid,props,ambient:{birds:[[1000,2400],[2800,1000],[5500,900],[6900,2800],[5400,4800],[1700,4400]],butterflies:[[2700,3500],[5800,2000]]}};
const walk={width:W,height:H,coast:walkCoast,water,bridges,obstacles,islets:[],walkways,arches,paths:world.paths};
// Sleepers use the game's resolver as the placement predicate, with all 8 poses.
const base={...walk,walkways:[...walkways,{a:harbor.jetty.foot,b:harbor.jetty.tip,w:125}]};const geo=geometry(base),sizes=sleepHalfWidths();
const counts={nod:7,hammock:3,rock:4,leaf:6,book:6,chair:3,wing:6,box:5};
const spots=Object.fromEntries(Object.keys(counts).map(p=>[p,[]])),accepted=[];
for(const [pose,n]of Object.entries(counts)){
 const candidates=props.filter(p=>pose==='nod'?p.name==='Tree':pose==='book'||pose==='box'?/stall|Tree|bench|notice|table/.test(p.name):pose==='chair'?/umbrella|bench|Tree/.test(p.name):/Tree|Bush|Flowers/.test(p.name));
 for(let tries=0;spots[pose].length<n&&tries<65000;tries++){const p=candidates[Math.floor(rnd()*candidates.length)],a=rnd()*Math.PI*2,r=170+rnd()*230;
 const s=pose==='nod'?[p.id,0,rnd()<.5]:[Math.round(p.x+Math.cos(a)*r),Math.round(p.y+Math.sin(a)*r),rnd()<.5];const x=pose==='nod'?p.x:s[0],y=pose==='nod'?p.y+14:s[1];
 if(pd(x,y)<100+sizes[pose]*.6||open(x,y,70)||onLake(x,y,45))continue;
 const radius=sizes[pose];if(accepted.some(b=>Math.hypot(b.x-x,(b.y-y)*1.3)<Math.max(300,b.r+radius+100)||(b.pose===pose&&Math.hypot(b.x-x,b.y-y)<(pose==='chair'?850:900))))continue;
 const one=resolveSleepSpots(base,props,geo.walkable,sizes,{spots:{[pose]:[s]},avoid:sleepAvoid,warn:false});
 if(one.length===1){spots[pose].push(s);accepted.push(one[0]);}
 }if(!spots[pose].length)throw Error('Missing sleeper pose '+pose);counts[pose]=spots[pose].length;
}
// Keep every approved pose, then use quiet unoccupied tree trunks for any final
// residents. This avoids forcing a wide lying pose into a narrow garden shoulder.
for(const p of props.filter(p=>p.name==='Tree')){
 if(accepted.length===40)break;const x=p.x,y=p.y+14,pose='nod',radius=sizes.nod;
 if(pd(x,y)<100+radius*.6||open(x,y,70)||onLake(x,y,45)||accepted.some(b=>Math.hypot(b.x-x,(b.y-y)*1.3)<Math.max(300,b.r+radius+100)||(b.pose===pose&&Math.hypot(b.x-x,b.y-y)<900)))continue;
 const s=[p.id,0,false],one=resolveSleepSpots(base,props,geo.walkable,sizes,{spots:{nod:[s]},avoid:sleepAvoid,warn:false});
 if(one.length){spots.nod.push(s);counts.nod++;accepted.push(one[0]);}
}
if(accepted.length!==40)throw Error('Only '+accepted.length+'/40 safe sleepers');
world.sleepSpots=spots;
const beds=resolveSleepSpots(base,props,geo.walkable,sizes,{spots,avoid:sleepAvoid,warn:false});
// Ground texture uses the ACTUAL home tufts, pebbles and flowers, baked into SVG.
let defs='',texture='';const stamps=[];
for(const name of ['grass-tuft-1','grass-tuft-2','grass-tuft-3','pebble-1','pebble-2','flower-dot-1','flower-dot-2','flower-dot-3']){const s=fs.readFileSync('public/pixi-art/decals/'+name+'.svg','utf8'),vb=s.match(/viewBox="([^"]+)"/)[1],inner=s.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');defs+=`<symbol id="${name}" viewBox="${vb}" fill="none">${inner}</symbol>`;stamps.push({name,vb:vb.split(' ').map(Number)});}
let groundTufts=0;
for(const p of plazas.filter(p=>p.kind==='lawn'))for(let i=0;i<145;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.78,x=p.x+Math.cos(a)*p.rx*r,y=p.y+Math.sin(a)*p.ry*r;texture+=`<use href="#${i%4?'grass-tuft-1':'flower-dot-1'}" x="${f(x)}" y="${f(y)}" width="${i%4?36:20}" height="${i%4?22:16}"/>`;}
for(let i=0;i<10000&&groundTufts<3400;i++){const x=650+rnd()*6700,y=600+rnd()*4800;if(!inPoly(x,y,grass)||onLake(x,y)||open(x,y,0)||pd(x,y)<3||inPoly(x,y,beach))continue;const s=stamps[Math.floor(rnd()*stamps.length)],k=.8+rnd()*.55;texture+=`<use href="#${s.name}" x="${f(x)}" y="${f(y)}" width="${f(s.vb[2]*k)}" height="${f(s.vb[3]*k)}"/>`;groundTufts++;}
// Extra edge detail makes the designed spaces merge into the grass up close.
for(const p of plazas)for(let i=0;i<80;i++){const a=i/80*Math.PI*2,x=p.x+Math.cos(a)*(p.rx+20+rnd()*45),y=p.y+Math.sin(a)*(p.ry+20+rnd()*35);if(!inPoly(x,y,grass)||onLake(x,y)||pd(x,y)<10)continue;texture+=`<use href="#${i%3?'grass-tuft-2':'pebble-1'}" x="${f(x)}" y="${f(y)}" width="${i%3?34:22}" height="${i%3?20:14}"/>`;}
const cpath=path(coast)+'Z',gpath=path(grass)+'Z',lpath=path(lakeOutline)+'Z';
let content=`<defs>${defs}<clipPath id="coast"><path d="${cpath}"/></clipPath><clipPath id="grass"><path d="${gpath}"/></clipPath></defs>`;
// Sea stays transparent in ground tiles, sharing the world's turquoise water.
for(const [r,opacity,sw]of [[1.021,.22,12],[1.012,.48,6],[1.004,.8,5]])content+=`<path d="${cpath}" fill="none" stroke="#FFF8D5" stroke-width="${sw}" opacity="${opacity}" transform="translate(4000 3000) scale(${r}) translate(-4000 -3000)"/>`;
content+=`<path d="${cpath}" fill="#F7DF92" stroke="#FFF2BC" stroke-width="12"/><path d="${gpath}" fill="#8FB631" stroke="#547B37" stroke-width="3"/>`;
content+=`<g clip-path="url(#coast)"><path d="${path(beach)}Z" fill="#F5DC91"/>`;
for(const p of paths)content+=`<path d="${path(p.line)}" fill="none" stroke="${INK}" stroke-width="${p.w+5}"/>`;
for(const p of paths)content+=`<path d="${path(p.line)}" fill="none" stroke="#F8E29A" stroke-width="${p.w}"/>`;
content+=paving;
content+=`<path d="${lpath}" fill="#F6DDA0" stroke="${INK}" stroke-width="3"/><path d="${lpath}" fill="#66BCC9" transform="translate(4350 2780) scale(.966 .945) translate(-4350 -2780)"/><path d="${lpath}" fill="none" stroke="#C3E8D8" stroke-width="5" transform="translate(4350 2780) scale(.961 .94) translate(-4350 -2780)"/>`;
for(const [x,y,rx,ry]of islands)content+=`<ellipse cx="${x}" cy="${y}" rx="${rx+14}" ry="${ry+14}" fill="none" stroke="#C5E9DE" stroke-width="5"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#F4D98D" stroke="${INK}" stroke-width="2.5"/><ellipse cx="${x}" cy="${y-4}" rx="${rx-38}" ry="${ry-35}" fill="#8FB631"/>`;
content+=`<g clip-path="url(#grass)">${texture}</g></g>`;
fs.writeFileSync(A+'ground.svg',svg(W,H,content));
const tiles=[];for(let row=0;row<4;row++)for(let col=0;col<5;col++){const x=col*1600,y=row*1500,src=`ground-r${row}-c${col}.svg`;fs.writeFileSync(A+src,svg(1600,1500,content,`${x} ${y} 1600 1500`));tiles.push({src,x,y,width:1600,height:1500});}
const artManifest={width:W,height:H,sea:SEA,ground:{tiles},flats,decks,props,floating};
save(A+'art.json',artManifest);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'harbor.json',harbor);save(D+'placements.json',props);save(D+'paths.json',paths);save(D+'sleepers-resolved.json',beds);save(D+'bench-rings.json',benchStats);save(D+'path-shoulder-moves.json',shoulderMoves);
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2);
const dryArea=area(coast)-area(lakeOutline)+islands.reduce((s,p)=>s+Math.PI*p[2]*p[3],0);
const metrics={width:W,height:H,coastArea:area(coast),dryArea:Math.round(dryArea),dryRatioHome:dryArea/11090000,trees:props.filter(p=>p.name==='Tree').length,props:props.length,groundTufts,sleepers:beds.length,sleepCounts:counts,centrePieces:pieces.length,curvedBenches:benchStats.length,activities:3,stallRows:2,floatingLanterns:33,bridges:3};save(A+'lantern-metrics.json',metrics);console.log(metrics);
