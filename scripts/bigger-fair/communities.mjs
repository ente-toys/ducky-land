import fs from 'node:fs';
import sharp from 'sharp';
import {buildTiles,original,bounds,coast,smooth,read,write} from './design.mjs';
import {render} from './render-core.mjs';
import {inner,outer,streams,crossings,pathD} from './fix-geometry.mjs';
import {fitContact} from './furniture.mjs';
const A='public/pixi-art/themes/fair/',S='scripts/bigger-fair/';
const O='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger/';
const ink='#A88A46',cream='#FFF0AE',pink='#F6A9B6',blue='#89CEDD',mint='#A6E3DE',yellow='#FFE078';
const el=(x,y,rx,ry,c,more='')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" ${more}/>`;
const r=(x,y,w,h,c,rad=7)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" fill="${c}"/>`;
const p=(d,c='none',more='')=>`<path d="${d}" fill="${c}" ${more}/>`;
const svg=(w,h,s)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-linecap="round" stroke-linejoin="round"><g stroke="${ink}" stroke-width="3.5">${s}</g></svg>`;
function asset(name,w,h,s){fs.writeFileSync(A+'bigger/'+name+'.svg',svg(w,h,s).replace(`stroke="${ink}"`,/^(tea-table|flour-crates)$/.test(name)?'stroke="#39472d"':`stroke="${ink}"`));}
function window(x,y,c=mint){return r(x,y,57,65,cream,15)+r(x+7,y+7,43,49,c,11)+p(`M${x+29} ${y+7}v48 M${x+7} ${y+32}h43`)+p(`M${x-6} ${y+70}h70`,'none','stroke-width="7"')+r(x-5,y+72,68,21,pink,4)+p(`M${x+2} ${y+75}l8 -14 9 13 13 -19 10 18 12 -15 8 17`,'#8FBA48');}
function door(x,y){return p(`M${x} ${y+85}v-62q32 -42 64 0v62Z`,'#D4A46C')+p(`M${x+8} ${y+80}v-58q24 -27 48 0v58Z`,cream)+el(x+46,y+48,4,4,ink)+p(`M${x-14} ${y+88}h92l14 19h-120Z`,'#E5C383');}
function house(kind,roof){let s=el(220,417,192,31,'#B8CC6D')+p('M55 215L55 373Q220 431 385 373V215Z',cream)+p('M55 216V373L85 384V217Z','#E4C782');
 if(kind==='costume'){
 s+=p('M24 230L220 63L415 230Q377 258 345 232Q315 257 283 232Q250 258 220 232Q188 257 155 232Q122 256 90 232Q56 258 24 230Z',roof)+p('M24 230L220 63L90 232Z',cream)+p('M155 232L220 63L220 232Z',cream)+p('M283 232L220 63L345 232Z',cream)+r(193,26,54,45,pink)+el(220,28,37,10,yellow)+el(220,73,37,10,yellow)+p('M203 37h33M203 46h33M203 55h33')+door(188,298)+window(96,274)+window(285,274)+p('M159 132Q220 160 282 132')+el(220,155,16,16,yellow)+p('M217 145v20M211 154h18');
 }else if(kind==='caravan'){
 s=p('M55 177Q220 61 385 177V340Q220 384 55 340Z',cream)+p('M29 185Q35 53 220 48Q405 53 411 185Q220 116 29 185Z',roof)+p('M55 177Q220 110 385 177','none','stroke="#FFF5CA" stroke-width="10"')+window(89,208)+window(294,208)+door(188,235)+r(135,341,172,24,'#D6AE70')+p('M148 362v35M291 362v35','none','stroke-width="10"')+r(160,375,120,20,cream)+r(146,396,148,20,'#E4C782');
 for(const x of [92,350])s+=el(x,358,34,35,'#D5A66B')+el(x,358,24,25,cream)+p(`M${x-23} 358h46M${x} 334v48M${x-17} 341l34 34M${x+17} 341l-34 34`)+el(x,358,6,6,ink);
 s+=p('M220 50V15L273 28L220 42Z',pink);
 }else if(kind==='performer'){
 s=p('M67 185L48 378Q220 423 391 378L373 185Z',cream)+p('M67 185L125 185L116 394L48 378Z',roof)+p('M314 185L373 185L391 378L325 393Z',roof)+p('M17 208L220 38L423 208Q390 243 355 211Q321 245 287 212Q252 246 220 212Q187 246 153 212Q118 245 85 211Q50 243 17 208Z',roof)+p('M17 208L220 38L85 211Z',cream)+p('M153 212L220 38L287 212Z',yellow)+p('M355 211L220 38L423 208Z',cream)+p('M220 40V5L284 19L220 33Z',blue)+door(188,295)+window(93,270)+window(292,270)+p('M145 246Q220 285 300 246')+el(220,270,18,16,yellow)+p('M212 270h16M220 262v16');
 }else{
 s+=p('M29 222L220 58L411 222Z',roof)+p('M46 214L220 77L394 214Q377 241 355 219Q333 246 310 223Q287 250 264 226Q241 253 220 229Q197 253 174 226Q151 250 128 223Q105 246 83 219Q62 241 46 214Z',cream)+r(316,76,43,84,'#DEAC7B')+r(307,72,61,18,cream)+door(188,295)+window(92,272)+window(288,272)+el(220,168,34,29,yellow)+p('M197 173q23 -39 46 0M207 163l5 13M225 156l5 16')+r(118,242,205,25,pink,10);
 }
 s+=r(28,349,32,65,pink,3)+r(16,340,57,24,cream,5)+el(44,352,9,5,blue)+p('M39 340v-30l28 9-28 7',blue)+r(348,385,55,23,'#D4A46C')+p('M357 385l-7 -29 24 15 17 -27 4 40','#83B54A')+el(366,363,8,8,pink)+el(389,354,8,8,yellow);
 return s;
}
function makeAssets(){
 asset('shared-well',220,230,p('M35 175V100Q110 60 185 100V175Q110 215 35 175Z','#D8C992')+el(110,100,75,30,cream)+el(110,100,50,18,blue)+p('M50 140h120M88 126v28M140 145v37M48 106V40M174 106V40','none','stroke-width="6"')+p('M18 48L110 5L202 48Z',pink)+p('M110 48V93')+r(93,84,34,32,'#D4AB71')+p('M91 85q19 -21 38 0'));
 asset('garden-cart',300,210,p('M40 90L245 65L265 139L60 166Z','#D6AC70')+p('M65 108l175 -21M75 135l171 -21M63 91l-31 -53M245 65l22 -25','none','stroke-width="6"')+el(89,170,27,27,cream)+el(235,152,27,27,cream)+el(89,170,8,8,ink)+el(235,152,8,8,ink)+p('M95 95l-22 -46 31 14 9 -35 10 58Z','#82AF45')+el(163,73,25,21,yellow)+el(205,66,28,24,pink));
 for(const [name,kind,c]of [['bobbin-cottage','costume',pink],['balloon-caravan','caravan',blue],['parade-home','performer',pink],['sugar-cottage','baker',pink]])asset(name,440,455,house(kind,c));
 let fence='';for(const x of [15,68,121,174,227,280,333,386])fence+=p(`M${x} 95V25l9 -13 9 13v70Z`,cream);fence+=p('M16 47H403M16 77H403','none','stroke="#D7AB6C" stroke-width="9"');asset('garden-fence',420,110,fence);
 asset('washing-line',430,185,p('M15 178V12M415 178V12','none','stroke-width="8"')+p('M15 28Q210 88 415 28')+p('M88 46l-20 28 20 18 12 -13v65h65V81l13 12 20 -21-24 -20-17 17h-42l-10 -18Z',pink)+p('M257 65l-14 69q35 25 69 0l-13 -69Z',blue)+p('M340 49l-10 80h42l-6 -84Z',yellow)+p('M96 47l5 14M165 57l-3 13M265 64l-1 12M294 63l1 12'));
 asset('sewing-table',390,260,el(195,154,177,64,'#D6AE70')+el(195,139,177,59,cream)+p('M50 161v84M339 161v84','none','stroke-width="11"')+p('M185 141V72q0 -23 24 -23h48v37h-45v57Z',blue)+r(165,133,117,12,ink)+p('M255 89v43')+el(235,73,12,12,yellow)+p('M58 124l59 -20 43 29-69 23Z',pink)+r(74,64,42,46,blue)+el(95,65,29,9,cream)+el(95,111,29,9,cream)+p('M119 126l21 -27M123 100l21 26')+el(120,128,7,7,cream)+el(143,128,7,7,cream));
 asset('balloon-workbench',440,400,r(45,286,350,30,'#D6AE70')+p('M65 316v70M375 316v70','none','stroke-width="13"')+el(125,292,51,23,cream)+p('M85 278l11 -54h61l11 54Z',pink)+p('M126 228V165M280 270V125M337 266V166')+el(126,109,57,70,yellow)+el(280,76,54,64,pink)+el(337,118,53,64,blue)+p('M110 179l16 -15 14 15Z',yellow)+p('M267 143l13 -12 14 12Z',pink)+r(190,239,55,48,mint)+el(217,239,27,10,cream)+p('M199 251h35M199 261h35M199 271h35')+r(307,247,43,38,'#DBB27C'));
 asset('prop-rack',520,340,p('M30 307V32H489V307','none','stroke-width="12"')+p('M29 49Q260 97 491 49')+p('M86 65l-13 129 88 20-5 -139Z',pink)+p('M220 80l-40 82 66 39 44 -99Z',blue)+p('M370 73l-31 108 81 8-19 -123Z',yellow)+el(89,244,57,23,cream)+el(115,216,34,39,pink)+p('M62 221h105',cream)+r(193,229,108,77,'#D7AA72')+r(207,246,80,17,cream)+p('M207 275h80')+el(394,280,56,31,blue)+p('M347 280l47 -91 48 91Z',pink)+el(394,189,12,12,yellow));
 asset('bread-oven',450,390,el(225,349,199,31,cream)+p('M52 323V194Q52 48 225 45Q398 48 398 194V323Z','#E5BE86')+p('M55 196Q225 127 395 196 M78 130Q225 79 373 130M100 278h250 M130 174v-63M300 172v-63 M225 86v58 M111 206v58 M337 205v58')+p('M143 325V249Q225 159 307 249V325Z','#A8804C')+p('M162 323V254Q225 189 288 254V323Z','#D8A35D')+p('M175 306l28 -27 18 25 26 -33 28 35Z',yellow)+r(20,315,410,30,'#D3A168')+el(80,313,35,15,cream)+el(365,313,36,15,yellow)+p('M63 310l10 -9M78 312l10 -9M351 311l9 -9M366 313l10 -9'));
 asset('bread-cart',350,290,r(30,121,290,98,cream)+p('M20 122L69 35H283L334 122Q307 147 283 125Q255 149 229 126Q202 151 175 126Q149 150 122 125Q96 148 70 124Q44 148 20 122Z',pink)+p('M69 35H111L70 124L20 122Z',cream)+p('M152 35H195L175 126L122 125Z',cream)+p('M235 35H283L334 122L283 125Z',cream)+r(40,172,270,20,'#DBAF77')+el(89,175,34,15,yellow)+el(175,175,32,14,cream)+el(260,175,35,15,yellow)+p('M72 173l12 -10M87 175l12 -10M244 173l12 -10M260 175l12 -10')+el(79,239,25,25,'#D3A168')+el(271,239,25,25,'#D3A168')+el(79,239,10,10,cream)+el(271,239,10,10,cream));
 asset('flour-crates',280,210,r(25,98,106,78,'#D4A16B')+p('M25 109h106M25 158h106M45 110v47M110 110v47')+p('M150 178l-7 -108q43 -37 87 0l-7 108Z',cream)+p('M158 69q29 20 62 0')+el(186,124,18,24,yellow)+p('M186 98v51M174 114l12 9 12 -10')+r(34,48,85,48,pink)+p('M47 59h59M47 73h59'));
 asset('neighbour-sign',240,290,p('M114 282V87','none','stroke-width="17"')+p('M15 39Q120 0 225 39V127Q120 155 15 127Z',cream)+p('M35 49Q120 21 205 49V112Q120 134 35 112Z',pink)+el(120,82,31,29,yellow)+p('M102 85q18 -25 36 0')+p('M72 175H192L215 200L192 224H72Z',blue)+p('M93 190h90M93 205h57'));
}
export const places=[
 {id:'bobbinbell',name:'Bobbinbell Green',x:-800,y:1550,point:[-750,1740],floor:[320,215],kind:'garden',people:'Costume makers and ribbon stitchers',homes:5,work:'Open sewing yard, ribbon market and washing green'},
 {id:'cloudpop',name:'Cloudpop Mews',x:4100,y:-430,point:[3950,-240],floor:[380,180],kind:'garden',people:'Balloon riggers and wish couriers',homes:6,work:'Balloon repair benches, tether garden and ticket dispatch'},
 {id:'waddleshow',name:'Waddleshow Yard',x:8030,y:3110,point:[7860,3250],floor:[340,240],kind:'paved',people:'Parade puppeteers, musicians and float builders',homes:5,work:'Goose-float workshop, prop yard and rehearsal stage'},
 {id:'sugarspoon',name:'Sugarspoon Harbour',x:2450,y:5150,point:[2420,5330],floor:[420,200],kind:'paved',people:'Bakers and harbour delivery families',homes:6,work:'Communal bread oven, morning market, flour store and delivery jetty'}
];
const lane=(pts,w=125,widths)=>({line:smooth(pts,false,9),w,widths});
const ring=smooth([[-1500,780],[-700,-350],[1700,-650],[2800,-310],[3950,-240],[5200,-210],[7750,-170],[8460,1080],[8500,1700],[8500,2540],[8230,3200],[8000,4010],[7480,5300],[5600,5520],[3540,5450],[2420,5330],[1000,5410],[-530,5190],[-1420,4140],[-1550,3340],[-1460,2540],[-750,1740]],true,9);
export const paths=[{line:[...ring,ring[0]],w:190,widths:[.95,1.06,.92,1.08,.96,1.02]},
 lane([[-1460,2540],[-900,2720],[-250,2820],[560,2840]],175),
 lane([[-530,5190],[220,4640],[670,3900],[1005,3666]],165),
 lane([[3540,5450],[3560,4950],[3570,4300],[3570,3940]],175),
 lane([[7480,5300],[7110,4540],[6570,3770],[6300,3620]],165),
 lane([[8500,2540],[7700,2590],[7240,2540],[6740,2600]],175),
 lane([[7750,-170],[7040,30],[6610,630],[6500,950]],165),
 lane([[3490,-290],[3500,-70],[3570,480],[3570,800]],175),
 lane([[-1500,780],[-350,90],[300,670],[680,920]],165),
 lane([[-750,1740],[-400,1870],[-180,1930]],115),
 lane([[3950,-240],[4070,-80],[4520,40],[4890,100]],115),
 lane([[8460,1080],[7900,1460],[7790,1650],[7760,2120]],125),
 lane([[8230,3200],[7860,3250],[7630,3440]],125),
 lane([[2420,5330],[3010,5370],[3550,5240],[3700,5080]],125),
 lane([[1000,5410],[1005,5650]],150)
];
const props=[];let community;
const templates=new Map(original.props.map(p=>[p.src,p]));
function kit(src,x,y,scale=1){const t=templates.get(src);if(!t)throw Error(src);props.push({...t,id:'fair-community-'+props.length,x,y,scale,community});}
function custom(src,x,y,w,h,rx,ry,extra={}){props.push(fitContact({id:'fair-community-'+props.length,name:src.replaceAll('-',' '),src:'bigger/'+src+'.svg',x,y,width:w,height:h,scale:1,anchor:{x:.5,y:1},shadow:false,footprint:rx?{x,y:y-ry,rx,ry}:null,community,...extra}));}
const homes=[];
function home(type,x,y){
 const i=homes.filter(h=>h.community===community).length;
 const profiles=[{w:490,h:495,roof:pink,wall:cream},{w:580,h:475,roof:blue,wall:'#FFF4C5'},{w:450,h:535,roof:yellow,wall:'#F5D9AF'},{w:560,h:510,roof:mint,wall:'#FFEAB2'},{w:510,h:465,roof:'#DAB5D9',wall:'#FFF5D0'},{w:545,h:525,roof:'#F2BF7B',wall:cream}];
 const v=profiles[i],kind={'bobbin-cottage':'costume','balloon-caravan':'caravan','parade-home':'performer','sugar-cottage':'baker'}[type];
 let body=house(kind,v.roof).replaceAll('fill="'+cream+'"','fill="'+v.wall+'"');
 if(i===1||i===4)body+=p('M115 201V153L159 119L204 153V201Z',v.wall)+p('M102 155L159 108L216 155Z',v.roof)+r(141,155,37,36,blue,8)+p('M160 156v34');
 if(i===2||i===5)body+=r(302,50,36,81,'#D1A372')+r(293,46,55,15,v.wall)+p('M303 77h34M303 96h34');
 if(i===3||i===5)body+=p('M170 303L153 271H285L303 303Q287 322 268 304Q250 324 231 305Q212 324 193 305Q180 319 170 303Z',v.roof)+p('M165 306v72M290 306v72','none','stroke-width="5"');
 if(i===0||i===4)body+=p('M51 262L16 274V337L52 350Z',v.roof)+p('M17 272l34 -17M25 286v39M37 279v53','none','stroke-width="4"');
 const variant=type+'-'+i;asset(variant,440,455,body);
 custom(variant,x,y,v.w,v.h,v.w*.37,53,{role:'home',homeType:type,variant:i});homes.push({community,x,y,door:[x,y+34],variant,dimensions:[v.w,v.h]});
}
function fence(x,y,w=350){const panel=(w-100)/2;for(const side of [-1,1]){const xx=x+side*(panel/2+50);custom('garden-fence',xx,y,panel,panel*110/420,0,0,{footprints:[{x:xx,y:y-10,rx:panel*.48,ry:9}]});}}
function garden(x,y){kit('tulip-planter.svg',x,y,.46);}
function tree(src,x,y,k=1.1){kit('reuse/'+src+'.svg',x,y,k);}
function compose(){
 community='bobbinbell';
 for(const [x,y]of [[-1370,1410],[-860,1110],[-310,1400],[-1310,2050],[-270,2140]])home('bobbin-cottage',x,y);
 custom('sewing-table',-250,2670,390,260,155,37);custom('sewing-table',-100,2430,330,220,133,33);
 custom('washing-line',-1020,2140,390,168,0,0,{footprints:[{x:-1202,y:2130,rx:10,ry:10},{x:-838,y:2130,rx:10,ry:10}]});
 kit('stall-pink.svg',-1190,2800,.95);kit('ribbon-arch.svg',-360,3100,.84);
 custom('neighbour-sign',-340,1750,145,175,20,12);
 fence(-1370,1570,420);fence(-860,1250,440);fence(-310,1530,320);fence(-1390,2220,300);fence(-270,2260,330);
 for(const [x,y]of [[-1550,1520],[-1120,1180],[-620,1200],[-70,1520],[-1500,2200],[-60,2260]])garden(x,y);
 tree('tree-3',-1720,1850);tree('tree-4',-80,2550);tree('tree-2',-1790,3020);tree('tree-1',-590,3100);tree('bush-2',-1780,1740,1);
 kit('reuse/street--bench-park.svg',-1050,1760,.25);kit('fair-lamp.svg',-1100,1560,.5);kit('balloons.svg',-1300,2820,.6);
 custom('shared-well',-460,1610,180,185,65,25);custom('garden-cart',-1770,2770,240,170,85,25);
 community='cloudpop';
 for(const [x,y]of [[3510,-590],[4030,-650],[4550,-560],[3030,-550],[5110,-500],[4510,210]])home('balloon-caravan',x,y);
 custom('balloon-workbench',5650,60,440,400,165,45);custom('balloon-workbench',5460,360,350,318,135,35);
 custom('balloon',6250,-90,405,585,126,38);kit('ticket-booth.svg',6600,200,.9);kit('balloons.svg',5910,360,.7);
 custom('washing-line',4700,330,350,151,0,0,{footprints:[{x:4537,y:320,rx:10,ry:10},{x:4863,y:320,rx:10,ry:10}]});
 fence(3490,-470,420);fence(4050,-510,420);fence(4540,-440,400);fence(2900,-430,350);fence(5230,-350,300);
 for(const [x,y]of [[3280,-490],[3780,-500],[4280,-440],[4780,-460],[2880,-380],[5360,-310],[4680,300]])garden(x,y);
 custom('neighbour-sign',3900,-70,145,175,20,12);kit('reuse/street--bench-park.svg',4210,70,.25);kit('fair-lamp.svg',3700,-60,.5);
 custom('shared-well',4070,150,180,185,65,25);custom('garden-cart',5580,-300,240,170,85,25);
 tree('tree-3',2820,-500);tree('tree-4',3170,240);tree('tree-1',5600,450);tree('tree-2',7870,720);tree('bush-2',7030,430,1);
 kit('wish-flag.svg',6350,370,.6);kit('reuse/flower-2.svg',3970,90,2);kit('reuse/flower-3.svg',4780,300,2);
 community='waddleshow';
 for(const [x,y]of [[7470,2960],[8000,2820],[8670,3010],[7470,3650],[8510,3690]])home('parade-home',x,y);
 custom('prop-rack',7490,2260,520,340,215,35);kit('goose-float.svg',8210,2390,1.05);
 custom('bandstand',7490,4270,660,547,245,72);custom('prop-rack',8450,4240,390,255,165,30);
 kit('stall-blue.svg',7290,3220,.95);kit('bunting.svg',8580,3330,.85);kit('balloons.svg',8580,3240,.65);
 custom('washing-line',8670,3950,365,157,0,0,{footprints:[{x:8500,y:3940,rx:10,ry:10},{x:8840,y:3940,rx:10,ry:10}]});
 fence(7450,3070,400);fence(7960,2960,330);fence(8670,3200,300);fence(7330,3790,400);fence(8590,3820,340);
 for(const [x,y]of [[7240,3060],[7690,3010],[8430,3150],[8860,3240],[7250,3770],[8720,3800]])garden(x,y);
 custom('neighbour-sign',7990,3530,145,175,20,12);kit('reuse/street--bench-park.svg',7790,3520,.25);kit('fair-lamp.svg',8520,3440,.5);
 custom('shared-well',7750,3110,180,185,65,25);custom('garden-cart',7350,3960,240,170,85,25);
 tree('tree-3',7240,2680);tree('tree-2',8810,2980);tree('tree-1',8680,4100);tree('tree-4',6790,4750);tree('bush-3',8310,5020,1.1);
 community='sugarspoon';
 for(const [x,y]of [[1660,4870],[2220,4770],[2800,4850],[1260,5260],[3250,5120],[2930,5720]])home('sugar-cottage',x,y);
 custom('bread-oven',3820,4930,450,390,175,50);custom('bread-cart',3720,5370,350,290,137,34);custom('bread-cart',4220,5400,315,261,125,32);
 custom('flour-crates',3650,5580,250,187,105,30);custom('flour-crates',500,5620,280,210,120,32);custom('flour-crates',1200,5550,235,176,100,29);
 custom('tea-table',2040,5470,260,217,90,27);custom('tea-table',2560,5620,260,217,90,27);
 kit('stall-pink.svg',-700,4900,.9);kit('stall-blue.svg',270,5200,.9);kit('bunting.svg',2400,5070,.85);
 custom('washing-line',3160,5700,390,168,0,0,{footprints:[{x:2978,y:5690,rx:10,ry:10},{x:3342,y:5690,rx:10,ry:10}]});
 fence(1610,4990,410);fence(2200,4890,440);fence(2840,4970,400);fence(1260,5330,300);fence(3250,5240,330);
 for(const [x,y]of [[1440,4990],[1930,4980],[2510,4970],[3030,4960],[700,5510],[3440,5520],[2790,5830]])garden(x,y);
 custom('neighbour-sign',2700,5750,145,175,20,12);kit('fair-lamp.svg',1870,5270,.5);kit('fair-lamp.svg',3090,5480,.5);
 custom('shared-well',2670,5230,180,185,65,25);custom('garden-cart',3930,5640,240,170,85,25);
 tree('tree-1',-950,4530);tree('tree-4',-700,5410);tree('tree-3',770,5060);tree('tree-2',4620,5560);tree('tree-3',5780,5120);tree('bush-3',5700,5730,1.1);
 community='commons';
 for(const [src,x,y,k]of [
 ['tree-3',900,50,1.05],['tree-4',1240,-30,.95],['tree-2',1520,110,1.05],['tree-1',1120,300,.9],
 ['tree-4',-970,3650,1.2],['tree-3',-550,3790,1.1],['tree-2',-1160,3940,1.05],
 ['tree-1',6000,4520,1.1],['tree-4',6370,4560,1.05],['tree-3',6610,4770,.95],
 ['tree-3',7420,690,1.15],['tree-4',7760,800,1.05],['tree-2',7640,1120,.95],
 ['tree-4',3990,4630,1.05],['tree-3',4480,4510,1.1],['tree-2',4790,4650,.95]])tree(src,x,y,k);
 kit('reuse/street--bench-park.svg',1430,300,.25);
 kit('reuse/street--bench-park.svg',-730,4090,.25);
 custom('tea-table',-540,4020,260,217,90,27);
 custom('tea-table',6260,4820,260,217,90,27);
 custom('garden-fence',4090,4810,340,89,0,0,{footprints:[{x:4090,y:4790,rx:162,ry:12}]});
 custom('flour-crates',4500,4780,190,143,77,22);
 for(const [x,y]of [[3940,4450],[4120,4490],[4310,4450],[4510,4380],[4700,4430]])garden(x,y);
 kit('balloons.svg',7560,1190,.5);
 community='bobbinbell';
 for(const [src,x,y,k]of [['tree-3',-1750,2470,.85],['tree-4',-1100,2480,.8],['bush-2',-1210,2430,.95]])tree(src,x,y,k);
 community='cloudpop';
 for(const [src,x,y,k]of [['tree-3',1710,-220,.95],['tree-4',2150,-220,1.05],['tree-2',2550,-260,.95],['tree-1',2020,-720,.9],['bush-2',2520,-100,1]])tree(src,x,y,k);
 community='waddleshow';
 for(const [src,x,y,k]of [['tree-3',8190,4670,1.1],['tree-4',8470,4900,1],['tree-2',7650,4770,1.1],['bush-2',8440,5050,1]])tree(src,x,y,k);
 community='sugarspoon';
 for(const [src,x,y,k]of [['tree-3',4870,5220,1.1],['tree-4',5320,5260,1],['tree-2',5020,4770,1.1],['bush-3',5470,5310,1]])tree(src,x,y,k);
 community='commons';
 for(const [src,x,y,k]of [['tree-3',7600,650,1.15],['tree-4',7470,1050,1.1],['bush-2',7420,1180,1],['tree-1',5900,4680,1.15],['tree-2',6210,4800,1.1],['bush-3',6080,4930,1],['tree-3',-1000,3800,1.1],['tree-4',-590,3830,1.1],['bush-2',-690,3970,1]])tree(src,x,y,k);
 return props;
}
const d=pts=>'M'+pts.map(q=>q.map(v=>Math.round(v*10)/10).join(' ')).join('L');
async function tiles(){return buildTiles();}
makeAssets();compose();
const art={...original,...bounds,ground:{tiles:await tiles()},props:[...original.props,...props]};
write(S+'design.json',{...bounds,coast,places,paths,newProps:props,homes});write(S+'proposed-art.json',art);
const png=await render(art,{k:.13,x:-2500,y:-1800,width:1560,height:1066,home:true,sleepers:false});
const labels=[[-800,1190,'BOBBINBELL GREEN'],[3950,-1050,'CLOUDPOP MEWS'],[7900,3000,'WADDLESHOW YARD'],[2550,5760,'SUGARSPOON HARBOUR'],[3600,1800,'FAIRGROUND HEART, PRESERVED']];
const text=labels.map(([x,y,t])=>`<g transform="translate(${(x+2500)*.13} ${(y+1800)*.13})"><rect x="-130" y="-22" width="260" height="34" rx="14" fill="#FFF4CA" stroke="#A88A46" stroke-width="1.5"/><text text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#7D673E">${t}</text></g>`).join('');
await sharp(png).composite([{input:Buffer.from(`<svg width="1560" height="1066">${text}</svg>`),left:0,top:0}]).png().toFile(O+'fair-communities.png');
write(S+'communities.json',{communities:places,homes,designBeforeBuild:true});
console.log('Locked labelled communities drawing; '+homes.length+' homes, '+props.length+' authored props. Production manifests unchanged.');
