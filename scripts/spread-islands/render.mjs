// Static proof from production SVGs and the globe's longitude/latitude mapping.
// This does not claim to be an in-game browser capture. No game art is written.
import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {layoutWorld,WORLD_ISLANDS} from '../../src/pixi/world-map.js';
const prefix=process.argv[3]??'';
const root=process.cwd(),out=path.resolve('../concepts/themes/world-map/spread');mkdirSync(out,{recursive:true});
const before=JSON.parse(readFileSync(process.argv[2]??out+'/before-layout.json','utf8'));
before.Rw ??= before.radius;
before.SX ??= before.bounds.x1-before.bounds.x0;
{
 const textures=new Map();
 for(const island of WORLD_ISLANDS){textures.set(island.id,readFileSync(`${root}/public/pixi-art/globe/${island.theme??'home'}.png`));console.log('Assembled '+island.id);}
 const smooth=(a,b,v)=>{const x=Math.max(0,Math.min(1,(v-a)/(b-a)));return x*x*(3-2*x)};
 for(const [tag,m]of [['before',before],['after',layoutWorld()]]){
  const W=4096,H=2048,kx=W/m.SX,ky=H/(m.bounds.y1-m.bounds.y0),layers=[];
  for(const island of m.islands){const im=textures.get(island.id),lat=-(island.y-2200)/m.Rw;
   const w=Math.round(island.width/Math.cos(lat)*kx),h=Math.round(island.height*ky),x=Math.round((island.x-m.bounds.x0)*kx-w/2),y=Math.round((island.y-m.bounds.y0)*ky-h/2);
   const buf=await sharp(im).resize(w,h,{fit:'fill'}).toBuffer();
   for(const shift of [-W,0,W]){const left=x+shift;if(left>=W||left+w<=0)continue;const l=Math.max(0,left),t=Math.max(0,y),cw=Math.min(w-Math.max(0,-left),W-l),ch=Math.min(h-Math.max(0,-y),H-t);if(cw>0&&ch>0)layers.push({input:await sharp(buf).extract({left:Math.max(0,-left),top:Math.max(0,-y),width:cw,height:ch}).toBuffer(),left:l,top:t});}
  }
  const atlas=await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).raw().toBuffer();
  for(const deg of [0,120,240]){
   const sw=1400,sh=1000,R=430,pixels=Buffer.alloc(sw*sh*3),lon0=deg*Math.PI/180;
   for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
    const nx=(x-sw/2)/R,ny=-(y-sh/2)/R,d=Math.hypot(nx,ny);let c=[18,23,56];
    if(d<1){
     const z=Math.sqrt(1-d*d),lon=lon0+Math.atan2(nx,z),lat=Math.asin(ny),gx=2900+lon*m.Rw,gy=2200-lat*m.Rw;
     const u=((gx-m.bounds.x0)/m.SX%1+1)%1,v=((gy-m.bounds.y0)/(m.bounds.y1-m.bounds.y0)%1+1)%1;
     const a=(Math.floor(v*H)*W+Math.floor(u*W))*4,alpha=atlas[a+3]/255;
     c=[51,132.6,219.3].map((sea,k)=>sea*(1-alpha)+atlas[a+k]*alpha);
     const lit=(-.5*nx+.5*ny+.72*z)/Math.hypot(.5,.5,.72),shade=1-smooth(.12,.3,lit),light=smooth(.8,.95,lit),rim=smooth(.94,1,d)**2*.45;
     c=c.map((v,k)=>(v*(1-([.28,.2,.02][k])*shade)+[15.3,17.85,20.4][k]*light)*(1-rim)+[140.25,209.1,255][k]*rim);
    }
    const i=(y*sw+x)*3;c.forEach((v,k)=>pixels[i+k]=Math.round(Math.min(255,v)));
   }
   const label=Buffer.from(`<svg width="1400" height="1000"><g fill="#fff0c7" font-family="Arial"><text x="28" y="42" font-size="23">${tag.toUpperCase()} · facing ${deg}° longitude · 13 islands</text><text x="28" y="974" font-size="16">Static production-art assembly using globe coordinates. Browser capture unavailable in this sandbox.</text></g></svg>`);
   await sharp(pixels,{raw:{width:sw,height:sh,channels:3}}).composite([{input:label,left:0,top:0}]).png().toFile(`${out}/${prefix}${tag}-${deg}.png`);
  }
  writeFileSync(`${out}/${prefix}${tag}-layout.json`,JSON.stringify({note:'Static production SVG assembly, not browser verification',radius:m.Rw,Rw:m.Rw,SX:m.SX,bounds:m.bounds,islands:m.islands},null,2));
 }
 writeFileSync(`${out}/${prefix}index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><title>Island spacing proof</title><style>body{background:#121738;color:#fff0c7;font:18px system-ui;margin:32px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%}h2{margin-top:40px}</style><h1>Whole-globe island spacing</h1><p>Exactly 13 islands. Static renders of production SVG artwork with the globe coordinate mapping. These are not in-game screenshots. Chromium launch is denied by the sandbox and the browser host is unavailable.</p>${[0,120,240].map(d=>`<h2>Facing ${d}°</h2><div class="pair"><img src="${prefix}before-${d}.png" alt="Before, ${d} degrees"><img src="${prefix}after-${d}.png" alt="After, ${d} degrees"></div>`).join('')}</html>`);
 console.log('Six labelled static globe renders saved to '+out);
}
