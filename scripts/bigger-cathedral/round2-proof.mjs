import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
export const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/round3/bellovo';
fs.mkdirSync(OUT,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read('public/pixi-art/themes/cathedral/art.json'),world=read('rive/web/themes/cathedral/world.json'),walk=read('rive/web/themes/cathedral/walk-world.json'),harbor=read('rive/web/themes/cathedral/harbor.json');
for(const p of art.props.filter(p=>p.shadow===true&&p.shadowSize)){
 const [rx,ry]=p.shadowSize,[dx,dy]=p.shadowOffset??[0,0];art.flats.push({src:'villages/plant-shadow.svg',x:p.x+dx-rx,y:p.y+dy-ry,width:rx*2,height:ry*2,topLeft:true});
}
const views=[
 ['whole',-2200,-2400,.14,1792,1456],
 ['centre',2690,590,.62,1810,1922],
 ['olive',3770,2170,1.8,1188,1170],
 ['joins',3390,1430,1.3,1703,585],
 ['bellpeep',2740,-1480,.85,1802,1530],
 ['olivello',-1250,1830,.85,1658,1445],
 ['tessera',7480,1770,.85,1785,1530],
 ['crumbbell',3270,5800,.85,1700,1700],
 ['lawn',-900,700,1.2,1560,1200]
];
for(const [name,x,y,k,width,height]of views){fs.writeFileSync(`${OUT}/${name}.png`,await render(art,{x,y,k,width,height,world,walk,harbor}));console.log(name);}
const buildings=art.props.filter(p=>p.door),layers=[];
for(const [i,p]of buildings.entries()){
 const input=await sharp('public/pixi-art/themes/cathedral/'+p.src).resize(420,360,{fit:'contain',background:'#a2b542'}).png().toBuffer();layers.push({input,left:(i%4)*440,top:Math.floor(i/4)*380});
}
await sharp({create:{width:1760,height:1520,channels:4,background:'#a2b542'}}).composite(layers).png().toFile(OUT+'/houses-sheet.png');
fs.writeFileSync(OUT+'/renders.json',JSON.stringify({method:'Offline production SVG/manifest composites, not live browser captures.',views},null,2));
