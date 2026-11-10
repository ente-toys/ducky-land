// Theme-independent sparse crop plans. Sources stay vector and read-only.
// node scripts/globe-perf/raster-bounds.mjs cathedral
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {cropSVG,RASTER_TILE_SIZE,RASTER_GROUND_TILE_SIZE} from '../../src/pixi/theme-raster.js';
const theme=process.argv[2];
if(!theme||!/^[a-z-]+$/.test(theme))throw Error('Supply a theme name');
const base=`/pixi-art/themes/${theme}/`,art=JSON.parse(readFileSync(`public${base}art.json`));
const file='src/pixi/theme-raster-bounds.json',bounds=JSON.parse(readFileSync(file));
for(const key of Object.keys(bounds))if(key.startsWith(base))delete bounds[key];
for(const [p,tileSize] of [...art.ground.tiles.map(p=>[p,RASTER_GROUND_TILE_SIZE]),...[...art.decks,...art.flats,...art.props,...(art.floating??[])].map(p=>[p,RASTER_TILE_SIZE])]){
 const src=p.src.startsWith('/')?p.src:base+p.src;
 const width=p.width*(p.scale??1),height=p.height*(p.scale??1),key=[src,width,height,tileSize].join('|');
 if(bounds[key])continue;
 const W=Math.ceil(width),H=Math.ceil(height);
 const {data,info}=await sharp(Buffer.from(cropSVG(readFileSync('public'+src,'utf8'),[width,height,0,0,width,height]))).resize(W,H,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const crops=[];
 for(let y=0;y<height;y+=tileSize)for(let x=0;x<width;x+=tileSize){
  const right=Math.min(x+tileSize+.5,width),bottom=Math.min(y+tileSize+.5,height);
  const x0=Math.floor(x),x1=Math.min(W,Math.ceil(right)),y0=Math.floor(y),y1=Math.min(H,Math.ceil(bottom));
  let minX=W,minY=H,maxX=-1,maxY=-1;
  for(let iy=y0;iy<y1;iy++)for(let ix=x0;ix<x1;ix++)if(data[(iy*info.width+ix)*4+3]){minX=Math.min(minX,ix);maxX=Math.max(maxX,ix);minY=Math.min(minY,iy);maxY=Math.max(maxY,iy);}
  if(maxX<0)continue;
  const left=Math.max(x,minX-2),top=Math.max(y,minY-2);
  crops.push([left,top,Math.min(right,maxX+3)-left,Math.min(bottom,maxY+3)-top]);
 }
 bounds[key]=crops;
}
writeFileSync(file,JSON.stringify(bounds)+'\n');
console.log(`${theme}: ${Object.keys(bounds).length} SVG/size crop plans`);
