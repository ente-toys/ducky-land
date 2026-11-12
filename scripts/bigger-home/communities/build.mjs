// Home's five authored neighbourhoods. Coordinates use the original B drawing frame.
// Repeated shapes describe construction and surface texture, never scattered buildings.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {inPoly} from '../../../assets/world/island-geometry.mjs';
import {finishProps,finishGround} from '../review-fix/fix.mjs';
import {tightenPlan,villageRoads,sharedGardens,gardenGround} from '../dense/compose.mjs';
const read=p=>JSON.parse(readFileSync(p));
const C=read(new URL('./baseline-C.json',import.meta.url)),P=read(new URL('./plan.json',import.meta.url));
const bridgePlan=structuredClone(P);
tightenPlan(P);
const B=read('scripts/bigger-home-2/baseline-B.json'),E=structuredClone(C);
const D='public/pixi-art/home-communities';mkdirSync(D,{recursive:true});
const K=.18,at=([x,y])=>[(x-278)/K,(y-204)/K],px=([x,y])=>[x*K+278,y*K+204];
const old=read('src/pixi/home-original-world.json').coast.map(px);
E.props=[];E.obstacles=[];E.decks=structuredClone(B.decks);E.walkways=structuredClone(B.walkways);
// Keep the working southern pier, its walkways and the east swan-cove harbour.
E.decks.push(...C.decks.slice(B.decks.length));E.walkways.push(...C.walkways.slice(B.walkways.length));
E.places=[];E.communities=[];E.version='communities';
const assets=read('assets/manifest.json').assets;
function curve(p,close=true){let d=`M${p[0]}`;for(let i=0;i<(close?p.length:p.length-1);i++){const b=p[i],c=p[(i+1)%p.length],a=i?p[i-1]:close?p.at(-1):b,e=p[i+2]??(close?p[(i+2)%p.length]:c);d+=`C${b[0]+(c[0]-a[0])/6},${b[1]+(c[1]-a[1])/6} ${c[0]-(e[0]-b[0])/6},${c[1]-(e[1]-b[1])/6} ${c}`;}return d+(close?'Z':'');}
function svg(name,w,h,body){writeFileSync(`${D}/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="#885931" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`);}
function put(src,name,x,y,w,h,scale,zone,foot){const[wx,wy]=at([x,y]);const p={id:`bigger-community-${E.props.length}`,name,asset:name,src,x:wx,y:wy,width:w,height:h,scale,anchor:{x:.5,y:1},resolution:1.25,zone};if(foot)p.footprint={x:wx,y:wy-(foot[2]??10),rx:foot[0],ry:foot[1]};E.props.push(p);return p;}
function custom(name,x,y,w,h,zone,foot,scale=1){return put(`/pixi-art/home-communities/${name}.svg`,name,x,y,w,h,scale,zone,foot);}
function kit(name,x,y,s,zone,foot){const a=assets.find(a=>a.name===name);if(!a)throw Error(name);const p=put(`/pixi-art/detail/${a.file.slice(7).replaceAll('/','--')}`,name,x,y,a.size.width,a.size.height,s,zone,foot);p.anchor={x:a.anchor.x/a.size.width,y:a.anchor.y/a.size.height};return p;}
function reuse(name,x,y,zone,foot){const source=C.props.find(p=>p.asset===name);if(!source)throw Error(name);return put(source.src,name,x,y,source.width,source.height,source.scale,zone,foot);}
function plant(kind,x,y,zone,s=1){const dim={'tree-3':[300,380],'tree-4':[200,280],'bush-1':[130,100],'bush-2':[168,110],'flower-1':[48,36],'flower-2':[48,36]},[w,h]=dim[kind];return put(`/pixi-art/plants/${kind}.svg`,kind,x,y,w,h,s,zone);}
const bench=(x,y,z)=>kit('bench-wood',x,y,.18,z,[70,24,10]);
const lamp=(x,y,z)=>kit('lamp-lantern',x,y,.113,z,[13,13,5]);
const planter=(x,y,z)=>kit('planter-flowers',x,y,.13,z,[38,19,8]);
// Five distinct Home families: pitched bakery row, gardeners' cottages, low farmhouses,
// skylit makers' studios, and weatherboard fishing cottages. Fronts face the walking lanes.
const homes={townhouse:['#f16e4b','#fff0c7',610,610],cottage:['#ffcf50','#fff0c7',540,510],farmhouse:['#d58b49','#f9e8b2',640,470],studio:['#b2b7dc','#f9e8b2',590,490],'fisher-cottage':['#6ec9de','#b5d9d0',570,470]};
for(const [type,[roof,wall,w,h]]of Object.entries(homes)){
 const tall=type==='townhouse',top=tall?210:170,bottom=h-55,doorX=w*.5;
 let art=`<ellipse cx="${w/2}" cy="${h-23}" rx="${w*.44}" ry="19" fill="#7b9633" opacity=".18" stroke="none"/><path d="M${w*.73} 50V145H${w*.79}V48Z" fill="#e4c567"/><ellipse cx="${w*.76}" cy="49" rx="22" ry="9" fill="#fff0c7"/><path d="M45 ${top}H${w-45}V${bottom}H45Z" fill="${wall}"/><path d="M${w-100} ${top}H${w-45}V${bottom}H${w-100}Z" fill="#e4c567" stroke="none"/><path d="M20 ${top+12}L${w/2} 62L${w-20} ${top+12}L${w-53} ${top+36}L${w/2} 97L53 ${top+36}Z" fill="${roof}"/><path d="M30 ${top+7}L${w/2} 73L${w-30} ${top+7}" fill="none" stroke="#fff0c7" stroke-width="7"/>`;
 for(const f of [.2,.35,.5,.65,.8])art+=`<path d="M${w/2+(f-.5)*w*.42} ${90+Math.abs(f-.5)*62}L${30+f*(w-60)} ${top+6}" fill="none" stroke="#fde48c" stroke-width="3" opacity=".65"/>`;
 if(tall)for(const x of [117,w-183])art+=`<path d="M${x} 257V215Q${x+33} 183 ${x+66} 215V257Z" fill="#6ec9de"/><path d="M${x+33} 200V256 M${x} 231H${x+66}" stroke="#fff0c7" stroke-width="7"/>`;
 if(type==='studio')art+=`<path d="M198 104L297 66L384 109L297 144Z" fill="#a4d9cd"/><path d="M296 68V141 M243 86L341 124 M248 124L343 87" stroke="#fff0c7" stroke-width="6"/>`;
 if(type==='fisher-cottage')for(let y=top+52;y<bottom;y+=30)art+=`<path d="M47 ${y}H${w-48}" stroke="#9fc9bd" stroke-width="3"/>`;
 art+=`<path d="M${doorX-40} ${bottom}V${bottom-135}Q${doorX} ${bottom-172} ${doorX+40} ${bottom-135}V${bottom}Z" fill="#c88941"/><path d="M${doorX-28} ${bottom-5}V${bottom-130}Q${doorX} ${bottom-154} ${doorX+28} ${bottom-130}V${bottom-5}Z" fill="#e5ae63"/><circle cx="${doorX+22}" cy="${bottom-66}" r="5" fill="#885931"/>`;
 for(const x of [86,w-163])art+=`<path d="M${x} ${bottom-88}V${bottom-164}Q${x+38} ${bottom-200} ${x+76} ${bottom-164}V${bottom-88}Z" fill="#6ec9de"/><path d="M${x+38} ${bottom-183}V${bottom-90} M${x+3} ${bottom-139}H${x+72}" stroke="#fff0c7" stroke-width="7"/><path d="M${x-8} ${bottom-88}H${x+85}V${bottom-67}H${x-8}Z" fill="#c88941"/><path d="M${x-5} ${bottom-91}q9-31 25-12q18-35 34-9q21-23 33 21" fill="#4aa539" stroke="#3f8736" stroke-width="3"/><g fill="#f29bb7" stroke="#fff0c7" stroke-width="2"><circle cx="${x+12}" cy="${bottom-110}" r="8"/><circle cx="${x+47}" cy="${bottom-119}" r="9"/><circle cx="${x+73}" cy="${bottom-107}" r="7"/></g>`;
 art+=`<path d="M${doorX-64} ${bottom+7}H${doorX+64}L${doorX+82} ${bottom+35}H${doorX-82}Z" fill="#d6bd79"/><path d="M${doorX-71} ${bottom+21}H${doorX+71}" stroke="#fff0c7" stroke-width="5"/><path d="M${doorX-70} ${bottom-178}H${doorX+70}L${doorX+82} ${bottom-150}H${doorX-82}Z" fill="${roof}"/><path d="M${doorX-68} ${bottom-149}V${bottom-2} M${doorX+68} ${bottom-149}V${bottom-2}" stroke="#c88941" stroke-width="7"/>`;
 if(type==='farmhouse')art+=`<path d="M65 ${top+43}V${bottom-20}L189 ${top+43} M575 ${top+43}V${bottom-20}L451 ${top+43} M70 ${top+44}H570" fill="none" stroke="#c88941" stroke-width="9"/><path d="M278 110L319 86L360 110V145H278Z" fill="#fff0c7"/><path d="M302 119H335 M302 130H335" stroke="#c88941" stroke-width="5"/>`;
 if(type==='farmhouse')art+=`<path d="M66 ${bottom-17}H182 M388 ${bottom-17}H566" stroke="#c88941" stroke-width="7"/>`;
 svg(type,w,h,art);
}
svg('mailbox',105,170,`<path d="M45 163V73H60V163Z" fill="#c88941"/><path d="M13 80V39Q46-3 81 39V80Z" fill="#6ec9de"/><path d="M30 80V43Q54 17 77 43V80Z" fill="#a4d9cd"/><path d="M48 53H67 M81 35V6H100V22H83" fill="none" stroke="#f16e4b" stroke-width="6"/><path d="M16 84H87" stroke="#885931" stroke-width="8"/>`);
svg('washing-line',450,230,`<path d="M20 218V18 M429 218V18" stroke="#c88941" stroke-width="10"/><path d="M20 35Q225 99 429 35" fill="none" stroke="#885931" stroke-width="3"/><path d="M64 47L91 54L105 85L89 91V155L53 152V89L37 83Z" fill="#fff0c7"/><path d="M155 68L205 73L199 158L144 154Z" fill="#6ec9de"/><path d="M247 75L292 73L306 106L291 113L282 169L242 168L237 112L223 106Z" fill="#f29bb7"/><path d="M344 62L389 52L397 145L350 151Z" fill="#fff0c7"/><path d="M72 49V64 M162 68V82 M275 74V89 M379 54V70" stroke="#c88941" stroke-width="5"/>`);
svg('garden-gate',390,120,`<path d="M12 35H140 M248 35H378 M12 77H140 M248 77H378" stroke="#fff0c7" stroke-width="12"/><path d="M23 111V17L34 5L45 17V111 M76 111V17L87 5L98 17V111 M125 111V17L136 5L147 17V111 M244 111V17L255 5L266 17V111 M295 111V17L306 5L317 17V111 M346 111V17L357 5L368 17V111" fill="#fff0c7" stroke="#c5b47c" stroke-width="3"/>`);
svg('herb-box',260,125,`<path d="M12 54L204 17L247 67L54 108Z" fill="#885931"/><path d="M12 54V73L54 124V108 M54 108V124L247 85V67" fill="#c88941"/><g fill="#4aa539" stroke="#3f8736" stroke-width="3"><path d="M40 54q-14-37 9-24q13-39 26-7q29-21 23 20Z M101 44q-13-37 9-24q15-35 29-4q23-24 22 14Z M167 32q-13-31 8-21q14-30 26-3q23-16 20 11Z"/></g>`);
svg('pottery-bench',410,300,`<path d="M37 155V278 M359 146V270 M38 234H359" stroke="#c88941" stroke-width="14"/><path d="M17 127L339 101L394 150L58 181Z" fill="#e4c567"/><path d="M65 119Q43 95 69 69L64 51H107L103 71Q132 103 111 119Z M149 107Q126 74 153 48L149 28H192L188 49Q221 83 198 107Z" fill="#d58b49"/><path d="M261 101Q246 75 267 55H295Q317 75 301 99Z" fill="#6ec9de"/><path d="M66 84H110 M151 66H193" stroke="#fff0c7" stroke-width="5"/><ellipse cx="226" cy="230" rx="47" ry="17" fill="#c88941"/><path d="M225 230V275" stroke-width="10"/><path d="M246 139L313 127" stroke="#fff0c7" stroke-width="9"/>`);
svg('easel',220,300,`<path d="M108 26L34 285 M108 26L185 285 M108 50L132 275" fill="none" stroke="#c88941" stroke-width="12"/><path d="M37 48H186V207H37Z" fill="#fff0c7"/><path d="M42 164Q79 99 111 154Q143 97 181 156V199H42Z" fill="#93b72f" stroke="none"/><ellipse cx="103" cy="132" rx="28" ry="19" fill="#ffcf50"/><path d="M122 128L142 138L123 143" fill="#f16e4b"/><circle cx="117" cy="126" r="3" fill="#39472d"/><path d="M24 215H199" stroke="#c88941" stroke-width="10"/>`);
svg('boat-mender',650,410,`<path d="M54 277Q323 407 598 277L544 171Q328 255 110 171Z" fill="#c88941"/><path d="M110 171Q327 92 544 171Q327 254 110 171Z" fill="#e4c567"/><path d="M151 167Q327 119 502 167Q328 219 151 167Z" fill="#fff0c7"/><path d="M182 165H472 M236 149V199 M328 137V209 M421 148V197" stroke="#c88941" stroke-width="9"/><path d="M169 321L148 387 M477 321L498 387 M119 388H184 M463 388H526" stroke="#885931" stroke-width="12"/><path d="M51 184L30 60L121 45 M601 180L620 60L532 46" fill="none" stroke="#c88941" stroke-width="9"/><path d="M50 76Q326-22 603 76" fill="none" stroke="#885931" stroke-width="3"/><path d="M149 64L179 139 M195 53L211 132 M433 54L409 134 M478 67L451 143" stroke="#6ec9de" stroke-width="10"/>`);
svg('net-rack',400,300,`<path d="M21 286V21 M378 286V21 M21 49H378" stroke="#c88941" stroke-width="11"/><path d="M41 54Q201 98 357 54L321 218Q196 254 71 218Z" fill="#ddd29b" fill-opacity=".5"/><g fill="none" stroke="#acaa6c" stroke-width="3"><path d="M55 74L325 213 M49 111L271 229 M61 157L212 241 M99 61L341 179 M162 77L350 135 M229 80L355 97 M340 72L76 212 M353 109L128 229 M342 152L183 241 M294 76L65 172 M231 82L54 133 M170 78L48 99"/></g><ellipse cx="190" cy="272" rx="69" ry="20" fill="#e4c567"/><ellipse cx="190" cy="269" rx="48" ry="11" fill="none"/>`);
function sign(name,label){svg(name,440,210,`<path d="M208 203V58H229V203Z" fill="#c88941"/><path d="M17 23Q213 8 416 25L425 104Q219 125 15 105Z" fill="#c88941"/><path d="M29 30Q210 20 403 32" fill="none" stroke="#e4c567" stroke-width="4"/><text x="220" y="76" font-family="Arial" font-weight="bold" font-size="29" text-anchor="middle" fill="#fff0c7" stroke="none">${label}</text>`);}
for(const c of P.communities)sign('sign-'+c.id,c.name);
const flowers=(x,y,z)=>{plant('flower-1',x,y,z,1.4);plant('flower-2',x+9,y+3,z,1.4);plant('flower-1',x+17,y-2,z,1.3);};
for(const c of P.communities){
 const homeIds=[];
 for(const [i,[x,y,type]]of c.homes.entries()){
  const[, ,w,h]=homes[type],home=custom(type,x,y,w,h,c.id,[w*.40,48,45]);home.communityRole='home';homeIds.push(home.id);
  // Separate garden furniture preserves the lane through the gate's centre.
  const gate=custom('garden-gate',x,y+18,390,120,c.id);for(const dx of [-118,118])E.obstacles.push({x:gate.x+dx,y:gate.y-12,rx:64,ry:12});
  custom('mailbox',x+43,y+15,105,170,c.id,[20,13,4]);
  custom('herb-box',x-44,y-5,260,125,c.id,[95,25,12],.8);
  flowers(x+43,y-3,c.id);plant(i%2?'bush-1':'bush-2',x-47,y+16,c.id,.9);
  const line=custom('washing-line',x+(i%2?64:-64),y+3,450,230,c.id,null,.65);for(const dx of [-133,133])E.obstacles.push({x:line.x+dx,y:line.y-10,rx:8,ry:10});
  if(i%2===0)bench(x+48,y+25,c.id);
 }
 E.communities.push({id:c.id,name:c.name,residents:c.residents,homes:homeIds,center:at(c.center),green:c.green.map((v,i)=>i<2?at(c.green.slice(0,2))[i]:v/K),workplaces:[]});
 custom('sign-'+c.id,c.center[0]-105,c.center[1]+75,440,210,c.id,[12,12,4]);
 const [cx,cy]=c.center;bench(cx-65,cy+37,c.id);bench(cx+66,cy+42,c.id);lamp(cx-102,cy+37,c.id);lamp(cx+105,cy+24,c.id);
 planter(cx-76,cy-2,c.id);planter(cx+80,cy+11,c.id);
}
const work=(id,p)=>{p.communityRole='workplace';E.communities.find(c=>c.id===id).workplaces.push(p.id);return p;};
// Bakers live above the warm market lane. Bread goes from ovens to counter to delivery bicycle.
work('butterbill',kit('bakery',156,185,.27,'butterbill',[188,64,42]));work('butterbill',kit('cafe',269,195,.27,'butterbill',[177,62,40]));
for(const[x,y]of [[146,256],[231,293],[164,309]]){kit('umbrella-cafe',x,y,.17,'butterbill',[14,13,12]);kit('picnic-table',x,y+12,.14,'butterbill',[75,30,14]);}
kit('sign-bakery',111,224,.13,'butterbill',[30,15,8]);kit('cycle-rack',334,272,.18,'butterbill',[69,19,5]);kit('bin-recycling',99,279,.12,'butterbill',[25,20,8]);reuse('flour-sacks',127,197,'butterbill',[83,26]);
// Gardeners share a nursery, potting tables and children's green, with the gazebo as their meeting place.
work('lanternleaf',reuse('gazebo',790,170,'lanternleaf'));work('lanternleaf',reuse('pergola',903,188,'lanternleaf'));
for(const[x,y]of [[761,163],[819,163],[875,187],[930,187]]){const[wx,wy]=at([x,y]);E.obstacles.push({x:wx,y:wy,rx:13,ry:13});}
work('lanternleaf',reuse('garden-workbench',671,208,'lanternleaf',[130,33]));reuse('garden-wheelbarrow',697,245,'lanternleaf',[97,34]);reuse('garden-water-butt',927,222,'lanternleaf',[53,25]);
reuse('sandbox',843,240,'lanternleaf',[130,45,22]);
for(const[x,y]of [[738,203],[761,218],[849,213],[869,201],[885,218]]){custom('herb-box',x,y,260,125,'lanternleaf',[95,25,12],.8);flowers(x-12,y-5,'lanternleaf');}
// Farmers have a true hamlet: mill court, orchard beside the cider shed, allotments and their own market.
work('clovercrust',reuse('windmill',1340,126,'clovercrust',[105,55,28]));
work('clovercrust',kit('stall-fruit',1260,259,.22,'clovercrust',[148,38,12]));work('clovercrust',kit('stall-bread',1372,265,.22,'clovercrust',[148,38,12]));
work('clovercrust',reuse('glasshouse',1447,233,'clovercrust',[180,68,37]));
for(const[n,x,y]of [['raised-bed-1179',1185,195],['raised-bed-1208',1217,223],['raised-bed-1254',1250,206]])work('clovercrust',reuse(n,x,y,'clovercrust',[115,28,15]));
for(const[n,x,y]of [['apple-tree-1589',1514,242],['apple-tree-1696',1570,266],['apple-tree-1664',1517,296],['apple-tree-1558',1575,320]])reuse(n,x,y,'clovercrust',[31,22,9]);
reuse('orchard-ladder',1537,275,'clovercrust',[48,17,6]);reuse('flour-sacks',1383,142,'clovercrust',[83,26]);reuse('garden-wheelbarrow',1460,283,'clovercrust',[97,34]);kit('bunting',1322,271,.31,'clovercrust');
// Makers' studios circle the pottery yard. The pond and bandstand are shared work and gathering places.
work('petalpatch',custom('pottery-bench',116,881,410,300,'petalpatch',[155,39,20]));
work('petalpatch',custom('easel',218,879,220,300,'petalpatch',[60,28,8]));custom('easel',266,925,220,300,'petalpatch',[60,28,8]);
work('petalpatch',reuse('gazebo',234,963,'petalpatch',[158,58,34]));
reuse('amphi-inner',237,998,'petalpatch',[280,22,40]);reuse('amphi-middle',238,1026,'petalpatch',[360,22,40]);
work('petalpatch',reuse('garden-workbench',25,595,'petalpatch',[130,33]));
for(const[x,y]of [[-7,558],[11,567],[32,580],[52,596],[73,609]]){custom('herb-box',x,y,260,125,'petalpatch',[95,25,12]);flowers(x,y-4,'petalpatch');}
for(const[x,y,s]of [[285,856,.22],[403,847,.2],[378,867,.13]])kit('lily-pad-flower',x,y,s,'petalpatch');
// Reedwhistle's boats are built in the central yard, repaired under hanging nets, then launched from the pier.
work('reedwhistle',custom('boat-mender',1365,1020,650,410,'reedwhistle',[225,60,34]));
work('reedwhistle',custom('net-rack',1182,1006,400,300,'reedwhistle',[14,12]));
work('reedwhistle',reuse('lighthouse-point',1494,934,'reedwhistle',[101,52,33]));
work('reedwhistle',reuse('fishing-tackle',1054,1185,'reedwhistle',[95,28,12]));
kit('pond-house',972,1181,.22,'reedwhistle',[134,46,24]);kit('buoy-red',1022,1193,.16,'reedwhistle',[17,15,5]);kit('bollard',1041,1200,.14,'reedwhistle',[22,18,5]);
kit('rowboat',1012,1277,.22,'reedwhistle');kit('rowboat',1150,1267,.19,'reedwhistle');
// Keep the two leisure swans and the working harbour in the same inlet.
for(const p of B.props.filter(p=>p.asset.startsWith('swan-')))E.props.push(structuredClone(p));
// Fixed tree groups frame the homes and lanes. Commons between communities remain clear.
for(const[z,list]of [
['butterbill',[['tree-3',-3,145],['tree-4',397,235],['tree-3',176,96],['tree-4',45,408],['bush-2',197,410]]],
['lanternleaf',[['tree-3',523,164],['tree-4',630,74],['tree-3',916,66],['tree-4',1038,190],['tree-3',676,272],['bush-2',875,251]]],
['clovercrust',[['tree-3',1158,124],['tree-4',1495,119],['tree-4',1614,236],['tree-3',1218,369],['tree-4',1585,380]]],
['petalpatch',[['tree-3',119,680],['tree-4',15,847],['tree-3',307,791],['tree-4',41,989],['tree-3',370,1084],['tree-4',479,1037]]],
['reedwhistle',[['tree-3',1057,932],['tree-4',1342,923],['tree-4',1515,999],['tree-3',1112,1142],['tree-4',1432,1153]]],
['commons',[['tree-4',428,187],['tree-3',1102,272],['tree-4',525,1128],['tree-3',-28,470],['tree-4',1470,699],['tree-3',1569,804],['tree-4',718,1133]]]
])for(const[k,x,y]of list){if(inPoly(...at([x,y]),C.coast))plant(k,x,y,z,1.05);}
for(const[x,y]of [[273,456],[429,302],[710,265],[1260,386],[1231,455],[1290,695],[1140,845],[942,1013],[759,1046],[562,1069],[436,931],[295,696],[-18,682],[513,1201],[825,1198],[1522,731],[1534,919],[382,70],[1080,47]]){flowers(x,y,'verges');plant('bush-1',x-19,y+7,'verges',.9);}
for(const[x,y]of [[-58,332],[387,103],[1052,44],[1577,374],[1602,713],[1512,1056],[829,1197],[472,1191],[-18,1007]])lamp(x,y,'coast-walk');
for(const[x,y]of [[388,244],[1168,280],[1527,749],[759,1106],[505,1089],[-31,718]])bench(x,y,'commons');
finishProps({E,D,svg,custom,kit,reuse,plant,bench,flowers,at});
sharedGardens({E,D,svg,custom,kit,reuse,plant,bench,flowers,at});
// Original dry land is covered by the untouched original SVGs. New terrain has no old expansion ring.
const coast=C.coast.map(px),cd=curve(coast);
let g=`<defs><clipPath id="community-land"><path d="${cd}"/></clipPath><pattern id="home-grass" width="149" height="123" patternUnits="userSpaceOnUse"><g fill="none" stroke="#4d963c" stroke-width=".8" opacity=".6"><path d="M8 18l-3-3m3 3l2-5m-2 5l5-2 M68 8l-2-4m2 4l3-3 M118 30l-3-2m3 2l1-5m-1 5l4-1 M39 49l-2-3m2 3l2-5m-2 5l5-2 M95 62l-2-2m2 2l3-4 M14 95l-2-3m2 3l1-5m-1 5l5-2 M60 112l-3-2m3 2l1-4m-1 4l4-1 M131 101l-2-3m2 3l2-4 M88 17l-2-3m2 3l3-2 M139 52l-3-1m3 1l1-4 M59 71l-2-2m2 2l1-4 M106 114l-3-2m3 2l2-4 M25 111l-2-2m2 2l2-3 M76 91l-2-2m2 2l3-3"/></g><g fill="#c1d949" opacity=".5"><ellipse cx="49" cy="16" rx="1.3" ry=".7"/><ellipse cx="115" cy="83" rx="1.8" ry="1"/></g><g fill="#fff0c7" opacity=".7"><circle cx="84" cy="37" r=".8"/><circle cx="85.5" cy="39" r=".8"/><circle cx="83" cy="39" r=".8"/></g></pattern></defs><path d="${cd}" fill="#6ec9de" stroke="#97dce5" stroke-width="25"/><path d="${cd}" fill="#93b72f" stroke="#fde48c" stroke-width="16"/><g clip-path="url(#community-land)"><path d="${cd}" fill="url(#home-grass)"/>`;
for(const[cx,cy,rx,ry]of [[424,173,92,56],[1071,192,85,71],[728,1064,105,62],[500,1053,122,77],[-35,541,65,101],[1430,786,98,101]])g+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#b6ce43" opacity=".19"/>`;
// Catmull-Rom centerlines sampled into authored, irregular-width earthen road outlines.
function sample(p){const out=[];for(let i=0;i<p.length-1;i++){const b=p[i],c=p[i+1],a=p[i-1]??b,e=p[i+2]??c;const steps=Math.max(4,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/6));for(let j=0;j<steps;j++){const t=j/steps,u=1-t;out.push([0,1].map(k=>u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(e[k]-b[k])/6)+t**3*c[k]));}}out.push(p.at(-1));return out;}
const roads=villageRoads();
// Preserve the review pass's exact river and bridge construction independently of roads.
const bridgeRoadPlan=structuredClone(bridgePlan.roads);bridgeRoadPlan[6][0]=[695,905];bridgeRoadPlan[8][0]=[876,895];
const bridgeRoads=[{p:bridgePlan.coastWalk,w:24},...bridgeRoadPlan.map(p=>({p,w:36})),...bridgePlan.lanes.map(p=>({p,w:16}))];
// Each heart connection runs underneath original art and meets an existing sandy path.
bridgeRoads.push({p:[[330,540],[419,593],[488,632]],w:34},{p:[[695,905],[692,893]],w:34},{p:[[876,895],[876,875],[876,816],[838,782]],w:34},{p:[[1045,804],[1063,770],[1078,727]],w:34});
const regions=[];let edgeDecor='',pebbles='',ruts='';
for(const [ri,{p,w}]of roads.entries()){
 const a=sample(p),left=[],right=[];
 for(let i=0;i<a.length;i++){const before=a[Math.max(0,i-1)],after=a[Math.min(a.length-1,i+1)],dx=after[0]-before[0],dy=after[1]-before[1],l=Math.hypot(dx,dy)||1,n=[-dy/l,dx/l],t=i/(a.length-1);
  const base=w*.5*(1+.20*Math.sin(t*9+ri)+.105*Math.sin(t*22+ri*.6));
  const lbank=base+1.2*Math.sin(i*1.3+ri),rbank=base+.9*Math.cos(i*1.7+ri);
  left.push([a[i][0]+n[0]*lbank,a[i][1]+n[1]*lbank]);right.push([a[i][0]-n[0]*rbank,a[i][1]-n[1]*rbank]);
  // Texture is part of the drawn verge, never a world prop scatter.
  if(i%3===1){const side=i%6===1?1:-1,off=(side===1?lbank:rbank)+1.2,x=a[i][0]+n[0]*off*side,y=a[i][1]+n[1]*off*side;edgeDecor+=`<path d="M${x-3},${y+1}q-5-5-1-4q1-6 3-3q5-5 3 1l3-1q1 4-8 7Z" fill="#7fb138" stroke="#477f35" stroke-width=".65"/><path d="M${x-1},${y}l1-3m-1 3l4-2" stroke="#b3d34d" stroke-width=".65" fill="none"/>`;}
  if(i%13===4){const side=i%2?1:-1,x=a[i][0]+n[0]*(base-2)*side,y=a[i][1]+n[1]*(base-2)*side;pebbles+=`<ellipse cx="${x}" cy="${y}" rx="1.8" ry="1.1" fill="#b5b390" stroke="#928d65" stroke-width=".45"/><ellipse cx="${x+3.7}" cy="${y+1.8}" rx=".8" ry=".6" fill="#e4d296"/>`;}
 }
 regions.push('M'+[...left,...right.reverse()].map(v=>v.map(n=>n.toFixed(2)).join(',')).join('L')+'Z');
 // Broken worn wheel-ruts follow the road direction and stop at irregular intervals.
 for(const off of [-.22,.24]){const q=a.map((v,i)=>{const b=a[Math.max(0,i-1)],c=a[Math.min(a.length-1,i+1)],dx=c[0]-b[0],dy=c[1]-b[1],l=Math.hypot(dx,dy)||1;return[v[0]-dy/l*w*off,v[1]+dx/l*w*off];});ruts+=`<path d="M${q.map(v=>v.join(',')).join('L')}" fill="none" stroke="#d4b66b" stroke-opacity=".34" stroke-width="1.25" stroke-dasharray="17 11 6 18 23 16" stroke-linecap="round"/><path d="${curve(p,false)}" fill="none" stroke="#fff0ba" stroke-width="2.2" opacity=".2" stroke-dasharray="23 47 10 33"/>`;}
}
// Squares widen the streets organically. The surrounding green remains usable lawn.
for(const c of P.communities){const[cx,cy,rx,ry]=c.green;const ring=[];for(let i=0;i<40;i++){const t=i*Math.PI/20,r=1+.04*Math.sin(i*2.3);ring.push([cx+Math.cos(t)*rx*r*.70,cy+Math.sin(t)*ry*r*.68]);}regions.push(curve(ring));}
// Layer the combined sand fill after all bank outlines so junctions merge into one worn surface.
g+=`<g fill="none" stroke-linejoin="round">${regions.map(d=>`<path d="${d}" stroke="#477f35" stroke-width="7"/><path d="${d}" transform="translate(0 1.5)" stroke="#8c743c" stroke-opacity=".65" stroke-width="5"/>`).join('')}</g><g fill="#f4df91">${regions.map(d=>`<path d="${d}"/>`).join('')}</g>${ruts}${pebbles}<defs><mask id="verge-only" maskUnits="userSpaceOnUse" x="-300" y="-200" width="2200" height="1700"><rect x="-300" y="-200" width="2200" height="1700" fill="white"/>${regions.map(d=>`<path d="${d}" fill="black"/>`).join('')}</mask></defs><g mask="url(#verge-only)">${edgeDecor}</g>`;
// A calm enclosed pond belongs to the makers' green, retaining B's walkable timber jetty.
const pond=B.water.poly.map(px);g+=`<path d="${curve(pond)}" fill="#6ec9de" stroke="#fde48c" stroke-width="10"/><path d="M267 845Q290 838 310 843 M375 860Q402 865 420 854" fill="none" stroke="#c1e8df" stroke-width="1.5"/>`;
// Small vegetable patches are drawn only in the farm's garden, not repeated around the island.
for(const[x,y]of [[1177,171],[1205,191],[1235,176]])g+=`<path d="M${x-16},${y-5}l29-6 11 10-30 7Z" fill="#a27b40" stroke="#c88941" stroke-width="1.3"/>`;
g+=finishGround({E,D,svg,at,px,curve,sample,roads:bridgeRoads,old})+gardenGround(curve)+'</g>';
E.paths=roads.map(({p})=>curve(p,false));E.roads=roads.map(({p,w,id,kind})=>({id,kind,points:p.map(at),width:w/K}));
g=g.replace(/-?\d+\.\d{4,}/g,v=>String(+Number(v).toFixed(3)));
E.tiles=C.tiles.map(t=>{const name=t.src.split('/').at(-1);writeFileSync(`${D}/${name}`,`<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="${278+t.x*K} ${204+t.y*K} ${t.width*K} ${t.height*K}">${g}</svg>`);return{...t,src:`/pixi-art/home-communities/${name}`};});
for(const c of P.communities){E.places.push({id:c.id,point:at(c.center)});}
E.places.push({id:'makers-pond',point:at([343,914])},{id:'coast-quay',point:at([1013,1240])},{id:'swan-cove',point:at([1279,575])});
E.openSpaces=[{id:'north-common',point:at([454,241]),radius:250},{id:'south-common',point:at([659,1079]),radius:330}];
writeFileSync('src/pixi/home-expansion.json',JSON.stringify(E,null,2));
writeFileSync(`${D}/community-plan.json`,JSON.stringify(P,null,2));
console.log(JSON.stringify({communities:E.communities.map(c=>({name:c.name,homes:c.homes.length,workplaces:c.workplaces.length})),props:E.props.length,tiles:E.tiles.length,roads:E.roads.length},null,2));
