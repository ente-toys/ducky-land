import sharp from 'sharp';import {readFileSync,writeFileSync} from 'node:fs';import {inPoly} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/goldmine/',k=.25;
const old=JSON.parse(readFileSync('scripts/bigger-goldmine/original/world.json'));
const source=await sharp(A+'ground.svg',{density:18}).ensureAlpha().raw().toBuffer();
const art=JSON.parse(readFileSync(A+'art.json'));const layers=[];for(const t of art.ground.tiles){layers.push({input:await sharp(A+t.src,{density:18}).png().toBuffer(),left:Math.round((t.x+2300)*k),top:Math.round((t.y+2100)*k)});}
const whole=await sharp({create:{width:3150,height:2475,channels:4,background:'#6EC9DE'}}).composite(layers).png().toBuffer();
const built=await sharp(whole).extract({left:575,top:525,width:2000,height:1500}).ensureAlpha().raw().toBuffer();
const isDry=(x,y)=>inPoly(x,y,old.coast)||old.islets.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1);
let checked=0,different=0,maxDelta=0;
for(let y=0;y<1500;y++)for(let x=0;x<2000;x++){
 const wx=(x+.5)/k,wy=(y+.5)/k;
 if(![[0,0],[-20,0],[20,0],[0,-20],[0,20]].every(([dx,dy])=>isDry(wx+dx,wy+dy)))continue;
 const i=(y*2000+x)*4;if(source[i+3]!==255)continue;checked++;
 const d=Math.max(...[0,1,2,3].map(c=>Math.abs(source[i+c]-built[i+c])));maxDelta=Math.max(maxDelta,d);if(d>0)different++;
}
const r={checked,different,maxDelta,method:'Actual production tile assembly vs untouched original at 0.25 px/unit, opaque dry interior with 20-unit coast inset. Ground comparison only; prop records are separately deep-equal tested.'};
writeFileSync('scripts/bigger-goldmine/pixel-proof.json',JSON.stringify(r,null,2)+'\n');console.log(r);
