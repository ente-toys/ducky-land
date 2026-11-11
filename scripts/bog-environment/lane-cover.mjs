// Pass 2 kit: patch the delivered arena, preserving other builders' courts/art.
// Run after the pass-1 build/recolour scripts. No ground or architecture rebuild.
import fs from 'node:fs';
const root='public/pixi-art/themes/bog-arena/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(root+'art.json'),data=read('src/pixi/bog-environment.json');
const layout=read('scripts/bog-environment/layout.json');
let blockers=read('src/pixi/bog-blockers.json');
// One low piece at each exposed leg/bend. All retain the existing 260x160 kit.
const covers=[
 ['north-west','cover-crates',3000,2200],
 ['north-east','cover-harvest',5400,2200],
 ['west-pond','cover-planter',1020,3290],
 // Above grove-31's foreground canopy, on the outside of the pond bend.
 ['east-pond','cover-planter',7360,3400],
 ['west-loop','cover-harvest',1740,4840],
 ['east-loop','cover-crates',6660,4840],
 ['site-a-approach','cover-crates',3200,3720],
 ['site-b-approach','cover-harvest',5200,3720],
 ['spine-north','cover-planter',3990,2940],
 ['spine-upper','cover-crates',4410,3950],
 ['spine-lower','cover-harvest',3990,4810],
 ['spine-south','cover-planter',4410,5820],
 ['south-west','cover-planter',3050,5340],
 ['south-east','cover-planter',5350,5340],
 ['cove-west','cover-harvest',3350,6360],
 ['cove-east','cover-crates',5050,6310],
];
const isLane=p=>p.id?.startsWith('lane-cover-');
art.props=art.props.filter(p=>!isLane(p));
layout.props=layout.props.filter(p=>!isLane(p));
blockers=blockers.filter(p=>!isLane(p));
layout.blockers=layout.blockers.filter(p=>!isLane(p));
data.world.obstacles=data.world.obstacles.filter(p=>!isLane(p));
const polygon=b=>[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]];
for(const [key,name,x,y]of covers){
 const id='lane-cover-'+key;
 const prop={id,name,src:`home/${name}.svg`,x,y,width:260,height:160,scale:1,
  anchor:{x:.5,y:1},shadow:true,wind:false,shadowSize:[105,13],shadowOffset:[0,-8]};
 // Exactly the drawn stone plinth, following the existing court-cover contract.
 const b={id,kind:'cover',type:'rect',x:x-122,y:y-65,width:244,height:58};
 art.props.push(prop);layout.props.push(prop);
 blockers.push(b);layout.blockers.push(b);
 data.world.obstacles.push({id,poly:polygon(b)});
}
// Explicit canopy edits. Preserve the approved Home geometry, original sizes
// and calm groves; move each existing trunk with its visible tree.
const moves=[
 ['grove-17-tree-3',900,3160],
 ['grove-24-tree-4',7556.02,3290],
 ['grove-41-tree-0',6390,4800],
 ['grove-41-tree-1',6450,4700],
 ['grove-41-bush-0',6480,4950],
 ['grove-60-tree-0',4780,5840],
];
for(const [id,x,y]of moves){
 const p=art.props.find(p=>p.id===id);
 if(!p)throw Error('Missing lane planting: '+id);
 const dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;
 const authored=layout.props.find(p=>p.id===id);if(authored){authored.x=x;authored.y=y;}
 const ids=[id+'-trunk',id.replace('-tree-','-trunk-')];
 const b=blockers.find(b=>ids.includes(b.id));
 if(b){
  b.x=+(b.x+dx).toFixed(2);b.y=+(b.y+dy).toFixed(2);
  const o=data.world.obstacles.find(o=>o.id===b.id);if(!o)throw Error('Missing trunk obstacle: '+b.id);
  o.poly=polygon(b);
  const authoredBlock=layout.blockers.find(o=>o.id===b.id);if(authoredBlock)Object.assign(authoredBlock,b);
 }
}
write(root+'art.json',art);write('src/pixi/bog-blockers.json',blockers);
// Preserve the delivered environment's compact serialization.
fs.writeFileSync('src/pixi/bog-environment.json',JSON.stringify(data)+'\n');
write('scripts/bog-environment/layout.json',layout);
console.log(`Lane kit: ${covers.length} cover pieces, ${moves.length} authored planting moves.`);
