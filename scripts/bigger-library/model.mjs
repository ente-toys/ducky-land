import fs from 'node:fs';
export const ART='public/pixi-art/themes/library/',DATA='assets/world/themes/library/',OUT='../concepts/themes/world-map/bigger';
export const read=f=>JSON.parse(fs.readFileSync(f));
export const original={world:read('scripts/bigger-library/original/world.json'),walk:read('scripts/bigger-library/original/walk-world.json'),art:read('scripts/bigger-library/original/art.json'),harbor:read('scripts/bigger-library/original/harbor.json')};
export const origin={x:-3000,y:-2200},width=14000,height=10400;
const [l,r]=original.world.coastRings;
// Two enlarged banks retain every original canal edge and both raised crossings.
export const rings=[[
 ...l.slice(0,76),[3480,5600],[3250,6400],[2800,6940],[1600,7100],[100,6930],[-1100,6500],[-2050,5650],[-2370,4500],[-2260,3000],[-2400,1600],[-2160,100],[-1500,-1000],[-300,-1470],[1100,-1570],[2300,-1450],[3350,-1130],[3650,-500],...l.slice(260)
],[...r.slice(0,35),[4400,-500],[4780,-1240],[5900,-1530],[7400,-1440],[8800,-1050],[9800,-200],[10300,1000],[10200,2400],[10400,3700],[10100,5000],[9500,6100],[8500,6840],[7100,7100],[5700,7000],[4600,6560],[4100,5700],...r.slice(220)]];
// Round only the long authored outer-coast segments. Original canal vertices stay exact.
for(let ri=0;ri<rings.length;ri++){const ring=rings[ri],out=[];for(let i=0;i<ring.length;i++){const a=ring[(i-1+ring.length)%ring.length],b=ring[i],c=ring[(i+1)%ring.length],da=Math.hypot(a[0]-b[0],a[1]-b[1]),dc=Math.hypot(c[0]-b[0],c[1]-b[1]);if(da>300&&dc>300){const u=b.map((v,k)=>v+(a[k]-v)*.25),v=b.map((v,k)=>v+(c[k]-v)*.25);for(let j=0;j<=8;j++){const t=j/8;out.push(b.map((b,k)=>(1-t)**2*u[k]+2*(1-t)*t*b+t*t*v[k]));}}else out.push(b);}rings[ri]=out;}
export const pathRing=p=>'M'+p.map(a=>a.join(' ')).join(' L')+' Z';
export const coast=[...rings[0],rings[0][0],rings[1][0],...rings[1],rings[1][0],rings[0][0]];
// Four authored neighbourhoods. Coordinates are design decisions, never scatter rules.
export const places=[
 {id:'quillwick',name:'Quillwick Row',who:'Scholars and mapmakers',x:-650,y:600,spawn:[-650,900]},
 {id:'inkleaf',name:'Inkleaf Fold',who:'Bookbinders and printers',x:8500,y:750,spawn:[8500,1050]},
 {id:'bedtime',name:'Bedtime Burrow',who:'Storytellers and young families',x:-500,y:5050,spawn:[-500,5350]},
 {id:'paperboat',name:'Paperboat Quay',who:'Sailors, translators and travelling booksellers',x:8500,y:5200,spawn:[8500,5500]}
];
export const props=[],obstacles=[],additions={},homes=[];
function custom(name,zone,x,y,w,h,body,foot){const src=`bigger/${name}.svg`;additions[src]=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;const p={id:`bigger-${name}`,name,src,x,y,width:w,height:h,scale:1,anchor:{x:.5,y:1},zone,wind:false};props.push(p);if(foot)obstacles.push({name:p.id,x,y:y-foot[2],rx:foot[0],ry:foot[1]});return p;}
function kit(src,x,y,scale,zone,solid=true,flip=false){const t=original.art.props.find(p=>p.src===src)??(()=>{const text=fs.readFileSync(ART+src,'utf8'),v=text.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);return {src,width:v[2],height:v[3],anchor:{x:.5,y:.98},name:src.slice(0,-4)};})();const p={...t,id:'bigger-'+props.length,name:`${zone} ${t.name}`,x,y,scale,zone,flip,wind:src==='lantern-tree.svg'};delete p.centrePiece;props.push(p);if(solid){const w=t.width*scale;obstacles.push({name:p.id,x,y:y-12,rx:Math.max(18,w*.34),ry:Math.max(12,Math.min(70,w*.15))});}return p;}
const ink='#876139',paper='#fff0be',gold='#edc05f';
// A home contains the porch, window boxes, private garden, mail slot and a side gate.
// All four use Pagepond's book/page motifs, but distinct silhouettes and trades.
function home(id,zone,x,y,type,color,flip=false){
 const variation=Number(id.slice(1))-1;
 const size=type==='family'&&variation===4?1.28:[1.15,1.42,1.17,1.16,1.38,1.20,1.25][variation];
 const wall=['#fff0be','#f6dda5','#f8e9c8','#ead9ae','#f6e5ac','#eadfc0','#f9e7b2'][variation];
 const roofType={scholar:['scholar','binder','scholar','family','scholar','binder','sailor'],binder:['binder','sailor','binder','scholar','sailor','binder','family'],family:['family','scholar','family','binder','family','sailor','family'],sailor:['sailor','binder','sailor','scholar','binder','sailor','family']}[type][variation];
 const roof=roofType==='scholar'?`<path d="M45 153Q114 82 225 108Q336 82 405 153L399 190Q320 144 225 165Q130 144 51 190Z" fill="${color}"/><path d="M63 148Q145 118 220 140M235 140Q310 118 387 148M64 159Q143 128 218 150M236 150Q315 128 385 159" fill="none" stroke="${paper}" stroke-width="3"/><path d="M225 108V165" fill="none"/>`:
 roofType==='binder'?`<path d="M40 152L225 55 410 152V181H40Z" fill="${color}"/><path d="M68 148L225 78 382 148M82 159H370" fill="none" stroke="#f6d98a" stroke-width="5"/><rect x="308" y="57" width="35" height="64" rx="5" fill="#c79064"/><path d="M305 58H347"/>`:
 roofType==='family'?`<path d="M47 164Q45 64 225 71Q405 64 403 164L394 184Q225 148 56 184Z" fill="${color}"/><path d="M73 137Q225 107 377 137M86 111Q225 83 364 111" fill="none" stroke="#f3ce75" stroke-width="5"/><path d="M202 80Q225 62 248 80V122H202Z" fill="${paper}"/><circle cx="225" cy="100" r="12" fill="#8bd1d3"/>`:
 `<path d="M43 158L102 89H347L407 158V182H43Z" fill="${color}"/><path d="M67 151H382M89 127H363M110 103H338" fill="none" stroke="#f8db8a" stroke-width="5"/><path d="M300 91V40L330 51 300 62" fill="#f1cc6d"/>`;
 const windows=[105,290].map(wx=>`<path d="M${wx} 204q23-25 47 0v48h-47Z" fill="#85cbd3"/><path d="M${wx+24} 190v62m-24-27h47" fill="none" stroke="#edc05f" stroke-width="5"/><path d="M${wx-5} 252h57v18h-57Z" fill="#bd7c56"/><path d="M${wx} 254q-9-27 10-16q8-27 20-3q20-13 17 19" fill="#83a941" stroke-width="3"/><circle cx="${wx+10}" cy="239" r="6" fill="#e7898e"/><circle cx="${wx+34}" cy="237" r="6" fill="#f0d66e"/>`).join('');
 let motif=type==='binder'?`<path d="M328 286l15-28 13 28m-29-18h30" fill="none"/><rect x="78" y="278" width="37" height="10" fill="#e29379"/><path d="M82 278v-14h35v14" fill="#9cb8d9"/>`:
 type==='family'?`<path d="M90 288l-8-24 26 5-18 19Z" fill="#e79777"/><circle cx="347" cy="283" r="13" fill="#f4ca60"/>`:
 type==='sailor'?`<path d="M92 267v34m-17-17q17 24 34 0m-23-16h12" fill="none" stroke="#7e9fba" stroke-width="5"/><path d="M333 293h35v-24h-35Z" fill="#c89f62"/>`:
 `<path d="M85 288l13-32 12 33" fill="none"/><path d="M333 282l20-25 8 5-20 25Z" fill="#e9ce82"/>`;
 custom('home-'+id,zone,x,y,450,390,`<g stroke="${ink}" stroke-width="5"><ellipse cx="225" cy="357" rx="204" ry="22" fill="#799c35" opacity=".35"/><path d="M64 176H386V310Q225 337 64 310Z" fill="${wall}"/><path d="M67 294Q225 319 383 294V310Q225 337 67 310Z" fill="#e0bb77"/>${roof}${windows}${variation%3===0?`<path d="M316 113V54h29v70" fill="#c79269"/><path d="M311 54h40" stroke-width="7"/>`:variation%3===1?`<path d="M174 145l50-47 53 47v34H174Z" fill="${wall}"/><circle cx="225" cy="145" r="17" fill="#91cbd0"/><path d="M225 129v32m-16-16h32" stroke-width="3"/>`:`<path d="M64 174h108l-9 45H54Z" fill="${color}"/><path d="M61 219v43m104-43v43" stroke-width="5"/>`}<path d="M190 310v-84q35-43 70 0v84Z" fill="#c48f59"/><path d="M202 308v-78q23-27 46 0v78" fill="#a97d4f"/><circle cx="243" cy="271" r="4" fill="#ffe093"/><path d="M183 314h84l21 18H162Z" fill="#e5c77e"/><path d="M162 332h126v11H162Z" fill="#f7dda0"/>${motif}${variation%2?`<path d="M174 225h103l-9-25h-85Z" fill="${color}"/><path d="M173 226v78m105-78v78" stroke-width="4"/>`:`<path d="M294 310v-22h47v22" fill="#b3bc6c"/><path d="M305 289v-23m22 23v-31" stroke="#789849" stroke-width="5"/>`}<path d="M25 311v43m58-35v42m284-42v42m57-50v43M25 328h118m164 0h117M25 342h118m164 0h117" fill="none" stroke="#c49b60" stroke-width="7"/><path d="M51 304v-32m-19 0h38v-20q-19-18-38 0Z" fill="${color}"/><path d="M40 254h22" stroke="#fff0be" stroke-width="3"/><path d="M340 351q-22-28-31-3q-21-30-31 2m-138 0q-22-28-31-3q-21-30-31 2" fill="#98b84a" stroke-width="3"/><path d="M165 364h120" stroke="#d8c489" stroke-width="8"/></g>`,[156,53,65]);
 const dwelling=props.at(-1);dwelling.scale=size;const solid=obstacles.at(-1);solid.rx=Math.max(182,156*size);solid.ry*=size;solid.y=y-65*size;
 homes.push({id,zone,x,y,type,size,wall,roofType,roofColor:color,detail:variation%3,door:[x,y-27],gate:[x,y+30]});
}
// Individually placed homes follow bends in lanes and leave the shared greens open.
for(const [id,x,y,type,color]of [
 ['q1',-1360,430,'scholar','#bd8bb6'],['q2',-740,120,'scholar','#8eafca'],['q3',-90,70,'scholar','#cf8279'],['q4',430,650,'scholar','#a2bb71'],['q5',-1410,1140,'scholar','#c4a7ce'],['q6',-1180,1770,'scholar','#8baec5'],['q7',-470,1750,'scholar','#d79b70']])home(id,'quillwick',x,y,type,color);
for(const [id,x,y,color]of [['i1',7730,450,'#c78368'],['i2',8350,100,'#b590bc'],['i3',9000,340,'#d89569'],['i4',9490,1120,'#8caebc'],['i5',9280,1840,'#c47b70'],['i6',8830,2310,'#9bab69'],['i7',8210,2390,'#c7a4bb']])home(id,'inkleaf',x,y,'binder',color);
for(const [id,x,y,color]of [['b1',-1410,4750,'#cba2c3'],['b2',-1370,5480,'#e3a66e'],['b3',-790,4280,'#93b1d0'],['b4',-200,4230,'#cba2c3'],['b5',300,4610,'#d99974'],['b6',420,5860,'#9eb96e'],['b7',-280,6120,'#bba0c8']])home(id,'bedtime',x,y,'family',color);
for(const [id,x,y,color]of [['p1',9270,4650,'#85aaba'],['p2',9440,5390,'#ce8f74'],['p3',8890,6090,'#a9af70'],['p4',8180,6350,'#8fa7c6'],['p5',7660,5810,'#bb9ab9'],['p6',7730,5020,'#cf9b75'],['p7',8640,4390,'#8faeae']])home(id,'paperboat',x,y,'sailor',color);
// Workplaces and squares form the social centre of each neighbourhood.
kit('tower-2.svg',-150,280,.78,'quillwick');
kit('shelf-arch.svg',-850,560,.8,'quillwick',false);
obstacles.push({name:'quillwick-arch-west-post',x:-995,y:550,rx:35,ry:24},{name:'quillwick-arch-east-post',x:-705,y:550,rx:35,ry:24});
for(const [x,y]of [[-1100,700],[-250,750]]){kit('book-bench.svg',x,y,.85,'quillwick',true,x>0);kit('open-book.svg',x,y-90,.65,'quillwick',false);}
kit('book-stall-blue.svg',-490,1600,1.15,'quillwick');
custom('mapmakers-table','quillwick',-400,1080,410,210,`<g stroke="${ink}" stroke-width="6"><path d="M47 115v67m312-67v67"/><path d="M20 65Q200 10 390 65V135Q200 173 20 135Z" fill="#c9945f"/><path d="M50 63Q198 23 360 63L344 118Q200 148 68 118Z" fill="${paper}"/><path d="M103 85l30-21 48 30 46-26 53 31 35-24m-111-27v78" fill="none" stroke="#8cabb1" stroke-width="4"/><circle cx="302" cy="80" r="17" fill="none" stroke="#d3aa54"/></g>`,[172,45,40]);
kit('tower-3.svg',8530,400,.78,'inkleaf');
for(const [x,y,src]of [[7980,900,'book-stall-red.svg'],[9000,1550,'book-stall-blue.svg']])kit(src,x,y,1.1,'inkleaf');
custom('binding-press','inkleaf',8500,1420,440,360,`<g stroke="${ink}" stroke-width="7"><path d="M40 300l175 40 185-40v-85l-180 31-180-31Z" fill="#c8955f"/><path d="M40 215l175 31 185-31-180-35Z" fill="#efce7c"/><path d="M80 210V70h32v140m218 0V70h32v140M65 70l160-35 153 35-163 36Z" fill="#d9ab63"/><path d="M219 100v85m-43-53 84-16" fill="none" stroke-width="14"/><path d="M120 210l100 19 98-20-100-20Z" fill="#9eb9d0"/><path d="M120 197l100 19 98-20-100-20Z" fill="${paper}"/><path d="M120 185l100 19 98-20-100-20Z" fill="#c98785"/></g>`,[165,45,30]);
custom('drying-sheets','inkleaf',8090,1790,500,190,`<g stroke="${ink}" stroke-width="5"><path d="M20 180V20m460 160V20m-460 9q220 40 440 0" fill="none"/>${[55,165,275,385].map((x,i)=>`<path d="M${x} 42l80 4-5 109-76-4Z" fill="${paper}"/><path d="M${x+15} 72l49 3m-48 15 40 2m-41 17 48 3" stroke="#ae9970" stroke-width="3"/><path d="M${x+6} 37v15"/>`).join('')}</g>`,null);
// Only the end posts are solid; ducks may walk under the drying line.
obstacles.push({name:'drying-west-post',x:7860,y:1780,rx:12,ry:12},{name:'drying-east-post',x:8320,y:1780,rx:12,ry:12});
kit('lantern-tree.svg',-450,4530,.85,'bedtime');
kit('book-slide.svg',-880,5110,1.1,'bedtime');kit('book-climber.svg',60,5080,1.05,'bedtime');
kit('reading-rug.svg',-410,5500,1.1,'bedtime',false);kit('toy-blocks.svg',-50,5460,.85,'bedtime');
kit('book-stall-red.svg',-1040,5910,1.15,'bedtime');
for(const [x,y,flip]of [[-1100,5340,false],[350,5430,true],[1310,5880,true]])kit('book-bench.svg',x,y,.85,'bedtime',true,flip);
kit('open-book.svg',-370,5490,.65,'bedtime',false);
custom('story-puppet-house','bedtime',240,5190,440,390,`<g stroke="${ink}" stroke-width="6"><path d="M60 130h320v210H60Z" fill="#d3ac75"/><path d="M35 134Q220 30 405 134l-10 37Q220 117 45 171Z" fill="#b59ac6"/><path d="M95 183h250v126H95Z" fill="#f5d694"/><path d="M96 183l78 0-32 91-47 9Zm248 0h-78l32 91 47 9Z" fill="#d78d82"/><path d="M87 309h266v21H87Z" fill="#ecbf6b"/><circle cx="218" cy="252" r="24" fill="#f1cc64"/><path d="M205 274l-24 29h73l-24-29m6-25 25 8-25 9" fill="#e6ac55"/><path d="M99 341h242v17H99Z" fill="${paper}"/></g>`,[166,48,47]);

kit('book-stall-blue.svg',8040,5400,1.2,'paperboat');
kit('book-bench.svg',8800,5510,.85,'paperboat',true,true);
kit('book-pile.svg',9000,5070,.9,'paperboat');kit('open-book.svg',8500,5370,.75,'paperboat',false);
custom('book-freight','paperboat',8550,5100,720,390,`<g stroke="${ink}" stroke-width="6"><path d="M70 168h580v172H70Z" fill="#f1db9b"/><path d="M40 165l85-100h470l85 100v25H40Z" fill="#87a9b7"/><path d="M90 148h540m-511-43h481" stroke="#bed0c9" stroke-width="5"/><path d="M250 340V209h220v131Z" fill="#b4905d"/><path d="M270 225h180v97H270Z" fill="#846d4c"/><path d="M115 242h82v58h-82Zm407 0h82v58h-82Z" fill="#9ecdd0"/><path d="M157 242v58m406-58v58" stroke="#e3bd6f"/><path d="M75 340h580v20H75Z" fill="#d5b878"/><path d="M292 254h94v17h-94Z" fill="${paper}"/><path d="M300 272h94v17h-94Z" fill="#bc8fac"/><path d="M307 290h94v17h-94Z" fill="#a1b279"/><path d="M195 95v-32h28v32" fill="#c9985b"/></g>`,[290,63,47]);
custom('freight-crates','paperboat',9050,5290,270,210,`<g stroke="${ink}" stroke-width="5"><path d="M20 90h130v100H20Zm110 22h120v78H130Z" fill="#c99d63"/><path d="M30 100l110 80m0-80L30 180m110-60 100 60m0-60-100 60" fill="none"/><path d="M45 80h100V64H45Zm8-18h100V47H53Zm8-17h100V30H61Z" fill="${paper}"/><path d="M61 30h100v-8H61Z" fill="#b99bc2"/></g>`,[110,38,24]);
// Fixed pairs and small groups define gardens, lane corners and the edges of commons.
for(const [zone,points]of [
 ['quillwick',[[-1830,430],[-1700,2260],[-300,-960],[2260,-640],[2530,30],[-200,1710]]],
 ['inkleaf',[[5030,-360],[5840,-1020],[7550,-950],[9480,200],[9840,2100],[7840,1400]]],
 ['bedtime',[[-1860,3290],[-1920,5090],[-1250,6050],[1180,6760],[2760,6040],[1330,5440]]],
 ['paperboat',[[9900,3290],[9770,4930],[6200,6870],[4770,5870],[7440,6270]]]
])for(const [x,y]of points)kit('lantern-tree.svg',x,y,.55,zone);
for(const z of places){for(const [dx,dy]of [[-590,270],[570,200]])kit('pencil-lamp.svg',z.x+dx,z.y+dy,.55,z.id);for(const [dx,dy]of [[-590,430],[570,350]])kit('inkwell-planter.svg',z.x+dx,z.y+dy,.5,z.id);}
// Named fingerposts tell the reader what the neighbourhood does.
for(const z of places)custom('sign-'+z.id,z.id,z.x+360,z.y+420,260,180,`<g stroke="${ink}" stroke-width="5"><path d="M125 170V15" stroke-width="10"/><path d="M8 24h215l28 30-28 30H8Z" fill="#e9c573"/><text x="120" y="61" font-family="Georgia" font-size="24" fill="#725735" stroke="none" text-anchor="middle">${z.name.split(' ')[0]}</text><path d="M28 98h180l-20 25H28Z" fill="${paper}"/><path d="M45 110h110" stroke="#a69a6a" stroke-width="3"/></g>`,[13,12,12]);
// Seven authored commons give the space between streets a purpose.
export const commons=[
 {id:'atlas-orchard',name:'Atlas Orchard',x:1930,y:-610,rx:800,ry:290},
 {id:'printer-orchard',name:'Inkfruit Orchard',x:6140,y:-650,rx:720,ry:270},
 {id:'quill-garden',name:'Quill Garden',x:-370,y:3300,rx:580,ry:460},
 {id:'bedtime-picnic',name:'Story Picnic',x:1720,y:5540,rx:650,ry:340},
 {id:'ink-reed-garden',name:'Papermakers Garden',x:8400,y:3500,rx:510,ry:360},
 {id:'quay-common',name:'Translators Green',x:5850,y:6040,rx:700,ry:380},
 {id:'north-reading',name:'Bookmark Green',x:-950,y:-650,rx:410,ry:280}
];
// Fruit trees, benches and work surfaces are fixed small groups within each common.
for(const [x,y] of [[1300,-620],[1780,-730],[2300,-680],[2650,-430],[5400,-640],[5920,-750],[6410,-680],[6810,-520],[-700,3010],[-190,2910],[50,3360],[-650,3670],[1270,5350],[2230,5980],[2230,5490],[7910,3250],[8370,3240],[8790,3460],[5290,5730],[5820,5680],[6290,5900],[-1200,-780],[-760,-900]])kit('lantern-tree.svg',x,y,.48,'commons');
for(const [x,y,flip]of [[1850,-320,false],[6010,-380,true],[-300,3490,true],[1770,5630,false],[8410,3670,true],[5820,6250,true],[-950,-480,false]]){kit('book-bench.svg',x,y,.8,'commons',true,flip);kit('open-book.svg',x+35,y-85,.6,'commons',false);}
kit('reading-rug.svg',1550,5650,.9,'commons',false);kit('toy-blocks.svg',1920,5800,.7,'commons');
kit('inkwell-planter.svg',-650,3480,.7,'commons');kit('inkwell-planter.svg',8740,3670,.7,'commons');
kit('book-pile.svg',6180,6290,.8,'commons');kit('pencil-lamp.svg',5470,6330,.6,'commons');
custom('seed-library','commons',-100,3120,320,300,`<g stroke="${ink}" stroke-width="5"><path d="M45 120h230v135H45Z" fill="${paper}"/><path d="M20 125l140-95 140 95Z" fill="#b7a1c4"/><path d="M75 143h170v79H75Z" fill="#ac8b5d"/><path d="M132 143v79m57-79v79m-114-40h170"/><path d="M96 155v18m60-19v18m61-18v18" stroke="#e8c986" stroke-width="14"/><path d="M155 255v35" stroke-width="10"/></g>`,[110,36,30]);
custom('paper-drying-rack','commons',8280,3460,450,250,`<g stroke="${ink}" stroke-width="5"><path d="M30 220V45m390 175V45M20 55h410M20 155h410" fill="none"/><path d="M55 56l87 6-7 130-82-6Zm122 5 88-2 4 132-87 2Zm123-1 90-5 7 130-90 5Z" fill="${paper}"/><path d="M74 84l47 3m73 1h48m75-2 52-4" stroke="#ceb887" stroke-width="3"/></g>`,[185,35,20]);
custom('translation-table','commons',5850,6000,430,220,`<g stroke="${ink}" stroke-width="5"><path d="M50 130v65m330-65v65"/><path d="M15 75q200-70 400 0v70q-200 55-400 0Z" fill="#cfaa71"/><path d="M65 65l70-20 67 20v65l-67-20-70 20Zm175 0 65-20 65 20v65l-65-20-65 20Z" fill="${paper}"/><path d="M135 45v65m170-65v65"/><path d="M82 78l30-8m-30 27 30-8m145-10 30-9m-30 27 30-8" stroke="#9da884" stroke-width="3"/></g>`,[175,42,30]);
// A quiet fishing/read-aloud perch beside Paperboat Cut.
kit('book-bench.svg',7010,5500,.75,'commons');kit('open-book.svg',7030,5430,.55,'commons',false);
custom('paperboat-fishing-basket','commons',7190,5430,210,220,`<g stroke="${ink}" stroke-width="5"><path d="M35 130q60-30 120 0l-10 65H45Z" fill="#cba36c"/><path d="M50 128q45-80 90 0M45 150h105m-96 24h89m-75-40 7 53m30-55-4 55" fill="none"/><path d="M160 181V25q-40-30-75 2" fill="none"/><path d="M85 27v62" stroke="#a8c4b0" stroke-width="2"/><path d="M62 102l23-17 23 17-23 8Z" fill="${paper}"/></g>`,[68,27,20]);
// Household commons occupy land reclaimed from the outer road circuits.
// Each is placed beside its own residents, with open approaches through the middle.
export const gardenStrips=[
 {zone:'quillwick',x:-1860,y:1230,rx:190,ry:680,color:'#ddbd78'},
 {zone:'inkleaf',x:9700,y:1840,rx:195,ry:460,color:'#d2a77a'},
 {zone:'bedtime',x:-1770,y:5150,rx:170,ry:460,color:'#e2b0a0'},
 {zone:'paperboat',x:9680,y:5000,rx:160,ry:400,color:'#d8c77b'}
];
for(const [zone,x,y]of [['quillwick',-1030,1310],['inkleaf',8870,1730],['bedtime',-850,5740],['paperboat',8290,5860]]){
 custom('shared-pump-'+zone,zone,x,y,170,200,`<g stroke="${ink}" stroke-width="5"><ellipse cx="85" cy="167" rx="70" ry="25" fill="#d9c487"/><path d="M42 143v-41q43-26 86 0v41q-43 28-86 0Z" fill="#dfcf9d"/><ellipse cx="85" cy="103" rx="43" ry="15" fill="#8ac6cc"/><path d="M82 110V32h24v48h28v19h-30v12" fill="#8dabb0"/><path d="M99 35l35-24m-4-5 12 17" stroke-width="8" fill="none"/><path d="M40 120h86m-56-10v22m35 0v21" fill="none" stroke-width="3"/></g>`,[58,25,32]);
}
// Shared laundry, seed shelves and a handcart make the newly joined plots lived-in.
custom('quillwick-washing','quillwick',-1720,510,400,200,`<g stroke="${ink}" stroke-width="5"><path d="M20 188V20m360 168V20M20 35q180 44 360 0" fill="none"/><path d="M62 48l66 9-8 94-63-9Zm115 10h66v92h-66Zm118-4 59-8 10 94-62 9Z" fill="${paper}"/><path d="M80 72l27 4m83 5h39m82-8 24-3" stroke="#9daab5" stroke-width="3"/></g>`,null);
custom('paperboat-handcart','paperboat',9090,5780,230,220,`<g stroke="${ink}" stroke-width="5"><path d="M35 112h150l-20 65H53Z" fill="#ccaa6e"/><path d="M49 106h115V88H49Zm12-20h106V69H61Zm8-19h102V50H69Z" fill="${paper}"/><path d="M53 178l-32-67m145 67 45-96" fill="none"/><circle cx="59" cy="186" r="22" fill="#9cac83"/><circle cx="164" cy="186" r="22" fill="#9cac83"/><path d="M59 169v33m-16-16h33m88-17v33m-16-16h33" fill="none" stroke-width="3"/></g>`,[82,28,25]);
for(const [zone,x,y]of [['quillwick',-1970,2020],['inkleaf',9730,2360],['bedtime',-1610,5680],['paperboat',9650,5480]]){
 kit('inkwell-planter.svg',x,y,.48,zone);
 kit('pencil-lamp.svg',x+100,y-40,.45,zone);
}
// Two short orchard rows reclaim the former northern coastal road.
for(const [zone,x,y]of [['quillwick',220,-1070],['quillwick',760,-1170],['quillwick',1300,-1160],['quillwick',1840,-1060],['inkleaf',6920,-1100],['inkleaf',7460,-1110],['inkleaf',8000,-930],['inkleaf',8540,-700]])kit('lantern-tree.svg',x,y,.46,zone);
kit('book-bench.svg',3090,-135,.65,'commons');kit('open-book.svg',3120,-190,.5,'commons',false);
kit('book-bench.svg',4700,-125,.65,'commons',true,true);kit('open-book.svg',4730,-180,.5,'commons',false);
// One main circuit uses these two banks and the ORIGINAL north/south heart bridges.
// Short lanes branch to front gates, orchards and the preserved river crossings.
// Widths are full world units, comparable to the original heart's walking paths.
export const roads=[
 {id:'west-spine',points:[[3100,650,155],[2350,130,165],[1250,20,165],[-100,330,165],[-650,900,180],[-980,1700,170],[-1132,2539,170],[-1150,2900,165],[-950,4020,170],[-500,5350,180],[650,5950,165],[2000,6130,160],[3000,5400,155],[3000,4900,150]]},
 {id:'east-spine',points:[[4800,700,155],[5050,100,160],[5800,-80,165],[6900,-70,165],[7800,400,170],[8500,1050,180],[9000,2300,165],[9152,2910,170],[9200,3400,165],[9000,4400,170],[8500,5500,180],[7700,6030,165],[6600,6750,170],[5300,6310,160],[4779,5352,170],[4600,4900,150]]},
 {id:'west-north-heart',points:[[-650,900,110],[-350,1500,100],[0,2100,100],[197,2266,100],[700,2600,120]]},
 {id:'west-south-heart',points:[[-950,4020,110],[-500,4300,100],[0,4460,100],[650,4300,120]]},
 {id:'east-north-heart',points:[[8500,1050,110],[8280,1750,100],[7820,2160,100],[7680,2271,100],[7370,2500,120]]},
 {id:'east-south-heart',points:[[9000,4400,110],[8420,4520,100],[7900,4390,100],[7330,4150,120]]},
 {id:'quill-north-lane',points:[[-1410,1170,95],[-1360,610,95],[-740,340,100],[-90,250,95],[430,790,95],[0,1000,100],[-650,900,110]]},
 {id:'quill-south-lane',points:[[-1410,1170,95],[-1180,1920,95],[-470,1900,95],[-350,1500,100]]},
 {id:'binder-north-lane',points:[[7730,600,95],[8350,300,95],[9000,520,95],[9490,1270,95],[9000,1330,100],[8500,1050,110]]},
 {id:'binder-south-lane',points:[[9490,1270,95],[9280,1990,95],[8830,2460,95],[8210,2540,95],[7820,2160,100]]},
 {id:'bedtime-north-lane',points:[[-1370,5630,95],[-1410,4900,95],[-790,4450,95],[-200,4380,95],[300,4760,95],[540,5290,100],[-500,5350,110]]},
 {id:'bedtime-south-lane',points:[[-1370,5630,95],[-280,6270,95],[420,6010,95],[650,5950,110]]},
 {id:'quay-east-lane',points:[[8640,4540,95],[9270,4800,95],[9440,5540,95],[8890,6240,95],[8180,6500,95],[7700,6030,110]]},
 {id:'quay-west-lane',points:[[8180,6500,95],[7660,5960,95],[7490,5550,100],[7730,5170,95],[8040,5590,95],[8500,5500,110]]},
 {id:'harbour',points:[[6600,6750,140],[6600,6970,140]]},
 // Local riverbank rambles retain access to the old outer crossings without a second ring.
 {id:'west-river-bank',points:[[-1132,2539,100],[-1550,2750,95],[-2025,2522,100],[-1980,2150,90],[-1640,1930,90],[-1180,1920,95]]},
 {id:'east-river-bank',points:[[9152,2910,100],[9600,3130,90],[10027,2840,100],[9870,2500,90],[9490,2250,90],[9280,1990,95]]},
 {id:'north-west-coast-link',points:[[3090,-90,100],[3093,396,100],[3100,650,140]]},
 {id:'north-east-coast-link',points:[[4700,-80,100],[4750,390,100],[4800,700,140]]}
];
// The former duplicate outer circuits are now grass, gardens and orchards.
export const coastRoads=[];
export const lanes=roads.map(r=>r.points),promenade=[];
export const harbor={...original.harbor,jetty:{foot:[6600,6850],tip:[6600,7490],width:140},boats:[{x:6430,y:7320,turn:Math.PI},{x:6770,y:7360,turn:Math.PI},{x:6430,y:7590,turn:Math.PI},{x:-2420,y:3400,turn:Math.PI/2},{x:-1700,y:-1080,turn:Math.PI/2},{x:9500,y:-730,turn:-Math.PI/2},{x:10200,y:5050,turn:-Math.PI/2}]};
