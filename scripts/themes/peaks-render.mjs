// Faithful offline assembly. World pixels are multiplied by k on BOTH islands.
import sharp from 'sharp';
import {readFileSync,existsSync} from 'node:fs';
const ROOT='public/pixi-art/themes/peaks/';
export async function render(art,{k=.3,x=0,y=0,width=2400,height=1800,home=false,sleepers=true}={}){
 const comps=[],cache=new Map();
 const file=s=>s.startsWith('/assets/')?s.slice(1):s.startsWith('/')?'public'+s:ROOT+s;
 async function add(src,px,py,w,h,flip=false){let l=Math.round((px-x)*k),t=Math.round((py-y)*k),ww=Math.max(1,Math.round((px+w-x)*k)-l),hh=Math.max(1,Math.round((py+h-y)*k)-t);if(l>=width||t>=height||l+ww<=0||t+hh<=0)return;
 const key=Buffer.isBuffer(src)?null:`${src}|${ww}|${hh}|${flip}`;let buf=key&&cache.get(key);
 if(!buf){let z=sharp(Buffer.isBuffer(src)?src:file(src),{density:Math.max(72,72*k*2)}).resize(ww,hh,{fit:'fill'});if(flip)z=z.flop();buf=await z.png().toBuffer();if(key)cache.set(key,buf)}
 const cl=Math.max(0,-l),ct=Math.max(0,-t),cw=Math.min(ww-cl,width-Math.max(0,l)),ch=Math.min(hh-ct,height-Math.max(0,t));if(cw<=0||ch<=0)return;
 if(cl||ct||cw<ww||ch<hh)buf=await sharp(buf).extract({left:cl,top:ct,width:cw,height:ch}).png().toBuffer();comps.push({input:buf,left:Math.max(0,l),top:Math.max(0,t)});
 }
 for(const tile of art.ground.tiles)await add(tile.src,tile.x,tile.y,tile.width,tile.height);
 for(const f of art.flats||[])await add(f.src,f.topLeft?f.x:f.x-f.width/2,f.topLeft?f.y:f.y-f.height,f.width,f.height,f.flip);
 for(const d of art.decks||[])await add(d.src,d.x,d.y,d.width,d.height);
 if(!home){const h=JSON.parse(readFileSync('assets/world/themes/peaks/harbor.json')).jetty;await add('/pixi-art/bridge-jetty-1.svg',h.foot[0]-97.6,h.foot[1]-30,229.2,Math.hypot(h.tip[0]-h.foot[0],h.tip[1]-h.foot[1])+60);}
 for(const f of art.floating||[]){const a=f.anchor||{x:.5,y:.5};await add(f.src,f.x-f.width*a.x,f.y-f.height*a.y,f.width,f.height,f.flip)}
 const things=art.props.map(p=>({...p}));
 // Same simple contact ellipse that loadThemeArt draws, all shadows below standing props.
 for(const p of art.props){if(/bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i.test(p.name||p.asset||'')||p.shadow===false)continue;let rx=Math.max(8,Math.min(300,p.width*p.scale*.36)),ry=rx*.3;await add(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${rx*2+4}" height="${ry*2+4}"><ellipse cx="${rx+2}" cy="${ry+2}" rx="${rx}" ry="${ry}" fill="#3c5a2a" opacity=".15"/></svg>`),p.x-rx,p.y-ry,rx*2+4,ry*2+4)}
 if(!home&&sleepers){const world=JSON.parse(readFileSync('assets/world/themes/peaks/world.json')),poses=JSON.parse(readFileSync('src/pixi/sleep-poses.json'));
 for(const [pose,list]of Object.entries(world.sleepSpots))for(const spot of list){const p=poses.poses[pose],tree=pose==='nod'?art.props.find(q=>q.id===spot[0]):null;const [sx,sy,flip]=tree?[tree.x+spot[1],tree.y+14,spot[2]]:spot;
 const u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;
 for(const layer of p.layers){const m=await sharp('public'+layer.src).metadata(),w=m.width/poses.F*u,h=m.height/poses.F*u,cx=(x0+x1)/2*u,left=flip?sx-(w-cx):sx-cx;things.push({src:layer.src,x:sx,y:sy+.01,width:w,height:h,anchor:{x:(sx-left)/w,y:y1*u/h},scale:1,flip})}}
 const harbor=JSON.parse(readFileSync('assets/world/themes/peaks/harbor.json'));for(const b of harbor.boats)things.push({src:'/pixi-art/boat-sail.svg',x:b.x,y:b.y+30,width:188,height:216,anchor:{x:.5,y:.82},scale:1});}
 things.sort((a,b)=>a.y-b.y);for(const p of things){const w=p.width*p.scale,h=p.height*p.scale;await add(p.src,p.x-w*p.anchor.x,p.y-h*p.anchor.y,w,h,p.flip)}
 return sharp({create:{width,height,channels:4,background:art.sea||'#8CC8CD'}}).composite(comps).png().toBuffer();
}
