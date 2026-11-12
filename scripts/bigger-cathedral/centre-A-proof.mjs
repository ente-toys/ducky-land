// Faithful manifest assembly in the supplied boss-worst-centre framing.
// Live water is sampled directly from Home's Graphics commands, never drawn into game SVGs.
import fs from 'node:fs';
import path from 'node:path';
import {Container} from 'pixi.js';
import {createCanvas} from '@napi-rs/canvas';
import {createFountainWater} from '../../src/pixi/fountain.js';
import {render} from './render.mjs';
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/',read=p=>JSON.parse(fs.readFileSync(p));
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
const p=art.props.find(p=>p.id==='centre-A-fountain'),parent=new Container(),fx=createFountainWater(p,parent,null,p.fountainWater);
fx.update(7,false,true);
const canvas=createCanvas(960,650),ctx=canvas.getContext('2d');
for(const ins of fx.root.children[0].context.instructions){
 ctx.beginPath();
 for(const {action,data}of ins.data.path.instructions){
  if(action==='ellipse'){ctx.moveTo(data[0]+data[2],data[1]);ctx.ellipse(data[0],data[1],data[2],data[3],0,0,Math.PI*2);}
  else if(action==='circle'){ctx.moveTo(data[0]+data[2],data[1]);ctx.arc(data[0],data[1],data[2],0,Math.PI*2);}
  else if(action==='roundRect')ctx.roundRect(...data.slice(0,5));
  else if(['moveTo','lineTo','closePath','bezierCurveTo','quadraticCurveTo'].includes(action))ctx[action](...data);
  else throw Error('Unrecognised Home water command '+action);
 }
 const s=ins.data.style;ctx.globalAlpha=s.alpha;const color='#'+s.color.toString(16).padStart(6,'0');
 if(ins.action==='fill'){ctx.fillStyle=color;ctx.fill();}else{ctx.strokeStyle=color;ctx.lineWidth=s.width;ctx.stroke();}
}
fs.writeFileSync('/tmp/centre-A-home-water.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="650"><image width="960" height="650" href="data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}"/></svg>`);
// Evidence-only layer. The game assets remain pure vector and use live Home water.
const water={...p,id:'evidence-home-water',src:path.relative(A,'/tmp/centre-A-home-water.svg'),sortY:2730.5};
try{fs.writeFileSync('/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/round3/centre-A-after.png',await render({...art,props:[...art.props,water]},{x:1850,y:540,k:.4,width:1538,height:1262,world,walk,harbor}));}
finally{parent.destroy({children:true});}
console.log('Saved centre-A-after.png, 1538 × 1262, supplied centre framing');
