import {DOMAdapter, ImageSource} from 'pixi.js';
import {createArtQueue} from './art/island-preparation.js';

export const BOAT_ATLAS_BUDGET=15*1048576;
const WIDTH=320,HEIGHT=280,PAD=2,SHEET_WIDTH=2048;
async function loadSVG(src){
  const response=await DOMAdapter.get().fetch(src);
  if(!response.ok)throw Error(`Boat SVG ${response.status}: ${src}`);
  const image=DOMAdapter.get().createImage(),url=URL.createObjectURL(await response.blob());
  try{image.src=url;await image.decode();return image;}
  catch(error){image.src='';throw error;}
  finally{URL.revokeObjectURL(url);}
}

// Only the current SVG is decoded. Crops stay on the CPU until one bounded
// sheet is packed, then are released. Every raster/copy yields to input.
export async function buildBoatAtlas(manifest,{queue=createArtQueue({concurrency:1,batchSize:1}),loadImage=loadSVG,createCanvas=(w,h)=>DOMAdapter.get().createCanvas(w,h),cancelled=()=>false}={}){
  const files=[...new Set(Object.values(manifest.views).flatMap(v=>[v.file,v.front,v.rigFront].filter(Boolean)))];
  const frames=new Map(),crops=[];
  let x=PAD,y=PAD,rowHeight=0,sheet;
  const check=()=>{if(cancelled())throw Error('Boat atlas preparation cancelled');};
  try{
    for(const file of files){
      const image=await queue.run(()=>{check();return loadImage('/pixi-art/boat/'+file);});
      try{await queue.raster(()=>{
        check();
        const canvas=createCanvas(WIDTH,HEIGHT),context=canvas.getContext('2d',{willReadFrequently:true});
        try{
          context.drawImage(image,0,0,WIDTH,HEIGHT);
          const pixels=context.getImageData(0,0,WIDTH,HEIGHT).data;
          let left=WIDTH,top=HEIGHT,right=-1,bottom=-1;
          for(let j=0;j<HEIGHT;j++)for(let i=0;i<WIDTH;i++)if(pixels[(j*WIDTH+i)*4+3]){
            left=Math.min(left,i);top=Math.min(top,j);right=Math.max(right,i);bottom=Math.max(bottom,j);
          }
          if(right<left){left=top=right=bottom=0;}
          left=Math.max(0,left-PAD);top=Math.max(0,top-PAD);
          const w=Math.min(WIDTH-1,right+PAD)-left+1,h=Math.min(HEIGHT-1,bottom+PAD)-top+1;
          if(x+w+PAD>SHEET_WIDTH){x=PAD;y+=rowHeight+PAD;rowHeight=0;}
          if(SHEET_WIDTH*(y+Math.max(rowHeight,h)+PAD)*4>BOAT_ATLAS_BUDGET)throw Error('Boat atlas exceeds 15 MiB');
          const crop=createCanvas(w,h);crop.getContext('2d').drawImage(canvas,left,top,w,h,0,0,w,h);
          frames.set(file,{x,y,w,h,left,top});crops.push(crop);
          x+=w+PAD;rowHeight=Math.max(rowHeight,h);
        }finally{canvas.width=canvas.height=0;}
      });}finally{image.src='';}
    }
    sheet=await queue.raster(()=>{check();return createCanvas(SHEET_WIDTH,y+rowHeight+PAD);});
    const context=sheet.getContext('2d');let index=0;
    for(const frame of frames.values()){
      const crop=crops[index++];
      await queue.raster(()=>{check();context.drawImage(crop,frame.x,frame.y);crop.width=crop.height=0;});
    }
    const source=new ImageSource({resource:sheet,alphaMode:'premultiply-alpha-on-upload',autoGenerateMipmaps:false});
    source.autoGarbageCollect=false;source.label='Runtime boat spin atlas';
    return {source,frames,width:WIDTH,height:HEIGHT};
  }catch(error){if(sheet)sheet.width=sheet.height=0;throw error;}
  finally{for(const crop of crops)crop.width=crop.height=0;}
}
