// Static proof assembled from production art, at its actual placement and scale.
import sharp from 'sharp';
import {readFileSync,mkdirSync} from 'node:fs';
import READY from '../../assets/world/themes/index.js';
const out='../concepts/themes/world-map/bigger',base='public/pixi-art/themes/pink/';mkdirSync(out+'/pink-ground-crops',{recursive:true});
export const read=p=>JSON.parse(readFileSync(p));
export async function render(art,view,k,file,{labels=[],boats=[],sleepers=true}={}){
 const [ox,oy,cw,ch]=view,W=Math.round(cw*k),H=Math.round(ch*k),layers=[],cache=new Map();
 const source=s=>s.startsWith('/')?'public'+s:base+s;
 async function add(src,x,y,w,h,flip=false){
  const left=Math.round((x-ox)*k),top=Math.round((y-oy)*k),ww=Math.max(1,Math.round(w*k)),hh=Math.max(1,Math.round(h*k));
  if(left>=W||top>=H||left+ww<=0||top+hh<=0)return;
  const key=[src,ww,hh,flip].join('|');let buf=cache.get(key);
  if(!buf){let im=sharp(source(src)).resize(ww,hh,{fit:'fill'});if(flip)im=im.flop();buf=await im.png().toBuffer();cache.set(key,buf);}
  const l=Math.max(0,-left),t=Math.max(0,-top),width=Math.min(ww-l,W-Math.max(0,left)),height=Math.min(hh-t,H-Math.max(0,top));
  if(l||t||width!==ww||height!==hh)buf=await sharp(buf).extract({left:l,top:t,width,height}).png().toBuffer();
  layers.push({input:buf,left:Math.max(0,left),top:Math.max(0,top)});
 }
 for(const t of art.ground.tiles)await add(t.src,t.x,t.y,t.width,t.height);
 for(const f of art.flats??[])await add(f.src,f.x-(f.topLeft?0:f.width/2),f.y-(f.topLeft?0:f.height),f.width,f.height,f.flip);
 for(const d of art.decks??[])await add(d.src,d.x,d.y,d.width,d.height);
 const props=[...(art.props??[])];
 for(const b of boats)props.push({src:'/pixi-art/boat-sail.svg',x:b.x,y:b.y,width:188,height:188,anchor:{x:.5,y:.82},scale:1,flip:b.turn<0});
 if(sleepers){const poses=read('src/pixi/sleep-poses.json');for(const b of READY.pink.sleepers){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;for(const l of p.layers){const m=await sharp('public'+l.src).metadata(),w=m.width/poses.F*u,h=m.height/poses.F*u;props.push({src:l.src,x:b.x,y:b.y,width:w,height:h,scale:1,anchor:{x:b.flip?1-(x0+x1)/2*u/w:(x0+x1)/2*u/w,y:y1*u/h},flip:b.flip});}}}
 for(const p of art.props??[]){if(p.shadow===false||/bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i.test(p.name??p.src))continue;const rx=Math.max(8,Math.min(300,p.width*(p.scale??1)*.36)),ry=rx*.3;const buf=Buffer.from(`<svg width="${rx*2+4}" height="${ry*2+4}"><ellipse cx="${rx+2}" cy="${ry+2}" rx="${rx}" ry="${ry}" fill="#3c5a2a" opacity=".15"/></svg>`);const px=Math.round((p.x-rx-ox)*k),py=Math.round((p.y-ry-oy)*k);if(px>0&&py>0&&px+(rx*2+4)*k<W&&py+(ry*2+4)*k<H)layers.push({input:await sharp(buf).resize(Math.round((rx*2+4)*k),Math.round((ry*2+4)*k)).png().toBuffer(),left:px,top:py});}
 for(const p of props.sort((a,b)=>(a.z??a.sortY??a.y)-(b.z??b.sortY??b.y))){const w=p.width*(p.scale??1),h=p.height*(p.scale??1),a=p.anchor??{x:.5,y:1};await add(p.src,p.x-a.x*w,p.y-a.y*h,w,h,p.flip);}
 if(labels.length){const svg=`<svg width="${W}" height="${H}">${labels.map(p=>`<g transform="translate(${(p.x-ox)*k},${(p.y-oy)*k})"><rect x="-95" y="10" width="190" height="24" rx="12" fill="#fff0c7" stroke="#de8faa"/><text y="27" text-anchor="middle" font-family="Arial" font-size="12" fill="#39472d">${p.name}</text></g>`).join('')}</svg>`;layers.push({input:Buffer.from(svg),left:0,top:0});}
 await sharp({create:{width:W,height:H,channels:4,background:art.sea}}).composite(layers).png().toFile(file);
 console.log(file,layers.length);
}

const outDir='../concepts/themes/work/pink-fix/ingame';mkdirSync(outDir,{recursive:true});
const report=read('scripts/pink-hamlets/report.json'),art=read(base+'art.json');
for(const [h,info] of Object.entries(report.hamlets)){
 const {at,bp,k}=info.map,view=[at[0]-bp[0]*k,at[1]-bp[1]*k,1536*k,1024*k];
 await render(art,view,1/k,outDir+'/'+h+'-production.png');
 const [live,reference]=await Promise.all([sharp(outDir+'/'+h+'-production.png').resize(1152,768).toBuffer(),sharp('../concepts/themes/work/pink-fix/gpt/'+h+'.png').resize(1152,768).toBuffer()]);
 await sharp({create:{width:2304,height:768,channels:4,background:'#fff'}}).composite([{input:live,left:0,top:0},{input:reference,left:1152,top:0}]).png().toFile(outDir+'/'+h+'-compare.png');
}
