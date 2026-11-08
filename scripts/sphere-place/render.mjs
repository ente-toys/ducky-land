// Headless native OpenGL proof using production GLSL and production island previews.
// These are not browser captures or measurements of the live Pixi engine.
import sharp from 'sharp';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {WORLD_ISLANDS,WORLD_GEO} from '../../src/pixi/world-map.js';
import {mapOf} from '../../src/pixi/island-maps.js';
import {spherePoint,localPoint,viewFrame} from '../../src/pixi/sphere-coordinates.js';
import {sphereFrame} from '../../src/pixi/sphere.js';
const out='../concepts/themes/world-map/sphere',tmp='/private/tmp/ducky-sphere';mkdirSync(out,{recursive:true});mkdirSync(tmp,{recursive:true});
execFileSync('clang',['-Wno-deprecated-declarations','-Wno-incompatible-pointer-types','scripts/sphere-place/offscreen.m','-framework','Foundation','-framework','OpenGL','-o',`${tmp}/offscreen`]);
const source=readFileSync('src/pixi/world-view.js','utf8'),frag=source.match(/const FRAGMENT = `([\s\S]*?)`;/)[1];writeFileSync(`${tmp}/fragment.glsl`,frag);
const layers=await Promise.all(WORLD_ISLANDS.map(async(i,k)=>({input:await sharp(`public/pixi-art/globe/${i.theme??'home'}.png`).resize(510,510,{fit:'fill'}).toBuffer(),left:k%4*512+1,top:Math.floor(k/4)*512+1})));
writeFileSync(`${tmp}/atlas.rgba`,await sharp({create:{width:2048,height:2048,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).raw().toBuffer());
writeFileSync(`${tmp}/scene.rgba`,Buffer.alloc(16));
const W=1400,H=1000,R=WORLD_GEO.Rw,evidence=[];
for(const [name,lon,lat,id,zoom]of [
 ['front',0,0,'home',.43*H/R],['back',180,0,'home',.43*H/R],['left',-90,0,'home',.43*H/R],['right',90,0,'home',.43*H/R],['top',0,90,'home',.43*H/R],['bottom',0,-90,'home',.43*H/R],
 ['mid-home',0,0,'home',.065],['mid-iceland',0,90,'isle-55',.065],
]){
 const m=mapOf(id),anchor=WORLD_ISLANDS.find(i=>i.id===id),focus=sphereFrame(lon*Math.PI/180,lat*Math.PI/180).center,cam=localPoint(id,focus),view=viewFrame(id,cam);
 let scene={path:`${tmp}/scene.rgba`,width:2,height:2};
 if(name.startsWith('mid')){
  const preview=`public/pixi-art/globe/${anchor.theme??'home'}.png`,width=Math.round(m.width*zoom),height=Math.round(m.height*zoom);
  writeFileSync(`${tmp}/${name}-scene.rgba`,await sharp({create:{width:W,height:H,channels:4,background:{r:110,g:201,b:222,alpha:1}}}).composite([{input:await sharp(preview).resize(width,height,{fit:'fill'}).toBuffer(),left:Math.round(W/2-width/2),top:Math.round(H/2-height/2)}]).raw().toBuffer());
  scene={path:`${tmp}/${name}-scene.rgba`,width:W,height:H};
 }
 const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 const floor=.43*H/R,top=.95*Math.min(W/m.width,H/m.height),t=Math.max(0,Math.min(1,Math.log(top/zoom)/Math.log(top/floor))),ball=ease(t)*ease((4-R*zoom/H)/3);
 const uniforms={uBall:[ball],uDetail:[1-ease(t/.7)],uTime:[1],uZoom:[zoom],uCam:[cam.x,cam.y],uRes:[W,H],uR:[R*zoom/H],uSea:[110/255,201/255,222/255],uSph:[m.cx,m.cy,R],
  uAnchor:anchor.center,uEast:anchor.east,uNorth:anchor.north,uFocus:view.center,uViewEast:view.east,uViewNorth:view.north,
  uCenters:WORLD_ISLANDS.flatMap(i=>i.center),uEasts:WORLD_ISLANDS.flatMap(i=>i.east),uNorths:WORLD_ISLANDS.flatMap(i=>i.north),uSizes:WORLD_ISLANDS.flatMap(i=>[i.width,i.height,Math.cos(Math.hypot(i.width,i.height)/2/R),0])};
 const job={fragment:`${tmp}/fragment.glsl`,atlas:{path:`${tmp}/atlas.rgba`,width:2048,height:2048},scene,width:W,height:H,uniforms,output:`${tmp}/${name}.rgba`};
 writeFileSync(`${tmp}/job.json`,JSON.stringify(job));
 try{
  const result=execFileSync(`${tmp}/offscreen`,[`${tmp}/job.json`],{encoding:'utf8'});console.log(name,result.trim());
  const label=Buffer.from(`<svg width="${W}" height="${H}"><g fill="#fff0c7" font-family="Arial"><text x="24" y="34" font-size="21">${name.toUpperCase()} · 13 sphere patches · circumference 98,271</text><text x="24" y="978" font-size="15">Native offscreen OpenGL · production fragment shader and previews · ${name.startsWith('mid')?'static preview detail input':'sphere overview'} · not a browser capture</text></g></svg>`);
  await sharp(readFileSync(job.output),{raw:{width:W,height:H,channels:4}}).flip().composite([{input:label,left:0,top:0}]).png().toFile(`${out}/${name}.png`);
  evidence.push({name,renderer:result.trim(),camera:cam,zoom,kind:'Native offscreen OpenGL, production GLSL with static preview inputs'});
 }catch(e){writeFileSync(`${out}/render-blocked.txt`,String(e.stderr??e));throw e;}
}
writeFileSync(`${out}/renders.json`,JSON.stringify(evidence,null,2)+'\n');
writeFileSync(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><title>Sphere placement proof</title><style>body{background:#121738;color:#fff0c7;font:18px system-ui;margin:24px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{width:100%}</style><h1>Sphere placement</h1><p>Production fragment shader, rendered with a native offscreen OpenGL context. Preview art inputs. Browser startup is blocked by the sandbox, so these do not verify the live engine or its frame time.</p><main>${evidence.map(e=>`<figure><figcaption>${e.name}</figcaption><img src="${e.name}.png" alt="${e.name} sphere"></figure>`).join('')}</main></html>`);
