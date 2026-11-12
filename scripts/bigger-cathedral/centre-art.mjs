import fs from 'node:fs';
import {oliveSVGBody} from './round2-olive.mjs';
import {polishCentre} from './centre-polish.mjs';
import {CATHEDRAL,TOWER,PIAZZA,RETIRED_CENTRE,isOldCentreSolid} from './centre-art-data.mjs';
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/';
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
let b=`<path data-contact-shadow="cathedral" d="M68 1089H1047L1065 1104L1045 1117H858V1177H235V1117H68Q44 1104 68 1089Z" fill="${ink}" opacity=".16"/>`;
b+=P('M908 515L1040 438V1038L908 1110Z',shade);
b+=P('M137 517H908V1108H137Z',stone);
b+=P('M126 520L280 375H880L1049 442L922 523Z',terra);
b+=P('M126 520L280 375H880L922 523Z',roofLight);
b+=roofTiles(280,375,880,375,922,523,126,520,12);
b+=P('M126 520H922L920 537H135Z',light);
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
b+=P('M58 759L182 669H368L405 759Z',roofLight)+roofTiles(182,669,368,669,405,759,58,759,6);
b+=P('M713 759L820 669H967L1060 746L946 789Z',terra)+P('M713 759L820 669H967L946 789Z',roofLight)+roofTiles(820,669,967,669,946,789,713,759,5);
b+=P('M72 772H382V1094H72Z',stone)+P('M947 786L1044 746V1042L947 1094Z',shade)+P('M728 786H947V1094H728Z',stone);
b+=P('M57 757H390V777H65Z',light)+P('M712 776L951 780L1059 741V759L952 801H718Z',light);
b+=P('M335 1082V604L549 464L763 604V1082Z',stone)+P('M763 604L799 566V1046L763 1082Z',shade);
b+=P('M317 601L549 448L785 600L776 617L548 472L329 617Z',light);
b+=P('M329 597L549 454L776 597','none',terra,12);
for(const [x,top]of [[95,795],[321,618],[751,618],[919,807]]){b+=P(`M${x} ${top}H${x+22}V1085H${x}Z`,light);b+=P(`M${x-7} ${top-10}H${x+29}V${top+8}H${x-7}Z`,light);b+=P(`M${x-6} 1071H${x+28}V1091H${x-6}Z`,light);}
for(const [x,y]of [[151,809],[202,809],[253,809],[800,821],[850,821]])b+=P(`M${x} ${y+18}q0 -28 25 -28q25 0 25 28`,'none',olive,3);
b+=E(548,668,85,85,light)+E(548,668,70,70,'#DDAE58',ink,2);
for(let i=0;i<8;i++){const a=i*Math.PI/4,cx=548+Math.cos(a)*40,cy=668+Math.sin(a)*40,tx=Math.cos(a),ty=Math.sin(a),nx=-ty,ny=tx;const q=(u,v)=>`${f(cx+tx*u+nx*v)} ${f(cy+ty*u+ny*v)}`;b+=P(`M${q(-23,0)}C${q(-12,-18)} ${q(27,-14)} ${q(28,0)}C${q(27,14)} ${q(-12,18)} ${q(-23,0)}Z`,olive,ink,2);}
b+=E(548,668,10,10,olive);
b+=door(548,835,152,239)+window(216,861,43,153)+window(838,873,43,141);
for(const x of [394,702])b+=window(x,700,27,91);
for(const [x,y,w]of [[145,973,45],[253,1004,43],[152,1045,29],[810,1006,53],[864,956,28],[374,813,35],[661,797,40],[368,1015,40],[674,1042,34]])b+=P(`M${x} ${y}h${w}m${-w/2} 0v-13`,'none','#B58D51',2);
b+=P('M348 1083H753L776 1101H324Z',light)+P('M324 1101H776V1113H324Z',shade);
b+=P('M308 1112H791L815 1132H285Z',light)+P('M285 1132H815V1144H285Z',shade);
b+=P('M266 1142H834L861 1163H239Z',light)+P('M239 1163H861V1174H239Z',stone);
b+=`<g data-roof-abutment="left">`+P('M30 752L58 739L151 754L120 830Z',roofLight)+P('M30 752L120 830V844L30 766Z',light)+P('M58 739L120 830','none','#8C492D',2)+'</g>';
write('detail/cathedral-r2.svg',1120,1180,'Bellovo cathedral, dome, roof planes and upright right return',b);
b=`<path data-contact-shadow="tower" d="M32 1132L262 1091L307 1140L77 1182L14 1165Z" fill="${ink}" opacity=".16"/>`;
b+=P('M64 202H239V1138H64Z',stone)+P('M239 202L298 163V1093L239 1138Z',shade);
for(const [y,h]of [[1066,18],[804,24],[530,26],[235,23]]){b+=P(`M52 ${y}H245L303 ${y-38}V${y+h-38}L245 ${y+h}H52Z`,light);b+=P(`M245 ${y}L303 ${y-38}V${y+h-38}L245 ${y+h}Z`,shade);}
b+=P('M45 207L164 80L306 163L244 214Z',terra)+P('M45 207L164 80L244 214Z',roofLight);
b+=P('M164 80L111 207 M164 80L184 210 M164 80L276 179','none',ink,2.5);
b+=P('M41 207H245L309 163V180L247 229H47Z',light)+E(164,67,9,12,'#E5B254');
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
const solids=[];
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
write('detail/central-olive-r2.svg',420,450,'Leafy olive, individual lanceolate leaves, trunk exactly at the mosaic centre',oliveSVGBody());
let well=E(95,201,83,8,ink,'none').replace('fill="'+ink+'"','fill="'+ink+'" opacity=".16"');
well+=P('M17 153Q95 184 173 153V181Q95 218 17 181Z',stone)+E(95,153,78,30,light)+E(95,151,57,18,'#526E44')+P('M17 153Q95 186 173 153M41 173V190M80 183V202M120 181V200M154 170V188','none',ink,3);
well+=P('M40 145V45Q95 1 150 45V145','none',ink,13)+P('M40 141V45Q95 8 150 45V141','none',olive,7)+P('M95 28V76','none',ink,4)+E(95,77,9,13,olive)+P('M76 109Q95 99 114 109L109 137Q95 146 81 137Z',olive)+E(95,109,19,7,'#A8AE55');
write('detail/wishing-well.svg',190,210,'Off-centre olive wishing well',well);
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(A+'art.json');
art.props=art.props.filter(p=>!RETIRED_CENTRE(p.id));
function building(id,name,src,c){return {id,name,src,...c,scale:1,anchor:{x:.5,y:1},rasterMargin:16,shadow:false,wind:false,flip:false};}
art.props.push(building('cathedral-hall','Cathedral hall','detail/cathedral-r2.svg',CATHEDRAL),building('campanile','Bell tower','detail/bell-tower.svg',TOWER));
delete art.flats.find(p=>p.src==='detail/piazza-mosaic.svg').rasterPool;
Object.assign(art.flats.find(p=>p.src==='detail/piazza-mosaic.svg'),{x:2710,y:1200,width:2780,height:2370,topLeft:true});
art.props=art.props.filter(p=>p.id!=='centre-wishing-well');
Object.assign(art.props.find(p=>p.id==='cloister-olive-well'),{name:'Central olive tree',src:'detail/central-olive-r2.svg',x:4100,y:2680,width:420,height:450,scale:1,anchor:{x:.5,y:440/450},trunk:[210,440],rasterPool:'ground',rasterDensity:1.05,rasterMargin:16,shadow:false,wind:false,contact:false});
art.props.push(building('centre-wishing-well','Wishing well','detail/wishing-well.svg',{x:3850,y:2750,width:190,height:210}));
solids.unshift({id:'centre-olive-trunk',x:4100,y:2673,rx:22,ry:15},{id:'centre-well-solid',x:3850,y:2733,rx:76,ry:34},{id:'centre-hall-solid',poly:[[3530,1650],[4435,1570],[4500,1735],[4500,1826],[4380,1832],[4380,1850],[3660,1850],[3660,1830],[3530,1830]]},{id:'centre-tower-solid',poly:[[4388,1722],[4579,1680],[4645,1718],[4645,1768],[4437,1814],[4388,1795]]});
for(const file of ['world.json','walk-world.json']){
 const w=read(D+file);w.obstacles=w.obstacles.filter(o=>!isOldCentreSolid(o));w.obstacles.push(...solids);
 if(file==='world.json')w.props=art.props;
 save(D+file,w);
}
save(A+'art.json',art);
save('scripts/bigger-cathedral/centre-art-metrics.json',{architectureProps:2,colonnadeBays:12,footprints:solids.length,portals:[],coveredWalkways:{left:[],right:[]},piazza:PIAZZA,keptWell:art.props.find(p=>p.id==='cloister-olive-well')});
polishCentre();
console.log(`CENTRE: 2 joined buildings, 12 straight arcade bays, 18 matching ground footprints. Olive and well preserved.`);
