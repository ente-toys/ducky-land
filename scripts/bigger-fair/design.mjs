// Authored Waddlewish extension: fixed scenes, not a prop scatter generator.
import fs from 'node:fs';
import {render} from './render-core.mjs';
const A='public/pixi-art/themes/fair/', O='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger/';
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,1)+'\n');
export const original=read('scripts/bigger-fair/original-art.json');
export const bounds={width:12000,height:8200,origin:{x:-2500,y:-1800}};
export const places=[
 {id:'balloon-garden',name:'Wish Balloon Garden',x:-650,y:-100,point:[-650,260],floor:[650,380],kind:'garden'},
 {id:'starlight-stage',name:'Starlight Bandstand',x:3450,y:-650,point:[3450,-200],floor:[850,460],kind:'paved'},
 {id:'ribbon-garden',name:'Ribbon Garden',x:7450,y:-150,point:[7450,280],floor:[700,430],kind:'garden'},
 {id:'prize-court',name:'Golden Egg Prize Court',x:8150,y:2250,point:[8150,2670],floor:[640,450],kind:'paved'},
 {id:'parade-cove',name:'Goose Parade Cove',x:7450,y:4650,point:[7450,5020],floor:[730,430],kind:'paved'},
 {id:'picnic-meadow',name:'Confetti Picnic Meadow',x:3600,y:5150,point:[3600,5360],floor:[950,490],kind:'garden'},
 {id:'bakery-walk',name:'Cupcake Promenade',x:-150,y:4800,point:[-150,5170],floor:[730,460],kind:'paved'},
 {id:'duckling-pond',name:'Hook a Duck Garden',x:-1250,y:2300,point:[-1250,2720],floor:[590,450],kind:'garden'}
];
const round=v=>Math.round(v*10)/10;
export function smooth(pts,closed=true,n=12){const out=[],N=pts.length,P=i=>pts[closed?(i+N)%N:Math.max(0,Math.min(N-1,i))];for(let i=0;i<(closed?N:N-1);i++)for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;out.push([0,1].map(j=>round(.5*(2*P(i)[j]+(-P(i-1)[j]+P(i+1)[j])*t+(2*P(i-1)[j]-5*P(i)[j]+4*P(i+1)[j]-P(i+2)[j])*t2+(-P(i-1)[j]+3*P(i)[j]-3*P(i+1)[j]+P(i+2)[j])*t3))));}if(!closed)out.push(pts.at(-1));return out;}
export const coast=smooth([[-1670,-490],[-850,-1080],[1050,-1190],[3200,-1370],[5400,-1230],[7300,-1100],[8500,-600],[8870,600],[9060,2300],[8760,3850],[8530,4870],[7470,5670],[5680,5840],[3600,6030],[1630,5780],[-220,5690],[-1440,5050],[-1850,3780],[-2050,2290],[-1930,800]]);
export const loop=smooth([[-1270,-290],[600,-770],[3370,-950],[5800,-770],[7850,-500],[8390,950],[8530,2540],[8170,4220],[7510,5300],[5580,5430],[3540,5630],[1370,5370],[-450,5290],[-1330,4290],[-1510,2650],[-1440,1050]]);
// Connections land at existing promenades, without changing a single old pixel.
export const paths=[{line:loop,w:285},
 {line:smooth([[-1250,2650],[-620,2790],[0,2830],[560,2840]],false),w:340},
 {line:smooth([[-400,5290],[200,4690],[670,3900],[1005,3666]],false),w:340},
 {line:smooth([[3540,5630],[3560,4970],[3570,4300],[3570,3940]],false),w:350},
 {line:smooth([[7600,5300],[7110,4540],[6570,3770],[6300,3620]],false),w:330},
 {line:smooth([[8530,2540],[7710,2590],[7240,2540],[6740,2600]],false),w:350},
 {line:smooth([[7850,-500],[7030,20],[6610,630],[6500,950]],false),w:330},
 {line:smooth([[3370,-950],[3490,-220],[3570,480],[3570,800]],false),w:350},
 {line:smooth([[-1270,-290],[-350,90],[300,670],[680,920]],false),w:330}];
const d=pts=>'M'+pts.map(p=>p.join(' ')).join(' L');
const ink='#A88A46',pink='#F6A9B6',cream='#FFF0AE',blue='#89CEDD',mint='#A6E3DE',yellow='#FFE078';
const svg=(w,h,s)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-linecap="round" stroke-linejoin="round"><g stroke="${ink}" stroke-width="3.5">${s}</g></svg>`;
const e=(x,y,rx,ry,c,extra='')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" ${extra}/>`;
const rect=(x,y,w,h,c,r=8)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
const path=(s,c='none',extra='')=>`<path d="${s}" fill="${c}" ${extra}/>`;
const egg=(x,y,s=1,c=yellow)=>`<g transform="translate(${x} ${y}) scale(${s})">${path('M0 -30 C-24 -30 -29 8 -20 20 C-9 36 16 30 23 15 C31 -2 17 -30 0 -30Z',c)}${path('M-15 5 Q0 -10 20 2','none','stroke="#FFF4CC" stroke-width="8"')}</g>`;
export function assets(){fs.mkdirSync(A+'bigger',{recursive:true});
 // The balloon tower is a garden sculpture, with tether ropes and a basket at ground level.
 fs.writeFileSync(A+'bigger/balloon.svg',svg(450,650,
 e(225,600,144,37,cream)+path('M110 210 Q225 475 340 210','none')+path('M155 250 L177 530 M295 250 L273 530')+
 e(225,180,164,160,cream)+path('M225 20 C110 45 105 255 225 340 C345 255 340 45 225 20Z',pink)+path('M225 20 C180 80 180 260 225 340 C270 260 270 80 225 20Z',yellow)+
 path('M64 185 Q225 250 387 185','none','stroke="#FFF3C8" stroke-width="9"')+rect(159,520,132,85,'#D6A967')+e(225,520,66,19,'#F1CF8D')+path('M177 540 L177 588 M201 540 L201 595 M225 540 L225 600 M249 540 L249 595 M273 540 L273 588','none','stroke-width="2"')+egg(225,489,.64)));
 let stage=e(410,530,365,140,'#D5AE70')+e(410,501,365,133,cream)+e(410,490,325,110,pink);
 stage+=path('M125 155 L125 466 M695 155 L695 466','none','stroke="#B18B4A" stroke-width="20"')+path('M145 155 L145 460 M675 155 L675 460','none','stroke="#FFF4CA" stroke-width="7"');
 stage+=path('M55 166 Q410 8 765 166 Q690 215 630 173 Q550 220 490 180 Q410 223 330 180 Q260 215 190 173 Q115 213 55 166Z',pink)+path('M55 166 Q410 8 765 166 L410 18Z',cream)+path('M190 145 L410 18 L330 116Z',blue)+path('M490 116 L410 18 L630 145Z',yellow)+egg(410,17,.6);
 stage+=rect(292,380,236,86,'#D6AE70')+e(410,377,118,30,cream)+rect(380,284,60,88,mint)+e(410,284,30,16,cream)+path('M350 397 L350 456 M470 397 L470 456','none')+path('M75 520 Q410 660 745 520','none','stroke="#FFF3C8" stroke-width="13"');
 fs.writeFileSync(A+'bigger/bandstand.svg',svg(820,680,stage));
 let tent=path('M75 210 L75 480 Q310 545 545 480 L545 210Z',cream)+path('M75 210 L155 210 L155 496 L75 480Z',pink)+path('M465 210 L545 210 L545 480 L465 496Z',pink)+path('M240 330 Q310 255 380 330 L380 507 Q310 525 240 507Z','#E8BB7E')+path('M35 220 L310 35 L585 220 Q530 266 475 225 Q420 270 365 225 Q310 268 255 225 Q200 268 145 225 Q90 266 35 220Z',pink)+path('M35 220 L310 35 L145 225Z',cream)+path('M255 225 L310 35 L365 225Z',yellow)+path('M475 225 L310 35 L585 220Z',cream)+egg(310,29,.57)+e(310,535,274,48,cream);
 tent+=rect(175,231,270,65,blue)+`<text x="310" y="274" fill="#806D40" stroke="none" text-anchor="middle" font-size="32" font-family="Georgia">PRIZES</text>`;
 fs.writeFileSync(A+'bigger/prize-pavilion.svg',svg(620,600,tent));
 let booth=rect(30,160,440,210,cream)+rect(45,199,410,118,blue)+path('M15 153 L70 35 L430 35 L485 153 Q445 185 405 157 Q365 187 325 157 Q285 187 245 157 Q205 187 165 157 Q125 187 85 157 Q50 187 15 153Z',pink);
 booth+=path('M70 35 L125 35 L85 157 L15 153Z',cream)+path('M195 35 L250 35 L245 157 L165 157Z',cream)+path('M320 35 L375 35 L405 157 L325 157Z',cream);
 for(const [x,y]of [[100,255],[200,272],[300,250],[400,270]])booth+=e(x,y,23,14,yellow)+e(x+8,y-17,13,15,yellow)+path(`M${x+17} ${y-18} l17 7 l-17 6`,'#F1A26D');
 booth+=rect(38,320,424,24,'#D5AE70')+path('M54 370 L54 400 M445 370 L445 400','none','stroke-width="11"');
 fs.writeFileSync(A+'bigger/duck-booth.svg',svg(500,420,booth));
 let table=e(150,130,130,59,'#D6AE70')+path('M110 135 L95 233 M190 135 L205 233','none','stroke-width="12"')+e(150,112,130,55,cream)+e(150,107,90,35,pink)+e(155,96,31,17,mint)+path('M177 90 Q212 87 196 109 Q190 114 179 108','none')+egg(112,87,.32)+rect(47,188,55,27,blue)+rect(207,188,55,27,blue);
 fs.writeFileSync(A+'bigger/tea-table.svg',svg(300,250,table));
 const sign=rect(30,80,30,170,'#D6AE70')+rect(2,12,178,100,cream)+path('M15 22 L166 22 L166 98 L15 98Z',pink)+`<text x="90" y="72" fill="#806D40" stroke="none" text-anchor="middle" font-size="27" font-family="Georgia">WISH</text>`+egg(90,13,.38);
 fs.writeFileSync(A+'bigger/wish-sign.svg',svg(190,270,sign));
}
const templates=new Map(original.props.map(p=>[p.src,p]));
export const newProps=[];
function prop(src,x,y,scale=1,name){const t=templates.get(src);if(!t)throw Error(src);newProps.push({...t,id:'fair-bigger-'+newProps.length,x,y,scale,name:name??t.name});}
function custom(src,x,y,w,h,rx,ry){newProps.push({id:'fair-bigger-'+newProps.length,name:src.replaceAll('-',' '),src:'bigger/'+src+'.svg',x,y,width:w,height:h,scale:1,anchor:{x:.5,y:1},shadow:false,footprint:{x,y:y-ry,rx,ry}});}
function kit(id,rows){const p=places.find(p=>p.id===id);for(const [src,dx,dy,k]of rows)prop(src,p.x+dx,p.y+dy,k);}
// Each tuple is deliberately placed within one scene. No random or evenly distributed props.
export function composeProps(){newProps.length=0;
 custom('balloon',-740,-30,450,650,140,42);custom('wish-sign',-240,140,120,171,24,14);
 kit('balloon-garden',[
 ['ticket-booth.svg',-470,150,.8],['balloons.svg',370,-60,.65],['balloons.svg',-220,-240,.48],['tulip-planter.svg',-350,300,.44],['tulip-planter.svg',300,315,.44],['fair-lamp.svg',-520,330,.48],['fair-lamp.svg',500,335,.48],['reuse/street--bench-park.svg',250,200,.23],['reuse/tree-3.svg',-650,-120,1.1],['reuse/tree-4.svg',560,-170,1.1],['reuse/tree-2.svg',630,120,1.1],['reuse/bush-2.svg',-510,-160,1],['reuse/bush-3.svg',540,285,1],['reuse/flower-2.svg',-390,340,2],['reuse/flower-3.svg',335,350,2],['wish-flag.svg',-330,-100,.55]]);
 custom('bandstand',3450,-610,820,680,320,91);
 kit('starlight-stage',[
 ['bunting.svg',-640,-40,.76],['bunting.svg',650,-40,.76],['fair-lamp.svg',-530,300,.5],['fair-lamp.svg',540,300,.5],['tulip-planter.svg',-460,125,.5],['tulip-planter.svg',460,125,.5],['reuse/street--bench-park.svg',-340,370,.24],['reuse/street--bench-park.svg',340,370,.24],['stall-pink.svg',-950,100,.85],['stall-blue.svg',950,100,.85],['reuse/tree-3.svg',-1060,-180,1.1],['reuse/tree-1.svg',1060,-160,1.1],['balloons.svg',-760,200,.5],['balloons.svg',760,200,.5],['reuse/flower-1.svg',-550,360,2],['reuse/flower-3.svg',550,360,2]]);
 kit('ribbon-garden',[
 ['ribbon-arch.svg',0,100,1.18],['ribbon-arch.svg',-420,-100,.8],['ribbon-arch.svg',420,-100,.8],['tulip-planter.svg',-370,270,.55],['tulip-planter.svg',370,270,.55],['reuse/street--bench-park.svg',-530,350,.23],['reuse/street--bench-park.svg',530,350,.23],['fair-lamp.svg',-600,80,.48],['fair-lamp.svg',600,80,.48],['wish-flag.svg',-200,-110,.5],['wish-flag.svg',200,-110,.5],['reuse/tree-4.svg',-750,-230,1.1],['reuse/tree-2.svg',750,-140,1.1],['reuse/bush-2.svg',-640,260,1.2],['reuse/bush-3.svg',640,280,1.2],['reuse/flower-2.svg',-350,340,2],['reuse/flower-3.svg',350,340,2]]);
 custom('prize-pavilion',8150,2210,620,600,248,64);
 custom('duck-booth',7670,2410,350,294,150,30);
 kit('prize-court',[
 ['stall-pink.svg',440,200,.88],['ticket-booth.svg',-240,320,.75],['tulip-planter.svg',-410,450,.45],['tulip-planter.svg',410,450,.45],['balloons.svg',380,-60,.55],['fair-lamp.svg',-530,430,.5],['fair-lamp.svg',540,430,.5],['reuse/street--bench-park.svg',540,330,.22],['reuse/tree-1.svg',-680,-110,1.08],['reuse/tree-3.svg',650,-150,1.08],['reuse/bush-1.svg',650,320,1.1],['reuse/flower-1.svg',-410,490,2],['reuse/flower-3.svg',410,490,2]]);
 custom('prize-pavilion',7830,4630,430,416,172,45);
 kit('parade-cove',[
 ['goose-float.svg',-100,80,1.1],['bunting.svg',-430,170,.7],['bunting.svg',450,220,.65],['stall-blue.svg',-700,190,.9],['fair-lamp.svg',-480,380,.5],['fair-lamp.svg',480,380,.5],['balloons.svg',-440,-60,.6],['balloons.svg',560,10,.55],['tulip-planter.svg',-380,410,.5],['tulip-planter.svg',390,430,.5],['reuse/tree-3.svg',-800,-130,1.1],['reuse/tree-1.svg',740,-130,1.05],['reuse/street--bench-park.svg',-300,300,.23],['reuse/street--bench-park.svg',350,320,.23],['wish-flag.svg',-120,300,.5],['wish-flag.svg',170,310,.5]]);
 custom('tea-table',3200,5120,260,217,90,27);custom('tea-table',3940,5280,260,217,90,27);
 kit('picnic-meadow',[
 ['reuse/street--picnic-blanket.svg',-100,140,.37],['reuse/street--picnic-blanket.svg',-590,380,.32],['reuse/street--picnic-blanket.svg',580,340,.33],['reuse/street--umbrella-cafe.svg',-400,-60,.19],['reuse/street--umbrella-garden.svg',340,110,.19],['stall-pink.svg',0,-230,.85],['reuse/tree-3.svg',-900,-20,1.15],['reuse/tree-1.svg',900,100,1.15],['reuse/tree-4.svg',-770,410,1.1],['reuse/tree-2.svg',770,460,1.1],['tulip-planter.svg',-250,-60,.45],['tulip-planter.svg',250,-60,.45],['balloons.svg',140,-120,.48],['fair-lamp.svg',-570,210,.45],['fair-lamp.svg',560,40,.45],['reuse/flower-2.svg',-780,450,2],['reuse/flower-3.svg',750,500,2]]);
 custom('tea-table',-430,4970,260,217,90,27);custom('tea-table',120,5060,260,217,90,27);
 kit('bakery-walk',[
 ['stall-pink.svg',-440,-90,1],['stall-blue.svg',-60,-100,1],['ticket-booth.svg',300,-120,.85],['bunting.svg',40,-340,.9],['reuse/street--umbrella-cafe.svg',-340,100,.19],['reuse/street--umbrella-garden.svg',210,210,.18],['tulip-planter.svg',-600,180,.48],['tulip-planter.svg',540,360,.48],['fair-lamp.svg',-650,90,.5],['fair-lamp.svg',640,110,.5],['balloons.svg',480,-10,.55],['reuse/street--bench-park.svg',-620,250,.23],['reuse/tree-1.svg',-800,-100,1.1],['reuse/tree-4.svg',800,70,1.1],['reuse/flower-2.svg',-540,390,2],['reuse/flower-3.svg',530,420,2]]);
 custom('duck-booth',-1250,2180,500,420,210,42);
 kit('duckling-pond',[
 ['ticket-booth.svg',-350,90,.75],['stall-blue.svg',350,90,.9],['balloons.svg',300,310,.55],['tulip-planter.svg',-350,420,.48],['tulip-planter.svg',350,470,.48],['reuse/street--bench-park.svg',-370,310,.23],['reuse/street--bench-park.svg',470,400,.23],['fair-lamp.svg',-510,440,.48],['fair-lamp.svg',520,470,.48],['reuse/tree-3.svg',-570,-150,1.1],['reuse/tree-4.svg',620,-180,1.1],['reuse/bush-2.svg',-520,170,1.1],['reuse/bush-3.svg',530,160,1.1],['reuse/flower-2.svg',-300,480,2],['reuse/flower-3.svg',300,520,2]]);
 // Deliberate scenic groups frame the large free lawns between the places.
 for(const [src,x,y,k]of [
 ['reuse/tree-1.svg',700,-430,1.2],['reuse/tree-4.svg',1030,-380,1.1],['reuse/bush-2.svg',880,-260,1.1],['tulip-planter.svg',880,-80,.5],
 ['reuse/tree-3.svg',5620,-470,1.18],['reuse/tree-2.svg',5970,-400,1.13],['reuse/bush-3.svg',5790,-260,1.1],['tulip-planter.svg',5750,-60,.48],
 ['reuse/tree-3.svg',7400,1100,1.2],['reuse/tree-4.svg',7520,1470,1.1],['reuse/bush-2.svg',7350,1400,1.2],
 ['reuse/tree-1.svg',7800,3470,1.2],['reuse/tree-2.svg',7460,3700,1.1],['tulip-planter.svg',7580,3830,.48],
 ['reuse/tree-3.svg',5510,4740,1.2],['reuse/tree-4.svg',5860,4890,1.1],['reuse/bush-2.svg',5640,4940,1.2],
 ['reuse/tree-1.svg',1600,4670,1.2],['reuse/tree-2.svg',1940,4800,1.1],['tulip-planter.svg',1710,4940,.48],
 ['reuse/tree-3.svg',-830,3730,1.15],['reuse/tree-4.svg',-530,3960,1.1],['reuse/bush-2.svg',-680,4010,1.1],
 ['reuse/tree-1.svg',-700,1050,1.2],['reuse/tree-2.svg',-440,1290,1.1],['tulip-planter.svg',-550,1420,.48]
 ])prop(src,x,y,k);
 return newProps;
}
// Repeating tiny ground marks provide texture only. All scenery above is hand placed.
export function ground(){let g=`<defs><pattern id="grain" width="177" height="139" patternUnits="userSpaceOnUse"><path d="M17 29l4 -7 5 8 M105 101l4 -8 5 7 M149 49l3 -6 5 7" fill="none" stroke="#729F39" stroke-width="2.6" opacity=".5"/><ellipse cx="67" cy="51" rx="10" ry="3" fill="#C3DE65" opacity=".7"/><ellipse cx="29" cy="109" rx="3" ry="2" fill="#D9E581"/><circle cx="130" cy="22" r="2" fill="#83B13E"/></pattern><clipPath id="grown-land"><path d="${d(coast)}Z"/></clipPath></defs>`;
 g+=`<path d="${d(coast)}Z" fill="#A6E3DE" stroke="#A6E3DE" stroke-width="120" opacity=".6"/><path d="${d(coast)}Z" fill="${cream}" stroke="#E4C27D" stroke-width="6"/>`;
 const inset=coast.map(([x,y])=>[3600+(x-3600)*.978,2400+(y-2400)*.97]);
 g+=`<path d="${d(inset)}Z" fill="#9CC63E" stroke="#7CA445" stroke-width="5"/><path d="${d(inset)}Z" fill="url(#grain)"/>`;
 // Broad organic shade patches under the groups and open textured meadows.
 const patches=[[-700,-70,850,380],[3430,-640,1220,480],[7540,-100,990,490],[8100,2400,850,590],[7420,4680,1100,560],[3600,5250,1300,610],[-100,4870,1100,570],[-1220,2390,800,590],[920,-430,780,250],[5650,-440,760,270],[7600,1200,420,720],[7750,3500,500,620],[5600,4900,850,340],[1660,4800,900,340],[-660,3830,520,660],[-680,1200,460,650]];
 for(const [x,y,rx,ry]of patches)g+=`<path d="M${x-rx} ${y} C${x-rx*.9} ${y-ry} ${x+rx*.3} ${y-ry*1.15} ${x+rx} ${y-ry*.15} C${x+rx*1.2} ${y+ry*.8} ${x-rx*.7} ${y+ry} ${x-rx} ${y}Z" fill="#90BD38" opacity=".55"/>`;
 for(const p of paths){const s=d(p.line)+(p===paths[0]?'Z':'');g+=`<path d="${s}" fill="none" stroke="#7FA642" stroke-width="${p.w+36}" opacity=".45"/><path d="${s}" fill="none" stroke="#DCC97D" stroke-width="${p.w+13}"/><path d="${s}" fill="none" stroke="${cream}" stroke-width="${p.w}"/>`;}
 for(const p of places){const [rx,ry]=p.floor;g+=`<ellipse cx="${p.x}" cy="${p.y+160}" rx="${rx}" ry="${ry}" fill="#DDC67A"/><ellipse cx="${p.x}" cy="${p.y+160}" rx="${rx-9}" ry="${ry-9}" fill="${cream}"/>`;
 if(p.kind==='paved'){g+=`<ellipse cx="${p.x}" cy="${p.y+160}" rx="${rx*.82}" ry="${ry*.74}" fill="#F8DAB0" stroke="#D8B578" stroke-width="4"/><ellipse cx="${p.x}" cy="${p.y+160}" rx="${rx*.66}" ry="${ry*.58}" fill="none" stroke="${pink}" stroke-width="20"/>`;
 for(let i=-4;i<=4;i++)g+=`<path d="M${p.x+i*rx*.16} ${p.y+160-ry*.5} v${ry}" stroke="#DEBC82" stroke-width="2" opacity=".4"/>`;
 }else g+=`<ellipse cx="${p.x}" cy="${p.y+160}" rx="${rx*.78}" ry="${ry*.71}" fill="#B8D65D"/><ellipse cx="${p.x}" cy="${p.y+160}" rx="${rx*.78}" ry="${ry*.71}" fill="url(#grain)"/>`;
 }
 return g;
}
export function buildTiles(){const tiles=[],xx=[-2500,-1250,0,1450,2900,4350,5800,7250,8375,9500],yy=[-1800,-900,0,1213,2426,3639,4850,5625,6400];const ext=ground();
 for(let r=0;r<yy.length-1;r++)for(let c=0;c<xx.length-1;c++){const x=xx[c],y=yy[r],w=xx[c+1]-x,h=yy[r+1]-y;let inside='';
 const t=original.ground.tiles.find(t=>t.x===x&&t.y===y);
 if(t){let s=fs.readFileSync(A+t.src,'utf8');s=s.replace(/<path[^>]*fill="#A6E3DE"[^>]*\/>/g,'').replace(/<path[^>]*stroke="#C9F1EE"[^>]*stroke-width="46"[^>]*\/>/g,'').replace(/<ellipse[^>]*fill="#A6E3DE"[^>]*\/>/g,'');inside=s.replace('<svg ',`<svg x="${x}" y="${y}" `);}
 const src=`bigger/ground-${r}-${c}.svg`;fs.writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" stroke-linecap="round" stroke-linejoin="round"><title>Waddlewish expanded ground ${r} ${c}</title>${ext}${inside}</svg>`);tiles.push({src,x,y,width:w,height:h});}
 return tiles;
}
export async function design(){assets();composeProps();const art={...original,...bounds,ground:{tiles:buildTiles()},props:[...original.props,...newProps]};write('scripts/bigger-fair/design.json',{...bounds,coast,places,paths,newProps});write('scripts/bigger-fair/proposed-art.json',art);
 const png=await render(art,{k:.13,x:-2500,y:-1800,width:1560,height:1066,home:true,sleepers:false});
 // The design plate is frozen before any production world/art manifest is changed.
 fs.writeFileSync(O+'fair-bigger.png',png);fs.writeFileSync(O+'fair-design-notes.md','# Waddlewish expansion drawing\n\nEight fixed fairground compositions around the untouched original. Wide 285-350 unit promenades, coast loop and open textured lawns. The drawing uses existing fair art plus new vector balloon, bandstand, prize tent, duck booth and tea tables. Authored locally without paid image generation.\n');
 console.log('Drawing locked: fair-bigger.png. '+newProps.length+' authored outer props; production manifests unchanged.');
}
if(process.argv[1]?.endsWith('/design.mjs'))await design();
