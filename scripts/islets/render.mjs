// Production GLSL in the existing native, windowless OpenGL harness.
import sharp from 'sharp';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {WORLD_ISLANDS,WORLD_GEO} from '../../src/pixi/world-map.js';
import {ISLETS,ISLET_ART} from '../../src/pixi/islets.js';
import {mapOf} from '../../src/pixi/island-maps.js';
import {localPoint,viewFrame} from '../../src/pixi/sphere-coordinates.js';
import {sphereFrame} from '../../src/pixi/sphere.js';
const out='../concepts/themes/world-map/islets',tmp='/private/tmp/ducky-islets';mkdirSync(tmp,{recursive:true});
execFileSync('clang',['-Wno-deprecated-declarations','-Wno-incompatible-pointer-types','scripts/sphere-place/offscreen.m','-framework','Foundation','-framework','OpenGL','-o',`${tmp}/offscreen`]);
const frag=readFileSync('src/pixi/world-view.js','utf8').match(/const FRAGMENT = `([\s\S]*?)`;/)[1];writeFileSync(`${tmp}/fragment.glsl`,frag);
async function atlas(names,size,rows,input){
 const layers=await Promise.all(names.map(async(name,k)=>({input:await sharp(input(name)).resize(size-4,size-4,{fit:'fill'}).toBuffer(),left:k%4*size+2,top:Math.floor(k/4)*size+2})));
 const data=await sharp({create:{width:size*4,height:size*rows,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).raw().toBuffer();
 for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;data[i]=Math.round(data[i]*a);data[i+1]=Math.round(data[i+1]*a);data[i+2]=Math.round(data[i+2]*a);}return data;
}
writeFileSync(`${tmp}/atlas.rgba`,await atlas(WORLD_ISLANDS.map(i=>i.theme??'home'),1024,4,n=>`public/pixi-art/globe/${n}.svg`));
writeFileSync(`${tmp}/islets.rgba`,await atlas(ISLET_ART,512,3,n=>`public/pixi-art/islets/${n}.svg`));
writeFileSync(`${tmp}/scene.rgba`,Buffer.alloc(16));
const W=1440,H=1000,R=WORLD_GEO.Rw,m=mapOf('home'),anchor=WORLD_ISLANDS[0],proof=[];
for(const [name,lon,lat,zoom,ball]of [
 ['globe-front',0,20,.43*H/R,1],['globe-east',120,-10,.43*H/R,1],['globe-west',-120,20,.43*H/R,1],
 ...[.04,.065,.08,.2].map(z=>[`zoom-${z}`,ISLETS[0].lon*180/Math.PI,ISLETS[0].lat*180/Math.PI,z,Math.max(0,1-z/.2)]),
]){
 const focus=sphereFrame(lon*Math.PI/180,lat*Math.PI/180).center,cam=localPoint('home',focus),view=viewFrame('home',cam);
 const uniforms={uBasis:[1,0,0,1],uBall:[ball],uDetail:[1],uTime:[1],uZoom:[zoom],uCam:[cam.x,cam.y],uRes:[W,H],uR:[R*zoom/H],uSea:[110/255,201/255,222/255],uSph:[m.cx,m.cy,R],
  uAnchor:anchor.center,uEast:anchor.east,uNorth:anchor.north,uFocus:view.center,uViewEast:view.east,uViewNorth:view.north,
  uCenters:WORLD_ISLANDS.flatMap(i=>i.center),uEasts:WORLD_ISLANDS.flatMap(i=>i.east),uNorths:WORLD_ISLANDS.flatMap(i=>i.north),uSizes:WORLD_ISLANDS.flatMap(i=>[i.width,i.height,Math.cos(Math.hypot(i.width,i.height)/2/R),0]),
  uIsletCenters:ISLETS.flatMap(i=>i.center),uIsletEasts:ISLETS.flatMap(i=>i.east),uIsletNorths:ISLETS.flatMap(i=>i.north),uIsletSizes:ISLETS.flatMap(i=>[i.width,i.width,i.cap,i.artIndex])};
 const job={fragment:`${tmp}/fragment.glsl`,atlas:{path:`${tmp}/atlas.rgba`,width:4096,height:4096},islets:{path:`${tmp}/islets.rgba`,width:2048,height:1536},scene:{path:`${tmp}/scene.rgba`,width:2,height:2},width:W,height:H,uniforms,output:`${tmp}/${name}.rgba`};
 writeFileSync(`${tmp}/job.json`,JSON.stringify(job));
 const result=execFileSync(`${tmp}/offscreen`,[`${tmp}/job.json`],{encoding:'utf8'}).trim(),pixels=readFileSync(job.output);
 if(!result.endsWith('GL error: 0'))throw Error(result);
 const label=Buffer.from(`<svg width="${W}" height="${H}"><g fill="#fff0c7" font-family="Arial"><text x="24" y="35" font-size="22">${name} | 22 decorative islets | 11 approved artworks</text><text x="24" y="976" font-size="15">Production globe shader | native offscreen OpenGL | static previews | no browser timing claim</text></g></svg>`);
 await sharp(pixels,{raw:{width:W,height:H,channels:4}}).flip().composite([{input:label,left:0,top:0}]).png().toFile(`${out}/ingame-${name}.png`);
 // Independently render with islets disabled, so the comparison finds actual
 // rendered islet pixels and catches any drawing outside the sphere.
 job.uniforms.uIsletSizes=ISLETS.flatMap(i=>[i.width,i.width,2,i.artIndex]);job.output=`${tmp}/without.rgba`;writeFileSync(`${tmp}/job.json`,JSON.stringify(job));
 execFileSync(`${tmp}/offscreen`,[`${tmp}/job.json`]);const without=readFileSync(job.output);let changed=0,exterior=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=(y*W+x)*4,delta=Math.abs(pixels[k]-without[k])+Math.abs(pixels[k+1]-without[k+1])+Math.abs(pixels[k+2]-without[k+2]);if(delta>8){changed++;if(ball===1&&Math.hypot(x-W/2,y-H/2)>R*zoom+2)exterior++;}}
 if(changed<30||exterior)throw Error(`${name}: islet pixels ${changed}, exterior ghosts ${exterior}`);
 proof.push({name,renderer:result,isletPixels:changed,exteriorIsletPixels:exterior,zoom,ball});console.log(proof.at(-1));
}
writeFileSync(`${out}/ingame-globe-proof.json`,JSON.stringify(proof,null,2)+'\n');
