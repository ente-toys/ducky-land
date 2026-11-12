import sharp from 'sharp';
import {readFileSync,mkdirSync} from 'node:fs';
import {makeMap} from '../../src/world/island-maps.js';
export const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger';
export const A='public/pixi-art/themes/cathedral/';
export async function render(art,{x=-2200,y=-2000,k=.14,width=1680,height=1330,original=false,world=null,walk=null,harbor=null,nativeGround=false}={}){
 const layers=[],cache=new Map(),dimensions=new Map();
 async function add(p,type){
 const scale=p.scale??1,w=Math.max(1,Math.round(p.width*scale*k)),h=Math.max(1,Math.round(p.height*scale*k)),anchor=type==='prop'?(p.anchor??{x:.5,y:1}):type==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};
 const l=Math.round((p.x-x)*k-anchor.x*w),t=Math.round((p.y-y)*k-anchor.y*h);
 if(l>=width||t>=height||l+w<=0||t+h<=0)return;
 const src=p.src.startsWith('/')?'public'+p.src:A+p.src,key=[src,w,h,p.flip].join('|');let buf=cache.get(key);
 if(!buf){let input=src,density=72;if(src.endsWith('.svg')){if(!dimensions.has(src))dimensions.set(src,await sharp(src).metadata());const m=dimensions.get(src);density=72*Math.max(1,w/m.width,h/m.height);}if(nativeGround&&type==='ground'&&src.endsWith('.svg'))input=await sharp(src).png().toBuffer();let im=sharp(input,{limitInputPixels:false,density}).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();buf=await im.png().toBuffer();cache.set(key,buf);}
 const left=Math.max(0,l),top=Math.max(0,t),cl=Math.max(0,-l),ct=Math.max(0,-t),ww=Math.min(w-cl,width-left),hh=Math.min(h-ct,height-top);
 if(cl||ct||ww<w||hh<h)buf=await sharp(buf).extract({left:cl,top:ct,width:ww,height:hh}).png().toBuffer();layers.push({input:buf,left,top});
 }
 for(const p of art.ground.tiles)await add(p,'ground');
 for(const p of art.flats??[])await add(p,'flat');
 for(const p of art.decks??[])await add(p,'deck');
 if(original)await add({src:'deck-jetty-0.svg',x:2860,y:250,width:280,height:1020},'deck');
 let props=[...art.props];
 if(world&&harbor){const beds=makeMap('cathedral',{world,walk,harbor}).sleepers,poses=JSON.parse(readFileSync('src/world/home/sleep-poses.json'));
  for(const bed of beds){let pose=poses.poses[bed.pose],u=pose.k*.81*(.88*.24*3)/3,[x0,,x1,y1]=pose.box;
   for(const l of pose.layers){const metadata=await sharp('public'+l.src).metadata(),w=metadata.width/poses.F*u,h=metadata.height/poses.F*u;
    props.push({src:l.src,x:bed.x,y:bed.y+.01,width:w,height:h,scale:1,anchor:{x:bed.flip?1-(x0+x1)/2*u/w:(x0+x1)/2*u/w,y:y1*u/h},flip:bed.flip});}
  }
 }
 for(const p of props.sort((a,b)=>(a.sortY??a.y)-(b.sortY??b.y)))await add(p,'prop');
 return sharp({create:{width,height,channels:4,background:art.sea}}).composite(layers).png().toBuffer();
}
if(process.argv[1]?.endsWith('/render.mjs')){
 const art=JSON.parse(readFileSync(A+'art.json'));await sharp(await render(art,{x:-2200,y:-2400,k:.12,width:1536,height:1248})).toFile(OUT+'/cathedral-built.png');
 const plan=JSON.parse(readFileSync('scripts/bigger-cathedral/plan.json'));
 mkdirSync(OUT+'/cathedral-crops',{recursive:true});
 for(const [name,x,y]of plan.crops)await sharp(await render(art,{x:x-875,y:y-625,k:.8,width:1400,height:1000})).toFile(OUT+`/cathedral-crops/${name}.png`);
}
