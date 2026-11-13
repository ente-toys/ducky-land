import sizes from '../../shared/art-source-sizes.json' with {type:'json'};
import visibleBounds from '../../shared/art-visible-bounds.json' with {type:'json'};

// Round outwards, then retain a texel outside the visible ink. Coordinates
// remain relative to the full authored picture, including its seam extrusion.
export function textureFootprint(src, resolution, padding=0, sourceSizes=sizes, bounds=visibleBounds) {
  const [w,h]=sourceSizes[src]??[64,64];
  const width=Math.ceil(w*resolution),height=Math.ceil(h*resolution);
  const fullWidth=width+2*padding,fullHeight=height+2*padding;
  const b=bounds[src];
  if(b===null)return {x:0,y:0,width:1,height:1,fullWidth,fullHeight,empty:true};
  if(!b)return {x:0,y:0,width:fullWidth,height:fullHeight,fullWidth,fullHeight};
  const x=b[0]===0?0:Math.max(0,Math.floor(b[0]*width/w)+padding-1);
  const y=b[1]===0?0:Math.max(0,Math.floor(b[1]*height/h)+padding-1);
  const right=b[0]+b[2]>=w?fullWidth:Math.min(fullWidth,Math.ceil((b[0]+b[2])*width/w)+padding+1);
  const bottom=b[1]+b[3]>=h?fullHeight:Math.min(fullHeight,Math.ceil((b[1]+b[3])*height/h)+padding+1);
  return {x,y,width:right-x,height:bottom-y,fullWidth,fullHeight};
}
export function walkingZoom(width,height) {return Math.min(1.8,width/1500,height/1000);}
