import sharp from 'sharp';
import {rgba,contours} from './tessellate.mjs';

const luminance=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
// A thin ink line qualifies only where it is substantially darker than the
// paint actually below it. Sample its contour, since its bounding-box centre
// may lie far away from a curved or open outline.
export function darkThinStroke(record,previous,end=previous.length){
 if(!record.stroke||record.stroke.width>6)return false;
 const ink=luminance(rgba(record.fill,1));
 const dark=base=>base-ink>=35&&ink/base<.72;
 if(record.stroke.fill)return dark(luminance(rgba(record.stroke.fill,1)));
 const points=[];
 for(const ring of contours(record.path,.25)){
  for(const fraction of [0,.33,.66])points.push(ring[Math.floor((ring.length-1)*fraction)]);
  if(points.length>=12)break;
 }
 return points.some(([x,y])=>{
  let value=0,remaining=1;
  for(let i=end-1;i>=0&&remaining>.001;i--){const r=previous[i];
   const b=r.bounds??=(r.path.computeTightBounds());
   if(x<b[0]||x>b[2]||y<b[1]||y>b[3]||!r.path.isPointInPath(x,y)||!(r.clips??[]).every(c=>c.isPointInPath(x,y)))continue;
   value+=luminance(rgba(r.fill,1))*r.opacity*remaining;remaining*=1-r.opacity;
  }
  return dark(value+255*remaining);
 });
}

export async function strokeRaster(record,density,frame){
 const b=record.path.computeTightBounds(),dx=frame?frame.pixelsX/frame.width:density,dy=frame?frame.pixelsY/frame.height:density,ax=frame?.x??0,ay=frame?.y??0;
 // Match SVG's native meet/centering inside the rounded source viewport,
 // then map those pixels back to the tile's independently scaled world rect.
 const scale=Math.min(dx,dy),tx=frame?(frame.pixelsX-frame.width*scale)/2-ax*scale:0,ty=frame?(frame.pixelsY-frame.height*scale)/2-ay*scale:0;
 const left=Math.max(frame?0:-Infinity,Math.floor(b[0]*scale+tx)-2),top=Math.max(frame?0:-Infinity,Math.floor(b[1]*scale+ty)-2);
 const right=Math.min(frame?.pixelsX??Infinity,Math.ceil(b[2]*scale+tx)+3),bottom=Math.min(frame?.pixelsY??Infinity,Math.ceil(b[3]*scale+ty)+3);
 const width=right-left,height=bottom-top;if(width<=0||height<=0)return null;
 const x=ax*dx+left,y=ay*dy+top;
 const sourceClips=record.stroke?.sourceClip?[record.stroke.sourceClip]:(record.clips??[]);
 const sourcePath=record.stroke?.sourcePath??record.path;
 const clips=sourceClips.map((p,i)=>`<clipPath id="c${i}"><path d="${p.toSVGString()}"/></clipPath>`).join('');
 let content=`<path d="${sourcePath.toSVGString()}" fill="white"/>`;
 for(let i=0;i<sourceClips.length;i++)content=`<g clip-path="url(#c${i})">${content}</g>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" preserveAspectRatio="none" viewBox="${left} ${top} ${width} ${height}"><defs>${clips}</defs><g transform="matrix(${scale} 0 0 ${scale} ${tx} ${ty})">${content}</g></svg>`;
 const data=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
 return {x,y,width,height,data,densityX:dx,densityY:dy,clampLeft:!!frame&&left===0,clampTop:!!frame&&top===0,clampRight:!!frame&&right===frame.pixelsX,clampBottom:!!frame&&bottom===frame.pixelsY};
}
export function rasterAlpha(r,x,y){
 const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;
 const at=(a,b)=>{
  if(a<0&&r.clampLeft)a=0;if(a>=r.width&&r.clampRight)a=r.width-1;
  if(b<0&&r.clampTop)b=0;if(b>=r.height&&r.clampBottom)b=r.height-1;
  return a<0||b<0||a>=r.width||b>=r.height?0:r.data[(b*r.width+a)*4+3];
 };
 return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;
}

// Only thin-stroke coverage goes into this compact mask. Ground fills and
// wider strokes remain vector geometry. One filtered mask sample reconstructs
// main's raster edge at every zoom, without millions of vertices.
export function createStrokeAtlas(){
 const width=2048,blocks=[],rows=[],known=new Map();let usedHeight=1;
 return {
  add(raster,x,y,w,h){
   const bw=w+3,bh=h+3,data=Buffer.alloc(bw*bh);
   for(let yy=0;yy<bh;yy++)for(let xx=0;xx<bw;xx++)data[yy*bw+xx]=Math.round(rasterAlpha(raster,x+xx-1,y+yy-1));
   const key=bw+','+bh+':'+data.toString('base64');let block=known.get(key);
   if(!block){let row=rows.find(r=>r.height>=bh&&r.x+bw<=width);
    if(!row){row={x:0,y:usedHeight,height:bh};rows.push(row);usedHeight+=bh;}
    const ox=row.x,oy=row.y;row.x+=bw;block={ox,oy,data,width:bw,height:bh};blocks.push(block);known.set(key,block);
   }
   return [block.ox+1.5,block.oy+1.5,block.ox+w+1.5,block.oy+h+1.5];
  },
  async finish(){
   if(!blocks.length)return null;
   const height=Math.ceil(usedHeight/128)*128;
   if(height>4096)throw Error('Thin stroke coverage exceeds mask allowance');
   const data=Buffer.alloc(width*height);data[0]=255;
   // Row zero reserves an opaque texel for unchanged vector paints.
   for(const b of blocks)for(let y=0;y<b.height;y++)b.data.copy(data,(b.oy+y)*width+b.ox,y*b.width,(y+1)*b.width);
   // 32 coverage levels bound quantisation to 1.7% of full contrast.
   for(let i=0;i<data.length;i++)data[i]=Math.round(data[i]/(255/31))*(255/31);
   const png=await sharp(data,{raw:{width,height,channels:1}}).webp({lossless:true,effort:6}).toBuffer();
   return {width,height,format:'webp',png:png.toString('base64')};
  }
 };
}

export async function softStrokeMesh(record,density,atlas,frames){
 const positions=[],indices=[],uv=[],usedFrames=[];let peak=0;
 for(const [frameIndex,frame] of frames.entries()){
  const raster=await strokeRaster(record,density,frame);if(!raster)continue;let used=false;
  const laterFrames=frames.slice(frameIndex+1);
  for(let y=0;y<Math.max(1,raster.height-1);y+=16)for(let x=0;x<Math.max(1,raster.width-1);x+=16){
   const w=Math.min(16,raster.width-1-x),h=Math.min(16,raster.height-1-y);let active=false;
   for(let yy=y;yy<=y+h;yy++)for(let xx=x;xx<=x+w;xx++){const a=raster.data[(yy*raster.width+xx)*4+3];peak=Math.max(peak,a);active||=a>0;}
   if(!active)continue;used=true;
   let [u0,v0,u1,v1]=atlas.add(raster,x,y,w,h);
   let x0=(raster.x+x+.5)/raster.densityX,y0=(raster.y+y+.5)/raster.densityY,x1=x0+w/raster.densityX,y1=y0+h/raster.densityY;
   // Texture sprites cover their full frame, including the half texel at
   // each edge. The matching gutter clamps edge ink instead of fading it.
   if(x===0&&raster.clampLeft){x0-=.5/raster.densityX;u0-=.5;}
   if(y===0&&raster.clampTop){y0-=.5/raster.densityY;v0-=.5;}
   if(x+w===raster.width-1&&raster.clampRight){x1+=.5/raster.densityX;u1+=.5;}
   if(y+h===raster.height-1&&raster.clampBottom){y1+=.5/raster.densityY;v1+=.5;}
   let pieces=[[x0,y0,x1,y1]];
   // Later original tiles repaint opaque ground over earlier ink. Give
   // overlaps one owner so isolated coverage masks cannot darken it twice.
   for(const next of laterFrames){
    const nx=next.x,ny=next.y,nr=nx+next.width,nb=ny+next.height;
    pieces=pieces.flatMap(([l,t,r,b])=>{
     const il=Math.max(l,nx),it=Math.max(t,ny),ir=Math.min(r,nr),ib=Math.min(b,nb);
     if(il>=ir||it>=ib)return [[l,t,r,b]];
     const out=[];if(t<it)out.push([l,t,r,it]);if(ib<b)out.push([l,ib,r,b]);
     if(l<il)out.push([l,it,il,ib]);if(ir<r)out.push([ir,it,r,ib]);return out;
    });
    if(!pieces.length)break;
   }
   for(const [l,t,r,b] of pieces){
    const offset=positions.length/2,ul=u0+(u1-u0)*(l-x0)/(x1-x0),ur=u0+(u1-u0)*(r-x0)/(x1-x0),vt=v0+(v1-v0)*(t-y0)/(y1-y0),vb=v0+(v1-v0)*(b-y0)/(y1-y0);
    positions.push(l,t,r,t,r,b,l,b);uv.push(ul,vt,ur,vt,ur,vb,ul,vb);indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
   }
  }
  if(used)usedFrames.push(frame);
 }
 return {positions,indices,uv,peak,frames:usedFrames};
}
