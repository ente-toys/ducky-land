// The review baseline is immutable. Every new coordinate below is authored.
// Run after compose.mjs to reproduce this final, Bog-only density pass.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';
import {original,plan,base,out} from './design.mjs';
import {makeTerrain,terrainDefs,ribbon,path} from './terrain.mjs';
const evidence='scripts/bigger-bog/evidence/dense';
const read=p=>JSON.parse(readFileSync(p));
const before={art:read(evidence+'/before-art.json'),world:read(evidence+'/before-world.json'),walk:read(evidence+'/before-walk.json'),plan:read(evidence+'/before-plan.json')};
const art=structuredClone(before.art),world=structuredClone(before.world),walk=structuredClone(before.walk);
const road=(id,pts,widths)=>({id,pts,widths:typeof widths==='number'?pts.map(()=>widths):widths});
const main=[
 [760,525],[1640,330],[2335,-15],[3550,75],[4750,-80],[5920,80],[6800,320],[7510,570],
 [7640,1200],[8340,2000],[8490,3300],[8220,4700],[7555,6105],
 [6430,5880],[5215,5880],[3955,5925],[2290,6000],[715,6105],
 [120,4450],[-275,3180],[-100,1450],[760,525]
];
const roads=[road('main-loop',main,[170,155,160,170,155,165,160,175,160,150,170,160,175,160,165,175,155,170,155,160,155,170]),
 road('north-heart',[[4000,1850],[4000,800],[4320,370],[4450,-40]],145),
 road('west-heart',[[1500,3200],[985,3135],[310,3135],[-275,3180]],145),
 road('east-heart',[[6000,4400],[6790,4260],[7690,4350],[8280,4450]],145),
 road('south-heart',[[4000,5150],[4000,5295],[3955,5925]],145),
 road('north-herb-lane',[[4450,-40],[4480,-580],[4320,-825],[4000,-825],[3650,-825],[3380,-610]],100),
 road('south-reed-lane',[[3955,5925],[4110,6510],[4430,6978],[4864,6978],[5320,6978],[5540,6680]],100),
 road('pier-lane',[[7555,6105],[8050,6130],[8460,6150],[8833,6150]],110),
 road('croakettle-upper',[[760,525],[710,155],[660,-20],[130,80]],100),
 road('croakettle-east',[[710,155],[1190,90],[1490,220],[1490,710]],95),
 road('croakettle-south',[[760,525],[700,950],[180,1010]],95),
 road('croakettle-east-gate',[[700,950],[1050,920]],90),
 road('croakettle-work',[[760,525],[300,690],[-300,735]],105),
 road('wickwaddle-upper',[[7510,570],[7460,130],[7480,-30],[6950,120]],100),
 road('wickwaddle-east',[[7460,130],[8010,100],[8320,330],[8320,840]],95),
 road('wickwaddle-south',[[7510,570],[7390,1020],[7080,960]],95),
 road('wickwaddle-east-gate',[[7390,1020],[8050,1300]],90),
 road('wickwaddle-work',[[7510,570],[7000,550],[6550,440],[6380,370]],105),
 road('sporebutton-upper',[[715,6105],[700,5860],[650,5720],[160,5820]],100),
 road('sporebutton-east',[[700,5860],[1190,5830],[1680,5970]],95),
 road('sporebutton-south',[[715,6105],[700,6680],[230,6780]],95),
 road('sporebutton-east-gate',[[700,6680],[1140,6860]],90),
 road('sporebutton-work',[[715,6105],[230,6380],[-430,6410]],105),
 road('reedwhistle-upper',[[7555,6105],[7560,5860],[7560,5700],[7030,5830]],100),
 road('reedwhistle-east',[[7560,5860],[8090,5810],[8470,5620]],95),
 road('reedwhistle-south',[[7555,6105],[7540,6610],[7060,6740]],95),
 road('reedwhistle-east-gate',[[7540,6610],[8030,6830]],95),
 road('reedwhistle-work',[[8460,6150],[8710,6210]],100)
];
const layouts={
 croakettle:{homes:[[130,-140],[660,-240],[1190,-130],[1490,490],[180,800],[1050,700]],work:[-300,530]},
 wickwaddle:{homes:[[6950,-100],[7480,-250],[8010,-120],[8320,620],[7080,750],[8050,1090]],work:[6380,160]},
 sporebutton:{homes:[[160,5600],[650,5500],[1190,5610],[1680,5750],[230,6570],[1140,6650]],work:[-430,6200]},
 reedwhistle:{homes:[[7030,5610],[7560,5480],[8090,5590],[8470,5400],[7060,6530],[8030,6620]],work:[8710,6000]}
};
function move(id,x,y,width,height){
 const p=art.props.find(p=>p.id===id);if(!p)throw Error('Unknown prop '+id);
 const old={...p};Object.assign(p,{x,y,width:width??p.width,height:height??p.height});
 for(const data of [world,walk]){
  const q=data.props.find(q=>q.id===id);if(q)Object.assign(q,p);
  for(const o of data.obstacles.filter(o=>o.prop===id)){
   o.x=x+(o.x-old.x)*p.width/old.width;o.y=y+(o.y-old.y)*p.height/old.height;
   o.rx*=p.width/old.width;o.ry*=p.height/old.height;
  }
 }
 return p;
}
const sizes=[[400,525],[560,640],[415,605],[495,595],[375,485],[530,590]];
for(const c of world.communities){
 const spec=layouts[c.id];
 for(const [i,id]of c.homes.entries()){
  const [x,y]=spec.homes[i];move(id,x,y,...sizes[i]);
  const houseIndex=art.props.findIndex(p=>p.id===id),garden=art.props[houseIndex+1];
  if(!garden.src.endsWith('/garden.svg'))throw Error('Missing paired garden');
  move(garden.id,x,y+172,i===1?580:i===5?570:540,212);
 }
 move(c.workplace,...spec.work);
}
// Relocate the three working yards out of the shared walking greens.
const training=art.props.find(p=>p.id==='community-56-training-yard');
const trainingDelta=[-620-training.x,1290-training.y];
move(training.id,-620,1290);
for(const data of [world,walk])for(const o of data.obstacles.filter(o=>o.prop==='community-training-equipment')){o.x+=trainingDelta[0];o.y+=trainingDelta[1];}
move('community-57-allotment',250,7040,760,370);
move('community-58-allotment',1120,7070,680,330);
move('community-59-net-rack',8930,6420,430,278);
// Existing seating now faces its green, clear of the lanes and garden gates.
for(const [id,x,y]of [['community-reuse-91',1020,720],['community-reuse-92',7740,780],['community-reuse-93',970,6280],['community-reuse-94',7790,6300]])move(id,x,y);
function asset(name,w,h,body){writeFileSync(`${base}/${name}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="#39472D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`);}
asset('shared-well',280,300,'<path d="M60 269V111M221 269V111" stroke="#885931" stroke-width="12"/><path d="M31 115L136 38L248 115L231 132L137 70L49 132Z" fill="#8F70C2"/><path d="M140 70L231 132L248 115L136 38" fill="#7E438C" stroke="none"/><path d="M65 158H217" stroke="#C88941" stroke-width="10"/><path d="M144 160V232"/><path d="M59 228Q140 196 221 228V271Q139 305 59 271Z" fill="#A18458"/><ellipse cx="140" cy="228" rx="81" ry="27" fill="#885931"/><ellipse cx="140" cy="230" rx="62" ry="17" fill="#82B7A7"/><path d="M60 250Q140 277 220 250M96 240V276M166 250V285" fill="none"/><path d="M173 206L178 240Q198 253 215 238L222 206Z" fill="#C88941"/><path d="M177 207Q196 182 218 207" fill="none"/>');
function add(id,src,x,y,width,height,extra={},contact=null){
 const p={id,name:id.replaceAll('-',' '),src,x,y,width,height,scale:1,anchor:{x:.5,y:1},shadow:false,community:true,dense:true,...extra};
 art.props.push(p);for(const data of[world,walk]){data.props.push(p);if(contact)data.obstacles.push({x,y:y-contact[2],rx:contact[0],ry:contact[1],prop:id,community:true});}
}
for(const c of world.communities){const [x,y]=c.point;add(c.id+'-shared-well','communities/shared-well.svg',x+150,y-35,250,268,{neighbourhood:c.id},[73,28,24]);}
// Named cultivation plots replace the removed perimeter road. No random positions.
const plots=[
 {id:'bottle-herb-garden',owner:'croakettle',x:-550,y:-360,w:780,h:420,pieces:[['herb-bed',-680,-300,400,211],['herb-bed',-210,-350,400,211],['bog-bush',-850,-460,250,201],['bog-bush',-420,-640,250,201]]},
 {id:'brewers-training-green',owner:'croakettle',x:-590,y:1150,w:680,h:520,pieces:[['bog-bush',-950,1170,260,209],['mushrooms',-890,1430,165,120],['reeds',-320,1330,160,211]]},
 {id:'lantern-wick-garden',owner:'wickwaddle',x:8040,y:-700,w:1050,h:300,pieces:[['herb-bed',7780,-600,430,227],['herb-bed',8270,-610,430,227],['bog-bush',8670,-450,280,225],['bog-bush',7310,-820,280,225]]},
 {id:'nightwatch-grove',owner:'wickwaddle',x:8800,y:1300,w:620,h:600,pieces:[['bare-tree',8710,1250,325,495],['bog-bush',8930,1460,300,241],['bog-bush',8630,1670,300,241],['mushrooms',8900,1750,170,123]]},
 {id:'soup-fields',owner:'sporebutton',x:580,y:6990,w:1450,h:530,pieces:[['bog-bush',0,6810,280,225],['bog-bush',1500,7060,280,225],['mushrooms',1550,6940,200,145]]},
 {id:'reedworkers-patch',owner:'reedwhistle',x:8290,y:7000,w:1150,h:360,pieces:[['reed-bundles',7730,7010,350,222],['reed-bundles',8190,7020,350,222],['reeds',8500,6730,200,264],['bog-bush',8800,6400,280,225]]},
 {id:'kettlebrook-herb-bank',owner:'croakettle',x:3410,y:-640,w:500,h:250,pieces:[['herb-bed',3380,-630,400,211],['bog-bush',3040,-680,250,201]]},
 {id:'reedrun-drying-bank',owner:'reedwhistle',x:5590,y:6820,w:540,h:330,pieces:[['reed-bundles',5540,6930,320,203],['reeds',5800,7030,160,211]]}
];
for(const plot of plots)for(const [i,[asset,x,y,w,h]]of plot.pieces.entries()){
 const reuse=['bog-bush','bare-tree','mushrooms','reeds'].includes(asset);
 add(plot.id+'-'+i,`${reuse?'reuse':'communities'}/${asset}.svg`,x,y,w,h,{neighbourhood:plot.owner,gardenPlot:plot.id},asset==='bare-tree'?[38,25,12]:asset==='bog-bush'?[w*.27,20,12]:null);
}
const layout={...plan,roads,communities:world.communities,plots};
let terrain=makeTerrain(layout,{junctions:false,greens:true});
// Deliberately shaped cultivation ground, integrated below the props and roads.
let patches='';for(const p of plots)patches+=`<path d="M${p.x-p.w/2} ${p.y-p.h/2}q${p.w*.48} ${-p.h*.25} ${p.w} 0l${-p.w*.04} ${p.h}q${-p.w*.5} ${p.h*.18} ${-p.w*.94} 0Z" fill="#87AA75" opacity=".32"/><path d="M${p.x-p.w*.4} ${p.y+p.h*.45}q${p.w*.4} ${p.h*.18} ${p.w*.8} 0" fill="none" stroke="#C6D99E" stroke-width="13"/>`;
const marker='<path d="'+path(ribbon(roads[0].pts,roads[0].widths,true).poly)+'" transform=';
if(!terrain.includes(marker))throw Error('Road layer marker missing');terrain=terrain.replace(marker,patches+marker);
const svg=(x,y,w,h)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><defs>${terrainDefs}</defs>${terrain}</svg>`;
writeFileSync(`${base}/terrain-master.svg`,svg(plan.origin.x,plan.origin.y,plan.width,plan.height));
// Repaint only the new ground tiles, preserving manifests, texture budgets and old art.
for(const t of art.ground.tiles.filter(t=>t.community)){
 const [w,h]=t.nativePixels;await sharp(Buffer.from(svg(t.x,t.y,t.width,t.height))).resize(w,h).png().toFile(`public/pixi-art/themes/bog/${t.src}`);
}
for(const data of[world,walk]){
 data.paths=[...original.world.paths,...roads.map(r=>r.pts)];
 data.gardenPlots=plots.map(({pieces,...p})=>p);
 data.density={mainRoadWidth:[150,175],laneWidth:[90,110],roads:roads.map(({id,widths})=>({id,widths})),sharedGreens:true};
}
for(const [file,data]of[['public/pixi-art/themes/bog/art.json',art],['assets/world/themes/bog/world.json',world],['assets/world/themes/bog/walk-world.json',walk]])writeFileSync(file,JSON.stringify(data));
writeFileSync('scripts/bigger-bog/dense-plan.json',JSON.stringify(layout,null,2));
// Geometric area: union of road polygons, sandy squares and their entire banks,
// clipped to new dry land, excluding the coast beach, water and unchanged heart.
const k=.1,W=Math.round(plan.width*k),H=Math.round(plan.height*k);
const raster=async body=>sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${plan.origin.x} ${plan.origin.y} ${plan.width} ${plan.height}">${body}</svg>`)).ensureAlpha().raw().toBuffer();
const newland=await raster(`<path d="${path(world.coast)}" fill="white"/><path d="${path(original.world.coast)}" fill="black"/>`);
const wet=await raster(world.water.map(w=>w.poly?`<path d="${path(w.poly)}" fill="white"/>`:`<ellipse cx="${w.x}" cy="${w.y}" rx="${w.rx}" ry="${w.ry}" fill="white"/>`).join(''));
async function measure(p,before){
 let body=p.roads.map(r=>`<path d="${path(ribbon(r.pts,r.widths,true).poly)}" fill="white" stroke="white" stroke-width="52" stroke-linejoin="round"/>`).join('');
 if(!before)for(const r of p.roads)for(const i of [0,r.pts.length-1]){const [x,y]=r.pts[i],radius=(i===0?r.widths[0]:r.widths.at(-1))/2+26;body+=`<circle cx="${x}" cy="${y}" r="${radius}" fill="white"/>`;}
 for(const c of p.communities)if(before)body+=`<ellipse cx="${c.point[0]}" cy="${c.point[1]}" rx="473" ry="293" fill="white"/>`;
 if(before)for(const[id,index,rx,ry]of[['south-heart',2,380,350],['west-heart',3,350,325],['east-heart',3,350,325],['north-heart',3,360,330]]){const [x,y]=p.roads.find(r=>r.id===id).pts[index];body+=`<ellipse cx="${x}" cy="${y}" rx="${rx+26}" ry="${ry+26}" fill="white"/>`;}
 const mask=await raster(body);let land=0,road=0;
 for(let i=0;i<mask.length;i+=4)if(newland[i]>127&&newland[i+3]>127&&wet[i+3]<128){land++;if(mask[i+3]>127)road++;}
 return{newDryLandArea:land/k**2,roadAndBankArea:road/k**2,percent:100*road/land};
}
const metrics={method:'10-world-unit pixel centres; union of sandy road ribbons, squares and conservative 26-unit banks; new dry land only; excludes beach, original heart and water',before:await measure(before.plan,true),after:await measure(layout,false),homes:world.communities.map(c=>{const distances=a=>c.homes.map(id=>{const p=a.props.find(p=>p.id===id);return Math.hypot(p.x-c.point[0],p.y-c.point[1]);});return{id:c.id,meanDistanceBefore:distances(before.art).reduce((s,v)=>s+v)/6,meanDistanceAfter:distances(art).reduce((s,v)=>s+v)/6};})};
writeFileSync(evidence+'/metrics.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
process.argv[2]='built';const {render}=await import('./render.mjs');
mkdirSync(out+'/bog-dense-crops',{recursive:true});
await render(art,out+'/bog-dense.png');
for(const c of world.communities)await render(art,out+'/bog-dense-crops/'+c.id+'.png',{x:c.point[0]-1550,y:c.point[1]-1600,w:3100,h:2950,k:.8});
console.log('Dense Bog built; whole island and four production-asset crops saved.');
