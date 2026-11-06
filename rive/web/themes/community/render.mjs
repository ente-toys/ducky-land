// Offline manifest render when the sandbox cannot open Chromium. All art is the actual SVG data.
import sharp from 'sharp';import fs from 'node:fs';
const ART='public/pixi-art/themes/community/',DATA='rive/web/themes/community/';
const a=JSON.parse(fs.readFileSync(ART+'art.json')),h=JSON.parse(fs.readFileSync(DATA+'harbor.json'));
const OUT='../concepts/themes/work/community/';fs.mkdirSync(OUT,{recursive:true});
const K=Number(process.env.K||.25),W=Math.round(a.width*K),H=Math.round(a.height*K);const layers=[],cache=new Map();
const path=s=>s.startsWith('/')?'public'+s:ART+s;
async function add(s,x,y,w,hh,flip=false){
 const left=Math.round(x*K),top=Math.round(y*K),width=Math.max(1,Math.round((x+w)*K)-left),height=Math.max(1,Math.round((y+hh)*K)-top);
 if(left<0||top<0||left+width>W||top+height>H)return;
 const key=[s,width,height,flip].join('|');if(!cache.has(key)){let img=sharp(path(s),{density:96}).resize(width,height,{fit:'fill'});if(flip)img=img.flop();cache.set(key,await img.png().toBuffer())}
 layers.push({input:cache.get(key),left,top});
}
for(const t of a.ground.tiles)await add(t.src,t.x,t.y,t.width,t.height);
for(const f of a.flats)await add(f.src,f.topLeft?f.x:f.x-f.width/2,f.topLeft?f.y:f.y-f.height,f.width,f.height,f.flip);
// Contact shadows use the shared theme loader's footprint recipe.
const shadows=a.props.filter(p=>p.shadow!==false&&!/bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i.test(p.name)).map(p=>{const rx=Math.max(8,Math.min(300,p.width*(p.scale??1)*.36)),ry=rx*.3;return `<ellipse cx="${p.x+rx*.06}" cy="${p.y+ry*.1}" rx="${rx}" ry="${ry}"/>`}).join('');
layers.push({input:await sharp(Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 ${a.width} ${a.height}"><g fill="#3c5a2a" opacity=".15">${shadows}</g></svg>`)).png().toBuffer(),left:0,top:0});
for(const d of a.decks)await add(d.src,d.x,d.y,d.width,d.height);
const j=JSON.parse(fs.readFileSync(ART+'harbor-preview.json'));await add('harbor-preview.svg',j.x,j.y,j.width,j.height);
const things=[...a.props];for(const b of h.boats)things.push({src:'/pixi-art/boat-sail.svg',x:b.x,y:b.y,width:188,height:188,scale:1,anchor:{x:.5,y:.82}});
const poses=JSON.parse(fs.readFileSync('src/pixi/sleep-poses.json')),beds=JSON.parse(fs.readFileSync(ART+'resolved-sleepers.json'));
for(const b of beds){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;
 for(const layer of p.layers){const meta=await sharp('public'+layer.src).metadata();const width=meta.width/poses.F*u,height=meta.height/poses.F*u,cx=(x0+x1)/2*u;things.push({src:layer.src,x:b.x,y:b.y,width,height,scale:1,anchor:{x:b.flip?1-cx/width:cx/width,y:y1*u/height},flip:b.flip})}}
for(const p of things.sort((a,b)=>(a.sortY??a.y)-(b.sortY??b.y))){const w=p.width*(p.scale??1),h=p.height*(p.scale??1),anc=p.anchor??{x:.5,y:1};await add(p.src,p.x-anc.x*w,p.y-anc.y*h,w,h,p.flip)}
const out=await sharp({create:{width:W,height:H,channels:4,background:a.sea}}).composite(layers).png().toBuffer();
if(process.env.DETAIL)await sharp(out).png().toFile(OUT+'community-detail-full.png');
if(!process.env.DETAIL){await sharp(out).png().toFile(OUT+'overview.png');await sharp(out).resize(1160).png().toFile(OUT+'preview.png');}
await sharp(out).extract({left:Math.round(2950*K),top:Math.round(1705*K),width:Math.round(2100*K),height:Math.round(1670*K)}).resize(1260,1002).png().toFile(OUT+'centre.png');
await sharp(out).extract({left:Math.round(3100*K),top:Math.round(450*K),width:Math.round(1800*K),height:Math.round(1200*K)}).resize(1260,840).png().toFile(OUT+'screen.png');
console.log('Rendered overview, centre, screen and globe preview from',a.props.length,'props and',beds.length,'sleepers');
