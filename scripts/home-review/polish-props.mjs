import fs from 'node:fs';
const file='src/pixi/home-expansion.json', E=JSON.parse(fs.readFileSync(file));
const art='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review/lighthouse/svg/';
if(fs.existsSync(art+'DONE')){
 for(const name of ['lighthouse.svg','lighthouse-shadow.svg','beam.svg'])fs.copyFileSync(art+name,'public/pixi-art/home-review/'+name);
 const x=4860,y=2600,k=1.3;
 E.reviewProps['46']={src:'/pixi-art/home-review/lighthouse.svg',anchor:{x:.5,y:1},noShadow:true,footprint:{x,y:y-34*k,rx:108*k,ry:34*k}};
 E.props=E.props.filter(p=>!['home-lighthouse-shadow','home-lighthouse-beam'].includes(p.id));
 E.props.push(
  {id:'home-lighthouse-shadow',name:'Lighthouse footing shadow',asset:'lighthouse-shadow',src:'/pixi-art/home-review/lighthouse-shadow.svg',x,y:y-34*k,width:240,height:76,scale:k,anchor:{x:.5,y:.5},z:y-2,noShadow:true,contact:false},
  {id:'home-lighthouse-beam',name:'Lighthouse lamplight',asset:'lighthouse-beam',src:'/pixi-art/home-review/beam.svg',x:x+52*k,y:y-397*k,width:360,height:230,scale:k,anchor:{x:0,y:.5},z:y-1,noShadow:true,contact:false,sweepPeriod:12,sweepAngle:.16}
 );
}

// A front-facing garden still needs depth: the two side rails now join the back
// and front corners diagonally, with their shared posts drawn in front of beds.
const garden='public/pixi-art/home-review/farm-enclosure.svg';
let svg=fs.readFileSync(garden,'utf8');
svg=svg.replace(/<g id="polish-joined-sides"[\s\S]*?<\/g>/,'');
svg=svg.replace('</g></svg>',`<g id="polish-joined-sides" fill="none" stroke="#39472d" stroke-linejoin="round"><path d="M40 58L25 193M40 76L25 211M660 58L675 193M660 76L675 211" stroke-width="8"/><path d="M40 58L25 193M40 76L25 211M660 58L675 193M660 76L675 211" stroke="#d3a15a" stroke-width="5"/><path d="M19 175H31V222H19Z M669 175H681V222H669Z" fill="#e3bb70" stroke-width="2"/><path d="M25 194H675M25 211H675" stroke="#b98844" stroke-width="7"/></g></g></svg>`);
fs.writeFileSync(garden,svg);

// Hand-placed grove edges. Each line is an authored position, never a scatter
// rule. Existing clearings, sleepers, work props and the sack feature stay put.
const sizes={'tree-1':[260,360],'tree-2':[180,360],'tree-3':[300,380],'tree-4':[200,280],'tree-5':[150,380],'bush-1':[130,100],'bush-2':[168,110],'bush-3':[116,104],'bush-4':[140,100],'flower-1':[48,36],'flower-2':[48,36],'flower-3':[44,36]};
E.props=E.props.filter(p=>!String(p.id).startsWith('polish-'));
const plants=[
 // North orchard: three overlapping crown heights, an uneven shrub skirt.
 ['orchard-birch','tree-5',1340,-650,.95],
 ['orchard-under1','bush-2',690,-470,1.1],['orchard-under2','bush-4',835,-420,1.1],['orchard-under3','bush-3',1190,-470,1.15],
 ['orchard-flower1','flower-1',615,-395,1.7],['orchard-flower2','flower-3',1280,-395,1.6],
 // North coastline: a sheltered crescent, open lawn towards the commons.
 ['north-birch','tree-5',1520,-1060,.95],['north-round','tree-1',1780,-1120,1.05],['north-lowtree','tree-4',1960,-980,.85],
 ['north-under1','bush-2',1450,-1010,1.2],['north-under2','bush-4',1740,-925,1.15],['north-under3','bush-1',1940,-900,1.1],
 ['north-flowers','flower-2',1560,-920,1.6],
 // Butterbill frame: pale blossom between darker canopy and the clear square.
 ['bread-under1','bush-3',-1700,260,1.1],['bread-under2','bush-4',-1580,300,1.0],['bread-under3','bush-3',-195,550,1.1],
 ['bread-flower1','flower-1',-1630,355,1.5],['bread-flower2','flower-2',-270,655,1.5],
 // West meadow groves: preserve the bench clearing between these two edges.
 ['west-under1','bush-2',-1560,2100,1.25],['west-under2','bush-4',-1400,2160,1.2],['west-under3','bush-1',-1280,2130,1.0],
 ['west-flower1','flower-1',-1490,2240,1.8],['west-flower2','flower-3',-1220,2220,1.6],
 ['west-south-under1','bush-3',-1730,2750,1.1],['west-south-under2','bush-2',-1590,2800,1.1],['west-south-flower','flower-2',-1660,2870,1.8],
 // Lanternleaf: carry the rose-coloured cottage planting to the two shoulders.
 ['lantern-under1','bush-3',2110,-320,1.1],['lantern-under2','bush-4',3500,-250,1.1],
 ['lantern-flowers1','flower-2',2200,-240,1.6],['lantern-flowers2','flower-3',3570,-170,1.6],
 // Clovercrust: productive garden edge; do not add fences across the lane.
 ['farm-under1','bush-1',4470,-300,1.0],['farm-under2','bush-4',5910,-450,1.0],
 ['farm-flower1','flower-1',4410,-220,1.6],['farm-flower2','flower-3',5985,-365,1.6],
 // East upland grove balances the farm without competing with the lighthouse.
 ['east-oak','tree-3',6590,520,1.05],['east-round','tree-1',6820,500,.95],['east-birch','tree-5',6980,590,.95],
 ['east-under1','bush-2',6480,560,1.2],['east-under2','bush-4',6660,640,1.2],['east-under3','bush-3',7050,670,1.1],
 ['east-flower1','flower-1',6430,650,1.6],['east-flower2','flower-3',6980,730,1.7],
 // Willowrest: low planting frames an open reading place, never the lane.
 ['willow-under1','bush-3',6150,3020,1.15],['willow-under2','bush-4',6650,3090,1.15],['willow-under3','bush-1',6780,3130,1.1],
 ['willow-flower1','flower-2',6075,3090,1.8],['willow-flower2','flower-1',6740,3195,1.7],
 // Petalpatch: blossom rhythm echoes the ceramics, clear gap at the water.
 ['pottery-under1','bush-3',-1740,4180,1.1],['pottery-under2','bush-4',-1580,4250,1.1],
 ['pottery-flowers','flower-2',-1660,4320,1.8],
 // South bank: a low meadow crescent, with the middle retained for walking.
 ['river-under1','bush-3',2630,3895,1.0],['river-under2','bush-1',2980,3915,1.0],['river-flower1','flower-2',2760,3970,1.7],
 // Southwest and southeast grove edges, not a continuous forest perimeter.
 ['southwest-under1','bush-2',-20,4920,1.2],['southwest-under2','bush-4',150,4990,1.1],['southwest-flower','flower-3',70,5050,1.8],
 ['southeast-under1','bush-2',5810,4530,1.2],['southeast-under2','bush-3',6030,4570,1.1],['southeast-flower','flower-1',5940,4640,1.7],
 // Harbour: ground the boatbuilding scene with a small landward planting edge.
 ['quay-under1','bush-4',4875,5220,1.1],['quay-flower','flower-3',4790,5290,1.5],
];
for(const [id,asset,x,y,scale] of plants){const [width,height]=sizes[asset];E.props.push({id:'polish-'+id,name:asset,asset,src:'/pixi-art/plants/'+asset+'.svg',x,y,width,height,scale,anchor:{x:.5,y:1},resolution:1.5,zone:'authored-polish'});}

// Reduce the even micro-pattern inside the large lawns. Keep the authored grove
// skirts and shore margins. These are decorative decals, never collision data.
if(!E.polishMicrotexture){
 const openings=[[-1050,1700,420,390],[6400,3900,720,480],[350,4750,450,320],[5300,200,350,260],[1000,-1050,350,220]];
 E.groundDecals=E.groundDecals.filter((d,i)=>!openings.some(([x,y,rx,ry])=>((d.x-x)/rx)**2+((d.y-y)/ry)**2<1&&i%3!==0));
 E.polishMicrotexture=true;
}
fs.writeFileSync(file,JSON.stringify(E,null,2)+'\n');
console.log('Polish:',plants.length,'hand-placed plants; lighthouse art, shadow, gentle beam; joined farm fence.');
