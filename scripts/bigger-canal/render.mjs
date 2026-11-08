import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
export const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger';
export const A='public/pixi-art/themes/canal/';
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export async function render(art,out,{cx=4000,cy=3000,k=.125,W=1700,H=1300,transparent=false,overlay=null}={}){
 const layers=[],cache=new Map();
 async function add(p,kind){
 const scale=kind==='prop'?(p.scale??1):1,an=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:kind==='float'?{x:.5,y:.5}:{x:0,y:0};
 const pw=p.width*scale,ph=p.height*scale;let l=Math.round(W/2+(p.x-an.x*pw-cx)*k),t=Math.round(H/2+(p.y-an.y*ph-cy)*k),w=Math.max(1,Math.round(W/2+(p.x-an.x*pw-cx+pw)*k)-l),h=Math.max(1,Math.round(H/2+(p.y-an.y*ph-cy+ph)*k)-t);
 if(l>=W||t>=H||l+w<=0||t+h<=0)return;
 const src=p.src.startsWith('/')?'public'+p.src:A+p.src,key=[src,w,h,p.flip].join(':');let b=cache.get(key);
 if(!b){let im=sharp(src).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();b=await im.png().toBuffer();cache.set(key,b);}
 const x=Math.max(0,-l),y=Math.max(0,-t),cw=Math.min(w-x,W-Math.max(0,l)),ch=Math.min(h-y,H-Math.max(0,t));
 if(x||y||cw!==w||ch!==h)b=await sharp(b).extract({left:x,top:y,width:cw,height:ch}).png().toBuffer();
 layers.push({input:b,left:Math.max(0,l),top:Math.max(0,t)});
 }
 for(const p of art.ground.tiles)await add(p,'ground');
 for(const p of art.flats)await add(p,'flat');
 for(const p of art.floating??[])await add(p,'float');
 for(const p of art.decks)await add(p,'deck');
 for(const p of [...art.props].sort((a,b)=>(a.sortY??a.y)-(b.sortY??b.y)))await add(p,'prop');
 if(overlay)layers.push({input:Buffer.from(overlay),left:0,top:0});
 fs.mkdirSync(path.dirname(out),{recursive:true});
 await sharp({create:{width:W,height:H,channels:4,background:transparent?{r:0,g:0,b:0,alpha:0}:art.sea}}).composite(layers).png().toFile(out);
}
if(process.argv[2]==='now')await render(read('scripts/bigger-canal/original-art.json'),OUT+'/canal-now.png');
