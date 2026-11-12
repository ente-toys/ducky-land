import fs from 'node:fs';

const file='src/pixi/home-expansion.json';
const E=JSON.parse(fs.readFileSync(file));
const sizes={'tree-1':[260,360],'tree-2':[180,360],'tree-3':[300,380],'tree-4':[200,280],'tree-5':[150,380],'bush-1':[130,100],'bush-2':[168,110],'bush-3':[116,104],'bush-4':[140,100],'flower-1':[48,36],'flower-2':[48,36],'flower-3':[44,36]};
E.props=E.props.filter(p=>!String(p.id).startsWith('p2-garden-'));
const groups={
  'northwest':[
    ['tree-4',-1060,-510,1.15],['tree-2',-1190,-570,1.04],['tree-5',-910,-450,.92],
    ['bush-2',-1240,-475,1.15],['bush-1',-1085,-365,1.1],['bush-4',-925,-340,1],
    ['flower-3',-1220,-360,1.65],['flower-1',-1135,-305,1.65],['flower-3',-1020,-275,1.7],
    ['bush-3',-585,-490,1.2],['bush-2',-390,-455,1.15],['flower-2',-475,-385,1.65],
  ],
  'pearbutton':[
    ['tree-4',330,-700,1.04],['tree-5',460,-710,1.06],['tree-4',1470,-470,1.1],
    ['bush-2',390,-585,1.15],['bush-4',520,-520,1.15],['bush-1',1370,-430,1.1],
    ['bush-3',1505,-355,1.0],['flower-3',375,-500,1.7],['flower-1',1420,-335,1.7],
    ['flower-1',1525,-285,1.5],
  ],
  'north-ridge':[
    ['tree-4',2250,-1210,1.1],['tree-1',2455,-1180,.97],['tree-5',2610,-1125,1.04],
    ['bush-2',2220,-1110,1.15],['bush-4',2415,-1055,1.0],['bush-1',2620,-1035,1.0],
    ['flower-3',2290,-1030,1.65],['flower-1',2525,-995,1.6],
    ['tree-2',3900,-1110,1.02],['tree-4',4070,-1080,1.0],['tree-5',4220,-1030,1.04],
    ['bush-2',3720,-1060,1.1],['bush-4',4060,-955,1.1],['bush-1',4245,-955,1.0],
    ['flower-1',4000,-1050,1.7],['flower-3',4190,-885,1.6],
  ],
  'east-farm-rim':[
    ['tree-4',6750,-500,1.15],['tree-2',6925,-440,.98],['tree-5',7050,-330,1.0],
    ['bush-2',6690,-400,1.1],['bush-4',6875,-315,1.15],['bush-1',7060,-235,1.0],
    ['flower-3',6730,-300,1.7],['flower-1',6980,-205,1.6],
    ['bush-2',6150,-90,1.15],['bush-4',6300,-30,1.1],['flower-3',6210,45,1.7],
  ],
  'cider-west':[
    ['tree-4',-1725,1030,1.05],['tree-5',-1580,1150,1.02],['tree-2',-1830,1300,1],
    ['bush-2',-1820,1430,1.2],['bush-4',-1660,1490,1.1],['bush-3',-1500,1520,1.05],
    ['flower-3',-1760,1530,1.7],['flower-1',-1610,1590,1.8],['flower-3',-1460,1600,1.6],
    ['bush-4',-1270,1450,1.1],['flower-1',-1170,1500,1.65],
  ],
  'cider-south':[
    ['tree-4',-1370,2470,1.1],['tree-1',-1160,2550,1.04],['tree-5',-990,2540,1.03],
    ['bush-2',-1430,2560,1.2],['bush-4',-1255,2640,1.2],['bush-1',-1060,2670,1.0],
    ['flower-1',-1375,2680,1.7],['flower-3',-1210,2740,1.7],['flower-1',-980,2730,1.6],
    ['bush-3',-570,2480,1.1],['bush-4',-410,2535,1.0],['flower-3',-495,2610,1.7],
  ],
  'west-bank':[
    ['bush-2',-1920,2225,1.1],['bush-4',-1800,2280,1.1],['bush-1',-1640,2315,1.05],
    ['flower-3',-1830,2365,1.7],['flower-1',-1690,2400,1.7],
    ['tree-4',-1810,2960,1.0],['tree-5',-1645,3020,.96],
    ['bush-2',-1865,3050,1.1],['bush-4',-1695,3125,1.1],['flower-3',-1800,3150,1.7],
  ],
  'east-upland':[
    ['tree-4',7050,690,1.1],['tree-2',7310,810,.98],['tree-5',7400,940,1],
    ['bush-2',6930,800,1.2],['bush-4',7105,870,1.1],['bush-1',7320,1000,1.1],
    ['flower-1',7000,920,1.8],['flower-3',7190,975,1.7],['flower-1',7380,1070,1.7],
    ['bush-4',6900,1570,1.1],['bush-2',7060,1570,1.15],['flower-3',6965,1610,1.7],
  ],
  'willow-shore':[
    ['bush-4',7190,2540,1.2],['bush-1',7350,2620,1.1],['bush-3',7425,2750,1.1],
    ['flower-3',7250,2660,1.7],['flower-1',7350,2810,1.7],['flower-3',7405,2890,1.6],
    ['tree-4',7200,3070,1.02],['tree-5',7340,3190,.95],
    ['bush-2',7140,3150,1.1],['bush-4',7310,3280,1.1],['flower-3',7200,3260,1.8],
    ['bush-3',6155,3540,1.0],['bush-4',6320,3600,1.15],['bush-2',6485,3560,1.1],
    ['flower-1',6240,3660,1.7],['flower-3',6450,3640,1.7],
  ],
  'southeast-clearing':[
    ['tree-4',6690,3890,1.15],['tree-2',6865,3975,1.05],['tree-5',7020,4040,.97],
    ['bush-2',6595,3985,1.2],['bush-4',6790,4090,1.15],['bush-3',7000,4135,1.15],
    ['flower-3',6630,4110,1.7],['flower-1',6830,4190,1.8],['flower-3',7060,4195,1.6],
    ['bush-2',7245,4040,1.1],['bush-4',7370,4140,1.1],['flower-1',7280,4220,1.7],
    ['tree-4',5710,4690,1.05],['tree-5',5890,4800,.98],
    ['bush-2',5655,4780,1.1],['bush-4',5815,4890,1.15],['flower-3',5735,4920,1.7],
  ],
  'petal-south':[
    ['bush-2',-1540,4820,1.2],['bush-4',-1360,4880,1.15],['bush-3',-1210,4860,1.05],
    ['flower-3',-1450,4945,1.7],['flower-1',-1270,4960,1.7],
    ['tree-4',-840,4820,1.1],['tree-5',-660,4915,1.03],['tree-2',-510,4850,1.04],
    ['bush-2',-930,4920,1.15],['bush-4',-770,5010,1.15],['bush-1',-560,4970,1.1],
    ['flower-1',-900,5035,1.8],['flower-3',-680,5080,1.8],
  ],
  'hay-coast':[
    ['tree-4',1200,5485,1.05],['tree-1',1390,5510,.96],['tree-5',1540,5485,1],
    ['bush-2',1120,5580,1.15],['bush-4',1330,5630,1.15],['bush-1',1540,5595,1.1],
    ['flower-3',1195,5670,1.7],['flower-1',1430,5690,1.7],
    ['bush-2',345,5420,1.15],['bush-4',530,5440,1.1],['flower-3',425,5490,1.7],
    ['bush-2',2800,5010,1.1],['bush-4',2980,5060,1.0],['flower-3',2890,5140,1.7],
  ],
  'river-garden':[
    ['bush-4',2070,3980,1.15],['bush-2',2200,3980,1.15],['bush-3',2360,4010,1.1],
    ['flower-1',2100,4030,1.75],['flower-3',2290,4090,1.75],
    ['bush-4',2980,4070,1.05],['flower-3',2990,4160,1.7],
    ['bush-2',1990,4385,1.1],['bush-4',2170,4420,1.1],['flower-1',2055,4480,1.7],
  ],
  'library-arrival':[
    ['bush-4',2575,1500,1.05],['bush-2',2700,1580,1.05],['flower-3',2550,1575,1.65],
    ['bush-2',3175,1540,1.1],['bush-4',3295,1560,1.05],['flower-1',3255,1620,1.65],
  ],
  'farm-garden':[
    ['bush-2',4555,-720,.95],['bush-4',4600,-590,.88],['flower-1',4490,-600,1.5],
    ['bush-4',5370,-765,.95],['bush-1',5460,-640,.95],['flower-3',5400,-565,1.6],
  ],
  'quay-shoulder':[
    ['bush-2',5120,5445,1.05],['bush-4',5280,5485,1.0],['flower-3',5195,5555,1.6],
    ['bush-3',3500,5120,.95],['flower-1',3420,5190,1.5],
  ],
};
for(const [group,plants] of Object.entries(groups))plants.forEach(([asset,x,y,scale],i)=>{
  const [width,height]=sizes[asset];
  E.props.push({id:`p2-garden-${group}-${i}`,name:asset,asset,src:`/pixi-art/plants/${asset}.svg`,x,y,width,height,scale,anchor:{x:.5,y:1},resolution:1.5,zone:'authored-garden'});
});

if(!E.pass2TextureEdited){
  const quiet=[[-1050,1750,520,430],[-600,-580,650,300],[1950,-1130,800,220],
    [4200,-1150,850,180],[6820,500,600,520],[6800,3080,650,500],
    [6530,4180,650,430],[970,5280,920,400],[-1000,4860,720,340],[2580,4210,550,320]];
  E.groundDecals=E.groundDecals.filter((d,i)=>{
    if(!quiet.some(([x,y,rx,ry])=>((d.x-x)/rx)**2+((d.y-y)/ry)**2<1))return true;
    const near=E.props.some(p=>/^(tree|bush)-/.test(p.asset??'')&&Math.hypot(p.x-d.x,(p.y-d.y)*1.4)<180);
    return near||i%4===0;
  });
  E.pass2TextureEdited=true;
}
fs.writeFileSync(file,JSON.stringify(E,null,2)+'\n');
console.log('Pass 2 authored plants:',Object.values(groups).reduce((n,g)=>n+g.length,0));

const kiosk='public/pixi-art/home-review/beach-kiosk.svg';
let svg=fs.readFileSync(kiosk,'utf8').replace(/<g id="p2-kiosk-joinery"[\s\S]*?<\/g>/,'');
svg=svg.replace('</g></svg>',`<g id="p2-kiosk-joinery" stroke="#39472d" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M54 119H262V132Q168 145 54 132Z" fill="#735333" stroke="none"/>
  <path d="M56 136V184M259 136V184" fill="none" stroke="#b99258" stroke-width="4"/>
  <path d="M42 222H194V229H42Z M42 236H273V244H42Z" fill="#c69a59" stroke="none"/>
  <path d="M45 232H271M155 203V233M199 224V234M246 226V234" fill="none" stroke="#af854c"/>
  <path d="M34 197H282V203H34Z" fill="#fff0c7" stroke="none"/>
  <path d="M180 189V175H191V189M196 189V169H207V189M212 189V176H223V189" fill="#ead49c"/>
  <path d="M179 176H192M195 170H208M211 177H224" fill="none" stroke="#d09a5b" stroke-width="3"/>
  <path d="M160 166H169V190H160Z" fill="#9dd3cb"/><path d="M163 168V185" fill="none" stroke="#dbf0d4" stroke-width="2"/>
  <path d="M64 240H86M224 240H248" fill="none" stroke="#f0c77d"/>
</g></g></svg>`);
fs.writeFileSync(kiosk,svg);
