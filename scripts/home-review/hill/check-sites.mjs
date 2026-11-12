import fs from 'node:fs';import {geometry,inShape} from '../../../assets/world/island-geometry.mjs';
const S=JSON.parse(fs.readFileSync('scripts/home-review/hill/before.json'));const g=geometry(S.local);
for(const [x,y] of [[6200,1150],[6300,1200],[200,4450],[6500,1250],[6500,1000],[6100,650],[6000,200],[-450,4500]]){let bad=[];for(let a=-300;a<=300;a+=30)for(let b=-120;b<=120;b+=30)if((a/300)**2+(b/120)**2<1&&!g.walkable(x+a,y+b,16))bad.push([a,b]);console.log(x,y,'unwalkable',bad.length,bad.slice(0,4));}
