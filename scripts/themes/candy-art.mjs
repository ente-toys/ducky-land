import {writeFileSync,mkdirSync} from 'node:fs';
const A='public/pixi-art/themes/candy/';mkdirSync(A+'centre',{recursive:true});
const I='#39472D',cream='#FFF3CB',pink='#F48FA9',blue='#77CFE0',gold='#F4C05C',mint='#A9DDAD',choc='#995632';
const E=(x,y,rx,ry,c,sw=3,s=I)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" stroke="${s}" stroke-width="${sw}"/>`;
const P=(d,c,sw=3,s=I)=>`<path d="${d}" fill="${c}" stroke="${s}" stroke-width="${sw}"/>`;
const R=(x,y,w,h,r,c,sw=3,s=I)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" stroke="${s}" stroke-width="${sw}"/>`;
const line=(d,c=I,sw=3)=>P(d,'none',sw,c);
function svg(name,w,h,body){writeFileSync(A+name+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-linecap="round" stroke-linejoin="round"><title>Candy Coast ${name.replaceAll('-',' ')}</title>${body}</svg>`);}
let seed=12;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
const sprinkles=(x,y,w,h,n=18)=>Array.from({length:n},(_,i)=>{const xx=x+rnd()*w,yy=y+rnd()*h;return line(`M${xx} ${yy} l${i%2?5:-5} 7`,[pink,blue,'#F3C447',mint][i%4],4)}).join('');
function cherry(x,y,r=26){return E(x,y,r,r,'#F46D66')+E(x-r*.28,y-r*.3,r*.2,r*.25,cream,0)+line(`M${x} ${y-r} q-4 -${r*1.6} ${r} -${r*1.4}`,I,5)}
function scoop(x,y,r,c){return P(`M${x-r} ${y+10} C${x-r*1.1} ${y-r*.8} ${x-r*.5} ${y-r*1.2} ${x} ${y-r} C${x+r*.8} ${y-r*1.2} ${x+r*1.15} ${y-r*.45} ${x+r} ${y+10} Q${x+r*.8} ${y+r*.4} ${x+r*.52} ${y+14} Q${x+r*.25} ${y+r*.5} ${x} ${y+16} Q${x-r*.4} ${y+r*.45} ${x-r*.6} ${y+12} Q${x-r*.85} ${y+r*.3} ${x-r} ${y+10}Z`,c)+E(x-r*.3,y-r*.5,r*.3,r*.1,cream,0)}
function cake(w=1000,h=950){let b=E(500,914,456,24,'#7AAE43',0)+E(500,870,445,56,gold)+E(500,845,450,57,cream)+R(150,420,700,425,55,'#F6A1B1',5)+R(700,448,112,369,18,'#E77E99',0);
for(let x=180;x<820;x+=64)b+=line(`M${x} 482 v300`,'#E9819B',4);
b+=P('M120 459 Q90 325 210 306 Q208 190 335 177 Q385 68 510 112 Q654 76 702 193 Q842 194 821 314 Q930 344 880 466 Q850 518 797 466 Q745 530 690 475 Q626 539 569 482 Q502 536 440 480 Q369 532 313 474 Q246 531 198 469 Q145 505 120 459Z',cream,5)+sprinkles(230,225,550,210,38)+cherry(510,104,47);
for(const x of [230,695]){b+=R(x,555,92,164,43,blue,5)+line(`M${x+46} 564 v145 M${x+3} 631 h85`,cream,7)+R(x-15,715,122,28,10,gold,4);}
b+=R(419,594,164,250,77,'#B86E3F',5)+R(435,610,132,222,66,'#D99452',3)+R(459,626,83,82,30,blue,3)+line('M500 628 v79 M462 665 h78',cream,5)+E(551,754,7,7,gold)+R(400,829,200,29,7,cream)+R(381,856,238,28,7,cream)+R(361,883,278,25,7,cream);
b+=R(364,486,272,69,28,cream,4)+`<text x="500" y="533" text-anchor="middle" font-family="Georgia,serif" font-size="40" font-weight="bold" fill="${choc}">Sugar House</text>`+line('M194 381 Q174 340 222 334 M379 187 Q431 131 484 145', '#FFFCDE',12);
return b;}
svg('cupcake',1000,950,cake());
for(const [name,c]of [['pink',pink],['blue',blue],['yellow',gold],['mint',mint]]){
let b=E(152,328,135,13,'#7DAD46',0)+R(33,114,14,206,5,'#B87C46')+R(257,114,14,206,5,'#B87C46')+R(35,207,235,110,8,'#D99452')+R(42,217,220,21,4,cream)+R(55,246,195,52,8,'#E9B66C');
b+=P('M17 103 L50 28 H252 L286 103Z',c,4);for(let i=0;i<7;i++)if(i%2===0)b+=P(`M${50+i*28.8} 29 H${78.8+i*28.8} L${17+(i+1)*38.4} 102 H${17+i*38.4}Z`,cream,0);
for(let i=0;i<7;i++)b+=P(`M${17+i*38.4} 102 h38.4 v17 q-19.2 32 -38.4 0Z`,i%2?c:cream,3);
for(let i=0;i<6;i++){const x=62+i*35;b+=R(x-12,184,25,26,4,gold,2)+scoop(x,179,17,[pink,cream,mint,blue][i%4]);if(i%2===0)b+=E(x,157,4,4,'#F16F65',1)}
b+=R(77,60,149,27,10,cream,2)+`<text x="152" y="80" text-anchor="middle" font-family="Georgia,serif" font-size="17" font-weight="bold" fill="${choc}">CAKES &amp; CONES</text>`+E(66,321,19,19,choc)+E(238,321,19,19,choc)+E(66,321,7,7,gold,2)+E(238,321,7,7,gold,2);svg('stall-'+name,304,348,b);}
let b=E(132,487,72,12,'#709B3B',0)+R(120,207,24,278,10,cream,5)+E(132,136,119,122,pink,5)+E(109,101,67,60,'#FFBCD0',0);
let pts=[];for(let i=0;i<110;i++){let t=i/109*Math.PI*4.9,r=92*(1-i/116);pts.push([132+Math.cos(t)*r,136+Math.sin(t)*r]);}b+=line('M'+pts.map(p=>p.join(' ')).join(' L'),cream,16)+line('M59 69 Q73 42 105 35','#FFE0DF',9);svg('lollipop-tree',264,514,b);
const gum=(x,y,r,c)=>P(`M${x-r} ${y} Q${x-r*.9} ${y-r*1.5} ${x} ${y-r*1.65} Q${x+r*.9} ${y-r*1.5} ${x+r} ${y} Q${x} ${y+r*.34} ${x-r} ${y}Z`,c,3)+E(x-r*.25,y-r*1.03,r*.22,r*.13,cream,0);
b=E(232,300,218,20,'#6C9B37',0)+gum(115,278,96,pink)+gum(329,278,96,mint)+gum(232,292,114,gold);
for(let i=0;i<65;i++){const x=50+rnd()*370,y=160+rnd()*135;b+=E(x,y,1.8,2,'#FFF5C9',0)}svg('gumdrop-planter',464,324,b);
b=R(76,99,26,389,12,cream,5)+P('M89 165 V90 C89 8 182 17 179 89','none',31,I)+P('M89 165 V90 C89 8 182 17 179 89','none',24,cream);for(let y=200;y<480;y+=54)b+=P(`M77 ${y} l24 -17 v22 l-24 17Z`,pink,0);
b+=E(91,483,34,14,choc)+E(177,100,30,39,cream,4)+R(148,125,58,12,5,gold)+E(173,88,10,19,'#FFFCDD',0);svg('candy-lamp',220,508,b);
b=E(230,516,207,26,choc,4)+P('M46 482 L79 179 Q102 68 210 63 Q327 67 359 192 L413 485Z',gold,5);
for(let x=100;x<360;x+=47)b+=line(`M${x} 205 l-28 247`,'#DBA34E',4);
b+=scoop(217,164,151,cream)+P('M193 172 Q246 138 280 189 C290 312 230 422 312 487 Q334 512 366 500 Q264 551 205 492 C140 438 243 271 193 172Z',choc,4)+line('M237 199 C259 302 199 393 259 478','#C3844C',12)+line('M265 207 C282 315 224 402 284 478',cream,5)+E(283,500,86,16,'#C58D52',0)+E(289,496,54,8,cream,0)+sprinkles(110,95,220,72,16)+cherry(210,40,24);svg('falls',448,552,b);
b=E(258,513,247,20,gold,0)+R(30,195,150,230,25,gold,4)+R(334,195,150,230,25,pink,4)+scoop(106,193,88,cream)+scoop(409,193,88,cream)+R(69,249,72,123,32,blue)+R(373,250,72,121,32,blue)+line('M106 253 v113 M72 305 h65 M409 255 v111 M376 306 h65',cream,6)+cherry(106,90,22)+cherry(409,90,22);
b+=P('M116 385 Q200 341 220 393 C235 453 216 473 308 486 L302 516 C169 512 184 439 169 424 Q143 406 116 427Z',pink,4)+line('M132 394 Q176 377 193 413 C208 481 209 488 296 501',cream,5)+line('M242 432 L259 242 H317 L335 432',choc,10)+line('M270 253 v114 M305 253 v114',I,3)+R(261,367,25,10,4,blue)+R(297,367,25,10,4,blue);svg('sugar-playground',516,540,b);
b=E(216,491,184,25,gold)+R(110,310,214,160,34,pink,4)+R(137,355,158,103,18,blue)+P('M91 333 L127 250 H308 L342 333Z',cream,4)+scoop(216,231,106,mint)+scoop(217,151,80,pink)+cherry(217,61,24)+R(146,295,144,39,14,gold,3)+`<text x="218" y="322" text-anchor="middle" font-family="Georgia,serif" font-size="25" font-weight="bold" fill="${choc}">SUNDAES</text>`+R(178,383,74,77,11,cream,3);svg('sundae-kiosk',432,528,b);
b=E(72,480,42,12,gold)+E(452,480,42,12,gold)+P('M72 472 V208 C72 -22 452 -22 452 208 V472','none',51,I)+P('M72 472 V208 C72 -22 452 -22 452 208 V472','none',43,cream)+P('M72 472 V208 C72 -22 452 -22 452 208 V472','none',42,pink).replace('stroke-width="42"','stroke-width="42" stroke-dasharray="31 32"');svg('candy-arch',524,500,b);
b=E(134,374,120,15,gold,0)+R(35,154,198,215,22,'#E9B879',4)+R(61,189,145,114,16,blue,4)+line('M132 194 v105 M65 248 h135',cream,7)+R(54,321,161,39,8,cream)+scoop(134,147,126,cream)+cherry(134,26,20)+sprinkles(62,64,145,60,18);svg('bakery-kiosk',268,400,b);
b=line('M14 20 Q264 218 522 20',I,5);for(let i=0;i<10;i++){const x=25+i*49,y=28+Math.sin(i/9*Math.PI)*91;b+=P(`M${x} ${y} l43 12 -29 61Z`,[pink,cream,mint,blue,gold][i%5],3)}svg('bunting',536,200,b);
b=E(162,462,132,19,'#82AC40',0);for(let i=0;i<5;i++){const x=55+i*51,y=165+Math.sin(i)*55;b+=line(`M162 451 Q${x} 325 ${x} ${y}`,choc,8)+E(x,y,44,48,[pink,blue,mint,gold,cream][i%5],4)+E(x-12,y-17,12,9,cream,0)}b+=R(98,403,130,69,20,gold);svg('bouquets',324,488,b);
const pieces=[],blocked=[];const save=(id,body,box,layer,sortY,extra={})=>{const [x,y,width,height]=box;writeFileSync(A+'centre/'+id+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${box.join(' ')}" stroke-linecap="round" stroke-linejoin="round"><title>Candy Coast ice-cream fountain ${id}</title>${body}</svg>`);pieces.push({id,file:id+'.svg',layer,x,y,width,height,...(sortY==null?{}:{sortY}),...extra});};
let floor=E(0,0,680,405,cream,4,'#CBA66A');
for(const [r,c]of [[.94,pink],[.84,cream],[.67,'#FADBB8'],[.40,cream]])floor+=E(0,0,680*r,405*r,c,3,'#D4B079');
for(let i=0;i<48;i++){let t=i*Math.PI/24;floor+=line(`M${Math.cos(t)*575} ${Math.sin(t)*342} L${Math.cos(t)*635} ${Math.sin(t)*378}`,'#C79070',3);if(i%2===0)floor+=E(Math.cos(t)*650,Math.sin(t)*386,9,7,[pink,blue,mint][i%3],1,'#D4B079')}
for(let r=210;r<=500;r+=85){floor+=E(0,0,r,r*.596,'none',2,'#E0BF8F');for(let j=0;j<24;j++){const a=(j+(r%2)*.5)*Math.PI/12;floor+=line(`M${Math.cos(a)*r} ${Math.sin(a)*r*.596} L${Math.cos(a)*(r+85)} ${Math.sin(a)*(r+85)*.596}`,'#E0BF8F',2)}}save('floor',floor,[-687,-412,1374,824],'decal');
let basin=E(0,28,267,151,pink,4)+E(0,0,269,148,cream,4)+E(0,-5,239,120,blue,4)+E(-25,-20,198,82,'#9BE3E5',0);
for(let i=0;i<5;i++)basin+=E(-160+i*76,-3+Math.sin(i)*34,25,8,'none',3,cream);save('basin-back',basin,[-278,-153,556,340],'sorted',20);
let cone=P('M-103 -353 L0 -48 L103 -353Z',gold,4)+E(0,-353,104,38,'#E9AF54',4);
for(let i=0;i<7;i++){const y=-325+i*38,w=95*(1-i/8);cone+=line(`M${-w} ${y} L${w*.7} ${y+47} M${w} ${y} L${-w*.7} ${y+47}`,'#C18B42',3)}
cone+=scoop(0,-383,139,pink)+scoop(0,-487,107,cream)+sprinkles(-83,-552,165,62,20)+cherry(0,-598,26)+line('M-57 -501 q-15 -27 10 -40','#FFFCE2',8);save('cone',cone,[-150,-660,300,638],'sorted',-16);blocked.push({name:'ice cream basin',ellipse:{x:0,y:0,rx:265,ry:140}});
let jets='';for(const s of [-1,1]){const d=`M${s*75} -78 C${s*145} -326 ${s*241} -235 ${s*214} -30`;jets+=line(d,I,17)+line(d,blue,12)+line(d,cream,3).replace('stroke-width="3"','stroke-width="3" stroke-dasharray="12 19"')+E(s*214,-29,32,10,'none',3,cream)}save('water',jets,[-255,-270,510,265],'anim',27,{animate:{kind:'jet',period:2.4,pivot:[0,-30],reducedMotion:'static stream'}});
let lip=P('M-268 0 A268 148 0 0 0 268 0 L268 34 A268 148 0 0 1 -268 34Z',pink,4)+line('M-267 2 A267 148 0 0 0 267 2',cream,14)+line('M-238 65 Q-213 119 -183 97 Q-155 154 -120 121 Q-76 168 -38 139 Q0 177 39 139 Q81 167 118 121 Q158 150 185 96 Q220 117 240 60',cream,11);save('front-rim',lip,[-279,-10,558,212],'front',153);
for(const side of [-1,1]){
 const x=side*214,y=-29;
 save('ripple-'+(side<0?'left':'right'),E(x,y,28,9,'none',2.5,cream),[x-40,y-17,80,34],'anim',29,{animate:{kind:'ripple',period:1.8,phase:side<0?0:.5,pivot:[x,y],reducedMotion:'static ring'}});
}
const centre={theme:'candy',name:'Candy Coast ice-cream fountain',concept:'concepts/themes/concepts/12-candy.png',placement:{x:3570,y:2737.5,scale:1},depthRatio:.596,pieces,outerEdge:{x:0,y:0,rx:680,ry:405},walkable:[{ellipse:{x:0,y:0,rx:670,ry:395}}],blocked,stairs:[],spawn:[0,450]};writeFileSync(A+'centre/centre.json',JSON.stringify(centre,null,2));
console.log('Candy SVG art and layered centre created');

svg('centre-placeholder',420,560,scoop(210,300,100,pink));

for(const [name,c]of [['strawberry',pink],['pistachio',mint]]){
 let b=E(180,246,169,49,gold)+E(180,236,170,46,cream)+scoop(180,194,132,c)+sprinkles(93,123,170,56,17);
 if(name==='strawberry')b+=cherry(179,70,25);else b+=P('M235 121 L262 8 L279 12 L257 143Z',gold,3)+line('M262 32 l12 4 M257 57 l12 4 M251 83 l12 4',choc,4);
 svg('scoop-'+name,360,300,b);
}
