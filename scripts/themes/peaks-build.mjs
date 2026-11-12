// Mossnap Peaks. Authored SVG, home plant vocabulary, concept 09-peaks.png.
// Only this theme's folders are written. Regeneration is deterministic.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {geometry,inPoly} from '../../assets/world/island-geometry.mjs';
import {drawArcBench} from '../arc-bench-draw.mjs';
const A='public/pixi-art/themes/peaks/',D='assets/world/themes/peaks/';
for(const p of [A+'reuse',A+'centre',D])mkdirSync(p,{recursive:true});
const W=8000,H=5800,S=4.8,INK='#39472D',SEA='#6EC9DE';
const T=p=>[150+p[0]*S,400+p[1]*S],f=n=>Math.round(n*10)/10;
const jwrite=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
let seed=902;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
function smooth(p,closed=false,n=12){const out=[],N=p.length,P=i=>p[closed?(i+N)%N:Math.max(0,Math.min(N-1,i))];for(let i=0;i<(closed?N:N-1);i++){const a=P(i-1),b=P(i),c=P(i+1),d=P(i+2);for(let k=0;k<n;k++){const t=k/n;out.push([0,1].map(q=>f(.5*(2*b[q]+(-a[q]+c[q])*t+(2*a[q]-5*b[q]+4*c[q]-d[q])*t*t+(-a[q]+3*b[q]-3*c[q]+d[q])*t*t*t))))}}if(!closed)out.push(p[N-1]);return out}
const path=p=>'M'+p.map(p=>p.map(f).join(' ')).join(' L'),closed=p=>path(p)+' Z';
const polyArea=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
const ellipse=(x,y,rx,ry,fill,stroke=INK,sw=3)=>`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const line=(d,stroke,w,extra='')=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const svg=(w,h,s,v=`0 0 ${w} ${h}`)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${v}" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
const writeSvg=(name,w,h,s,v)=>writeFileSync(A+name+'.svg',svg(w,h,s,v));
const distSeg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const distLine=(x,y,p)=>Math.min(...p.slice(1).map((b,i)=>distSeg(x,y,p[i],b)));
const coast=smooth([[120,405],[160,300],[200,210],[270,142],[370,92],[480,105],[580,73],[700,110],[820,150],[930,87],[1020,70],[1130,165],[1245,180],[1320,240],[1390,300],[1430,390],[1400,480],[1440,570],[1410,675],[1340,720],[1280,750],[1170,778],[1050,810],[930,790],[810,825],[680,795],[570,825],[460,795],[340,812],[235,755],[160,682],[130,590],[90,500]].map(T),true,10);
const inset=p=>p.map(([x,y])=>{const cx=4000,cy=2700,dx=x-cx,dy=y-cy,l=Math.hypot(dx,dy);return[f(x-dx/l*100),f(y-dy/l*100)]});
const grass=inset(coast),walkCoast=coast.map(([x,y])=>[f(4000+(x-4000)*.987),f(2700+(y-2700)*.987)]);
const islets=[[...T([570,920]),570,310],[...T([860,925]),560,300]];
const pond={x:T([320,360])[0],y:T([320,360])[1],rx:405,ry:250};
const pathsC=[
 [[770,540],[650,510],[545,465],[420,455],[310,440],[210,390],[175,300]],
 [[770,540],[900,520],[1010,480],[1110,490],[1250,460],[1350,365]],
 [[770,540],[720,625],[700,730],[660,805],[570,800]],
 [[770,540],[850,605],[1000,700],[1120,740],[1260,700],[1330,610]],
 [[420,455],[335,535],[300,610],[375,675],[440,700],[580,730],[700,730]],
 [[310,440],[230,470],[210,580],[250,685],[340,750],[460,765]],
 [[310,270],[350,220],[390,175],[475,150],[540,135]],
 [[770,440],[835,385],[935,365],[1040,410],[1130,410],[1240,400],[1350,365]],
 [[1110,490],[1110,550],[1050,615],[1000,700]],
 [[1330,610],[1380,550],[1400,480]],
 // The broad switchbacks stay walkable. The mountain itself is ground art.
 [[770,440],[735,380],[645,355],[585,330],[620,295],[730,270],[720,235],[590,215],[550,185],[605,155],[600,125]],
 [[935,365],[1000,310],[1030,265],[990,220],[1010,170],[1020,120]],
 [[1050,810],[900,800],[860,805]],
];
const paths=pathsC.map((p,i)=>({id:'trail-'+i,line:smooth(p.map(T)),w:i===10?190:i===11?185:215}));
const pathClear=(x,y,m=0)=>paths.every(p=>distLine(x,y,p.line)>p.w/2+m);
const plazas=[
 {id:'plaza',name:'Cairn compass plaza',x:T([770,540])[0],y:T([770,540])[1],rx:740,ry:465,kind:'stone'},
 {id:'activity-1',name:'Daisy crown lawn',x:T([440,700])[0],y:T([440,700])[1],rx:590,ry:350,kind:'lawn'},
 {id:'activity-2',name:'Alpine gathering terrace',x:T([1110,490])[0],y:T([1110,490])[1],rx:610,ry:365,kind:'stone'},
 {id:'activity-3',name:'Picnic games meadow',x:T([1000,700])[0],y:T([1000,700])[1],rx:600,ry:350,kind:'lawn'},
];
const rowLines=[smooth([[960,410],[1060,415],[1190,410]].map(T)),smooth([[900,615],[990,615],[1100,600]].map(T))];
const inEl=(x,y,z,pad=0)=>((x-z.x)/(z.rx+pad))**2+((y-z.y)/(z.ry+pad))**2<1;
const keepOpen=(x,y,m=0)=>plazas.some(z=>inEl(x,y,z,m))||rowLines.some(l=>distLine(x,y,l)<145+m);
const mount1=smooth([[365,365],[420,230],[475,130],[550,100],[630,105],[680,175],[735,290],[795,395],[730,430],[600,405],[510,400],[440,390]].map(T),true);
const mount2=smooth([[900,320],[935,200],[980,110],[1020,95],[1080,145],[1135,270],[1160,325],[1080,350],[980,345]].map(T),true);
const mountain=(x,y)=>inPoly(x,y,mount1)||inPoly(x,y,mount2);
const props=[],obstacles=[],flats=[],decks=[],floating=[],asset={};let serial=0;
function own(name,w,h,s){writeSvg(name,w,h,s);asset[name]={src:name+'.svg',w,h,ay:1}}
function reuse(dir,n){copyFileSync(`public/pixi-art/${dir}/${n}.svg`,A+'reuse/'+n+'.svg');const s=readFileSync(A+'reuse/'+n+'.svg','utf8'),v=s.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);asset[n]={src:'reuse/'+n+'.svg',w:v[2],h:v[3],ay:1};}
for(const n of ['tree-1','tree-2','tree-3','tree-4','tree-5','bush-1','bush-2','bush-3','bush-4','bush-5','bush-6','flower-1','flower-2','flower-3'])reuse('plants',n);
for(const n of ['grass-tuft-1','grass-tuft-2','grass-tuft-3','flower-dot-1','flower-dot-2','flower-dot-3','pebble-1','pebble-2','sand-speck-1'])reuse('decals',n);
// Three unequal pine tiers, visible trunk, not a triangle or a lollipop.
own('alpine-pine',310,480,`<path d="M137 477 Q151 428 141 353 L169 353 Q164 430 181 477Z" fill="#C88941" stroke="${INK}" stroke-width="3.5"/><path d="M159 359 L169 359 L169 473 L156 474Z" fill="#885931"/>`+
 [[154,190,1],[154,103,.81],[155,12,.62]].map(([cx,cy,k],i)=>`<g transform="translate(${cx-154*k} ${cy-190*k}) scale(${k})"><path d="M154 190 Q140 233 112 254 L126 252 Q104 286 67 296 L82 298 Q54 326 21 338 L41 349 Q16 369 7 377 Q28 390 59 389 L47 405 Q96 421 135 407 Q162 422 189 407 Q230 423 260 402 L247 391 Q280 393 302 379 L281 366 L298 356 Q264 340 245 319 L263 321 Q231 301 214 277 L228 277 Q187 249 174 216Z" fill="${['#2C8145','#389344','#4AA539'][i]}" stroke="${INK}" stroke-width="3.7"/><path d="M147 219 Q131 263 106 284 L122 282 Q103 310 67 326 L86 325 Q64 352 38 366 Q70 365 87 358 L74 377 Q112 371 137 359 Q113 346 130 334 Q150 314 147 292 Q163 264 147 219Z" fill="#74BC50"/><path d="M176 320 Q202 350 232 354 M119 383 Q145 391 170 382 M192 393 L209 396" fill="none" stroke="#216C3A" stroke-width="3.5"/></g>`).join(''));
own('cairn',190,188,ellipse(95,175,88,11,'#507238','none')+`<path d="M18 155 Q21 120 56 115 L132 116 Q166 124 173 151 Q165 172 122 174 L49 172 Q27 168 18 155Z" fill="#BBB6A1" stroke="${INK}" stroke-width="4"/><path d="M40 118 Q41 84 72 78 L117 81 Q146 94 148 113 Q136 134 91 133 Q55 132 40 118Z" fill="#D8D4B9" stroke="${INK}" stroke-width="4"/><path d="M64 80 Q61 48 88 40 Q112 39 128 59 L126 79 Q93 92 64 80Z" fill="#BFC4AC" stroke="${INK}" stroke-width="4"/><path d="M82 42 Q70 18 94 7 Q116 9 119 27 L112 42Z" fill="#EEE8CF" stroke="${INK}" stroke-width="3"/>`+line('M31 145 Q69 155 95 149 M51 109 Q87 117 113 108 M75 70 L100 73','#EEE8CF',5));
own('trail-lamp',85,240,ellipse(43,229,31,9,'#885931')+`<path d="M36 224 L36 79 L49 79 L49 224Z" fill="#C88941" stroke="${INK}" stroke-width="3"/><path d="M28 76 Q7 38 30 23 Q43 8 56 24 Q80 43 57 76Z" fill="#FFF1AC" stroke="${INK}" stroke-width="4"/><path d="M26 31 L60 31 M25 70 L60 70" stroke="${INK}" stroke-width="4"/><path d="M43 12 L43 4 M34 44 L34 59" stroke="${INK}" stroke-width="3"/>`);
own('trail-sign',200,170,`<path d="M91 163 L91 18 L108 18 L108 163Z" fill="#885931" stroke="${INK}" stroke-width="3"/><path d="M10 35 L161 35 L186 57 L161 78 L10 78Z" fill="#DDA85C" stroke="${INK}" stroke-width="4"/><path d="M190 87 L41 87 L15 105 L41 124 L190 124Z" fill="#F4DF9C" stroke="${INK}" stroke-width="4"/>`+line('M48 59 L132 59 M66 105 L151 105','#885931',4)+`<path d="M130 62 l13 -17 l15 17Z" fill="#4AA539" stroke="${INK}" stroke-width="2"/>`);
own('daisy-bed',200,90,ellipse(100,75,92,14,'#508E36','none')+Array.from({length:9},(_,i)=>{const x=20+(i%5)*37+(i>4?12:0),y=22+Math.floor(i/5)*35;return line(`M${x} ${y+25} L${x} ${y}`,'#3F7831',3)+Array.from({length:6},(_,k)=>{const a=k*Math.PI/3;return ellipse(x+Math.cos(a)*10,y+Math.sin(a)*8,6,5,'#FFF8D7',INK,1.4)}).join('')+ellipse(x,y,5,4,'#F2BA3D',INK,1.2)}).join(''));
own('planter',155,120,`<path d="M25 68 L131 68 L119 114 Q77 124 40 112Z" fill="#C88941" stroke="${INK}" stroke-width="3"/>`+ellipse(78,68,59,18,'#885931')+`<path d="M38 62 Q18 33 42 26 Q52 4 73 24 Q94 2 111 26 Q139 26 123 61Z" fill="#4AA539" stroke="${INK}" stroke-width="3"/>`+[45,74,103].map((x,i)=>ellipse(x,33+(i%2)*15,11,9,'#FFF8D7',INK,1.5)+ellipse(x,33+(i%2)*15,4,4,'#F2BA3D',INK,1)).join(''));
own('moss-rock',180,110,`<path d="M9 89 L25 38 L62 14 L116 12 L158 43 L174 89 Q93 122 9 89Z" fill="#B9B7A0" stroke="${INK}" stroke-width="3.5"/><path d="M25 38 L80 43 L62 14 M80 43 L116 12 M80 43 L65 105 M80 43 L158 43" fill="none" stroke="#858A70" stroke-width="3"/><path d="M23 43 Q23 29 49 24 Q67 1 92 13 Q130 0 146 32 L123 49 L101 38 L75 57 L49 46Z" fill="#74B94C" stroke="${INK}" stroke-width="2"/>`);
own('picnic-blanket',340,175,`<path d="M28 21 L288 5 L330 142 L45 169 L7 46Z" fill="#FFF4C5" stroke="${INK}" stroke-width="3"/>`+Array.from({length:6},(_,i)=>`<path d="M${28+i*44} ${21-i*2.6} l14 -1 l38 142 l-15 1Z" fill="#64A94C"/>`).join('')+Array.from({length:4},(_,i)=>`<path d="M${17+i*9} ${42+i*33} l286 -19 l4 14 l-285 22Z" fill="#64A94C" opacity=".8"/>`).join('')+`<path d="M133 89 Q112 46 151 39 Q193 38 184 88" fill="none" stroke="${INK}" stroke-width="5"/><path d="M120 79 L191 75 L189 125 Q150 144 126 126Z" fill="#D9A760" stroke="${INK}" stroke-width="3"/>`+line('M128 92 L185 89 M130 107 L185 104','#885931',3)+`<ellipse cx="236" cy="88" rx="27" ry="16" fill="#F4D93B" stroke="${INK}" stroke-width="3"/>`);
own('picnic-table',300,190,`<path d="M68 176 L103 43 M233 176 L202 43 M80 124 H218" fill="none" stroke="${INK}" stroke-width="14"/><path d="M68 172 L103 43 M233 172 L202 43 M80 124 H218" fill="none" stroke="#C88941" stroke-width="8"/><path d="M25 14 L262 14 L281 75 L9 75Z" fill="#DDA85C" stroke="${INK}" stroke-width="4"/><path d="M30 34 H267 M20 54 H274" stroke="#885931" stroke-width="3"/><path d="M6 108 H290 V130 H6Z" fill="#C88941" stroke="${INK}" stroke-width="4"/><path d="M63 154 V129 M247 154 V129" stroke="${INK}" stroke-width="10"/>`);
own('summit-pennant',160,300,`<path d="M32 294 L32 8 L42 8 L42 294Z" fill="#C88941" stroke="${INK}" stroke-width="3"/><path d="M42 18 Q78 2 104 22 Q125 37 150 19 L131 56 L154 77 Q117 93 92 69 Q68 51 42 70Z" fill="#F77645" stroke="${INK}" stroke-width="4"/>`+line('M56 33 Q92 25 107 45','#FFF4C5',5));
own('alpine-stall',330,370,`<path d="M39 197 L291 197 L291 355 L39 355Z" fill="#DDA85C" stroke="${INK}" stroke-width="4"/><path d="M50 189 L50 349 M280 188 L280 349" stroke="${INK}" stroke-width="12"/><path d="M28 130 L61 54 L271 54 L305 130 L305 167 Q280 195 258 167 Q235 194 213 167 Q188 195 165 167 Q140 195 117 167 Q94 193 71 167 Q48 193 28 167Z" fill="#FFF4C5" stroke="${INK}" stroke-width="4"/>`+[0,2,4].map(i=>`<path d="M${61+i*42} 54 L${88+i*42} 54 L${117+i*47} 167 Q94 193 71 167 L${28+i*47} 167 L${28+i*47} 130Z" fill="#78B453"/>`).join('')+`<path d="M28 130 H305 M29 166 H304" stroke="${INK}" stroke-width="3"/><path d="M52 282 L278 282 L278 309 L52 309Z" fill="#C88941" stroke="${INK}" stroke-width="4"/><path d="M67 223 L131 223 L131 278 L67 278Z M184 240 L248 240 L248 278 L184 278Z" fill="#EEE8C2" stroke="${INK}" stroke-width="3"/>`+[80,105,199,229].map((x,i)=>ellipse(x,220+(i>1?19:0),10,13,i>1?'#F2BA3D':'#8DBF4F',INK,2)).join('')+`<path d="M63 322 H266" stroke="#885931" stroke-width="3"/>`);
function put(n,cp,{world=false,scale=1,zone='meadow',name=n,solid=true,id,flip=false}={}){const [x,y]=world?cp:T(cp),a=asset[n],w=a.w*scale,h=a.h*scale,p={id:id||'peaks-'+serial++,name,asset:n,src:a.src,x:f(x),y:f(y),width:a.w,height:a.h,scale,anchor:{x:.5,y:a.ay},flip,zone};props.push(p);if(solid){const tree=/tree|pine/.test(n),pole=/lamp|sign|pennant/.test(n);obstacles.push({name:p.id,x:p.x,y:f(p.y-8),rx:tree?31:pole?16:f(Math.min(115,w*.36)),ry:tree?22:pole?13:f(Math.min(32,h*.18))})}return p}
// ---------- terrain, every tile is pure vector ----------
const tuftSVG=readFileSync('public/pixi-art/decals/grass-tuft-1.svg','utf8').replace(/<svg[^>]*>|<\/svg>/g,'');
let g=`<defs><g id="home-tuft">${tuftSVG}</g><clipPath id="land"><path d="${closed(coast)}"/></clipPath><clipPath id="grass"><path d="${closed(grass)}"/></clipPath></defs>`;
g+=`<path d="${closed(coast)}" fill="#F6E3A7" stroke="${INK}" stroke-width="5"/><path d="${closed(grass)}" fill="#93B72F" stroke="#568B3B" stroke-width="4"/>`;
g+=`<g clip-path="url(#grass)">`;
// Broad uneven meadow patches keep the giant lawn from reading as one fill.
for(let i=0;i<110;i++){const x=650+rnd()*6600,y=900+rnd()*3500;g+=ellipse(x,y,60+rnd()*160,30+rnd()*70,i%2?'#87B431':'#A0BD40','none')}
g+='</g>';
// Rounded terraced peaks, with rock cuts drawn below each grassy shelf.
for(const [poly,tier]of [[mount1,1],[mount2,2]]){
 g+=`<path d="${closed(poly)}" fill="#BCB7A0" stroke="${INK}" stroke-width="5"/>`;
 const minx=Math.min(...poly.map(p=>p[0])),maxx=Math.max(...poly.map(p=>p[0])),miny=Math.min(...poly.map(p=>p[1])),maxy=Math.max(...poly.map(p=>p[1]));
 g+=`<defs><clipPath id="mount${tier}"><path d="${closed(poly)}"/></clipPath></defs><g clip-path="url(#mount${tier})">`;
 for(let i=0;i<16;i++){const x=minx+i*(maxx-minx)/15,y=miny+100+rnd()*(maxy-miny-200);g+=`<path d="M${f(x)} ${f(y)} l-82 550 l110 240 l120 -500 l-15 -320Z" fill="${i%3?'#D4C8A8':'#AAA88F'}" stroke="#777D62" stroke-width="3"/>`}
 const top=poly.map(([x,y])=>[x,y-(y>miny+160?130:0)]);g+=`<path d="${closed(top)}" fill="#91C953" stroke="${INK}" stroke-width="4"/>`;
 for(let i=0;i<4;i++){const yy=miny+200+i*(maxy-miny-300)/4;g+=`<path d="M${minx} ${yy} Q${(minx+maxx)/2} ${yy+140} ${maxx} ${yy+30}" fill="none" stroke="#75AF43" stroke-width="28"/>`}
 g+='</g>';
}
// A stepped escarpment carries each grassy terrace. Short irregular faces keep the rounded meadow silhouette.
for(const [points,depth]of [
 [[[385,328],[430,345],[484,350],[535,369]],43],
 [[[485,239],[536,254],[592,261]],35],
 [[[629,369],[681,387],[739,400],[780,392]],48],
 [[[927,289],[966,309],[1013,313]],41],
 [[[1051,257],[1100,283],[1134,302]],49],
]){
 const top=points.map(T),bottom=top.map(([x,y],i)=>[x+(i%2?13:-16),y+depth*S]),face=[...top,...bottom.toReversed()];
 g+=`<path d="${closed(face)}" fill="#BCB7A0" stroke="${INK}" stroke-width="4"/>`;
 for(let i=0;i<top.length-1;i++){const a=top[i],b=top[i+1],mid=[a[0]*.4+b[0]*.6,a[1]*.4+b[1]*.6];g+=`<path d="M${a[0]} ${a[1]} L${mid[0]} ${mid[1]} l-28 ${depth*S*.6} l-18 ${depth*S*.4} L${a[0]-16} ${a[1]+depth*S}Z" fill="#D8CFB2"/>`+line(`M${f(mid[0])} ${f(mid[1])} l-28 ${depth*S*.6} l-18 ${depth*S*.4}`,'#85876F',3)}
 g+=line(path(top),'#6CA740',13)+line(path(top),'#A8D56A',5);
}
// Water feature with a double stone rim and etched shallow edge.
g+=ellipse(pond.x,pond.y,pond.rx+30,pond.ry+26,'#A7AF82',INK,4)+ellipse(pond.x,pond.y,pond.rx+10,pond.ry+8,'#E5D7AF',INK,3)+ellipse(pond.x,pond.y,pond.rx,pond.ry,'#7FD0DF',INK,3)+ellipse(pond.x-12,pond.y-4,pond.rx-38,pond.ry-28,'none','#C4EBDA',4);
for(let i=0;i<22;i++){const a=i*Math.PI/11,x=pond.x+Math.cos(a)*(pond.rx+22),y=pond.y+Math.sin(a)*(pond.ry+15);g+=ellipse(x,y,24+rnd()*10,15+rnd()*5,i%2?'#DAD6B7':'#BCBBA0',INK,2)}
// The paths are a single ink edge, inset sand and an inner light edge, with rounded joins.
for(const p of paths){g+=line(path(p.line),INK,p.w+7)+line(path(p.line),'#E4C567',p.w+2)+line(path(p.line),'#FDE48C',p.w-13)}
for(const p of paths)for(let i=3;i<p.line.length;i+=5){const[x,y]=p.line[i],sgn=i%2?1:-1;g+=ellipse(x+sgn*32,y-19,8,4,'#E3CF97','none')+line(`M${x-12} ${y+23} l21 3`,'#E0CA91',1.6)}
// Main square and activity areas: patterned centres and finished rims, walkable throughout.
for(const z of plazas){g+=ellipse(z.x,z.y,z.rx+24,z.ry+19,'#5C9A3F',INK,3)+ellipse(z.x,z.y,z.rx+10,z.ry+7,'#D8C68D',INK,3)+ellipse(z.x,z.y,z.rx,z.ry,z.kind==='stone'?'#FDE48C':'#93B72F',INK,3);
 if(z.kind==='stone'){
  const ring=(r0,r1,a0,a1)=>{const pts=[];for(let n=0;n<=8;n++){const a=a0+(a1-a0)*n/8;pts.push([z.x+Math.cos(a)*z.rx*r1,z.y+Math.sin(a)*z.ry*r1])}for(let n=8;n>=0;n--){const a=a0+(a1-a0)*n/8;pts.push([z.x+Math.cos(a)*z.rx*r0,z.y+Math.sin(a)*z.ry*r0])}return closed(pts)};
  for(let ringN=0;ringN<4;ringN++){const r0=[.25,.49,.73,.90][ringN],r1=[.49,.73,.90,1][ringN];for(let k=0;k<24;k++)g+=`<path d="${ring(r0,r1,k*Math.PI/12+(ringN%2)*Math.PI/24,(k+1)*Math.PI/12+(ringN%2)*Math.PI/24)}" fill="${(k+ringN)%3===0?'#FFF0C7':'#FDE48C'}" stroke="#B69F60" stroke-width="1.5"/>`}
 }else{for(let i=0;i<85;i++){const x=z.x+(rnd()-.5)*z.rx*1.5,y=z.y+(rnd()-.5)*z.ry*1.5;if(!inEl(x,y,{...z,rx:z.rx*.8,ry:z.ry*.8}))continue;g+=i%3?`<use href="#home-tuft" transform="translate(${f(x-15)} ${f(y-17)}) scale(.65)"/>`:ellipse(x,y,4,3,'#E6D18D','none')}}
 for(const a of [.90,.73,.49,.25])g+=ellipse(z.x,z.y,z.rx*a,z.ry*a,'none',z.kind==='stone'?'#C1AC7B':'#87B431',2);
 for(let k=0;k<32;k++){const a=k*Math.PI/16,co=Math.cos(a),si=Math.sin(a);g+=line(`M${f(z.x+co*z.rx*.90)} ${f(z.y+si*z.ry*.90)} L${f(z.x+co*z.rx)} ${f(z.y+si*z.ry)}`,INK,1.7);if(k%2===0){const r=.82;g+=`<path d="M${f(z.x+co*z.rx*r)} ${f(z.y+si*z.ry*r-9)} l9 9 l-9 9 l-9 -9Z" fill="#6EA253" stroke="${INK}" stroke-width="1.5"/>`}}
 if(z.kind==='stone')for(let k=0;k<16;k++){const a=k*Math.PI/8;g+=line(`M${f(z.x+Math.cos(a)*z.rx*.25)} ${f(z.y+Math.sin(a)*z.ry*.25)} L${f(z.x+Math.cos(a+.075)*z.rx*.73)} ${f(z.y+Math.sin(a+.075)*z.ry*.73)}`,'#C8B684',2)}
}
for(const l of rowLines){g+=line(path(l),'#6D9E45',265)+line(path(l),'#A0BD40',252)+line(path(l),'#93B72F',220);for(let i=0;i<l.length;i+=4){const[x,y]=l[i];g+=line(`M${x} ${y-110} l0 -18 M${x} ${y+110} l0 18`,'#F9ECC0',4)}}
// Reserved stall lanes are textured lawns, with inlaid bay markers and a small cobbled rim.
for(const l of rowLines){for(let i=1;i<l.length-1;i+=2){const[x,y]=l[i];for(const side of [-1,1]){g+=ellipse(x,y+side*117,17,8,i%4?'#E4C567':'#FFF0C7',INK,1.5);if(i%6===1)g+=`<use href="#home-tuft" transform="translate(${x-17} ${y+side*75-15}) scale(.65)"/>`}}}
// Islets and railled bridges, as in the concept.
for(const[x,y,rx,ry]of islets)g+=ellipse(x,y,rx,ry,'#F6E3A7',INK,4)+ellipse(x,y-9,rx-65,ry-50,'#93B72F','#73972D',3);
// Grass texture is dense at game zoom, not giant dots at overview.
g+='<g clip-path="url(#grass)">';
for(let i=0;i<6500;i++){const x=500+rnd()*7100,y=650+rnd()*4200;if(!inPoly(x,y,grass)||!pathClear(x,y,4)||keepOpen(x,y,-25)||inEl(x,y,pond,35))continue;const a=.65+rnd()*.4;g+=i%3===0?ellipse(x,y,6+rnd()*6,4,'#E6D18D',INK,1.1):`<use href="#home-tuft" transform="translate(${f(x-22*a)} ${f(y-26*a)}) scale(${f(a)})"/>`}

g+='</g>';
// Rim pebbles, gentle shore foam and small sand specks.
for(let i=0;i<coast.length;i+=2){const[x,y]=coast[i],dx=4000-x,dy=2700-y,ll=Math.hypot(dx,dy),xx=x+dx/ll*63,yy=y+dy/ll*63;g+=ellipse(xx,yy,7+rnd()*10,4+rnd()*5,i%3?'#C6B880':'#EEE3BA','none')}
for(const pad of [33,70]){const p=coast.map(([x,y])=>{const dx=x-4000,dy=y-2700,l=Math.hypot(dx,dy);return[x+dx/l*pad,y+dy/l*pad]});g+=line(closed(p),'#E0F0D9',pad===33?8:4,'opacity=".6"')}
for(const[x,y,rx,ry]of islets)g+=ellipse(x,y,rx+32,ry+25,'none','#E0F0D9',6)+ellipse(x,y,rx+65,ry+49,'none','#C2E6D5',4);
writeSvg('ground',W,H,g);
const ground={tiles:[]};for(let r=0;r<4;r++)for(let c=0;c<6;c++){const x=Math.floor(c*W/6),y=Math.floor(r*H/4),w=Math.floor((c+1)*W/6)-x,h=Math.floor((r+1)*H/4)-y,n=`ground-r${r}-c${c}`;writeSvg(n,w,h,g,`${x} ${y} ${w} ${h}`);ground.tiles.push({src:n+'.svg',x,y,width:w,height:h})}
// ---------- swappable layered summit centre ----------
const centreXY=T([600,125]),C={theme:'peaks',name:'Cloud crown summit lookout',concept:'concepts/themes/concepts/09-peaks.png',origin:'summit deck ground centre',placement:{x:centreXY[0],y:centreXY[1],scale:1},depthRatio:.64,pieces:[],blocked:[]};
const cloud='M-420 55 C-520 20 -500 -85 -410 -105 C-430 -190 -320 -237 -248 -195 C-210 -280 -80 -288 -25 -230 C40 -302 185 -266 205 -193 C300 -235 407 -178 399 -109 C510 -88 526 24 440 65 C370 139 249 126 190 103 C110 162 -7 144 -65 115 C-171 158 -268 138 -301 105 C-352 139 -415 111 -420 55Z';
const cpiece=(id,layer,body,sortY=0)=>{const box=[-560,-500,1120,760],file=id+'.svg';writeFileSync(A+'centre/'+file,svg(box[2],box[3],body,box.join(' ')));const p={id,file,layer,x:box[0],y:box[1],width:box[2],height:box[3],at:[box[0],box[1]],anchor:{x:0,y:0},sortY};C.pieces.push(p);const x=centreXY[0]+box[0],y=centreXY[1]+box[1];if(layer==='decal')decks.push({src:'centre/'+file,x,y,width:box[2],height:box[3]});else props.push({id:'peaks-centre-'+id,name:'Cloud lookout '+id,src:'centre/'+file,x:centreXY[0],y:centreXY[1]+sortY,width:box[2],height:box[3],scale:1,anchor:{x:-box[0]/box[2],y:(sortY-box[1])/box[3]},shadow:false,wind:false,zone:'summit'})};
cpiece('floor','decal',`<path d="${cloud}" transform="translate(0 28)" fill="#885931" stroke="${INK}" stroke-width="4"/><path d="${cloud}" fill="#FFF2CD" stroke="${INK}" stroke-width="5"/>`+Array.from({length:12},(_,i)=>line(`M${-410+i*72} -102 V69`,'#D8C58E',2)).join('')+ellipse(0,-30,280,145,'none','#C1AC7B',3)+`<path d="M0 -140 L35 -62 L145 -30 L35 -1 L0 79 L-35 -1 L-145 -30 L-35 -62Z" fill="#88AE65" stroke="${INK}" stroke-width="3"/>`);
const railing=(front)=>{let out='';const pts=[];for(let i=0;i<=16;i++){const a=(front?0:Math.PI)+i*Math.PI/16;pts.push([Math.cos(a)*410,Math.sin(a)*135-25])}for(let i=0;i<pts.length;i+=2){const[x,y]=pts[i];out+=`<path d="M${f(x-5)} ${f(y)} v-99 h10 v99Z" fill="#C88941" stroke="${INK}" stroke-width="3"/>`}out+=line(path(pts.map(([x,y])=>[x,y-96])),'#39472D',15)+line(path(pts.map(([x,y])=>[x,y-97])),'#DDA85C',9)+line(path(pts.map(([x,y])=>[x,y-43])),'#885931',7);return out};
cpiece('back-rail','back',railing(false),-160);
cpiece('telescope','back',`<path d="M202 -10 l-40 -130 l65 0 l35 130 M205 -92 l-5 84" fill="none" stroke="${INK}" stroke-width="12"/><path d="M133 -164 L270 -198 L283 -151 L144 -117Z" fill="#889D8D" stroke="${INK}" stroke-width="5"/><path d="M260 -201 l24 -6 l15 51 l-24 7Z" fill="#4D6554" stroke="${INK}" stroke-width="4"/>`+line('M155 -155 L244 -178','#E8E5CA',8),-5);
cpiece('pennant','back',`<path d="M-57 -46 V-448 H-45 V-46Z" fill="#C88941" stroke="${INK}" stroke-width="4"/><path d="M-45 -434 Q5 -456 64 -425 Q102 -403 148 -420 L117 -371 L145 -329 Q86 -309 47 -344 Q0 -380 -45 -349Z" fill="#F77645" stroke="${INK}" stroke-width="4"/>`+line('M-22 -410 Q21 -424 59 -395','#FFF4C5',8),-50);
// Split front rail in two to keep the south entry clear.
const fr=railing(true);cpiece('front-left','front',`<defs><clipPath id="left"><rect x="-560" y="-500" width="455" height="760"/></clipPath></defs><g clip-path="url(#left)">${fr}</g>`,145);cpiece('front-right','front',`<defs><clipPath id="right"><rect x="105" y="-500" width="455" height="760"/></clipPath></defs><g clip-path="url(#right)">${fr}</g>`,145);
// The floor is on land, stairs give a clear ground entry below the rail gap.
cpiece('stairs','decal',Array.from({length:6},(_,i)=>`<path d="M${-95-i*4} ${102+i*20} h${190+i*8} v19 h-${190+i*8}Z" fill="${i%2?'#DDA85C':'#C88941'}" stroke="${INK}" stroke-width="3"/>`).join(''));
for(const[x,y,rx,ry,name]of [[202,-24,68,26,'telescope'],[-50,-45,16,13,'pennant']]){obstacles.push({x:centreXY[0]+x,y:centreXY[1]+y,rx,ry,name:'summit-'+name});C.blocked.push({name,ellipse:{x,y,rx,ry}})}
// Rear and side balustrades block the rim, south 210-unit entry stays clear.
for(let i=0;i<24;i++){const a=i*Math.PI/12;if(Math.sin(a)>.75&&Math.abs(Math.cos(a))<.5)continue;const x=Math.cos(a)*410,y=Math.sin(a)*135-25;obstacles.push({x:centreXY[0]+x,y:centreXY[1]+y,rx:21,ry:15,name:'summit-rail'})}
jwrite(A+'centre/centre.json',C);
// ---------- deliberate furniture ----------
for(const z of plazas){for(const deg of [-155,-70,35,145]){const a=deg*Math.PI/180,x=z.x+Math.cos(a)*(z.rx+50),y=z.y+Math.sin(a)*(z.ry+37);if(pathClear(x,y,40)&&!rowLines.some(l=>distLine(x,y,l)<180))put('trail-lamp',[x,y],{world:true,scale:.92,zone:z.id,name:'Meadow lantern'});}
 for(const deg of [-130,-45,65,160]){const a=deg*Math.PI/180,x=z.x+Math.cos(a)*(z.rx+38),y=z.y+Math.sin(a)*(z.ry+27);if(pathClear(x,y,40)&&!rowLines.some(l=>distLine(x,y,l)<180))put('planter',[x,y],{world:true,scale:1.05,zone:z.id,name:'Daisy rim planter'});}
}
const benchRecords=[];
for(const z of plazas)for(const target of [-145,-55,38,142]){
 const used=benchRecords.filter(b=>b.id.startsWith('arc-'+z.id+'-'));const deg=[0,-5,5,-10,10,-15,15,-20,20,-25,25,-30,30].map(n=>target+n).find(a=>pathClear(z.x+Math.cos(a*Math.PI/180)*z.rx*.95,z.y+Math.sin(a*Math.PI/180)*z.ry*.95,75)&&used.every(b=>Math.abs(a-b.deg)>28));if(deg===undefined)continue;
 const radius=z.rx*.95,k=z.ry/z.rx,span=23,ground=(a,s)=>[z.x+Math.cos(a*Math.PI/180)*s,z.y+Math.sin(a*Math.PI/180)*s*k],arc=s=>Array.from({length:25},(_,i)=>ground(deg-span/2+i*span/24,s)),points=[...arc(radius-25),...arc(radius+28)],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.floor(Math.min(...xs))-8,y=Math.floor(Math.min(...ys))-65,w=Math.ceil(Math.max(...xs))-x+8,h=Math.ceil(Math.max(...ys))-y+8,[ax,ay]=ground(deg,radius);
 if(!pathClear(ax,ay,60))continue;
 const id=`arc-${z.id}-${deg}`,body=drawArcBench({deg,span},{ground,sIn:radius-23,sOut:radius+23,back:radius+27,seat:24,top:62,ink:INK,line:2.5,thin:1.7,u:1.3,spindleDeg:2.5});
 writeSvg(id,w,h,body.join(''),`${x} ${y} ${w} ${h}`);props.push({id,name:'Curved alpine bench',asset:'arc-bench',src:id+'.svg',x:f(ax),y:f(ay),width:w,height:h,scale:1,anchor:{x:(ax-x)/w,y:(ay-y)/h},shadow:false,wind:false,zone:z.id});
 const poly=[...arc(radius-27),...arc(radius+31).reverse()].map(p=>p.map(f));obstacles.push({name:id,poly});benchRecords.push({id,centre:[z.x,z.y],deg,span,radius,ratio:k,footprint:{poly}})
}
jwrite(A+'arc-benches.json',benchRecords);
put('cairn',[770,540],{scale:2.2,name:'Compass cairn'});
for(const cp of [[520,197],[698,315],[817,400],[958,263],[1042,153],[1230,702],[253,595]])put('cairn',cp,{scale:.8,name:'Trail cairn'});
for(const cp of [[721,453],[302,431],[928,377],[1276,466],[677,738],[369,664]])put('trail-sign',cp,{scale:1.05,name:'Switchback trail sign'});
for(const cp of [[1270,420],[1345,425]])put('alpine-stall',cp,{scale:1.28,name:'Alpine market stall'});
for(const cp of [[255,590],[1180,720],[870,735],[360,765],[1250,565]])put('picnic-blanket',cp,{scale:1.05,solid:false,name:'Gingham picnic blanket'});
for(const cp of [[255,560],[1180,680],[335,760],[1268,560]])put('picnic-table',cp,{scale:1,name:'Trail picnic table'});
put('summit-pennant',[1020,120],{scale:1.1,name:'East summit pennant'});
for(const cp of [[468,285],[760,190],[655,420],[940,260],[1095,220],[1100,325],[839,280],[825,446]])put('alpine-pine',cp,{scale:.88+rnd()*.18,name:'Alpine pine tree'});
for(const cp of [[470,202],[663,171],[740,355],[972,181],[1110,303]])put('moss-rock',cp,{scale:.9,name:'Summit moss rock'});
// Pine and broadleaf groves. Candidate canopy rectangles cannot cover trails or open floors.
const clusters=[[215,270],[256,222],[320,177],[205,515],[181,615],[294,735],[365,574],[515,532],[581,473],[594,627],[764,713],[808,768],[875,420],[886,311],[1167,248],[1247,297],[1305,335],[1297,505],[1214,605],[1216,740],[990,762],[490,780],[750,199],[812,277]];
const treeRects=[];
const freeTree=(x,y,w,h)=>inPoly(x,y,grass)&&!mountain(x,y)&&!keepOpen(x,y,100)&&!inEl(x,y,pond,140)&&pathClear(x,y,w*.36+30)&&!props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.2)<185)&&!treeRects.some(q=>Math.abs(q.x-x)<(q.w+w)*.44&&Math.abs(q.y-y)<175)&&paths.every(p=>p.line.every(([px,py])=>!(px>x-w*.52-25&&px<x+w*.52+25&&py>y-h*.70-20&&py<y+30)));
for(let ci=0;ci<clusters.length;ci++){const c=T(clusters[ci]);let n=0;for(let tr=0;tr<180&&n<4;tr++){const x=c[0]+(rnd()-.5)*700,y=c[1]+(rnd()-.5)*400,name=ci%3!==0?'alpine-pine':['tree-1','tree-3','tree-4'][ci%3],scale=1.03+rnd()*.22,w=asset[name].w*scale,h=asset[name].h*scale;if(!freeTree(x,y,w,h))continue;const p=put(name,[x,y],{world:true,scale,name:name==='alpine-pine'?'Alpine pine tree':'Meadow tree',flip:rnd()<.5});treeRects.push({x,y,w,h});n++;}}
// A few additional groves fill genuinely clear pockets, never blanket random trees.
for(let tr=0;tr<18000&&treeRects.length<78;tr++){const x=650+rnd()*6600,y=1200+rnd()*3100,scale=1.08+rnd()*.17,name=tr%3?'alpine-pine':'tree-3',w=asset[name].w*scale,h=asset[name].h*scale;if(!freeTree(x,y,w,h))continue;put(name,[x,y],{world:true,scale,name:'Meadow tree',flip:rnd()<.5});treeRects.push({x,y,w,h})}
// Bushes and stones at tree feet, with small groups between paths.
const trees=props.filter(p=>/tree/.test(p.name));
for(let i=0;i<trees.length;i++){const p=trees[i],x=p.x+(i%2?1:-1)*(100+rnd()*90),y=p.y+35+rnd()*55;if(pathClear(x,y,65)&&!keepOpen(x,y,30)&&inPoly(x,y,grass)){put('bush-'+(1+i%6),[x,y],{world:true,scale:1.15,name:'Meadow bush'});if(i%3===0)put('moss-rock',[x+90,y+32],{world:true,scale:.5,name:'Moss rock'})}}
for(let tr=0,n=0;tr<8000&&n<115;tr++){const x=650+rnd()*6600,y=1200+rnd()*3050;if(!inPoly(x,y,grass)||!pathClear(x,y,130)||keepOpen(x,y,75)||mountain(x,y)||inEl(x,y,pond,100)||props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.3)<170))continue;put(n%4?'daisy-bed':'bush-'+(1+n%6),[x,y],{world:true,scale:n%4?.8:1.2,solid:n%4===0,name:n%4?'Daisy flower bed':'Meadow bush'});n++}
// Daisies flank the trails up the mountain, never hide the walking line.
for(const idx of [0,1,4,7,10,11]){const l=paths[idx].line;for(let i=4;i<l.length;i+=9){const a=l[Math.max(0,i-1)],b=l[Math.min(l.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,sgn=i%2?1:-1,x=l[i][0]-dy/len*195*sgn,y=l[i][1]+dx/len*195*sgn;if(inPoly(x,y,grass)&&!keepOpen(x,y,30)&&!inEl(x,y,pond,60)&&pathClear(x,y,40)&&!props.some(p=>Math.hypot(p.x-x,p.y-y)<125))put('daisy-bed',[x,y],{world:true,scale:.7,solid:false,name:'Alpine daisy flowers'})}}
// Trail lantern rhythm away from forks and trees.
for(const idx of [0,1,3,4,7,10]){const l=paths[idx].line;for(let i=9;i<l.length;i+=19){const a=l[i-1],b=l[i+1]||l[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,x=l[i][0]-dy/len*165,y=l[i][1]+dx/len*165;if(inPoly(x,y,grass)&&pathClear(x,y,30)&&!keepOpen(x,y,20)&&!props.some(p=>Math.hypot(p.x-x,p.y-y)<170))put('trail-lamp',[x,y],{world:true,scale:.87,name:'Trail lantern'})}}
for(const z of plazas)for(let i=0;i<14;i++){const a=i*Math.PI/7,x=z.x+Math.cos(a)*(z.rx+83),y=z.y+Math.sin(a)*(z.ry+64);if(pathClear(x,y,75)&&!rowLines.some(l=>distLine(x,y,l)<210)&&inPoly(x,y,grass)&&!props.some(p=>Math.hypot(x-p.x,y-p.y)<115))put('daisy-bed',[x,y],{world:true,scale:.7,name:'Daisy rim flowers',solid:false})}
for(let i=9;i<coast.length;i+=13){const[x,y]=coast[i],dx=4000-x,dy=2700-y,ll=Math.hypot(dx,dy),xx=x+dx/ll*71,yy=y+dy/ll*71;if(pathClear(xx,yy,100)&&!props.some(p=>Math.hypot(xx-p.x,yy-p.y)<160))put(i%3?'moss-rock':'daisy-bed',[xx,yy],{world:true,scale:i%3?.6:.8,name:i%3?'Shore moss rock':'Shore daisy flowers',solid:i%3!==0})}
// Pond reeds, lilies and quiet water ripples.
own('reeds',110,150,Array.from({length:8},(_,i)=>line(`M55 146 Q${20+i*10} 104 ${12+i*12} ${20+(i%3)*19}`,'#4A8C3C',5)).join(''));
for(const deg of [35,100,170,230,310]){const a=deg*Math.PI/180;put('reeds',[pond.x+Math.cos(a)*(pond.rx+25),pond.y+Math.sin(a)*(pond.ry+35)],{world:true,solid:false,name:'Pond reeds'})}
writeSvg('lily',110,65,ellipse(55,34,49,26,'#58AC45',INK,2.5)+`<path d="M55 34 L86 11 L66 37Z" fill="#7FD0DF"/>`+ellipse(40,27,12,8,'#FFF4C5',INK,2));
for(const cp of [[300,344],[350,379],[292,384],[360,345]]){const[x,y]=T(cp);floating.push({src:'lily.svg',x,y,width:110,height:65,phase:rnd()*6})}
const walkways=[],arches=[];
function bridge(id,a,b,w=155){const aa=T(a),bb=T(b),dx=bb[0]-aa[0],dy=bb[1]-aa[1],len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,px=-uy,py=ux,point=(t,s)=>[aa[0]+ux*t+px*s,aa[1]+uy*t+py*s],edge=[point(-25,-w/2),point(len+25,-w/2),point(len+25,w/2),point(-25,w/2)],xs=edge.map(p=>p[0]),ys=edge.map(p=>p[1]),x=Math.min(...xs)-25,y=Math.min(...ys)-75,ww=Math.max(...xs)-x+25,hh=Math.max(...ys)-y+25;let body=`<path d="${closed(edge)}" fill="#C88941" stroke="${INK}" stroke-width="4"/>`;for(let t=0;t<len;t+=28)body+=line(path([point(t,-w/2),point(t,w/2)]),'#885931',3);writeSvg(id,ww,hh,body,`${x} ${y} ${ww} ${hh}`);decks.push({src:id+'.svg',x,y,width:ww,height:hh});
 for(const side of [-1,1]){let rail='';const pts=[];for(let t=0;t<=len;t+=len/8){const p=point(t,side*w*.52),lift=42*4*(t/len)*(1-t/len);pts.push([p[0],p[1]-lift-48]);rail+=line(`M${f(p[0])} ${f(p[1])} v-${f(lift+55)}`,INK,10)+line(`M${f(p[0])} ${f(p[1]-2)} v-${f(lift+52)}`,'#DDA85C',6)}rail+=line(path(pts),INK,12)+line(path(pts),'#DDA85C',7);const file=id+'-rail-'+side;writeSvg(file,ww,hh,rail,`${x} ${y} ${ww} ${hh}`);props.push({id:file,name:'Arched bridge railing',src:file+'.svg',x:x+ww/2,y:y+hh,width:ww,height:hh,scale:1,anchor:{x:.5,y:1},shadow:false,wind:false,zone:'islets'})}
 walkways.push({a:aa,b:bb,w});arches.push({a:aa,b:bb,r:42,w});}
bridge('west-islet-bridge',[570,807],[570,878],170);bridge('east-islet-bridge',[860,805],[860,883],170);bridge('islet-arch',[675,920],[750,925],175);
for(const cp of [[500,919],[590,952],[860,943],[925,908]])put('alpine-pine',cp,{scale:.9,name:'Islet pine tree'});
for(const cp of [[536,955],[895,970]])put('daisy-bed',cp,{scale:.85,solid:false,name:'Islet daisy flowers'});
// Beach details in the east cove.
own('beach-umbrella',265,300,`<path d="M131 292 L131 115 L141 115 L141 292Z" fill="#C88941" stroke="${INK}" stroke-width="3"/><path d="M10 130 Q12 42 133 14 Q250 49 254 130 Q206 100 171 130 Q134 102 95 130 Q54 100 10 130Z" fill="#FFF4C5" stroke="${INK}" stroke-width="4"/><path d="M133 14 Q82 66 95 130 Q134 102 171 130 Q180 67 133 14Z" fill="#F77645" stroke="${INK}" stroke-width="3"/>`);
own('shore-shell',60,40,`<path d="M7 29 Q1 9 14 8 Q20 -1 30 7 Q40 -2 47 9 Q62 10 53 31 L32 37Z" fill="#FFF0C7" stroke="${INK}" stroke-width="2"/>`+line('M30 34 L16 12 M30 34 L30 9 M31 34 L44 13','#C8A967',2));
for(let i=2;i<coast.length;i+=8){const[x,y]=coast[i],dx=4000-x,dy=2700-y,ll=Math.hypot(dx,dy),xx=x+dx/ll*47,yy=y+dy/ll*47;if(pathClear(xx,yy,35)&&!props.some(p=>Math.hypot(xx-p.x,yy-p.y)<100))put('shore-shell',[xx,yy],{world:true,scale:.9,name:'Shore shell',solid:false})}
own('beach-towel',160,200,`<path d="M20 10 L135 20 L150 180 L10 190Z" fill="#F9F0D1" stroke="${INK}" stroke-width="3"/>`+[35,70,105,140].map(y=>`<path d="M17 ${y} L140 ${y+10} L142 ${y+25} L15 ${y+15}Z" fill="#64BACA"/>`).join(''));
for(const cp of [[1330,645],[1385,620]])put('beach-umbrella',cp,{scale:.95,name:'Beach umbrella'});
for(const cp of [[1307,686],[1372,675]])put('beach-towel',cp,{scale:.9,name:'Striped beach towel',solid:false});
// All geometry and art share these exact positions.
const zones={};for(const z of plazas)zones[z.id]={...z,kind:z.id==='plaza'?'plaza':'activity',spawn:z.id==='plaza'?T([780,585]):[z.x,z.y]};
zones.summit={name:'Cloud crown summit',x:centreXY[0],y:centreXY[1],spawn:[centreXY[0],centreXY[1]+180]};zones.pond={name:'Lily tarn',x:pond.x,y:pond.y,spawn:T([320,424])};zones['east-summit']={name:'Pine crown',x:T([1020,120])[0],y:T([1020,120])[1],spawn:T([1020,145])};
for(let i=0;i<rowLines.length;i++){const l=rowLines[i],mid=l[Math.floor(l.length/2)];zones['stalls-'+(i+1)]={kind:'stall-row',name:'Open alpine stall lane '+(i+1),x:mid[0],y:mid[1],line:l,width:260,poly:[...l.map(([x,y])=>[x,y-130]),...l.toReversed().map(([x,y])=>[x,y+130])],spawn:mid}}
const harbor={jetty:{foot:T([175,300]),tip:T([65,270]),width:130},spawn:zones.plaza.spawn};
// Three berths well outside the coast, at least 300 apart.
const aa=harbor.jetty.foot,bb=harbor.jetty.tip,len=Math.hypot(bb[0]-aa[0],bb[1]-aa[1]),ux=(bb[0]-aa[0])/len,uy=(bb[1]-aa[1])/len;
harbor.boats=[[-100,180],[-210,-190],[130,200]].map(([t,s])=>({x:f(bb[0]+ux*t-uy*s),y:f(bb[1]+uy*t+ux*s),turn:Math.atan2(ux,-uy)}));
const water=[pond],world={name:'Mossnap Peaks',width:W,height:H,coast,water,bridges:[],obstacles,islets,walkways,arches,zones,paths:paths.map(p=>p.line),props:[],ambient:{birds:[[700,450],[4000,550],[6800,900],[7400,4100],[4500,5300],[900,3600]],butterflies:[T([450,650]),T([1090,680])]},sleepAvoid:[...plazas.map(z=>({x:z.x,y:z.y,rx:z.rx+55,ry:z.ry+45,name:z.id})),{x:centreXY[0],y:centreXY[1],rx:550,ry:300,name:'summit lookout'},...rowLines.flatMap(l=>l.filter((_,i)=>i%4===0).map(([x,y])=>({x,y,rx:190,ry:190,name:'stall lane'})))],sleepSpots:{}};
const walk={width:W,height:H,coast:walkCoast,water,bridges:[],obstacles,walkways,arches,islets,paths:world.paths};
const art={width:W,height:H,sea:SEA,ground,decks,flats,props,floating};
jwrite(D+'world.json',world);jwrite(D+'walk-world.json',walk);jwrite(D+'harbor.json',harbor);jwrite(D+'paths.json',paths);jwrite(D+'placements.json',props);jwrite(A+'art.json',art);
const land=polyArea(coast)+islets.reduce((s,a)=>s+Math.PI*a[2]*a[3],0);jwrite(A+'peaks-metrics.json',{landArea:Math.round(land),homeRatio:f(land/11090000),trees:props.filter(p=>/tree/.test(p.name)).length,props:props.length,curvedBenches:benchRecords.length,groundTuftCandidates:6500,paths:paths.length,activities:3,stallRows:2,centrePieces:C.pieces.length,svgOnly:true});
console.log({landArea:Math.round(land),homeRatio:land/11090000,trees:props.filter(p=>/tree/.test(p.name)).length,props:props.length,benches:benchRecords.length});
