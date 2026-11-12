import fs from 'node:fs';import {inPoly} from '../../assets/world/island-geometry.mjs';
const p=JSON.parse(fs.readFileSync('scripts/bigger-neon/plan.json')),old=JSON.parse(fs.readFileSync('scripts/bigger-neon/baseline/world.json'));
const inside=(x,y)=>inPoly(x,y,old.coast)||old.islets.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1);
for(const t of p.props){const w=t.width*t.scale,h=t.height*t.scale,x0=t.x-w*t.anchor.x,y0=t.y-h*t.anchor.y;let n=0;for(let y=y0;y<y0+h;y+=25)for(let x=x0;x<x0+w;x+=25)if(inside(x,y))n++;if(n)console.log(t.id,t.src,t.x,t.y,n);}
