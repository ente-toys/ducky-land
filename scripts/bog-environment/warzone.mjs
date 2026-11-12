import fs from 'node:fs';
const root='public/pixi-art/themes/bog-arena/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const art=read(root+'art.json'),layout=read('scripts/bog-environment/layout.json');
const map=read('src/pixi/bog-environment.json');
let blockers=read('src/pixi/bog-blockers.json');
const owner='warzone';
const isOwn=p=>p.author===owner;
art.props=art.props.filter(p=>!isOwn(p));
layout.routes=layout.routes.filter(p=>p.author!==owner);
blockers=blockers.filter(p=>!isOwn(p));
const bases=['privacy-nw','google-ne','privacy-sw','google-se'];
const keepLamp=p=>bases.some(id=>p.id===id+'-lamp-0');
const removed=new Set(art.props.filter(p=>
 /^(bench|flowers|home-planting-bed|sleeping-ducky|sleeping-z|cream-moth|pond-frog)$/.test(p.name)||
 p.id.startsWith('label-')||(p.name==='lantern'&&!keepLamp(p))).map(p=>p.id));
art.props=art.props.filter(p=>!removed.has(p.id));
art.flats=art.flats.filter(p=>!p.src.includes('site-bed.svg'));
const lamps=art.props.filter(p=>p.name==='lantern');
art.flats=art.flats.filter(p=>!p.src.includes('lantern-ground-glow.svg')||lamps.some(l=>Math.abs(p.x-l.x)<2&&Math.abs(p.y-l.y)<25));
blockers=blockers.filter(b=>!removed.has(b.id)&&!removed.has(b.prop));
for(const key of ['props','flats'])layout[key]=layout[key].filter(p=>!removed.has(p.id)&&!isOwn(p));
for(const a of Object.values(layout.areas))delete a.label;
for(const file of fs.readdirSync(root+'home'))if(/^label-.*\.svg$/.test(file))fs.unlinkSync(root+'home/'+file);

const ink='#39472d',stone='#b591c0',cap='#edceea',side='#93729e',teal='#168f98';
const svg=(name,w,h,title,body)=>fs.writeFileSync(root+'home/'+name+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${title}</title><g stroke="${ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`);
const base=`<path d="M8 97L24 84H236L252 97V153H8Z" fill="${stone}"/><path d="M8 97L24 84H236L252 97Z" fill="#d9b8df"/><path d="M8 97H252V110H8Z" fill="#c9a7d0"/><path d="M8 130H252M64 110V130M173 110V130M115 130V153M222 130V153" fill="none" stroke="${side}" stroke-width="1.8"/>`;
const courses=`<path d="M12 76H248M12 105H248M12 132H248M66 48V76M176 48V76M112 76V105M214 76V105M62 105V132M167 105V132M113 132V152M219 132V152" fill="none" stroke="${side}" stroke-width="1.7"/>`;
svg('wz-wall',260,160,'Lilac brick firing wall',`<path d="M8 45H252V153H8Z" fill="${stone}"/>${courses}<path d="M8 45L23 31H237L252 45V58H8Z" fill="${cap}"/><path d="M8 45H252" fill="none"/><path d="M18 60V148H26V60Z" fill="#c9a7d0" stroke="none"/>`);
svg('wz-ruin',260,160,'Broken lilac wall with a high left shoulder',`<path d="M8 32H69V54H101V78H140V59H188V82H224V101H252V153H8Z" fill="${stone}"/>${courses}<path d="M8 32L18 23H74L69 32ZM69 54l9-8h29l-6 8ZM101 78l9-9h35l-5 9ZM140 59l9-9h44l-5 9ZM188 82l9-9h33l-6 9Z" fill="${cap}"/><path d="M36 42l10 18-8 11 13 14M176 91l-8 20 9 9" fill="none" stroke="${side}" stroke-width="2"/>`);
svg('wz-planks',260,160,'Honeywood braced plank barricade',`${base}<path d="M15 35H31V107H15ZM229 35H245V107H229Z" fill="#9f713e"/><path d="M10 38L250 35V57L10 61ZM10 66L250 63V85L10 89ZM10 94L250 91V111L10 115Z" fill="#d9a762"/><path d="M30 102L215 29L226 46L42 119Z" fill="#b77e43"/><path d="M23 49h57m53-3h65M51 76h66m49-2h57M55 105h55m62-3h46" fill="none" stroke="#a87838" stroke-width="1.5"/><g fill="${ink}" stroke="none"><circle cx="22" cy="49" r="2.2"/><circle cx="238" cy="47" r="2.2"/><circle cx="22" cy="78" r="2.2"/><circle cx="238" cy="75" r="2.2"/><circle cx="42" cy="106" r="2.2"/><circle cx="214" cy="40" r="2.2"/></g>`);
svg('wz-corner',260,180,'L shaped brick wall with open inner corner',`<path d="M8 54L50 45V112H252V173H8Z" fill="${stone}"/><path d="M8 54L20 42L50 35L60 45L50 54V112H252V126H38V61Z" fill="${cap}"/><path d="M8 145H252M8 112H38M8 83H38M75 126V145M175 126V145M126 145V173M227 145V173" fill="none" stroke="${side}" stroke-width="1.8"/>`);
function inner(file){return fs.readFileSync('public'+file,'utf8').replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<title>[\s\S]*?<\/title>/g,'').replace(/<ellipse\b[^>]*stroke="none"[^>]*\/>/g,'');}
function instance(file,x,y,w,h,box){return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${box}" overflow="visible">${inner(file)}</svg>`;}
const sack='/pixi-art/home-hamlets/clovercrust/grain-sack.svg',barrel='/pixi-art/home-hamlets/clovercrust/water-barrel.svg',crate='/pixi-art/home-hamlets/clovercrust/apple-crate.svg';
function packing(x,y,w=84,h=73){let s=instance(crate,x,y,w,h,'0 0 62 54');s=s.replace(/<(?:path)\b[^>]*fill="#(?:e55f3f|78a543)"[^>]*\/>/g,'').replace(/<path fill="none" d="M19 11[^>]*\/>/g,'');return s;}
svg('wz-crates',260,160,'Stacked Home packing crates on solid brick cover',`${base}${packing(25,34)}${packing(143,29)}${packing(91,2,70,61)}`);
svg('wz-sacks',260,160,'Home grain sacks stacked as a sandbag barricade',`${base}${instance(sack,24,35,54,66,'0 0 40 49')}${instance(sack,177,35,54,66,'0 0 40 49')}${instance(sack,75,27,54,66,'0 0 40 49')}${instance(sack,125,29,54,66,'0 0 40 49')}${instance(sack,102,0,54,66,'0 0 40 49')}`);
svg('wz-barrels',260,160,'Home oak barrels and supply crate barricade',`${base}${instance(barrel,26,16,61,80,'0 0 45 59')}${instance(barrel,171,16,61,80,'0 0 45 59')}${packing(88,27,80,70)}`);
const oldTypes={'cover-planter':'wz-wall','cover-crates':'wz-crates','cover-harvest':'wz-sacks'};
for(const p of art.props){if(oldTypes[p.name]){p.name=oldTypes[p.name];p.src=`home/${p.name}.svg`;p.coverSources=p.name==='wz-crates'?[crate]:p.name==='wz-sacks'?[sack]:[];}}

const paints={'#fff0c7':'#d9b8df','#e1c58d':'#b591c0','#f3ddb1':'#c9a7d0','#ffe6a2':'#edceea','#ffe8b5':'#edceea','#75bfc5':'#ffe45e','#729aa7':'#168f98','#7399ad':'#168f98','#e1bb4b':'#168f98','#b08cba':'#168f98','#d1b26b':'#168f98','#d9a94c':'#168f98','#ce91a4':'#168f98','#f4d3c7':'#d9b8df','#9dbeb4':'#d9b8df','#f1dbc6':'#d9b8df'};
function facade(name,source,boarded=false){
 let s=fs.readFileSync('public'+source,'utf8');
 s=s.replace(/<(?:path|circle)\b[^>]*(?:fill="#(?:eb9c74|70a645|6a9d3d|efb1a3|f3b1a1|eaa795)"|stroke="#759648")[^>]*\/>/g,'');
 s=s.replace(/<path d="M83 234[^>]*\/>/g,'').replace(/<circle cx="(?:37|56|305|324|99|121|239|260)"[^>]*\/>/g,'');
 s=s.replace(/#[0-9a-f]{6}/gi,c=>paints[c.toLowerCase()]??c);
 if(boarded)s=s.replace('</svg>',`<g stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"><path d="M86 181L134 203V215L86 193ZM227 211L271 181V194L227 224Z" fill="#d9a762"/><path d="M88 214L133 183V195L88 227Z" fill="#b77e43"/><path d="M157 223L205 238V251L157 236Z" fill="#d9a762"/><path d="M259 106l-14 6 9 5-13 7M92 255l-7 10 12 8" fill="none" stroke="#93729e"/></g></svg>`);
 fs.writeFileSync(root+'home/'+name+'.svg',s);
}
for(const p of art.props.filter(p=>p.homeSource?.includes('home-hamlets')&&!p.coverFootprints)){
 const name='wz-'+p.id;facade(name,p.homeSource,/annex/.test(p.id));p.src=`home/${name}.svg`;
}
const poly=b=>[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]];
const feetByName={'wz-corner':[[8,112,244,61],[8,54,42,58]]};
function cover(id,name,x,y,area){
 const h=name==='wz-corner'?180:160;
 const feet=feetByName[name]??[[8,95,244,58]];
 const p={id:'wz-'+id,name,src:`home/${name}.svg`,x,y,width:260,height:h,scale:1,anchor:{x:.5,y:1},shadow:true,shadowSize:[105,10],shadowOffset:[0,-5],wind:false,author:owner,area,coverFootprints:feet};
 art.props.push(p);
 for(const [i,[fx,fy,width,height]]of feet.entries())blockers.push({id:p.id+'-foot-'+i,prop:p.id,author:owner,kind:'cover',type:'rect',x:x-130+fx,y:y-h+fy,width,height});
}
const stations=[
 ['north-1','wz-planks',2610,2260,'north-loop'],['north-2','wz-wall',3330,2140,'north-loop'],
 ['north-3','wz-sacks',3680,2170,'north-loop'],['north-4','wz-ruin',4770,2180,'north-loop'],
 ['north-5','wz-barrels',5050,2100,'north-loop'],['north-6','wz-planks',5880,1950,'north-loop'],
 ['west-1','wz-sacks',1470,2470,'west-loop'],['west-2','wz-planks',1050,2720,'west-loop'],
 ['west-3','wz-ruin',1430,3060,'west-loop'],['west-4','wz-barrels',1430,3430,'west-loop'],
 ['west-5','wz-wall',1060,3970,'west-loop'],['west-6','wz-planks',1120,4290,'west-loop'],
 ['west-7','wz-sacks',1570,4580,'west-loop'],['west-8','wz-ruin',1380,5000,'west-loop'],
 ['west-9','wz-wall',1630,5200,'west-loop'],
 ['east-1','wz-planks',6900,2510,'east-loop'],['east-2','wz-sacks',7380,2820,'east-loop'],
 ['east-3','wz-ruin',6940,3120,'east-loop'],['east-4','wz-barrels',6990,3560,'east-loop'],
 ['east-5','wz-wall',7410,4150,'east-loop'],['east-6','wz-planks',7290,4290,'east-loop'],
 ['east-7','wz-sacks',6810,4580,'east-loop'],['east-8','wz-ruin',6980,5090,'east-loop'],
 ['east-9','wz-wall',6990,5310,'east-loop'],
 ['spine-1','wz-planks',4410,2670,'spine'],['spine-2','wz-barrels',4410,3220,'spine'],
 ['spine-3','wz-ruin',3990,3550,'spine'],['spine-4','wz-sacks',3990,4230,'spine'],
 ['spine-5','wz-wall',4410,4510,'spine'],['spine-6','wz-planks',4410,5060,'spine'],
 ['spine-7','wz-barrels',3990,5450,'spine'],['spine-8','wz-sacks',3990,6090,'spine'],
 ['cross-a-1','wz-planks',2780,4130,'west-mid'],['cross-a-2','wz-wall',3570,3780,'west-mid'],
 ['cross-a-3','wz-sacks',3860,3280,'west-mid'],
 ['cross-b-1','wz-ruin',5630,3740,'west-mid'],['cross-b-2','wz-barrels',4860,3750,'west-mid'],
 ['cross-b-3','wz-planks',4740,3400,'west-mid'],
 ['south-w-1','wz-planks',2460,5440,'south-west'],['south-w-2','wz-sacks',3480,5250,'south-west'],
 ['south-w-3','wz-ruin',3780,5470,'south-west'],
 ['south-e-1','wz-sacks',5950,5440,'south-west'],['south-e-2','wz-planks',4930,5260,'south-west'],
 ['south-e-3','wz-ruin',4630,5480,'south-west'],
 ['cove-w-1','wz-planks',2470,6210,'west-loop'],['cove-w-2','wz-wall',2880,6150,'west-loop'],
 ['cove-w-3','wz-barrels',3710,6300,'west-loop'],
 ['cove-e-1','wz-planks',5940,6170,'east-loop'],['cove-e-2','wz-sacks',5510,6130,'east-loop'],
 ['cove-e-3','wz-ruin',4620,6290,'east-loop'],
 ['site-a-west','wz-corner',1640,3850,'site-a'],['site-a-east','wz-ruin',2620,3820,'site-a'],
 ['site-a-front-west','wz-sacks',1810,4030,'site-a'],['site-a-front-east','wz-planks',2590,4200,'site-a'],
 ['site-b-west','wz-ruin',5660,4250,'site-b'],['site-b-east','wz-corner',6990,3860,'site-b'],
 ['site-b-front','wz-barrels',6430,4210,'site-b'],
 ['mid-west','wz-ruin',3490,2180,'mid'],['mid-east','wz-planks',4910,2180,'mid'],
];
for(const args of stations)cover(...args);
for(const [id,x,y]of [['privacy-nw',1900,1850],['google-ne',6500,1850],['privacy-sw',1900,5650],['google-se',6500,5650]]){
 cover(id+'-left','wz-sacks',x-280,y+90,id);
 cover(id+'-right','wz-planks',x+560,y+40,id);
}
for(const [key,x,y,source]of [
 ['west-shell',2810,3260,'/pixi-art/home-hamlets/clovercrust/cottage-blue-roof.svg'],
 ['east-shell',5670,4650,'/pixi-art/home-hamlets/clovercrust/cottage-blue-roof.svg'],
 ['south-shell',3250,5900,'/pixi-art/home-hamlets/lanternleaf/house-blue.svg'],
 ['north-shell',5100,2850,'/pixi-art/home-hamlets/clovercrust/cottage-blue-roof.svg'],
]){
 const id='wz-'+key;facade(id,source,true);
 art.props.push({id,name:'boarded-cottage',src:`home/${id}.svg`,x,y,width:360,height:320,scale:1,anchor:{x:.5,y:1},shadow:true,shadowSize:[115,20],shadowOffset:[0,-13],wind:false,homeSource:source,author:owner,area:key});
 blockers.push({id,kind:'building',type:'rect',x:x-129.6,y:y-134.4,width:259.2,height:121.6,author:owner,prop:id});
 layout.routes.push({id:id+'-door',width:104,points:[[x,y-12],[x,y+160]],author:owner});
}
const clumps=[
 ['nw-flank',1190,2180,'lime'],['ne-flank',7100,2280,'sage'],
 ['sw-flank',1090,6120,'orchid'],['se-flank',7170,6140,'teal'],
 ['north-w',2780,2430,'teal'],['north-e',5700,2150,'sage'],
 ['west-pond',920,2990,'orchid'],['east-pond',7380,3070,'lime'],
 ['west-loop',1060,4750,'lime'],['east-loop',7390,4850,'teal'],
 ['site-a-corner',2880,3970,'lime'],['site-b-corner',6900,4370,'orchid'],
 ['site-a-back',2840,3530,'orchid'],['site-b-back',6640,3090,'lime'],
 ['mid-west',3240,2600,'orchid'],['mid-east',5080,2470,'sage'],
 ['spine-west',3840,3940,'teal'],['spine-east',4800,5120,'orchid'],
 ['south-west',2700,5820,'lime'],['south-east',5690,5690,'teal'],
 ['cove-west',3460,6580,'lime'],['cove-east',5140,6570,'orchid'],
];
const shapes=[[2,-78,-16,168,110],[4,53,-10,140,100],[1,-15,39,130,100],[3,97,42,116,104]];
for(const [id,x,y,colour]of clumps)for(const [n,dx,dy,w,h]of shapes){
 const p={id:`hide-${id}-${n}`,name:`bush-${n}-${colour}`,src:`home/bush-${n}-${colour}.svg`,x:x+dx,y:y+dy,width:w,height:h,scale:1,anchor:{x:.5,y:1},shadow:true,shadowSize:[w*.3,8],shadowOffset:[0,-4],wind:true,homeSource:`/pixi-art/plants/bush-${n}.svg`,hideBush:true,hideClump:id,author:owner,area:id};
 art.props.push(p);
}
for(const p of art.props.filter(p=>p.id.startsWith('site-bed-')&&p.name.startsWith('bush-'))){
 const positions={'site-bed-a-west-bush':[1470,3765],'site-bed-a-east-bush':[2590,3500],'site-bed-b-west-bush':[5800,3870],'site-bed-b-east-bush':[6780,3810]};
 if(positions[p.id])[p.x,p.y]=positions[p.id];
 p.hideBush=true;p.hideClump=p.id;
}
const plantingMoves=[
 ['mid-shrub-east',4870,2010],['mid-bed-plant-sw',3400,2550],['mid-bed-plant-se',4980,2580],['grove-27-tree-3',3060,4140],['fb-west-pond-bend-tree-1',2740,2970],
 ['grove-17-tree-0',800,3100],['grove-17-tree-1',1160,2590],
 ['grove-18-tree-3',1800,3050],['grove-18-bush-0',1620,3040],
 ['grove-26-tree-0',750,4100],['grove-26-tree-1',625.78,4133.38],
 ['grove-26-tree-2',766.17,4199.68],['grove-26-tree-3',820,4400],
 ['grove-34-tree-5',1100,4970],['grove-34-bush-1',1250,4880],
 ['grove-24-tree-1',7690,3110],
 ['grove-31-tree-0',7520,3790],['grove-31-tree-2',7600,3860],
 ['grove-31-tree-4',7600,4030],['grove-31-tree-5',7540,4100],
 ['grove-32-tree-0',7740,4500],['grove-32-tree-1',7770,4420],
 ['grove-58-tree-0',4770,2840],['grove-58-tree-1',4700,2980],['grove-58-tree-5',4840,3010],
 ['fb-southwest-inner-tree-2',3730,6090],['grove-60-tree-1',4980,5660],
 ['grove-45-tree-0',1822.02,6230.56],['grove-45-tree-1',1950,6130],['grove-45-tree-2',2120,6250],
 ['grove-45-tree-3',1915.62,6331.96],['grove-45-tree-4',2056.02,6355.36],
 ['grove-49-tree-1',6859.53,6280],['grove-48-tree-0',6220,6390],['grove-48-tree-1',6400,6320],
 ['grove-15-tree-3',7330,1700],['grove-15-tree-0',7240,1540],
];
for(const [id,x,y]of plantingMoves){
 const p=art.props.find(p=>p.id===id);if(!p)throw Error('Missing planting '+id);
 const dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;
 const ids=[id+'-trunk',id.replace('-tree-','-trunk-')];
 const b=blockers.find(b=>ids.includes(b.id));
 if(b){b.x=+(b.x+dx).toFixed(2);b.y=+(b.y+dy).toFixed(2);}
}
map.world.obstacles=blockers.map(b=>({id:b.id,poly:poly(b)}));
map.sleepers=[];
layout.blockers=blockers;
layout.props=art.props.map(p=>({...p}));
layout.flats=art.flats.map(p=>({...p}));
layout.warzone={brief:'BUILD4-warzone.md',coverStations:stations.length+8,hideClumps:clumps.length,notes:'Apply warzone.mjs last; earlier decor overlays are superseded.'};
save(root+'art.json',art);save('src/pixi/bog-blockers.json',blockers);save('scripts/bog-environment/layout.json',layout);
fs.writeFileSync('src/pixi/bog-environment.json',JSON.stringify(map)+'\n');
console.log(JSON.stringify({removed:removed.size,addedCover:stations.length+8,boardedBuildings:4,hideBushes:art.props.filter(p=>p.hideBush).length,props:art.props.length,solids:blockers.filter(b=>b.kind!=='tree').length}));
