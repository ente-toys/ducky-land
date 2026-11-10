import fs from 'node:fs';
import {render} from './render.mjs';
const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-review/fix/life/';
const read=p=>JSON.parse(fs.readFileSync(p)),before=process.argv.includes('--before');
const source=before?'scripts/bigger-cathedral/life-source/':null;
const art=read(source?source+'art.json':A+'art.json'),world=read(source?source+'world.json':D+'world.json'),walk=read(source?source+'walk-world.json':D+'walk-world.json');
// The base offline renderer omits runtime contact shadows. Reproduce them with
// the existing flat ellipse, without modifying the production art manifest.
for(const p of art.props.filter(p=>p.shadow===true&&p.shadowSize)){
 const [rx,ry]=p.shadowSize,[dx,dy]=p.shadowOffset??[0,0];
 art.flats.push({src:'villages/plant-shadow.svg',x:p.x+dx-rx,y:p.y+dy-ry,width:rx*2,height:ry*2,topLeft:true});
}
fs.mkdirSync(out,{recursive:true});
for(const [name,x,y,k,width,height]of [['whole',-2200,-2400,.16,2048,1664],['grove',-1000,450,.8,1760,1200],['well',3050,2000,.85,1785,1275],['fountain',3530,3750,1,1140,1140]]){
 fs.writeFileSync(out+(before?'before-':'after-')+name+'.png',await render(art,{x,y,k,width,height,world,walk,harbor:read(D+'harbor.json')}));
}
console.log('Life proof: '+(before?'before':'after'));
