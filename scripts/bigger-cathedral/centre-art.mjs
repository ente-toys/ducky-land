// Source of truth for package CENTRE. Run after the terrain/garden generators.
// Only centre architecture, its mosaic decals and matching physics entries change.
import fs from 'node:fs';
import {CATHEDRAL,TOWER,PIAZZA,LEFT,RIGHT,RETIRED_CENTRE,isOldCentreSolid} from './centre-art-data.mjs';
const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/';
const ink='#39472d',stone='#EBCB87',light='#FFF0C7',shade='#C59B59',terra='#BA542F',roofLight='#D9753D',olive='#70813B';
const f=n=>Math.round(n*100)/100;
const P=(d,fill='none',stroke=ink,w=3)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const E=(x,y,rx,ry,fill,stroke=ink,w=3)=>`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const poly=p=>'M'+p.map(q=>q.map(f).join(' ')).join('L')+'Z';
const svg=(w,h,title,b,box=`0 0 ${w} ${h}`)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box}" fill="none" stroke-linecap="round" stroke-linejoin="round"><title>${title}</title>${b}</svg>\n`;
function write(file,w,h,title,b,box){fs.writeFileSync(A+file,svg(w,h,title,b,box));}
function window(x,y,w=37,h=80){return P(`M${x-w/2} ${y+h}V${y+w/2}a${w/2} ${w/2} 0 0 1 ${w} 0V${y+h}Z`,olive)+P(`M${x-w/2+7} ${y+h-7}V${y+w/2}q${w/2-7} ${-w+14} ${w-14} 0v${h-w/2-7}Z`,'#39472d','none');}
function door(x,y,w,h){let b=P(`M${x-w/2-14} ${y+h}V${y+w/2}a${w/2+14} ${w/2+14} 0 0 1 ${w+28} 0V${y+h}Z`,light);b+=P(`M${x-w/2} ${y+h}V${y+w/2}a${w/2} ${w/2} 0 0 1 ${w} 0V${y+h}Z`,olive);b+=P(`M${x} ${y+7}V${y+h} M${x-w/2+14} ${y+h-15}V${y+w/2+8}H${x-14}V${y+h-15}Z M${x+14} ${y+h-15}V${y+w/2+8}H${x+w/2-14}V${y+h-15}Z`,'none','#4F602F',3);b+=E(x-12,y+h*.67,4,5,'#E8B95C')+E(x+12,y+h*.67,4,5,'#E8B95C');return b;}
function roofTiles(x0,y0,x1,y1,x2,y2,x3,y3,n=9){let s='';for(let i=1;i<n;i++){let t=i/n;s+=P(`M${f(x0+(x1-x0)*t)} ${f(y0+(y1-y0)*t)}L${f(x3+(x2-x3)*t)} ${f(y3+(y2-y3)*t)}`,'none','#8C492D',2);}return s;}
// Cathedral: broad roof surfaces precede a front gable; a narrow right return
// and drum ellipses make its depth explicit without leaning any upright wall.
let b=`<path data-contact-shadow="cathedral" d="M68 1089H1047L1065 1104L1045 1117H858V1177H235V1117H68Q44 1104 68 1089Z" fill="${ink}" opacity=".16"/>`;
b+=P('M908 515L1040 438V1038L908 1110Z',shade);
b+=P('M137 517H908V1108H137Z',stone);
b+=P('M126 520L280 375H880L1049 442L922 523Z',terra);
b+=P('M126 520L280 375H880L922 523Z',roofLight);
b+=roofTiles(280,375,880,375,922,523,126,520,12);
b+=P('M126 520H922L920 537H135Z',light);
// Drum and dome. Its far rim and long curved ribs describe a roof, not a flat fan.
b+=P('M328 327V453C328 510 768 510 768 453V327Z',stone);
b+=P('M675 329V485Q741 477 768 453V327Z',shade,'none');
b+=E(548,327,220,52,light);
b+=P('M326 327C336 164 416 85 548 77C680 85 760 164 770 327Q548 416 326 327Z',terra);
b+=P('M326 327C336 164 416 85 548 77C493 121 449 203 440 350Q380 345 326 327Z',roofLight,'none');
for(const d of ['M548 78C481 137 453 223 440 350','M548 78C523 145 517 255 520 360','M548 78C583 142 601 255 600 359','M548 78C654 145 691 229 700 347'])b+=P(d,'none',ink,2.5);
b+=P('M325 324Q548 409 771 324L769 341Q548 425 327 341Z',light);
for(const [x,y]of [[354,365],[415,389],[483,401],[553,405],[623,400],[692,386],[744,363]])b+=window(x,y,22,53);
b+=P('M520 79V48Q548 25 576 48V79Q548 92 520 79Z',light)+E(548,48,30,10,light);
for(const x of [530,547,564])b+=P(`M${x} 76V54`,'none',olive,5);
b+=P('M515 46Q548 14 581 46Z','#E5B254')+E(548,14,9,11,'#E5B254');
// Side chapel tops are broad planes, with their wall returns below.
b+=P('M58 759L182 669H368L405 759Z',roofLight)+roofTiles(182,669,368,669,405,759,58,759,6);
b+=P('M713 759L820 669H967L1060 746L946 789Z',terra)+P('M713 759L820 669H967L946 789Z',roofLight)+roofTiles(820,669,967,669,946,789,713,759,5);
b+=P('M72 772H382V1094H72Z',stone)+P('M947 786L1044 746V1042L947 1094Z',shade)+P('M728 786H947V1094H728Z',stone);
b+=P('M57 757H390V777H65Z',light)+P('M712 776L951 780L1059 741V759L952 801H718Z',light);
// Central gable and facade. The right face is a thin, separate plane.
b+=P('M335 1082V604L549 464L763 604V1082Z',stone)+P('M763 604L799 566V1046L763 1082Z',shade);
b+=P('M317 601L549 448L785 600L776 617L548 472L329 617Z',light);
b+=P('M329 597L549 454L776 597','none',terra,12);
// Four narrow pilasters, stone capitals and olive frieze.
for(const [x,top]of [[95,795],[321,618],[751,618],[919,807]]){b+=P(`M${x} ${top}H${x+22}V1085H${x}Z`,light);b+=P(`M${x-7} ${top-10}H${x+29}V${top+8}H${x-7}Z`,light);b+=P(`M${x-6} 1071H${x+28}V1091H${x-6}Z`,light);}
for(const [x,y]of [[151,809],[202,809],[253,809],[800,821],[850,821]])b+=P(`M${x} ${y+18}q0 -28 25 -28q25 0 25 28`,'none',olive,3);
// Rose window: a strong ink circle and eight individual olive glass petals.
b+=E(548,668,85,85,light)+E(548,668,70,70,'#DDAE58',ink,2);
for(let i=0;i<8;i++){const a=i*Math.PI/4,cx=548+Math.cos(a)*40,cy=668+Math.sin(a)*40,tx=Math.cos(a),ty=Math.sin(a),nx=-ty,ny=tx;const q=(u,v)=>`${f(cx+tx*u+nx*v)} ${f(cy+ty*u+ny*v)}`;b+=P(`M${q(-23,0)}C${q(-12,-18)} ${q(27,-14)} ${q(28,0)}C${q(27,14)} ${q(-12,18)} ${q(-23,0)}Z`,olive,ink,2);}
b+=E(548,668,10,10,olive);
b+=door(548,835,152,239)+window(216,861,43,153)+window(838,873,43,141);
for(const x of [394,702])b+=window(x,700,27,91);
// Sparing masonry, every mark on its own wall plane.
for(const [x,y,w]of [[145,973,45],[253,1004,43],[152,1045,29],[810,1006,53],[864,956,28],[374,813,35],[661,797,40],[368,1015,40],[674,1042,34]])b+=P(`M${x} ${y}h${w}m${-w/2} 0v-13`,'none','#B58D51',2);
// Broad shallow stairs share the piazza's plane and remain walkable.
b+=P('M348 1083H753L776 1101H324Z',light)+P('M324 1101H776V1113H324Z',shade);
b+=P('M308 1112H791L815 1132H285Z',light)+P('M285 1132H815V1144H285Z',shade);
b+=P('M266 1142H834L861 1163H239Z',light)+P('M239 1163H861V1174H239Z',stone);
write('detail/cathedral.svg',1120,1180,'Bellovo cathedral, dome, roof planes and upright right return',b);
// Bell tower fits against the cathedral's north-east corner, rather than a stick
// beyond the forecourt. Its side and roof are drawn, never transformed.
b=`<path data-contact-shadow="tower" d="M32 1132L262 1091L307 1140L77 1182L14 1165Z" fill="${ink}" opacity=".16"/>`;
b+=P('M64 202H239V1138H64Z',stone)+P('M239 202L298 163V1093L239 1138Z',shade);
for(const [y,h]of [[1066,18],[804,24],[530,26],[235,23]]){b+=P(`M52 ${y}H245L303 ${y-38}V${y+h-38}L245 ${y+h}H52Z`,light);b+=P(`M245 ${y}L303 ${y-38}V${y+h-38}L245 ${y+h}Z`,shade);}
b+=P('M45 207L164 80L306 163L244 214Z',terra)+P('M45 207L164 80L244 214Z',roofLight);
b+=P('M164 80L111 207 M164 80L184 210 M164 80L276 179','none',ink,2.5);
b+=P('M41 207H245L309 163V180L247 229H47Z',light)+E(164,67,9,12,'#E5B254');
// Open bell bay: the far sky-coloured opening is negative space, not a panel.
b+=P('M88 510V357Q151 258 215 357V510Z',olive);
b+=P('M99 505V360Q151 279 204 360V505Z','#39472d','none');
b+=P('M98 365Q151 285 205 365','none',light,12);
b+=P('M101 379H202 M151 325V405','none','#946E37',9);
b+=P('M137 406Q151 392 165 406L177 448Q180 463 190 467H112Q124 459 125 448Z','#E7AD49')+E(151,468,39,10,'#F3CC70')+E(151,478,7,9,'#BA793B');
b+=window(151,655,34,104)+window(151,923,34,101);
b+=P('M268 639v99l15 -10v-99q-8 -20 -15 10Z',olive)+P('M268 910v99l15 -10v-99q-8 -20 -15 10Z',olive);
for(const [x,y]of [[76,612],[190,763],[85,871],[185,1040]])b+=P(`M${x} ${y}h28m-14 0v-13`,'none','#B58D51',2);
b+=P('M48 1122H247L299 1089V1110L250 1152H48Z',light)+P('M33 1151H250L310 1109V1129L252 1172H33Z',stone);
write('detail/bell-tower.svg',320,1190,'Bellovo campanile, attached corner with visible roof and right return',b);
const generated=[],solids=[],portals=[];
function prop(id,src,x0,y0,w,h,sortY){return {id,name:id.includes('colonnade')?'Curved open colonnade':'Centre architecture',src,x:x0+w/2,y:sortY,width:w,height:h,scale:1,anchor:{x:.5,y:(sortY-y0)/h},sortY,contact:false,shadow:false,wind:false,flip:false};}
function pier(x,y){let s=P(`M${x-14} ${y-189}H${x+14}V${y-12}H${x-14}Z`,stone);s+=P(`M${x+7} ${y-188}H${x+14}V${y-12}H${x+7}Z`,shade,'none');s+=P(`M${x-20} ${y-202}H${x+20}V${y-184}H${x-20}Z`,light);s+=P(`M${x-22} ${y-16}L${x+13} ${y-25}L${x+24} ${y-13}V${y+2}L${x-12} ${y+12}L${x-22} ${y+5}Z`,light);s+=P(`M${x-22} ${y+5}L${x-12} ${y+12}L${x+24} ${y+2}V${y-10}L${x-12} ${y-1}L${x-22} ${y-8}Z`,shade,'none');return s;}
// Smooth C1 curves share the same tangent at adjacent bay endpoints. All roofs
// are drawn in world coordinates so curves meet without independently rotated art.
function tangent(pts,i){let a=pts[Math.max(0,i-1)],c=pts[Math.min(pts.length-1,i+1)];return [(c[0]-a[0])/2,(c[1]-a[1])/2];}
const curve=(a,c,t0,t1,dy=0)=>`M${f(a[0])} ${f(a[1]+dy)}C${f(a[0]+t0[0]/3)} ${f(a[1]+dy+t0[1]/3)} ${f(c[0]-t1[0]/3)} ${f(c[1]+dy-t1[1]/3)} ${f(c[0])} ${f(c[1]+dy)}`;
for(const [side,pts]of [['left',LEFT],['right',RIGHT]]){
 const outward=side==='left'?-1:1;
 for(let i=0;i<pts.length-1;i++){
  let a=pts[i],c=pts[i+1],t0=tangent(pts,i),t1=tangent(pts,i+1),dx=c[0]-a[0],dy=c[1]-a[1];
  const depth=[outward*90,-64],back=q=>[q[0]+depth[0],q[1]+depth[1]],ar=back(a),cr=back(c),H=265;
  // One joined contact shadow per bay. It hugs the actual pier strip.
  let feet=[a,ar,...(i===pts.length-2?[c,cr]:[])];
  let s=`<path data-contact-shadow="colonnade" d="${feet.map(([x,y])=>`M${x-25} ${y+3}a25 9 0 1 0 50 0a25 9 0 1 0 -50 0`).join(' ')}" fill="${ink}" opacity=".16"/>`;
  // Far row of piers, visible through the unfilled arch openings.
  s+=pier(...ar);if(i===pts.length-2)s+=pier(...cr);
  const arc=curve(a,c,t0,t1,-H),end=[c[0],c[1]-H];
  // Arch spandrel stops at the curved intrados. No opaque wall behind the hole.
  s+=P(`${arc}L${c[0]} ${c[1]-190}C${f(c[0]-dx*.12)} ${f(c[1]-250-dy*.12)} ${f(a[0]+dx*.12)} ${f(a[1]-250+dy*.12)} ${a[0]} ${a[1]-190}Z`,stone);
  s+=P(`M${a[0]} ${a[1]-190}C${f(a[0]+dx*.12)} ${f(a[1]-250+dy*.12)} ${f(c[0]-dx*.12)} ${f(c[1]-250-dy*.12)} ${c[0]} ${c[1]-190}`,'none',light,12);
  s+=P(`M${a[0]} ${a[1]-190}C${f(a[0]+dx*.12)} ${f(a[1]-250+dy*.12)} ${f(c[0]-dx*.12)} ${f(c[1]-250-dy*.12)} ${c[0]} ${c[1]-190}`,'none',ink,2.5);
  // Curved terracotta roof top and pale eave. Shared endpoints avoid tile cracks.
  const backCurve=curve(cr,ar,[-t1[0],-t1[1]],[-t0[0],-t0[1]],-H-14).replace(/^M[^C]+/,'');
  s+=P(`${arc}L${cr[0]} ${cr[1]-H-14}${backCurve}Z`,roofLight);
  s+=P(`${arc}L${c[0]} ${c[1]-H+14}${curve(c,a,[-t1[0],-t1[1]],[-t0[0],-t0[1]],-H+14).replace(/^M[^C]+/,'')}Z`,light);
  const bez=t=>{let u=1-t;return [u*u*u*a[0]+3*u*u*t*(a[0]+t0[0]/3)+3*u*t*t*(c[0]-t1[0]/3)+t*t*t*c[0],u*u*u*a[1]+3*u*u*t*(a[1]+t0[1]/3)+3*u*t*t*(c[1]-t1[1]/3)+t*t*t*c[1]];};
  for(const t of [.22,.47,.72]){let q=bez(t);s+=P(`M${f(q[0])} ${f(q[1]-H)}L${f(q[0]+depth[0])} ${f(q[1]+depth[1]-H-14)}`,'none','#8C492D',2);}
  s+=pier(...a);if(i===pts.length-2)s+=pier(...c);
  const all=[a,c,ar,cr],x0=Math.floor(Math.min(...all.map(p=>p[0])))-28,y0=Math.floor(Math.min(...all.map(p=>p[1])))-H-19,w=Math.ceil(Math.max(...all.map(p=>p[0])))-x0+28,h=Math.ceil(Math.max(...all.map(p=>p[1])))-y0+16;
  const file=`centre/colonnade-${side}-${i+1}.svg`,id=`centre-colonnade-${side}-${i+1}`;
  write(file,w,h,`Bellovo curved ${side} colonnade bay ${i+1}, open arch, upright piers and roof top`,s,`${x0} ${y0} ${w} ${h}`);
  generated.push(prop(id,file,x0,y0,w,h,Math.max(a[1],c[1])+4));
  // Ground plan and art share the exact feet, including the far row.
  for(const [j,q]of [[i,a],[i+'-rear',ar],...(i===pts.length-2?[[i+1,c],[i+1+'-rear',cr]]:[])])solids.push({id:`centre-pier-${side}-${j}`,x:q[0],y:q[1]-5,rx:22,ry:16});
  portals.push({side,bay:i+1,front:[f((a[0]+c[0])/2),f((a[1]+c[1])/2)],rear:[f((ar[0]+cr[0])/2),f((ar[1]+cr[1])/2)]});
 }
}
// A single flush round piazza. The rose inlay remains centred on the saved well.
// The sole path painter retires the rear court. Draw only the actual piazza.
// This is the centre decal only; the terrain/path package stays untouched.
let m=E(4100,2500,1375,1053,'#F7DC88','none');
for(const [rx,ry]of [[1363,1041],[1110,855],[870,670]])m+=E(4100,2500,rx,ry,'none','#BA985E',2);
for(let i=0;i<48;i++){
 const t=i*Math.PI/24,u=(i+1)*Math.PI/24,p=(rx,ry,a)=>[4100+rx*Math.cos(a),2500+ry*Math.sin(a)];
 m+=P(poly([p(1110,855,t),p(1363,1041,t),p(1363,1041,u),p(1110,855,u)]),i%2?'#F9E4A6':'#E9CC83','#BA985E',1.6);
 m+=P(`M${p(870,670,t).map(f).join(' ')}L${p(1110,855,t).map(f).join(' ')}`,'none','#BA985E',1.6);
}
write('detail/piazza-mosaic.svg',2780,2370,'Bellovo one flush round piazza, warm stone radial mosaic',m,'2710 1200 2780 2370');
let rose='';
for(const [r,w]of [[208,14],[455,18],[592,26]]){rose+=E(4100,2680,r,r*.766,'none',terra,w);rose+=E(4100,2680,r+w/2+4,(r+w/2+4)*.766,'none','#AA8C54',2);}
for(let i=0;i<16;i++){let a=i*Math.PI/8,p=(r,ang)=>[4100+r*Math.cos(ang),2680+r*.766*Math.sin(ang)];rose+=P(poly([p(235,a),p(360,a-.09),p(429,a),p(360,a+.09)]),i%2?terra:olive,'#9B824F',2);}
for(let i=0;i<80;i++){let a=i*Math.PI/40,p=(r,ang)=>[4100+r*Math.cos(ang),2680+r*.766*Math.sin(ang)];rose+=P(poly([p(480,a+.006),p(575,a+.006),p(575,a+.07),p(480,a+.07)]),i%2?'#E3BC70':light,'#AD8B51',1.3);}
write('detail/rose-inlay.svg',1300,1040,'Bellovo crisp terracotta and olive rose mosaic, flush stone',rose,'3450 2160 1300 1040');
// An old combined trace could not move its well independently. These upright
// pieces match the approved concept with one tight contact shadow apiece.
let tree=E(210,440,57,10,ink,'none').replace('fill="'+ink+'"','fill="'+ink+'" opacity=".16"');
tree+=P('M184 437Q199 406 195 367Q167 336 176 297L156 252L170 242L203 285L207 229L224 224L224 288L258 247L272 255L238 306Q225 346 229 372Q228 412 246 440L220 435L210 418L201 437Z','#9C7544');
tree+=P('M208 408Q218 373 208 348Q195 322 209 299M219 332L240 297','none','#6E5735',3);
const crowns=[[126,228,78,55],[274,225,83,55],[205,174,96,63],[98,171,69,53],[312,171,67,55],[154,109,76,58],[249,105,72,60],[206,66,55,49]];
for(const [i,[x,y,rx,ry]]of crowns.entries())tree+=E(x,y,rx,ry,i%3===0?'#859841':i%3===1?'#697E37':'#A6AB46');
for(const [x,y]of [[99,171],[139,109],[184,67],[237,95],[290,158],[152,199],[244,208]])tree+=P(`M${x-22} ${y+5}Q${x} ${y-24} ${x+29} ${y-5}M${x} ${y+4}L${x+18} ${y-7}`,'none','#435B30',3);
write('detail/central-olive.svg',420,450,'Olive trunk exactly at the mosaic centre',tree);
let well=E(95,201,83,8,ink,'none').replace('fill="'+ink+'"','fill="'+ink+'" opacity=".16"');
well+=P('M17 153Q95 184 173 153V181Q95 218 17 181Z',stone)+E(95,153,78,30,light)+E(95,151,57,18,'#526E44')+P('M17 153Q95 186 173 153M41 173V190M80 183V202M120 181V200M154 170V188','none',ink,3);
well+=P('M40 145V45Q95 1 150 45V145','none',ink,13)+P('M40 141V45Q95 8 150 45V141','none',olive,7)+P('M95 28V76','none',ink,4)+E(95,77,9,13,olive)+P('M76 109Q95 99 114 109L109 137Q95 146 81 137Z',olive)+E(95,109,19,7,'#A8AE55');
write('detail/wishing-well.svg',190,210,'Off-centre olive wishing well',well);
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(A+'art.json');
art.props=art.props.filter(p=>!RETIRED_CENTRE(p.id));
function building(id,name,src,c){return {id,name,src,...c,scale:1,anchor:{x:.5,y:1},shadow:false,wind:false,flip:false};}
art.props.push(building('cathedral-hall','Cathedral hall','detail/cathedral.svg',CATHEDRAL),building('campanile','Bell tower','detail/bell-tower.svg',TOWER),...generated);
delete art.flats.find(p=>p.src==='detail/piazza-mosaic.svg').rasterPool;
Object.assign(art.flats.find(p=>p.src==='detail/piazza-mosaic.svg'),{x:2710,y:1200,width:2780,height:2370,topLeft:true});
// Boss-approved focal correction: the trunk sits exactly on the rose centre.
// Keep separate objects so the off-centre well and tree sort independently.
art.props=art.props.filter(p=>p.id!=='centre-wishing-well');
Object.assign(art.props.find(p=>p.id==='cloister-olive-well'),{name:'Central olive tree',src:'detail/central-olive.svg',x:4100,y:2680,width:420,height:450,scale:1,anchor:{x:.5,y:440/450},trunk:[210,440],rasterDensity:1.05,rasterMargin:16,shadow:false,wind:false,contact:false});
art.props.push(building('centre-wishing-well','Wishing well','detail/wishing-well.svg',{x:3850,y:2750,width:190,height:210}));
// New solid footprints use the drawn floor line, not an oval across empty arches.
solids.unshift({id:'centre-olive-trunk',x:4100,y:2673,rx:22,ry:15},{id:'centre-well-solid',x:3850,y:2733,rx:76,ry:34},{id:'centre-hall-solid',poly:[[3530,1650],[4435,1570],[4500,1735],[4500,1826],[4380,1832],[4380,1850],[3660,1850],[3660,1830],[3530,1830]]},{id:'centre-tower-solid',poly:[[4388,1722],[4579,1680],[4645,1718],[4645,1768],[4437,1814],[4388,1795]]});
for(const file of ['world.json','walk-world.json']){
 const w=read(D+file);w.obstacles=w.obstacles.filter(o=>!isOldCentreSolid(o));w.obstacles.push(...solids);
 if(file==='world.json')w.props=art.props;
 save(D+file,w);
}
save(A+'art.json',art);
save('scripts/bigger-cathedral/centre-art-metrics.json',{architectureProps:2,colonnadeBays:generated.length,footprints:solids.length,portals,coveredWalkways:{left:LEFT.slice(1).map(([x,y])=>[x-45,y-32]),right:RIGHT.slice(1).map(([x,y])=>[x+45,y-32])},piazza:PIAZZA,keptWell:art.props.find(p=>p.id==='cloister-olive-well')});
console.log(`CENTRE: 2 joined buildings, ${generated.length} open curved bays, ${solids.length} ground footprints. Olive well preserved.`);
