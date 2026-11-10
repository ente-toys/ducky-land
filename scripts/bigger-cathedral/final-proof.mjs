import fs from 'node:fs';
import {render} from './render.mjs';
import {A,D,read} from './final-model.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-review/fix/final/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
// Match runtime contact shadows without writing them into the manifest.
for(const p of art.props.filter(p=>p.shadow===true&&p.shadowSize)){
 const [rx,ry]=p.shadowSize,[dx,dy]=p.shadowOffset??[0,0];
 art.flats.push({src:'villages/plant-shadow.svg',x:p.x+dx-rx,y:p.y+dy-ry,width:rx*2,height:ry*2,topLeft:true});
}
const views=[
 ['whole',-2200,-2400,.2,2560,2080],
 ['01-centre',2640,480,.8,2336,2400],
 ['02-curved-arms',2660,1480,1.2,3504,1500],
 ['03-central-olive-well-benches',3170,2080,1.2,2232,1728],
 ['04-bellpeep',2700,-1450,1.2,2520,2100],
 ['05-olivello',-1280,1800,1.2,2340,2040],
 ['06-tessera',7460,1710,1.2,2520,2160],
 ['07-crumbbell-harbour',3270,5800,1.2,2400,2400],
 ['08-autumn-groves',-1180,380,1.2,2400,2100],
 ['09-northwest-mouth-bridges',1400,-480,1.2,2160,1980],
 ['10-southeast-channels-bridges',5250,4070,1.2,2520,2400],
];
fs.mkdirSync(out,{recursive:true});
for(const [name,x,y,k,width,height]of views){
 fs.writeFileSync(out+name+'.png',await render(art,{x,y,k,width,height,world,walk,harbor}));
 console.log(name);
}
fs.writeFileSync(out+'renders.json',JSON.stringify({method:'Offline production SVG/manifest composite with native vector rasterization at output resolution, runtime-equivalent contact shadows and all resolved sleepers. Not browser screenshots.',views:views.map(([name,x,y,k,width,height])=>({file:name+'.png',x,y,pixelsPerWorldUnit:k,width,height}))},null,2)+'\n');
