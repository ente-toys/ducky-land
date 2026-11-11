import cropBounds from './theme-raster-bounds.json' with {type:'json'};
// Raster viewport crops in placed world units, independent of theme or SVG size.
// Crop in world units before rasterising, so zoom never magnifies a low-res
// bitmap and only the visible pieces occupy the bounded texture pools.
export const RASTER_TILE_SIZE = 64;
export const RASTER_GROUND_TILE_SIZE = 128;
export const RASTER_MAX_RESOLUTION = 4;
export const RASTER_ART_BUDGET_BYTES = 80 * 1048576;
export const RASTER_ART_UTILIZATION = .995;
export function rasterTiles(p, src, anchor = {x: 0, y: 0}, tileSize = RASTER_TILE_SIZE) {
  const width=p.width*(p.scale??1),height=p.height*(p.scale??1),tiles=[];
  const crops=cropBounds[[src,width,height,tileSize].join('|')]??Array.from({length:Math.ceil(height/tileSize)},(_,row)=>
    Array.from({length:Math.ceil(width/tileSize)},(_,col)=>{const x=col*tileSize,y=row*tileSize;return [x,y,Math.min(tileSize+.5,width-x),Math.min(tileSize+.5,height-y)];})).flat();
  for(const [x,y,w,h]of crops){
    // Half a world-unit overlap hides independently antialiased crop edges.
    const localX=(p.flip?width-x-w:x)-width*anchor.x,localY=y-height*anchor.y;
    const crop=[width,height,x,y,w,h];
    tiles.push({src:src+(src.includes('?')?'&':'?')+'rasterCrop='+crop.join(','),
      x:p.x+localX,y:p.y+localY,localX,localY,width:w,height:h,flip:p.flip,
      resolution:RASTER_MAX_RESOLUTION,screenResolution:true,rasterDensity:p.rasterDensity??1,viewMargin:p.rasterMargin??(p.wind===true?16:0)});
  }
  return tiles;
}

export {cropSVG} from './svg-crop.js';
