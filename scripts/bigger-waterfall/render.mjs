// Render real production layers headlessly, preserving world coordinates and exact crop scale.
import sharp from 'sharp';import fs from 'node:fs';
const A='public/pixi-art/themes/waterfall/',OUT='../concepts/themes/world-map/bigger';
const art=JSON.parse(fs.readFileSync(A+'art.json')),plan=JSON.parse(fs.readFileSync('scripts/bigger-waterfall/plan.json'));
export async function render(file,crop=null,original=false){const k=crop?.k??.12,W=crop?.w??1680,H=crop?.h??1296,ox=crop?crop.x-W/k/2:plan.origin.x,oy=crop?crop.y-H/k/2:plan.origin.y;
 const data=original?JSON.parse(fs.readFileSync('scripts/bigger-waterfall/original/art.json')):art,layers=[],cache=new Map();
 async function add(p,kind){const s=p.scale??1,w=Math.max(1,Math.round(p.width*s*k)),h=Math.max(1,Math.round(p.height*s*k));const an=kind==='prop'?(p.anchor??{x:.5,y:1}):kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};let x=Math.round((p.x-ox)*k-an.x*w),y=Math.round((p.y-oy)*k-an.y*h);if(x>=W||y>=H||x+w<=0||y+h<=0)return;const key=[p.src,w,h,p.flip].join(':');let b=cache.get(key);if(!b){let im=sharp(A+p.src,{density:72*k}).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();b=await im.png().toBuffer();cache.set(key,b);}const l=Math.max(0,-x),t=Math.max(0,-y),cw=Math.min(w-l,W-Math.max(0,x)),ch=Math.min(h-t,H-Math.max(0,y));if(cw<=0||ch<=0)return;layers.push({input:await sharp(b).extract({left:l,top:t,width:cw,height:ch}).toBuffer(),left:Math.max(0,x),top:Math.max(0,y)});}
 for(const p of data.ground.tiles)await add(p,'ground');for(const p of data.flats)await add(p,'flat');for(const p of data.decks)await add(p,'deck');for(const p of data.floating??[])await add(p,'prop');for(const p of [...data.props].sort((a,b)=>a.y-b.y))await add(p,'prop');
 await sharp({create:{width:W,height:H,channels:4,background:data.sea}}).composite(layers).png().toFile(file);
}
if(process.argv[1]?.endsWith('/render.mjs')){
 await render(OUT+'/waterfall-built.png');await render(OUT+'/waterfall-now.png',null,true);
 for(const c of plan.communities)await render(OUT+'/waterfall-crops/'+c.id+'.png',{x:c.crop[0],y:c.crop[1],k:.8,w:1440,h:1120});
 for(const [id,x,y]of [['junction',-700,2670],['lane',-1250,1530],['mistmill-bridge',2330,-810],['reedwater-bridge',9230,1700],['inlet-bridge',4270,6580],['harbor',4820,7630]])await render(OUT+'/waterfall-crops/'+id+'.png',{x,y,k:.8,w:1200,h:900});
 console.log('Rendered whole island and ten crops at 0.8 px/unit.');
}
