// Snowdrift's native vector parts. Flat home palette, rounded ink, no raster dependencies.
import {writeFileSync,mkdirSync} from 'node:fs';
export const A='public/pixi-art/themes/snow/';
mkdirSync(A+'detail',{recursive:true});mkdirSync(A+'centre',{recursive:true});
export const INK='#39472D';
export const specs={};
export function save(name,w,h,body,folder='detail/'){
 const src=folder+name+'.svg';writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>Snowdrift ${name}</title><g stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`);specs[name]={src,w,h};return specs[name];
}
const path=(d,fill,stroke=INK,sw=2.5)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const ellipse=(x,y,rx,ry,f,s=INK,sw=2.5)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
const rect=(x,y,w,h,f,r=0,s=INK,sw=2.5)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" stroke="${s}" stroke-width="${sw}"/>`;
// Three hand-shaped pines, all at the scale of home's broadleaf trees.
for(let v=0;v<3;v++){
 const shift=v===1?-10:v===2?12:0;
 let b=path('M136 322 L165 322 L174 415 Q151 422 128 414 Z','#C88941')+path('M154 330 L165 322 L174 415 L154 418 Z','#885931','none');
 const tiers=[[150+shift,18,60,118],[150,84,90,151],[150-shift*.3,164,119,163],[150,250,143,145]];
 for(const [x,y,r,h]of tiers.reverse()){
 b+=path(`M${x} ${y} C${x-r*.25} ${y+30} ${x-r*.49} ${y+h*.5} ${x-r} ${y+h*.79} Q${x-r-8} ${y+h} ${x-r*.55} ${y+h*.98} Q${x-r*.35} ${y+h+14} ${x-r*.1} ${y+h} Q${x+r*.15} ${y+h+18} ${x+r*.4} ${y+h*.97} Q${x+r*.82} ${y+h+7} ${x+r} ${y+h*.78} C${x+r*.49} ${y+h*.5} ${x+r*.25} ${y+30} ${x} ${y} Z`,v===2?'#357748':'#438E51');
 b+=path(`M${x} ${y-5} C${x-13} ${y+10} ${x-r*.4} ${y+h*.42} ${x-r*.81} ${y+h*.63} Q${x-r*.9} ${y+h*.81} ${x-r*.58} ${y+h*.8} Q${x-r*.37} ${y+h*.94} ${x-r*.14} ${y+h*.77} Q${x+r*.05} ${y+h*.98} ${x+r*.3} ${y+h*.78} Q${x+r*.64} ${y+h*.94} ${x+r*.81} ${y+h*.62} C${x+r*.4} ${y+h*.42} ${x+13} ${y+10} ${x} ${y-5} Z`,'#F8FCF1');
 b+=path(`M${x-r*.75} ${y+h*.71} Q${x-r*.44} ${y+h*.87} ${x-r*.18} ${y+h*.73} M${x+r*.12} ${y+h*.79} Q${x+r*.42} ${y+h*.89} ${x+r*.71} ${y+h*.69}`,'none','#B9DADD',2);
 }
 save('pine-'+(v+1),300,425,b);
}
// Snow berries retain the green and red accent visible in the approved drawing.
let bush=path('M6 103 Q-1 69 30 70 Q24 35 61 42 Q74 10 103 38 Q139 15 149 55 Q187 42 193 78 Q215 99 189 111 Q99 133 6 103Z','#3D8B47');
bush+=path('M9 81 Q21 53 40 65 Q46 30 70 49 Q92 16 113 50 Q144 33 153 65 Q184 54 194 82 Q177 98 153 83 Q129 105 106 83 Q77 103 60 82 Q28 101 9 81Z','#FBFCF3');
for(const [x,y]of [[45,81],[56,74],[120,70],[132,77],[164,86]])bush+=ellipse(x,y,5,6,'#D45137',INK,1.6);
save('snow-bush',210,130,bush);
let berry=path('M85 138 Q72 93 84 43 M81 100 L45 62 M82 81 L116 42 M78 117 L127 89 M79 101 L25 96','none','#885931',5);
for(const [x,y]of [[84,39],[43,59],[116,38],[129,85],[22,92],[53,85],[101,63]])berry+=ellipse(x,y,8,10,'#D95740');
berry+=path('M32 139 Q46 121 63 132 Q85 115 111 131 Q140 123 147 141 Q92 155 32 139Z','#FAFCF4');
save('winter-berries',170,160,berry);
save('snow-rock',170,115,path('M10 85 L31 46 L67 31 L93 12 L136 27 L162 78 L141 105 L51 110 Z','#99B7BC')+path('M12 77 L31 46 L67 31 L93 12 L136 27 L150 53 Q130 72 113 58 Q91 82 74 62 Q49 86 12 77Z','#FAFCF2')+path('M113 63 L115 96 L141 105 L162 78 L150 53Z','#7599A4'));
// Cabin has a frontal roof, stacked round logs, amber panes, snow cushions and wood grain.
for(const [name,color]of [['cabin','#B8793B'],['cabin-small','#AC6840']]){
 let b=ellipse(450,650,390,44,'#D5E3DD','none');
 b+=rect(122,292,656,320,color,15);
 for(let y=308;y<610;y+=34){b+=rect(108,y,684,34,y%68?'#CC9857':'#B98040',16);b+=ellipse(126,y+17,15,13,'#E4B66D');b+=ellipse(774,y+17,15,13,'#E4B66D');b+=path(`M153 ${y+13} Q440 ${y+20} 746 ${y+13}`,'none','#99602F',1.3)}
 b+=path('M65 319 L142 235 L383 82 Q450 38 517 82 L758 235 L835 319 L797 359 L450 134 L103 359 Z','#885931');
 b+=path('M64 306 Q103 246 168 216 L392 65 Q449 35 507 65 L738 213 Q804 245 837 304 Q839 328 813 336 Q792 359 765 340 L469 156 Q449 145 429 159 L134 342 Q112 359 88 339 Q58 339 64 306Z','#F9FCF3');
 b+=path('M94 312 L429 119 Q450 107 471 120 L801 311','none','#BAD7D7',7);
 b+=rect(608,77,73,145,'#A7A590',4);for(let y=92;y<206;y+=28)b+=path(`M609 ${y} H681 M${y%56?645:630} ${y} V${y+28}`,'none','#6D796A',2);b+=rect(600,65,90,28,'#FAFCF4',9);
 b+=path('M635 55 C600 31 622 10 649 23 C678 -10 706 17 688 38 Q665 58 635 55Z','#FFF7E6','none');
 for(const x of [203,579]){b+=rect(x-10,343,129,155,'#885931',14)+rect(x,350,110,137,'#FFD66C',12);b+=path(`M${x+55} 351 V487 M${x} 417 H${x+110}`,'none','#885931',8)+rect(x-20,489,149,18,'#FFFCEE',8);b+=path(`M${x+14} 364 L${x+40} 357 L${x+14} 401Z`,'#FFF2B2','none');}
 b+=path('M361 604 L361 373 Q450 305 539 373 L539 604Z','#885931');b+=path('M376 602 L376 380 Q450 326 524 380 L524 602Z','#AD7639');for(let x=396;x<523;x+=25)b+=path(`M${x} 374 V600`,'none','#885931',2);
 b+=ellipse(497,484,7,7,'#F7D06B');b+=ellipse(451,411,35,38,'#3E8A43');b+=ellipse(451,411,20,22,'#AD7639');for(const a of [0,1,2,3,4,5])b+=ellipse(451+Math.cos(a)*28,411+Math.sin(a)*29,5,5,'#D7543A');b+=path('M440 444 L425 467 L450 461 L465 472 L462 444Z','#D95740');
 b+=path('M321 607 L578 607 L613 652 L288 652Z','#CFD2BE')+path('M287 635 H612 L640 667 H263Z','#F6F4DD');b+=path('M287 650 H613 M312 623 H591','none','#A6B7B0',3);
 b+=path('M129 578 Q163 553 188 578 L207 596 H133Z','#F9FCF1')+path('M637 581 Q680 553 719 581 L760 594 H635Z','#F9FCF1');
 b+=path('M229 285 Q450 383 673 285','none','#3F8546',8);for(let x=250;x<670;x+=49)b+=ellipse(x,291+Math.sin((x-229)/444*Math.PI)*48,5,7,['#F5CB65','#E26C42','#F5E6B1'][Math.floor(x/49)%3]);
 save(name,900,700,b);
}
// Igloo courses follow the dome's curvature. Door glow is solid amber, no gradient.
let ig=ellipse(220,285,205,30,'#CEE1E2','none');
ig+=path('M20 259 C18 108 91 28 220 24 C351 26 421 111 422 259 Q219 316 20 259Z','#C0E4E9');
ig+=path('M31 233 C35 105 106 36 220 30 C306 32 369 82 395 162 C277 111 128 166 31 233Z','#F7FCF7','none');
for(const [y,rx]of [[83,93],[137,156],[194,191],[249,201]])ig+=path(`M${220-rx} ${y} Q220 ${y+49} ${220+rx} ${y}`,'none','#7DAEBB',2);
ig+=path('M220 26 V82 M161 40 Q137 123 130 203 M280 41 Q306 126 310 203 M72 136 L86 260 M363 136 L351 260 M220 106 V196','none','#8BB5BE',2);
ig+=path('M157 284 L157 219 Q221 132 284 219 L284 284 Q220 306 157 284Z','#EFFAF4');
ig+=path('M177 285 L177 225 Q222 169 264 225 L264 285Z','#73A7B4');ig+=path('M191 286 L191 230 Q221 193 252 230 L252 286Z','#FFD56B');
ig+=path('M160 247 L179 250 M262 250 L281 247 M182 192 L193 208 M251 194 L242 209','none','#8BB5BE',2.3)+path('M180 279 Q220 264 260 279','none','#FFF4BF',5);
save('igloo',440,320,ig);
// Copper lamps, dressed planters, logs and the tiny life of a winter village.
save('lamp',100,250,ellipse(50,237,35,9,'#B5C7C2','none')+rect(43,77,14,157,'#95683A',4)+path('M32 229 L68 229 L76 240 H24Z','#756F4F')+path('M24 43 H76 L70 91 Q50 109 30 91Z','#FFE19A')+path('M50 12 L18 43 H82Z','#8B693D')+path('M21 37 Q32 19 47 25 Q59 13 77 35 L85 43 H15Z','#F8FBF0')+path('M50 44 V99 M25 49 H76','none','#8B693D',4)+ellipse(50,16,7,8,'#D6B469'));
save('planter',150,150,path('M25 94 H126 L116 140 Q74 155 36 140Z','#C59860')+ellipse(75,94,59,22,'#88623C')+path('M14 85 Q23 54 48 67 Q49 32 79 51 Q104 34 115 65 Q143 58 140 87 Q122 107 100 93 Q76 115 55 96 Q32 110 14 85Z','#398148')+path('M17 77 Q28 48 48 64 Q58 37 82 54 Q109 39 118 70 Q132 61 139 79 Q116 91 99 82 Q73 101 54 84 Q30 94 17 77Z','#FAFCF3')+ellipse(48,86,6,7,'#D6503C')+ellipse(94,82,6,7,'#D6503C')+ellipse(112,88,5,6,'#D6503C'));
save('sled',230,150,path('M19 111 Q7 141 49 140 H203 Q223 137 220 114 M34 110 Q22 133 57 131 H204','none','#885931',8)+path('M41 104 L52 133 M184 103 L191 132','none','#885931',6)+rect(27,61,182,48,'#B8783C',10)+[37,67,97,127,157,187].map(x=>path(`M${x} 63 V107`,'none','#F4C579',3)).join('')+path('M206 67 Q247 41 213 11 Q198 4 190 18','none','#966A38',3));
let logs='';for(const [x,y]of [[29,91],[78,91],[127,91],[52,51],[103,51],[78,15]])logs+=rect(x,y,50,36,'#885931',16)+ellipse(x+25,y+18,24,18,'#D6A65B')+ellipse(x+25,y+18,12,9,'none','#885931',2)+ellipse(x+25,y+18,3,3,'#885931','none');logs+=path('M44 36 Q78 -1 110 32 L140 42 Q118 62 92 45 Q65 59 44 36Z','#FAFCF2');save('log-stack',195,145,logs);
save('snowman',150,235,ellipse(77,182,63,43,'#C8E0DF')+ellipse(69,175,58,44,'#FAFCF4')+ellipse(72,102,40,43,'#FAFCF4')+path('M44 105 L16 84 M112 109 L142 80','none','#885931',5)+path('M61 117 Q77 121 97 113 L100 131 Q80 142 56 130Z','#D95840')+path('M87 133 L105 167 L120 157 L105 126Z','#D95840')+path('M45 77 L43 51 L99 51 L101 77Z','#58775A')+ellipse(73,77,46,10,'#58775A')+ellipse(59,99,3,4,INK,'none')+ellipse(85,99,3,4,INK,'none')+path('M72 104 L98 111 L73 118Z','#EBA34A')+ellipse(70,159,4,4,INK,'none')+ellipse(73,179,4,4,INK,'none'));
for(const [name,color]of [['cocoa-stall','#C9533D'],['skate-stall','#5BA9B5']]){
let s=rect(30,137,240,132,'#BD8746',7)+rect(45,170,210,63,'#E8B96A',5)+path('M25 137 V252 M274 137 V252','none','#885931',10)+path('M13 131 L44 56 H259 L288 131Z','#FFF2CA');
for(let i=0;i<6;i++)s+=path(`M${14+i*45} 132 L${43+i*36} 57 H${61+i*36} L${37+i*45} 132Z`,i%2?color:'#FFF5D5',INK,1.8);
s+=path('M14 128 H288 V146 Q266 162 244 146 Q220 161 198 146 Q174 161 152 146 Q128 162 106 146 Q81 162 60 146 Q33 163 14 146Z',color)+path('M34 64 Q65 37 88 54 Q129 35 154 54 Q191 35 216 54 Q253 38 274 67','none','#F8FCF4',15);
s+=rect(77,183,145,32,'#F7E5AA',5)+`<text x="150" y="205" font-family="sans-serif" font-weight="700" font-size="18" text-anchor="middle" fill="${INK}" stroke="none">${name==='cocoa-stall'?'HOT COCOA':'ICE SKATES'}</text>`;
for(const x of [60,218])s+=rect(x,113,25,25,'#F6D790',4)+path(`M${x+25} 117 Q${x+42} 112 ${x+29} 133`,'none','#885931',3);
save(name,305,285,s);}
// The statue can be replaced independently of the island ground.
save('plinth',630,250,path('M50 113 L315 27 L580 113 L580 181 L315 236 L50 181Z','#B8CCCC')+path('M50 113 L315 27 L580 113 L315 190Z','#F7FCF3')+path('M93 105 L315 45 L538 105 L315 163Z','#DCEBEC')+path('M92 171 Q315 223 539 171 L579 180 L315 236 L50 181Z','#ECF4E9')+path('M51 114 Q87 134 123 123 Q169 147 202 137 Q255 158 315 160 Q367 158 423 138 Q461 150 505 125 Q548 134 580 112','none','#FAFCF2',16),'centre/');
let duck=path('M117 355 Q76 306 108 254 Q90 219 108 171 Q113 112 174 99 Q222 88 261 118 Q307 158 291 218 Q330 261 316 307 Q307 363 246 378 Q160 395 117 355Z','#D4E8E4');
duck+=path('M117 342 Q80 298 118 259 Q106 209 121 171 Q125 123 176 110 Q222 100 255 130 Q288 160 277 216 Q260 249 229 251 Q263 292 241 335 Q196 377 117 342Z','#FBFCF1');
duck+=path('M253 271 Q296 242 320 263 Q336 302 287 329 Q252 325 253 271Z','#EEF7EE');
duck+=path('M109 198 Q61 191 45 216 Q54 245 113 239 L147 226 Q149 209 109 198Z','#E8B64D')+path('M49 217 Q85 227 127 217','none','#997D42',2);
duck+=ellipse(157,180,6,9,INK,'none')+ellipse(229,180,6,9,INK,'none')+ellipse(150,202,11,6,'#F1D6BA','none');
duck+=path('M117 248 Q194 278 279 232 L286 263 Q207 307 117 277Z','#D85B42')+path('M182 281 L197 365 L230 362 L215 280Z','#D85B42');
for(let y=298;y<358;y+=18)duck+=path(`M187 ${y} L224 ${y-3}`,'none','#FFF0C9',8);
duck+=path('M117 139 Q127 50 224 56 Q259 25 286 51 Q309 87 274 108 L275 142Z','#D85B42')+path('M135 106 Q174 66 220 72','none','#F09C6D',11)+ellipse(287,55,25,25,'#F9F9E9')+path('M114 135 Q193 111 279 134 L280 157 Q201 140 114 159Z','#FFF8E2');
save('snow-ducky',380,405,duck,'centre/');
// Small ground marks are clean vectors, deliberately quieter than the standing art.
save('snow-tuft',60,35,path('M5 28 Q14 23 20 27 L19 13 L31 24 L39 8 L42 25 Q52 21 56 28','none','#BAD5D3',2)+path('M8 26 L16 26 M30 28 L36 28','none','#FFFFFF',3));
save('pebbles',60,32,ellipse(14,20,9,5,'#B5CBC8',INK,1.2)+ellipse(40,12,6,4,'#D2DFD9',INK,1)+ellipse(52,25,4,2,'#93B6B8','none'));
save('iceberg',170,110,path('M6 55 L41 24 L100 8 L158 34 L164 74 L128 100 L40 104 L6 82Z','#6ABBD0')+path('M6 55 L41 24 L100 8 L158 34 L119 70 L43 78Z','#F6FCF3')+path('M43 78 L40 104 M119 70 L128 100 M158 34 L164 74','none','#4F9FB7',2));
console.log('Snowdrift vector parts:',Object.keys(specs).length);
