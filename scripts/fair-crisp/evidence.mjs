// Software texture proof: rasterise each SVG at the production sampling rate,
// then linearly scale those bitmaps into a DPR-2 canvas. Not a browser capture.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import sharp from 'sharp';
import {artResolution} from '../../src/pixi/art-resolution.js';
import {tileResolution} from '../../src/pixi/ground-stream.js';
import {fairTiles,cropFairSVG,FAIR_GROUND_TILE_SIZE} from '../../src/pixi/fair-raster.js';
import {mapFor} from '../../src/pixi/island-maps.js';
import {layers,source} from './model.mjs';
const OUT=process.env.CRISP_OUT??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-review/fix/crisp';mkdirSync(OUT,{recursive:true});
const baseline=JSON.parse(readFileSync(OUT+'/baseline.json')),art=JSON.parse(readFileSync('public/pixi-art/themes/fair/art.json'));
const oldR=new Map(JSON.parse(readFileSync(OUT+'/audit.json')).records.filter(r=>r.kind!=='ground').map(r=>[r.src,r.expectedHomeFirstResolution]));
const WIDTH=1000,HEIGHT=600,DPR=2,X=3500,Y=2400;
const poses=JSON.parse(readFileSync('src/pixi/sleep-poses.json'));
const file=src=>src.startsWith('/assets/')?src.slice(1):'public'+src;
const svgCache=new Map();const svg=src=>{if(!svgCache.has(src))svgCache.set(src,readFileSync(file(src),'utf8'));return svgCache.get(src);};
async function render(tag,zoom){
 const canvas=createCanvas(WIDTH*DPR,HEIGHT*DPR),ctx=canvas.getContext('2d'),cache=new Map();ctx.fillStyle=art.sea;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
 const k=zoom*DPR,sx=x=>(x-X)*k+canvas.width/2,sy=y=>(y-Y)*k+canvas.height/2;
 async function image(key,text,width,height,r){
  if(cache.has(key))return cache.get(key);
  const buffer=await sharp(Buffer.from(text),{density:72*r}).resize(Math.ceil(width*r),Math.ceil(height*r),{fit:'fill'}).png().toBuffer();
  const result=await loadImage(buffer);cache.set(key,result);return result;
 }
 async function add(p,src,kind,anchor){
  const width=p.width*(p.scale??1),height=p.height*(p.scale??1),left=p.x-width*anchor.x,top=p.y-height*anchor.y;
  if(sx(left)>=canvas.width||sy(top)>=canvas.height||sx(left+width)<=0||sy(top+height)<=0)return;
  if(tag==='before'||kind==='sleeper'){
   const size=baseline.actualSizes[src]??(await sharp(file(src)).metadata().then(m=>[m.width,m.height]));
   const r=kind==='sleeper'?1:kind==='ground'?tileResolution({...p,src},zoom,DPR):oldR.get(src)??artResolution({...p,src},p.resolution??(kind==='decks'?1.5:2),baseline.sizes);
   const im=await image(src+'|'+r,svg(src),...size,r);
   ctx.save();ctx.translate(sx(p.flip?left+width:left),sy(top));if(p.flip)ctx.scale(-1,1);ctx.drawImage(im,0,0,width*k,height*k);ctx.restore();
  }else{
   const ts=fairTiles(p,src,anchor,kind==='ground'?FAIR_GROUND_TILE_SIZE:undefined);
   for(const t of ts){if(sx(t.x)>=canvas.width||sy(t.y)>=canvas.height||sx(t.x+t.width)<=0||sy(t.y+t.height)<=0)continue;
    const crop=new URL(t.src,'http://local').searchParams.get('fairCrop').split(',').map(Number),r=tileResolution(t,zoom,DPR);
    const im=await image(t.src+'|'+r,cropFairSVG(svg(src),crop),t.width,t.height,r);
    ctx.save();ctx.translate(sx(t.flip?t.x+t.width:t.x),sy(t.y));if(t.flip)ctx.scale(-1,1);ctx.drawImage(im,0,0,t.width*k,t.height*k);ctx.restore();
   }
  }
 }
 const all=layers(art);
 for(const kind of ['ground','flats','decks','floating'])for(const l of all.filter(l=>l.kind===kind))await add(l.p,l.src,l.kind,l.anchor);
 // Same contact shadows, deliberately soft and outside the art-density requirement.
 for(const p of art.props){if(p.shadow===false||/bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i.test(p.name??p.asset??p.src))continue;const [rx,ry]=p.shadowSize??(r=>[r,r*.3])(Math.max(8,Math.min(300,p.width*(p.scale??1)*.36)));ctx.fillStyle='rgba(60,90,42,0.15)';ctx.beginPath();ctx.ellipse(sx(p.x+(p.shadowOffset?.[0]??0)+rx*.06),sy(p.y+(p.shadowOffset?.[1]??0)+ry*.1),rx*k,ry*k,0,0,Math.PI*2);ctx.fill();}
 const standing=all.filter(l=>l.kind==='props');
 for(const bed of mapFor('fair').sleepers){const pose=poses.poses[bed.pose],u=pose.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=pose.box;
  for(const layer of pose.layers){const m=await sharp(file(layer.src)).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u,cx=(x0+x1)/2*u;
   standing.push({kind:'sleeper',src:layer.src,p:{x:bed.x,y:bed.y,width,height,scale:1,flip:bed.flip},anchor:{x:bed.flip?1-cx/width:cx/width,y:y1*u/height}});}
 }
 standing.sort((a,b)=>(a.p.z??a.p.y)-(b.p.z??b.p.y));for(const l of standing)await add(l.p,l.src,l.kind,l.anchor);
 const full=canvas.toBuffer('image/png'),name=zoom===.6?tag:tag+'-max';
 // No resampling of the final crop: native device pixels are preserved.
 const crop=await sharp(full).extract({left:0,top:0,width:2000,height:1200}).png().toBuffer();writeFileSync(`${OUT}/${name}.png`,crop);
 console.log(name+' rendered');
}
for(const zoom of [.6,1.8])for(const tag of ['before','after'])await render(tag,zoom);
for(const suffix of ['','-max']){const before=await sharp(`${OUT}/before${suffix}.png`).toBuffer(),after=await sharp(`${OUT}/after${suffix}.png`).toBuffer();await sharp({create:{width:4000,height:1200,channels:4,background:'#fff'}}).composite([{input:before,left:0,top:0},{input:after,left:2000,top:0}]).png().toFile(`${OUT}/side-by-side${suffix}.png`);}
writeFileSync(OUT+'/render-method.json',JSON.stringify({method:'Software SVG-to-texture composition with linear bitmap sampling, not browser/WebGL screenshots',viewport:{width:WIDTH,height:HEIGHT,dpr:DPR},camera:{x:X,y:Y,defaultZoom:.6,maxZoom:1.8},cropDevicePixels:{left:0,top:0,width:2000,height:1200},left:'before',right:'after',exclusions:'Kites and transient weather outside the crop; poses held at rest; intentionally soft contact shadows retained.'},null,2));
