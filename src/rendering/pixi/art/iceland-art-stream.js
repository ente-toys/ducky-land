import {createRasterLoader} from './theme-art-stream.js';

export function icelandPieceSVG(original,[width,height,_x,_y,w,h],density=1){
  const clean=original.replace(/<\?xml[^>]*>/g,'').replace(/<!DOCTYPE[^>]*>/g,'');
  const inner=clean.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/,'$1')
    .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/,'$1').replace('<svg',`<svg width="${width}" height="${height}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w*density)}" height="${Math.ceil(h*density)}" viewBox="0 0 ${Math.ceil(w*density)/density} ${Math.ceil(h*density)/density}">${inner}</svg>`;
}
export const createIcelandRasterLoader=()=>createRasterLoader({prepareSVG:icelandPieceSVG,exactFrame:true,concurrency:4});

export function icelandPieceTile(p,src,anchor={x:.5,y:1}){
  const width=p.width*(p.scale??1),height=p.height*(p.scale??1);
  const localX=-width*anchor.x,localY=-height*anchor.y;
  return {src:src+'?rasterCrop='+[width,height,0,0,width,height].join(','),
    x:p.x+localX,y:p.y+localY,localX,localY,width,height,flip:p.flip,
    pixelWidth:width,pixelHeight:height,screenResolution:true,resolution:4,
    fullResolutionFirst:true,viewMargin:p.wind===true?16:0,prefetchMargin:320,priority:p.rasterPriority??(p.finalKind==='ground-detail'?0:2)};
}
export function icelandWarmupTiles(pieces,url){
  const sources=new Map();
  for(const p of pieces){
    const tile=icelandPieceTile(p,url(p.src)),held=sources.get(tile.src);
    if(held)held.count++;else sources.set(tile.src,{tile,count:1,standing:p.finalKind!=='ground-detail'});
  }
  return [...sources.values()].filter(e=>e.count>1||e.standing).map(({tile})=>({...tile,
    preload:true,render:false,screenResolution:false,resolution:.5,priority:-2}));
}
