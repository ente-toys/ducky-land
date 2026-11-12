// Read-only snapshot of the actual Home placement code, rendered with the same .24 scale as Goldmine.
import {build} from 'esbuild';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import sharp from 'sharp';
import {geometry} from '../../assets/world/island-geometry.mjs';
const A='../concepts/themes/work/waterfall/',K=+(process.env.K||.65);
const result=await build({entryPoints:['src/pixi/placements.js'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'home-svg-urls',setup(b){b.onLoad({filter:/placements\.js$/},args=>({contents:readFileSync(args.path,'utf8').replace(/const urls = import\.meta\.glob\([^;]+;/,"const urls = new Proxy({}, {get: (_, key) => key.replace('../../', '/')});"),loader:'js'}));}}]});
const {createPlacements,decalsFor,JETTIES,walkWorld,trimWorld,sleepSpots}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const w=trimWorld(JSON.parse(readFileSync('assets/world/world.json'))),a=JSON.parse(readFileSync('src/pixi/art-manifest.json'));
const props=createPlacements(w,geometry({...w,obstacles:[]}).walkable);
const W=Math.round(w.width*K),H=Math.round(w.height*K),comps=[];
async function add(src,x,y,width,height,flip=false){
 const file=existsSync('public'+src)?'public'+src:src.replace(/^\//,'');
 const ww=Math.max(1,Math.round(width*K)),hh=Math.max(1,Math.round(height*K)),l=Math.round(x*K),t=Math.round(y*K);
 if(l>=W||t>=H||l+ww<=0||t+hh<=0)return;
 let im=sharp(file,{density:96}).resize(ww,hh,{fit:'fill'});if(flip)im=im.flop();
 let buf=await im.png().toBuffer();
 const left=Math.max(0,l),top=Math.max(0,t),cw=Math.min(ww-Math.max(0,-l),W-left),ch=Math.min(hh-Math.max(0,-t),H-top);
 if(cw<ww||ch<hh)buf=await sharp(buf).extract({left:Math.max(0,-l),top:Math.max(0,-t),width:cw,height:ch}).png().toBuffer();
 comps.push({input:buf,left,top});
}
for(const t of a.ground.tiles)await add(t.src,t.x,t.y,t.width,t.height);
await add('/pixi-art/lake-race.svg',3400,1050,1500,950);
await add('/pixi-art/decals/plaza-paving.svg',2330,1980,980,780);
const decals=decalsFor(w,props,geometry({...w,obstacles:[]}).walkable);
for(const d of decals)await add(d.src,d.x-d.width/2,d.y-d.height,d.width,d.height,d.flip);
for(const d of [...JETTIES,{src:'/pixi-art/library-steps.svg',x:2780,y:1370,width:280,height:260}])await add(d.src,d.x,d.y,d.width,d.height);
for(const p of props.sort((a,b)=>a.y-b.y))await add(p.src,p.x-p.width*p.scale*p.anchor.x,p.y-p.height*p.scale*p.anchor.y,p.width*p.scale,p.height*p.scale,p.flip);
await sharp({create:{width:W,height:H,channels:4,background:'#8FCAC7'}}).composite(comps).png().toFile(A+'waterfall-home-detail-source.png');
writeFileSync(A+'waterfall-home-metrics.json',JSON.stringify({scale:K,props:props.length,trees:props.filter(p=>/^tree-/.test(p.asset)).length,decals:decals.length,width:w.width,height:w.height},null,2));
console.log('Home source render',props.length,'props',decals.length,'decals',W,H);
