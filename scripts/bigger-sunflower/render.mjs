import sharp from 'sharp';
import {readFileSync,mkdirSync} from 'node:fs';
export const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger';
export const A='public/pixi-art/themes/sunflower/';
export async function render(art,file,camera={x:-2000,y:-1400,k:.14,w:1680,h:1176},transparent=false){
 const {x:ox,y:oy,k,w:W,h:H}=camera,parts=[],cache=new Map();
 async function add(p,kind){
 const scale=kind==='prop'?(p.scale??1):1,w=Math.max(1,Math.round(p.width*scale*k)),h=Math.max(1,Math.round(p.height*scale*k)),anchor=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};
 const x=Math.round((p.x-ox)*k-anchor.x*w),y=Math.round((p.y-oy)*k-anchor.y*h);if(x>=W||y>=H||x+w<=0||y+h<=0)return;
 const key=[p.src,w,h,p.flip].join(':');let buf=cache.get(key);
 if(!buf){let s=sharp(A+p.src).resize(w,h,{fit:'fill'});if(p.flip)s=s.flop();buf=await s.png().toBuffer();cache.set(key,buf)}
 const left=Math.max(0,-x),top=Math.max(0,-y),width=Math.min(w-left,W-Math.max(0,x)),height=Math.min(h-top,H-Math.max(0,y));
 if(left||top||width!==w||height!==h)buf=await sharp(buf).extract({left,top,width,height}).png().toBuffer();parts.push({input:buf,left:Math.max(0,x),top:Math.max(0,y)});
 }
 for(const p of art.ground.tiles)await add(p,'ground');for(const p of art.flats)await add(p,'flat');for(const p of art.decks)await add(p,'deck');for(const p of art.props.slice().sort((a,b)=>(a.z??a.y)-(b.z??b.y)))await add(p,'prop');
 await sharp({create:{width:W,height:H,channels:4,background:transparent?'#00000000':art.sea}}).composite(parts).png().toFile(file);
}
if(process.argv[2]==='now'){const a=JSON.parse(readFileSync('scripts/bigger-sunflower/baseline/art.json'));await render(a,OUT+'/sunflower-now.png');console.log('Original island captured')}
