// Deterministic alpha extraction, never redraws the approved artwork.
// Only border-connected sea colours are removed. Enclosed lagoons stay intact.
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const source=path.resolve('../concepts/themes/world-map/islets');
export const ART=['odyssey','tree-and-rowboat','broken-shipwreck','04-small-mountain','05-lighthouse-rock','06-palm-treasure','07-pink-blossom','08-snow-igloo','09-spooky-purple','11-volcano','12-coral-atoll'];
mkdirSync('public/pixi-art/islets',{recursive:true});
const sheet=createCanvas(4*256,3*256),sc=sheet.getContext('2d');
sc.fillStyle='#285e86';sc.fillRect(0,0,sheet.width,sheet.height);
const metadata=[];
for(const [index,name] of ART.entries()){
 const file=name==='odyssey'&&existsSync(path.join(source,'odyssey-sunk.png'))?'odyssey-sunk.png':`${name}.png`;
 const image=await loadImage(path.join(source,file)),w=image.width,h=image.height;
 const canvas=createCanvas(w,h),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,w,h),d=pixels.data,palette=[];
 for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16)if(x<32||y<32||x>=w-32||y>=h-32){const i=(y*w+x)*4,c=[d[i],d[i+1],d[i+2]];if(!palette.some(p=>p.every((v,k)=>Math.abs(v-c[k])<7)))palette.push(c);}
 const distance=i=>{let best=Infinity;for(const c of palette){const v=(d[i]-c[0])**2+(d[i+1]-c[1])**2+(d[i+2]-c[2])**2;if(v<best)best=v;}return Math.sqrt(best);};
 const sea=new Uint8Array(w*h),queue=[];
 const add=p=>{if(!sea[p]&&distance(p*4)<25){sea[p]=1;queue.push(p);}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 for(let k=0;k<queue.length;k++){const p=queue[k],x=p%w,y=Math.floor(p/w);if(x)add(p-1);if(x<w-1)add(p+1);if(y)add(p-w);if(y<h-1)add(p+w);}
 let x0=w,y0=h,x1=0,y1=0;
 for(let p=0;p<w*h;p++){
  if(sea[p]){d[p*4+3]=0;continue;}
  const x=p%w,y=Math.floor(p/w);
  // One-pixel feather only along the removed sea, preserving interior ink/foam.
  if((x&&sea[p-1])||(x<w-1&&sea[p+1])||(y&&sea[p-w])||(y<h-1&&sea[p+w]))d[p*4+3]=Math.round(255*Math.min(1,Math.max(.1,(distance(p*4)-25)/12)));
  x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
 }
 ctx.putImageData(pixels,0,0);
 const size=640,out=createCanvas(size,size),oc=out.getContext('2d'),scale=(size-12)/Math.max(x1-x0+1,y1-y0+1),ow=(x1-x0+1)*scale,oh=(y1-y0+1)*scale;
 oc.drawImage(canvas,x0,y0,x1-x0+1,y1-y0+1,(size-ow)/2,(size-oh)/2,ow,oh);
 writeFileSync(`public/pixi-art/islets/${name}.webp`,await out.encode('webp',94));
 sc.drawImage(out,index%4*256,Math.floor(index/4)*256,256,256);
 metadata.push({name,source:file,size,removedPixels:queue.length,bounds:[x0,y0,x1,y1]});
 console.log(name,`${(100*queue.length/(w*h)).toFixed(1)}% sea removed`);
}
writeFileSync(path.join(source,'ingame-cutouts.png'),sheet.toBuffer('image/png'));
writeFileSync('public/pixi-art/islets/sources.json',JSON.stringify(metadata,null,2)+'\n');
