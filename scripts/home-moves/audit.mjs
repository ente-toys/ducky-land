import fs from 'node:fs';
import sharp from 'sharp';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {inShape,geometry} from '../../assets/world/island-geometry.mjs';
export const decorative=p=>/tree|oak|birch|bush|shrub|plant|flower|rock|reed|cattail/.test((p.asset??p.name)+' '+p.src.split('/').at(-1))&&!/house|cottage|lamp|lantern|planter/.test((p.asset??p.name)+' '+p.src.split('/').at(-1));
export const structural=p=>/bridge|stall|kiosk|house|cottage|bench|lamp|lantern|fountain|lighthouse|bandstand|greenhouse|smokehouse|rack|table|cart/.test((p.asset??p.name)+' '+p.src.split('/').at(-1));
export async function makeAudit(baseline,E,world,step=3,sourceSvg=null,baselineSurface=null){
 const art=new Map(),cache=new Map(),oldProps=new Set(baseline),sources=new Map();
 const raster=async p=>{const w=p.width*(p.scale??1),h=p.height*(p.scale??1);const left=p.x-w*(p.flip?1-(p.anchor?.x??0):(p.anchor?.x??0)),top=p.y-h*(p.anchor?.y??0);const x=Math.round(left/step),y=Math.round(top/step),width=Math.max(1,Math.round(w/step)),height=Math.max(1,Math.round(h/step));const old=oldProps.has(p);const key=[old,p.src,x,y,width,height,p.flip].join('|');if(cache.has(key))return cache.get(key);let k=[old,p.src,width,height,p.flip].join('|');if(!art.has(k)){let input='public'+p.src;if(old){if(!sources.has(p.src))sources.set(p.src,sourceSvg?gunzipSync(Buffer.from(sourceSvg[p.src],'base64')):execFileSync('git',['show','ente/main:public'+p.src],{maxBuffer:20e6}));input=sources.get(p.src);}let im=sharp(input).resize(width,height,{fit:'fill'});if(p.flip)im=im.flop();const data=await im.ensureAlpha().raw().toBuffer();const bits=new Uint8Array(width*height);let area=0;for(let i=0;i<bits.length;i++){bits[i]=+(data[i*4+3]>32);area+=bits[i];}art.set(k,{bits,area});}const r={x,y,width,height,...art.get(k)};cache.set(key,r);return r;};
 const overlap=async(a,b)=>{const A=await raster(a),B=await raster(b);const x0=Math.max(A.x,B.x),y0=Math.max(A.y,B.y),x1=Math.min(A.x+A.width,B.x+B.width),y1=Math.min(A.y+A.height,B.y+B.height);let count=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)count+=A.bits[(y-A.y)*A.width+x-A.x]&B.bits[(y-B.y)*B.width+x-B.x];return {fraction:count/Math.max(1,Math.min(A.area,B.area)),area:count*step*step};};
 const bounds=p=>{const w=p.width*(p.scale??1),h=p.height*(p.scale??1),x=p.x-w*(p.flip?1-(p.anchor?.x??0):(p.anchor?.x??0)),y=p.y-h*(p.anchor?.y??0);return [x,y,x+w,y+h];};
 const touching=(a,b)=>{const A=bounds(a),B=bounds(b);return A[0]<B[2]&&B[0]<A[2]&&A[1]<B[3]&&B[1]<A[3];};
 const base=new Map(baseline.map(p=>[String(p.id),p])),oldOverlap=new Map();
 const excess=async(p,props)=>{const out=[];for(const q of props){if(p.id===q.id||!touching(p,q))continue;const bp=base.get(String(p.id)),bq=base.get(String(q.id));let old=0;if(bp&&bq&&touching(bp,bq)){const key=[String(p.id),String(q.id)].sort().join('|');if(!oldOverlap.has(key))oldOverlap.set(key,(await overlap(bp,bq)).fraction);old=oldOverlap.get(key);}const now=(await overlap(p,q)).fraction;if(now-old>.02)out.push({id:q.id,delta:now-old,main:old,final:now});}return out;};
 const box={x:-2600,y:-1800,width:11000,height:8500},s=2;
 const frag=fs.readFileSync('scripts/home-review/path-surface.svgfrag','utf8');
 const rasterSurface=async frag=>sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${box.width/s}" height="${box.height/s}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}">${frag}</svg>`)).ensureAlpha().raw().toBuffer();
 const mask=await rasterSurface(frag),oldMask=baselineSurface?await rasterSurface(baselineSurface.pathSvg):mask;
 const pathAt=(x,y,old=false)=>{const u=Math.floor((x-box.x)/s),v=Math.floor((y-box.y)/s);return u>=0&&v>=0&&u<box.width/s&&v<box.height/s&&(old?oldMask:mask)[(v*(box.width/s)+u)*4+3]>32;};
 const ground=(p,old=oldProps.has(p))=>{const x=p.x,y=p.y-4,w=old&&baselineSurface?baselineSurface.world:world,decks=old&&baselineSurface?baselineSurface.decks:E.decks;if((w.water??[]).some(w=>inShape(x,y,w)))return 'water';if((decks??[]).some(d=>x>=d.x&&x<=d.x+d.width&&y>=d.y&&y<=d.y+d.height)&&!pathAt(x,y,old))return 'deck';if(pathAt(x,y,old))return 'paving/path/sand';return 'grass';};
 const dry=geometry({...world,obstacles:[],walkways:[],bridges:[]}).walkable;
 const oldDry=baselineSurface?geometry({...baselineSurface.world,obstacles:[],walkways:[],bridges:[]}).walkable:dry;
 const projectedGround=async p=>{const old=oldProps.has(p),isDry=old?oldDry:dry;const r=await raster(p),stride=Math.max(1,Math.round(4/step));let wet=0,path=0,total=0;for(let y=0;y<r.height;y+=stride)for(let x=0;x<r.width;x+=stride)if(r.bits[y*r.width+x]){const wx=(r.x+x+.5)*step,wy=(r.y+y+.5)*step;total++;if(!isDry(wx,wy))wet++;else if(ground({x:wx,y:wy+4},old)==='paving/path/sand')path++;}return {water:wet/total,paving:path/total};};
 return {raster,overlap,excess,ground,projectedGround,touching,base};
}
