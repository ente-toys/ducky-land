import fs from 'node:fs';
import sharp from 'sharp';
export const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger';
fs.mkdirSync(OUT+'/community-crops',{recursive:true});
const ART='public/pixi-art/themes/community/';
export async function render(a,h,file,{crop,labels=[],beds=true}={}){
 const origin=a.origin??{x:0,y:0},W=crop?1440:1800,H=crop?1040:1350,k=crop?.[2]??Math.min(W/a.width,H/a.height),ox=crop?W/2-crop[0]*k:(W-a.width*k)/2-origin.x*k,oy=crop?H/2-crop[1]*k:(H-a.height*k)/2-origin.y*k;
 const layers=[],cache=new Map(),source=s=>s.startsWith('/')?'public'+s:ART+s;
 async function add(p,kind){const sc=kind==='prop'?(p.scale??1):1,w=Math.max(1,Math.round(p.width*sc*k)),hh=Math.max(1,Math.round(p.height*sc*k)),anc=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0},x=Math.round(ox+p.x*k-anc.x*w),y=Math.round(oy+p.y*k-anc.y*hh);if(x>=W||y>=H||x+w<=0||y+hh<=0)return;
 const key=[p.src,w,hh,p.flip].join('|');let buf=cache.get(key);if(!buf){let im=sharp(source(p.src),{limitInputPixels:false}).resize(w,hh,{fit:'fill'});if(p.flip)im=im.flop();buf=await im.png().toBuffer();cache.set(key,buf);}const left=Math.max(0,x),top=Math.max(0,y),cw=Math.min(w-Math.max(0,-x),W-left),ch=Math.min(hh-Math.max(0,-y),H-top);layers.push({input:cw===w&&ch===hh?buf:await sharp(buf).extract({left:Math.max(0,-x),top:Math.max(0,-y),width:cw,height:ch}).png().toBuffer(),left,top});}
 for(const t of a.ground.tiles)await add(t,'ground');for(const f of a.flats)await add(f,'flat');
 const shadow=a.props.filter(p=>p.shadow!==false&&!/bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i.test(p.name)).map(p=>{const rx=Math.max(8,Math.min(300,p.width*(p.scale??1)*.36));return `<ellipse cx="${p.x+rx*.06}" cy="${p.y+rx*.03}" rx="${rx}" ry="${rx*.3}"/>`}).join('');layers.push({input:await sharp(Buffer.from(`<svg width="${W}" height="${H}"><g transform="translate(${ox} ${oy}) scale(${k})" fill="#3c5a2a" opacity=".15">${shadow}</g></svg>`)).png().toBuffer(),left:0,top:0});
 for(const d of a.decks)await add(d,'deck');const things=[...a.props];
 for(const b of h.boats)things.push({src:'/pixi-art/boat-sail.svg',x:b.x,y:b.y,width:188,height:188,anchor:{x:.5,y:.82}});
 if(beds){const poses=JSON.parse(fs.readFileSync('src/pixi/sleep-poses.json')),bs=JSON.parse(fs.readFileSync(ART+'resolved-sleepers.json'));for(const b of bs){const p=poses.poses[b.pose],u=p.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=p.box;for(const l of p.layers){const m=await sharp(source(l.src)).metadata(),width=m.width/poses.F*u,height=m.height/poses.F*u;things.push({src:l.src,x:b.x,y:b.y,width,height,anchor:{x:b.flip?1-(x0+x1)/2*u/width:(x0+x1)/2*u/width,y:y1*u/height},flip:b.flip});}}}
 for(const p of things.sort((a,b)=>(a.sortY??a.y)-(b.sortY??b.y)))await add(p,'prop');
 if(labels.length)layers.push({input:await sharp(Buffer.from(`<svg width="${W}" height="${H}">${labels.map(p=>`<g transform="translate(${ox+p.x*k} ${oy+p.y*k})"><rect x="-110" y="10" width="220" height="32" rx="16" fill="#fff0c7" stroke="#77744f"/><text y="32" text-anchor="middle" font-family="Arial" font-size="16" fill="#39472d">${p.name}</text></g>`).join('')}</svg>`)).png().toBuffer(),left:0,top:0});
 await sharp({create:{width:W,height:H,channels:4,background:a.sea}}).composite(layers).png().toFile(file);return {W,H,k,ox,oy};
}
if(process.argv.includes('--baseline')){const a=JSON.parse(fs.readFileSync('scripts/bigger-community/baseline/art.json')),h=JSON.parse(fs.readFileSync('scripts/bigger-community/baseline/harbor.json'));console.log(await render(a,h,OUT+'/community-now.png'));}
