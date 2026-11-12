import fs from 'node:fs';
import {communityArt} from './community-art.mjs';
import {road} from './community-roads.mjs';
import {reviewFixes} from './review-fixes.mjs';
import {denseGardens} from './dense-gardens.mjs';
const layout=JSON.parse(fs.readFileSync('scripts/bigger-neon/communities.json'));
communityArt();
const A='public/pixi-art/themes/neon/',D='assets/world/themes/neon/',S='scripts/bigger-neon/',O='../concepts/themes/world-map/bigger/';
for(const p of [S+'baseline',A+'bigger',O+'neon-crops'])fs.mkdirSync(p,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
for(const [n,p]of Object.entries({art:A+'art.json',world:D+'world.json',walk:D+'walk-world.json',harbor:D+'harbor.json',placements:D+'placements.json',paths:D+'paths.json'}))if(!fs.existsSync(S+'baseline/'+n+'.json'))fs.copyFileSync(p,S+'baseline/'+n+'.json');
const old=Object.fromEntries(['art','world','walk','harbor','placements','paths'].map(n=>[n,read(S+'baseline/'+n+'.json')]));
const origin={x:-2400,y:-2300},width=12600,height=9500;
const anchors=[[-1850,1500],[-1620,350],[-700,-650],[550,-1300],[2300,-1720],[4150,-1670],[6200,-1600],[7800,-900],[8850,250],[9440,1850],[9250,3400],[8600,4900],[7200,5950],[5100,6550],[3100,6570],[1100,6200],[-450,5480],[-1530,4300],[-1900,2800]];
function smooth(ps){const out=[];for(let i=0;i<ps.length;i++){const p0=ps[(i+ps.length-1)%ps.length],p1=ps[i],p2=ps[(i+1)%ps.length],p3=ps[(i+2)%ps.length];for(let n=0;n<12;n++){const t=n/12;out.push([0,1].map(j=>+(0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t*t+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t*t*t)).toFixed(2)));}}return out;}
const coast=smooth(anchors),outline='M'+coast.map(p=>p.join(' ')).join(' L')+' Z';
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const put=(n,w,h,s)=>fs.writeFileSync(A+'bigger/'+n+'.svg',svg(w,h,s));
put('moon-stage',600,450,`<ellipse cx="300" cy="414" rx="285" ry="30" fill="#778c44"/><path d="M35 347 Q300 438 565 347 L565 391 Q300 484 35 391Z" fill="#ba94a9" stroke="#66576c" stroke-width="4"/><ellipse cx="300" cy="347" rx="265" ry="75" fill="#f5cbdc" stroke="#66576c" stroke-width="4"/><path d="M82 340V126 Q300 -38 518 126V340" fill="#716990" stroke="#4e506d" stroke-width="6"/><path d="M110 321V137 Q300 2 490 137V321Z" fill="#ffc4d7"/><path d="M110 137Q174 216 158 321H110ZM490 137Q426 216 442 321H490Z" fill="#df85ac"/><path d="M300 40L314 74L352 78L324 104L332 141L300 122L268 141L276 104L248 78L286 74Z" fill="#ffe18e" stroke="#776477" stroke-width="3"/><path d="M300 167A56 56 0 1 0 353 239A42 42 0 1 1 300 167" fill="#fff1bd"/><path d="M195 354H405M213 375H387M235 395H365" stroke="#fff0bf" stroke-width="9"/><g fill="#a0e8de" stroke="#66576c" stroke-width="3"><circle cx="134" cy="116" r="10"/><circle cx="193" cy="83" r="10"/><circle cx="249" cy="63" r="10"/><circle cx="351" cy="63" r="10"/><circle cx="407" cy="83" r="10"/><circle cx="466" cy="116" r="10"/></g>`);
put('star-dome',460,440,`<ellipse cx="230" cy="404" rx="213" ry="29" fill="#778c44"/><path d="M70 251H390V363Q230 428 70 363Z" fill="#f6d39b" stroke="#58576b" stroke-width="4"/><ellipse cx="230" cy="251" rx="160" ry="46" fill="#9addcf"/><path d="M70 251Q57 39 230 39Q403 39 390 251Q230 304 70 251Z" fill="#8edbd4" stroke="#58576b" stroke-width="5"/><path d="M230 42Q148 112 155 274M230 42Q312 112 305 274M77 177Q230 231 383 177" fill="none" stroke="#c3f4df" stroke-width="10"/><path d="M230 24V4M218 5H242" stroke="#6a6784" stroke-width="6"/><path d="M184 372V310Q230 263 276 310V372Z" fill="#7c739c" stroke="#58576b" stroke-width="4"/><g fill="#fff1bd" stroke="#58576b" stroke-width="3"><rect x="94" y="292" width="44" height="55" rx="17"/><rect x="322" y="292" width="44" height="55" rx="17"/></g><path d="M180 396H280M165 410H295" stroke="#ffedb8" stroke-width="12"/>`);
put('lantern-gate',520,410,`<g stroke="#545771" stroke-width="5"><path d="M45 390V90M475 390V90" stroke-width="18"/><path d="M22 91Q260 -12 498 91L480 123Q260 40 40 123Z" fill="#8edbd4"/><path d="M70 155Q260 225 450 155" fill="none" stroke-width="3"/></g><g fill="#ff98be" stroke="#8d668c" stroke-width="4"><ellipse cx="120" cy="196" rx="30" ry="39"/><ellipse cx="260" cy="215" rx="35" ry="44"/><ellipse cx="400" cy="196" rx="30" ry="39"/></g><g stroke="#ffe59f" stroke-width="5"><path d="M120 159V232M260 175V255M400 159V232"/></g><g fill="#ffe49a"><rect x="105" y="236" width="30" height="8"/><rect x="244" y="260" width="32" height="8"/><rect x="385" y="236" width="30" height="8"/></g><path d="M35 389H55M465 389H485" stroke="#6a6681" stroke-width="32"/>`);
put('tram',520,330,`<ellipse cx="260" cy="301" rx="242" ry="22" fill="#728c45"/><g stroke="#535773" stroke-width="4"><path d="M40 99Q260 45 480 99V268Q260 324 40 268Z" fill="#f4b0cc"/><ellipse cx="260" cy="99" rx="220" ry="57" fill="#a6e5d9"/><path d="M50 231Q260 285 470 231" stroke="#ffe69b" stroke-width="15"/><path d="M225 285V130H295V285" fill="#fae3a8"/><path d="M100 133V206H174V143ZM346 143V206H420V133Z" fill="#bde9e3"/><path d="M112 155H162M358 155H408" stroke="#faffdf"/><path d="M235 139H285V214H235Z" fill="#9ddacf"/><circle cx="105" cy="284" r="16" fill="#5c5e76"/><circle cx="415" cy="284" r="16" fill="#5c5e76"/><path d="M230 298H290" stroke="#6b6285" stroke-width="14"/></g><rect x="191" y="70" width="138" height="42" rx="15" fill="#7b7699"/><text x="260" y="99" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#fff0bc">TICKY</text>`);
put('rink-floor',1100,700,`<ellipse cx="550" cy="350" rx="535" ry="332" fill="#f1c2d3" stroke="#756885" stroke-width="6"/><ellipse cx="550" cy="350" rx="464" ry="270" fill="#98dbd2" stroke="#fff0c8" stroke-width="12"/><ellipse cx="550" cy="350" rx="368" ry="198" fill="#c6a8cf" stroke="#fff0c8" stroke-width="7"/><path d="M550 180L588 295L710 296L611 366L650 481L550 410L450 481L489 366L390 296L512 295Z" fill="#f8e2a6"/><g fill="#ffeff0"><circle cx="210" cy="300" r="10"/><circle cx="890" cy="300" r="10"/><circle cx="550" cy="118" r="10"/><circle cx="550" cy="582" r="10"/></g>`);
const props=[],obstacles=[],flats=[],places=[];let id=0;
function p(src,x,y,scale=1,kind=null){let proto=old.art.props.find(p=>p.src===src);if(!proto){const txt=fs.readFileSync(A+src,'utf8');const m=txt.match(/<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/);proto={src,name:src.split('/').at(-1).replace('.svg',''),width:+m[1],height:+m[2],anchor:{x:.5,y:1},scale:1};}const target={'reuse/street--picnic-table.svg':230,'reuse/street--umbrella-cafe.svg':220,'reuse/street--bench-park.svg':190,'reuse/street--bench-wood.svg':170};if(target[src])scale=target[src]/(proto.width*(proto.scale??1))*scale;const q={...proto,community:activeCommunity,id:'neon-bigger-'+(++id),x,y,scale:(proto.scale??1)*scale,wind:false};props.push(q);const w=q.width*q.scale,h=q.height*q.scale;
 if(src.endsWith('yard-fence.svg')){obstacles.push({x:x-w*.31,y:y-25,rx:w*.18,ry:12},{x:x+w*.31,y:y-25,rx:w*.18,ry:12});}
 else if(src.endsWith('washing-line.svg')){obstacles.push({x:x-w*.46,y:y-3,rx:8,ry:8},{x:x+w*.46,y:y-3,rx:8,ry:8});}
 else if(src.endsWith('lantern-gate.svg')){obstacles.push({x:x-w*.42,y:y-8,rx:14,ry:14},{x:x+w*.42,y:y-8,rx:14,ry:14});}
 else if(!/flower|butterfly|sign-board/.test(src)){let rx,ry,yy;if(/-house/.test(src)){rx=w*.405;ry=70;yy=y-75;}else if(/shop-/.test(src)){rx=w*.45;ry=w*.19;yy=y-ry*.9;}else if(/tree|bush/.test(src)){rx=w*.19;ry=w*.095;yy=y-5;}else if(/moon-stage|star-dome|tram/.test(src)){rx=w*.43;ry=w*.14;yy=y-ry*.8;}else{rx=w*.36;ry=Math.min(32,w*.19);yy=y-ry*.5;}obstacles.push({x,y:yy,rx,ry});}return q;}
function scene(id,name,x,y,point){places.push({id,name,x,y,spawn:point});}
let activeCommunity=null;
const internalPaths=[];
for(const c of layout.communities){
 activeCommunity=c.id;
 scene(c.id,c.name,c.x,c.y,c.spawn);
 const place=places.at(-1);Object.assign(place,{who:c.who,homes:c.homes,house:c.house,square:c.square});
 for(const [i,[x,y]]of c.homes.entries()){
  p('bigger/'+c.house+'-'+i+'.svg',x,y,[.82,1.10,.94,1.12,.87,1.04,.90][i]);
  p('bigger/yard-fence.svg',x,y+150,.96);
  p('close-flower-pot.svg',x-163,y+50,.9);
  p('planter-box.svg',x+140,y+40,.8);
  if(i%2===0)p('bigger/washing-line.svg',x+5,y+110,.65);
  p('neon-lamp.svg',x-227,y+95,.9);
  const targets={simmerwick:[[-1040,1810],[-710,1810],[-280,1830],[-850,2400],[-870,2900],[-700,3370],[-310,3370]],ticklewick:[[3100,-330],[3600,-330],[4130,-330],[2890,100],[4500,120],[3100,330],[4210,330]],purrlumi:[[7920,2150],[8440,2150],[8780,2170],[8720,2800],[8580,3560],[8050,3560],[8040,2780]],moonwake:[[3410,5500],[3900,5480],[4420,5500],[3160,5790],[4700,5810],[3400,6380],[4440,6380]]};
  internalPaths.push({points:[[x,y+10],[x+12,y+165],targets[c.id][i]],width:78});
 }
 for(const[src,x,y]of c.workplaces)p(src,x,y,.95);
 const [sx,sy]=c.square;
 if(c.id==='simmerwick'){
  p('bigger/noodle-rack.svg',-350,1900);p('bigger/noodle-rack.svg',-1030,3210,.85);
  p('bigger/lantern-gate.svg',-520,1960,.6);
  p('reuse/street--picnic-table.svg',-860,2220,.9);p('reuse/street--picnic-table.svg',-820,2450,.9);
  p('reuse/street--umbrella-cafe.svg',-860,2180,.9);
  internalPaths.push({points:[[-1170,1790],[-710,1810],[-340,1840],[-490,2190],[-510,2690],[-860,2900]],width:105});
 }else if(c.id==='ticklewick'){
  p('bigger/workbench.svg',2810,-390);p('bigger/workbench.svg',4710,370);
  p('vending-mint.svg',2140,-30);p('vending-pink.svg',2220,-20);
  p('capsule-seat.svg',3470,90,.9);p('capsule-seat.svg',3870,110,.9);
  internalPaths.push({points:[[2880,-320],[3440,-330],[4140,-310],[4500,100]],width:105});
 }else if(c.id==='purrlumi'){
  p('bigger/book-rack.svg',8050,2530);p('bigger/book-rack.svg',8690,2390);
  p('reuse/street--umbrella-cafe.svg',8480,2770,.9);
  p('reuse/street--picnic-table.svg',8470,2810,.9);
  p('capsule-seat.svg',8140,2630,.9);
  internalPaths.push({points:[[7880,2160],[8390,2160],[8790,2200],[8720,2800]],width:105});
 }else{
  p('bigger/boat-repair.svg',5290,5480);p('bigger/workbench.svg',5510,5620);
  p('bigger/boat-repair.svg',2050,5740,.85);
  p('reuse/neon-crate.svg',5180,5880);p('reuse/neon-barrel.svg',5280,5900);
  p('reuse/street--picnic-table.svg',3690,5820,.9);
  p('bigger/lantern-gate.svg',3900,6270,.8);
  internalPaths.push({points:[[3180,5500],[3680,5500],[4440,5500],[4700,5800]],width:105});
 }
 p('sign-board.svg',sx-260,sy+180);p('reuse/street--bench-park.svg',sx+200,sy+200,.9);
 p('bigger/shared-well.svg',sx-210,sy-20,.64);
 p('neon-lamp.svg',sx+350,sy+80);p('vending-mint.svg',sx-340,sy+100);
}
activeCommunity=null;
for(const[x,y,n]of [[-1460,1220,1],[-1510,2550,2],[-1060,3740,4],[-460,3950,3],[190,3830,5],[60,650,2],[-630,420,1],[-1020,620,3],[900,-500,4],[1500,-920,5],[2080,-1060,1],[2700,-1310,2],[3400,-1310,3],[4090,-1300,4],[4800,-1220,1],[5660,-900,5],[6250,-620,2],[6800,-450,3],[7200,40,1],[7570,650,4],[8200,860,2],[8900,1230,1],[9150,2280,5],[8850,3090,4],[8410,3780,2],[7870,3830,3],[7340,4950,5],[7000,5350,2],[6310,5720,1],[5790,6250,3],[5120,6320,4],[4670,6420,5],[3170,6300,1],[2430,6080,2],[1520,5630,3],[950,5240,5],[500,4750,1],[-310,4650,4],[-800,4800,2]])p(`reuse/tree-${n}.svg`,x,y,1);
for(const c of layout.communities){const [x,y]=c.square;for(const[dx,dy]of [[-410,310],[-200,390],[80,385],[380,300]]){p('reuse/bush-3.svg',x+dx,y+dy,1.2);p('reuse/flower-2.svg',x+dx-35,y+dy-25,1.2);}}
const fixes=reviewFixes(old,p);
const gardens=denseGardens(layout,p);
const ring=[[-510,2380],[-470,1500],[-120,440],[1780,-180],[3750,-100],[5400,70],[6700,150],[7920,1200],[8310,2600],[8140,3550],[7700,4700],[6100,5310],[3900,5750],[2100,5290],[-340,4160],[-510,3370],[-510,2380]];
const connectionPaths=[[[1323,2273],[550,2370],[-510,2380]],[[3844,1123],[3844,650],[3750,-100]],[[6475,2310],[7350,2400],[8310,2600]],[[3844,4200],[3899,4674],[3900,5250],[3900,5750]]];
const oldCoast='M'+old.world.coast.map(p=>p.join(' ')).join(' L')+' Z';
const oldIslets=old.world.islets.map(([x,y,rx,ry])=>`<ellipse cx="${x}" cy="${y}" rx="${rx+4}" ry="${ry+4}" fill="black"/>`).join('');
const defs=`<defs><pattern id="grass" width="173" height="131" patternUnits="userSpaceOnUse"><rect width="173" height="131" fill="#93B72F"/><path d="M13 27l6 -7 5 6m72 58l7 -10 6 7m-57 21l5 -6 4 5" fill="none" stroke="#7fa52f" stroke-width="3"/><path d="M58 29l7 -4m66 15l9 3m-108 71l6 -2" stroke="#afd04c" stroke-width="3"/><circle cx="143" cy="105" r="2" fill="#d4d978"/></pattern><pattern id="pavers" width="104" height="68" patternUnits="userSpaceOnUse"><rect width="104" height="68" fill="#fff0bd"/><path d="M0 0H104M0 34H104M26 0V34M78 34V68" fill="none" stroke="#e8d8a8" stroke-width="1.5"/></pattern><pattern id="court" width="88" height="58" patternUnits="userSpaceOnUse"><path d="M0 0H88M0 29H88M22 0V29M66 29V58" fill="none" stroke="#fff8e2" stroke-opacity=".45" stroke-width="2"/><path d="M7 17l9 0m45 26h10" stroke="#81797e" stroke-opacity=".12" stroke-width="2"/></pattern><clipPath id="land"><path d="${outline}"/></clipPath><mask id="outer" maskUnits="userSpaceOnUse" x="-2400" y="-2300" width="12600" height="9500"><rect x="-2400" y="-2300" width="12600" height="9500" fill="white"/><path d="${oldCoast}" fill="black"/>${oldIslets}</mask></defs>`;
let ground=`${defs}<path d="${outline}" fill="#f8e3a0" stroke="#fff0c7" stroke-width="12"/><path d="${outline}" fill="none" stroke="#e9c979" stroke-width="55"/><g clip-path="url(#land)"><path d="${outline}" fill="url(#grass)" stroke="#f8e3a0" stroke-width="180"/><g mask="url(#outer)">`;
for(const[x,y,rx,ry]of [[900,-480,710,340],[6400,-350,750,380],[900,4800,650,300],[6950,5130,500,310],[-950,3850,440,230],[8720,3720,320,180]])ground+=`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#aac34c" opacity=".35"/>`;
ground+=fixes.commonsGround+gardens;
const bridgeSpurs=[[[6350,-1170],[6570,-640],[6700,150]],[[7060,5680],[6620,5550],[6100,5310]],[[3900,5750],[3970,6080],[3900,6370]]];
const roadSpecs=[{kind:'main-loop',points:ring,width:205},...connectionPaths.map(points=>({kind:'heart-lane',points,width:135})),...bridgeSpurs.map(points=>({kind:'bridge-lane',points,width:95})),...internalPaths.map(p=>({kind:'house-lane',...p}))];
const network=roadSpecs.map(({points,width})=>road(points,width));
for(const c of layout.communities){const[x,y,rx,ry]=c.square;const d=`M${x-rx} ${y}Q${x-rx*.9} ${y-ry} ${x} ${y-ry}Q${x+rx*1.1} ${y-ry*.7} ${x+rx} ${y+40}Q${x+rx*.7} ${y+ry} ${x} ${y+ry}Q${x-rx*1.15} ${y+ry} ${x-rx} ${y}Z`;network.push({bank:`<path d="${d}" fill="#f4dda0" stroke="#697743" stroke-width="8"/>`,surface:`<path d="${d}" fill="#f4dda0"/>`,verge:'',wear:`<path d="M${x-190} ${y-70}q140 -30 290 -10m-150 175q120 25 220 0" fill="none" stroke="#d5b97c" stroke-width="5" opacity=".35"/><ellipse cx="${x-100}" cy="${y+90}" rx="110" ry="28" fill="#fff0be" opacity=".35"/>`});}
for(const layer of ['bank','verge','surface','wear'])ground+=network.map(r=>r[layer]).join('');
ground+=fixes.ground;
ground+='</g></g>';
fs.writeFileSync(A+'bigger/ground.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="12600" height="9500" viewBox="-2400 -2300 12600 9500" stroke-linecap="round" stroke-linejoin="round">${ground}</svg>`);
const tiles=[];
for(let y=origin.y,r=0;y<origin.y+height;y+=1500,r++)for(let x=origin.x,c=0;x<origin.x+width;x+=1500,c++){
 const w=Math.min(1500,origin.x+width-x),h=Math.min(1500,origin.y+height-y),src=`bigger/ground-${r}-${c}.svg`;
 fs.writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" stroke-linecap="round" stroke-linejoin="round">${ground}</svg>`);
 tiles.push({src,x,y,width:w,height:h,resolution:.65});
}
let inner=fs.readFileSync(A+'ground.svg','utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
const originalBody=inner;
let count=0;inner=inner.replace(/<(?:path|ellipse)\b[^>]*\/>/g,(m)=>{count++;return count<=11?'':m;});
for(const [i,t]of old.art.ground.tiles.entries()){
 const src=`bigger/inner-${i}.svg`;
 fs.writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`);
 tiles.push({...t,src});
}
const art={...old.art,width,height,origin,ground:{tiles},flats:[...old.art.flats,...flats],decks:[...old.art.decks,...fixes.decks],props:[...old.art.props,...props]};
const world={...old.world,width,height,origin,coast,islets:[],water:[...old.world.water,...fixes.water],bridges:[...old.world.bridges,...fixes.bridges],props:art.props,obstacles:[...old.world.obstacles,...obstacles],paths:[...old.paths,...roadSpecs.map(p=>p.points)],zones:{...old.world.zones,...Object.fromEntries(places.map(p=>['bigger-'+p.id,{...p}]))}};
const walk={...old.walk,width,height,origin,coast,islets:[],water:world.water,bridges:world.bridges,obstacles:[...old.walk.obstacles,...obstacles],paths:world.paths};
const harbor={...old.harbor,jetty:{foot:[3900,6370],tip:[3900,6890],width:132},boats:[{x:3740,y:6770,turn:Math.PI},{x:4060,y:6800,turn:Math.PI},{x:3540,y:6840,turn:Math.PI}]};
for(const index of [0,3,6,9,12,16]){const q=coast[index*12],cx=3800,cy=2400,dx=q[0]-cx,dy=q[1]-cy,l=Math.hypot(dx,dy);harbor.boats.push({x:Math.round(q[0]+dx/l*120),y:Math.round(q[1]+dy/l*120),turn:Math.atan2(dx,-dy)});}
const plan={art,world,walk,harbor,places,props,obstacles,coast,origin,width,height,communities:layout.communities,internalPaths,coastWalk:[],roadSpecs,review:{streams:fixes.streams,commons:fixes.commons},originalGroundDecorationRemoved:11};save(S+'plan.json',plan);
if(process.argv.includes('--build')){save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'harbor.json',harbor);save(D+'placements.json',art.props);save(D+'paths.json',world.paths);console.log('Installed four lived-in Tickytown communities.');}else console.log('Drawing prepared. Live manifests unchanged.');
