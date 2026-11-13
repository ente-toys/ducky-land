import cropBounds from './theme-raster-bounds.json' with {type:'json'};
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
    const localX=(p.flip?width-x-w:x)-width*anchor.x,localY=y-height*anchor.y;
    const crop=[width,height,x,y,w,h];
    tiles.push({src:src+(src.includes('?')?'&':'?')+'rasterCrop='+crop.join(','),
      x:p.x+localX,y:p.y+localY,localX,localY,width:w,height:h,flip:p.flip,
      resolution:RASTER_MAX_RESOLUTION,screenResolution:true,rasterDensity:p.rasterDensity??1,viewMargin:p.rasterMargin??(p.wind===true?16:0)});
  }
  return tiles;
}

export function cropSVG(original, crop, density = 1) {
  const [width,height,x,y,w,h]=crop;
  const clean=original.replace(/<\?xml[^>]*>/g,'').replace(/<!DOCTYPE[^>]*>/g,'');
  const start=clean.indexOf('<svg'),end=clean.indexOf('>',start),root=clean.slice(start,end+1);
  const viewBox=root.match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]??`0 0 ${width} ${height}`;
  const attrs=root.replace(/^<svg/,'').replace(/>$/,'')
    .replace(/\s(?:width|height|viewBox|preserveAspectRatio|x|y)\s*=\s*(["']).*?\1/g,'');
  const pixelsW=density===1?w:Math.ceil(w*density),pixelsH=density===1?h:Math.ceil(h*density);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelsW}" height="${pixelsH}" viewBox="${x} ${y} ${w} ${h}"><svg ${attrs} width="${width}" height="${height}" preserveAspectRatio="none" viewBox="${viewBox}">${clean.slice(end+1,clean.lastIndexOf('</svg>'))}</svg></svg>`;
}
