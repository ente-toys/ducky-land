// Hand-authored Bellovo centre artwork. Coordinates describe the approved camera,
// with intrinsic canvases at least as large as their world-space placements.
import fs from 'node:fs';
const root='scripts/bigger-cathedral/centre-source/redraw/';
fs.mkdirSync(root,{recursive:true});
const ink='#39472d';
const path=(d,fill,stroke=ink,w=1.7)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const ellipse=(x,y,rx,ry,fill,stroke=ink,w=1.7)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
function svg(file,w,h,W,H,body){fs.writeFileSync(root+file,`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round"><g transform="scale(${W/w} ${H/h})">${body}</g></svg>\n`);}
function flower(x,y,color,s=1){return `<g transform="translate(${x} ${y}) scale(${s})">`+[[0,-2.8],[-2.7,-.8],[-1.7,2.3],[1.7,2.3],[2.7,-.8]].map(([a,b])=>ellipse(a,b,2.7,2.4,color,'#688530',.55)).join('')+ellipse(0,0,1.8,1.6,'#edc447','none')+'</g>';}
// Low living hedges: scalloped leafy crown, a shallow darker face and open lawn.
// The southern planting mirrors inside the bed; the front face always faces down.
for(const south of [false,true]){
 const rim='M35 37 Q25 20 46 19 Q51 4 72 14 Q85 0 105 13 Q124 1 142 13 Q163 0 181 13 Q200 0 219 13 Q240 1 259 13 Q278 0 298 13 Q319 1 338 13 Q359 0 379 13 Q400 1 420 13 Q440 0 457 14 Q477 3 490 20 Q513 11 519 32 Q539 31 536 51 Q554 62 540 80 Q554 97 541 113 Q553 133 536 145 Q546 166 525 174 Q529 197 506 195 Q495 215 476 203 Q457 220 437 207 Q417 221 397 208 Q376 220 357 208 Q337 220 317 208 Q296 221 277 208 Q257 221 237 208 Q217 220 198 207 Q178 220 159 207 Q139 220 120 207 Q100 219 81 205 Q60 216 49 198 Q26 202 25 181 Q6 178 17 157 Q1 142 15 126 Q1 108 16 92 Q2 73 20 62 Q13 44 35 37Z';
 let b=`<g transform="translate(0 10)">${path(rim,'#4f812f',ink,3)}</g>`;
 b+=path(rim,'#76a83e',ink,3);
 b+=path('M58 51 Q156 35 258 49 Q365 34 495 51 Q517 111 495 172 Q390 188 279 177 Q164 190 57 171 Q38 113 58 51Z','#93b72f','#4f812f',3);
 // A soft rounded curl, with small lobes breaking the clipped outline.
 b+=`<g${south?' transform="translate(0 220) scale(1 -1)"':''}>`;
 b+=path('M91 150 Q169 168 244 151 Q292 143 304 113 Q314 65 370 62 Q429 59 453 101 Q475 146 429 160 Q390 173 369 145 Q351 119 377 106 Q399 96 411 117','none',ink,31);
 b+=path('M91 146 Q169 164 244 147 Q292 139 304 109 Q314 61 370 58 Q429 55 453 97 Q475 142 429 156 Q390 169 369 141 Q351 115 377 102 Q399 92 411 113','none','#4f812f',26);
 b+=path('M91 139 Q169 157 244 140 Q292 132 304 102 Q314 54 370 51 Q429 48 453 90 Q475 135 429 149 Q390 162 369 134 Q351 108 377 95 Q399 85 411 106','none','#76a83e',22);
 for(const [x,y]of [[94,139],[122,145],[153,148],[187,148],[218,146],[249,136],[279,121],[299,99],[316,76],[340,61],[369,56],[399,61],[425,75],[446,97],[446,124],[426,143],[399,147],[378,132],[375,110],[397,103]])b+=ellipse(x,y,13,8,'#76a83e','none');
 for(const [x,y]of [[75,72],[101,66],[128,62],[151,63],[181,60],[210,62]])b+=flower(x,y,'#f49bab',1.25);
 for(const [x,y]of [[128,107],[151,94],[175,102],[198,90],[220,100],[244,86]])b+=flower(x,y,'#fff6d9',1.1);
 b+='</g>';
 b+=path('M32 171q8 -8 17 0 M64 195q8 -7 15 0 M114 201q8 -7 15 0 M165 202q8 -7 15 0 M220 202q8 -7 15 0 M281 201q8 -7 15 0 M340 201q8 -7 15 0 M400 202q8 -7 15 0 M460 198q8 -7 15 0 M517 170q8 -7 15 0','none','#76a83e',3);
 svg(south?'hedge-parterre-south.svg':'hedge-parterre.svg',560,230,560,230,b);
}
// Three bowls, their stems and basin are drawn back-to-front. Each rim has
// a visible inner ellipse, shaded bowl wall and pale front lip.
let f=path('M6 131 V152 C6 177 144 177 144 152 V131Z','#f9e4ac');
f+=path('M8 151 C30 169 120 169 142 151 V158 C116 177 34 177 8 158Z','#d8b576','none');
f+=ellipse(75,131,69,27,'#f9e4ac')+ellipse(75,131,60,21,'#d8b576')+ellipse(75,131,56,18,'#46c5ec');
f+=path('M13 138 C35 162 115 162 137 138','none','#fff0c7',4);
for(let x=19;x<126;x+=16)f+=path(`M${x} ${154+9*Math.sqrt(1-((x-75)/69)**2)}q4 -3 8 1q4 4 7 0`,'none','#ab8e53',1.1);
f+=ellipse(75,145,20,7,'#f9e4ac')+path('M66 110 C69 123 65 134 59 141 Q75 150 91 141 C85 134 81 122 84 110Z','#f9e4ac');
f+=path('M77 115L81 136L87 141L77 143Z','#d8b576','none');
function bowl(y,rx,ry,depth){return path(`M${75-rx} ${y} C${75-rx+3} ${y+depth} ${75+rx-3} ${y+depth} ${75+rx} ${y}Z`,'#d8b576')+ellipse(75,y,rx,ry,'#f9e4ac')+ellipse(75,y,rx-6,ry-4,'#46c5ec')+path(`M${76-rx} ${y+2} Q75 ${y+ry+7} ${74+rx} ${y+2}`,'none','#fff0c7',2.3);}
f+=bowl(107,48,18,28);
f+=path('M70 76 C71 86 69 92 65 101 Q75 108 85 101 C81 91 79 85 80 76Z','#f9e4ac');
f+=path('M77 79 L78 98 L82 101 L76 102Z','#d8b576','none');
f+=bowl(72,32,12,21);
f+=path('M71 43 L70 65 Q75 69 80 65 L79 43Z','#f9e4ac');
f+=bowl(39,21,8,15);
f+=path('M72 15 V36 Q75 39 78 36 V15Z','#f9e4ac')+ellipse(75,14,5,3,'#f9e4ac')+ellipse(75,10,3,5,'#f9e4ac');
for(const [x,y,end,dx]of [[38,111,140,-5],[111,111,141,5],[55,75,100,-3],[95,75,100,3],[62,41,63,-2],[88,41,63,2]]){
 f+=path(`M${x} ${y} Q${x+dx} ${y+6} ${x+dx} ${end}`,'none','#d3f6f7',2);
 f+=path(`M${x+dx-4} ${end}q4 4 8 0`,'none','#d3f6f7',1.3);
}
svg('fountain-3tier.svg',150,175,300,320,f);
let l=ellipse(50,106,23,4,'#d18a3c')+path('M24 76 Q25 101 36 106 Q50 111 64 106 Q75 101 76 76Z','#e89a42');
l+=path('M65 79 Q66 97 58 104 L37 106 Q50 111 64 106 Q75 101 76 76Z','#bd7330','none');
l+=ellipse(50,76,27,10,'#e89a42')+ellipse(50,73,25,9,'#f6bf6a')+ellipse(50,73,19,5,'#66542e');
l+=path('M47 74 V44 L36 33 L40 30 L50 42 L61 29 L65 33 L53 48 V74Z','#b47b37');
l+=path('M12 44 Q5 35 14 29 Q9 18 21 17 Q22 7 33 11 Q40 0 49 8 Q59 1 65 11 Q78 6 80 20 Q92 19 89 31 Q100 39 89 47 Q92 58 80 59 Q77 71 65 64 Q54 74 46 66 Q34 72 28 62 Q15 67 15 55 Q4 53 12 44Z','#4f812f');
l+=path('M14 29Q10 20 22 20Q24 11 34 16Q40 6 50 13Q61 7 64 17Q78 11 79 25Q89 24 86 35Q76 33 74 43Q65 37 58 43Q48 36 42 44Q30 37 25 47Q12 42 14 29Z','#7eb23b','none');
for(const [x,y,r]of [[23,34,-25],[41,22,20],[65,24,35],[76,44,-25],[56,47,20],[34,53,-35],[53,60,30]])l+=`<g transform="translate(${x} ${y}) rotate(${r})">${ellipse(0,0,6,8,'#f5d239')}${path('M-2 -3L-1 -5','none','#fff09c',1.4)}</g>`;
l+=path('M26 83 Q50 93 74 83 M32 98 Q50 105 68 98','none','#f6bf6a',2);
svg('lemon-pot.svg',100,112,110,160,l);
// North-south deck: a narrow far approach, a broad raised crown and a
// long near descent. Deep curved cheeks and high rails describe the arch.
let b=path('M54 40H186V67H54Z M42 304H198V333H42Z','#d6bc80');
b+=path('M54 40L64 31H176L186 40Z M42 304L54 294H186L198 304Z','#fff0c7');
b+=path('M66 54 C63 100 33 99 34 148 C35 212 56 251 55 310 L68 310 C65 251 55 216 55 174 C55 132 76 101 77 54Z','#965d30');
b+=path('M174 54 C177 100 207 99 206 148 C205 212 184 251 185 310 L172 310 C175 251 185 216 185 174 C185 132 164 101 163 54Z','#965d30');
b+=path('M68 52 H172 C172 85 190 90 191 132 C192 192 174 251 178 308 H62 C66 251 48 192 49 132 C50 90 68 85 68 52Z','#e7ad59');
b+=path('M49 148 Q120 172 191 148 C190 208 175 263 178 308 H62 C65 263 50 208 49 148Z','#c2863d','none');
const rows=[[59,69,171,1],[74,67,173,2],[89,62,178,4],[102,57,183,7],[113,53,187,9],[123,50,190,11],[133,49,191,12],[145,49,191,13],[160,50,190,14],[179,52,188,13],[201,55,185,11],[226,59,181,8],[254,62,178,5],[283,63,177,2],[304,62,178,0]];
for(const [y,x,X,c]of rows)b+=path(`M${x} ${y}Q120 ${y+c} ${X} ${y}`,'none',ink,1.3);
// The visible front faces of the arch rails are continuous curves, not rods.
for(const right of [false,true]){
 b+=`<g${right?' transform="translate(240 0) scale(-1 1)"':''}>`;
 b+=path('M62 25 C61 40 25 29 25 87 C25 151 53 213 49 277 L57 282 C61 213 35 151 35 91 C35 39 71 44 71 29Z','#e7ad59');
 for(const [x,y,Y]of [[62,43,69],[37,61,110],[30,88,139],[30,119,170],[35,155,206],[44,199,249],[52,241,285]])b+=path(`M${x} ${y}V${Y}`,'none','#965d30',5);
 b+=path('M65 24 C64 39 29 29 29 87 C29 151 57 213 53 277','none',ink,7);
 b+=path('M65 24 C64 39 29 29 29 87 C29 151 57 213 53 277','none','#f2c574',4);
 b+=path('M68 49 C67 83 39 69 39 115 C39 178 62 248 61 300','none',ink,6);
 b+=path('M68 49 C67 83 39 69 39 115 C39 178 62 248 61 300','none','#d79847',3.3);
 b+=path('M59 23H70V69H59Z M48 277H60V313H48Z','#d79847')+ellipse(64.5,23,6,4,'#f2c574')+ellipse(54,277,6,4,'#f2c574');
 b+='</g>';
}
b+=path('M44 322 H196 M60 55H180','none','#a88b50',1.5);
svg('ns-arch.svg',240,340,480,1020,b);
console.log('Wrote five hand-authored redraw sources.');
