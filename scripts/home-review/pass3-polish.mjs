import fs from 'node:fs';

const cx=2820,cy=2370;
const pt=(rx,ry,a)=>[cx+rx*Math.cos(a),cy+ry*Math.sin(a)].map(n=>n.toFixed(2)).join(' ');
const sector=(ro,yo,ri,yi,a,b)=>`M${pt(ro,yo,a)}A${ro} ${yo} 0 0 1 ${pt(ro,yo,b)}L${pt(ri,yi,b)}A${ri} ${yi} 0 0 0 ${pt(ri,yi,a)}Z`;
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="980" height="780" viewBox="2330 1980 980 780" stroke-linejoin="round">';
svg+='<ellipse cx="2820" cy="2370" rx="470" ry="360" fill="#fde48c"/>';
const colors=['#fde48c','#fff0c7','#f4db86','#fde48c','#f9e6a6','#fde48c','#fff0c7'];
for(const [ring,[ro,yo,ri,yi,n]] of [[454,348,377,289,32],[377,289,300,230,28],[300,230,224,171,24]].entries()){
  const phase=(ring%2)*Math.PI/n;
  for(let i=0;i<n;i++){
    const a=i*Math.PI*2/n+phase,b=(i+1)*Math.PI*2/n+phase;
    svg+=`<path d="${sector(ro,yo,ri,yi,a,b)}" fill="${colors[(i+ring*2)%colors.length]}" stroke="#39472d" stroke-opacity=".4" stroke-width=".85"/>`;
  }
}
svg+='<ellipse cx="2820" cy="2370" rx="460" ry="352" fill="none" stroke="#fff0c7" stroke-width="6"/>';
svg+='</svg>';
fs.writeFileSync('public/pixi-art/decals/plaza-paving.svg',svg);

const file='src/pixi/home-expansion.json',E=JSON.parse(fs.readFileSync(file));
E.props=E.props.filter(p=>!String(p.id).startsWith('p3-garden-'));
const sizes={'tree-1':[260,360],'tree-2':[180,360],'tree-3':[300,380],'tree-4':[200,280],'tree-5':[150,380],'bush-1':[130,100],'bush-2':[168,110],'bush-3':[116,104],'bush-4':[140,100],'flower-1':[48,36],'flower-2':[48,36],'flower-3':[44,36]};
const scenes={
  'pond-north':[
    ['bush-4',1540,2305,1.08],['bush-2',1685,2300,1.08],
    ['flower-1',1530,2345,1.55],['flower-3',1630,2330,1.65],
    ['flower-1',1740,2340,1.45],
    ['bush-3',2000,2205,.95],['bush-4',2115,2230,.92],
    ['flower-3',2005,2260,1.6],['flower-1',2115,2280,1.55],
  ],
  'pond-west':[
    ['bush-2',1045,2865,1.0],['bush-4',1050,2935,.96],
    ['flower-3',1010,2915,1.7],['flower-1',1040,2985,1.7],
    ['flower-3',945,2975,1.5],
  ],
  'pond-south':[
    ['bush-4',2190,3280,1.05],['bush-3',2070,3310,.98],
    ['flower-1',2180,3330,1.65],['flower-3',2040,3350,1.7],
  ],
  'south-bank':[
    ['bush-2',1650,4250,1.1],['bush-4',1780,4290,1.0],
    ['flower-1',1645,4315,1.7],['flower-3',1755,4350,1.6],
  ],
  'farm-border':[
    ['bush-4',4670,-865,.95],['bush-2',4805,-880,.94],
    ['bush-1',4955,-870,.94],['bush-4',5090,-850,.9],
    ['flower-1',4680,-810,1.5],['flower-3',4810,-820,1.55],
    ['flower-1',4940,-810,1.45],['flower-3',5085,-795,1.5],
  ],
  'lantern-shoulder':[
    ['bush-2',3640,220,1.0],['bush-4',3760,245,.92],
    ['flower-3',3635,280,1.6],['flower-1',3745,300,1.55],
  ],
  'cider-clearing':[
    ['bush-2',-780,1675,1.1],['bush-4',-630,1710,1],
    ['bush-3',-505,1740,.96],['flower-1',-775,1740,1.75],
    ['flower-3',-625,1775,1.7],['flower-1',-480,1795,1.6],
  ],
  'willow-clearing':[
    ['bush-4',6730,2760,1.05],['bush-2',6865,2800,1.05],
    ['bush-3',6990,2850,.95],['flower-3',6720,2820,1.7],
    ['flower-1',6850,2865,1.75],['flower-3',6990,2910,1.6],
  ],
};
for(const [scene,plants] of Object.entries(scenes))plants.forEach(([asset,x,y,scale],i)=>{
  const [width,height]=sizes[asset];
  E.props.push({id:`p3-garden-${scene}-${i}`,name:asset,asset,src:`/pixi-art/plants/${asset}.svg`,x,y,width,height,scale,anchor:{x:.5,y:1},resolution:1.5,zone:'authored-garden'});
});
fs.writeFileSync(file,JSON.stringify(E,null,2)+'\n');
console.log('Pass 3:',Object.values(scenes).reduce((n,s)=>n+s.length,0),'authored plants, shared-contour plaza paving.');
