import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {geometry,inPoly,inShape} from '../../assets/world/island-geometry.mjs';
import {drawArcBench} from '../arc-bench-draw.mjs';
const A='public/pixi-art/themes/blossom/',D='assets/world/themes/blossom/';
for(const p of [A,A+'reuse',A+'centre',D])mkdirSync(p,{recursive:true});
const W=7600,H=5400,S=4.5, f=n=>Math.round(n*10)/10,T=([x,y])=>[f(400+(x-40)*S),f(500+(y-40)*S)];
const C={ink:'#39472D',grass:'#93B72F',deep:'#7FAE31',shade:'#8CAF2D',cream:'#FFF0C7',sand:'#FDE48C',sandShade:'#E4C567',pink:'#F6A6B8',pinkDeep:'#DB7695',blush:'#FFD0D5',sea:'#8CC8CD',water:'#6EC9DE',wood:'#C88941',woodShade:'#885931'};
let seed=1414;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const path=(p,closed=false)=>'M'+p.map(q=>q.map(f).join(' ')).join(' L')+(closed?' Z':'');
const el=(x,y,rx,ry,fill,stroke='none',sw=2)=>`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const line=(d,stroke=C.ink,sw=2,fill='none')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
function svg(body,box,title){return `<svg xmlns="http://www.w3.org/2000/svg" width="${box[2]}" height="${box[3]}" viewBox="${box.join(' ')}" stroke-linecap="round" stroke-linejoin="round"><title>${title}</title>${body}</svg>`;}
function save(src,body,box,title){writeFileSync(A+src,svg(body,box,title));}
function curve(points,closed=false,n=10){const out=[],N=points.length,P=i=>points[closed?(i+N)%N:Math.max(0,Math.min(N-1,i))];for(let i=0;i<(closed?N:N-1);i++){const a=P(i-1),b=P(i),c=P(i+1),d=P(i+2);for(let k=0;k<n;k++){const t=k/n;out.push([0,1].map(j=>f(.5*(2*b[j]+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t*t+(-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t))));}}if(!closed)out.push(points[N-1]);return out;}
const area=p=>Math.abs(p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+a[0]*b[1]-b[0]*a[1]},0)/2);
function offset(p,d){const signed=p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+a[0]*b[1]-b[0]*a[1]},0)>0?1:-1;return p.map((a,i)=>{const b=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length],dx=c[0]-b[0],dy=c[1]-b[1],l=Math.hypot(dx,dy);return[f(a[0]-signed*dy/l*d),f(a[1]+signed*dx/l*d)]});}
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)};
const dist=(x,y,p)=>Math.min(...p.slice(1).map((b,i)=>seg(x,y,p[i],b)));
const coast=curve([[120,240],[170,140],[280,80],[450,70],[560,90],[700,42],[860,70],[1010,90],[1170,120],[1330,115],[1450,190],[1450,290],[1410,370],[1490,450],[1480,550],[1400,605],[1280,690],[1160,715],[1100,765],[1000,835],[985,905],[840,940],[680,945],[540,910],[400,880],[260,850],[160,810],[140,705],[80,630],[65,520],[80,450],[45,350]].map(T),true);
const grass=offset(coast,105),water=[{x:T([285,500])[0],y:T([285,500])[1],rx:600,ry:440}];
const islets=[[...T([1130,942]),365,190],[...T([1380,910]),305,180]];
const pathSpec=[
 [[215,170],[280,310],[490,365],[615,230],[760,160],[915,205],[1040,345],[1215,340],[1350,225],[1400,160]],
 [[215,170],[175,255],[220,350],[390,405],[455,490],[410,610],[280,645],[180,715],[260,800]],
 [[555,500],[455,490],[420,520]],[[965,500],[1060,515],[1110,420],[1215,340]],
 [[760,630],[755,710],[730,800],[700,875]],
 [[260,800],[420,805],[570,840],[700,875],[850,860],[980,825],[1060,740],[1150,655],[1250,610],[1310,540]],
 [[180,715],[165,780],[192,822]],
 [[980,825],[1050,855],[1070,888]],
 [[600,490],[650,570],[760,585],[870,570],[920,490],[870,405],[760,395],[650,405],[600,490]],
 [[425,805],[475,710],[510,635],[410,610]],
 [[1060,515],[1180,575],[1310,540]],
 [[700,875],[720,920]],
];
const paths=pathSpec.map((p,i)=>({line:curve(p.map(T)),w:i===8?220:i===9?186:210}));
const Z=(id,c,name,kind='paved')=>{const [x,y]=T(c);return{id,name,kind,x,y,rx:c[2]*S,ry:c[3]*S,spawn:[x,y]}};
const centre=Z('centre',[760,490,205,140],'Blossom Hill terrace');
const activities=[Z('activity-1',[330,220,102,65],'Hanami picnic lawn','lawn'),Z('activity-2',[1230,458,100,73],'Petal play court'),Z('activity-3',[580,745,95,65],'Spring gathering lawn','lawn')];
const stalls=[Z('stalls-1',[1080,250,112,48],'Tea market court'),Z('stalls-2',[865,780,105,46],'Spring craft court')];
const plazas=[centre,...activities,...stalls];
const props=[],flats=[],decks=[],floating=[],obstacles=[],walkways=[],arches=[],assets={};let pid=0;
const manifest=JSON.parse(readFileSync('assets/manifest.json'));
function asset(n,src,w,h,ay=1){assets[n]={src,w,h,ay};}
function own(n,body,w,h,ay=1){save(n+'.svg',body,[0,0,w,h],n.replaceAll('-',' '));asset(n,n+'.svg',w,h,ay);}
for(let i=1;i<=5;i++){
 const src=`plants/tree-${i}.svg`,s=readFileSync('public/pixi-art/'+src,'utf8'),v=s.match(/viewBox="([^"]+)/)[1].split(' ').map(Number);
 copyFileSync('public/pixi-art/'+src,A+`reuse/tree-${i}.svg`);asset('tree-'+i,`reuse/tree-${i}.svg`,v[2],v[3]);
 let pink=s.replaceAll('#4AA539',C.pink).replaceAll('#2B7A37',C.pinkDeep).replaceAll('#89C332',C.blush);let flowers='';
 for(const [x,y]of [[70,80],[126,42],[176,105],[52,164],[137,144],[199,194],[85,210]])flowers+=blossom(x,y,5.8);
 pink=pink.replace('</svg>',flowers+'</svg>');writeFileSync(A+`reuse/blossom-tree-${i}.svg`,pink);asset('blossom-tree-'+i,`reuse/blossom-tree-${i}.svg`,v[2],v[3]);
}
for(const [dir,names]of Object.entries({plants:['bush-1','bush-2','bush-3','bush-4','bush-5','bush-6','flower-1','flower-2','flower-3'],decals:['grass-tuft-1','grass-tuft-2','grass-tuft-3','flower-dot-1','flower-dot-2','flower-dot-3','pebble-1','sand-speck-1'],detail:['street--picnic-blanket','street--umbrella-garden','beach--towel-striped','beach--sandcastle-small','beach--beach-ball','beach--shell-scallop','beach--starfish-orange','nature--rock-round','nature--reeds','nature--cattails','nature--lily-pad-flower','nature--lily-pad-large']}))for(const n of names){
 copyFileSync(`public/pixi-art/${dir}/${n}.svg`,A+`reuse/${n}.svg`);const s=readFileSync(A+`reuse/${n}.svg`,'utf8'),v=s.match(/viewBox="([^"]+)/)[1].split(/\s+/).map(Number),key=n.includes('--')?n.split('--')[1]:n,a=manifest.assets.find(a=>a.name===key);
 asset(key,`reuse/${n}.svg`,dir==='detail'?a.size.width:v[2],dir==='detail'?a.size.height:v[3],dir==='detail'?a.anchor.y/a.size.height:1);
}
function blossom(x,y,r,color=C.cream){let s='';for(let i=0;i<5;i++){const a=i*Math.PI*2/5;s+=el(x+Math.cos(a)*r*.74,y+Math.sin(a)*r*.74,r*.63,r*.63,color);}return s+el(x,y,r*.23,r*.23,C.pinkDeep);}
function petal(x,y,r=5,a=0,color='#F3A1B3'){return `<path d="M0 0 C${-r} ${-r*1.5} ${r*.9} ${-r*2} ${r} ${-r*.6} Q${r*.6} ${r*.4} 0 0Z" transform="translate(${f(x)} ${f(y)}) rotate(${a})" fill="${color}"/>`;}
own('petals',Array.from({length:12},()=>petal(8+rnd()*94,10+rnd()*42,3+rnd()*3,rnd()*360)).join(''),110,60);
own('lantern',el(32,176,24,8,'#7FAE31')+line('M23 175 H41 L38 165 H26Z',C.ink,2,C.woodShade)+line('M29 165 V59 H35 V165Z',C.ink,2,C.wood)+line('M18 41 Q32 33 46 41 L44 82 Q32 93 20 82Z',C.ink,2,C.cream)+line('M15 40 L32 24 L49 40Z',C.ink,2,C.woodShade)+line('M23 48 V78 M32 46 V81 M41 48 V78','#DBB969',1.5)+el(32,23,4,4,C.cream,C.ink,1.6),64,185);
own('stone-lantern',el(53,177,43,12,'#9AAB72')+line('M20 175 L28 157 H77 L86 175Z',C.ink,2.2,'#B9B99B')+line('M43 157 L45 105 H61 L64 157Z',C.ink,2.2,'#D5D1AE')+line('M28 107 L30 64 H77 L80 107Z',C.ink,2.2,'#D5D1AE')+line('M40 95 V75 H67 V95Z',C.ink,2.2,C.cream)+line('M12 66 Q29 48 35 38 H72 Q80 55 95 66Z',C.ink,2.2,'#A4AD8A')+el(53,37,22,6,C.cream,C.ink,2)+line('M48 32 L50 14 H57 L59 32Z',C.ink,2,'#C3C4A0'),108,190);
own('basket',line('M18 37 Q6 0 38 0 Q69 0 59 37',C.ink,4)+line('M6 31 H72 L63 67 Q37 76 15 66Z',C.ink,2,C.wood)+line('M20 35 L25 65 M36 35 V67 M52 35 L49 65 M11 45 H68 M14 56 H65',C.woodShade,2)+el(51,31,11,7,C.cream,C.ink,1.5)+el(48,25,5,5,C.pink,C.ink,1.5),80,78);
own('tea-set',el(70,63,67,17,C.woodShade,C.ink)+el(70,52,67,17,C.wood,C.ink)+line('M28 64 V88 M112 64 V88',C.ink,6)+line('M44 40 Q38 12 60 12 Q82 12 77 39Z',C.ink,2,C.cream)+el(59,12,15,5,C.wood,C.ink)+line('M76 21 Q93 12 88 29 L77 33',C.ink,2,C.cream)+line('M45 21 L33 15 L38 30 L47 33Z',C.ink,2,C.cream)+el(100,37,12,5,C.cream,C.ink)+line('M89 37 L91 49 Q99 54 109 49 L111 37',C.ink,2,C.pink),140,95);
own('gate',el(295,422,275,27,'#7FAE31')+line('M69 407 V117 H101 V407Z',C.ink,4,C.wood)+line('M481 407 V117 H513 V407Z',C.ink,4,C.wood)+line('M60 403 H109 V434 H60Z',C.ink,3,'#D5D1AE')+line('M473 403 H522 V434 H473Z',C.ink,3,'#D5D1AE')+line('M54 178 H528 V211 H54Z',C.ink,4,C.wood)+line('M30 111 Q285 145 553 111 L570 70 Q290 105 14 70Z',C.ink,4,C.woodShade)+line('M14 70 Q293 115 570 70 L587 34 Q290 77 0 34Z',C.ink,4,C.wood)+line('M80 126 V395 M491 126 V395','#EABF77',5)+line('M115 215 Q288 257 468 215',C.ink,3)+line('M178 235 l-11 21 19 10 -8 22 M280 245 l-11 21 19 10 -8 22 M385 237 l-11 21 19 10 -8 22',C.cream,10)+line('M82 18 V55 M505 18 V55',C.ink,5),590,450);
let kiosk=line('M23 119 H255 V251 H23Z',C.ink,3,C.wood)+line('M16 119 L39 58 H235 L266 119Z',C.ink,3,C.cream);
for(let i=0;i<6;i++)kiosk+=line(`M${30+i*37} 117 L${45+i*31} 59 H${62+i*31} L${49+i*37} 117Z`,'none',0,i%2?C.cream:C.pinkDeep);
kiosk+=line('M12 118 H268 V137 Q248 151 227 137 Q205 151 183 137 Q161 151 139 137 Q117 151 95 137 Q73 151 51 137 Q30 151 12 137Z',C.ink,2,C.blush)+line('M39 163 H241 V179 H39Z',C.ink,2,C.cream)+line('M40 211 H239 V234 H40Z',C.woodShade,2)+line('M61 183 V247 M221 183 V247',C.woodShade,3);
for(let i=0;i<6;i++)kiosk+=el(63+i*29,163,11,7,i%2?C.pink:C.cream,C.ink,1.7);
kiosk+=line('M96 35 H184 V61 H96Z',C.ink,2,C.cream)+blossom(140,48,10,C.pink);
own('tea-stall',kiosk,280,260);
let planter=el(66,119,48,11,C.deep)+line('M24 63 L33 113 Q66 128 99 113 L108 63Z',C.ink,2.6,C.wood)+el(66,63,44,12,C.cream,C.ink,2.6)+el(66,61,35,8,C.woodShade,C.ink,1.5);
for(const [x,y]of [[39,45],[61,29],[87,41],[53,58],[81,61]])planter+=line(`M66 64 Q${x} 60 ${x} ${y}`,C.deep,4)+blossom(x,y,10,C.blush);
planter+=line('M40 78 L45 107',C.cream,3);
own('blossom-planter',planter,132,135);
const pieces=[],blocked=[];const cx=centre.x,cy=centre.y;
function piece(id,body,box,layer,sortY){save('centre/'+id+'.svg',body,box,'Cherry Blossom Hill '+id);pieces.push({id,file:id+'.svg',layer,x:box[0],y:box[1],width:box[2],height:box[3],anchor:{x:0,y:0},at:box.slice(0,2),...(sortY==null?{}:{sortY})});}
let hill=el(0,-30,510,322,'#77AA39',C.ink,3)+el(0,-56,510,304,C.grass,C.deep,4);
for(let i=0;i<160;i++){let x=(rnd()-.5)*950,y=(rnd()-.5)*550-50;if((x/465)**2+((y+55)/270)**2<1)hill+=petal(x,y,4+rnd()*4,rnd()*360);}
hill+=el(12,-75,205,65,'#80AF37');for(let i=0;i<85;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd()),x=Math.cos(a)*440*r,y=Math.sin(a)*255*r-50;if(Math.hypot(x,y+70)<210)continue;hill+=line(`M${f(x-5)} ${f(y)} l3 -10 4 8 5 -8`,C.deep,2);if(i%5===0)hill+=blossom(x+5,y-7,5,C.blush);}piece('hill-garden',hill,[-520,-370,1040,685],'decal');
let trunk=line('M-175 -70 Q-111 -139 -102 -251 L-110 -369 Q-129 -454 -192 -508 Q-290 -563 -349 -651 L-411 -792 L-373 -810 Q-302 -662 -233 -626 Q-158 -603 -97 -545 Q-106 -700 -143 -1010 L-105 -1026 Q-63 -787 -37 -661 Q27 -812 64 -1030 L106 -1021 Q100 -848 51 -666 Q127 -740 228 -736 L330 -802 L355 -773 Q269 -669 183 -656 Q91 -610 53 -508 Q92 -566 193 -584 Q306 -611 399 -753 L437 -728 Q337 -530 205 -512 Q108 -463 83 -342 L84 -251 Q96 -142 181 -77 Q81 -58 5 -88 Q-72 -42 -175 -70Z',C.ink,5,C.wood);
trunk+=line('M-8 -91 Q-48 -249 -30 -424 Q-13 -548 51 -666 Q38 -496 48 -345 Q45 -179 113 -75Z','none',0,C.woodShade)+line('M-132 -91 Q-76 -177 -83 -306 M-75 -384 Q-87 -473 -168 -524 M-55 -508 Q-54 -597 -80 -702 M56 -424 Q81 -513 187 -544 M-135 -564 Q-233 -596 -296 -674 M35 -618 Q74 -678 135 -705',C.woodShade,7)+line('M-107 -115 Q-81 -174 -79 -220 M-63 -441 Q-55 -493 -63 -538 M91 -541 Q149 -575 203 -578','#EABE79',6);
const crowns=[[-470,-866,220,138],[-280,-1030,240,161],[-65,-1167,231,164],[170,-1116,225,169],[390,-981,234,158],[492,-795,223,142],[-484,-795,232,146],[-258,-775,253,169],[-30,-933,249,177],[227,-872,255,166],[-20,-790,240,140],[275,-795,197,124]];
let canopy='';for(const [i,[x,y,rx,ry]]of crowns.entries()){
 const contour=[];for(let j=0;j<144;j++){const a=j*Math.PI*2/144,r=1+Math.sin(a*18+i)*.042+Math.sin(a*7+i*.3)*.018;contour.push([x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r]);}
 canopy+=line(path(curve(contour,true,4),true),C.ink,3.5,i%3===0?'#F4A0B3':i%3===1?'#F8B7C3':'#F9B0C0');
 const shade=contour.slice(0,73),inside=[[-.80,.15],[-.65,.40],[-.45,.25],[-.22,.45],[0,.24],[.23,.45],[.44,.20],[.72,.35]].map(([a,b])=>[x+rx*a,y+ry*b]);
 canopy+=line(path(curve([...shade,...inside],true,4),true),'none',0,C.pinkDeep);
 const hi=[[-.78,-.40],[-.66,-.61],[-.54,-.64],[-.47,-.79],[-.28,-.76],[-.15,-.59],[-.35,-.59],[-.44,-.44],[-.61,-.47],[-.69,-.31]].map(([a,b])=>[x+rx*a,y+ry*b]);canopy+=line(path(curve(hi,true,5),true),'none',0,'#FFD0D5');
 for(let j=0;j<18;j++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.83;canopy+=blossom(x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r,7+rnd()*6,j%3?'#FFE1DF':C.cream);}
}
piece('ancient-trunk',trunk,[-345,-1040,695,1010],'sorted',-45);
piece('blossom-canopy',canopy,[-755,-1355,1520,870],'sorted',-44);
blocked.push({name:'Ancient blossom tree trunk',ellipse:{x:0,y:-122,rx:153,ry:92}});
for(const [side,a,b]of [['west',.58,1.32],['east',1.83,2.56]]){
 const arc=(r,dy)=>Array.from({length:25},(_,i)=>{const t=a+(b-a)*i/24;return[Math.cos(t)*r,Math.sin(t)*r*.65+dy]});const top=arc(525,-15),bot=arc(525,21),inner=arc(490,-15);
 const s=line(path([...top,...bot.reverse()],true),C.ink,2.5,'#C3B486')+line(path([...top,...inner.reverse()],true),C.ink,2.5,C.cream);
 piece('coping-'+side,s,[-530,-20,1060,400],'front',350);blocked.push({name:'Hill coping '+side,poly:[...arc(530,0),...arc(485,0).reverse()]});
}
let stairs=line('M-143 298 H143 L165 479 H-165Z',C.ink,3,'#DCC997');for(let y=304;y<479;y+=32)stairs+=line(`M${-143-(y-298)*.12} ${y} H${143+(y-298)*.12}`,C.ink,2.5)+line(`M${-143-(y-298)*.12} ${y-4} H${143+(y-298)*.12}`,C.cream,6);
piece('hill-stairs',stairs,[-172,292,344,195],'decal');
const centreData={theme:'blossom',name:'Cherry Blossom Hill ancient sakura terrace',concept:'concepts/themes/concepts/14-blossom.png',origin:'centre of blossom hill terrace',placement:{x:cx,y:cy,scale:1},depthRatio:centre.ry/centre.rx,pieces,outerEdge:{x:0,y:0,rx:centre.rx,ry:centre.ry},blocked,spawn:[0,610]};
writeFileSync(A+'centre/centre.json',JSON.stringify(centreData,null,2));
for(const p of pieces){if(p.layer==='decal'){flats.push({src:'centre/'+p.file,x:cx+p.x,y:cy+p.y,width:p.width,height:p.height,topLeft:true});continue;}
 const sy=p.sortY??p.y+p.height;props.push({id:'blossom-centre-'+p.id,name:p.id.includes('canopy')?'Ancient sakura crown':'Hill '+p.id,src:'centre/'+p.file,x:cx+p.x,y:cy+sy,width:p.width,height:p.height,scale:1,anchor:{x:0,y:(sy-p.y)/p.height},shadow:false,wind:false,zone:'centre'});
}
for(const b of blocked){if(b.ellipse)obstacles.push({...b.ellipse,x:cx+b.ellipse.x,y:cy+b.ellipse.y,name:b.name});else obstacles.push({name:b.name,poly:b.poly.map(([x,y])=>[f(cx+x),f(cy+y)])});}
function put(n,x,y,scale=1,opts={}){const a=assets[n];if(!a)throw Error(n);const id='blossom-'+pid++;const p={id,name:n.replaceAll('-',' '),asset:n,src:a.src,x:f(x),y:f(y),width:a.w,height:a.h,scale:f(scale*1000)/1000,anchor:{x:.5,y:a.ay},flip:false,...opts};props.push(p);
 if(opts.solid!==false){let rx=/tree/.test(n)?30:/lantern/.test(n)?17:/bush/.test(n)?a.w*scale*.31:Math.min(140,a.w*scale*.36),ry=/tree/.test(n)?22:/lantern/.test(n)?13:Math.min(48,a.w*scale*.15);obstacles.push({name:id,x:p.x,y:f(p.y-9),rx:f(rx),ry:f(ry)});}return p;}
function place(n,c,scale=1,opts={}){return put(n,...T(c),scale,opts);}
const gate=place('gate',[738,808],1,{solid:false,zone:'gate'});for(const s of [-1,1])obstacles.push({name:'Gate post',x:f(gate.x+s*206),y:gate.y-26,rx:24,ry:34});
place('tea-stall',[1020,208],1.15,{zone:'tea-market'});place('tea-stall',[1200,235],1.05,{zone:'tea-market',flip:true});
place('stone-lantern',[210,397],1);place('stone-lantern',[365,408],1);place('stone-lantern',[647,820],1);place('stone-lantern',[838,845],1);
const benchRecords=[];
for(const z of plazas)for(const deg of z.id==='centre'?[-146,-35,35,145]:[-143,-37,42,138]){
 const radius=z.rx+(z.id==='centre'?-60:30),k=z.ry/z.rx,span=z.id==='centre'?15:26,ground=(a,s)=>[z.x+Math.cos(a*Math.PI/180)*s,z.y+Math.sin(a*Math.PI/180)*s*k];
 const arc=r=>Array.from({length:25},(_,i)=>ground(deg-span/2+i*span/24,r));const footprint=[...arc(radius-25),...arc(radius+28).reverse()],xs=footprint.map(p=>p[0]),ys=footprint.map(p=>p[1]);
 const x0=Math.floor(Math.min(...xs))-5,y0=Math.floor(Math.min(...ys))-56,w=Math.ceil(Math.max(...xs))-x0+6,h=Math.ceil(Math.max(...ys))-y0+6,[x,y]=ground(deg,radius),src=`bench-${z.id}-${deg}.svg`;
 const cfg={ground,sIn:radius-21,sOut:radius+19,back:radius+23,seat:17,top:47,ink:C.ink,line:2.2,thin:1.5,spindleDeg:1.8};
 save(src,drawArcBench({deg,span},cfg).join(''),[x0,y0,w,h],'Curved cherrywood bench on '+z.name);
 props.push({id:`blossom-bench-${z.id}-${deg}`,name:'Curved cherrywood bench',src,x:f(x),y:f(y),width:w,height:h,scale:1,anchor:{x:(x-x0)/w,y:(y-y0)/h},shadow:false,wind:false,zone:z.id});obstacles.push({name:'Curved bench',poly:footprint});benchRecords.push({plaza:z.id,deg,span,radius,ratio:k});
}
for(const z of plazas){for(const a of (z.id==='centre'?[-114,-66,66,114]:[-114,-66,66,114,0,180])){const t=a*Math.PI/180,x=z.x+Math.cos(t)*(z.rx+32),y=z.y+Math.sin(t)*(z.ry+26);if(z.id!=='centre'&&paths.some(p=>dist(x,y,p.line)<p.w/2+32))continue;put('lantern',x,y,z.id==='centre'?1.1:.9,{zone:z.id});put('blossom-planter',x+Math.cos(t)*78,y+Math.sin(t)*48,z.id==='centre'?.95:.8,{zone:z.id});}}
const pond=water[0],bridgeY=pond.y+6,bridgeX=pond.x;
let bridge=line('M-620 0 Q0 -105 620 0 V85 Q0 -20 -620 85Z',C.ink,3,C.wood);
for(let x=-610;x<620;x+=36){const y=-100*(1-(x/620)**2);bridge+=line(`M${x} ${y+3} V${y+81}`,C.woodShade,2);}
const bridgeBox=[bridgeX-640,bridgeY-110,1280,220];save('koi-bridge-deck.svg',`<g transform="translate(${bridgeX} ${bridgeY})">${bridge}</g>`,bridgeBox,'Arched koi garden bridge planked deck');decks.push({src:'koi-bridge-deck.svg',x:bridgeBox[0],y:bridgeBox[1],width:1280,height:220});
for(const [name,dy,sortY]of [['back',0,bridgeY-60],['front',85,bridgeY+87]]){let b='';for(const t of [0,1])b+=line(`M-620 ${dy-t*42} Q0 ${dy-110-t*42} 620 ${dy-t*42}`,C.ink,12)+line(`M-620 ${dy-t*42} Q0 ${dy-110-t*42} 620 ${dy-t*42}`,'#E68B59',7);for(let x=-620;x<=620;x+=124){const y=dy-100*(1-(x/620)**2);b+=line(`M${x} ${y+1} V${y-63}`,C.ink,13)+line(`M${x} ${y+1} V${y-63}`,'#E68B59',8)+el(x,y-66,9,6,C.cream,C.ink,2);}save('koi-rail-'+name+'.svg',b,[-640,-180,1280,320],'Koi bridge '+name+' railing');props.push({id:'blossom-koi-rail-'+name,name:'Arched koi bridge '+name+' rail',src:'koi-rail-'+name+'.svg',x:bridgeX,y:sortY,width:1280,height:320,scale:1,anchor:{x:.5,y:(sortY-bridgeY+180)/320},shadow:false,wind:false});}
walkways.push({a:[pond.x-625,bridgeY+37],b:[pond.x+625,bridgeY+37],w:88});arches.push({a:[pond.x-625,bridgeY+37],b:[pond.x+625,bridgeY+37],r:100,w:88});
const bridges=[{x:pond.x,y:bridgeY+37,w:1250,h:88}];
for(let i=0;i<12;i++){const a=i*Math.PI*2/12,x=pond.x+Math.cos(a)*(pond.rx+27),y=pond.y+Math.sin(a)*(pond.ry+20);put(i%3?'rock-round':'reeds',x,y,i%3?.13:.2,{solid:i%3!==0});}
for(const [dx,dy]of [[-300,-180],[-30,-255],[235,-150],[-220,230],[60,230],[320,170]]){const n=rnd()<.5?'lily-pad-flower':'lily-pad-large',a=assets[n];floating.push({src:a.src,x:pond.x+dx,y:pond.y+dy,width:a.w*.17,height:a.h*.17,anchor:{x:.5,y:1},phase:rnd()*6});}
for(let i=0;i<9;i++){const x=pond.x-490+i*120,y=pond.y+240+Math.sin(i*.4)*50;save(`stone-${i}.svg`,el(52,30,49,26,'#B6BCA0',C.ink,2)+line('M22 18 Q47 8 77 16',C.cream,3),[0,0,104,60],'Koi pond stepping stone');decks.push({src:`stone-${i}.svg`,x:x-52,y:y-30,width:104,height:60});bridges.push({x,y,w:164,h:98});}
function koi(x,y,a){return `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})">${line('M-32 0 Q-12 -18 20 -7 Q37 -3 34 3 Q16 15 -15 10 L-38 20 L-31 2 L-43 -9Z',C.ink,1.7,'#FFF3D4')}${line('M-15 -8 Q0 -13 9 -8 L4 7 Q-8 13 -14 6Z','none',0,'#EC8354')}${el(24,-2,2,2,C.ink)}${line('M-2 -10 L-9 -22 L9 -12',C.ink,1.5,C.cream)}</g>`;}
let fish='';for(const [x,y,a]of [[-260,-225,23],[30,-190,140],[260,-245,10],[-250,155,-15],[105,140,165],[355,275,210]])fish+=koi(pond.x+x,pond.y+y,a);
save('koi.svg',fish,[pond.x-pond.rx,pond.y-pond.ry,pond.rx*2,pond.ry*2],'Six koi in blossom pond');flats.push({src:'koi.svg',x:pond.x-pond.rx,y:pond.y-pond.ry,width:pond.rx*2,height:pond.ry*2,topLeft:true});
function homeDeck(id,at,sx,sy){const J={file:'public/pixi-art/bridge-jetty-5.svg',vb:[5004.9592,1492.5089,494.0617,277.2587],a:[5034.08,1638.41],b:[5469.9,1681.99]};const inner=readFileSync(J.file,'utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');const map=([x,y])=>[f(at[0]+(x-J.a[0])*sx),f(at[1]+(y-J.a[1])*sy)],a=map(J.vb),b=map([J.vb[0]+J.vb[2],J.vb[1]+J.vb[3]]),x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(a[0]-b[0]),h=Math.abs(a[1]-b[1]);save(id+'.svg',`<g transform="translate(${at}) scale(${sx} ${sy}) translate(${-J.a[0]} ${-J.a[1]})">${inner}</g>`,[x,y,w,h],'Home wooden blossom '+id);decks.push({src:id+'.svg',x,y,width:w,height:h});const tip=map(J.b);walkways.push({a:at,b:tip,w:90});arches.push({a:at,b:tip,r:55,w:90});return tip;}
homeDeck('east-pier',T([1423,538]),.9,1);
function islandBridge(id,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),nx=-dy/L*52,ny=dx/L*52,points=(side,z)=>Array.from({length:33},(_,i)=>{const t=i/32;return[a[0]+dx*t+nx*side,a[1]+dy*t+ny*side-65*4*t*(1-t)-z]});const foot=[...points(-1,0),...points(1,0).reverse()];let s=line(path(foot,true),C.ink,3,C.wood);for(let i=0;i<=32;i++){const t=i/32;if(i%2===0)s+=line(path([points(-1,0)[i],points(1,0)[i]]),C.woodShade,2);}const all=[...points(-1,65),...points(1,0)],x=Math.min(...all.map(p=>p[0]))-10,y=Math.min(...all.map(p=>p[1]))-10,w=Math.max(...all.map(p=>p[0]))-x+10,h=Math.max(...all.map(p=>p[1]))-y+15;save(id+'.svg',s,[x,y,w,h],id);decks.push({src:id+'.svg',x,y,width:w,height:h});for(const side of [-1,1]){let rail=line(path(points(side,54)),C.ink,10)+line(path(points(side,54)),C.wood,6);for(let i=0;i<=32;i+=4)rail+=line(path([points(side,0)[i],points(side,62)[i]]),C.ink,9)+line(path([points(side,0)[i],points(side,62)[i]]),C.wood,5);const sy=Math.max(a[1],b[1])+ny*side;save(id+'-rail-'+side+'.svg',rail,[x,y,w,h],id+' separate rail');props.push({id:id+'-rail-'+side,name:'Wooden blossom bridge rail',src:id+'-rail-'+side+'.svg',x,y:sy,width:w,height:h,scale:1,anchor:{x:0,y:(sy-y)/h},shadow:false,wind:false});}walkways.push({a,b,w:104});arches.push({a,b,w:104,r:65});}
islandBridge('islet-bridge-1',T([985,902]),[islets[0][0]-220,islets[0][1]-25]);islandBridge('islet-bridge-2',[islets[0][0]+250,islets[0][1]-18],[islets[1][0]-200,islets[1][1]-20]);
for(const [i,[x,y]]of islets.entries()){put('blossom-tree-'+(i+2),x,y-35,1.1);put('bush-2',x+160,y+18,1.1);put('flower-2',x-160,y+30,1.3,{solid:false});put('rock-round',x-80,y+80,.12);}
for(const c of [[340,295],[455,260],[510,670],[1005,620],[900,150],[250,752]]){const [x,y]=T(c);put('picnic-blanket',x,y,.26,{solid:false});put('basket',x-58,y-25,.9);put('tea-set',x+95,y-20,.9);}
for(const c of [[1250,660],[1335,619]]){place('umbrella-garden',c,.3);place('towel-striped',[c[0]-25,c[1]+20],.25,{solid:false});place('beach-ball',[c[0]+35,c[1]+20],.19);}
place('sandcastle-small',[1375,603],.22);place('shell-scallop',[1230,700],.16,{solid:false});place('starfish-orange',[1295,682],.17,{solid:false});
const land=geometry({coast:grass,water,walkways:[],bridges:[],islets,obstacles:[]});
const open=(x,y,pad=0)=>plazas.some(z=>((x-z.x)/(z.rx+pad))**2+((y-z.y)/(z.ry+pad))**2<1);
const onPath=(x,y,rad=0)=>paths.some(p=>dist(x,y,p.line)<p.w/2+rad);
function canPlant(x,y,w,h){return land.walkable(x,y)&&!water.some(q=>inShape(x,y,q,w*.28))&&land.walkable(x-w*.25,y)&&!open(x,y,w*.5+20)&&!onPath(x,y,w*.48+15)&&!walkways.some(b=>seg(x,y,b.a,b.b)<b.w/2+w*.55)&&!props.some(p=>p.id?.startsWith('blossom-bench-')&&y>p.y&&x+w/2>p.x-p.width*p.anchor.x-20&&x-w/2<p.x+p.width*(1-p.anchor.x)+20&&y-h<p.y+8)&&!props.some(p=>Math.abs(x-p.x)<(w+p.width*p.scale)*.40&&Math.abs(y-p.y)<Math.min(h,p.height*p.scale)*.58)&&Math.hypot(x-gate.x,y-gate.y)>500&&!(x>cx-900&&x<cx+900&&y>cy-1650&&y<cy+550);}
let trees=0;const clusters=[[220,140],[450,160],[620,115],[960,140],[1240,150],[1390,270],[1370,420],[1390,535],[1140,555],[1000,660],[870,675],[540,680],[380,705],[320,825],[555,880],[875,885],[200,610],[135,480],[345,375],[490,450],[500,570],[985,405],[1060,365],[1180,620],[1040,730]];
for(const [ci,c]of clusters.entries())for(let j=0;j<6;j++)for(let tries=0;tries<70;tries++){const [a,b]=T(c),x=a+(rnd()-.5)*620,y=b+(rnd()-.5)*440,n=ci%3===0?'tree-'+(1+trees%5):'blossom-tree-'+(1+trees%5),s=1.05+rnd()*.30,v=assets[n];if(!canPlant(x,y,v.w*s,v.h*s))continue;put(n,x,y,s,{flip:rnd()<.5});trees++;break;}
for(let t=0;trees<85&&t<20000;t++){const x=600+rnd()*6400,y=720+rnd()*3900,n=t%4?'blossom-tree-'+(1+trees%5):'tree-'+(1+trees%5),s=1.02+rnd()*.23,v=assets[n];if(canPlant(x,y,v.w*s,v.h*s)){put(n,x,y,s);trees++;}}
const treeProps=props.filter(p=>/tree/.test(p.asset||''));
for(const [i,t]of treeProps.entries()){for(let j=0;j<2;j++){const x=t.x+(j?1:-1)*(75+rnd()*70),y=t.y+10+rnd()*40;if(!land.walkable(x,y)||open(x,y,32)||onPath(x,y,50))continue;put('bush-'+(1+(i+j)%6),x,y,.8);}}
for(let n=0,t=0;n<160&&t<15000;t++){const x=600+rnd()*6400,y=720+rnd()*3900;if(!land.walkable(x,y)||open(x,y,45)||onPath(x,y,48)||props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.4)<95))continue;put(n%3?'flower-'+(1+n%3):'bush-'+(1+n%6),x,y,n%3?1.1:1.05,{solid:n%3===0});n++;}
let nFlat=0;for(let t=0;nFlat<2300&&t<50000;t++){
 const x=570+rnd()*6500,y=600+rnd()*4180;if(!inPoly(x,y,grass)||water.some(q=>inShape(x,y,q,22)))continue;
 if(plazas.some(z=>z.kind==='paved'&&inShape(x,y,z,8)))continue;
 const paved=onPath(x,y,0);if(paved&&rnd()<.72)continue;const name=paved?'petals':['grass-tuft-1','grass-tuft-2','grass-tuft-3','flower-dot-1','flower-dot-2','pebble-1','petals'][nFlat%7];
 const a=assets[name],s=name==='petals'?.45:1;flats.push({src:a.src,x:f(x),y:f(y),width:f(a.w*s),height:f(a.h*s),flip:rnd()<.5});nFlat++;
}
let g=`<defs><clipPath id="grass"><path d="${path(grass,true)}"/></clipPath><clipPath id="land"><path d="${path(coast,true)}"/></clipPath></defs>`;
g+=line(path(offset(coast,-53),true),'#D8F4E6',14)+line(path(offset(coast,-26),true),'#FFF5D3',7)+line(path(coast,true),'#C4AC63',6,C.sand)+line(path(offset(coast,12),true),'none',0,C.sand);
g+=line(path(grass,true),C.deep,7,C.grass);
let patches='';for(let i=0;i<160;i++){const x=600+rnd()*6400,y=650+rnd()*4050;patches+=el(x,y,85+rnd()*170,40+rnd()*70,i%2?'#A6CD45':C.shade);}g+=`<g clip-path="url(#grass)" opacity=".40">${patches}</g>`;
const beach=curve([[1170,617],[1270,557],[1450,547],[1535,580],[1470,690],[1270,743],[1160,735],[1105,701]].map(T),true);
g+=`<g clip-path="url(#land)">${line(path(beach,true),C.sandShade,6,C.sand)}</g>`;
for(const p of paths)g+=line(path(p.line),C.deep,p.w+12);for(const p of paths)g+=line(path(p.line),C.sandShade,p.w+5);for(const p of paths)g+=line(path(p.line),C.sand,p.w);
function pattern(z){const {x,y,rx,ry}=z,k=ry/rx;
 let s=el(x,y,rx+13,ry+13,C.deep)+el(x,y,rx+5,ry+5,C.sandShade,C.ink,2.5)+el(x,y,rx,ry,C.cream,'#A99765',2);
 if(z.kind==='lawn'){s+=el(x,y,rx-22,ry-18,'#A6CD45',C.deep,2.5);for(let i=0;i<100;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.92,xx=x+Math.cos(a)*(rx-35)*r,yy=y+Math.sin(a)*(ry-35)*r;s+=line(`M${f(xx-7)} ${f(yy)} l4 -9 4 7 5 -11`,C.deep,1.7);}return s;}
 const ring=(r0,r1,num)=>{let out='';for(let i=0;i<num;i++){const a=i*2*Math.PI/num,b=(i+1)*2*Math.PI/num,pts=[];for(let j=0;j<=3;j++)pts.push([x+Math.cos(a+(b-a)*j/3)*r0,y+Math.sin(a+(b-a)*j/3)*r0*k]);for(let j=3;j>=0;j--)pts.push([x+Math.cos(a+(b-a)*j/3)*r1,y+Math.sin(a+(b-a)*j/3)*r1*k]);out+=line(path(pts,true),'#B6A578',1.7,['#FDE48C','#FFF0C7','#F8DF98','#F4D783'][i%4]);}return out;};
 for(let r=80;r<rx-45;r+=100)s+=ring(r,Math.min(r+100,rx-45),Math.max(14,Math.round(r/11)));
 s+=ring(rx-38,rx-4,64);
 if(z.id!=='centre'){
   const size=rx*.52;
   s+=`<g transform="translate(${x} ${y}) scale(${size/100} ${size/100*k})">`;
   for(let i=0;i<5;i++)s+=`<path d="M0 -13 C-26 -26 -43 -69 -14 -90 Q0 -101 14 -90 C43 -69 26 -26 0 -13Z" transform="rotate(${i*72})" fill="#E8B5AE" stroke="#B68B78" stroke-width="1.2"/>`;
   s+=el(0,0,9,9,'#DDBB7C','#AA9368',1.2)+'</g>';
 }

 for(let i=0;i<24;i++){const a=i*Math.PI/12;s+=el(x+Math.cos(a)*(rx-21),y+Math.sin(a)*(ry-16),6,4,i%2?C.pinkDeep:'#D8BC7B');}
 return s;
}
for(const z of plazas)g+=pattern(z);for(let a=15;a<360;a+=30){const t=a*Math.PI/180,x=centre.x+Math.cos(t)*(centre.rx-80),y=centre.y+Math.sin(t)*(centre.ry-55);g+=`<g transform="translate(${f(x)} ${f(y)}) scale(1 .683)">${blossom(0,0,15,'#E7B8AC')}</g>`;}
g+=el(pond.x,pond.y,pond.rx+32,pond.ry+25,C.deep)+el(pond.x,pond.y,pond.rx+20,pond.ry+17,C.sand,C.ink,3)+el(pond.x,pond.y,pond.rx,pond.ry,C.water,C.ink,3);
g+=el(pond.x+12,pond.y+20,pond.rx-20,pond.ry-19,'none','#82DADE',7);
for(const dy of [-200,-80,120,295])g+=line(`M${pond.x-350} ${pond.y+dy} q95 -13 186 0 m150 0 q80 -12 155 -3`,'#D4F4DF',4);
for(const [x,y,rx,ry]of islets){g+=el(x,y+14,rx+8,ry+10,'#FFF2CC',C.cream,6)+el(x,y,rx,ry,C.sand,C.sandShade,3)+el(x,y-4,rx-65,ry-48,C.grass,C.deep,3);for(let i=0;i<45;i++){const a=rnd()*6.28,r=Math.sqrt(rnd());g+=petal(x+Math.cos(a)*(rx-90)*r,y+Math.sin(a)*(ry-70)*r,4,rnd()*360);}}
for(const p of paths)for(let i=3;i<p.line.length;i+=9){const [x,y]=p.line[i];if(!open(x,y,20)&&!inShape(x,y,pond,60))g+=el(x-70,y+55,9,6,'#E2C994','#B2A16F',1.5);}
const tiles=[];save('ground.svg',g,[0,0,W,H],'Cherry Blossom Hill ground');
for(let r=0;r<4;r++)for(let c=0;c<6;c++){const x=c*Math.ceil(W/6),y=r*1350,w=Math.min(Math.ceil(W/6),W-x),h=Math.min(1350,H-y),src=`ground-r${r}-c${c}.svg`;save(src,g,[x,y,w,h],`Blossom ground tile ${r} ${c}`);tiles.push({src,x,y,width:w,height:h});}
const foot=T([192,822]),tip=[foot[0]-70,foot[1]+480];
const zones={plaza:{x:cx,y:cy+600,spawn:[cx,cy+600]},centre:{...centre,landmark:'blossom-centre-ancient-trunk',placeholder:false},gate:{x:gate.x,y:gate.y,spawn:[gate.x,gate.y-110]},pond:{x:pond.x,y:pond.y,spawn:[pond.x,bridgeY+37]}};
for(const z of [...activities,...stalls])zones[z.id]={...z};
const sleepAvoid=plazas.map(z=>({name:z.name,x:z.x,y:z.y,rx:z.rx+70,ry:z.ry+60}));sleepAvoid.push({name:'Gate approach',x:gate.x,y:gate.y-120,rx:370,ry:260});
const world={width:W,height:H,theme:'blossom',name:'Cherry Blossom Hill',coast,water,bridges,obstacles:[],islets,walkways,arches,zones,paths:paths.map(p=>p.line),pathWidths:paths.map(p=>p.w),sleepSpots:{},sleepAvoid,props:props.map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,zone:p.zone})),ambient:{birds:[T([340,160]),T([1000,170]),T([1330,480]),T([920,750]),T([380,760]),T([190,460])],butterflies:[T([580,380]),T([1120,540])]}};
const walk={width:W,height:H,coast:offset(coast,35),water,bridges,obstacles,islets,walkways,arches,paths:world.paths};
const harbor={jetty:{foot,tip,width:104},boats:[{x:tip[0]-150,y:tip[1]-90,turn:Math.PI},{x:tip[0]+155,y:tip[1]-130,turn:Math.PI},{x:tip[0]-155,y:tip[1]+230,turn:Math.PI}],spawn:zones.plaza.spawn};
const art={width:W,height:H,sea:C.sea,ground:{tiles},decks,flats,props:props.map(({solid,asset,...p})=>p),floating};
for(const [p,d]of [[D+'world.json',world],[D+'walk-world.json',walk],[D+'harbor.json',harbor],[D+'placements.json',props],[D+'paths.json',world.paths],[A+'art.json',art],[A+'arc-benches.json',benchRecords]])writeFileSync(p,JSON.stringify(d));
const metrics={theme:'blossom',width:W,height:H,coastArea:Math.round(area(coast)),homeRatio:f(area(coast)/11090000),trees:props.filter(p=>/tree/.test(p.asset||'')).length,props:props.length,flats:flats.length,arcBenches:benchRecords.length,activities:activities.length,stallZones:stalls.length,svgOnly:true};
writeFileSync(A+'blossom-metrics.json',JSON.stringify(metrics,null,2));console.log(metrics);
