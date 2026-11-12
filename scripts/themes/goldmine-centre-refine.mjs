import {writeFileSync,readFileSync} from 'node:fs';
const A='public/pixi-art/themes/goldmine/centre/';
const ink='#39472D',gold='#FFD324',cream='#FFF0B1',wood='#C88941',dark='#885931';
const wrap=(vb,w,h,body,title)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><title>${title}</title>${body}</svg>`;
const path=(d,fill,sw=2.6)=>`<path d="${d}" fill="${fill}" stroke-width="${sw}"/>`;
const rect=(x,y,w,h,fill,r=3)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const ellipse=(x,y,rx,ry,fill,stroke=ink)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}"/>`;
function tower(x,flip=false){
 let s=`<g transform="translate(${x} 140)">`;
 s+=path('M14 90L177 90L174 442L22 442Z',dark);
 s+=rect(25,89,20,353,wood)+rect(146,89,20,353,wood);
 s+=path('M45 130L146 231M146 131L45 232M45 280L146 387M146 281L45 388','none',10);
 s+=path('M45 130L146 231M146 131L45 232M45 280L146 387M146 281L45 388',wood,6);
 for(const y of [72,244]){
  s+=path(`M0 ${y}L180 ${y}L196 ${y+16}L8 ${y+16}Z`,'#E8B666');
  s+=rect(8,y+16,188,18,wood);
  for(const xx of [14,42,70,98,126,154,182])s+=rect(xx,y-30,6,42,'#E6B85C');
  s+=path(`M5 ${y-39}L182 ${y-39}L195 ${y-28}L11 ${y-28}Z`,cream);
 }
 s+=path('M91 73V-100','none',8)+path('M94 -89Q124 -71 158 -82L145 -54Q115 -48 94 -58Z',gold);
 s+=circle(91,-103,7,gold);
 return s+'</g>';
}
function lantern(x,y,k=1){return `<g transform="translate(${x} ${y}) scale(${k})">`+path('M0 -5V21','none',3)+path('M-15 23L15 23L12 58Q0 66 -12 58Z','#FFCE3E')+path('M-20 23Q-15 11 0 10Q15 11 20 23Z',dark)+path('M-6 29V53',cream,4)+rect(-13,60,26,5,dark)+circle(0,10,3,cream)+'</g>';}
function rock(x,y,w,h){return `<g transform="translate(${x} ${y})">`+path(`M0 ${h*.82}Q${w*.04} ${h*.46} ${w*.28} ${h*.12}Q${w*.42} ${-h*.01} ${w*.63} ${h*.08}L${w*.9} ${h*.31}L${w} ${h*.85}Q${w*.58} ${h*1.07} 0 ${h*.82}Z`,'#C69F67')+path(`M0 ${h*.82}L${w*.25} ${h*.43}L${w*.28} ${h*.12}L${w*.63} ${h*.08}L${w*.9} ${h*.31}L${w*.71} ${h*.46}L${w*.25} ${h*.43}`,'#EBC88B')+path(`M${w*.71} ${h*.46}L${w*.66} ${h*.94}`,'none')+'</g>';}
function nugget(x,y,w,h){return `<g transform="translate(${x} ${y})">`+path(`M0 ${h*.6}L${w*.25} ${h*.15}L${w*.59} 0L${w*.95} ${h*.24}L${w} ${h*.8}L${w*.52} ${h}L${w*.1} ${h*.92}Z`,gold)+path(`M0 ${h*.6}L${w*.52} ${h*.54}L${w*.95} ${h*.24}M${w*.52} ${h*.54}L${w*.59} 0M${w*.52} ${h*.54}L${w*.52} ${h}`,cream,3)+'</g>';}
let s='<g transform="translate(-670 -1335)">';
s+=ellipse(645,601,536,37,'#79633D','none').replace('/>',' opacity=".20"/>');
s+=path('M423 390C425 213 529 16 651 7C778 -2 881 211 892 391L858 464L463 464Z',gold,3.4);
s+=path('M429 364C458 194 550 40 653 15C552 36 456 198 442 373Z','#FFF095',0);
s+=path('M766 89C824 188 863 291 868 392L841 447L857 462L891 390C880 269 827 141 766 89Z','#F4AF18',0);
s+=ellipse(617,68,26,25,'#FFF0A3','none')+ellipse(551,140,28,43,'#FFF0A3','none')+ellipse(503,224,13,17,'#FFF0A3','none');
s+=path('M723 55L747 96L724 148L749 177L730 221L699 243L711 282L682 305','none',3);
s+=path('M724 148L685 155L666 180M749 177L782 177L799 193M711 282L751 291L764 315','none',2.4);
s+=tower(187)+tower(917);
s+=path('M415 344L459 374L503 342L549 375L603 340L650 372L706 334L756 370L809 338L855 372L891 352L898 449L861 486L450 486L411 448Z','#F5BC16',3);
s+=path('M426 350L460 379L504 347L550 380L604 345L650 377L706 339L756 375L809 343L855 377L885 357L883 384L855 401L809 370L756 401L706 368L651 403L604 371L550 405L504 371L460 404L426 378Z',gold,2.5);
s+=path('M470 418L838 418L839 577Q646 609 469 577Z','#53452D',3.4);
s+=path('M488 427L518 454L505 571L470 581L470 427Z','#77552E',0);
s+=path('M839 427L798 451L806 571L839 580Z','#77552E',0);
s+=path('M473 423L516 423L516 590L474 590Z',wood,3)+path('M802 423L841 423L841 590L801 590Z',wood,3);
s+=rect(461,397,393,34,wood,6)+rect(466,397,382,9,'#EABD6B',4);
s+=path('M521 433L553 433L519 472M798 433L763 433L798 472',wood,9);
s+=path('M484 449V576M811 451V577M499 404L795 404','none',2);
s+=circle(483,414,5,'#EBC88B')+circle(827,414,5,'#EBC88B');
s+=lantern(541,446,.85)+lantern(766,446,.85);
s+=path('M1100 262L1254 188L1266 206L1107 286Z',wood,3);
s+=path('M1118 277L1150 373L1134 380L1101 283Z',wood,3);
s+=circle(1260,199,12,'#EABD6B')+circle(1260,199,5,dark);
s+=path('M1261 213L1228 324M1261 213L1299 324','none',3);
s+=path('M1210 330L1307 330L1294 378Q1263 392 1222 375Z','#9F9C72',3)+ellipse(1258,329,49,14,'#605A40');
for(const [x,y,w,h]of [[1224,307,28,24],[1248,297,29,28],[1270,309,25,23]])s+=nugget(x,y,w,h);
s+=path('M1210 330Q1255 352 1307 330','none',3);
for(const [x,y,w,h]of [[68,526,89,60],[140,505,99,83],[252,548,85,52],[359,504,100,89],[849,503,90,85],[1031,518,100,75],[1110,549,79,49]])s+=rock(x,y,w,h);
for(const [x,y,w,h]of [[292,481,56,88],[336,544,45,42],[204,556,43,37],[892,479,60,91],[945,532,47,60],[999,564,42,35]])s+=nugget(x,y,w,h);
for(let y=588;y<647;y+=13)s+=path(`M${628-(y-588)*.32} ${y}L${699+(y-588)*.32} ${y}`,'none',9);
s+=path('M633 577L606 653M695 577L724 653','none',7)+path('M633 577L606 653M695 577L724 653','#D1C69A',3);
s+=ellipse(661,579,67,12,'#987334','none');
s+=path('M612 530L708 530L695 571L625 571Z',wood,3)+path('M612 530Q660 548 708 530L704 541Q659 557 616 541Z','#E9B863');
for(const [x,y,r]of [[630,516,14],[652,503,17],[674,511,17],[692,521,12]])s+=circle(x,y,r,gold);
s+=path('M608 531L711 531','none',6)+path('M609 530L710 530','#EBC36D',3);
s+=circle(631,575,10,dark)+circle(690,575,10,dark)+circle(631,575,4,'#D8BE75')+circle(690,575,4,'#D8BE75');
s+=circle(659,556,8,'#F6D276');
s+='</g>';
writeFileSync(A+'mine-landmark.svg',wrap('-670 -1335 1339.8 656.7',1339.8,656.7,s,'Locked cracked golden egg mine, clean vector'));
let cliff='';
function ledge(x,y,w,h,i){return `<g transform="translate(${x} ${y})">`+path(`M0 ${h*.28}Q${w*.01} ${h*.1} ${w*.2} ${h*.04}L${w*.64} 0Q${w*.87} ${h*.04} ${w*.98} ${h*.25}L${w*.91} ${h*.96}Q${w*.54} ${h*1.04} ${w*.06} ${h*.94}Z`,i%2?'#D69539':'#E6A23F',3)+path(`M0 ${h*.28}Q${w*.01} ${h*.1} ${w*.2} ${h*.04}L${w*.64} 0Q${w*.87} ${h*.04} ${w*.98} ${h*.25}L${w*.73} ${h*.39}L${w*.15} ${h*.42}Z`,'#FFD67A',2.8)+path(`M${w*.73} ${h*.39}L${w*.67} ${h*.96}L${w*.91} ${h*.96}L${w*.98} ${h*.25}Z`,'#C68835',0)+path(`M${w*.15} ${h*.42}L${w*.2} ${h*.78}M${w*.48} ${h*.8}L${w*.44} ${h*.95}`,'none',2.4)+'</g>';}
for(let i=0;i<9;i++)cliff+=ledge(-1390+i*307,-1425+Math.sin(i*1.7)*24,355,376,i);
writeFileSync(A+'back-cliff.svg',wrap('-1500 -1490 3000 900',3000,900,cliff,'Terraced rounded sandstone quarry'));
const cliffLayers=[
 {id:'cliff-middle-left',box:[-1490,-1170,990,365],sortY:-810,ledges:[[0,-1490,-1120,400,300],[1,-1140,-1170,412,330],[2,-840,-1080,340,270]]},
 {id:'cliff-middle-right',box:[710,-1130,790,360],sortY:-790,ledges:[[3,710,-1130,390,330],[4,1060,-1120,420,340]]},
 {id:'cliff-front-left',box:[-1450,-885,660,280],sortY:-620,ledges:[[5,-1450,-870,390,250],[6,-1130,-885,330,250]]},
 {id:'cliff-front-right',box:[1000,-880,420,280],sortY:-620,ledges:[[7,1000,-880,410,260]]},
];
for(const layer of cliffLayers){
 const [x,y,w,h]=layer.box;
 writeFileSync(A+layer.id+'.svg',wrap(layer.box.join(' '),w,h,layer.ledges.map(([i,x,y,w,h])=>ledge(x,y,w,h,i)).join(''),'Depth sorted sandstone ledge'));
}
const k=360/470;let paving=ellipse(0,0,1151,1151*k,'#FFE692','#8D854A');
const pp=(r,a)=>[r*Math.cos(a),r*k*Math.sin(a)];
const d=ps=>'M'+ps.map(p=>p.map(n=>n.toFixed(1)).join(' ')).join('L')+'Z';
for(let ring=0;ring<5;ring++){
 let ro=1147-ring*184,ri=Math.max(0,ro-184),n=36-ring*4;
 for(let i=0;i<n;i++){
  const a=(i+.5*(ring%2))*Math.PI*2/n,b=a+Math.PI*2/n;
  const points=[];for(let j=0;j<=10;j++)points.push(pp(ro,a+(b-a)*j/10));for(let j=10;j>=0;j--)points.push(pp(ri,a+(b-a)*j/10));
  paving+=`<path d="${d(points)}" fill="${['#FFE692','#FFF0B8','#FFE9A2','#FADD86'][(i+ring)%4]}" stroke="#BEA763" stroke-width="1.8"/>`;
 }
}
paving+=ellipse(0,0,1148,1148*k,'none','#8D854A');
writeFileSync(A+'decal-paving.svg',wrap('-1155 -885.851 2310 1789.702',2310,1789.702,paving,'Home style concentric sandstone plaza'));
const cc=JSON.parse(readFileSync(A+'centre.json'));
cc.pieces=cc.pieces.filter(p=>!p.id.startsWith('cliff-'));
cc.pieces.find(p=>p.id==='back-cliff').sortY=-1040;
for(const layer of cliffLayers){const [x,y,width,height]=layer.box;cc.pieces.push({id:layer.id,file:layer.id+'.svg',layer:'sorted',x,y,width,height,anchor:{x:0,y:0},at:[x,y],sortY:layer.sortY});}
const mine=cc.pieces.find(p=>p.id==='mine-landmark');mine.provenance='Clean hand-authored SVG interpretation of locked concept 1: cracked golden egg, twin timber towers, mine portal, crane and ore cart.';
cc.placement={plaza:[4100,2910],scale:.82,landmarkScale:1.34,landmarkYOffset:556,threshold:[4100,2909.22],note:'Mine fills the north half of the plaza and faces its paved south yard.'};
writeFileSync(A+'centre.json',JSON.stringify(cc,null,2)+'\n');
console.log('Refined locked Goldmine centre: clean egg mine, rounded quarry, ring paving');
