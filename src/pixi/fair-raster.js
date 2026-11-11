import cropBounds from './fair-raster-bounds.json' with {type:'json'};
// Fair's small intrinsic SVGs are enlarged up to 4.35x in the layout.
// Crop in world units before rasterising, so zoom never magnifies a low-res
// bitmap and only the visible pieces occupy the bounded texture pools.
export const FAIR_TILE_SIZE = 96;
export const FAIR_GROUND_TILE_SIZE = 128;
export const FAIR_MAX_RESOLUTION = 4;
// Previously Fair's non-ground source textures alone occupied 88.30 MiB.
// Leave room for the independent 3.625x Fair kite lease as well. Together
// they remain below the old 88.30 MiB permanent Fair art set, even when Home
// already owns the original 2x kite textures.
export const FAIR_ART_BUDGET_BYTES = 80 * 1048576;
export const FAIR_ART_UTILIZATION = .995;
export const FAIR_KITE_RESOLUTION = 3.625;

export function fairTiles(p, src, anchor = {x: 0, y: 0}, tileSize = FAIR_TILE_SIZE) {
  const width=p.width*(p.scale??1),height=p.height*(p.scale??1),tiles=[];
  const crops=cropBounds[[src,width,height].join('|')]??Array.from({length:Math.ceil(height/tileSize)},(_,row)=>
    Array.from({length:Math.ceil(width/tileSize)},(_,col)=>{const x=col*tileSize,y=row*tileSize;return [x,y,Math.min(tileSize+.5,width-x),Math.min(tileSize+.5,height-y)];})).flat();
  for(const [x,y,w,h]of crops){
    // Half a world-unit overlap hides independently antialiased crop edges.
    const localX=(p.flip?width-x-w:x)-width*anchor.x,localY=y-height*anchor.y;
    const crop=[width,height,x,y,w,h];
    tiles.push({src:src+(src.includes('?')?'&':'?')+'fairCrop='+crop.join(','),
      x:p.x+localX,y:p.y+localY,localX,localY,width:w,height:h,flip:p.flip,
      resolution:FAIR_MAX_RESOLUTION,screenResolution:true,viewMargin:tileSize===FAIR_GROUND_TILE_SIZE?0:16});
  }
  return tiles;
}

// Fair keeps its authored viewport dimensions; the loader sets canvas density.
export {cropSVG as cropFairSVG} from './svg-crop.js';
